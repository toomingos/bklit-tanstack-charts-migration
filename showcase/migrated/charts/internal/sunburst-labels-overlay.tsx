// SunburstLabelsOverlay — SVG label overlay for sunburst segments.
// Split from ./sunburst-labels (react/no-multi-comp): one component per file.

import type { CSSProperties, ReactElement } from "react";
import type { ChartScene, SceneArea, SceneNode } from "@tanstack/charts";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import type { SunburstFlatRow } from "./sunburst-rows";
import type { ArcDatum } from "./sunburst-types";

interface LabelItem {
  readonly x: number;
  readonly y: number;
  readonly deg: number;
  readonly label: string;
  readonly id: string;
}

// Settled-scene data point per painted sector (centroid, lineage, legibility).
interface SunburstLabelSnap {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly depth: number;
  readonly ancestorIds: readonly string[];
  readonly fits: boolean;
}

// Label legibility floors: minimum arc length and ring thickness in pixels for a label to render.
const LABEL_MIN_ARC_LENGTH_PX = 26;
const LABEL_MIN_RING_WIDTH_PX = 16;
// Degree geometry for label rotation: radians-to-degrees half-circle and the flip threshold.
const DEGREES_PER_HALF_CIRCLE = 180;
const LABEL_FLIP_THRESHOLD_DEGREES = 90;

// Outer-edge arc length of a sampled sector polygon, summed as chords.
// Distances run from the local origin; callers scale to the label radius.
interface SectorMeasure {
  readonly outerLength: number;
  readonly thickness: number;
  readonly outerR: number;
}

const measureOuterArcLength = (
  polygon: readonly (readonly [number, number])[],
): SectorMeasure => {
  const dists: number[] = [];
  let minD = Number.POSITIVE_INFINITY;
  let maxD = 0;
  for (const [pointX, pointY] of polygon) {
    const dist = Math.hypot(pointX, pointY);
    dists.push(dist);
    minD = Math.min(minD, dist);
    maxD = Math.max(maxD, dist);
  }
  const mid = (minD + maxD) / 2;
  let outerLength = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const distA = dists[i];
    const distB = dists[(i + 1) % dists.length];
    if (distA > mid && distB > mid) {
      const vertA = polygon[i];
      const vertB = polygon[(i + 1) % polygon.length];
      outerLength += Math.hypot(vertB[0] - vertA[0], vertB[1] - vertA[1]);
    }
  }
  return { outerLength, outerR: maxD, thickness: polygon.length === 0 ? 0 : maxD - minD };
};

const collectSnapAreas = (nodes: readonly SceneNode[], into: Map<object, SceneArea>): void => {
  for (const node of nodes) {
    if (node.kind === "group") {
      collectSnapAreas(node.children, into);
    } else if (node.kind === "area") {
      const owner = node.interaction && "point" in node.interaction ? node.interaction.point : undefined;
      if (owner !== undefined) {
        into.set(owner, node);
      }
    } else {
      // Decorative primitives own no focus point.
    }
  }
};

// Snapshot of the settled scene for labels: one entry per painted sector.
// Returns null when the scene belongs to another root (stale commit).
const extractSunburstLabelSnap = (
  scene: ChartScene<TSSunburstNode<SunburstFlatRow>, number, number>,
  focusId: string,
): SunburstLabelSnap[] | null => {
  const { nodes, points } = scene;
  if (points.length > 0 && points[0].datum.ancestorIds[0] !== focusId) {
    return null;
  }
  const areas = new Map<object, SceneArea>();
  collectSnapAreas(nodes, areas);
  const snap: SunburstLabelSnap[] = [];
  for (const point of points) {
    const polygon = areas.get(point)?.points;
    if (polygon !== undefined) {
      const { outerLength, outerR, thickness } = measureOuterArcLength(polygon);
      const arcLength = outerR > 0 ? (outerLength * point.yValue) / outerR : 0;
      snap.push({
        ancestorIds: point.datum.ancestorIds,
        angle: point.xValue,
        depth: point.datum.depth,
        fits: arcLength >= LABEL_MIN_ARC_LENGTH_PX && thickness >= LABEL_MIN_RING_WIDTH_PX,
        id: point.datum.id,
        x: point.x,
        y: point.y,
      });
    }
  }
  return snap;
};

// Normalizes a centroid angle into a readable label rotation in degrees.
const normalizeLabelRotation = (midAngle: number): number => {
  const rawDegrees = (midAngle * DEGREES_PER_HALF_CIRCLE) / Math.PI - LABEL_FLIP_THRESHOLD_DEGREES;
  if (rawDegrees > LABEL_FLIP_THRESHOLD_DEGREES) {return rawDegrees - DEGREES_PER_HALF_CIRCLE;}
  if (rawDegrees < -LABEL_FLIP_THRESHOLD_DEGREES) {return rawDegrees + DEGREES_PER_HALF_CIRCLE;}
  return rawDegrees;
};

