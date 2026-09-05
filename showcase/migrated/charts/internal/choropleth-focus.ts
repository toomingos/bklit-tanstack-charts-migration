import { geoContains, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type {
  ChartFocusGroupContext,
  ChartFocusResolveContext,
  ChartFocusStrategy,
  ChartPoint,
} from "@tanstack/charts";

// Narrowest datum the strategy needs: a GeoJSON feature (name/id live in properties).
type FocusableFeature = Feature<Geometry, Record<string, unknown>>;

interface ChoroplethFocusOptions<TDatum extends FocusableFeature> {
  readonly features: readonly TDatum[];
  readonly projection: GeoProjection;
}

type ProjectedRing = readonly (readonly [number, number])[];

type ChoroplethBounds = [[number, number], [number, number]] | undefined;

interface ScenePoint {
  readonly px: number;
  readonly py: number;
}

// Projected ring for the edge fallback; unprojectable coords are dropped.
const projectRing = (ring: readonly number[][], projection: GeoProjection): [number, number][] => {
  const projected: [number, number][] = [];
  for (const coord of ring) {
    const point = projection([coord.at(0) ?? 0, coord.at(1) ?? 0]);
    if (point && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
      projected.push([point[0], point[1]]);
    }
  }
  return projected;
};

// Feature polygons as projected rings (MultiPolygon flattened, other types skipped).
const projectFeatureRings = (feature: FocusableFeature, projection: GeoProjection): ProjectedRing[] => {
  const { geometry } = feature;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {return [];}
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const rings: ProjectedRing[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const projected = projectRing(ring, projection);
      if (projected.length > 1) {rings.push(projected);}
    }
  }
  return rings;
};

// Bounds pre-filter (expanded by the fallback radius); exact checks still decide.
const isOutsideBounds = (box: ChoroplethBounds, point: ScenePoint, pad: number): boolean => {
  if (box === undefined) {return false;}
  if (point.px < box[0][0] - pad) {return true;}
  if (point.px > box[1][0] + pad) {return true;}
  if (point.py < box[0][1] - pad) {return true;}
  return point.py > box[1][1] + pad;
};

const containsFeature = (feature: FocusableFeature, geoPoint: [number, number]): boolean => {
  try {
    return geoContains(feature, geoPoint);
  } catch {
    return false;
  }
};

// Topmost feature containing the scene point (legacy reverse-render order), if any.
const findContainingIndex = (
  features: readonly FocusableFeature[],
  bounds: readonly ChoroplethBounds[],
  projection: GeoProjection,
  point: ScenePoint,
): number => {
  const lonLat = projection.invert?.([point.px, point.py]);
  if (!lonLat || !Number.isFinite(lonLat[0]) || !Number.isFinite(lonLat[1])) {return -1;}
  const geoPoint: [number, number] = [lonLat[0], lonLat[1]];
  for (let index = features.length - 1; index >= 0; index -= 1) {
    const feature = features.at(index);
    if (feature !== undefined && !isOutsideBounds(bounds.at(index), point, 0) && containsFeature(feature, geoPoint)) {
      return index;
    }
  }
  return -1;
};

const pointToSegmentSq = (point: ScenePoint, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const ratio = lenSq > 0 ? Math.max(0, Math.min(1, ((point.px - ax) * dx + (point.py - ay) * dy) / lenSq)) : 0;
  const ox = point.px - (ax + ratio * dx);
  const oy = point.py - (ay + ratio * dy);
  return ox * ox + oy * oy;
};

// Squared distance from the scene point to a projected ring.
const ringDistSq = (ring: ProjectedRing, point: ScenePoint): number => {
  let best = Infinity;
  for (let seg = 0; seg + 1 < ring.length; seg += 1) {
    const start = ring.at(seg);
    const end = ring.at(seg + 1);
    if (start !== undefined && end !== undefined) {
      const distSq = pointToSegmentSq(point, start[0], start[1], end[0], end[1]);
      if (distSq < best) {best = distSq;}
    }
  }
  return best;
};

const nearestRingsSq = (rings: readonly ProjectedRing[], point: ScenePoint): number => {
  let best = Infinity;
  for (const ring of rings) {
    const distSq = ringDistSq(ring, point);
    if (distSq < best) {best = distSq;}
  }
  return best;
};

// Nearest polygon edge within the focus radius (reverse order wins ties), if any.
const findNearestEdgeIndex = (
  bounds: readonly ChoroplethBounds[],
  rings: readonly ProjectedRing[][],
  point: ScenePoint,
  limit: number,
): number => {
  const limitSq = limit * limit;
  let bestIndex = -1;
  let bestSq = Infinity;
  for (let index = rings.length - 1; index >= 0; index -= 1) {
    if (!isOutsideBounds(bounds.at(index), point, limit)) {
      const edgeSq = nearestRingsSq(rings.at(index) ?? [], point);
      if (edgeSq <= limitSq && (bestIndex < 0 || edgeSq < bestSq)) {
        bestIndex = index;
        bestSq = edgeSq;
      }
    }
  }
  return bestIndex;
};

// Points carry datumIndex = feature index (dist/geo.js); the strategy maps hits through it.
const pointForIndex = <TDatum>(
  points: readonly ChartPoint<TDatum, number, number>[],
  index: number,
): ChartPoint<TDatum, number, number> | null =>
  points.find((point) => point.datumIndex === index) ?? null;

// Package focus strategy: exact containment first, then nearest edge within maxDistance.
// Open ocean returns no focus. Consulted before any painted scene or spatial index.
const createChoroplethFocus = <TDatum extends FocusableFeature>(
  options: Readonly<ChoroplethFocusOptions<TDatum>>,
): ChartFocusStrategy<TDatum, number, number> => {
  const { features, projection } = options;
  const path = geoPath(projection);
  const bounds = features.map((feature): ChoroplethBounds => {
    try {
      return path.bounds(feature);
    } catch {
      return undefined;
    }
  });
  const rings = features.map((feature) => projectFeatureRings(feature, projection));
  const resolveIndex = (context: Readonly<ChartFocusResolveContext>): number => {
    const point: ScenePoint = { px: context.x, py: context.y };
    const contained = findContainingIndex(features, bounds, projection, point);
    if (contained >= 0) {return contained;}
    return findNearestEdgeIndex(bounds, rings, point, Math.max(0, context.maxDistance));
  };
  return {
    group(_points, context: Readonly<ChartFocusGroupContext<TDatum, number, number>>) {
      return [context.point];
    },
    navigation(points) {
      return points;
    },
    resolve(points, context) {
      const hit = pointForIndex(points, resolveIndex(context));
      return hit === null ? [] : [hit];
    },
  };
};

export { createChoroplethFocus };
export type { ChoroplethFocusOptions };
