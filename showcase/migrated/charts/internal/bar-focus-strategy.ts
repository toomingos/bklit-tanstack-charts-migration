import type { ChartFocusStrategy, ChartPoint, ChartValue } from "@tanstack/charts";
import { isChartInteractionPhase } from "./chart-phase";
import { collectFocusGroup, focusValueKey, navigationOrder } from "./chart-focus-kit";
import type { ChartDatum, ChartPhase } from "./types";

// Hoisted once, so hover events allocate no closures.
const byXKey = (xValue: Readonly<ChartValue>): string => focusValueKey(xValue);

const byMemberKey = (point: { readonly group: unknown; readonly markId: unknown }): string => focusValueKey((point.group ?? point.markId));

/** Picks the phase ref out of the overload union (both object shapes carrying one expose `phaseRef`). */
type PhaseRefOrArgs = { readonly current: ChartPhase } | BarFocusStrategyArgs | { readonly phaseRef: { readonly current: ChartPhase } };

// Overload-discriminator guard: only the full-args call shape carries a callable getter.
const isFullBarFocusArgs = (value: PhaseRefOrArgs): value is BarFocusStrategyArgs =>
  "getCategoryOrder" in value && typeof value.getCategoryOrder === "function";

const isNearerY = <PointT extends { readonly y: number }>(candidate: PointT | undefined, bestY: number, y: number): candidate is PointT =>
  candidate !== undefined && Math.abs(candidate.y - y) < bestY;

interface NearestRowSearchParams<PointT> {
  readonly rows: readonly PointT[];
  readonly y: number;
  readonly primary: PointT;
  readonly bestY: number;
}

const searchNearestRow = <PointT extends { readonly y: number }>({ rows, y, primary, bestY }: NearestRowSearchParams<PointT>): PointT => {
  let current = primary;
  let currentBest = bestY;
  for (let i = 1; i < rows.length; i += 1) {
    const candidate = rows.at(i);
    if (isNearerY(candidate, currentBest, y)) {
      current = candidate;
      currentBest = Math.abs(candidate.y - y);
    }
  }
  return current;
}

const nearestByY = <PointT extends { readonly y: number }>(
  rows: readonly PointT[],
  y: number,
): PointT | undefined => {
  const first = rows.at(0);
  if (first === undefined) {return first;}
  return searchNearestRow({ bestY: Math.abs(first.y - y), primary: first, rows, y });
};


/** Band-category focus: nearest column by scene-x, one point per member sharing the column. */
interface BarFocusStrategyArgs {
  readonly phaseRef: { readonly current: ChartPhase };
  readonly getCategoryOrder: () => readonly string[];
  readonly getInnerWidth: () => number;
  readonly marginLeft: number;
}

/** Picks the phase ref out of the overload union (both object shapes carrying one expose `phaseRef`). */
const resolvePhaseRef = (
  phaseRefOrArgs: PhaseRefOrArgs,
): { readonly current: ChartPhase } => {
  if ("phaseRef" in phaseRefOrArgs) {return phaseRefOrArgs.phaseRef;}
  return phaseRefOrArgs;
};

interface BandFocusParams<PointT> {
  readonly points: readonly PointT[];
  readonly x: number;
  readonly y: number;
  readonly getCategoryOrder: () => readonly string[];
  readonly getInnerWidth: () => number;
  readonly marginLeft: number;
}

interface ColumnIndexParams {
  readonly x: number;
  readonly marginLeft: number;
  readonly innerWidth: number;
  readonly catCount: number;
}

const columnIndexForX = ({ x, marginLeft, innerWidth, catCount }: ColumnIndexParams): number => {
  const colWidth = innerWidth / catCount;
  const pos = x - marginLeft;
  const idx = Math.floor(pos / colWidth);
  return Math.max(0, Math.min(catCount - 1, idx));
}

const readBandColumnGeometry = (getCategoryOrder: () => readonly string[], getInnerWidth: () => number): { categoryOrder: readonly string[]; innerWidth: number } | undefined => {
  const categoryOrder = getCategoryOrder();
  if (categoryOrder.length === 0) {return undefined;}
  const innerWidth = getInnerWidth();
  if (innerWidth <= 0) {return undefined;}
  return { categoryOrder, innerWidth };
}

const filterByColumnKey = <PointT extends ChartPoint<ChartDatum, string, number>>(points: readonly PointT[], targetLabel: string): readonly PointT[] => {
  const targetKey = focusValueKey(targetLabel);
  return points.filter((point) => focusValueKey(point.xValue) === targetKey);
}

const findBandColumnPrimary = <PointT extends ChartPoint<ChartDatum, string, number>>(params: BandFocusParams<PointT>): PointT | undefined => {
  const geometry = readBandColumnGeometry(params.getCategoryOrder, params.getInnerWidth);
  if (!geometry) {return undefined;}
  const idx = columnIndexForX({ catCount: geometry.categoryOrder.length, innerWidth: geometry.innerWidth, marginLeft: params.marginLeft, x: params.x });
  const targetLabel = geometry.categoryOrder.at(idx);
  if (targetLabel === undefined) {return undefined;}
  return nearestByY(filterByColumnKey(params.points, targetLabel), params.y);
}

