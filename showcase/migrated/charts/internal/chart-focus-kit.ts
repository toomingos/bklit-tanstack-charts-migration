// Shared focus-strategy internals. Bar keys members by `group ?? markId`, scatter/candlestick by `markId`.
import type { ChartValue } from "@tanstack/charts";

interface ChartPointLike {
  readonly x: number;
  readonly y: number;
  readonly xValue: ChartValue;
}

// Bar rows key focus by row index (bklit band-index parity): duplicate labels must not collapse.
interface ChartPointIndexLike extends ChartPointLike {
  readonly datumIndex: number;
}

// Epsilon absorbing float noise when comparing scene-x distances for nearest-point ties.
const FOCUS_X_TIE_EPSILON = 1e-6;

// Primitive guards own the `typeof` checks (anti-slop allows them inside type predicates);
// Branch on these instead of narrowing representations inline.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";
const isString = <Value>(value: Value): value is Value & string => typeof value === "string";
const isBoolean = <Value>(value: Value): value is Value & boolean => typeof value === "boolean";

/**
 * Stable grouping key for a datum's domain value.
 *
 * Dates key as `date:<epoch-ms>` so distinct instants never collide; numbers, strings, and
 * booleans key as `<kind>:<String(value)>` so values of different runtime kinds stay distinct;
 * anything else (both group and mark id missing, exotic payloads) keys as `other:<String(value)>`.
 * Keys are only ever compared for equality, so the fallback tag just needs to stay out of the
 * other kinds' way.
 *
 * @param {unknown} value - Domain value to key, read from the point's `xValue` at call sites.
 * @returns {string} Key identifying the domain value for focus grouping.
 */
const focusValueKey = (value: unknown): string => {
  if (value instanceof Date) {return `date:${value.getTime()}`;}
  if (isNumber(value)) {return `number:${String(value)}`;}
  if (isString(value)) {return `string:${value}`;}
  if (isBoolean(value)) {return `boolean:${String(value)}`;}
  return `other:${String(value)}`;
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

interface CollectFocusGroupOptions<PointT> {
  readonly memberKeyOf: (point: PointT) => string | number;
  readonly points: readonly PointT[];
  readonly primary: PointT;
  readonly xKeyOf: (xValue: Readonly<ChartValue>) => string | number;
}

/**
 * Collects [primary, ...others] sharing the primary's x key, one per member key; others keep scan order (no y-sort).
 *
 * @param {Readonly<CollectFocusGroupOptions<PointT>>} groupOptions - Full point list, anchor point, and the two key mappers.
 * @returns {PointT[]} Primary followed by one representative per remaining member key in scan order.
 */
const collectFocusGroup = <PointT extends ChartPointLike>(groupOptions: Readonly<CollectFocusGroupOptions<PointT>>): PointT[] => {
  const { memberKeyOf, points, primary, xKeyOf } = groupOptions;
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

interface CollectFocusGroupByIndexOptions<PointT> {
  readonly memberKeyOf: (point: PointT) => string | number;
  readonly points: readonly PointT[];
  readonly primary: PointT;
}

/**
  * Collects [primary, ...others] sharing the primary's row index, one per member key; others keep scan order (no y-sort).
  *
  * @param {Readonly<CollectFocusGroupByIndexOptions<PointT>>} groupOptions - Full point list, anchor point, and the member key mapper.
  * @returns {PointT[]} Primary followed by one representative per remaining member key in scan order.
  */
const collectFocusGroupByIndex = <PointT extends ChartPointIndexLike>(groupOptions: Readonly<CollectFocusGroupByIndexOptions<PointT>>): PointT[] => {
  const { memberKeyOf, points, primary } = groupOptions;
  const unique = new Map<string | number, PointT>();
  unique.set(memberKeyOf(primary), primary);
  for (const cand of points) {
    if (cand.datumIndex === primary.datumIndex) {
      const mKey = memberKeyOf(cand);
      if (!unique.has(mKey)) {unique.set(mKey, cand);}
    }
  }
  const others: PointT[] = [];
  for (const point of unique.values()) {
    if (point !== primary) {others.push(point);}
  }
  return [primary, ...others];
}

/**
  * Row order for keyboard navigation: one representative per row index (first wins), ascending by index.
  *
  * @param {readonly PointT[]} points - Points to order for keyboard navigation.
  * @returns {PointT[]} One representative per row index in row order.
  */
const navigationOrderByIndex = <PointT extends ChartPointIndexLike>(points: readonly PointT[]): PointT[] => {
  const unique = new Map<number, PointT>();
  for (const point of points) {
    if (!unique.has(point.datumIndex)) {unique.set(point.datumIndex, point);}
  }
  return [...unique.values()].toSorted((pointA, pointB) => pointA.datumIndex - pointB.datumIndex);
}

export { focusValueKey, findNearestPointByX, collectFocusGroup, collectFocusGroupByIndex, navigationOrder, navigationOrderByIndex };
