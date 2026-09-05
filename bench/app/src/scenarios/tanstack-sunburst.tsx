// Ceiling reference (idiomatic TanStack, not a bklit clone): fixture 101-sunburst recipe.
// GUARD: d3-hierarchy is not a bench dep; partition math is reimplemented inline (angles only).
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

const SUNBURST_SIZE = 360;

// Palette cycles by top-level branch; descendants inherit (bklit categoryIndex rule).
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
  depth: number;
  categoryIndex: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

// Leaves-only sum: internal nodes contribute 0 (branches carry no value).
function sumLeafValues(node: SeededSunburstNode): number {
  if (!node.children || node.children.length === 0) return node.value ?? 0;
  let total = 0;
  for (const child of node.children) total += sumLeafValues(child);
  return total;
}

function maxTreeDepth(node: SeededSunburstNode): number {
  if (!node.children || node.children.length === 0) return 0;
  let max = 0;
  for (const child of node.children) {
    max = Math.max(max, 1 + maxTreeDepth(child));
  }
  return max;
}

// Inline partition: angular span split by leaf-value sums in array order (no sorting).
// Angles convert via PI/2 - x into d3 arc's clockwise-from-12 convention.
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
    // GUARD: n is arc count, not a time window; no live-append or drilldown here.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const data = flattenSunburstTree(tree);
    const treeDepth = maxTreeDepth(tree) + 1;

    return defineChart({
      marks: [
        polar({
          scales: { angle: null, radius: null },
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
      guides: false,
      scales: { x: null, y: null },
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
