// TanStack-native focus strategy for CandlestickChart.
// Reproduces bklit's bisectDateLeft + resolveNearestIndex strict `>` tie-break
// (earlier point wins on equal distance) but expressed over TanStack
// ChartPoint.xValue epoch ms. Gates on canInteractRef (plain boolean, mirrors
// bklit ChartProvider ready check) → [] when not ready.
//
// resolve: nearest xValue by scene-x distance (strict `<` tie-break).
// group: mirrored wick+body points sharing same xValue epoch.
// navigation: unique dates sorted by x→y.
//
// DELIBERATE DIVERGENCE from bar/scatter: group members are NOT re-sorted by
// y — Map insertion order is preserved. bklit's own interaction layer
// (repos/bklit-ui/packages/ui/src/charts/use-chart-interaction.ts,
// resolveTooltipFromX, lines 78-115) returns a SINGLE tooltip point plus a
// `yPositions` record and has no grouped-point ordering to inherit; no
// `a.y - b.y` sort exists anywhere in bklit's chart sources. Bar/scatter's
// y-sort mirrors TanStack focusX grouped, not bklit.

import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import { collectFocusGroup, findNearestPointByX, navigationOrder } from "./chart-focus-kit";
import type { ChartDatum } from "./types";

export type CandlestickFocusStrategyArgs = {
  canInteractRef: { current: boolean };
};

function epochMs(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number.NaN;
}
function byMarkId(p: ChartPoint<ChartDatum, Date, number>): string {
  return p.markId;
}

export function createCandlestickFocusStrategy(
  args: CandlestickFocusStrategyArgs,
): ChartFocusStrategy<ChartDatum, Date, number> {
  const { canInteractRef } = args;
  return {
    resolve(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { x, maxDistance },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (canInteractRef.current !== true) return [];
      if (points.length === 0) return [];
      const nearest = findNearestPointByX(points, x, maxDistance);
      if (!nearest) return [];
      // Collect mirrored wick+body points sharing same date (unique dates per
      // plan, so grouping is 1:1 per candle; dedupe by markId). Insertion
      // order preserved (see header divergence note).
      return collectFocusGroup(points, nearest, epochMs, byMarkId, false);
    },

    group(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { point },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (points.length === 0) return [point];
      return collectFocusGroup(points, point, epochMs, byMarkId, false);
    },

    navigation(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      return navigationOrder(points, epochMs);
    },
  };
}
