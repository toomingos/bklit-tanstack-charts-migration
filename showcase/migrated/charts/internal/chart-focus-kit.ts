// Shared focus-strategy internals. Bar keys members by `group ?? markId`, scatter/candlestick by `markId`.
import type { ChartValue } from "@tanstack/charts";

interface ChartPointLike {
  readonly x: number;
  readonly y: number;
  readonly xValue: ChartValue;
}

// Epsilon absorbing float noise when comparing scene-x distances for nearest-point ties.
const FOCUS_X_TIE_EPSILON = 1e-6;

/**
 * Stable grouping key for a datum's domain value.
 *
 * Dates key as `date:<epoch-ms>` so distinct instants never collide; anything else keys as
 * `<typeof>:<String(value)>` so values of different runtime types stay distinct.
 *
 * @param {unknown} value - Domain value to key, read from the point's `xValue` at call sites.
 * @returns {string} Key identifying the domain value for focus grouping.
 */
const focusValueKey = (value: unknown): string => {
  if (value instanceof Date) {return `date:${value.getTime()}`;}
  return `${typeof value}:${String(value)}`;
}

/**
 * Nearest point to scene-x `x`; ties (within a 1e-6 epsilon, to absorb float noise) keep the earlier-scanned point.
 *
 * @param {readonly PointT[]} points - Candidate points in scan order; ties keep the earlier entry.
 * @param {number} x - Query position in scene-x pixels.
 * @param {number} maxDistance - Rejection radius in scene-x pixels; nothing outside it can be returned.
 * @returns {PointT | undefined} Closest point strictly inside the radius, or `undefined` when none qualifies.
 */
const findNearestPointByX = <PointT extends ChartPointLike>(points: readonly PointT[], x: number, maxDistance: number): PointT | undefined => {
  let nearest: PointT | undefined = undefined;
  let distance = maxDistance;
  for (const point of points) {
    const dist = Math.abs(point.x - x);
    if (dist < distance - FOCUS_X_TIE_EPSILON) {
      nearest = point;
      distance = dist;
    }
  }
  return nearest;
}

interface FocusGroupMembersParams<PointT> {
  readonly key: string | number;
  readonly memberKeyOf: (point: PointT) => string | number;
  readonly points: readonly PointT[];
  readonly primary: PointT;
  readonly xKeyOf: (xValue: Readonly<ChartValue>) => string | number;
}

// Index every point sharing the primary's x key by member key.
// First wins, so the primary seeds its own slot and later duplicates drop.
const collectGroupMembers = <PointT extends ChartPointLike>(params: Readonly<FocusGroupMembersParams<PointT>>): Map<string | number, PointT> => {
  const { key, memberKeyOf, points, primary, xKeyOf } = params;
  const unique = new Map<string | number, PointT>();
  unique.set(memberKeyOf(primary), primary);
  for (const cand of points) {
    if (xKeyOf(cand.xValue) === key) {
      const mKey = memberKeyOf(cand);
      if (!unique.has(mKey)) {unique.set(mKey, cand);}
    }
  }
  return unique;
}

/**
 * Collects [primary, ...others] sharing the primary's x key, one per member key; others keep scan order (no y-sort).
 *
 * @param {readonly PointT[]} points - Full point list scanned for members sharing the primary's x key.
 * @param {PointT} primary - Anchor point seeding its own member slot and heading the result.
 * @param {(xValue: Readonly<ChartValue>) => string | number} xKeyOf - Maps a datum's domain value to its group key.
 * @param {(point: PointT) => string | number} memberKeyOf - Maps a point to its within-group member key; first point per key wins.
 * @returns {PointT[]} Primary followed by one representative per remaining member key in scan order.
 */
const collectFocusGroup = <PointT extends ChartPointLike>(points: readonly PointT[], primary: PointT, xKeyOf: (xValue: Readonly<ChartValue>) => string | number, memberKeyOf: (point: PointT) => string | number): PointT[] => {
  const unique = collectGroupMembers({ key: xKeyOf(primary.xValue), memberKeyOf, points, primary, xKeyOf });
  const others: PointT[] = [];
  for (const point of unique.values()) {
    if (point !== primary) {others.push(point);}
  }
  return [primary, ...others];
}

/**
 * All points sorted by scene-x then y, deduped to one representative per x key (first wins).
 *
 * @param {readonly PointT[]} points - Points to order for keyboard navigation.
 * @param {(xValue: Readonly<ChartValue>) => string | number} xKeyOf - Maps a datum's domain value to its dedupe key.
 * @returns {PointT[]} One representative per x key in navigation order.
 */
const navigationOrder = <PointT extends ChartPointLike>(points: readonly PointT[], xKeyOf: (xValue: Readonly<ChartValue>) => string | number): PointT[] => {
  const sorted = points.toSorted((pointA, pointB) => pointA.x - pointB.x || pointA.y - pointB.y);
  const unique = new Map<string | number, PointT>();
  for (const point of sorted) {
    const xKey = xKeyOf(point.xValue);
    if (!unique.has(xKey)) {unique.set(xKey, point);}
  }
  return [...unique.values()];
}

export { focusValueKey, findNearestPointByX, collectFocusGroup, navigationOrder };
