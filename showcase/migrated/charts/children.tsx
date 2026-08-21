// Config-carrier children replicating bklit-ui's compositional chart API.
// They render nothing; LineChart walks them once and compiles a TanStack
// `defineChart` spec. One canonical role marker replaces bklit's six ad-hoc
// displayName string-matchers (research/01 §3.10).
import * as React from "react";
import type { CurveFactory } from "d3-shape";
import type {
  AreaConfig,
  BarConfig,
  BarColumnTrackConfig,
  BarDepthBackConfig,
  BarDepthFrontConfig,
  BarDepthProviderConfig,
  BarPulseConfig,
  BarSquaresConfig,
  BarXAxisConfig,
  CandlestickConfig,
  ChartTooltipConfig,
  GridConfig,
  LineConfig,
  LiveLineConfig,
  LiveXAxisConfig,
  LiveYAxisConfig,
  PatternAreaConfig,
  ScatterConfig,
  SeriesBarConfig,
  XAxisConfig,
  YAxisConfig,
  ExtractedChildren,
} from "./internal/types";
import type { ProjectionPoint } from "./internal/projection-utils";
import type { SeriesPointMarkerStyle } from "./internal/types";

export const CHART_ROLE = Symbol.for("migrated.chartRole");
export const CHART_CHILD_PASSTHROUGH = Symbol.for("migrated.chartChildPassthrough");

type RoleCarrier = { [CHART_ROLE]?: string };
type PassthroughCarrier = { [CHART_CHILD_PASSTHROUGH]?: boolean };

// Exported for composed-chart.tsx's own dedicated single-pass extraction
// (it needs cross-role encounter order for bklit's upsert semantics — see
// that file's `extractComposed`).
export function roleOf(type: unknown): string | undefined {
  return (type as RoleCarrier)?.[CHART_ROLE];
}

export function Line(_props: LineConfig): null {
  return null;
}
(Line as RoleCarrier)[CHART_ROLE] = "line";

export function Area(_props: AreaConfig): null {
  return null;
}
(Area as RoleCarrier)[CHART_ROLE] = "area";

export function Scatter(_props: ScatterConfig): null {
  return null;
}
(Scatter as RoleCarrier)[CHART_ROLE] = "scatter";

export function Bar(_props: BarConfig): null {
  return null;
}
(Bar as RoleCarrier)[CHART_ROLE] = "bar";

export function BarSquares(_props: BarSquaresConfig): null {
  return null;
}
(BarSquares as RoleCarrier)[CHART_ROLE] = "barSquares";
BarSquares.displayName = "BarSquares";

export function BarColumnTrack(_props: BarColumnTrackConfig): null {
  return null;
}
(BarColumnTrack as RoleCarrier)[CHART_ROLE] = "barColumnTrack";
BarColumnTrack.displayName = "BarColumnTrack";

export function BarDepthProvider(_props: BarDepthProviderConfig & { children?: React.ReactNode }): null {
  return null;
}
(BarDepthProvider as RoleCarrier)[CHART_ROLE] = "barDepthProvider";
BarDepthProvider.displayName = "BarDepthProvider";

export function BarDepthBack(_props: BarDepthBackConfig): null {
  return null;
}
(BarDepthBack as RoleCarrier)[CHART_ROLE] = "barDepthBack";
(BarDepthBack as unknown as { __isBarDepthLayer?: boolean }).__isBarDepthLayer = true;
BarDepthBack.displayName = "BarDepthBack";

export function BarDepthFront(_props: BarDepthFrontConfig): null {
  return null;
}
(BarDepthFront as RoleCarrier)[CHART_ROLE] = "barDepthFront";
(BarDepthFront as unknown as { __isBarDepthLayer?: boolean }).__isBarDepthLayer = true;
BarDepthFront.displayName = "BarDepthFront";

export function BarPulse(_props: BarPulseConfig): null {
  return null;
}
(BarPulse as RoleCarrier)[CHART_ROLE] = "barPulse";
(BarPulse as unknown as { __isBarDepthLayer?: boolean }).__isBarDepthLayer = true;
BarPulse.displayName = "BarPulse";

