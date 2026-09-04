import type { ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import type { PatternPresetId, PatternPresetOptions } from "./pattern-preset";

type ChartDatum = Record<string, unknown>;

type FadeEdges = boolean | "left" | "right";

interface SeriesPointMarkerStyle {
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

interface LineConfig {
  dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  curve?: CurveFactory;
  yAxisId?: string | number;
  fadeEdges?: FadeEdges;
  showHighlight?: boolean;
  showMarkers?: boolean;
  markers?: SeriesPointMarkerStyle;
  dashFromIndex?: number;
  dashArray?: string;
  loadingStroke?: string;
  loadingStrokeOpacity?: number;
  animate?: boolean;
}

interface AreaConfig {
  dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
  curve?: CurveFactory;
  yAxisId?: string | number;
  showLine?: boolean;
  gradientToOpacity?: number;
  gradientSpan?: number;
  fadeEdges?: boolean | "left" | "right";
  showMarkers?: boolean;
  markers?: SeriesPointMarkerStyle;
  showHighlight?: boolean;
  dashFromIndex?: number;
  dashArray?: string;
}

interface PatternAreaConfig {
  dataKey: string;
  patternPreset?: PatternPresetId;
  patternColor?: string;
  fill?: string;
  curve?: CurveFactory;
}

interface ScatterConfig {
  dataKey: string;
  yAxisId?: string | number;
  animate?: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  ringGap?: number;
  radius?: number;
  // Overrides fill; ring follows unless stroke is set.
  yGradient?: boolean | { from?: string; to?: string };
  fadeOnHover?: boolean;
  inactiveOpacity?: number;
  inactiveBlur?: number;
  enterBlur?: number;
  showActiveHighlight?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
}

interface GridConfig {
  horizontal?: boolean;
  vertical?: boolean;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  numTicks?: number;
  numTicksRows?: number;
  numTicksColumns?: number;
  rowTickValues?: number[];
  loadingStroke?: string;
  strokeDasharray?: string;
  highlightRowValues?: number[];
  highlightRowStroke?: string;
  highlightRowStrokeOpacity?: number;
  highlightRowStrokeWidth?: number;
  highlightRowStrokeDasharray?: string;
  fadeHorizontal?: boolean;
  fadeVertical?: boolean;
  hideHorizontalEdgeLines?: boolean;
  hideVerticalEdgeLines?: boolean;
  yAxisId?: string | number;
  shimmer?: boolean;
  shimmerStroke?: string;
  shimmerLength?: number;
  shimmerSpeed?: number;
  shimmerSync?: boolean;
}

interface XAxisConfig {
  numTicks?: number;
  tickerHalfWidth?: number;
  tickMode?: "domain" | "data";
  formatValue?: (value: Readonly<Date>) => string;
}

interface GradientStop {
  offset: number;
  color: string;
}

interface BarConfig {
  dataKey: string;
  yAxisId?: string | number;
  fill?: string;
  stroke?: string;
  // "round" derives radius from bandwidth (cap 8); "butt" is 0; number is explicit px.
  lineCap?: "round" | "butt" | number;
  fadedOpacity?: number;
}

interface BarSquaresConfig {
  dataKey: string;
  yAxisId?: string | number;
  fill?: string;
  stroke?: string;
  squareGap?: number;
  squareRadius?: number;
  squareFit?: boolean;
  useGradient?: boolean;
  gradientStops?: GradientStop[];
  patternPreset?: PatternPresetId;
  animate?: boolean;
  fadedOpacity?: number;
  staggerDelay?: number;
  groupGap?: number;
}

interface BarColumnTrackConfig {
  fill?: string;
  opacity?: number;
  squareGap?: number;
  squareRadius?: number;
  groupGap?: number;
  squareFit?: boolean;
  staggerDelay?: number;
}

interface BarDepthBackConfig {
  dataKey: string;
  color?: string;
  colorAccessor?: (datum: Readonly<ChartDatum>, index: number) => string;
}

interface BarDepthFrontConfig {
  dataKey: string;
}

interface BarPulseConfig {
  dataKey: string;
  activeIndex?: number;
  pulsePaused?: boolean;
}

interface BarDepthProviderConfig {
  segmentsAccessor?: (datum: Readonly<ChartDatum>) => { value: number; color: string }[] | null | undefined;
  groundShadow?: number;
  minBarHeight?: number;
}

// Not an alias of BarDepthProviderConfig: adds required children.
interface BarDepthProviderProps extends BarDepthProviderConfig {
  children: ReactNode;
}

// No yAxisId: bklit SeriesBar has none; radius defaults to 0, unlike standalone Bar.
interface SeriesBarConfig {
  dataKey: string;
  fill?: string;
  stroke?: string;
  radius?: number;
  fadedOpacity?: number;
  animate?: boolean;
}

interface BarXAxisConfig {
  tickerHalfWidth?: number;
  showAllLabels?: boolean;
  maxLabels?: number;
}

interface BarYAxisProps {
  showAllLabels?: boolean;
  maxLabels?: number;
}

type BackgroundPatternOptions = PatternPresetOptions;

interface BackgroundConfig extends BackgroundPatternOptions {
  pattern?: PatternPresetId;
  color?: string;
  showFill?: boolean;
  opacity?: number;
  fadeHorizontal?: boolean;
  fadeVertical?: boolean;
  fadeHorizontalLength?: number;
  fadeVerticalLength?: number;
}

interface MomentumColors {
  up: string;
  down: string;
  flat: string;
}

interface LiveLineConfig {
  dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  curve?: CurveFactory;
  fill?: boolean;
  pulse?: boolean;
  dotSize?: number;
  badge?: boolean;
  formatValue?: (value: number) => string;
  // Dot always recolors by momentum, even when this is unset.
  momentumColors?: MomentumColors;
}

interface LiveXAxisConfig {
  numTicks?: number;
  formatTime?: (time: number) => string;
}

interface LiveYAxisConfig {
  minGap?: number;
  position?: "left" | "right";
  formatValue?: (value: number) => string;
  allowDecimals?: boolean;
}

export type {
  AreaConfig,
  BackgroundConfig,
  BackgroundPatternOptions,
  BarColumnTrackConfig,
  BarConfig,
  BarDepthBackConfig,
  BarDepthFrontConfig,
  BarDepthProviderConfig,
  BarDepthProviderProps,
  BarPulseConfig,
  BarSquaresConfig,
  BarXAxisConfig,
  BarYAxisProps,
  ChartDatum,
  FadeEdges,
  GradientStop,
  GridConfig,
  LineConfig,
  LiveLineConfig,
  LiveXAxisConfig,
  LiveYAxisConfig,
  MomentumColors,
  PatternAreaConfig,
  ScatterConfig,
  SeriesBarConfig,
  SeriesPointMarkerStyle,
  XAxisConfig,
};
