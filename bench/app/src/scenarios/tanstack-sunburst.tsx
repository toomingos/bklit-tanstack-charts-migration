// PERFORMANCE-CEILING reference (native/idiomatic TanStack styling), NOT a
// bklit-styled clone -- same "ceiling-not-clone" philosophy as
// tanstack-radar.tsx's/tanstack-pie.tsx's header comments: no bklit-specific
// chrome (angular sweep-reveal stagger, hover pop/dim, breadcrumb, center
// hub, always-on labels, aria-live hint, etc.) is ported here.
//
// This mirrors the canonical conformance fixture's own recipe verbatim
// (repos/tanstack-charts/benchmarks/conformance/cases/101-sunburst/
// tanstack.ts): `hierarchy(tree).sum(leavesOnly)` -> `partition().size([2π,
// height+1])` -> flatten to `{id, name, value, depth, startAngle, endAngle,
// fill}` -> `polar({ radiusRatio, marks: [radialArc(data, { generator: ... })]
// })`, where the `radialArc` `generator` hook builds a d3-shape `arc()`
// keyed by each datum's own `depth` for radial placement (exactly like the
// fixture) rather than relying on `radialArc`'s simple per-datum
// radius/angle channels.
//
// DEPENDENCY FINDING (checked as instructed, before writing this file):
// `d3-hierarchy` -- the fixture's `hierarchy`/`partition`/`HierarchyRectangularNode`
// import -- is NOT a dependency of bench/app (confirmed: `require.resolve
// ("d3-hierarchy")` fails inside bench/app; bench/app/package.json only
// lists d3-array/d3-geo/d3-scale/d3-shape; no `d3-hierarchy` directory
// exists anywhere reachable outside `repos/`). Adding it would be a new npm
// dependency, forbidden by this task's integrity rules. So the
// `hierarchy(...).sum(...)` + `partition().size(...)` step below is
// reimplemented inline (`flattenSunburstTree`), using only this bench's own
// seeded tree shape -- d3-shape's `arc()` (an EXISTING dependency, already
// used by tanstack-pie.tsx) is still used for the actual generator callback,
// preserving the fixture's real recipe for the one part that matters most
// for render cost: per-datum arc-path generation. The inline function only
// replaces the angular (x0/x1) partition math (a well-known, simple
// recursive value-weighted proportional-angle split -- the same algorithm
// d3-hierarchy's own `partition()` implements) -- the fixture's generator
// never reads partition's radial (y0/y1) output at all (it recomputes
// radial thickness from `node.depth` directly), so no radial-partition
// logic needs replicating either.
import { useEffect, useMemo, useRef, useState } from "react";
import { arc } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { polar, radialArc } from "@tanstack/charts/polar";
import {
  generateSunburst,
  generateSunburstUpdate,
  type SeededSunburstNode,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Matches bklit-sunburst.tsx's size choice (registry example's `size={360}`).
const SUNBURST_SIZE = 360;

// Small fixed palette, cycled by TOP-LEVEL BRANCH index -- ceiling scenario
// styling (native/idiomatic TanStack, radar/pie precedent), not a pixel
// clone of bklit's `defaultSunburstColors` (sunburst-context.tsx). Every
// descendant of a given depth-1 branch shares that branch's color, mirroring
// bklit's own `categoryIndex` inheritance rule (sunburst.ts `layoutNode`:
// `childCategory = depth === 0 ? index : categoryIndex` -- category is fixed
// at the first depth-1 branch and inherited by all its descendants).
const SUNBURST_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

