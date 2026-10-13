"use client";
// Public bklit chart context (`ChartProvider`, `useChart`, ...) re-expressed over what the native chart reports: data, measured size, margin, resolved domains
// (as d3 scales), series config and the focused row (native `onFocusChange`). Nothing is read from the DOM.
import { createContext, useContext, useMemo } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { ScaleBand, ScaleLinear, ScaleTime } from "d3-scale";
import type { ChartSelection } from "../types";
import type { ChartPhase, ChartStatus } from "../motion/phase";
import { DEFAULT_Y_AXIS_ID } from "./series";
import { CHART_PALETTE } from "../palette";

/** @internal */
export const chartCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  linePrimary: "var(--chart-line-primary)",
  lineSecondary: "var(--chart-line-secondary)",
  crosshair: "var(--chart-crosshair)",
  grid: "var(--chart-grid)",
  indicatorColor: "var(--chart-indicator-color)",
  indicatorSecondaryColor: "var(--chart-indicator-secondary-color)",
  markerBackground: "var(--chart-marker-background)",
  markerBorder: "var(--chart-marker-border)",
  markerForeground: "var(--chart-marker-foreground)",
  badgeBackground: "var(--chart-marker-badge-background)",
  badgeForeground: "var(--chart-marker-badge-foreground)",
  segmentBackground: "var(--chart-segment-background)",
  segmentLine: "var(--chart-segment-line)",
  brushBorder: "var(--chart-brush-border)",
  tooltipBackground: "var(--chart-tooltip-background)",
};

/** Default scatter series colors from the chart palette (`--chart-1` ... `--chart-5`). */
export const defaultScatterColors = CHART_PALETTE;

/** Space between the chart edge and the plot area, in px. */
export interface Margin {
  /** Top margin in px. */
  top: number;
  /** Right margin in px. */
  right: number;
  /** Bottom margin in px. */
  bottom: number;
  /** Left margin in px. */
  left: number;
}

/** A line series as registered with the chart. */
export interface LineConfig {
  /** Key of the series in the chart data. */
  dataKey: string;
  /** Stroke color of the line. */
  stroke: string;
  /** Stroke width of the line in px. */
  strokeWidth: number;
  /**
   * Id of the y-scale group the line uses.
   * @default "left"
   */
  yAxisId?: string | number;
}

/** A `ReferenceArea` band as the axes see it. */
export interface ReferenceAreaConfig {
  /** Id of the y-scale group the band refers to. */
  yAxisId: string;
  /** Lower y data bound of the band. */
  y1?: number;
  /** Upper y data bound of the band. */
  y2?: number;
  /** Color for y-axis labels inside the band. */
  axisLabelColor?: string;
}

