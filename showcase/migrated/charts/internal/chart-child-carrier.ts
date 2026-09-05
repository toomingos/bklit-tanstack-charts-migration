// Config-carrier child shared definitions: marker symbol, carrier component type,
// And the readonly prop aliases the carrier children are declared with.
import type { CurveFactory } from "d3-shape";
import type { ElementType, ReactNode } from "react";
import type {
  AreaConfig,
  BackgroundConfig,
  BarColumnTrackConfig,
  BarConfig,
  BarDepthBackConfig,
  BarDepthFrontConfig,
  BarDepthProviderConfig,
  BarPulseConfig,
  BarSquaresConfig,
  BarXAxisConfig,
  BrushChildConfig,
  CandlestickConfig,
  ChartMarker,
  ChartTooltipConfig,
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
  YAxisConfig,
} from "./types";
import type { ProjectionPoint } from "./projection-utils";

const CHART_ROLE = Symbol.for("migrated.chartRole");

/**
 * Config-carrier component: a null-rendering function with marker properties
 * attached after creation. Declaring the markers on the component type keeps
 * every attachment site assertion-free; the runtime shape is unchanged.
 */
interface ChartChildComponent<ComponentProps> {
  (props: ComponentProps): null;
  [CHART_ROLE]?: string;
  isBarDepthLayer?: boolean;
  displayName?: string;
}

/*
 * Shallow `Readonly` leaves nested fields mutable, so configs wrap nested fields explicitly here.
 * ReactNode carriers have no deeply-readonly spelling and stay reported residuals.
 */
type ReadonlyLineConfig = Readonly<Omit<LineConfig, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};

type ReadonlyAreaConfig = Readonly<Omit<AreaConfig, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};

type ReadonlyScatterConfig = Readonly<Omit<ScatterConfig, "yGradient">> & {
  readonly yGradient?: boolean | Readonly<{ from?: string; to?: string }>;
};

type ReadonlyBarSquaresConfig = Readonly<Omit<BarSquaresConfig, "gradientStops">> & {
  readonly gradientStops?: readonly Readonly<GradientStop>[];
};

type ReadonlyGridConfig = Readonly<Omit<GridConfig, "rowTickValues" | "highlightRowValues">> & {
  readonly rowTickValues?: readonly number[];
  readonly highlightRowValues?: readonly number[];
};

type ReadonlyLiveLineConfig = Readonly<Omit<LiveLineConfig, "momentumColors">> & {
  readonly momentumColors?: Readonly<MomentumColors>;
};

// Nested `Date` still flags where top-level `Readonly<Date>` is accepted, so it is spelled explicitly.
type ReadonlyProjectionPoint = Readonly<Omit<ProjectionPoint, "date">> & {
  readonly date: Readonly<Date>;
};

type ReadonlyProjectionLineProps = Readonly<Omit<ProjectionLineProps, "data">> & {
  readonly data: readonly ReadonlyProjectionPoint[];
};

type ReadonlyProjectionLineEndMarkerProps = Readonly<Omit<ProjectionLineEndMarkerProps, "data">> & {
  readonly data: readonly ReadonlyProjectionPoint[];
};

interface ProjectionLineProps {
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
  /** @deprecated Use showEndMarker. */
  readonly showEndpoints?: boolean;
  readonly endpointRadius?: number;
  readonly className?: string;
}

interface ProjectionLineEndMarkerProps {
  readonly data: readonly ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  readonly strokeOpacity?: number;
  readonly radius?: number;
}

interface LineSeriesTerminalMarkerProps extends SeriesPointMarkerStyle {
  readonly dataKey: string;
  yAxisId?: string | number;
}

interface ProfitLossLineProps {
  readonly dataKey: string;
  readonly xDataKey?: string;
  strokeWidth?: number;
  readonly positiveColor?: string;
  readonly negativeColor?: string;
  readonly curve?: CurveFactory;
  readonly fadeEdges?: boolean | "left" | "right";
}

interface ChartMarkersChildProps {
  readonly items: readonly Readonly<ChartMarker>[];
  readonly size?: number;
  readonly showLines?: boolean;
  readonly animate?: boolean;
  readonly maxFanned?: number;
}

// R5 detection: marker, memo shell, legacy name fallback.
type ChartElementType = Exclude<ElementType, string>;

const isChartElementType = (candidate: unknown): candidate is ChartElementType =>
  candidate instanceof Object;

// String check without typeof: boxing reaches .constructor on primitives.
const isStringValue = (value: unknown): value is string => {
  if (value === null || value === undefined || value instanceof Object) {
    return false;
  }
  return value.constructor === String;
};

const markerOf = (candidate: ChartElementType): string | undefined => {
  if (!(CHART_ROLE in candidate)) {
    return undefined;
  }
  const marker: unknown = candidate[CHART_ROLE];
  if (!isStringValue(marker) || marker === "") {
    return undefined;
  }
  return marker;
};

