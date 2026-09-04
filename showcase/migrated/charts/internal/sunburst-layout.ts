// Sunburst tree layout — nested-tree walk plus flat rows for the native mark.
// Extracted from sunburst-geometry.ts; verbatim from repos/bklit-ui sunburst.ts.

import type { ArcDatum, Focus, SunburstNode } from "./sunburst-types";

const TOP = -Math.PI / 2;
const TWO_PI = 2 * Math.PI;
const ID_SEP = " / ";

// Deep-readonly mirror of SunburstNode: readers only, but upstream keeps mutable `children`.
// Composed locally so imperative tree builders keep working.
type ReadonlySunburstNode = Readonly<Omit<SunburstNode, "children">> & {
  readonly children?: readonly ReadonlySunburstNode[];
};

// Layout builders.

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

/*
 * Takes `visit` instead of naming layoutNode to avoid a no-use-before-define cycle.
 * Ctx stays mutable BuildContext: the recursion mutates the accumulator throughout.
 */
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

/*
 * Flat rows for native `sunburst()`: same `nodeId` scheme so ids match `buildArcs`, raw values only.
 * Raw `value` is required — native's `root.sum(...)` aggregates, so pre-summed totals double-count.
 */

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
