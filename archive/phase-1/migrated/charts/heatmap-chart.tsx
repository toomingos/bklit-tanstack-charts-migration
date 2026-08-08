import {
  Children,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { HeatmapContext, useHeatmap, type HeatmapContextValue, type HeatmapMargin, type HeatmapLayout, DEFAULT_MARGIN } from "./internal/heatmap-context";
import { useHeatmapChartLifecycle } from "./internal/heatmap-lifecycle";
import { HeatmapInteractionProvider } from "./internal/heatmap-interaction";
import { createHeatmapHoverCoordinator, type HeatmapHoverCoordinator } from "./internal/heatmap-hover-chrome";
import {
  buildHeatmapBrushYScale,
  buildHeatmapTimeXScale,
  computeHeatmapDimensions,
  filterHeatmapColumns,
  getHeatmapColumnXOffset,
  getHeatmapTimeExtent,
  normalizeHeatmapSeparatorConfig,
  resolveHeatmapSeparatorLayout,
  rotateHeatmapColumnBins,
  type HeatmapColumn,
  type HeatmapColumnSeparatorsConfig,
  type HeatmapSeparatorLayout,
  type HeatmapWeekStartDay,
} from "./internal/heatmap-utils";
import {
  buildHeatmapColorScaleFromStyles,
  buildHeatmapFillScale,
  resolveHeatmapLevelStyles,
  type HeatmapLevelColors,
  type HeatmapLevelStyles,
} from "./internal/heatmap-colors";
import {
  HEATMAP_DEFAULT_ENTER_DURATION_MS,
  HEATMAP_DEFAULT_ENTER_TRANSITION,
  HEATMAP_LOADING_CHART_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
  type HeatmapEnterTransition,
} from "./internal/heatmap-animation";
import { HeatmapCells, HeatmapXAxis, HeatmapYAxis, HeatmapSeparator, type HeatmapSeparatorProps } from "./internal/heatmap-components";
import type { ChartStatus } from "./internal/types";
import "./styles.css";

const DEFAULT_CHART_STATUS: ChartStatus = "ready";

export interface HeatmapChartProps {
  data: HeatmapColumn[];
  xDomain?: [Date, Date];
  sizingColumnCount?: number;
  layout?: HeatmapLayout;
  margin?: Partial<HeatmapMargin>;
  binSize?: number;
  gap?: number;
  colorScale?: (count: number) => string;
  levelColors?: HeatmapLevelColors;
  levelStyles?: HeatmapLevelStyles;
  aspectRatio?: string;
  className?: string;
  status?: ChartStatus;
  loadingLabel?: string;
  animationDuration?: number;
  enterTransition?: HeatmapEnterTransition;
  revealSignature?: string;
  enterStaggerScale?: number;
  animate?: boolean;
  loadingOpacity?: number;
  showLoadingCells?: boolean;
  loadingCellMaxOpacity?: number;
  loadingCellRandomness?: number;
  columnSeparators?: HeatmapColumnSeparatorsConfig;
  weekStartDay?: HeatmapWeekStartDay;
  children: ReactNode;
}

export function HeatmapChart({
  data,
  children,
  className,
  layout = "fluid",
  binSize = 0,
  sizingColumnCount,
  gap = 2,
  colorScale,
  margin,
  weekStartDay = 0,
  xDomain,
  columnSeparators,
  levelColors,
  levelStyles,
  aspectRatio,
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
}: HeatmapChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSz((prev) =>
          Math.abs(prev.w - rect.width) > 0.5 || Math.abs(prev.h - rect.height) > 0.5
            ? { w: rect.width, h: rect.height }
            : prev,
        );
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const coordinatorRef = useRef<HeatmapHoverCoordinator | null>(null);
  if (coordinatorRef.current === null) coordinatorRef.current = createHeatmapHoverCoordinator();
  const coordinator = coordinatorRef.current;

  const resolvedSeparatorConfig = useMemo(
    () => columnSeparators ?? resolveHeatmapSeparatorConfigFromChildren(children),
    [columnSeparators, children],
  );

  return (
    <div
      className={className}
      data-bkm-chart="heatmap"
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: sz.h > 0 || aspectRatio ? undefined : 160,
        aspectRatio: aspectRatio || undefined,
      }}
      onPointerLeave={() => coordinator.clearInteraction()}
    >
      <HeatmapInteractionProvider coordinator={coordinator}>
        {sz.w > 0 && sz.h > 0 ? (
          <HeatmapChartInner
            data={data}
            containerRef={containerRef}
            containerWidth={sz.w}
            containerHeight={sz.h}
            layout={layout}
            binSize={binSize}
            sizingColumnCount={sizingColumnCount}
            gap={gap}
            colorScale={colorScale}
            margin={margin}
            weekStartDay={weekStartDay}
            xDomain={xDomain}
            separatorConfig={resolvedSeparatorConfig}
            levelColors={levelColors}
            levelStyles={levelStyles}
            status={status}
            animationDuration={animationDuration}
            enterTransition={enterTransition}
            enterStaggerScale={enterStaggerScale}
            revealSignature={revealSignature}
            loadingCellMaxOpacity={loadingCellMaxOpacity}
            loadingCellRandomness={loadingCellRandomness}
            loadingLabel={loadingLabel}
            animate={animate}
            loadingOpacity={loadingOpacity}
            showLoadingCells={showLoadingCells}
          >
            {children}
          </HeatmapChartInner>
        ) : null}
      </HeatmapInteractionProvider>
    </div>
  );
}