const displayNameOf = (candidate: ChartElementType): string | undefined => {
  if (!("displayName" in candidate)) {
    return undefined;
  }
  const labeled: unknown = candidate.displayName;
  if (!isStringValue(labeled) || labeled === "") {
    return undefined;
  }
  return labeled;
};

const componentNameOf = (candidate: ChartElementType): string | undefined => {
  if (!("name" in candidate)) {
    return undefined;
  }
  const named: unknown = candidate.name;
  if (!isStringValue(named) || named === "") {
    return undefined;
  }
  return named;
};

// PascalCase legacy names ("Area", "XAxis") match their lowercase roles.
const fallbackRoleOf = (candidate: ChartElementType): string | undefined => {
  const raw = displayNameOf(candidate) ?? componentNameOf(candidate);
  if (raw === undefined || raw === "") {
    return undefined;
  }
  return raw.slice(0, 1).toLowerCase() + raw.slice(1);
};

const roleOf = (candidate: unknown): string | undefined => {
  if (!isChartElementType(candidate)) {
    return undefined;
  }
  const direct = markerOf(candidate);
  if (direct !== undefined) {
    return direct;
  }
  if ("type" in candidate) {
    const inner: unknown = candidate.type;
    if (inner !== candidate) {
      const unwrapped = roleOf(inner);
      if (unwrapped !== undefined) {
        return unwrapped;
      }
    }
  }
  if ("render" in candidate) {
    const inner: unknown = candidate.render;
    if (inner !== candidate) {
      const unwrapped = roleOf(inner);
      if (unwrapped !== undefined) {
        return unwrapped;
      }
    }
  }
  return fallbackRoleOf(candidate);
};

// Radar slot props live here so the role union below stays cycle-free.
interface RadarAreaProps {
  readonly index: number;
  readonly color?: string;
  readonly showPoints?: boolean;
  readonly showStroke?: boolean;
  readonly showGlow?: boolean;
  readonly className?: string;
}

interface RadarAxisProps {
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly className?: string;
}

interface RadarGridProps {
  readonly showLabels?: boolean;
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly className?: string;
}

interface RadarLabelsProps {
  readonly offset?: number;
  readonly fontSize?: number;
  readonly interactive?: boolean;
  readonly className?: string;
}

// Closed role contract: every registry entry pairs one role with its props.
interface RolePropsMap {
  readonly area: AreaConfig;
  readonly background: BackgroundConfig;
  readonly bar: BarConfig;
  readonly barColumnTrack: BarColumnTrackConfig;
  readonly barDepthBack: BarDepthBackConfig;
  readonly barDepthFront: BarDepthFrontConfig;
  readonly barDepthProvider: BarDepthProviderConfig & { children?: ReactNode };
  readonly barPulse: BarPulseConfig;
  readonly barSquares: BarSquaresConfig;
  readonly barXAxis: BarXAxisConfig;
  readonly brush: BrushChildConfig;
  readonly candlestick: CandlestickConfig;
  readonly chartMarkers: ChartMarkersChildProps;
  readonly grid: GridConfig;
  readonly line: LineConfig;
  readonly liveLine: LiveLineConfig;
  readonly liveXAxis: LiveXAxisConfig;
  readonly liveYAxis: LiveYAxisConfig;
  readonly patternArea: PatternAreaConfig;
  readonly profitLossLine: ProfitLossLineProps;
  readonly projectionEndMarker: ProjectionLineEndMarkerProps;
  readonly projectionLine: ProjectionLineProps;
  readonly "radar-area": RadarAreaProps;
  readonly "radar-axis": RadarAxisProps;
  readonly "radar-grid": RadarGridProps;
  readonly "radar-labels": RadarLabelsProps;
  readonly scatter: ScatterConfig;
  readonly seriesBar: SeriesBarConfig;
  readonly terminalMarker: LineSeriesTerminalMarkerProps;
  readonly tooltip: ChartTooltipConfig;
  readonly xAxis: XAxisConfig;
  readonly yAxis: YAxisConfig;
}

type AnyChildProps = RolePropsMap[keyof RolePropsMap];

