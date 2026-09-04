import type { ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import type { IndicatorFadeEdges } from "./fade-mask";
import type { ChartBrushProps } from "./chart-brush";
import type { ProjectionPoint } from "./projection-utils";
import type {
  AreaConfig as AreaConfigType,
  BackgroundConfig as BackgroundConfigType,
  BarColumnTrackConfig as BarColumnTrackConfigType,
  BarConfig as BarConfigType,
  BarDepthBackConfig as BarDepthBackConfigType,
  BarDepthFrontConfig as BarDepthFrontConfigType,
  BarDepthProviderConfig as BarDepthProviderConfigType,
  BarPulseConfig as BarPulseConfigType,
  BarSquaresConfig as BarSquaresConfigType,
  BarXAxisConfig as BarXAxisConfigType,
  FadeEdges as FadeEdgesType,
  GridConfig as GridConfigType,
  LineConfig as LineConfigType,
  PatternAreaConfig as PatternAreaConfigType,
  ScatterConfig as ScatterConfigType,
  SeriesBarConfig as SeriesBarConfigType,
  SeriesPointMarkerStyle as SeriesPointMarkerStyleType,
  XAxisConfig as XAxisConfigType,
} from "./series-config-types";

interface ChartTooltipPoint {
  readonly date?: Readonly<Date>;
  [key: string]: unknown;
}

type DotVariant = "dot" | "ring";
type IndicatorWidth = number | "line" | "thin" | "medium" | "thick";

interface TooltipRow {
  color: string;
  label: string;
  value: string | number;
}

interface ChartTooltipConfig {
  enabled?: boolean;
  showDatePill?: boolean;
  showCrosshair?: boolean;
  showDots?: boolean;
  dotVariant?: DotVariant;
  dotSize?: number;
  dotRadiusFraction?: number;
  dotScale?: number;
  dotStrokeWidth?: number;
  dotColor?: string | ((point: Readonly<Record<string, unknown>>, line: { readonly dataKey: string; readonly stroke?: string }) => string);
  indicatorColor?: string | ((point: Readonly<Record<string, unknown>>) => string);
  rows?: (point: Readonly<Record<string, unknown>>) => TooltipRow[];
  content?: (props: { readonly point: Readonly<ChartTooltipPoint>; readonly index: number }) => ReactNode;
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

interface CandlestickConfig {
  animate?: boolean;
  positiveFill?: string;
  negativeFill?: string;
  bodyPatternPositive?: string;
  bodyPatternNegative?: string;
  insideStrokeWidth?: number;
  fadedOpacity?: number;
  showHoverFade?: boolean;
}

interface YAxisConfig {
  yAxisId?: string | number;
  orientation?: "left" | "right";
  numTicks?: number;
  formatLargeNumbers?: boolean;
  formatValue?: (value: number) => string;
}

interface ProjectionLineChildConfig {
  data: ProjectionPoint[];
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
}

interface ProjectionLineEndMarkerChildConfig {
  data: ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  strokeOpacity?: number;
  radius?: number;
}

type TerminalMarkerChildConfig = {
  dataKey: string;
  yAxisId?: string | number;
} & SeriesPointMarkerStyleType;

interface ProfitLossLineChildConfig {
  dataKey: string;
  xDataKey?: string;
  strokeWidth?: number;
  positiveColor?: string;
  negativeColor?: string;
  curve?: CurveFactory;
  fadeEdges?: FadeEdgesType;
}

interface ChartMarker {
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

interface ChartMarkersConfig {
  readonly items: readonly Readonly<ChartMarker>[];
  readonly size?: number;
  readonly showLines?: boolean;
  readonly animate?: boolean;
  readonly maxFanned?: number;
}

// Import type only: dodges a value-import cycle (types->chart-brush->children->types).
type BrushChildConfig = ChartBrushProps;

interface ExtractedChildren {
  lines: LineConfigType[];
  areas: AreaConfigType[];
  patternAreas: PatternAreaConfigType[];
  scatters: ScatterConfigType[];
  bars: BarConfigType[];
  barSquares: BarSquaresConfigType[];
  barColumnTracks: BarColumnTrackConfigType[];
  barDepthBacks: BarDepthBackConfigType[];
  barDepthFronts: BarDepthFrontConfigType[];
  barPulses: BarPulseConfigType[];
  barDepthProvider: BarDepthProviderConfigType | null;
  seriesBars: SeriesBarConfigType[];
  grid: GridConfigType | null;
  xAxis: XAxisConfigType | null;
  barXAxis: BarXAxisConfigType | null;
  background: BackgroundConfigType | null;
  tooltip: ChartTooltipConfig | null;
  candlestick: CandlestickConfig | null;
  yAxis: YAxisConfig | null;
  projectionLines: ProjectionLineChildConfig[];
  projectionEndMarkers: ProjectionLineEndMarkerChildConfig[];
  terminalMarkers: TerminalMarkerChildConfig[];
  profitLossLines: ProfitLossLineChildConfig[];
  chartMarkers: ChartMarkersConfig | null;
  brushes: BrushChildConfig[];
}

export {
  DEFAULT_CHART_LIFECYCLE,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  isChartInteractionPhase,
  resolveRestingChartPhase,
} from "./chart-phase";
export type { ChartPhase, ChartStatus } from "./chart-phase";
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
} from "./series-config-types";

export type {
  BrushChildConfig,
  CandlestickConfig,
  ChartMarker,
  ChartMarkersConfig,
  ChartTooltipConfig,
  ChartTooltipPoint,
  DotVariant,
  ExtractedChildren,
  IndicatorWidth,
  ProfitLossLineChildConfig,
  ProjectionLineChildConfig,
  ProjectionLineEndMarkerChildConfig,
  TerminalMarkerChildConfig,
  TooltipRow,
  YAxisConfig,
};
