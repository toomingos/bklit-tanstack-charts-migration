import type { CurveFactory } from "d3-shape";

type FadeEdges = boolean | "left" | "right";

interface SeriesPointMarkerStyle {
  readonly fill?: string;
  stroke?: string;
  strokeWidth?: number;
  readonly ringGap?: number;
  readonly outlineWidth?: number;
  readonly outlineColor?: string;
  readonly radius?: number;
  readonly fadeOnHover?: boolean;
  readonly inactiveOpacity?: number;
  readonly inactiveBlur?: number;
  readonly enterBlur?: number;
  readonly showActiveHighlight?: boolean;
}

interface AreaConfig {
  readonly dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  readonly fill?: string;
  readonly fillOpacity?: number;
  readonly curve?: CurveFactory;
  yAxisId?: string | number;
  readonly showLine?: boolean;
  readonly gradientToOpacity?: number;
  readonly gradientSpan?: number;
  readonly fadeEdges?: boolean | "left" | "right";
  readonly showMarkers?: boolean;
  readonly markers?: SeriesPointMarkerStyle;
  showHighlight?: boolean;
  readonly dashFromIndex?: number;
  readonly dashArray?: string;
}

interface BarConfig {
  readonly dataKey: string;
  yAxisId?: string | number;
  readonly fill?: string;
  stroke?: string;
  readonly lineCap?: "round" | "butt" | number;
  readonly fadedOpacity?: number;
}

interface BarXAxisConfig {
  readonly tickerHalfWidth?: number;
  readonly showAllLabels?: boolean;
  readonly maxLabels?: number;
}

interface CandlestickConfig {
  readonly animate?: boolean;
  readonly positiveFill?: string;
  readonly negativeFill?: string;
  readonly bodyPatternPositive?: string;
  readonly bodyPatternNegative?: string;
  readonly insideStrokeWidth?: number;
  readonly fadedOpacity?: number;
  readonly showHoverFade?: boolean;
}

interface GridConfig {
  readonly horizontal?: boolean;
  readonly vertical?: boolean;
  stroke?: string;
  readonly strokeOpacity?: number;
  strokeWidth?: number;
  readonly numTicks?: number;
  yAxisId?: string | number;
}

interface LineConfig {
  readonly dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  readonly curve?: CurveFactory;
  yAxisId?: string | number;
  readonly fadeEdges?: FadeEdges;
  showHighlight?: boolean;
  readonly showMarkers?: boolean;
  readonly markers?: SeriesPointMarkerStyle;
  readonly dashFromIndex?: number;
  readonly dashArray?: string;
  readonly loadingStroke?: string;
  readonly loadingStrokeOpacity?: number;
  readonly animate?: boolean;
}

interface LiveLineConfig {
  readonly dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  readonly curve?: CurveFactory;
  readonly fill?: boolean;
  readonly pulse?: boolean;
  readonly dotSize?: number;
}

interface LiveXAxisConfig {
  readonly numTicks?: number;
  readonly formatTime?: (time: number) => string;
}

interface LiveYAxisConfig {
  readonly minGap?: number;
  readonly position?: "left" | "right";
  readonly formatValue?: (value: number) => string;
  readonly allowDecimals?: boolean;
}

interface PatternAreaConfig {
  readonly dataKey: string;
  readonly patternPreset?: string;
  readonly patternColor?: string;
  readonly fill?: string;
  readonly curve?: CurveFactory;
}

interface ScatterConfig {
  readonly dataKey: string;
  yAxisId?: string | number;
  readonly animate?: boolean;
  readonly fill?: string;
  stroke?: string;
  strokeWidth?: number;
  readonly radius?: number;
}

interface SeriesBarConfig {
  readonly dataKey: string;
  readonly fill?: string;
  stroke?: string;
  readonly radius?: number;
  readonly fadedOpacity?: number;
  readonly animate?: boolean;
}

interface XAxisConfig {
  readonly numTicks?: number;
  readonly tickerHalfWidth?: number;
  readonly tickMode?: "domain" | "data";
  readonly formatValue?: (value: Readonly<Date>) => string;
}

interface YAxisConfig {
  yAxisId?: string | number;
  readonly orientation?: "left" | "right";
  readonly numTicks?: number;
  readonly formatLargeNumbers?: boolean;
  readonly formatValue?: (value: number) => string;
}

type AreaProps = AreaConfig;
type BarProps = BarConfig;
type BarXAxisProps = BarXAxisConfig;
type CandlestickProps = CandlestickConfig;
type GridProps = GridConfig;
type LineProps = LineConfig;
type LiveLineProps = LiveLineConfig;
type LiveXAxisProps = LiveXAxisConfig;
type LiveYAxisProps = LiveYAxisConfig;
type PatternAreaProps = PatternAreaConfig;
type ProjectionStrokeStyle = "solid" | "gradient";
type ScatterProps = ScatterConfig;
type SeriesBarProps = SeriesBarConfig;
type XAxisProps = XAxisConfig;
type YAxisProps = YAxisConfig;

export type {
  AreaProps,
  BarProps,
  BarXAxisProps,
  CandlestickProps,
  GridProps,
  LineProps,
  LiveLineProps,
  LiveXAxisProps,
  LiveYAxisProps,
  PatternAreaProps,
  ProjectionStrokeStyle,
  ScatterProps,
  SeriesBarProps,
  XAxisProps,
  YAxisProps,
};