export function PatternArea(_props: PatternAreaConfig): null {
  return null;
}
(PatternArea as RoleCarrier)[CHART_ROLE] = "patternArea";
PatternArea.displayName = "PatternArea";

// ComposedChart's bar series (bklit series-bar.tsx). Distinct role from
// standalone <Bar> — ComposedChart does its own dedicated single-pass
// extraction (composed-chart.tsx `extractComposedSeries`) that needs
// cross-role (bar/area/line) encounter order, so `extractChildren` here
// only files it into `seriesBars` for consumers that don't need order
// (none yet — reserved for parity/future use); ComposedChart itself never
// calls `extractChildren`.
export function SeriesBar(_props: SeriesBarConfig): null {
  return null;
}
(SeriesBar as RoleCarrier)[CHART_ROLE] = "seriesBar";

export function BarXAxis(_props: BarXAxisConfig): null {
  return null;
}
(BarXAxis as RoleCarrier)[CHART_ROLE] = "barXAxis";

export function Grid(_props: GridConfig): null {
  return null;
}
(Grid as RoleCarrier)[CHART_ROLE] = "grid";

export function XAxis(_props: XAxisConfig): null {
  return null;
}
(XAxis as RoleCarrier)[CHART_ROLE] = "xAxis";

export function ChartTooltip(_props: ChartTooltipConfig): null {
  return null;
}
(ChartTooltip as RoleCarrier)[CHART_ROLE] = "tooltip";

export function Candlestick(_props: CandlestickConfig): null {
  return null;
}
(Candlestick as RoleCarrier)[CHART_ROLE] = "candlestick";

export function YAxis(_props: YAxisConfig): null {
  return null;
}
(YAxis as RoleCarrier)[CHART_ROLE] = "yAxis";

// --- LiveLineChart-only marker components (docs/LOG.md D22) ----------------
// LiveLineChart is a NEW top-level component with its own dedicated
// extraction (live-line-chart.tsx `extractLiveLineChildren`, mirroring
// composed-chart.tsx's precedent of not using the generic `extractChildren`
// below) — these are appended here only so they live alongside the other
// role-carriers/share the CHART_ROLE convention; `extractChildren` itself
// does NOT collect them (its `ExtractedChildren` shape is unchanged).
export function LiveLine(_props: LiveLineConfig): null {
  return null;
}
(LiveLine as RoleCarrier)[CHART_ROLE] = "liveLine";

export function LiveXAxis(_props: LiveXAxisConfig): null {
  return null;
}
(LiveXAxis as RoleCarrier)[CHART_ROLE] = "liveXAxis";

export function LiveYAxis(_props: LiveYAxisConfig): null {
  return null;
}
(LiveYAxis as RoleCarrier)[CHART_ROLE] = "liveYAxis";

export interface ProjectionLineProps {
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
  /** @deprecated Use showEndMarker. */
  showEndpoints?: boolean;
  endpointRadius?: number;
  className?: string;
}

export function ProjectionLine(_props: ProjectionLineProps): null {
  return null;
}
(ProjectionLine as RoleCarrier)[CHART_ROLE] = "projectionLine";
ProjectionLine.displayName = "ProjectionLine";

export interface ProjectionLineEndMarkerProps {
  data: ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  strokeOpacity?: number;
  radius?: number;
}

export function ProjectionLineEndMarker(_props: ProjectionLineEndMarkerProps): null {
  return null;
}
(ProjectionLineEndMarker as RoleCarrier)[CHART_ROLE] = "projectionEndMarker";
ProjectionLineEndMarker.displayName = "ProjectionLineEndMarker";

export interface LineSeriesTerminalMarkerProps extends SeriesPointMarkerStyle {
  dataKey: string;
  yAxisId?: string | number;
}

