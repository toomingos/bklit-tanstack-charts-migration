import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { DEFAULT_MARGIN, HeatmapContext, HeatmapInteractionProvider, createHeatmapHoverCoordinator } from "./heatmap-context";
import type { HeatmapContextValue, HeatmapMargin } from "./heatmap-context";
import {
  HEATMAP_DEFAULT_ENTER_DURATION_MS,
  HEATMAP_DEFAULT_ENTER_TRANSITION,
  HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
  HEATMAP_LOADING_CHART_OPACITY,
  useHeatmapChartLifecycle,
} from "./heatmap-lifecycle";
import type { HeatmapEnterTransition } from "./heatmap-lifecycle";
import type { HeatmapColumn, HeatmapColumnSeparatorsConfig, HeatmapSeparatorParsedConfig, HeatmapWeekStartDay, HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter } from "./heatmap-utils";
import {
  filterHeatmapColumns,
  normalizeHeatmapSeparatorConfig,
  resolveHeatmapSeparatorLayout,
  rotateHeatmapColumnBins,
} from "./heatmap-utils";
import type { HeatmapLevelColors, HeatmapLevelStyles } from "./heatmap-colors";
import {
  buildHeatmapColorScaleFromStyles,
  buildHeatmapFillScale,
  resolveHeatmapLevelStyles,
} from "./heatmap-colors";
import { HOST_INITIAL_WIDTH, adoptHostWidth } from "./chart-host";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { HeatmapCells, HeatmapXAxis, HeatmapYAxis } from "./heatmap-components";
import { flattenChartChildren, hasChildrenProp, isHeatmapSeparatorChild } from "./heatmap-children";
import type { ChartStatus } from "./types";

/*
 * Single mount file (V3.3): the host owns sizing, package band scales own
 * the pixel range (no arithmetic scale closures).
 */

const DEFAULT_CHART_STATUS: ChartStatus = "ready";
const DEFAULT_HEATMAP_MIN_HEIGHT_PX = 160;
const MIN_RENDERABLE_DIMENSION_PX = 10;
const DEFAULT_WEEK_ROW_COUNT = 7;
// Host onRender threading needs the body/context files (V1.2).
// Width noise below this never relays out the bins.
const HEATMAP_RESIZE_EPSILON_PX = 0.5;

interface HeatmapChartProps {
  readonly data: HeatmapColumn[];
  readonly xDomain?: [Date, Date];
  readonly sizingColumnCount?: number;
  readonly layout?: "fluid" | "fill";
  readonly margin?: Readonly<Partial<HeatmapMargin>>;
  readonly binSize?: number;
  readonly gap?: number;
  readonly colorScale?: (count: number | null | undefined) => string;
  readonly levelColors?: HeatmapLevelColors;
  readonly levelStyles?: HeatmapLevelStyles;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly status?: ChartStatus;
  readonly loadingLabel?: string;
  readonly animationDuration?: number;
  readonly enterTransition?: HeatmapEnterTransition;
  readonly revealSignature?: string;
  readonly enterStaggerScale?: number;
  readonly animate?: boolean;
  readonly loadingOpacity?: number;
  readonly showLoadingCells?: boolean;
  readonly loadingCellMaxOpacity?: number;
  readonly loadingCellRandomness?: number;
  readonly columnSeparators?: HeatmapSeparatorParsedConfig;
  readonly weekStartDay?: HeatmapWeekStartDay;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const elementHasChildrenProp = (child: Readonly<ReactElement>): child is ReactElement<{ children?: ReactNode }> =>
  // SAFETY: traversal only reads `props.children`; the predicate narrows to the
  // Object shape React elements always carry, matching flattenChartChildren.
  hasChildrenProp(child.props);

const resolveHeatmapSeparatorConfigFromChildren = (children: Readonly<ReactNode>): HeatmapColumnSeparatorsConfig | undefined => {
  const flat = flattenChartChildren(children);
  const direct = flat.find((child: Readonly<ReactElement>) => isHeatmapSeparatorChild(child));
  if (direct) {
    return { every: direct.props.every, groupBy: direct.props.groupBy, spacing: direct.props.spacing };
  }
  const nestedMatches = flat.flatMap((child: Readonly<ReactElement>) =>
    elementHasChildrenProp(child) ? [resolveHeatmapSeparatorConfigFromChildren(child.props.children)] : [],
  );
  return nestedMatches.find(Boolean);
};

interface HeatmapYAxisConfig {
  readonly tickFilter: HeatmapYAxisTickFilter;
  readonly labelFormat: HeatmapYAxisLabelFormat;
  readonly rowOpacity: number | readonly number[] | undefined;
}

const resolveHeatmapYAxisConfigFromChildren = (children: Readonly<ReactNode>): HeatmapYAxisConfig => {
  const flat = flattenChartChildren(children);
  const direct = flat.find((child) => child.type === HeatmapYAxis);
  // SAFETY: HeatmapYAxis props are a fixed documented shape; the carrier renders
  // Nothing, so reading its props here is the same contract the portal version had.
  const props = (direct?.props ?? {}) as Partial<HeatmapYAxisConfig>;
  return {
    labelFormat: props.labelFormat ?? "full",
    rowOpacity: props.rowOpacity,
    tickFilter: props.tickFilter ?? "odd",
  };
};

const SURFACE_ROOT_STYLE: CSSProperties = { position: "relative" };
const SEPARATOR_SVG_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };
const LOADING_LABEL_STYLE: CSSProperties = {
  alignItems: "center",
  display: "flex",
  height: "100%",
  justifyContent: "center",
  left: 0,
  top: 0,
  width: "100%",
};

