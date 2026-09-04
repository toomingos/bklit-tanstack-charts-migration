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
  ChartDatum as ChartDatumType,
  FadeEdges as FadeEdgesType,
  GridConfig as GridConfigType,
  LineConfig as LineConfigType,
  PatternAreaConfig as PatternAreaConfigType,
  ScatterConfig as ScatterConfigType,
  SeriesBarConfig as SeriesBarConfigType,
  SeriesPointMarkerStyle as SeriesPointMarkerStyleType,
  XAxisConfig as XAxisConfigType,
} from "./series-config-types";

interface ChartTooltipPoint extends ChartDatumType {
  readonly date?: Readonly<Date>;
}

type DotVariant = "dot" | "ring";
type IndicatorWidth = number | "line" | "thin" | "medium" | "thick";

interface TooltipRow {
  readonly color: string;
  readonly label: string;
  readonly value: string | number;
}

interface ChartTooltipConfig {
  readonly enabled?: boolean;
  readonly showDatePill?: boolean;
  readonly showCrosshair?: boolean;
  readonly showDots?: boolean;
  readonly dotVariant?: DotVariant;
  readonly dotSize?: number;
  readonly dotRadiusFraction?: number;
  readonly dotScale?: number;
  readonly dotStrokeWidth?: number;
  readonly dotColor?: string | ((point: Readonly<ChartDatumType>, line: { readonly dataKey: string; readonly stroke?: string }) => string);
  readonly indicatorColor?: string | ((point: Readonly<ChartDatumType>) => string);
  readonly rows?: (point: Readonly<ChartDatumType>) => TooltipRow[];
  readonly content?: (props: { readonly point: Readonly<ChartTooltipPoint>; readonly index: number }) => ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly springConfig?: { stiffness: number; damping: number };
  readonly matchCrosshair?: boolean;
  readonly damping?: number;
  readonly boxSpringConfig?: { stiffness: number; damping: number };
  readonly indicatorDasharray?: string;
  readonly indicatorFadeEdges?: IndicatorFadeEdges;
  readonly indicatorFadeLength?: number;
  readonly panelStyle?: React.CSSProperties;
  readonly backgroundColor?: string;
  readonly indicatorWidth?: IndicatorWidth;
  readonly indicatorSpan?: number;
  readonly columnWidth?: number;
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

interface YAxisConfig {
  yAxisId?: string | number;
  readonly orientation?: "left" | "right";
  readonly numTicks?: number;
  readonly formatLargeNumbers?: boolean;
  readonly formatValue?: (value: number) => string;
}

interface ProjectionLineChildConfig {
  readonly data: readonly ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  readonly strokeStyle?: "solid" | "gradient";
  readonly gradientStart?: string;
  readonly gradientEnd?: string;
  strokeWidth?: number;
  readonly curveKind?: "linear" | "bezier";
  readonly curve?: CurveFactory;
  readonly strokeDasharray?: string;
  readonly strokeOpacity?: number;
  readonly showEndMarker?: boolean;
  readonly showEndpoints?: boolean;
  readonly endpointRadius?: number;
  readonly className?: string;
}

interface ProjectionLineEndMarkerChildConfig {
  readonly data: readonly ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  readonly strokeOpacity?: number;
  readonly radius?: number;
}

type TerminalMarkerChildConfig = {
  dataKey: string;
  yAxisId?: string | number;
} & SeriesPointMarkerStyleType;

interface ProfitLossLineChildConfig {
  readonly dataKey: string;
  readonly xDataKey?: string;
  strokeWidth?: number;
  readonly positiveColor?: string;
  readonly negativeColor?: string;
  readonly curve?: CurveFactory;
  readonly fadeEdges?: FadeEdgesType;
}

interface ChartMarker {
  readonly date: Date;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly content?: React.ReactNode;
  readonly color?: string;
  readonly onClick?: () => void;
  readonly href?: string;
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
  readonly lines: LineConfigType[];
  readonly areas: AreaConfigType[];
  readonly patternAreas: PatternAreaConfigType[];
  readonly scatters: ScatterConfigType[];
  readonly bars: BarConfigType[];
  readonly barSquares: BarSquaresConfigType[];
  readonly barColumnTracks: BarColumnTrackConfigType[];
  readonly barDepthBacks: BarDepthBackConfigType[];
  readonly barDepthFronts: BarDepthFrontConfigType[];
  readonly barPulses: BarPulseConfigType[];
  barDepthProvider: BarDepthProviderConfigType | null;
  readonly seriesBars: SeriesBarConfigType[];
  grid: GridConfigType | null;
  xAxis: XAxisConfigType | null;
  barXAxis: BarXAxisConfigType | null;
  background: BackgroundConfigType | null;
  tooltip: ChartTooltipConfig | null;
  candlestick: CandlestickConfig | null;
  yAxis: YAxisConfig | null;
  readonly projectionLines: ProjectionLineChildConfig[];
  readonly projectionEndMarkers: ProjectionLineEndMarkerChildConfig[];
  readonly terminalMarkers: TerminalMarkerChildConfig[];
  readonly profitLossLines: ProfitLossLineChildConfig[];
  chartMarkers: ChartMarkersConfig | null;
  readonly brushes: BrushChildConfig[];
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
