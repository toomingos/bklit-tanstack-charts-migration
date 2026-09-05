"use client";

import type { scaleBand, scaleLinear, scaleTime } from "@visx/scale";
import type { Transition } from "motion/react";
import { createContext, useContext, useMemo } from "react";
import type {
  Dispatch,
  ReactElement,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
import type { ChartPhase, ChartStatus } from "./chart-phase";
import type { YDomain } from "./y-domain";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-id";
import type { ChartSelection } from "./use-chart-interaction";

type ScaleLinear<Output, _Input = number> = ReturnType<
  typeof scaleLinear<Output>
>;
type ScaleTime<Output, _Input = Date | number> = ReturnType<
  typeof scaleTime<Output>
>;
type ScaleBand<Domain extends { toString: () => string }> = ReturnType<
  typeof scaleBand<Domain>
>;

// CSS variable references for theming
const chartCssVars = {
  background: "var(--chart-background)",
  badgeBackground: "var(--chart-marker-badge-background)",
  badgeForeground: "var(--chart-marker-badge-foreground)",
  brushBorder: "var(--chart-brush-border)",
  crosshair: "var(--chart-crosshair)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  grid: "var(--chart-grid)",
  indicatorColor: "var(--chart-indicator-color)",
  indicatorSecondaryColor: "var(--chart-indicator-secondary-color)",
  label: "var(--chart-label)",
  linePrimary: "var(--chart-line-primary)",
  lineSecondary: "var(--chart-line-secondary)",
  markerBackground: "var(--chart-marker-background)",
  markerBorder: "var(--chart-marker-border)",
  markerForeground: "var(--chart-marker-foreground)",
  segmentBackground: "var(--chart-segment-background)",
  segmentLine: "var(--chart-segment-line)",
  tooltipBackground: "var(--chart-tooltip-background)",
};

/** Default scatter series colors from the chart palette (`--chart-1` … `--chart-5`). */
const defaultScatterColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

interface Margin {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface TooltipData {
  /** The data point being hovered */
  point: Record<string, unknown>;
  /** Index in the data array */
  index: number;
  /** X position in pixels (relative to chart area) */
  x: number;
  /** Y positions for each line, keyed by dataKey */
  yPositions: Record<string, number>;
  /** X positions for each series (for grouped bars), keyed by dataKey */
  xPositions?: Record<string, number>;
}

interface LineConfig {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  /** Scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
}

/**
 * Hover/selection state — every field here changes on mouse movement.
 * Lives in its own context so cold consumers (Grid, YAxis, PatternArea, …)
 * can subscribe to the stable slice and skip re-rendering on every hover.
 */
interface ChartHoverContextValue {
  // Tooltip state
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
  tooltipData: TooltipData | null;

  // Selection state (optional - only present when useChartInteraction is used)
  /** Current drag/pinch selection range */
  selection?: ChartSelection | null;
  /** Clear the current selection */
  clearSelection?: () => void;

  // Bar chart hover (optional - only present in BarChart)
  /** Index of currently hovered bar */
  hoveredBarIndex?: number | null;
  /** Setter for hovered bar index */
  setHoveredBarIndex?: (index: number | null) => void;

  // Candlestick hover (optional - only present in CandlestickChart)
  /** Index of currently hovered candle */
  hoveredCandleIndex?: number | null;
  /** Setter for hovered candle index */
  setHoveredCandleIndex?: (index: number | null) => void;
}

interface ChartContextValue extends ChartHoverContextValue {
  // Data
  data: Record<string, unknown>[];
  /** Decimated subset for SVG path rendering; equals `data` when no decimation is needed. */
  renderData: Record<string, unknown>[];

  // Scales
  xScale: ScaleTime<number>;
  /** Primary (left) y-scale — alias for `yScales[DEFAULT_Y_AXIS_ID]`. */
  yScale: ScaleLinear<number>;
  /** Per-axis y-scales keyed by `yAxisId`. */
  yScales: Record<string, ScaleLinear<number>>;

  // Dimensions
  height: number;
  innerHeight: number;
  innerWidth: number;
  margin: Margin;
  width: number;

  // Column width for spacing calculations
  columnWidth: number;

  // Container ref for portals
  containerRef: RefObject<HTMLDivElement | null>;

  // Line configurations (extracted from children)
  lines: LineConfig[];

  /** {@link ReferenceArea} bands — drives y-axis label colors in range. */
  referenceAreas: ReferenceAreaConfig[];

  // Loading / lifecycle (LineChart status transitions)
  chartPhase: ChartPhase;
  chartStatus: ChartStatus;
  /** Centered label while `chartPhase` shows loading chrome. */
  loadingLabel?: string;
  /** Y-domain tween duration when transitioning loading ↔ ready (ms). */
  yDomainTweenDuration: number;
  /** Nice’d y-domains per axis from skeleton data (placeholder). */
  yDomainSkeletonByAxis: Record<string, YDomain>;
  /** Nice’d y-domains per axis from the current target data. */
  yDomainTargetByAxis: Record<string, YDomain>;

  // Animation state
  animationDuration: number;
  /** CSS easing for clip-reveal / line draw (cartesian charts). */
  animationEasing?: string;
  /** Motion enter transition (spring or tween) — drives clip reveal when spring. */
  enterTransition?: Transition;
  /** Increments when enter animation should replay. */
  revealEpoch?: number;
  /** Fired when a one-shot loading pulse (exit / enter) completes. */
  notifyLoadingPulseComplete?: () => void;
  isLoaded: boolean;

  // X accessor - how to get the x value from data points
  xAccessor: (d: Record<string, unknown>) => Date;

  // Pre-computed date labels for ticker animation
  dateLabels: string[];

  /** Active brush zoom range — when set, axis ticks align to visible data rows. */
  xDomain?: [Date, Date];
  /** Full dataset length when brush zoom is enabled (for zoom vs full-range detection). */
  xDomainSlotCount?: number;

  // Bar chart specific (optional - only present in BarChart)
  /** Band scale for categorical x-axis (bar charts) */
  barScale?: ScaleBand<string>;
  /** Width of each bar band */
  bandWidth?: number;
  /** X accessor for bar charts (returns string instead of Date) */
  barXAccessor?: (d: Record<string, unknown>) => string;
  /** Bar chart orientation */
  orientation?: "vertical" | "horizontal";
  /** Whether bars are stacked */
  stacked?: boolean;
  /** Stack offsets: Map of data index -> Map of dataKey -> cumulative offset */
  stackOffsets?: Map<number, Map<string, number>>;
  /** Squares variant — snap tooltip to top square and size ring dots. */
  squareSnap?: { squareGap: number; groupGap?: number; fit?: boolean };

  // ComposedChart + SeriesBar (optional)
  /** `SeriesBar` dataKeys in tree order, for grouped columns at each x */
  composedBarDataKeys?: string[];
  /** Target bar width in px (Recharts `barSize` style). */
  composedBarSize?: number;
  /** Max bar width in px (Recharts `maxBarSize`). */
  composedMaxBarSize?: number;
  /** Gap between grouped `SeriesBar` columns in px. */
  composedBarGap?: number;
  /** When true, `SeriesBar` segments stack in child order at each x. */
  composedStacked?: boolean;
  /** Per-row cumulative offsets for stacked `SeriesBar` (data index → dataKey → offset). */
  composedStackOffsets?: Map<number, Map<string, number>>;
  /** Vertical gap in px between stacked `SeriesBar` segments. Default: 0 */
  composedStackGap?: number;
}

/** Reference-area band config, verbatim from legacy chart-context. */
interface ReferenceAreaConfig {
  axisLabelColor?: string;
  y1?: number;
  y2?: number;
  yAxisId: string;
}

/**
 * Stable slice of the chart context — everything that doesn't change on hover
 * (data, scales, dimensions, animation state, layout config). Consumers that
 * subscribe via `useChartStable()` skip re-renders on every mouse move.
 */
type ChartStableContextValue = Omit<
  ChartContextValue,
  keyof ChartHoverContextValue
>;

const ChartStableContext =
  createContext<ChartStableContextValue | null>(null);
const ChartHoverContext = createContext<ChartHoverContextValue | null>(null);

/**
 * Splits the merged `value` into a stable slice and a volatile hover slice,
 * publishing each to its own context. Each slice is memoized on its own
 * field identities, so changing `tooltipData` does not bust the stable
 * slice — consumers of `useChartStable()` skip re-renders on hover.
 * @param {{ children: ReactNode; value: ChartContextValue }} properties - Provider props.
 * @returns {ReactElement} The split stable and hover providers.
 */
const ChartProvider = (properties: {
  children: ReactNode;
  value: ChartContextValue;
}): ReactElement => {
  const { children, value } = properties;
  const stable = useMemo<ChartStableContextValue>(
    () => ({
      animationDuration: value.animationDuration,
      animationEasing: value.animationEasing,
      bandWidth: value.bandWidth,
      barScale: value.barScale,
      barXAccessor: value.barXAccessor,
      chartPhase: value.chartPhase,
      chartStatus: value.chartStatus,
      columnWidth: value.columnWidth,
      composedBarDataKeys: value.composedBarDataKeys,
      composedBarGap: value.composedBarGap,
      composedBarSize: value.composedBarSize,
      composedMaxBarSize: value.composedMaxBarSize,
      composedStackGap: value.composedStackGap,
      composedStackOffsets: value.composedStackOffsets,
      composedStacked: value.composedStacked,
      containerRef: value.containerRef,
      data: value.data,
      dateLabels: value.dateLabels,
      enterTransition: value.enterTransition,
      height: value.height,
      innerHeight: value.innerHeight,
      innerWidth: value.innerWidth,
      isLoaded: value.isLoaded,
      lines: value.lines,
      loadingLabel: value.loadingLabel,
      margin: value.margin,
      notifyLoadingPulseComplete: value.notifyLoadingPulseComplete,
      orientation: value.orientation,
      referenceAreas: value.referenceAreas,
      renderData: value.renderData,
      revealEpoch: value.revealEpoch,
      squareSnap: value.squareSnap,
      stackOffsets: value.stackOffsets,
      stacked: value.stacked,
      width: value.width,
      xAccessor: value.xAccessor,
      xDomain: value.xDomain,
      xDomainSlotCount: value.xDomainSlotCount,
      xScale: value.xScale,
      yDomainSkeletonByAxis: value.yDomainSkeletonByAxis,
      yDomainTargetByAxis: value.yDomainTargetByAxis,
      yDomainTweenDuration: value.yDomainTweenDuration,
      yScale: value.yScale,
      yScales: value.yScales,
    }),
    [
      value.animationDuration,
      value.animationEasing,
      value.bandWidth,
      value.barScale,
      value.barXAccessor,
      value.chartPhase,
      value.chartStatus,
      value.columnWidth,
      value.composedBarDataKeys,
      value.composedBarGap,
      value.composedBarSize,
      value.composedMaxBarSize,
      value.composedStackGap,
      value.composedStackOffsets,
      value.composedStacked,
      value.containerRef,
      value.data,
      value.dateLabels,
      value.enterTransition,
      value.height,
      value.innerHeight,
      value.innerWidth,
      value.isLoaded,
      value.lines,
      value.loadingLabel,
      value.margin,
      value.notifyLoadingPulseComplete,
      value.orientation,
      value.referenceAreas,
      value.renderData,
      value.revealEpoch,
      value.squareSnap,
      value.stackOffsets,
      value.stacked,
      value.width,
      value.xAccessor,
      value.xDomain,
      value.xDomainSlotCount,
      value.xScale,
      value.yDomainSkeletonByAxis,
      value.yDomainTargetByAxis,
      value.yDomainTweenDuration,
      value.yScale,
      value.yScales,
    ],
  );

  const hover = useMemo<ChartHoverContextValue>(
    () => ({
      clearSelection: value.clearSelection,
      hoveredBarIndex: value.hoveredBarIndex,
      hoveredCandleIndex: value.hoveredCandleIndex,
      selection: value.selection,
      setHoveredBarIndex: value.setHoveredBarIndex,
      setHoveredCandleIndex: value.setHoveredCandleIndex,
      setTooltipData: value.setTooltipData,
      tooltipData: value.tooltipData,
    }),
    [
      value.clearSelection,
      value.hoveredBarIndex,
      value.hoveredCandleIndex,
      value.selection,
      value.setHoveredBarIndex,
      value.setHoveredCandleIndex,
      value.setTooltipData,
      value.tooltipData,
    ],
  );

  return (
    <ChartStableContext.Provider value={stable}>
      <ChartHoverContext.Provider value={hover}>
        {children}
      </ChartHoverContext.Provider>
    </ChartStableContext.Provider>
  );
};

/**
 * Stable slice — data, scales, dimensions, animation state, layout config.
 * Subscribers skip re-renders on hover (the hover slice lives in a separate
 * context). Prefer this in cold consumers like axes, grid, pattern fills.
 * @returns {ChartStableContextValue} The stable chart context value.
 */
const useChartStable = (): ChartStableContextValue => {
  const context = useContext(ChartStableContext);
  if (context === null) {
    throw new Error(
      "useChartStable must be used within a ChartProvider. " +
        "Make sure your component is wrapped in <LineChart>, <AreaChart>, <BarChart>, or <ComposedChart>.",
    );
  }
  return context;
};

/** Y-scale for a series axis (`yAxisId` on Line / Area / YAxis).
 * @param {string | number} [yAxisId] - Series axis id, defaulting to the primary axis.
 * @returns {ScaleLinear<number>} The y-scale for the requested axis id.
 */
const useYScale = (
  yAxisId?: string | number,
): ScaleLinear<number> => {
  const { yScales, yScale } = useChartStable();
  const id =
    yAxisId === undefined || yAxisId === "" ? DEFAULT_Y_AXIS_ID : String(yAxisId);
  return yScales[id] ?? yScale;
};

/**
 * Hover slice — tooltipData, selection, hovered bar / candle indices.
 * Subscribers re-render on every mouse move. Use only when the component
 * actually reads hover state.
 * @returns {ChartHoverContextValue} The hover chart context value.
 */
const useChartHover = (): ChartHoverContextValue => {
  const context = useContext(ChartHoverContext);
  if (context === null) {
    throw new Error(
      "useChartHover must be used within a ChartProvider. " +
        "Make sure your component is wrapped in <LineChart>, <AreaChart>, <BarChart>, or <ComposedChart>.",
    );
  }
  return context;
};

/**
 * Merged stable + hover context. Convenient for components that need both,
 * but re-renders on every hover (because hover changes). Prefer
 * `useChartStable()` or `useChartHover()` for hot consumers that only need
 * one slice.
 * @returns {ChartContextValue} The merged chart context value.
 */
const useChart = (): ChartContextValue => {
  const stable = useChartStable();
  const hover = useChartHover();
  return { ...stable, ...hover };
};

export {
  ChartProvider,
  chartCssVars,
  defaultScatterColors,
  useChart,
  useChartHover,
  useChartStable,
  useYScale,
};
export type {
  ChartContextValue,
  ChartHoverContextValue,
  ChartStableContextValue,
  LineConfig,
  Margin,
  ReferenceAreaConfig,
  TooltipData,
};