interface HeatmapChartInnerProps {
  data: HeatmapColumn[];
  containerRef: RefObject<HTMLDivElement | null>;
  containerWidth: number;
  containerHeight: number;
  layout: HeatmapLayout;
  binSize: number;
  sizingColumnCount: number | undefined;
  gap: number;
  colorScale: ((count: number) => string) | undefined;
  margin: Partial<HeatmapMargin> | undefined;
  weekStartDay: HeatmapWeekStartDay;
  xDomain: [Date, Date] | undefined;
  separatorConfig: HeatmapColumnSeparatorsConfig | undefined;
  levelColors: HeatmapLevelColors | undefined;
  levelStyles: HeatmapLevelStyles | undefined;
  status: ChartStatus;
  animationDuration: number;
  enterTransition: HeatmapEnterTransition | undefined;
  enterStaggerScale: number;
  revealSignature: string;
  loadingCellMaxOpacity: number;
  loadingCellRandomness: number;
  loadingLabel: string | undefined;
  animate: boolean;
  loadingOpacity: number;
  showLoadingCells: boolean;
  children?: ReactNode;
}

function HeatmapChartInner(props: HeatmapChartInnerProps) {
  const marginTop = props.margin?.top ?? DEFAULT_MARGIN.top;
  const marginRight = props.margin?.right ?? DEFAULT_MARGIN.right;
  const marginBottom = props.margin?.bottom ?? DEFAULT_MARGIN.bottom;
  const marginLeft = props.margin?.left ?? DEFAULT_MARGIN.left;
  const margin: HeatmapMargin = useMemo(
    () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    [marginTop, marginRight, marginBottom, marginLeft],
  );

  const filtered = useMemo(() => filterHeatmapColumns(props.data, props.xDomain), [props.data, props.xDomain]);
  const columns = useMemo(() => rotateHeatmapColumnBins(filtered, props.weekStartDay), [filtered, props.weekStartDay]);
  const rowCount = columns[0]?.bins.length ?? 7;
  const columnCount = columns.length;

  const normalizedSeparatorConfig = useMemo(
    () => normalizeHeatmapSeparatorConfig(props.separatorConfig),
    [props.separatorConfig],
  );
  const separatorLayout = useMemo(
    () => resolveHeatmapSeparatorLayout(normalizedSeparatorConfig, columns),
    [normalizedSeparatorConfig, columns],
  );

  const dimensions = useMemo(
    () =>
      computeHeatmapDimensions({
        width: props.containerWidth,
        parentHeight: props.containerHeight,
        margin,
        columnCount: props.sizingColumnCount ?? columnCount,
        rowCount,
        layout: props.layout,
        binSize: props.binSize,
        separator: separatorLayout,
      }),
    [
      props.containerWidth,
      props.containerHeight,
      margin,
      props.sizingColumnCount,
      columnCount,
      rowCount,
      props.layout,
      props.binSize,
      separatorLayout,
    ],
  );

  const xScale = useMemo(
    () => (columnIndex: number) => columnIndex * dimensions.binWidth + getHeatmapColumnXOffset(columnIndex, separatorLayout),
    [dimensions.binWidth, separatorLayout],
  );
  const yScale = useMemo(() => (rowIndex: number) => rowIndex * dimensions.binHeight, [dimensions.binHeight]);

  const resolvedLevelStyles = useMemo(
    () => resolveHeatmapLevelStyles(props.levelColors, props.levelStyles),
    [props.levelColors, props.levelStyles],
  );
  const colorScale = useMemo(
    () => props.colorScale ?? buildHeatmapColorScaleFromStyles(resolvedLevelStyles),
    [props.colorScale, resolvedLevelStyles],
  );
  const fillScale = useMemo(() => buildHeatmapFillScale(resolvedLevelStyles), [resolvedLevelStyles]);

  const { chartPhase, revealEpoch, isLoaded, revealMode, animateCells } = useHeatmapChartLifecycle(
    props.status,
    props.revealSignature,
    props.animationDuration,
    props.animate,
  );

  const width = dimensions.width;
  const height = dimensions.height;
  const innerWidth = dimensions.innerWidth;
  const innerHeight = dimensions.innerHeight;

  const timeExtent = useMemo(() => getHeatmapTimeExtent(columns), [columns]);
  const timeXScale = useMemo(() => buildHeatmapTimeXScale(timeExtent, innerWidth), [timeExtent, innerWidth]);
  const brushYScale = useMemo(() => buildHeatmapBrushYScale(innerHeight), [innerHeight]);
  const isReady = width >= 10 && height >= 10;

  const showLoadingLabel = Boolean(
    props.loadingLabel?.trim() && props.status === "loading" && (chartPhase === "loading" || chartPhase === "exitingReady"),
  );

  const [htmlLayerEl, setHtmlLayerEl] = useState<HTMLDivElement | null>(null);

  const contextValue = useMemo<HeatmapContextValue>(
    () => ({
      data: columns,
      binWidth: dimensions.binWidth,
      binHeight: dimensions.binHeight,
      gap: props.gap,
      margin,
      width,
      height,
      innerWidth,
      innerHeight,
      xScale,
      yScale,
      separatorLayout,
      timeXScale,
      brushYScale,
      isReady,
      levelStyles: resolvedLevelStyles,
      colorScale,
      fillScale,
      weekStartDay: props.weekStartDay,
      chartStatus: props.status,
      chartPhase,
      isLoaded,
      revealEpoch,
      animationDuration: props.animationDuration,
      enterTransition: props.enterTransition,
      enterStaggerScale: props.enterStaggerScale,
      animateCells,
      loadingOpacity: props.loadingOpacity,
      showLoadingCells: props.showLoadingCells,
      loadingCellMaxOpacity: props.loadingCellMaxOpacity,
      loadingCellRandomness: props.loadingCellRandomness,
      revealMode,
      loadingLabel: props.loadingLabel,
      showLoadingLabel,
      containerRef: props.containerRef,
      htmlLayerEl,
    }),
    [
      columns,
      dimensions.binWidth,
      dimensions.binHeight,
      props.gap,
      margin,
      width,
      height,
      innerWidth,
      innerHeight,
      xScale,
      yScale,
      separatorLayout,
      timeXScale,
      brushYScale,
      isReady,
      resolvedLevelStyles,
      colorScale,
      fillScale,
      props.weekStartDay,
      props.status,
      chartPhase,
      isLoaded,
      revealEpoch,
      props.animationDuration,
      props.enterTransition,
      props.enterStaggerScale,
      animateCells,
      props.loadingOpacity,
      props.showLoadingCells,
      props.loadingCellMaxOpacity,
      props.loadingCellRandomness,
      revealMode,
      props.loadingLabel,
      showLoadingLabel,
      props.containerRef,
      htmlLayerEl,
    ],
  );

  if (width < 10 || height < 10) return null;

  return (
    <HeatmapContext.Provider value={contextValue}>
      <HeatmapChartSurface onHtmlLayerMount={setHtmlLayerEl}>{props.children}</HeatmapChartSurface>
    </HeatmapContext.Provider>
  );
}

