import type { ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import type { IndicatorFadeEdges } from "./fade-mask";

/** Row shape accepted by the cartesian charts (bklit contract). */
export type ChartDatum = Record<string, unknown>;

export type { ChartStatus, ChartPhase } from "./chart-phase";
export {
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  resolveRestingChartPhase,
  isChartInteractionPhase,
  DEFAULT_CHART_LIFECYCLE,
} from "./chart-phase";

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
  /** bklit area.tsx: render the boundary stroke above the fill. Default:
      true. `false` hides the stroke (and its dash tail + hover highlight
      band) while keeping the fill, hover dim, and markers. */
  showLine?: boolean;
  /** bklit area.tsx: gradient opacity at the bottom stop (0 = fully
      transparent). Default: 0. */
  gradientToOpacity?: number;
  /** bklit area.tsx: vertical extent of the fill gradient, 0–1. 1 fades
      across the full height; lower values compress the gradient toward the
      top. Clamped to [0.01, 1]. Default: 1. */
  gradientSpan?: number;
  /** bklit area.tsx: fade the fill+stroke out at the plot edges. Default:
      false (differs from Line's default true). `true` fades both edges;
      `"left"` / `"right"` fade only that side. */
  fadeEdges?: boolean | "left" | "right";
  /** Render scatter-style circle markers at each data point. Default: false. */
  showMarkers?: boolean;
  /** Marker styling (same options as Scatter). */
  markers?: SeriesPointMarkerStyle;
  /** bklit area.tsx: hover dim (to 0.6, not Line's 0.3) + highlight band on
      the boundary line. Default: true. */
  showHighlight?: boolean;
  /** Data index from which the boundary line stroke becomes dashed. */
  dashFromIndex?: number;
  /** Dash pattern for the tail segment. Default: "6,4". */
  dashArray?: string;
}

/** Config carried by a <PatternArea> child (bklit pattern-area.tsx, migrated
     convenience shape per plan §10 ruling 1: patternPreset + patternColor
     forwarded to internal/pattern-preset.tsx's renderPatternPreset, with a
     raw fill escape hatch). */
export interface PatternAreaConfig {
  dataKey: string;
  patternPreset?: import("./pattern-preset").PatternPresetId;
  patternColor?: string;
  fill?: string;
  curve?: CurveFactory;
}

/** Config carried by a <Scatter> child (bklit Scatter prop contract, pilot
    subset — series-markers.tsx / scatter.tsx defaults). */
export interface ScatterConfig {
  dataKey: string;
  /** P6.1 / S6 — bklit `scatter.tsx`. Y-scale group id. Default: `"left"`. */
  yAxisId?: string | number;
  /** P5.5 S7 — bklit `scatter.tsx:11` / `series-markers.tsx:104`
      (`isRevealing = animate && !isLoaded`). When false the series skips the
      staggered enter fade and paints straight at full opacity. Default: true. */
  animate?: boolean;
  fill?: string;
  stroke?: string;
  /** Ring stroke width. Default: 2. */
  strokeWidth?: number;
  /** Gap between fill circle and ring. Default: 2. */
  ringGap?: number;
  /** Fill circle radius. Default: 5. */
  radius?: number;
  /** bklit scatter.tsx yGradient: color each dot by its vertical position
      using a chart-space linear gradient (lower values `from`, higher `to`).
      Takes precedence over `fill`; the ring follows too unless `stroke` is
      set. Default stops: red (bottom) → green (top). */
  yGradient?: boolean | { from?: string; to?: string };
  /** Dim non-active points while hovering. Default: true. */
  fadeOnHover?: boolean;
  /** Opacity for dimmed points while hovering. Default: 0.5. */
  inactiveOpacity?: number;
  /** Blur in px for dimmed points while hovering. Default: 2. */
  inactiveBlur?: number;
  /** Initial blur in px during the enter reveal. Default: 2. */
  enterBlur?: number;
  /** Enlarge the hovered point. Default: true. */
  showActiveHighlight?: boolean;
  /** Optional outline circle beyond the ring (hover-highlight copy).
      Default: 0 (off). */
  outlineWidth?: number;
  /** Outline color. Default: same as `stroke`. */
  outlineColor?: string;
}