const resolveBandColumnFocus = <PointT extends ChartPoint<ChartDatum, string, number>>(params: BandFocusParams<PointT>): readonly PointT[] => {
  const primary = findBandColumnPrimary(params);
  if (!primary) {return [];}
  return collectFocusGroup(params.points, primary, byXKey, byMemberKey);
}

interface CategoryCentroid<PointT> {
  sum: number;
  count: number;
  representative: PointT;
}

const buildCategoryCentroids = <PointT extends ChartPoint<ChartDatum, string, number>>(points: readonly PointT[]): Map<string, CategoryCentroid<PointT>> => {
  const byCategory = new Map<string, CategoryCentroid<PointT>>();
  for (const point of points) {
    const catKey = byXKey(point.xValue);
    const entry = byCategory.get(catKey);
    if (entry) {
      entry.sum += point.x;
      entry.count += 1;
    } else {
      byCategory.set(catKey, { count: 1, representative: point, sum: point.x });
    }
  }
  return byCategory;
}

const findNearestCategory = <PointT extends ChartPoint<ChartDatum, string, number>>(byCategory: ReadonlyMap<string, CategoryCentroid<PointT>>, x: number, maxDistance: number): PointT | undefined => {
  // Strict `<`: ties keep the earlier-scanned category (bklit bisect tie-break).
  let nearest: PointT | undefined = undefined;
  let distance = maxDistance;
  for (const entry of byCategory.values()) {
    const dist = Math.abs(entry.sum / entry.count - x);
    if (dist < distance) {
      nearest = entry.representative;
      distance = dist;
    }
  }
  return nearest;
}

const claimGroupKey = (seen: Set<string>, groupKey: string): boolean => {
  if (seen.has(groupKey)) {return false;}
  seen.add(groupKey);
  return true;
}

const collectCategoryCandidates = <PointT extends ChartPoint<ChartDatum, string, number>>(points: readonly PointT[], key: string): PointT[] => {
  const seen = new Set<string>();
  const candidates: PointT[] = [];
  for (const candPoint of points) {
    if (focusValueKey(candPoint.xValue) === key) {
      const groupKey = focusValueKey((candPoint.group ?? candPoint.markId));
      if (claimGroupKey(seen, groupKey)) {candidates.push(candPoint);}
    }
  }
  return candidates;
}

interface CategoryFocusParams<PointT> {
  readonly points: readonly PointT[];
  readonly x: number;
  readonly y: number;
  readonly maxDistance: number;
}

const resolveNearestCategoryFocus = <PointT extends ChartPoint<ChartDatum, string, number>>(params: CategoryFocusParams<PointT>): readonly PointT[] => {
  const byCategory = buildCategoryCentroids(params.points);
  const nearest = findNearestCategory(byCategory, params.x, params.maxDistance);
  if (!nearest) {return [];}
  const key = focusValueKey(nearest.xValue);
  const candidates = collectCategoryCandidates(params.points, key);
  const primary = nearestByY(candidates, params.y);
  if (!primary) {return [];}
  return collectFocusGroup(params.points, primary, byXKey, byMemberKey);
}

const createBarFocusStrategy = (phaseRefOrArgs: PhaseRefOrArgs): ChartFocusStrategy<ChartDatum, string, number> => {
  // Discriminate the overload union with `in` plus a function check.
  // Only the full-args member carries a callable getCategoryOrder, so no
  // Casting is needed to separate the legacy phaseRef-only call shape.
  const fullArgs: BarFocusStrategyArgs | undefined = isFullBarFocusArgs(phaseRefOrArgs)
    ? phaseRefOrArgs
    : undefined;
  const phaseRef: { readonly current: ChartPhase } = resolvePhaseRef(phaseRefOrArgs);
  const getCategoryOrder = fullArgs?.getCategoryOrder;
  const getInnerWidth = fullArgs?.getInnerWidth;
  const marginLeft = fullArgs?.marginLeft ?? 0;
  return {
    group<PointT extends ChartPoint<ChartDatum, string, number>>(
      points: readonly PointT[],
      { point }: { readonly point: PointT },
    ): readonly PointT[] {
      if (points.length === 0) {return [point];}
      return collectFocusGroup(points, point, byXKey, byMemberKey);
    },

    navigation<PointT extends ChartPoint<ChartDatum, string, number>>(
      points: readonly PointT[],
    ): readonly PointT[] {
      return navigationOrder(points, byXKey);
    },

    resolve<PointT extends ChartPoint<ChartDatum, string, number>>(
      points: readonly PointT[],
      { x, y, maxDistance }: { readonly x: number; readonly y: number; readonly maxDistance: number },
    ): readonly PointT[] {
      if (!isChartInteractionPhase((phaseRef).current)) {return [];}
      if (points.length === 0) {return [];}

      // Floor(pos/columnWidth) band division, matching bklit (ignores band padding).
      if (getCategoryOrder && getInnerWidth) {
        return resolveBandColumnFocus({ getCategoryOrder, getInnerWidth, marginLeft, points, x, y });
      }

      // Fallback when call-site omits getters.
      return resolveNearestCategoryFocus({ maxDistance, points, x, y });
    },
  };
}

export { createBarFocusStrategy };
export type { BarFocusStrategyArgs };