export interface TooltipData {
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

/** Hover state from `useChartHover()`. It changes whenever the focused row changes. */
export interface ChartHoverContextValue {
  /** The hovered or focused row, or `null` when nothing is hovered. */
  tooltipData: TooltipData | null;
  /** Moves the hover (crosshair and tooltip) to `data.index`. Pass `null` to clear it. */
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
  /** Current drag selection, or `null`. Read by `SegmentBackground` and the `SegmentLine*` children. */
  selection?: ChartSelection | null;
  /** Clears the current drag selection. */
  clearSelection?: () => void;
  /** Index of the hovered bar in a `BarChart`, or `null`. */
  hoveredBarIndex?: number | null;
  /** Moves the hover to a bar in a vertical `BarChart`. Pass `null` to clear it. */
  setHoveredBarIndex?: (index: number | null) => void;
  /** Index of the hovered candle in a `CandlestickChart`, or `null`. */
  hoveredCandleIndex?: number | null;
  /** Moves the hover to a candle. Pass `null` to clear it. */
  setHoveredCandleIndex?: (index: number | null) => void;
}

/** Chart state from `useChartStable()` that does not change on hover: data, scales, sizes and series. */
export interface ChartStableContextValue {
  /** The chart's data rows. */
  data: Record<string, unknown>[];
  /** The rows that are drawn. Currently the same rows as `data`. */
  renderData: Record<string, unknown>[];
  /** Maps a date to an x pixel inside the plot area. */
  xScale: ScaleTime<number, number>;
  /** Scale of the primary (`"left"`) y axis. */
  yScale: ScaleLinear<number, number>;
  /** Y scale of every axis, keyed by `yAxisId`. */
  yScales: Record<string, ScaleLinear<number, number>>;
  /** Chart width in px. */
  width: number;
  /** Chart height in px. */
  height: number;
  /** Plot area width in px (chart width minus the left and right margins). */
  innerWidth: number;
  /** Plot area height in px (chart height minus the top and bottom margins). */
  innerHeight: number;
  /** Space around the plot area in px. */
  margin: Margin;
  /** Ref to the chart's container element. Use it to portal custom overlays into the chart. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The registered line series. */
  lines: LineConfig[];
  /** Entrance animation duration in ms. */
  animationDuration: number;
  /** `true` once the entrance has finished and the chart accepts input. */
  isLoaded: boolean;
  /** `"revealing"` until the entrance finishes, then `"ready"`. */
  chartPhase: ChartPhase;
  /** The chart's `status`: `"loading"` or `"ready"`. */
  chartStatus: ChartStatus;
  /** Resolved y domain `[min, max]` per `yAxisId`. */
  yDomainTargetByAxis: Record<string, [number, number]>;
  /** The `ReferenceArea` bands, in the order they appear in the chart. */
  referenceAreas: ReferenceAreaConfig[];
  /** Reads the x date from a data row. */
  xAccessor: (d: Record<string, unknown>) => Date;
  /** Formatted x labels, one per data row. */
  dateLabels: string[];
  /** Visible x range when the chart is zoomed, for example by a brush. */
  xDomain?: [Date, Date];
  /** Number of rows in the full dataset while the chart is zoomed. */
  xDomainSlotCount?: number;
  /** Width in px of the slot for one data row (bar and candlestick charts). */
  columnWidth?: number;
  /** Width in px of a candle body (`CandlestickChart`) or a bar band. */
  bandWidth?: number;
  /** Band scale for the categories of a `BarChart`. */
  barScale?: ScaleBand<string>;
  /** Reads the category from a data row (`BarChart`). */
  barXAccessor?: (d: Record<string, unknown>) => string;
  /** Bar direction: `"vertical"` or `"horizontal"` (`BarChart`). */
  orientation?: "vertical" | "horizontal";
  /** Whether bars are stacked (`BarChart`). */
  stacked?: boolean;
  /** Cumulative offsets for stacked bars: data index, then `dataKey`. */
  stackOffsets?: Map<number, Map<string, number>>;
  /** `dataKey`s of the `SeriesBar` series, in order (`ComposedChart`). */
  composedBarDataKeys?: string[];
  /** Bar width in px (`ComposedChart`). */
  composedBarSize?: number;
  /** Maximum bar width in px (`ComposedChart`). */
  composedMaxBarSize?: number;
  /** Gap between bars of the same row in px (`ComposedChart`). */
  composedBarGap?: number;
  /** Whether the `SeriesBar` series are stacked (`ComposedChart`). */
  composedStacked?: boolean;
  /** Gap between stacked bar segments in px (`ComposedChart`). */
  composedStackGap?: number;
}

/**
 * Everything from `useChart()`: `ChartStableContextValue` and `ChartHoverContextValue` combined. Prefer the narrower hooks in custom children so they do not re-render on every hover.
 */
export type ChartContextValue = ChartStableContextValue & ChartHoverContextValue;

const StableContext = createContext<ChartStableContextValue | null>(null);
const HoverContext = createContext<ChartHoverContextValue | null>(null);

const STABLE_KEYS = [
  "data", "renderData", "xScale", "yScale", "yScales", "width", "height", "innerWidth", "innerHeight", "margin", "containerRef",
  "lines", "animationDuration", "isLoaded", "chartPhase", "chartStatus", "yDomainTargetByAxis", "referenceAreas",
  "xAccessor", "dateLabels", "xDomain", "xDomainSlotCount", "columnWidth", "bandWidth", "barScale", "barXAccessor",
  "orientation", "stacked", "stackOffsets", "composedBarDataKeys", "composedBarSize", "composedMaxBarSize", "composedBarGap",
  "composedStacked", "composedStackGap",
] as const satisfies readonly (keyof ChartStableContextValue)[];

/** @internal */
export function ChartProvider({ children, value }: { readonly children: ReactNode; readonly value: ChartContextValue }): ReactNode {
  const { tooltipData, setTooltipData, selection, clearSelection, hoveredBarIndex, setHoveredBarIndex, hoveredCandleIndex, setHoveredCandleIndex, ...rest } = value;
  // The stable slice is rebuilt from field identities, so a focus move does not bust it.
  const stable = useMemo<ChartStableContextValue>(
    () => rest,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    STABLE_KEYS.map((key) => rest[key]),
  );
  const hover = useMemo<ChartHoverContextValue>(
    () => ({ tooltipData, setTooltipData, selection, clearSelection, hoveredBarIndex, setHoveredBarIndex, hoveredCandleIndex, setHoveredCandleIndex }),
    [tooltipData, setTooltipData, selection, clearSelection, hoveredBarIndex, setHoveredBarIndex, hoveredCandleIndex, setHoveredCandleIndex],
  );
  return (
    <StableContext.Provider value={stable}>
      <HoverContext.Provider value={hover}>{children}</HoverContext.Provider>
    </StableContext.Provider>
  );
}

const MISSING =
  " must be used within a ChartProvider. Make sure your component is rendered inside the tooltip content or children of <LineChart> or <AreaChart>.";

export function useChartStable(): ChartStableContextValue {
  const context = useContext(StableContext);
  if (!context) {
    throw new Error(`useChartStable${MISSING}`);
  }
  return context;
}

/** Like `useChartStable`, but `null` outside a chart (standalone loading parts take explicit sizes instead). */
export function useOptionalChartStable(): ChartStableContextValue | null {
  return useContext(StableContext);
}

export function useChartHover(): ChartHoverContextValue {
  const context = useContext(HoverContext);
  if (!context) {
    throw new Error(`useChartHover${MISSING}`);
  }
  return context;
}

/** Merged stable + hover context; re-renders on every focus move. */
export function useChart(): ChartContextValue {
  const stable = useChartStable();
  const hover = useChartHover();
  return useMemo(() => ({ ...stable, ...hover }), [stable, hover]);
}

/** Y-scale for a series axis (`yAxisId` on Line / Area / YAxis). */
export function useYScale(yAxisId?: string | number): ScaleLinear<number, number> {
  const { yScales, yScale } = useChartStable();
  const id = yAxisId == null || yAxisId === "" ? DEFAULT_Y_AXIS_ID : String(yAxisId);
  return yScales[id] ?? yScale;
}
