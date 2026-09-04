// Sunburst tree layout — nested-tree walk plus flat rows for the native mark.
// Extracted from sunburst-geometry.ts (same module family; re-exported there so the
// Public import path is unchanged). Verbatim from:
// From repos/bklit-ui/packages/ui/src/charts/sunburst.ts.

import type { ArcDatum, Focus, SunburstNode } from "./sunburst-types";

const TOP = -Math.PI / 2;
const TWO_PI = 2 * Math.PI;
const ID_SEP = " / ";

// Deep-readonly mirror of SunburstNode: every function below only reads the input tree, but
// SunburstNode (sunburst-types.ts) keeps a mutable `children` array for callers that build
// Trees imperatively, so the readonly view is composed locally rather than upstream.
type ReadonlySunburstNode = Readonly<Omit<SunburstNode, "children">> & {
  readonly children?: readonly ReadonlySunburstNode[];
};

// ---------------------------------------------------------------------------
// Layout builders
// ---------------------------------------------------------------------------

const nodeId = (parentId: string | null, name: string): string =>
  parentId !== null && parentId.length > 0 ? `${parentId}${ID_SEP}${name}` : name;

const sumValues = (node: ReadonlySunburstNode): number => {
  if ((node.children?.length ?? 0) > 0) {
    return (node.children ?? []).reduce((sum, child) => sum + sumValues(child), 0);
  }
  return node.value ?? 0;
};

interface BuildContext {
  arcs: ArcDatum[];
  focusById: Map<string, Focus>;
  maxDepth: number;
  rootId: string;
  arcIndex: number;
}

const toRadians = (normalized: number): number => TOP + normalized * TWO_PI;

interface LayoutFrame {
  readonly node: ReadonlySunburstNode;
  readonly id: string;
  readonly depth: number;
  readonly a0: number;
  readonly a1: number;
  // Mirrors ArcDatum/Focus.parentId (sunburst-types.ts) — a null-rooted parent chain from an
  // External contract, not a value this module owns.
  readonly parentId: string | null;
  readonly categoryIndex: number;
  readonly trail: readonly string[];
}

interface ChildrenPass {
  readonly frame: LayoutFrame;
  readonly value: number;
}

// Takes `visit` as a parameter, rather than calling layoutNode by name, so this stays defined
// Before layoutNode with no two-way forward reference (mutually referencing two bindings by name
// Is a no-use-before-define finding here, even for hoisted `function` declarations); layoutNode
// Passes itself as `visit` below, a same-binding self-reference, which is exempt. Also split out
// Of layoutNode purely to keep that one under eslint(max-statements).
//
// Ctx (here, and in the `visit` callback type, and on layoutNode below) is the per-tree
// Accumulator that every call in this recursion genuinely mutates, so all three stay plain
// (non-readonly) BuildContext — marking any of them readonly would make those mutations, or the
// Structural match between `visit` and layoutNode's own signature, a type error.
const layoutChildren = (
  pass: Readonly<ChildrenPass>,
  ctx: BuildContext,
  visit: (childFrame: LayoutFrame, childCtx: BuildContext) => void,
): void => {
  const { frame, value } = pass;
  const { node, id, depth, a0, a1, categoryIndex, trail } = frame;
  const span = a1 - a0;
  let cursor = a0;
  for (const [index, child] of (node.children ?? []).entries()) {
    const childValue = sumValues(child);
    const childSpan = value > 0 ? (childValue / value) * span : 0;
    visit(
      {
        a0: cursor,
        a1: cursor + childSpan,
        categoryIndex: depth === 0 ? index : categoryIndex,
        depth: depth + 1,
        id: nodeId(id, child.name),
        node: child,
        parentId: id,
        trail: depth === 0 ? [node.name] : trail,
      },
      ctx,
    );
    cursor += childSpan;
  }
};

