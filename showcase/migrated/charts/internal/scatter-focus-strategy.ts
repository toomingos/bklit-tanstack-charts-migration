import type { ChartFocusStrategy, ChartPoint, ChartValue } from "@tanstack/charts";
import { isChartInteractionPhase } from "./chart-phase";
import { collectFocusGroup, findNearestPointByX, focusValueKey, navigationOrder } from "./chart-focus-kit";
import type { ChartDatum, ChartPhase } from "./types";

const byXKey = (xValue: Readonly<ChartValue>): string => focusValueKey(xValue);

const byMarkId = (point: ChartPoint<ChartDatum, Date, number>): string => point.markId;


// Tie-break matches legacy: the earlier point wins at equal distance.
export const createScatterFocusStrategy = (phaseRef: { readonly current: ChartPhase }): ChartFocusStrategy<ChartDatum, Date, number> => (
  {
    group(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { point },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (points.length === 0) {return [point];}
      return collectFocusGroup(points, point, byXKey, byMarkId);
    },

    navigation(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      return navigationOrder(points, byXKey);
    },

    resolve(
      points: readonly ChartPoint<ChartDatum, Date, number>[],
      { x: focusX, maxDistance },
    ): readonly ChartPoint<ChartDatum, Date, number>[] {
      if (!isChartInteractionPhase(phaseRef.current)) {return [];}
      if (points.length === 0) {return [];}
      const nearest = findNearestPointByX(points, focusX, maxDistance);
      if (!nearest) {return [];}
      return collectFocusGroup(points, nearest, byXKey, byMarkId);
    },
  }
);