interface SunburstArcDatum {
  id: string;
  name: string;
  value: number;
  depth: number; // 1-based; root (depth 0) is never emitted, matching the fixture's `.filter(node => node.depth > 0)`
  categoryIndex: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

// Leaves-only value sum -- inline equivalent of the fixture's
// `hierarchy(tree).sum((node) => node.children?.length ? 0 : node.value)`:
// a node's total value is the sum of its descendant LEAVES' values (internal
// nodes contribute 0 of their own, matching bklit's own `sumValues`,
// sunburst.ts, which this generator's data already satisfies by construction
// -- branches never carry a `value` of their own, only leaves do).
function sumLeafValues(node: SeededSunburstNode): number {
  if (!node.children || node.children.length === 0) return node.value ?? 0;
  let total = 0;
  for (const child of node.children) total += sumLeafValues(child);
  return total;
}

// Inline equivalent of d3-hierarchy's `node.height` for the root: the
// number of edges from the root down to its deepest leaf (0 for a
// childless root, 2 for this generator's fixed depth-3 root/branch/leaf
// shape). Feeds `treeDepth = maxDepth + 1`, mirroring the fixture's
// `root.height + 1`.
function maxTreeDepth(node: SeededSunburstNode): number {
  if (!node.children || node.children.length === 0) return 0;
  let max = 0;
  for (const child of node.children) {
    max = Math.max(max, 1 + maxTreeDepth(child));
  }
  return max;
}

// Inline replacement for `hierarchy(tree).sum(...)` + `partition().size([2π,
// height + 1])`, flattened directly into the fixture's own
// `SunburstArcDatum` shape (skipping the intermediate `HierarchyRectangularNode`
// representation entirely, since nothing here needs it beyond depth/value/
// angle). Angle allocation: each node's angular span is divided among its
// children in PROPORTION to each child's own leaf-value sum, in ARRAY ORDER
// (no sorting) -- exactly d3-hierarchy's `partition()` algorithm, and
// exactly bklit's own `layoutNode` angular-split rule (sunburst.ts:
// `childSpan = value > 0 ? (childValue / value) * span : 0`) -- both this
// bench's bklit and tanstack sunburst scenarios therefore lay the SAME tree
// out into the SAME angular partition, independently derived from the same
// source algorithm, not copy-pasted from each other.
//
// Angle convention: the fixture converts d3-hierarchy/partition's raw
// `x0`/`x1` (plain increasing radians, arbitrary zero-reference) into
// d3-shape `arc()`'s clockwise-from-12-o'clock convention via
// `Math.PI / 2 - x`. Applied identically below to this function's own raw
// (x0, x1) angles for full recipe parity.
function flattenSunburstTree(root: SeededSunburstNode): SunburstArcDatum[] {
  const out: SunburstArcDatum[] = [];

  function walk(
    node: SeededSunburstNode,
    idPrefix: string,
    depth: number,
    x0: number,
    x1: number,
    categoryIndex: number,
  ): void {
    const id = idPrefix ? `${idPrefix}/${node.name}` : node.name;
    const value = sumLeafValues(node);

    if (depth > 0) {
      out.push({
        id,
        name: node.name,
        value,
        depth,
        categoryIndex,
        startAngle: Math.PI / 2 - x0,
        endAngle: Math.PI / 2 - x1,
        fill: SUNBURST_PALETTE[categoryIndex % SUNBURST_PALETTE.length] ?? SUNBURST_PALETTE[0]!,
      });
    }

    if (node.children && node.children.length > 0) {
      const span = x1 - x0;
      let cursor = x0;
      node.children.forEach((child, index) => {
        const childValue = sumLeafValues(child);
        const childSpan = value > 0 ? (childValue / value) * span : span / node.children!.length;
        const childCategory = depth === 0 ? index : categoryIndex;
        walk(child, id, depth + 1, cursor, cursor + childSpan, childCategory);
        cursor += childSpan;
      });
    }
  }

  walk(root, "", 0, 0, Math.PI * 2, 0);
  return out;
}

export default function TanstackSunburst({ n }: { n: number }) {
  const [tree, setTree] = useState<SeededSunburstNode>(() =>
    generateSunburst("sunburst", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setTree(generateSunburstUpdate("sunburst", n, tickRef.current));
      });
    // See bklit-sunburst.tsx: sunburst's `n` is total arc count at a fixed
    // depth-3 tree shape (D32), not a time-series window -- no live-append
    // concept applies. Zoom/drilldown QA (D32's `__benchDrilldown`) is a
    // bklit-specific interaction mechanism (bklit's internal `zoomTo`) with
    // no equivalent concept in this static, ceiling-reference render -- not
    // wired here, matching this file's "ceiling, not clone" scope.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const data = flattenSunburstTree(tree);
    const treeDepth = maxTreeDepth(tree) + 1;

    return defineChart({
      marks: [
        polar({
          radiusRatio: 0.88,
          marks: [
            radialArc(data, {
              key: "id",
              generator: ({ radius }) => {
                const innerRadius = radius * 0.14;
                const thickness = (radius - innerRadius) / treeDepth;
                const ringPadding = 2;

                return arc<unknown, SunburstArcDatum>()
                  .startAngle((node) => node.startAngle)
                  .endAngle((node) => node.endAngle)
                  .innerRadius(
                    (node) =>
                      innerRadius + (node.depth - 1) * (thickness + ringPadding),
                  )
                  .outerRadius(
                    (node) =>
                      innerRadius +
                      (node.depth - 1) * (thickness + ringPadding) +
                      thickness,
                  );
              },
              fill: (node: SunburstArcDatum) => node.fill,
              stroke: "#ffffff",
              strokeWidth: 2,
            }),
          ],
        }),
      ],
      // Polar is a positionless container mark -- no cartesian x/y scales or
      // guides (every polar worked example in the docs, radar/pie precedent).
      guides: false,
      x: null,
      y: null,
      margin: 0,
    });
  }, [tree]);

  return (
    <Chart
      ariaLabel="Sunburst chart benchmark scenario"
      width={SUNBURST_SIZE}
      height={SUNBURST_SIZE}
      definition={definition}
      onRender={onRender}
    />
  );
}
