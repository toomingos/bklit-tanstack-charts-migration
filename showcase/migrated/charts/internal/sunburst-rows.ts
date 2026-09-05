// Pre-package inputs only; the native mark owns the partition.

import type { ArcDatum, SunburstNode } from "./sunburst-types";

const ID_SEP = " / ";

// Stable sector id: parent chain joined with the separator (root is bare name).
const nodeId = (parentId: string | null, name: string): string =>
  parentId !== null && parentId.length > 0 ? `${parentId}${ID_SEP}${name}` : name;

// Flat rows for native `sunburst()`: raw leaf values only.
// Pre-summed totals would double-count under native `root.sum(...)`.
interface SunburstFlatRow {
  readonly id: string;
  readonly parentId: string | null;
  readonly hasChildren: boolean;
  readonly rawValue: number | undefined;
}

const buildSunburstFlatRows = (data: ReadonlySunburstNodeLite): SunburstFlatRow[] => {
  const rows: SunburstFlatRow[] = [];
  const walk = (node: ReadonlySunburstNodeLite, id: string, parentId: string | null): void => {
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

// Deep-readonly SunburstNode mirror for readers (mutable upstream).
type ReadonlySunburstNodeLite = Readonly<Omit<SunburstNode, "children">> & {
  readonly children?: readonly ReadonlySunburstNodeLite[];
};

// Pre-order sector index; aggregate value is the leaf sum.
interface SunburstModel {
  readonly sectors: ArcDatum[];
  readonly sectorById: Map<string, ArcDatum>;
  readonly maxDepth: number;
  readonly rootId: string;
}

const subtreeTotal = (node: ReadonlySunburstNodeLite): number => {
  if ((node.children?.length ?? 0) > 0) {
    return (node.children ?? []).reduce((sum, child) => sum + subtreeTotal(child), 0);
  }
  return node.value ?? 0;
};

const buildSunburstSectors = (data: ReadonlySunburstNodeLite): SunburstModel => {
  const sectors: ArcDatum[] = [];
  const sectorById = new Map<string, ArcDatum>();
  const rootId = data.name;
  let maxDepth = 0;
  let arcIndex = 0;

  const walk = (
    node: ReadonlySunburstNodeLite,
    id: string,
    parentId: string | null,
    depth: number,
    categoryIndex: number,
  ): void => {
    maxDepth = Math.max(maxDepth, depth);
    const hasChildren = Boolean(node.children?.length);
    if (depth > 0) {
      const sector: ArcDatum = {
        a0: 0,
        a1: 0,
        arcIndex,
        categoryIndex,
        color: node.color,
        depth,
        fill: node.fill,
        hasChildren,
        id,
        name: node.name,
        parentId,
        // Verbatim legacy shape: every frame below the root carries
        // [rootName], so each trail is [rootName, selfName].
        trail: [rootId, node.name],
        value: subtreeTotal(node),
      };
      sectors.push(sector);
      sectorById.set(id, sector);
      arcIndex += 1;
    }
    for (const [index, child] of (node.children ?? []).entries()) {
      walk(
        child,
        nodeId(id, child.name),
        id,
        depth + 1,
        depth === 0 ? index : categoryIndex,
      );
    }
  };
  walk(data, rootId, null, 0, 0);

  return { maxDepth, rootId, sectorById, sectors };
};

// Center-hole sizing for the package `innerRadius` input (hole-only).
// Numbers match the legacy center sizing so drilled pixels don't move.
const DRILL_CENTER_SCALE = 0.65;
const DRILL_CENTER_DEPTH_SHRINK = 0.08;
const MIN_DRILL_CENTER_SCALE = 0.45;

const sunburstCenterHole = (focusDepth: number, maxDepth: number, radius: number): number => {
  const oneLevel = radius / maxDepth;
  if (focusDepth === 0) {
    return 0;
  }
  const pastFirst = Math.max(0, focusDepth - 1);
  const scale = Math.max(
    MIN_DRILL_CENTER_SCALE,
    DRILL_CENTER_SCALE - pastFirst * DRILL_CENTER_DEPTH_SHRINK,
  );
  return oneLevel * scale;
};

// Container padding for hover pop-out room (ring/depth budgeted).
const HOVER_GROW_RING_BUDGET = 0.28;
const HOVER_GROW_SEGMENT_CAP = 0.1;

const sunburstGrowPadding = (maxDepth: number, size: number, hoverPop: number): number => {
  const fullRadius = size / 2;
  const rootRingWidth = fullRadius / Math.max(1, maxDepth);
  const pathLength = Math.max(1, maxDepth - 1);
  const maxTotalGrow = rootRingWidth * HOVER_GROW_RING_BUDGET;
  const segmentGrow = Math.min(
    hoverPop,
    rootRingWidth * HOVER_GROW_SEGMENT_CAP,
    maxTotalGrow / pathLength,
  );
  return Math.ceil(segmentGrow * pathLength + segmentGrow);
};

export { ID_SEP, buildSunburstFlatRows, buildSunburstSectors, nodeId, sunburstCenterHole, sunburstGrowPadding };
export type { ReadonlySunburstNodeLite, SunburstFlatRow, SunburstModel };
