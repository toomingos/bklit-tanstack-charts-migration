import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import { isChartInteractionPhase } from "./chart-phase";
import { collectFocusGroup, focusValueKey, navigationOrder } from "./chart-focus-kit";
import type { ChartDatum, ChartPhase } from "./types";

// Module-level keyers: hoisted once, so hover events allocate no closures.
function byXKey(xValue: unknown): string {
  return focusValueKey(xValue);
}
function byMemberKey(p: ChartPoint<ChartDatum, string, number>): string {
  return focusValueKey((p.group ?? p.markId) as unknown);
}

/**
 * Band-category focus strategy for vertical grouped BarChart.
 * - resolve: nearest category by scene-x (band center = mean of points' x per xValue), stable tie-break via `>=`.
 * - group: one point per `group` (z) sharing same xValue, in series-declaration
 *   order (bklit tooltip parity — bklit emits rows by iterating `lines`, no y-sort).
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
      { x, y, maxDistance },
    ): readonly ChartPoint<ChartDatum, string, number>[] {
      if (!isChartInteractionPhase((phaseRef as { current: ChartPhase }).current)) return [];
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
        const targetKey = focusValueKey(targetLabel);
        const matching = points.filter((p) => focusValueKey(p.xValue) === targetKey);
        if (matching.length === 0) return [];
        // Primary = closest in y to pointer among the category's points
        // (mirrors focusX secondary).
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
        return collectFocusGroup(points, primary, byXKey, byMemberKey, false);
      }

      // Fallback: nearest band-center (used only if call-site omits getters).
      const byCategory = new Map<
        string,
        { sum: number; count: number; representative: ChartPoint<ChartDatum, string, number> }
      >();
      for (const p of points) {
        const k = byXKey(p.xValue);
        let entry = byCategory.get(k);
        if (!entry) {
          entry = { sum: p.x, count: 1, representative: p };
          byCategory.set(k, entry);
        } else {
          entry.sum += p.x;
          entry.count += 1;
        }
      }

      // Nearest band center, strict `<`: ties keep the earlier-scanned
      // category, mirroring bklit's bisect tie-break toward earlier points.
      let nearest: ChartPoint<ChartDatum, string, number> | undefined;
      let distance = maxDistance;
      for (const entry of byCategory.values()) {
        const d = Math.abs(entry.sum / entry.count - x);
        if (d >= distance) continue;
        nearest = entry.representative;
        distance = d;
      }
      if (!nearest) return [];

      // Collect one per group sharing same xValue, then take the point
      // closest in y to the pointer as primary (mirrors focusX secondary).
      const key = focusValueKey(nearest.xValue);
      const seen = new Set<string>();
      const candidates: ChartPoint<ChartDatum, string, number>[] = [];
      for (const cand of points) {
        if (focusValueKey(cand.xValue) !== key) continue;
        const g = focusValueKey((cand.group ?? cand.markId) as unknown);
        if (seen.has(g)) continue;
        seen.add(g);
        candidates.push(cand);
      }
      if (candidates.length === 0) return [];
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
      return collectFocusGroup(points, primary, byXKey, byMemberKey, false);
    },

    group(
      points: readonly ChartPoint<ChartDatum, string, number>[],
      { point },
    ): readonly ChartPoint<ChartDatum, string, number>[] {
      if (points.length === 0) return [point];
      return collectFocusGroup(points, point, byXKey, byMemberKey, false);
    },

    navigation(
      points: readonly ChartPoint<ChartDatum, string, number>[],
    ): readonly ChartPoint<ChartDatum, string, number>[] {
      return navigationOrder(points, byXKey);
    },
  };
}