// Child index of a label snapshot, keyed by parent id, for lineage walks.
const indexSnapChildren = (
  snap: readonly SunburstLabelSnap[],
): Map<string, SunburstLabelSnap[]> => {
  const childrenOf = new Map<string, SunburstLabelSnap[]>();
  for (const entry of snap) {
    const parent = entry.ancestorIds.at(-1);
    if (parent !== undefined) {
      const siblings = childrenOf.get(parent);
      if (siblings === undefined) {
        childrenOf.set(parent, [entry]);
      } else {
        siblings.push(entry);
      }
    }
  }
  return childrenOf;
};

// Adds a sector's painted descendants to the set, depth-first.
const addDescendantIds = (
  related: Set<string>,
  childrenOf: ReadonlyMap<string, SunburstLabelSnap[]>,
  hoveredId: string,
): void => {
  const children = childrenOf.get(hoveredId) ?? [];
  for (const child of children) {
    if (!related.has(child.id)) {
      related.add(child.id);
      addDescendantIds(related, childrenOf, child.id);
    }
  }
};
// Hovered-sector lineage index for constant-time culling tests.
const collectRelatedIds = (
  snap: readonly SunburstLabelSnap[],
  hoveredId: string | null,
): Set<string> | null => {
  if (hoveredId === null || hoveredId === "") {
    return null;
  }
  const byId = new Map<string, SunburstLabelSnap>();
  for (const entry of snap) {
    byId.set(entry.id, entry);
  }
  const related = new Set<string>([hoveredId]);
  const hovered = byId.get(hoveredId);
  if (hovered !== undefined) {
    for (const ancestor of hovered.ancestorIds) {
      related.add(ancestor);
    }
  }
  addDescendantIds(related, indexSnapChildren(snap), hoveredId);
  return related;
};

// Label entries from the snapshot, culled to hovered lineage.
const buildSunburstLabelItems = (
  snap: readonly SunburstLabelSnap[],
  sectorById: ReadonlyMap<string, ArcDatum>,
  hoveredId: string | null,
  size: number,
): LabelItem[] => {
  const relatedIds = collectRelatedIds(snap, hoveredId);
  const items: LabelItem[] = [];
  for (const entry of snap) {
    const visible = entry.fits && (relatedIds === null || relatedIds.has(entry.id));
    if (visible) {
      const sector = sectorById.get(entry.id);
      if (sector) {
        items.push({
          deg: normalizeLabelRotation(entry.angle),
          id: entry.id,
          label: sector.name,
          x: entry.x - size / 2,
          y: entry.y - size / 2,
        });
      }
    }
  }
  return items;
};

/*
 * Culling happens upstream in the label-items builder, mirroring bklit's !isRelated guard.
 */

interface SunburstLabelsOverlayProps {
  readonly items: readonly LabelItem[];
  readonly fullRadius: number;
  readonly size: number;
}

// Overlay positioning — fully static, hoisted so every render shares one identity.
const SUNBURST_LABELS_OVERLAY_STYLE: Readonly<CSSProperties> = {
  height: "100%",
  left: 0,
  overflow: "visible",
  pointerEvents: "none",
  position: "absolute",
  top: 0,
  width: "100%",
};

// Item count that means the overlay has nothing to render.
const EMPTY_ITEMS_LENGTH = 0;

// Shared label text paint — one identity for every <text>, not rebuilt per render.
const SUNBURST_LABEL_TEXT_STYLE: Readonly<CSSProperties> = {
  fill: "var(--chart-label)",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  opacity: 1,
  paintOrder: "stroke",
  stroke: "var(--chart-background)",
  strokeLinejoin: "round",
  strokeWidth: 2.5,
};

const SunburstLabelsOverlay = ({
  items,
  fullRadius: _fullRadius,
  size: _size,
}: SunburstLabelsOverlayProps): ReactElement | undefined => {
  if (items.length === EMPTY_ITEMS_LENGTH) {return undefined;}

  return (
    <svg
      aria-label="Sunburst segment labels"
      className="ts-bkm-sunburst-labels"
      style={SUNBURST_LABELS_OVERLAY_STYLE}
      viewBox={`${-_fullRadius} ${-_fullRadius} ${_size} ${_size}`}
    >
      {items.map((item) => (
        <text
          key={item.id}
          className="ts-bkm-sunburst-label"
          data-label-id={item.id}
          dominantBaseline="middle"
          pointerEvents="none"
          textAnchor="middle"
          transform={`rotate(${item.deg} ${item.x} ${item.y})`}
          x={item.x}
          y={item.y}
          style={SUNBURST_LABEL_TEXT_STYLE}
        >
          {item.label}
        </text>
      ))}
    </svg>
  );
};

export { SunburstLabelsOverlay, buildSunburstLabelItems, extractSunburstLabelSnap };
export type { LabelItem, SunburstLabelSnap, SunburstLabelsOverlayProps };