const layoutNode = (frame: Readonly<LayoutFrame>, ctx: BuildContext): void => {
  const value = sumValues(frame.node);
  const hasChildren = Boolean(frame.node.children?.length);

  if (frame.depth > 0) {
    ctx.arcs.push({
      a0: frame.a0,
      a1: frame.a1,
      arcIndex: ctx.arcIndex,
      categoryIndex: frame.categoryIndex,
      color: frame.node.color,
      depth: frame.depth,
      fill: frame.node.fill,
      hasChildren,
      id: frame.id,
      name: frame.node.name,
      parentId: frame.parentId,
      trail: [...frame.trail, frame.node.name],
      value,
    });
    ctx.arcIndex += 1;
  }

  ctx.focusById.set(frame.id, {
    a0: frame.a0,
    a1: frame.a1,
    categoryIndex: frame.categoryIndex,
    depth: frame.depth,
    id: frame.id,
    name: frame.node.name,
    parentId: frame.parentId,
  });
  ctx.maxDepth = Math.max(ctx.maxDepth, frame.depth);

  if (!hasChildren) {
    return;
  }
  layoutChildren({ frame, value }, ctx, layoutNode);
};

interface SunburstLayout {
  arcs: ArcDatum[];
  focusById: Map<string, Focus>;
  maxDepth: number;
  rootId: string;
  total: number;
}

const buildArcs = (data: ReadonlySunburstNode): SunburstLayout => {
  const rootId = data.name;
  const ctx: BuildContext = { arcIndex: 0, arcs: [], focusById: new Map(), maxDepth: 0, rootId };

  // Root parentId: null — see the LayoutFrame.parentId comment; matches the ArcDatum/Focus root
  // Convention (sunburst-types.ts, outside this batch).
  layoutNode(
    { a0: 0, a1: 1, categoryIndex: 0, depth: 0, id: rootId, node: data, parentId: null, trail: [] },
    ctx,
  );

  for (const arc of ctx.arcs) {
    arc.a0 = toRadians(arc.a0);
    arc.a1 = toRadians(arc.a1);
  }
  for (const focus of ctx.focusById.values()) {
    focus.a0 = toRadians(focus.a0);
    focus.a1 = toRadians(focus.a1);
  }

  return { arcs: ctx.arcs, focusById: ctx.focusById, maxDepth: ctx.maxDepth, rootId, total: sumValues(data) };
};

// ---------------------------------------------------------------------------
// Flat rows for native `sunburst()` (C5d, D-TBD) — native's hierarchy
// Pipeline (`hierarchy-flat-internal.js`'s `buildFlatHierarchy`) is a
// `d3-hierarchy` `stratify()` over FLAT rows with `nodeId`/`parentId`
// Accessors, not a nested-tree walk. This flattens the SAME nested
// `SunburstNode` `data` prop `buildArcs` walks, using the IDENTICAL `nodeId`
// Scheme (so ids match 1:1 with `ArcDatum.id`/`Focus.id` from `buildArcs` —
// Required for `arcsById` cross-referencing in sunburst-chart.tsx) — but
// Carries each node's OWN raw `value` (`rawValue`, undefined for a node with
// No `value` field), not `sumValues`'s pre-aggregated subtree total. This
// Distinction is required by parity condition 1 (see sunburst-chart.tsx):
// Native's own `hierarchy.root.sum(...)` (`hierarchy-flat-internal.js:97`)
// ADDS a node's own value on top of its children's, so the `value` accessor
// Passed to `sunburst()` must return 0 for any node with children (letting
// Only the children's sums flow up) — passing our own pre-summed
// `ArcDatum.value` here would double-count.
// ---------------------------------------------------------------------------

interface SunburstFlatRow {
  id: string;
  parentId: string | null;
  hasChildren: boolean;
  rawValue: number | undefined;
}

const buildSunburstFlatRows = (data: ReadonlySunburstNode): SunburstFlatRow[] => {
  const rows: SunburstFlatRow[] = [];
  const walk = (node: ReadonlySunburstNode, id: string, parentId: string | null): void => {
    const hasChildren = Boolean(node.children?.length);
    rows.push({ hasChildren, id, parentId, rawValue: node.value });
    if (hasChildren) {
      for (const child of node.children ?? []) {
        walk(child, nodeId(id, child.name), id);
      }
    }
  };
  walk(data, nodeId(null, data.name), null);
  return rows;
};

export { ID_SEP, TOP, TWO_PI, buildArcs, buildSunburstFlatRows, nodeId, sumValues, toRadians };
export type { SunburstFlatRow, SunburstLayout };
