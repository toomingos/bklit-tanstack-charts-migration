// Config-carrier child shared definitions: marker symbol, carrier component type,
// And the readonly prop aliases the carrier children are declared with.
import type { CurveFactory } from "d3-shape";
import type {
  AreaConfig,
  BarSquaresConfig,
  ChartMarker,
  GradientStop,
  GridConfig,
  LineConfig,
  LiveLineConfig,
  MomentumColors,
  ScatterConfig,
  SeriesPointMarkerStyle,
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

export { CHART_ROLE };
export type {
  ChartChildComponent,
  ChartMarkersChildProps,
  LineSeriesTerminalMarkerProps,
  ProfitLossLineProps,
  ProjectionLineEndMarkerProps,
  ProjectionLineProps,
  ReadonlyAreaConfig,
  ReadonlyBarSquaresConfig,
  ReadonlyGridConfig,
  ReadonlyLineConfig,
  ReadonlyLiveLineConfig,
  ReadonlyProjectionLineEndMarkerProps,
  ReadonlyProjectionLineProps,
  ReadonlyScatterConfig,
};
