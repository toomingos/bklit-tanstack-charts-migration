import type { ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import type { PatternPresetId, PatternPresetOptions } from "./pattern-preset";

type ChartDatum = Record<string, unknown>;

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

interface PatternAreaConfig {
  readonly dataKey: string;
  readonly patternPreset?: PatternPresetId;
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
  readonly ringGap?: number;
  readonly radius?: number;
  // Overrides fill; ring follows unless stroke is set.
  readonly yGradient?: boolean | { from?: string; to?: string };
  readonly fadeOnHover?: boolean;
  readonly inactiveOpacity?: number;
  readonly inactiveBlur?: number;
  readonly enterBlur?: number;
  readonly showActiveHighlight?: boolean;
  readonly outlineWidth?: number;
  readonly outlineColor?: string;
}

interface GridConfig {
  readonly horizontal?: boolean;
  readonly vertical?: boolean;
  stroke?: string;
  readonly strokeOpacity?: number;
  strokeWidth?: number;
  readonly numTicks?: number;
  readonly numTicksRows?: number;
  readonly numTicksColumns?: number;
  readonly rowTickValues?: readonly number[];
  readonly loadingStroke?: string;
  readonly strokeDasharray?: string;
  readonly highlightRowValues?: readonly number[];
  readonly highlightRowStroke?: string;
  readonly highlightRowStrokeOpacity?: number;
  readonly highlightRowStrokeWidth?: number;
  readonly highlightRowStrokeDasharray?: string;
  readonly fadeHorizontal?: boolean;
  readonly fadeVertical?: boolean;
  readonly hideHorizontalEdgeLines?: boolean;
  readonly hideVerticalEdgeLines?: boolean;
  yAxisId?: string | number;
  readonly shimmer?: boolean;
  readonly shimmerStroke?: string;
  readonly shimmerLength?: number;
  readonly shimmerSpeed?: number;
  readonly shimmerSync?: boolean;
}

interface XAxisConfig {
  readonly numTicks?: number;
  readonly tickerHalfWidth?: number;
  readonly tickMode?: "domain" | "data";
  readonly formatValue?: (value: Readonly<Date>) => string;
}

interface GradientStop {
  readonly offset: number;
  readonly color: string;
}

interface BarConfig {
  readonly dataKey: string;
  yAxisId?: string | number;
  readonly fill?: string;
  stroke?: string;
  // "round" derives radius from bandwidth (cap 8); "butt" is 0; number is explicit px.
  readonly lineCap?: "round" | "butt" | number;
  readonly fadedOpacity?: number;
}

interface BarSquaresConfig {
  readonly dataKey: string;
  yAxisId?: string | number;
  readonly fill?: string;
  stroke?: string;
  readonly squareGap?: number;
  readonly squareRadius?: number;
  readonly squareFit?: boolean;
  readonly useGradient?: boolean;
  readonly gradientStops?: readonly GradientStop[];
  readonly patternPreset?: PatternPresetId;
  readonly animate?: boolean;
  readonly fadedOpacity?: number;
  readonly staggerDelay?: number;
  readonly groupGap?: number;
}

interface BarColumnTrackConfig {
  readonly fill?: string;
  readonly opacity?: number;
  readonly squareGap?: number;
  readonly squareRadius?: number;
  readonly groupGap?: number;
  readonly squareFit?: boolean;
  readonly staggerDelay?: number;
}

interface BarDepthBackConfig {
  readonly dataKey: string;
  readonly color?: string;
  readonly colorAccessor?: (datum: Readonly<ChartDatum>, index: number) => string;
}

interface BarDepthFrontConfig {
  readonly dataKey: string;
}

interface BarPulseConfig {
  readonly dataKey: string;
  readonly activeIndex?: number;
  readonly pulsePaused?: boolean;
}

interface BarDepthProviderConfig {
  readonly segmentsAccessor?: (datum: Readonly<ChartDatum>) => { value: number; color: string }[] | null | undefined;
  readonly groundShadow?: number;
  readonly minBarHeight?: number;
}

// Not an alias of BarDepthProviderConfig: adds required children.
interface BarDepthProviderProps extends BarDepthProviderConfig {
  readonly children: ReactNode;
}

// No yAxisId: bklit SeriesBar has none; radius defaults to 0, unlike standalone Bar.
interface SeriesBarConfig {
  readonly dataKey: string;
  readonly fill?: string;
  stroke?: string;
  readonly radius?: number;
  readonly fadedOpacity?: number;
  readonly animate?: boolean;
}

interface BarXAxisConfig {
  readonly tickerHalfWidth?: number;
  readonly showAllLabels?: boolean;
  readonly maxLabels?: number;
}

interface BarYAxisProps {
  readonly showAllLabels?: boolean;
  readonly maxLabels?: number;
}

type BackgroundPatternOptions = PatternPresetOptions;

interface BackgroundConfig extends BackgroundPatternOptions {
  readonly pattern?: PatternPresetId;
  readonly color?: string;
  readonly showFill?: boolean;
  readonly opacity?: number;
  readonly fadeHorizontal?: boolean;
  readonly fadeVertical?: boolean;
  readonly fadeHorizontalLength?: number;
  readonly fadeVerticalLength?: number;
}

interface MomentumColors {
  readonly up: string;
  readonly down: string;
  readonly flat: string;
}

interface LiveLineConfig {
  readonly dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  readonly curve?: CurveFactory;
  readonly fill?: boolean;
  readonly pulse?: boolean;
  readonly dotSize?: number;
  readonly badge?: boolean;
  readonly formatValue?: (value: number) => string;
  // Dot always recolors by momentum, even when this is unset.
  readonly momentumColors?: MomentumColors;
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