function isHeatmapSeparatorChild(child: ReactNode): child is ReactElement<HeatmapSeparatorProps> {
  return isValidElement(child) && child.type === HeatmapSeparator;
}

function resolveHeatmapSeparatorConfigFromChildren(children: ReactNode): HeatmapColumnSeparatorsConfig | undefined {
  let found: HeatmapColumnSeparatorsConfig | undefined;
  Children.forEach(children, (child) => {
    if (found) return;
    if (isHeatmapSeparatorChild(child)) {
      found = { every: child.props.every, groupBy: child.props.groupBy, spacing: child.props.spacing };
      return;
    }
    if (isValidElement(child) && (child.props as { children?: ReactNode } | undefined)?.children) {
      const nested = resolveHeatmapSeparatorConfigFromChildren((child.props as { children?: ReactNode }).children);
      if (nested) found = nested;
    }
  });
  return found;
}

function useSeparatorChildren(children: ReactNode): {
  separators: ReactElement[];
  others: ReactElement[];
} {
  return useMemo(() => {
    const separators: ReactElement[] = [];
    const others: ReactElement[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === HeatmapSeparator) {
        separators.push(child);
      } else if (isValidElement(child)) {
        others.push(child);
      }
    });
    return { separators, others };
  }, [children]);
}

