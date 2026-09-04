// Bklit bisect tie-break (earlier point wins); members keep insertion order (no y-sort).

import type { ChartFocusStrategy, ChartPoint, ChartValue } from "@tanstack/charts";
import { collectFocusGroup, findNearestPointByX, navigationOrder } from "./chart-focus-kit";
import type { ChartDatum } from "./types";

interface CandlestickFocusStrategyArgs {
  readonly canInteractRef: { readonly current: boolean };
}

type CandlestickPoint = Readonly<ChartPoint<Readonly<ChartDatum>, Readonly<Date>, number>>;

const epochMs = (value: Readonly<ChartValue>): number => value instanceof Date ? value.getTime() : Number.NaN;

const byMarkId = (point: CandlestickPoint): string => point.markId;


export const createCandlestickFocusStrategy = (args: Readonly<CandlestickFocusStrategyArgs>): ChartFocusStrategy<ChartDatum, Date, number> => {
  const { canInteractRef } = args;
  return {
    group(
      points: readonly CandlestickPoint[],
      { point }: { readonly point: CandlestickPoint },
    ): readonly CandlestickPoint[] {
      if (points.length === 0) {return [point];}
      return collectFocusGroup(points, point, epochMs, byMarkId);
    },

    navigation(
      points: readonly CandlestickPoint[],
    ): readonly CandlestickPoint[] {
      return navigationOrder(points, epochMs);
    },

    resolve(
      points: readonly CandlestickPoint[],
      { x, maxDistance }: { readonly x: number; readonly maxDistance: number },
    ): readonly CandlestickPoint[] {
      if (!canInteractRef.current) {return [];}
      if (points.length === 0) {return [];}
      const nearest = findNearestPointByX(points, x, maxDistance);
      if (!nearest) {return [];}
      return collectFocusGroup(points, nearest, epochMs, byMarkId);
    },
  };
}

export type { CandlestickFocusStrategyArgs };