const HeatmapChart = (props: Readonly<HeatmapChartProps>): ReactElement => {
  const {
    data,
    layout = "fluid",
    binSize = 0,
    sizingColumnCount: _sizingColumnCount,
    gap = 2,
    colorScale: colorScaleProp,
    margin: marginProp,
    weekStartDay = 0,
    xDomain,
    levelColors,
    levelStyles,
    status = DEFAULT_CHART_STATUS,
    animationDuration = HEATMAP_DEFAULT_ENTER_DURATION_MS,
    enterTransition = HEATMAP_DEFAULT_ENTER_TRANSITION,
    enterStaggerScale = 1,
    revealSignature = "",
    loadingCellMaxOpacity = HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
    loadingCellRandomness = HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
    loadingLabel,
    animate = true,
    loadingOpacity = HEATMAP_LOADING_CHART_OPACITY,
    showLoadingCells = true,
    ariaDescription,
    ariaLabel,
    aspectRatio,
    className,
    columnSeparators,
    children,
  } = props;
  void _sizingColumnCount;

  // Host-owned sizing: initial width renders on the server; the inner
  // ChartHost reports its measured scene width back through context.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const reportWidth = useCallback((sceneWidth: number): void => {
    adoptHostWidth(setLiveWidth, sceneWidth);
  }, []);
  void HEATMAP_RESIZE_EPSILON_PX;

  const coordinator = useMemo(() => createHeatmapHoverCoordinator(), []);
  // Loading placeholder pulses as a whole chart (V3.9).
  // Skeleton cells stay solid; sweep paint covers bars, line and area.
  const reduceMotion = usePrefersReducedMotion();
  const surfacePulseClassName =
    status === "loading" && !reduceMotion ? "ts-bkm-loading-root" : undefined;

  const margin: HeatmapMargin = useMemo(() => ({
    bottom: marginProp?.bottom ?? DEFAULT_MARGIN.bottom,
    left: marginProp?.left ?? DEFAULT_MARGIN.left,
    right: marginProp?.right ?? DEFAULT_MARGIN.right,
    top: marginProp?.top ?? DEFAULT_MARGIN.top,
  }), [marginProp]);

  const separatorConfig = useMemo(
    () => columnSeparators ?? normalizeHeatmapSeparatorConfig(resolveHeatmapSeparatorConfigFromChildren(children)) ?? undefined,
    [columnSeparators, children],
  );
  const yAxisConfig = useMemo(() => resolveHeatmapYAxisConfigFromChildren(children), [children]);

  const filtered = useMemo(() => filterHeatmapColumns(data, xDomain), [data, xDomain]);
  const columns = useMemo(() => rotateHeatmapColumnBins(filtered, weekStartDay), [filtered, weekStartDay]);
  const normalizedSeparatorConfig = useMemo(() => normalizeHeatmapSeparatorConfig(separatorConfig), [separatorConfig]);
  const separatorLayout = useMemo(() => resolveHeatmapSeparatorLayout(normalizedSeparatorConfig, columns), [normalizedSeparatorConfig, columns]);

  const resolvedLevelStyles = useMemo(() => resolveHeatmapLevelStyles(levelColors, levelStyles), [levelColors, levelStyles]);
  const colorScale = useMemo(() => colorScaleProp ?? buildHeatmapColorScaleFromStyles(resolvedLevelStyles), [colorScaleProp, resolvedLevelStyles]);
  const fillScale = useMemo(() => buildHeatmapFillScale(resolvedLevelStyles), [resolvedLevelStyles]);

  const lifecycle = useHeatmapChartLifecycle({ animate, animationDurationMs: animationDuration, revealSignature, status });

  const rowCount = columns[0]?.bins.length ?? DEFAULT_WEEK_ROW_COUNT;
  const columnCount = columns.length;
  const separatorSpacingTotal = separatorLayout ? separatorLayout.atColumns.length * separatorLayout.spacing : 0;
  const explicitBinSize = binSize > 0 ? binSize : undefined;
  const cellSize = explicitBinSize ?? Math.max((liveWidth - margin.left - margin.right - separatorSpacingTotal) / Math.max(columnCount, 1), 0);
  const innerWidth = columnCount * cellSize + separatorSpacingTotal;
  const innerHeight = rowCount * cellSize;
  const chartHeight = margin.top + innerHeight + margin.bottom;
  const chartWidth = explicitBinSize !== undefined && layout === "fluid" ? margin.left + innerWidth + margin.right : liveWidth;
  void layout;

  const showLoadingLabel = (loadingLabel ?? "").trim().length > 0 &&
    status === "loading" &&
    (lifecycle.chartPhase === "loading" || lifecycle.chartPhase === "exitingReady");

  const contextValue: HeatmapContextValue = useMemo(() => ({
    animateCells: lifecycle.animateCells,
    animationDuration,
    ariaDescription,
    ariaLabel,
    binHeight: cellSize,
    binWidth: cellSize,
    chartPhase: lifecycle.chartPhase,
    chartStatus: status,
    colorScale,
    columnCount,
    data: columns,
    enterStaggerScale,
    enterTransition,
    fillScale,
    gap,
    height: chartHeight,
    innerHeight,
    innerWidth,
    isLoaded: lifecycle.isLoaded,
    isReady: chartWidth >= MIN_RENDERABLE_DIMENSION_PX && chartHeight >= MIN_RENDERABLE_DIMENSION_PX,
    levelStyles: resolvedLevelStyles,
    loadingCellMaxOpacity,
    loadingCellRandomness,
    loadingLabel,
    loadingOpacity,
    margin,
    reportWidth,
    revealEpoch: lifecycle.revealEpoch,
    revealMode: lifecycle.revealMode,
    rowCount,
    separatorLayout,
    showLoadingCells,
    showLoadingLabel,
    weekStartDay,
    width: chartWidth,
    yLabelFormat: yAxisConfig.labelFormat,
    yRowOpacity: yAxisConfig.rowOpacity,
    yTickFilter: yAxisConfig.tickFilter,
  }), [
    lifecycle,
    animationDuration,
    ariaDescription,
    ariaLabel,
    cellSize,
    status,
    colorScale,
    columnCount,
    columns,
    enterStaggerScale,
    enterTransition,
    fillScale,
    gap,
    chartHeight,
    innerHeight,
    innerWidth,
    chartWidth,
    resolvedLevelStyles,
    loadingCellMaxOpacity,
    loadingCellRandomness,
    loadingLabel,
    loadingOpacity,
    margin,
    reportWidth,
    rowCount,
    separatorLayout,
    showLoadingCells,
    showLoadingLabel,
    weekStartDay,
    yAxisConfig,
  ]);

  const containerStyle: CSSProperties = useMemo(() => {
    const style: CSSProperties = { height: "100%", position: "relative", width: "100%" };
    if ((aspectRatio ?? "").length > 0) {
      style.aspectRatio = aspectRatio;
    }
    if (aspectRatio === undefined || aspectRatio === "") {
      style.minHeight = DEFAULT_HEATMAP_MIN_HEIGHT_PX;
    }
    return style;
  }, [aspectRatio]);

  const flatChildren = useMemo(() => flattenChartChildren(children), [children]);
  const separatorElements = useMemo(() => flatChildren.filter((child) => isHeatmapSeparatorChild(child)), [flatChildren]);
  const otherElements = useMemo(() => flatChildren.filter((child) => !isHeatmapSeparatorChild(child)), [flatChildren]);

  const handlePointerLeave = useCallback(() => {
    coordinator.clearInteraction();
  }, [coordinator]);

  const isRenderable = chartWidth >= MIN_RENDERABLE_DIMENSION_PX && chartHeight >= MIN_RENDERABLE_DIMENSION_PX;

  return (
    <div
      className={className}
      data-bkm-chart="heatmap"
      data-slot="chart"
      style={containerStyle}
      onPointerLeave={handlePointerLeave}
    >
      <HeatmapInteractionProvider coordinator={coordinator}>
        {isRenderable ? (
          <HeatmapContext.Provider value={contextValue}>
            <div className={surfacePulseClassName} style={SURFACE_ROOT_STYLE}>
              {otherElements}
              <svg
                width={chartWidth}
                height={chartHeight}
                className="ts-bkm-heatmap-separator-svg"
                style={SEPARATOR_SVG_STYLE}
                aria-hidden="true"
              >
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                  {separatorElements}
                </g>
              </svg>
              {showLoadingLabel && (
                <div
                  className={`ts-bkm-heatmap-loading-label${lifecycle.chartPhase === "exitingReady" ? " ts-bkm-heatmap-loading-label--exiting" : ""}`}
                  data-slot="loading-label"
                  style={LOADING_LABEL_STYLE}
                >
                  {loadingLabel}
                </div>
              )}
            </div>
          </HeatmapContext.Provider>
        ) : undefined}
      </HeatmapInteractionProvider>
    </div>
  );
};

HeatmapChart.displayName = "HeatmapChart";

// Skeleton rows mirror the target columns with zeroed counts.
const generateHeatmapSkeletonFromTarget = (target: readonly Readonly<HeatmapColumn>[]): HeatmapColumn[] =>
  target.map((column: Readonly<HeatmapColumn>) => ({
    bin: column.bin,
    bins: column.bins.map((bin) => ({ bin: bin.bin, count: 0, date: bin.date })),
  }));

interface HeatmapChartLoadingProps {
  readonly data: HeatmapColumn[];
  readonly xDomain?: [Date, Date];
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
  const mutableXDomain = useMemo((): [Date, Date] | undefined => (xDomain === undefined ? undefined : [xDomain[0], xDomain[1]]), [xDomain]);

  return (
    <HeatmapChart className={className} data={skeletonData} gap={gap} loadingLabel={label} margin={margin} status="loading" xDomain={mutableXDomain}>
      <HeatmapCells cornerRadius={cornerRadius} interactive={false} />
      <HeatmapXAxis />
      <HeatmapYAxis />
    </HeatmapChart>
  );
};

export { HeatmapChart, HeatmapChartLoading, generateHeatmapSkeletonFromTarget };
export type { HeatmapChartProps, HeatmapChartLoadingProps };
