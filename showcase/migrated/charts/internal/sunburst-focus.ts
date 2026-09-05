import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import { ID_SEP, TWO_PI } from "./sunburst-layout";
import { geometryFor } from "./sunburst-geometry";
import type { ArcDatum, ArcGeometry, Focus, SunburstFlatRow } from "./sunburst-geometry";

type SunburstStrategyPoint = ChartPoint<TSSunburstNode<SunburstFlatRow>, number, number>;

interface CreateSunburstFocusOptions {
  readonly arcsById: ReadonlyMap<string, ArcDatum>;
  readonly focus: Readonly<Focus>;
  readonly maxDepth: number;
  readonly radius: number;
  readonly size: number;
}

// Sub-pixel radius: the shared centre vertex has no defined angle.
// Enter-only parity needs the hole, so containment starts outside it.
const CENTER_VERTEX_EPSILON_PX = 0.5;

const isRelatedSunburstId = (arcId: string, hoveredId: string): boolean =>
  arcId === hoveredId || arcId.startsWith(`${hoveredId}${ID_SEP}`) || hoveredId.startsWith(`${arcId}${ID_SEP}`);

// App-owned angular focus for arcs no package preset can resolve by pointer.
// The sunburst mark carries geometry affinity but no polar focus geometry.
const createSunburstFocus = (
  options: Readonly<CreateSunburstFocusOptions>,
): ChartFocusStrategy<TSSunburstNode<SunburstFlatRow>, number, number> => {
  const { arcsById, focus, maxDepth, radius, size } = options;
  const center = size / 2;
  // Rendered geometry per arc id, computed once from the definition's numbers.
  const geometryById = new Map<string, ArcGeometry>();
  for (const [id, arc] of arcsById) {
    const geometry = geometryFor(arc, focus, maxDepth, radius);
    if (geometry) {
      geometryById.set(id, geometry);
    }
  }
  // Enter-only parity: legacy keeps the last entered arc until svg pointerleave.
  let lastHit: SunburstStrategyPoint | null = null;
  return {
    group: (points, { point }) => {
      const hoveredId = point.datum.id;
      const related = points.filter((candidate) => {
        const arc = arcsById.get(candidate.datum.id);
        return arc ? isRelatedSunburstId(arc.id, hoveredId) : false;
      });
      return [point, ...related.filter((candidate) => candidate !== point)];
    },
    navigation: (points) => points.toSorted((left, right) => {
      const leftAngle = geometryById.get(left.datum.id)?.a0 ?? Number.POSITIVE_INFINITY;
      const rightAngle = geometryById.get(right.datum.id)?.a0 ?? Number.POSITIVE_INFINITY;
      return leftAngle - rightAngle;
    }),
    resolve: (points, { x, y }) => {
      const dx = x - center;
      const dy = y - center;
      const pointerR = Math.hypot(dx, dy);
      if (pointerR > radius) {
        lastHit = null;
        return [];
      }
      // Degenerate centre vertex: no arc contains it, so keep the last hit.
      if (pointerR < CENTER_VERTEX_EPSILON_PX) {
        return lastHit ? [lastHit] : [];
      }
      const theta = Math.atan2(dx, -dy);
      // Reverse paint order: a boundary pixel hits the arc painted last.
      for (let index = points.length - 1; index >= 0; index -= 1) {
        const point = points[index];
        const geometry = geometryById.get(point.datum.id);
        if (geometry !== undefined) {
          let angle = theta;
          while (angle < geometry.a0) {
            angle += TWO_PI;
          }
          if (angle < geometry.a1 && pointerR >= geometry.innerR && pointerR <= geometry.outerR) {
            lastHit = point;
            return [point];
          }
        }
      }
      return lastHit ? [lastHit] : [];
    },
  };
};

export { createSunburstFocus };
export type { CreateSunburstFocusOptions };
