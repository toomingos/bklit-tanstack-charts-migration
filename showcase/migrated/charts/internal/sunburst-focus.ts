// Hover resolves against painted sector polygons, never re-derived layout.

import type {
  ChartFocusStrategy,
  ChartPoint,
  ChartScene,
  SceneArea,
  SceneNode,
} from "@tanstack/charts";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import type { SunburstFlatRow } from "./sunburst-rows";

type SunburstScene = ChartScene<TSSunburstNode<SunburstFlatRow>, number, number>;
type SunburstStrategyPoint = ChartPoint<TSSunburstNode<SunburstFlatRow>, number, number>;

interface CreateSunburstFocusOptions {
  readonly getScene: () => SunburstScene | null;
}

// Shared centre vertex has no defined angle (keep the last hit).
const CENTER_VERTEX_EPSILON_PX = 0.5;

// Ray-cast containment of a scene-space pointer in a sampled sector polygon.
const pointInSectorPolygon = (
  x: number,
  y: number,
  polygon: readonly (readonly [number, number])[],
): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i]?.[0] ?? 0;
    const yi = polygon[i]?.[1] ?? 0;
    const xj = polygon[j]?.[0] ?? 0;
    const yj = polygon[j]?.[1] ?? 0;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

// Paint-order sector areas with group offsets (tested back-to-front).
interface OffsetSectorArea {
  readonly area: SceneArea;
  readonly offsetX: number;
  readonly offsetY: number;
}

const collectSectorAreas = (
  nodes: readonly SceneNode[],
  offsetX: number,
  offsetY: number,
  into: OffsetSectorArea[],
): void => {
  for (const node of nodes) {
    if (node.kind === "group") {
      collectSectorAreas(
        node.children,
        offsetX + (node.translateX ?? 0),
        offsetY + (node.translateY ?? 0),
        into,
      );
    } else if (node.kind === "area" && node.interaction && "point" in node.interaction) {
      into.push({ area: node, offsetX, offsetY });
    } else {
      // Decorative primitives own no focus point.
    }
  }
};

const isRelatedSunburstNode = (
  candidate: TSSunburstNode<SunburstFlatRow>,
  hovered: TSSunburstNode<SunburstFlatRow>,
): boolean =>
  candidate.id === hovered.id ||
  candidate.ancestorIds.includes(hovered.id) ||
  hovered.ancestorIds.includes(candidate.id);

// Package-owned pointer focus over painted polygons and node lineage.
const createSunburstFocus = (
  options: Readonly<CreateSunburstFocusOptions>,
): ChartFocusStrategy<TSSunburstNode<SunburstFlatRow>, number, number> => {
  const { getScene } = options;
  // Enter-only parity: keep the last hit until pointerleave.
  let lastHit: SunburstStrategyPoint | null = null;
  return {
    group: (points, { point }) => {
      const hovered = point.datum;
      const related = points.filter((candidate) => isRelatedSunburstNode(candidate.datum, hovered));
      return [point, ...related.filter((candidate) => candidate !== point)];
    },
    navigation: (points) => points.toSorted((left, right) => left.xValue - right.xValue),
    resolve: (points, { x, y }) => {
      const scene = getScene();
      if (!scene) {
        return lastHit ? [lastHit] : [];
      }
      const areas: OffsetSectorArea[] = [];
      collectSectorAreas(scene.nodes, 0, 0, areas);
      const byPoint = new Map<ChartPoint, OffsetSectorArea>();
      for (const target of areas) {
        const owner = target.area.interaction && "point" in target.area.interaction ? target.area.interaction.point : undefined;
        if (owner) {
          byPoint.set(owner, target);
        }
      }
      // Reverse paint order; shared-edge misses keep the last hit.
      for (let index = points.length - 1; index >= 0; index -= 1) {
        const point: SunburstStrategyPoint = points[index];
        const target = byPoint.get(point);
        const isCenterVertex = target !== undefined
          && Math.hypot(x - target.offsetX, y - target.offsetY) < CENTER_VERTEX_EPSILON_PX;
        if (target !== undefined && !isCenterVertex
          && pointInSectorPolygon(x - target.offsetX, y - target.offsetY, target.area.points)) {
          lastHit = point;
          return [point];
        }
      }
      return lastHit ? [lastHit] : [];
    },
  };
};

export { createSunburstFocus, pointInSectorPolygon };
export type { CreateSunburstFocusOptions };