export function LineSeriesTerminalMarker(_props: LineSeriesTerminalMarkerProps): null {
  return null;
}
(LineSeriesTerminalMarker as RoleCarrier)[CHART_ROLE] = "terminalMarker";
LineSeriesTerminalMarker.displayName = "LineSeriesTerminalMarker";

export interface ProfitLossLineProps {
  dataKey: string;
  xDataKey?: string;
  strokeWidth?: number;
  positiveColor?: string;
  negativeColor?: string;
  curve?: CurveFactory;
  fadeEdges?: boolean | "left" | "right";
}

export function ProfitLossLine(_props: ProfitLossLineProps): null {
  return null;
}
(ProfitLossLine as RoleCarrier)[CHART_ROLE] = "profitLossLine";
ProfitLossLine.displayName = "ProfitLossLine";

export interface ChartMarkersChildProps {
  items: import("./internal/types").ChartMarker[];
  size?: number;
  showLines?: boolean;
  animate?: boolean;
  maxFanned?: number;
}

export function ChartMarkers(_props: ChartMarkersChildProps): null {
  return null;
}
(ChartMarkers as RoleCarrier)[CHART_ROLE] = "chartMarkers";
ChartMarkers.displayName = "ChartMarkers";

export function displayNameOf<T extends { displayName?: string }>(
  componentType: T | null | undefined,
): string | undefined {
  return componentType?.displayName;
}

export function extractChildren(children: React.ReactNode): ExtractedChildren {
  const out: ExtractedChildren = {
    lines: [],
    areas: [],
    patternAreas: [],
    scatters: [],
    bars: [],
    barSquares: [],
    barColumnTracks: [],
    barDepthBacks: [],
    barDepthFronts: [],
    barPulses: [],
    barDepthProvider: null,
    seriesBars: [],
    grid: null,
    xAxis: null,
    barXAxis: null,
    tooltip: null,
    candlestick: null,
    yAxis: null,
    projectionLines: [],
    projectionEndMarkers: [],
    terminalMarkers: [],
    profitLossLines: [],
    chartMarkers: null,
    brushes: [],
  };
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if ((child.type as PassthroughCarrier)?.[CHART_CHILD_PASSTHROUGH]) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = roleOf(child.type);
      const props = child.props as never;
      if (role === "line") out.lines.push(props);
      else if (role === "area") out.areas.push(props);
      else if (role === "patternArea") out.patternAreas.push(props);
      else if (role === "scatter") out.scatters.push(props);
      else if (role === "bar") out.bars.push(props);
      else if (role === "barSquares") out.barSquares.push(props);
      else if (role === "barColumnTrack") out.barColumnTracks.push(props);
      else if (role === "barDepthBack") out.barDepthBacks.push(props);
      else if (role === "barDepthFront") out.barDepthFronts.push(props);
      else if (role === "barPulse") out.barPulses.push(props);
      else if (role === "barDepthProvider") out.barDepthProvider = props as BarDepthProviderConfig;
      else if (role === "seriesBar") out.seriesBars.push(props);
      else if (role === "grid") out.grid = props;
      else if (role === "xAxis") out.xAxis = props;
      else if (role === "barXAxis") out.barXAxis = props;
      else if (role === "tooltip") out.tooltip = { enabled: true, ...(props as ChartTooltipConfig) };
      else if (role === "candlestick") out.candlestick = { ...(props as CandlestickConfig) };
      else if (role === "yAxis") out.yAxis = { ...(props as YAxisConfig) };
      else if (role === "projectionLine") out.projectionLines.push(props);
      else if (role === "projectionEndMarker") out.projectionEndMarkers.push(props);
      else if (role === "terminalMarker") out.terminalMarkers.push(props);
      else if (role === "profitLossLine") out.profitLossLines.push(props);
      else if (role === "chartMarkers") out.chartMarkers = props as unknown as import("./internal/types").ChartMarkersConfig;
      // Brush children keep the ELEMENT (ChartBrush renders portal chrome;
      // the host re-renders it inside its BrushHostContext provider).
      else if (role === "brush") out.brushes.push(child);
    }
  };
  visit(children);
  return out;
}