/** Config carried by a <Grid> child (bklit grid.tsx GridProps surface).
    Pilot fields `horizontal`/`vertical`/`stroke`/`strokeOpacity`/`strokeWidth`/
    `numTicks` are consumed by the single guides path (internal/grid.ts);
    the remaining bklit fields are carried for API parity and consumed by the
    same module as initiative-3 features land (highlight rows + shimmer). */
export interface GridConfig {
  /** Show horizontal grid lines. Default: true. */
  horizontal?: boolean;
  vertical?: boolean;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  /** Horizontal grid-line tick count. Accepts both bklit's name
      (`numTicksRows`) and the pilot rename (`numTicks`). Default: 5. */
  numTicks?: number;
  numTicksRows?: number;
  /** Vertical grid-line tick count (bklit `numTicksColumns`). Default: 10. */
  numTicksColumns?: number;
  /** Explicit tick values for horizontal grid lines. Overrides numTicks. */
  rowTickValues?: number[];
  /** Grid line stroke while loading chrome is active. Falls back to `stroke`. */
  loadingStroke?: string;
  /** Grid line dash array. Default: "4,4". */
  strokeDasharray?: string;
  /** Horizontal row values rendered with alternate styling (e.g. zero baseline). */
  highlightRowValues?: number[];
  /** Stroke for highlighted rows. Default: var(--chart-foreground-muted). */
  highlightRowStroke?: string;
  /** Stroke opacity for highlighted rows. Default: 1. */
  highlightRowStrokeOpacity?: number;
  /** Stroke width for highlighted rows. Default: 1. */
  highlightRowStrokeWidth?: number;
  /** Dash array for highlighted rows. Default: solid line. */
  highlightRowStrokeDasharray?: string;
  /** Enable horizontal fade effect on grid rows (fades at left/right). Default: true. */
  fadeHorizontal?: boolean;
  /** Enable vertical fade effect on grid columns (fades at top/bottom). Default: false. */
  fadeVertical?: boolean;
  /** Omit the first and last horizontal grid lines. Default: false. */
  hideHorizontalEdgeLines?: boolean;
  /** Omit the first and last vertical grid lines. Default: false. */
  hideVerticalEdgeLines?: boolean;
  /** Y-scale for horizontal grid lines. Default: primary ("left") axis. */
  yAxisId?: string | number;
  /** Animate a shimmer band across horizontal grid lines. Default: false. */
  shimmer?: boolean;
  /** Shimmer band stroke (color and opacity via color-mix or oklch alpha). */
  shimmerStroke?: string;
  /** Shimmer band width in pixels. Default: 140. */
  shimmerLength?: number;
  /** Shimmer speed multiplier (higher = faster). Default: 1. */
  shimmerSpeed?: number;
  /** Match loop timing to the loading line pulse (cycle + inter-loop pause). */
  shimmerSync?: boolean;
}

/** Config carried by an <XAxis> child (bklit x-axis.tsx surface). */
export interface XAxisConfig {
  numTicks?: number;
  /** Width of the date ticker box for the hover label-fade calculation
      (bklit `tickerHalfWidth`). Default: 50. */
  tickerHalfWidth?: number;
  /** `"data"` (default) — ticks snap to data rows so crosshair/tooltip stay
      aligned; `"domain"` — evenly spaced ticks across the time domain. */
  tickMode?: "domain" | "data";
  formatValue?: (value: Date) => string;
}

export interface GradientStop {
  offset: number;
  color: string;
}

/** Config carried by a <Bar> child (bklit bar.tsx BarProps, pilot subset —
    vertical grouped demo path only: no stacked/horizontal/perspective). */
