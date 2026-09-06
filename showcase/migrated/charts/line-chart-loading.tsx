// V3.4b parity: legacy `LineChartLoading` turnkey placeholder.
// Sweep style stays inert until V3.9; the pulse path renders through entry.
"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";
import { curveNatural } from "d3-shape";
import "./styles.css";
import { LineChart } from "./line-chart";
import { Grid, Line } from "./children";
import { generateChartSkeletonData } from "./internal/skeleton-data";
import type { LoadingStyle } from "./internal/chart-phase";
import type { Margin } from "./internal/chart-context";

const LOADING_DATA_KEY = "value";
const DEFAULT_LOADING_STROKE = "var(--foreground)";
const DEFAULT_LOADING_GRID_STROKE = "color-mix(in oklch, var(--chart-grid) 50%, transparent)";
const DEFAULT_LOADING_GRID_SHIMMER_STROKE = "color-mix(in oklch, var(--foreground) 68%, transparent)";
const DEFAULT_LOADING_STROKE_OPACITY = 0.5;
const SKELETON_POINT_COUNT = 7;

interface LineChartLoadingProps {
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Stroke color for the animated loading segment. */
  stroke?: string;
  /** Stroke opacity for the animated loading segment. Default: 0.5 */
  strokeOpacity?: number;
  /** Grid line stroke (color and opacity via color-mix or oklch alpha). */
  gridStroke?: string;
  /** Shimmer band stroke (color and opacity via color-mix or oklch alpha). */
  gridShimmerStroke?: string;
  /** Animate a shimmer band across grid lines. Default: true */
  gridShimmer?: boolean;
  /** Shimmer band width in pixels. Default: 140 */
  gridShimmerLength?: number;
  /** Shimmer speed multiplier (higher = faster). Default: 1 */
  gridShimmerSpeed?: number;
  /** Match shimmer loop to the loading line pulse (cycle + inter-loop pause). */
  gridShimmerSync?: boolean;
  /** Loading animation: `"pulse"` (traveling pulse) or `"sweep"` (diagonal shimmer). Default: `"pulse"`. */
  loadingStyle?: LoadingStyle;
  /** Centered shimmer label text. Default: "Loading" */
  label?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /** Additional class name for the container */
  className?: string;
}

const LineChartLoading = ({
  margin,
  stroke = DEFAULT_LOADING_STROKE,
  strokeOpacity = DEFAULT_LOADING_STROKE_OPACITY,
  gridStroke = DEFAULT_LOADING_GRID_STROKE,
  gridShimmerStroke = DEFAULT_LOADING_GRID_SHIMMER_STROKE,
  gridShimmer = true,
  gridShimmerLength,
  gridShimmerSpeed,
  gridShimmerSync = false,
  loadingStyle = "pulse",
  label = "Loading",
  aspectRatio = "2 / 1",
  className = "",
}: LineChartLoadingProps): ReactElement => {
  const data = useMemo(
    () =>
      generateChartSkeletonData({
        dataKey: LOADING_DATA_KEY,
        pointCount: SKELETON_POINT_COUNT,
      }),
    [],
  );

  return (
    <LineChart
      animationDuration={0}
      aspectRatio={aspectRatio}
      className={className}
      data={data}
      loadingLabel={label}
      margin={margin}
      status="loading"
    >
      <Grid
        horizontal
        shimmer={loadingStyle === "sweep" ? false : gridShimmer}
        shimmerLength={gridShimmerLength}
        shimmerSpeed={gridShimmerSpeed}
        shimmerStroke={gridShimmerStroke}
        shimmerSync={gridShimmerSync}
        stroke={gridStroke}
      />
      <Line
        curve={curveNatural}
        dataKey={LOADING_DATA_KEY}
        fadeEdges={false}
        loadingStroke={stroke}
        loadingStrokeOpacity={strokeOpacity}
        showHighlight={false}
        stroke="transparent"
        strokeWidth={2.5}
      />
    </LineChart>
  );
};

export { LineChartLoading };
export type { LineChartLoadingProps };
