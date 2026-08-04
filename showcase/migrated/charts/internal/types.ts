import type { ReactNode } from "react";
import type { CurveFactory } from "d3-shape";

/** Row shape accepted by the cartesian charts (bklit contract). */
export type ChartDatum = Record<string, unknown>;

/** bklit-compatible chart status / phase (subset used by the pilot). */
export type ChartStatus = "loading" | "ready";
export type ChartPhase =
  | "loading"
  | "exiting"
  | "gridTweenReady"
  | "revealing"
  | "ready"
  | "exitingReady"
  | "gridTweenLoading"
  | "revealingLoading";

/** bklit SeriesPointMarkerStyle (series-point-marker.tsx) — marker
    appearance contract. */
export interface SeriesPointMarkerStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  ringGap?: number;
  outlineWidth?: number;
  outlineColor?: string;
  radius?: number;
  fadeOnHover?: boolean;
  inactiveOpacity?: number;
  inactiveBlur?: number;
  enterBlur?: number;
  showActiveHighlight?: boolean;
}

/** Config carried by a <Line> child (bklit Line prop contract, pilot subset). */
export interface LineConfig {
  dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  curve?: CurveFactory;
  yAxisId?: string | number;
  /** bklit line.tsx: fade the stroke out at the plot edges (default true). */
  fadeEdges?: boolean | "left" | "right";
  /** bklit line.tsx: hover dim + highlight band (default true). */
  showHighlight?: boolean;
  /** Render scatter-style circle markers at each data point (bklit showMarkers). Default: false */
  showMarkers?: boolean;
  /** Marker styling (same options as Scatter). */
  markers?: SeriesPointMarkerStyle;
  /** Data index from which the line stroke becomes dashed. */
  dashFromIndex?: number;
  /** Dash pattern for the tail segment. Default: "6,4". */
  dashArray?: string;
  /** Loading pulse strobe color. */
  loadingStroke?: string;
  /** Loading pulse opacity. Default: 0.5. */
  loadingStrokeOpacity?: number;
  /** Whether to animate the line. Default: true. */
  animate?: boolean;
}

/** Config carried by an <Area> child (bklit area.tsx AreaProps, pilot
    subset). Rendered as an areaY fill mark (id `${dataKey}__fill`) plus a
    lineY boundary mark (id `dataKey`, same id convention as <Line> so the
    hover chrome's series-by-markId lookups work unchanged). */
export interface AreaConfig {
  dataKey: string;
  /** Stroke color for the boundary line. Default: `fill ?? "var(--chart-line-primary)"`
      (area.tsx `resolvedStroke = stroke || fill`; extractAreaConfigs's own
      fallback chain — verified identical when `fill` is left at its
      default). */
  stroke?: string;
  /** Default: 2 (area.tsx — differs from Line's bklit default). */
  strokeWidth?: number;
  /** Fill color feeding the per-series vertical gradient. Default:
      "var(--chart-line-primary)" (area.tsx `fill` prop default). */
  fill?: string;
  /** Fill opacity at the top of the area gradient (bottom fades to 0).
      Default: 0.4 (area.tsx). */
  fillOpacity?: number;
  /** Default: curveMonotoneX (area.tsx — differs from Line's curveNatural
      default; the registry demo/bench scenario overrides this explicitly
      with curveNatural, same as Line). */
  curve?: CurveFactory;
  yAxisId?: string | number;
  /** bklit area.tsx: fade the fill+stroke out at the plot edges. Default:
      false (differs from Line's default true). Only boolean `true` is
      implemented (both-side mask), matching the accepted Line precedent
      (docs/LOG.md D13c) for "left"/"right". */
  fadeEdges?: boolean | "left" | "right";
  /** bklit area.tsx: hover dim (to 0.6, not Line's 0.3) + highlight band on
      the boundary line. Default: true. */
  showHighlight?: boolean;
}

/** Config carried by a <Scatter> child (bklit Scatter prop contract, pilot
    subset — series-markers.tsx / scatter.tsx defaults). */
export interface ScatterConfig {
  dataKey: string;
  fill?: string;
  stroke?: string;
  /** Ring stroke width. Default: 2. */
  strokeWidth?: number;
  /** Gap between fill circle and ring. Default: 2. */
  ringGap?: number;
  /** Fill circle radius. Default: 5. */
  radius?: number;
}

