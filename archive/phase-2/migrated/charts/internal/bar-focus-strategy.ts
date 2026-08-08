import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import type { ChartDatum, ChartPhase } from "./types";

function valueKey(value: unknown): string {
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

function collectPerGroup(
  points: readonly ChartPoint<ChartDatum, string, number>[],
  primary: ChartPoint<ChartDatum, string, number>,
): readonly ChartPoint<ChartDatum, string, number>[] {
  const key = valueKey(primary.xValue);
  const unique = new Map<string, ChartPoint<ChartDatum, string, number>>();
  unique.set(valueKey((primary.group ?? primary.markId) as unknown), primary);
  for (const cand of points) {
    if (valueKey((cand as ChartPoint<ChartDatum, string, number>).xValue) !== key) continue;
    const g = valueKey((cand.group ?? cand.markId) as unknown);
    if (!unique.has(g)) unique.set(g, cand as ChartPoint<ChartDatum, string, number>);
  }
  const others = [...unique.values()]
    .filter((p) => p !== primary)
    .sort((a, b) => a.y - b.y);
  return [primary, ...others];
}

/**
 * Band-category focus strategy for vertical grouped BarChart.
 * - resolve: nearest category by scene-x (band center = mean of points' x per xValue), stable tie-break via `>=`.
 * - group: one point per `group` (z) sharing same xValue, sorted by y (mirrors TanStack `focusX` grouped).
 * - navigation: unique xValues sorted by x→y, one representative per xValue.
 * Gated by `phaseRef.current !== "ready"` (canInteract) → [].
 */
export type BarFocusStrategyArgs = {
  phaseRef: { current: ChartPhase };
  getCategoryOrder: () => readonly string[];
  getInnerWidth: () => number;
  marginLeft: number;
};

export function createBarFocusStrategy(
  phaseRefOrArgs: { current: ChartPhase } | BarFocusStrategyArgs | { phaseRef: { current: ChartPhase } },
): ChartFocusStrategy<ChartDatum, string, number> {
  const maybeArgs = phaseRefOrArgs as BarFocusStrategyArgs;
  const hasGetters = typeof maybeArgs.getCategoryOrder === "function";
  const phaseRef: { current: ChartPhase } = hasGetters
    ? maybeArgs.phaseRef
    : ((phaseRefOrArgs as { phaseRef?: { current: ChartPhase } }).phaseRef ??
        (phaseRefOrArgs as { current: ChartPhase }));
  const getCategoryOrder = hasGetters ? maybeArgs.getCategoryOrder : undefined;
  const getInnerWidth = hasGetters ? maybeArgs.getInnerWidth : undefined;
  const marginLeft = hasGetters ? maybeArgs.marginLeft : 0;
  return {
    resolve(
      points: readonly ChartPoint<ChartDatum, string, number>[],
      x: number,
      y: number,
      maxDistance: number,
    ): readonly ChartPoint<ChartDatum, string, number>[] {
      if ((phaseRef as { current: ChartPhase }).current !== "ready") return [];
      if (points.length === 0) return [];

      // When wired with bklit-parity getters, replicate bklit's exact
      // Math.floor((x-margin.left)/columnWidth) band-index division
      // (bar-chart.tsx handlePointerMove). This preserves the 0% QA gate
      // (columnWidth intentionally ignores band padding, per audit §4 row 2)
      // rather than switching to nearest band-center distance.
      if (getCategoryOrder && getInnerWidth) {
        const categoryOrder = getCategoryOrder();
        const n = categoryOrder.length;
        if (n === 0) return [];
        const innerWidth = getInnerWidth();
        if (innerWidth <= 0) return [];
        const colWidth = innerWidth / n;
        const pos = x - marginLeft;
        let idx = Math.floor(pos / colWidth);
        idx = Math.max(0, Math.min(n - 1, idx));
        const targetLabel = categoryOrder[idx]!;
        const targetKey = valueKey(targetLabel);
        const matching = points.filter((p) => valueKey(p.xValue) === targetKey);
        if (matching.length === 0) return [];
        let primary = matching[0]!;
        let bestY = Math.abs(primary.y - y);
        for (let i = 1; i < matching.length; i++) {
          const c = matching[i]!;
          const d = Math.abs(c.y - y);
          if (d < bestY) {
            bestY = d;
            primary = c;
          }
        }
        return collectPerGroup(points, primary);
      }

      // Fallback: nearest band-center (used only if call-site omits getters).
      const byCategory = new Map<
        string,
        { anchorX: number; sum: number; count: number; representative: ChartPoint<ChartDatum, string, number> }
      >();
      for (const p of points) {
        const k = valueKey(p.xValue);
        let entry = byCategory.get(k);
        if (!entry) {
          entry = { anchorX: 0, sum: p.x, count: 1, representative: p };
          byCategory.set(k, entry);
        } else {
          entry.sum += p.x;
          entry.count += 1;
        }
      }
      for (const entry of byCategory.values()) entry.anchorX = entry.sum / entry.count;

      let nearest: ChartPoint<ChartDatum, string, number> | undefined;
      let distance = maxDistance;
      for (const entry of byCategory.values()) {
        const d = Math.abs(entry.anchorX - x);
        if (d >= distance) continue;
        nearest = entry.representative;
        distance = d;
      }
      if (!nearest) return [];

      // Collect one per group sharing same xValue.
      const key = valueKey(nearest.xValue);
      const unique = new Map<string, ChartPoint<ChartDatum, string, number>>();
      for (const cand of points) {
        if (valueKey(cand.xValue) !== key) continue;
        const g = valueKey((cand.group ?? cand.markId) as unknown);
        if (!unique.has(g)) unique.set(g, cand);
      }
      if (unique.size === 0) return [];
      const candidates = [...unique.values()];
      // Primary = closest in y to pointer among the category's points (mirrors focusX secondary).
      let primary = candidates[0]!;
      let bestY = Math.abs(primary.y - y);
      for (let i = 1; i < candidates.length; i++) {
        const c = candidates[i]!;
        const d = Math.abs(c.y - y);
        if (d < bestY) {
          bestY = d;
          primary = c;
        }
      }
      return collectPerGroup(points, primary);
    },

    group(
      points: readonly ChartPoint<ChartDatum, string, number>[],
      point: ChartPoint<ChartDatum, string, number>,
    ): readonly ChartPoint<ChartDatum, string, number>[] {
      if (points.length === 0) return [point];
      return collectPerGroup(points, point);
    },

    navigation(
      points: readonly ChartPoint<ChartDatum, string, number>[],
    ): readonly ChartPoint<ChartDatum, string, number>[] {
      const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
      const unique = new Map<string, ChartPoint<ChartDatum, string, number>>();
      for (const p of sorted) {
        const k = valueKey(p.xValue);
        if (!unique.has(k)) unique.set(k, p);
      }
      return [...unique.values()];
    },
  };
}