export interface BarConfig {
  dataKey: string;
  /** P6.1 / B7 — bklit `bar.tsx:58`. Y-scale group id. Default: `"left"`. */
  yAxisId?: string | number;
  fill?: string;
  stroke?: string;
  /** "round" (default, bandwidth-derived radius capped at 8), "butt" (0), or
      an explicit corner radius in px. */
  lineCap?: "round" | "butt" | number;
  /** Opacity when a different category is hovered. Default: 0.3. */
  fadedOpacity?: number;
}

export interface BarSquaresConfig {
  dataKey: string;
  /** P6.1 / B10 — bklit `bar-squares.tsx:29`. Y-scale group id. Default: `"left"`. */
  yAxisId?: string | number;
  fill?: string;
  stroke?: string;
  squareGap?: number;
  squareRadius?: number;
  squareFit?: boolean;
  useGradient?: boolean;
  gradientStops?: GradientStop[];
  patternPreset?: import("./pattern-preset").PatternPresetId;
  animate?: boolean;
  fadedOpacity?: number;
  staggerDelay?: number;
  groupGap?: number;
}

export interface BarColumnTrackConfig {
  fill?: string;
  opacity?: number;
  squareGap?: number;
  squareRadius?: number;
  groupGap?: number;
  squareFit?: boolean;
  staggerDelay?: number;
}

export interface BarDepthBackConfig {
  dataKey: string;
  color?: string;
  colorAccessor?: (datum: Record<string, unknown>, index: number) => string;
}

export interface BarDepthFrontConfig {
  dataKey: string;
}

export interface BarPulseConfig {
  dataKey: string;
  activeIndex?: number;
  pulsePaused?: boolean;
}

export interface BarDepthProviderConfig {
  segmentsAccessor?: (datum: Record<string, unknown>) => { value: number; color: string }[] | null | undefined;
  groundShadow?: number;
  minBarHeight?: number;
}

/** Legacy `BarDepthProviderProps` (bar-depth.tsx:264) — `BarDepthContextValue`
    plus a REQUIRED `children`. Not an alias of `BarDepthProviderConfig`: that
    one has no `children` at all, so aliasing it would ship a structurally
    different type under a parity name (D326 §6). */
export interface BarDepthProviderProps extends BarDepthProviderConfig {
  children: ReactNode;
}

/** Config carried by a <SeriesBar> child (bklit series-bar.tsx SeriesBarProps,
    pilot subset — ComposedChart's bar series; grouping AND stacking
    (`stacked`/`stackGap` are ComposedChart-level props) are handled by
    composed-chart.tsx + internal/series-bar-mark.ts). */
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
  /** P5.5 C8 — bklit `series-bar.tsx:92,101`. When false the series skips the
      grow-from-baseline entrance and renders straight at final geometry
      (bklit gates its whole enter branch on `animate && !isLoaded`, :224).
      Default: true. */
  animate?: boolean;
  /** P6.1 C14 — deliberately NO `yAxisId` here: bklit's <SeriesBar> has no such
      prop, and its composed extractor omits it while Line/Area pass it. */
}

/** Config carried by a <BarXAxis> child (bklit bar-x-axis.tsx, pilot subset). */
export interface BarXAxisConfig {
  tickerHalfWidth?: number;
  showAllLabels?: boolean;
  maxLabels?: number;
}

/** DOC-9 (B13): bklit BarYAxisProps (bar-y-axis.tsx) — type surface only.
    Behavior ports together with bar orientation support (post-pilot); no
    role-carrier or host rendering exists yet. */
export interface BarYAxisProps {
  /** Whether to show all labels or skip some for dense data. Default: true */
  showAllLabels?: boolean;
  /** Maximum number of labels to show. Default: 20 */
  maxLabels?: number;
}

/** Config carried by a <Background> child (bklit background.tsx surface,
    minus the host-supplied geometry width/height/isLoaded). Plot-area
    pattern fill rendered behind grid/series (CH13).
    (Alias needed: TS2499 forbids `interface X extends import("…").Y`.) */
type BackgroundPatternOptions = import("./pattern-preset").PatternPresetOptions;

