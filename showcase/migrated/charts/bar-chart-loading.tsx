"use client";

// Turnkey loading placeholder: <BarPulse> sweeping over skeleton bars (BarChart has no status prop).
import * as React from "react";
import { BarChart } from "./bar-chart";
import { Bar, BarPulse, Grid } from "./children";
import {
  buildLoadingSkeletonSeries,
  loadingSkeletonBarHeights,
} from "./internal/loading-chrome";
import type { ChartMargin } from "./internal";

const LOADING_DATA_KEY = "value";
const FALLBACK_LOADING_BARS = 12;
/** Bklit's 0.45 alpha is folded into the fill: no fill-opacity seam on BarConfig. */
const DEFAULT_LOADING_BAR_FILL =
  "color-mix(in oklch, var(--foreground) 45%, transparent)";
/** Complement of bklit's default bar fraction (0.7): each bar occupies 70% of its band. */
const LOADING_BAR_GAP = 0.3;
/** Passed explicitly — `<Bar>`'s default bandwidth-derived rounding is much heavier at this bar width than legacy's rx=2. */
const LOADING_BAR_CORNER_RADIUS = 2;

interface BarChartLoadingProps {
  readonly margin?: Partial<Readonly<ChartMargin>>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly barCount?: number;
  readonly fill?: string;
  /** Pause the shimmer sweep (used to capture deterministic frames for QA). Default: false. */
  readonly pulsePaused?: boolean;
}

const BarChartLoading = ({
  margin,
  aspectRatio = "2 / 1",
  className = "",
  barCount = FALLBACK_LOADING_BARS,
  fill = DEFAULT_LOADING_BAR_FILL,
  pulsePaused = false,
}: Readonly<BarChartLoadingProps>): React.ReactElement => {
  // Fixed base date keeps labels off "today"; values become placeholder heights.
  const data = React.useMemo(() => {
    const heights = loadingSkeletonBarHeights(barCount);
    const series = buildLoadingSkeletonSeries(LOADING_DATA_KEY, barCount);
    for (const [index, row] of series.entries()) {
      row[LOADING_DATA_KEY] = heights[index];
    }
    return series;
  }, [barCount]);

  return (
    <BarChart
      aspectRatio={aspectRatio}
      barGap={LOADING_BAR_GAP}
      className={className}
      data={data}
      margin={margin}
      xDataKey="date"
    >
      {/* Explicit: the grid defaults horizontal to true with no <Grid> child at all. */}
      <Grid horizontal={false} />

      <Bar
        dataKey={LOADING_DATA_KEY}
        fill={fill}
        lineCap={LOADING_BAR_CORNER_RADIUS}
      />
      <BarPulse dataKey={LOADING_DATA_KEY} pulsePaused={pulsePaused} />
    </BarChart>
  );
};

BarChartLoading.displayName = "BarChartLoading";

export { BarChartLoading };
export type { BarChartLoadingProps };
export default BarChartLoading;
