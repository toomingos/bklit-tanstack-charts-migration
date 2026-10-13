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

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LineConfig {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  /** Scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
}

/** A `ReferenceArea` band as the axes see it (y-axis label colours inside the band). */
export interface ReferenceAreaConfig {
  yAxisId: string;
  y1?: number;
  y2?: number;
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

/** Hover state: changes on every focus move. */
export interface ChartHoverContextValue {
  tooltipData: TooltipData | null;
  /** Moves the native focus (crosshair, tooltip) to `data.index`; `null` clears it. */
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
  /** Current drag/pinch selection range (Segment* children). */
  selection?: ChartSelection | null;
  /** Clear the current selection. */
  clearSelection?: () => void;
  /** Index of the hovered bar (BarChart). */
  hoveredBarIndex?: number | null;
  /** Moves the native focus to a bar (vertical bars only); `null` clears it. */
  setHoveredBarIndex?: (index: number | null) => void;
  /** Index of the hovered candle (CandlestickChart). */
  hoveredCandleIndex?: number | null;
  /** Moves the native focus to a candle; `null` clears it. */
  setHoveredCandleIndex?: (index: number | null) => void;
}

/** Everything that does not change on hover. */
export interface ChartStableContextValue {
  data: Record<string, unknown>[];
  /** Equals `data`: decimated rows are only drawn (kit/cartesian/decimate.ts), never exposed. */
  renderData: Record<string, unknown>[];
  xScale: ScaleTime<number, number>;
  /** Primary (left) y-scale, alias for `yScales[DEFAULT_Y_AXIS_ID]`. */
  yScale: ScaleLinear<number, number>;
  yScales: Record<string, ScaleLinear<number, number>>;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  containerRef: RefObject<HTMLDivElement | null>;
  lines: LineConfig[];
  animationDuration: number;
  /** `true` once the entrance has finished and the chart accepts input (host `data-bkm-ready`). */
  isLoaded: boolean;
  /** `"revealing"` until the entrance finishes, then `"ready"`. The loading phases belong to the `*Loading` components. */
  chartPhase: ChartPhase;
  chartStatus: ChartStatus;
  /** Resolved y-domain per axis id. */
  yDomainTargetByAxis: Record<string, [number, number]>;
  /** `ReferenceArea` bands, in tree order. */
  referenceAreas: ReferenceAreaConfig[];
  xAccessor: (d: Record<string, unknown>) => Date;
  dateLabels: string[];
  xDomain?: [Date, Date];
  /** Full dataset length while brush-zoomed. */
  xDomainSlotCount?: number;
  /** Slot width per data row (bar / candlestick charts). */
  columnWidth?: number;
  /** Candle body width in px (CandlestickChart). */
  bandWidth?: number;
  /** Band scale for the categorical x axis (BarChart). */
  barScale?: ScaleBand<string>;
  /** Category accessor (BarChart). */
  barXAccessor?: (d: Record<string, unknown>) => string;
  orientation?: "vertical" | "horizontal";
  stacked?: boolean;
  /** Stack offsets: data index -> dataKey -> cumulative offset. */
  stackOffsets?: Map<number, Map<string, number>>;
  /** `SeriesBar` dataKeys in tree order (ComposedChart). */
  composedBarDataKeys?: string[];
  composedBarSize?: number;
  composedMaxBarSize?: number;
  composedBarGap?: number;
  composedStacked?: boolean;
  composedStackGap?: number;
}

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
