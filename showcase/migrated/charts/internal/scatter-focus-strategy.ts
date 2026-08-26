import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import { isChartInteractionPhase } from "./chart-phase";
import { collectFocusGroup, findNearestPointByX, focusValueKey, navigationOrder } from "./chart-focus-kit";
import type { ChartDatum, ChartPhase } from "./types";

// Module-level keyers: hoisted once, so hover events allocate no closures.
function byXKey(xValue: unknown): string {
  return focusValueKey(xValue);
}
function byMarkId(p: ChartPoint<ChartDatum, Date, number>): string {
  return p.markId;
}

/**
 * Custom ChartFocusStrategy that reproduces bklit's bisectDateLeft +
 * resolveNearestIndex semantics (strict `>` tie-break toward earlier point)
 * but expressed over ChartPoints.
 *
 * - resolve: finds the nearest xValue by scene-x distance to `x`, using
 *   the same strict `>=` tie-break that the bisector used (earlier point
 *   wins on equal distance). Returns all points sharing that xValue, one
 *   per markId (mirrors scatter-chart.tsx:485-497 per-series mapping).
 * - group: collects per-series points sharing the resolved xValue (one per
 *   markId), in series-declaration order (bklit parity — bklit emits tooltip
 *   rows by iterating `lines`, no y-sort; TanStack's focusX grouped sorts,
 *   which is ceiling-reference behavior, not parity).
 * - navigation: unique xValues sorted by x→y, one representative per xValue.
 *
 * The strategy respects bklit's canInteract gate: when phaseRef.current !==
 * "ready" it returns [] so the hover chrome hides.
 */
export function createScatterFocusStrategy(
  phaseRef: { current: ChartPhase },
): ChartFocusStrategy<ChartDatum, Date, number> {
  return {
    resolve(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { x, maxDistance },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (!isChartInteractionPhase(phaseRef.current)) return [];
      if (points.length === 0) return [];
      const nearest = findNearestPointByX(points, x, maxDistance);
      if (!nearest) return [];
      return collectFocusGroup(points, nearest, byXKey, byMarkId, false);
    },

    group(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { point },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (points.length === 0) return [point];
      return collectFocusGroup(points, point, byXKey, byMarkId, false);
    },

    navigation(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      return navigationOrder(points, byXKey);
    },
  };
}
