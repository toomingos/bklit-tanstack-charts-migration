// TanStack-native focus strategy for CandlestickChart.
// Reproduces bklit's bisectDateLeft + resolveNearestIndex strict `>` tie-break
// (earlier point wins on equal distance) but expressed over TanStack
// ChartPoint.xValue epoch ms. Gates on canInteractRef (plain boolean, mirrors
// bklit ChartProvider ready check) → [] when not ready.
//
// resolve: nearest xValue by scene-x distance (Math.abs(p.x - x) with
// `>=` guard gives strict `>` tie-break). group: mirrored wick+body points
// sharing same xValue epoch. navigation: unique dates sorted by x→y.

import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import type { ChartDatum } from "./types";

export type CandlestickFocusStrategyArgs = {
  canInteractRef: { current: boolean };
};

function epochMs(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number.NaN;
}

export function createCandlestickFocusStrategy(
  args: CandlestickFocusStrategyArgs,
): ChartFocusStrategy<ChartDatum, Date, number> {
  const { canInteractRef } = args;
  return {
    resolve(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      x: number,
      _y: number,
      maxDistance: number,
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (canInteractRef.current !== true) return [];
      if (points.length === 0) return [];
      let nearest: ChartPoint<ChartDatum, Date, number> | undefined;
      let distance = maxDistance;
      for (const p of points) {
        const d = Math.abs(p.x - x);
        if (d >= distance) continue;
        nearest = p;
        distance = d;
      }
      if (!nearest) return [];
      const key = epochMs(nearest.xValue);
      // Collect mirrored wick+body points sharing same date (unique dates per
      // plan, so grouping is 1:1 per candle; dedupe by markId).
      const unique = new Map<string, ChartPoint<ChartDatum, Date, number>>();
      unique.set(nearest.markId, nearest);
      for (const cand of points) {
        if (epochMs(cand.xValue) !== key) continue;
        if (!unique.has(cand.markId)) unique.set(cand.markId, cand);
      }
      return [...unique.values()];
    },

    group(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      point: ChartPoint<ChartDatum, Date, number>,
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (points.length === 0) return [point];
      const key = epochMs(point.xValue);
      const unique = new Map<string, ChartPoint<ChartDatum, Date, number>>();
      unique.set(point.markId, point);
      for (const cand of points) {
        if (epochMs(cand.xValue) !== key) continue;
        if (!unique.has(cand.markId)) unique.set(cand.markId, cand);
      }
      return [...unique.values()];
    },

    navigation(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
      const unique = new Map<number, ChartPoint<ChartDatum, Date, number>>();
      for (const p of sorted) {
        const k = epochMs(p.xValue);
        if (!unique.has(k)) unique.set(k, p);
      }
      return [...unique.values()];
    },
  };
}