export interface BackgroundConfig extends BackgroundPatternOptions {
  /** Pattern preset. `"none"` renders nothing. Default: "diagonal". */
  pattern?: import("./pattern-preset").PatternPresetId;
  /** Pattern stroke color. Default: var(--chart-grid). */
  color?: string;
  /** Apply the pattern texture to the plot area. Default: true. */
  showFill?: boolean;
  /** Pattern fill opacity. Default: 1. */
  opacity?: number;
  /** Fade pattern at the left/right chart edges. Default: true. */
  fadeHorizontal?: boolean;
  /** Fade pattern at the top/bottom chart edges. Default: true. */
  fadeVertical?: boolean;
  /** Horizontal fade zone as % of plot width per edge. Default: 10. */
  fadeHorizontalLength?: number;
  /** Vertical fade zone as % of plot height per edge. Default: 10. */
  fadeVerticalLength?: number;
}

/** Point payload passed to a <ChartTooltip content> render prop (bklit
    chart-tooltip.tsx `TooltipRenderProps`: `{ point, index }`, `point` is the
    raw context-data row for the hovered/live position). */
export interface ChartTooltipPoint {
  date?: Date;
  [key: string]: unknown;
}

export type DotVariant = "dot" | "ring";
export type IndicatorWidth = number | "line" | "thin" | "medium" | "thick";

export interface TooltipRow {
  color: string;
  label: string;
  value: string | number;
}

/** Config carried by a <ChartTooltip> child — full bklit ChartTooltipProps parity (21 props). */
export interface ChartTooltipConfig {
  enabled?: boolean;
  showDatePill?: boolean;
  showCrosshair?: boolean;
  showDots?: boolean;
  dotVariant?: DotVariant;
  dotSize?: number;
  dotRadiusFraction?: number;
  dotScale?: number;
  dotStrokeWidth?: number;
  dotColor?: string | ((point: Record<string, unknown>, line: { dataKey: string; stroke?: string }) => string);
  indicatorColor?: string | ((point: Record<string, unknown>) => string);
  rows?: (point: Record<string, unknown>) => TooltipRow[];
  content?: (props: { point: ChartTooltipPoint; index: number }) => ReactNode;
  children?: ReactNode;
  className?: string;
  springConfig?: { stiffness: number; damping: number };
  matchCrosshair?: boolean;
  damping?: number;
  boxSpringConfig?: { stiffness: number; damping: number };
  indicatorDasharray?: string;
  indicatorFadeEdges?: IndicatorFadeEdges;
  indicatorFadeLength?: number;
  panelStyle?: React.CSSProperties;
  backgroundColor?: string;
  indicatorWidth?: IndicatorWidth;
  indicatorSpan?: number;
  columnWidth?: number;
}

/** Config carried by a <Candlestick> child (bklit candlestick.tsx
    CandlestickProps — gradient-default fills collapse to solid tokens per the
    pilot's Q1-gated K5-cluster ruling; legend pairing closed D223–D226). */
export interface CandlestickConfig {
  /** Gates the reveal: false renders candles statically (no scaleY/opacity
      reveal) while interaction still unlocks at the flat `animationDuration`
      deadline — bklit candlestick.tsx `animate && !isLoaded` parity. */
  animate?: boolean;
  /** bklit candlestick.tsx SOLID_POSITIVE default: var(--color-emerald-500). */
  positiveFill?: string;
  /** bklit candlestick.tsx SOLID_NEGATIVE default: var(--color-red-500). */
  negativeFill?: string;
  /** Pattern overlay on positive-candle bodies (K9): either a pattern-preset
      name (resolved to defs internally via internal/pattern-preset) or a raw
      legacy `url(#id)` passthrough. When set, body+wick fall back to the
      solid token colors and the pattern is overlaid on the body rect. */
  bodyPatternPositive?: string;
  /** Pattern overlay for negative-candle bodies (same resolution rules). */
  bodyPatternNegative?: string;
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
  /** Position. Default: "left" ("right" mirrors the tick layer into the
      right margin gutter with left-aligned labels, matching bklit
      live-y-axis.tsx). */
  position?: "left" | "right";
  formatValue?: (v: number) => string;
  /** Allow decimal tick values. Default: true. */
  allowDecimals?: boolean;
}

