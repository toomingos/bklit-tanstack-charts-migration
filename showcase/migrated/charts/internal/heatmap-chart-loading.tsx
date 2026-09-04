import { useMemo } from "react";
import type { ReactElement } from "react";
import { HeatmapChart } from "./heatmap-chart-core";
import type { HeatmapMargin } from "./heatmap-context";
import type { HeatmapColumn } from "./heatmap-utils";
import { generateHeatmapSkeletonFromTarget } from "./heatmap-chart-skeleton";
import { HeatmapCells, HeatmapXAxis, HeatmapYAxis } from "./heatmap-components";

// Sibling core import avoids an import cycle with the heatmap-chart barrel.

interface HeatmapChartLoadingProps {
  readonly data: readonly Readonly<HeatmapColumn>[];
  readonly xDomain?: readonly [Readonly<Date>, Readonly<Date>];
  readonly margin?: Readonly<Partial<HeatmapMargin>>;
  readonly gap?: number;
  readonly cornerRadius?: number;
  readonly label?: string;
  readonly className?: string;
}

const DEFAULT_LOADING_LABEL = "Loading";

const HeatmapChartLoading = ({
  data,
  xDomain,
  margin,
  gap = 2,
  cornerRadius = 2,
  label = DEFAULT_LOADING_LABEL,
  className = "",
}: Readonly<HeatmapChartLoadingProps>): ReactElement => {
  const skeletonData = useMemo(() => generateHeatmapSkeletonFromTarget(data), [data]);
  // HeatmapChart takes a mutable [Date, Date]; re-wrap the readonly prop (2 refs, loading path only).
  const mutableXDomain = useMemo((): [Date, Date] | undefined => (xDomain === undefined ? undefined : [xDomain[0], xDomain[1]]), [xDomain]);

  return (
    <HeatmapChart className={className} data={skeletonData} gap={gap} loadingLabel={label} margin={margin} status="loading" xDomain={mutableXDomain}>
      <HeatmapCells cornerRadius={cornerRadius} interactive={false} />
      <HeatmapXAxis />
      <HeatmapYAxis />
    </HeatmapChart>
  );
};

export { HeatmapChartLoading, type HeatmapChartLoadingProps };