function HeatmapChartSurface({
  children,
  onHtmlLayerMount,
}: {
  children?: ReactNode;
  onHtmlLayerMount: (el: HTMLDivElement | null) => void;
}) {
  const ctx = useHeatmap();
  const { separators, others } = useSeparatorChildren(children);

  return (
    <div style={{ position: "relative" }}>
      {others}
      <svg
        width={ctx.width}
        height={ctx.height}
        className="ts-bkm-heatmap-separator-svg"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <g transform={`translate(${ctx.margin.left}, ${ctx.margin.top})`}>
          {separators}
        </g>
      </svg>
      <div
        ref={onHtmlLayerMount}
        className="ts-bkm-heatmap-html-layer"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      {ctx.showLoadingLabel ? (
        <div
          className={`ts-bkm-heatmap-loading-label${ctx.chartPhase === "exitingReady" ? " ts-bkm-heatmap-loading-label--exiting" : ""}`}
          style={{ left: ctx.margin.left, top: 0 }}
        >
          {ctx.loadingLabel}
        </div>
      ) : null}
    </div>
  );
}

export function generateHeatmapSkeletonFromTarget(target: HeatmapColumn[]): HeatmapColumn[] {
  return target.map((column) => ({
    bin: column.bin,
    bins: column.bins.map((bin) => ({ bin: bin.bin, count: 0, date: bin.date })),
  }));
}

export interface HeatmapChartLoadingProps {
  data: HeatmapColumn[];
  xDomain?: [Date, Date];
  margin?: Partial<HeatmapMargin>;
  gap?: number;
  cornerRadius?: number;
  label?: string;
  className?: string;
}

export function HeatmapChartLoading({
  data,
  xDomain,
  margin,
  gap = 2,
  cornerRadius = 2,
  label = "Loading",
  className = "",
}: HeatmapChartLoadingProps) {
  const skeletonData = useMemo(() => generateHeatmapSkeletonFromTarget(data), [data]);

  return (
    <HeatmapChart className={className} data={skeletonData} gap={gap} loadingLabel={label} margin={margin} status="loading" xDomain={xDomain}>
      <HeatmapCells cornerRadius={cornerRadius} interactive={false} />
      <HeatmapXAxis />
      <HeatmapYAxis />
    </HeatmapChart>
  );
}

export {
  useHeatmap,
  HeatmapContext,
  type HeatmapContextValue,
  type HeatmapLayout,
  type HeatmapMargin,
} from "./internal/heatmap-context";

export {
  type HeatmapChartPhase,
  type HeatmapRevealMode,
} from "./internal/heatmap-lifecycle";

export {
  useHeatmapInteractionOptional,
  useHeatmapInteraction,
  HeatmapInteractionProvider,
  HeatmapInteractionBoundary,
  HeatmapInteractionRoot,
  type HeatmapInteractionContextValue,
  type HeatmapInteractionProviderProps,
  type HeatmapInteractionBoundaryProps,
  type HeatmapInteractionRootProps,
} from "./internal/heatmap-interaction";

export {
  HeatmapCells,
  HeatmapXAxis,
  HeatmapYAxis,
  HeatmapTooltip,
  HeatmapSeparator,
  type HeatmapCellsProps,
  type HeatmapXAxisProps,
  type HeatmapYAxisProps,
  type HeatmapTooltipProps,
  type HeatmapSeparatorProps,
} from "./internal/heatmap-components";

export {
  HeatmapLegend,
  HeatmapLegendSwatch,
  HeatmapLegendGradient,
  HEATMAP_LEGEND_LEVELS,
  type HeatmapLegendVariant,
  type HeatmapLegendSwatchProps,
  type HeatmapLegendProps,
  type HeatmapLegendGradientProps,
} from "./internal/heatmap-legend";

export type {
  HeatmapBin,
  HeatmapColumn,
  HeatmapColumnSeparatorsConfig,
  HeatmapSeparatorGroupBy,
  HeatmapSeparatorStrokeStyle,
  HeatmapSeparatorGradient,
  HeatmapWeekStartDay,
  HeatmapYAxisLabelFormat,
  HeatmapYAxisTickFilter,
} from "./internal/heatmap-utils";

export type {
  HeatmapEnterTransition,
  HeatmapLevelRange,
} from "./internal/heatmap-animation";

export type {
  HeatmapLevelColors,
  HeatmapLevelStyle,
  HeatmapLevelStyles,
  HeatmapLevelFillMode,
} from "./internal/heatmap-colors";

export type {
  HeatmapTooltipData,
  HeatmapHoveredCell,
} from "./internal/heatmap-hover-chrome";

export {
  HEATMAP_DEFAULT_LEVEL_COLORS,
  HEATMAP_DEFAULT_LEVEL_STYLES,
} from "./internal/heatmap-colors";

export {
  HEATMAP_DAY_LABELS,
} from "./internal/heatmap-utils";

export {
  HEATMAP_INACTIVE_OPACITY,
} from "./internal/heatmap-hover-chrome";

export {
  computeHeatmapLevelRange,
} from "./internal/heatmap-animation";