export type ProjectionLineChildConfig = {
  data: import("./projection-utils").ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  strokeStyle?: "solid" | "gradient";
  gradientStart?: string;
  gradientEnd?: string;
  strokeWidth?: number;
  curveKind?: "linear" | "bezier";
  curve?: CurveFactory;
  strokeDasharray?: string;
  strokeOpacity?: number;
  showEndMarker?: boolean;
  showEndpoints?: boolean;
  endpointRadius?: number;
  className?: string;
};

export type ProjectionLineEndMarkerChildConfig = {
  data: import("./projection-utils").ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  strokeOpacity?: number;
  radius?: number;
};

export type TerminalMarkerChildConfig = {
  dataKey: string;
  yAxisId?: string | number;
} & SeriesPointMarkerStyle;

export type ProfitLossLineChildConfig = {
  dataKey: string;
  xDataKey?: string;
  strokeWidth?: number;
  positiveColor?: string;
  negativeColor?: string;
  curve?: CurveFactory;
  fadeEdges?: boolean | "left" | "right";
};

export interface ChartMarker {
  date: Date;
  icon: React.ReactNode;
  title: string;
  description?: string;
  content?: React.ReactNode;
  color?: string;
  onClick?: () => void;
  href?: string;
  target?: "_blank" | "_self";
}

export interface ChartMarkersConfig {
  items: ChartMarker[];
  size?: number;
  showLines?: boolean;
  animate?: boolean;
  maxFanned?: number;
}

/** Brush children are kept as ELEMENTS, not extracted props: the host
     re-renders them inside its BrushHostContext provider (ChartBrush is a
     real rendering component — portal chrome — unlike the null-render
     config shims above). */
export type BrushChildConfig = ReactNode;

export interface ExtractedChildren {
  lines: LineConfig[];
  /** <Area> children (area-chart.tsx pilot). */
  areas: AreaConfig[];
  /** <PatternArea> children — pattern-filled closed areas (do not count as
       extra legend/tooltip series, share x/y scales with normal areas). */
  patternAreas: PatternAreaConfig[];
  /** <Scatter> children (scatter-chart.tsx pilot). */
  scatters: ScatterConfig[];
  /** <Bar> children (bar-chart.tsx pilot). */
  bars: BarConfig[];
  barSquares: BarSquaresConfig[];
  barColumnTracks: BarColumnTrackConfig[];
  barDepthBacks: BarDepthBackConfig[];
  barDepthFronts: BarDepthFrontConfig[];
  barPulses: BarPulseConfig[];
  barDepthProvider: BarDepthProviderConfig | null;
  /** <SeriesBar> children (composed-chart.tsx pilot). Order-independent
       collection only — ComposedChart does its own dedicated ordered
       extraction and never reads this field. */
  seriesBars: SeriesBarConfig[];
  grid: GridConfig | null;
  xAxis: XAxisConfig | null;
  /** <BarXAxis> child (bar-chart.tsx pilot — distinct from <XAxis>, which
       Line/Scatter use). */
  barXAxis: BarXAxisConfig | null;
  /** <Background> child (CH13 — bklit background.tsx plot-area pattern). */
  background: BackgroundConfig | null;
  tooltip: ChartTooltipConfig | null;
  /** <Candlestick> child (candlestick-chart.tsx pilot). */
  candlestick: CandlestickConfig | null;
  /** <YAxis> child (candlestick-chart.tsx pilot). */
  yAxis: YAxisConfig | null;
  projectionLines: ProjectionLineChildConfig[];
  projectionEndMarkers: ProjectionLineEndMarkerChildConfig[];
  terminalMarkers: TerminalMarkerChildConfig[];
  profitLossLines: ProfitLossLineChildConfig[];
  chartMarkers: ChartMarkersConfig | null;
  brushes: BrushChildConfig[];
}
