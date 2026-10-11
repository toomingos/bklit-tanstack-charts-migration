import { useMemo } from "react";
import { generateChartSkeletonData, generateChartSkeletonFromTarget } from "../loading/skeleton-data";
import type { ResolvedSeries, Row } from "./series";

/** bklit time-series-chart-shell.tsx:228-234: while loading the first series is replaced by skeleton rows (the others keep their data, so the y domain spans them all). */
export function useSkeletonData(chartLoading: boolean, targetData: readonly Row[], series: readonly ResolvedSeries[]): readonly Row[] {
  const skeletonKey = series.find((s) => s.kind !== "pattern")?.dataKey;
  return useMemo(() => {
    if (!chartLoading) {
      return targetData;
    }
    return targetData.length === 0 ? generateChartSkeletonData({ dataKey: skeletonKey }) : generateChartSkeletonFromTarget(targetData, skeletonKey ?? "value");
  }, [chartLoading, targetData, skeletonKey]);
}