/** Config carried by a <Grid> child (pilot subset of bklit GridProps). */
export interface GridConfig {
  horizontal?: boolean;
  vertical?: boolean;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  numTicks?: number;
}

/** Config carried by an <XAxis> child (pilot subset). */
export interface XAxisConfig {
  numTicks?: number;
  formatValue?: (value: Date) => string;
}

/** Config carried by a <Bar> child (bklit bar.tsx BarProps, pilot subset —
    vertical grouped demo path only: no stacked/horizontal/perspective). */
export interface BarConfig {
  dataKey: string;
  fill?: string;
  stroke?: string;
  /** "round" (default, bandwidth-derived radius capped at 8), "butt" (0), or
      an explicit corner radius in px. */
  lineCap?: "round" | "butt" | number;
  /** Opacity when a different category is hovered. Default: 0.3. */
  fadedOpacity?: number;
}

/** Config carried by a <SeriesBar> child (bklit series-bar.tsx SeriesBarProps,
    pilot subset — ComposedChart's bar series, unstacked-grouped layout only:
    `stacked`/`stackGap` are ComposedChart-level props, out of pilot scope,
    see composed-chart.tsx). */
export interface SeriesBarConfig {
  dataKey: string;
  /** Default: "var(--chart-line-primary)" (series-bar.tsx `fill` default). */
  fill?: string;
  /** Tooltip dot / bar-shim stroke color. Default: `stroke ?? fill`
      (composed-chart.tsx `tryAppendSeriesBar`). */
  stroke?: string;
  /** Corner radius for bar top corners. Default: 0 — square tops, DIFFERENT
      from standalone <Bar>'s "round" default (series-bar.tsx `radius` default
      is a literal 0, not bandwidth-derived). */
  radius?: number;
  /** Opacity for non-hovered rows while a different row is hovered.
      Default: 0.3 (series-bar.tsx `fadedOpacity` default). */
  fadedOpacity?: number;
}

/** Config carried by a <BarXAxis> child (bklit bar-x-axis.tsx, pilot subset). */
export interface BarXAxisConfig {
  tickerHalfWidth?: number;
  showAllLabels?: boolean;
  maxLabels?: number;
}

/** Point payload passed to a <ChartTooltip content> render prop (bklit
    chart-tooltip.tsx `TooltipRenderProps`: `{ point, index }`, `point` is the
    raw context-data row for the hovered/live position). */
export interface ChartTooltipPoint {
  date?: Date;
  [key: string]: unknown;
}

/** Config carried by a <ChartTooltip> child (pilot subset of bklit
    ChartTooltipProps — defaults all true, matching chart-tooltip.tsx).
    `content` is LiveLineChart-only (docs/LOG.md D22): a custom render prop
    that REPLACES the default title+rows body entirely, matching bklit's own
    chart-tooltip.tsx branch (`content ? content({point,index}) : <default>`).
    Other migrated charts' extraction ignores this field. */
export interface ChartTooltipConfig {
  enabled?: boolean;
  showDatePill?: boolean;
  showCrosshair?: boolean;
  showDots?: boolean;
  content?: (props: { point: ChartTooltipPoint; index: number }) => ReactNode;
}

/** Config carried by a <Candlestick> child (bklit candlestick.tsx
    CandlestickProps, pilot subset — solid-fill-only, no gradient/legend
    branches). */
export interface CandlestickConfig {
  /** Reserved for parity with bklit's prop surface — the pilot's reveal
      is always driven by CandlestickChart's own `animationDuration`/
      `revealSignature`, so this has no independent effect yet. */
  animate?: boolean;
  /** bklit candlestick.tsx SOLID_POSITIVE default: var(--color-emerald-500). */
  positiveFill?: string;
  /** bklit candlestick.tsx SOLID_NEGATIVE default: var(--color-red-500). */
  negativeFill?: string;
  /** Extra INNER border drawn inset inside the body (in addition to the
      body's own always-on 1px self-stroke). Default: 0 (off) — matches
      candlestick.tsx CandlestickProps.insideStrokeWidth default. */
  insideStrokeWidth?: number;
  /** Opacity all candles dim to while any candle is hovered. Default: 0.3. */
  fadedOpacity?: number;
  /** Whether hover dims non-hovered candles at all. Default: true. */
  showHoverFade?: boolean;
}

