"use client";

// Turnkey <AreaChart status="loading"> placeholder; shimmer props accepted-but-inert for parity.
import * as React from "react";
import { curveNatural } from "d3-shape";
import { AreaChart } from "./area-chart";
import { Area, Grid } from "./children";
import { buildLoadingSkeletonSeries } from "./internal/loading-chrome";
import type { ChartMargin } from "./internal";

const LOADING_DATA_KEY = "value";
const DEFAULT_LOADING_GRID_STROKE =
  "color-mix(in oklch, var(--chart-grid) 50%, transparent)";

interface AreaChartLoadingProps {
  margin?: Partial<ChartMargin>;
  stroke?: string;
  /** Accepted-but-inert: applies to bklit's loading pulse stroke, which migrated's area chart doesn't draw (only line does). */
  strokeOpacity?: number;
  gridStroke?: string;
  /** Accepted-but-inert: the grid shimmer band is part of the deleted sweep/skeleton surface. */
  gridShimmerStroke?: string;
  /** Accepted-but-inert — see `gridShimmerStroke`. Default: true */
  gridShimmer?: boolean;
  /** Accepted-but-inert — see `gridShimmerStroke`. Default: 140 */
  gridShimmerLength?: number;
  /** Accepted-but-inert — see `gridShimmerStroke`. Default: 1 */
  gridShimmerSpeed?: number;
  /** Accepted-but-inert — see `gridShimmerStroke`. */
  gridShimmerSync?: boolean;
  /** Accepted-but-inert: only the default pulse style exists here, `"sweep"` is not implemented. */
  loadingStyle?: "pulse" | "sweep";
  label?: string;
  aspectRatio?: string;
  className?: string;
}

const AreaChartLoading = ({
  margin,
  stroke = "var(--foreground)",
  gridStroke = DEFAULT_LOADING_GRID_STROKE,
  label = "Loading",
  aspectRatio = "2 / 1",
  className = "",
}: Readonly<AreaChartLoadingProps>): React.ReactElement => {
  const data = React.useMemo(
    () => buildLoadingSkeletonSeries(LOADING_DATA_KEY),
    [],
  );

  return (
    <AreaChart
      animationDuration={0}
      aspectRatio={aspectRatio}
      className={className}
      data={data}
      loadingLabel={label}
      margin={margin}
      status="loading"
    >
      <Grid horizontal stroke={gridStroke} />
      {/* No pulse here (unlike bklit): the stroke goes on the series itself. */}
      <Area
        curve={curveNatural}
        dataKey={LOADING_DATA_KEY}
        fadeEdges={false}
        fill="transparent"
        fillOpacity={0}
        showHighlight={false}
        showLine
        stroke={stroke}
        strokeWidth={2}
      />
    </AreaChart>
  );
};

AreaChartLoading.displayName = "AreaChartLoading";

export { AreaChartLoading };
export type { AreaChartLoadingProps };
export default AreaChartLoading;