// Role-checked props guards: the role is the discriminant, so no assertion.
const ChildPropGuards = {
  area: (role: string, props: AnyChildProps): props is AreaConfig =>
    role === "area" && props instanceof Object,
  background: (role: string, props: AnyChildProps): props is BackgroundConfig =>
    role === "background" && props instanceof Object,
  bar: (role: string, props: AnyChildProps): props is BarConfig =>
    role === "bar" && props instanceof Object,
  barColumnTrack: (role: string, props: AnyChildProps): props is BarColumnTrackConfig =>
    role === "barColumnTrack" && props instanceof Object,
  barDepthBack: (role: string, props: AnyChildProps): props is BarDepthBackConfig =>
    role === "barDepthBack" && props instanceof Object,
  barDepthFront: (role: string, props: AnyChildProps): props is BarDepthFrontConfig =>
    role === "barDepthFront" && props instanceof Object,
  barDepthProvider: (
    role: string,
    props: AnyChildProps,
  ): props is BarDepthProviderConfig & { children?: ReactNode } =>
    role === "barDepthProvider" && props instanceof Object,
  barPulse: (role: string, props: AnyChildProps): props is BarPulseConfig =>
    role === "barPulse" && props instanceof Object,
  barSquares: (role: string, props: AnyChildProps): props is BarSquaresConfig =>
    role === "barSquares" && props instanceof Object,
  barXAxis: (role: string, props: AnyChildProps): props is BarXAxisConfig =>
    role === "barXAxis" && props instanceof Object,
  brush: (role: string, props: AnyChildProps): props is BrushChildConfig =>
    role === "brush" && props instanceof Object,
  candlestick: (role: string, props: AnyChildProps): props is CandlestickConfig =>
    role === "candlestick" && props instanceof Object,
  chartMarkers: (role: string, props: AnyChildProps): props is ChartMarkersChildProps =>
    role === "chartMarkers" && props instanceof Object,
  grid: (role: string, props: AnyChildProps): props is GridConfig =>
    role === "grid" && props instanceof Object,
  line: (role: string, props: AnyChildProps): props is LineConfig =>
    role === "line" && props instanceof Object,
  liveLine: (role: string, props: AnyChildProps): props is LiveLineConfig =>
    role === "liveLine" && props instanceof Object,
  liveXAxis: (role: string, props: AnyChildProps): props is LiveXAxisConfig =>
    role === "liveXAxis" && props instanceof Object,
  liveYAxis: (role: string, props: AnyChildProps): props is LiveYAxisConfig =>
    role === "liveYAxis" && props instanceof Object,
  patternArea: (role: string, props: AnyChildProps): props is PatternAreaConfig =>
    role === "patternArea" && props instanceof Object,
  profitLossLine: (role: string, props: AnyChildProps): props is ProfitLossLineProps =>
    role === "profitLossLine" && props instanceof Object,
  projectionEndMarker: (
    role: string,
    props: AnyChildProps,
  ): props is ProjectionLineEndMarkerProps =>
    role === "projectionEndMarker" && props instanceof Object,
  projectionLine: (role: string, props: AnyChildProps): props is ProjectionLineProps =>
    role === "projectionLine" && props instanceof Object,
  "radar-area": (role: string, props: AnyChildProps): props is RadarAreaProps =>
    role === "radar-area" && props instanceof Object,
  "radar-axis": (role: string, props: AnyChildProps): props is RadarAxisProps =>
    role === "radar-axis" && props instanceof Object,
  "radar-grid": (role: string, props: AnyChildProps): props is RadarGridProps =>
    role === "radar-grid" && props instanceof Object,
  "radar-labels": (role: string, props: AnyChildProps): props is RadarLabelsProps =>
    role === "radar-labels" && props instanceof Object,
  scatter: (role: string, props: AnyChildProps): props is ScatterConfig =>
    role === "scatter" && props instanceof Object,
  seriesBar: (role: string, props: AnyChildProps): props is SeriesBarConfig =>
    role === "seriesBar" && props instanceof Object,
  terminalMarker: (
    role: string,
    props: AnyChildProps,
  ): props is LineSeriesTerminalMarkerProps =>
    role === "terminalMarker" && props instanceof Object,
  tooltip: (role: string, props: AnyChildProps): props is ChartTooltipConfig =>
    role === "tooltip" && props instanceof Object,
  xAxis: (role: string, props: AnyChildProps): props is XAxisConfig =>
    role === "xAxis" && props instanceof Object,
  yAxis: (role: string, props: AnyChildProps): props is YAxisConfig =>
    role === "yAxis" && props instanceof Object,
};

export { CHART_ROLE, ChildPropGuards, isStringValue, roleOf };
export type {
  AnyChildProps,
  ChartChildComponent,
  ChartMarkersChildProps,
  LineSeriesTerminalMarkerProps,
  ProfitLossLineProps,
  ProjectionLineEndMarkerProps,
  ProjectionLineProps,
  RadarAreaProps,
  RadarAxisProps,
  RadarGridProps,
  RadarLabelsProps,
  ReadonlyAreaConfig,
  ReadonlyBarSquaresConfig,
  ReadonlyGridConfig,
  ReadonlyLineConfig,
  ReadonlyLiveLineConfig,
  ReadonlyProjectionLineEndMarkerProps,
  ReadonlyProjectionLineProps,
  ReadonlyScatterConfig,
  RolePropsMap,
};