/** Config carried by a <YAxis> child (bklit y-axis.tsx YAxisProps, pilot
    subset — left-orientation HTML overlay only). */
export interface YAxisConfig {
  yAxisId?: string | number;
  /** Only "left" is implemented (bklit default; the registry demo/bench
      scenario never overrides this). */
  orientation?: "left" | "right";
  numTicks?: number;
  formatLargeNumbers?: boolean;
  formatValue?: (value: number) => string;
}

/** bklit live-line.tsx MomentumColors. */
export interface MomentumColors {
  up: string;
  down: string;
  flat: string;
}

/** Config carried by a <LiveLine> child (bklit live-line.tsx LiveLineProps,
    pilot subset — LiveLineChart is a NEW top-level component, not a
    LineChart variant, docs/LOG.md D22). One entry renders one full line +
    fill + "live tip" chrome (dot/badge/pulse/dashed reference); LiveLineChart
    supports multiple, matching bklit's actual capability (each child gets
    its own React series, sharing the loop-driven frame/tooltip). */
export interface LiveLineConfig {
  dataKey: string;
  /** Default: var(--chart-line-primary) (live-line.tsx `chartCssVars.linePrimary`). */
  stroke?: string;
  /** Default: 2. */
  strokeWidth?: number;
  /** Default: curveMonotoneX (live-line.tsx). */
  curve?: CurveFactory;
  /** Show gradient fill under the curve. Default: true. */
  fill?: boolean;
  /** Show the pulsing SMIL ring at the live tip. Default: true. */
  pulse?: boolean;
  /** Live dot radius. Default: 4. */
  dotSize?: number;
  /** Show the value badge pill at the live tip. Default: true. */
  badge?: boolean;
  /** Value formatter for the badge + default tooltip row. Default: v.toFixed(2). */
  formatValue?: (v: number) => string;
  /** When set, line/fill/dot recolor by momentum direction (up/down/flat);
      the dot ALWAYS recolors by momentum even when this is unset (uses the
      chart-1/chart-5/stroke default triple — live-line.tsx `defaultMomentumColors`). */
  momentumColors?: MomentumColors;
}

/** Config carried by a <LiveXAxis> child (bklit live-x-axis.tsx, pilot
    subset — evenly time-spaced labels, NOT data-index-aligned). */
export interface LiveXAxisConfig {
  /** Number of time labels. Default: 5. */
  numTicks?: number;
  /** Time formatter. Default: HH:MM:SS (hmsTimeFmt). */
  formatTime?: (t: number) => string;
}

/** Config carried by a <LiveYAxis> child (bklit live-y-axis.tsx, pilot
    subset — hysteresis interval picker + spring tick list). */
export interface LiveYAxisConfig {
  /** Minimum pixel gap between labels. Default: 36. */
  minGap?: number;
  /** Position. Default: "left" (only "left" implemented, matching the
      registry demo/bench scenario — same pilot-scope carve-out as <YAxis>). */
  position?: "left" | "right";
  formatValue?: (v: number) => string;
  /** Allow decimal tick values. Default: true. */
  allowDecimals?: boolean;
}

export interface ExtractedChildren {
  lines: LineConfig[];
  /** <Area> children (area-chart.tsx pilot). */
  areas: AreaConfig[];
  /** <Scatter> children (scatter-chart.tsx pilot). */
  scatters: ScatterConfig[];
  /** <Bar> children (bar-chart.tsx pilot). */
  bars: BarConfig[];
  /** <SeriesBar> children (composed-chart.tsx pilot). Order-independent
      collection only — ComposedChart does its own dedicated ordered
      extraction and never reads this field. */
  seriesBars: SeriesBarConfig[];
  grid: GridConfig | null;
  xAxis: XAxisConfig | null;
  /** <BarXAxis> child (bar-chart.tsx pilot — distinct from <XAxis>, which
      Line/Scatter use). */
  barXAxis: BarXAxisConfig | null;
  tooltip: ChartTooltipConfig | null;
  /** <Candlestick> child (candlestick-chart.tsx pilot). */
  candlestick: CandlestickConfig | null;
  /** <YAxis> child (candlestick-chart.tsx pilot). */
  yAxis: YAxisConfig | null;
}
