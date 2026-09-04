// Child-extraction visitor for config-carrier children: compiles element children into a spec object.
// Split from the children barrel so that barrel re-exports components only.
import { Children, Fragment, isValidElement } from "react";
import type { JSXElementConstructor, ReactElement, ReactNode } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import type {
  AreaConfig,
  BackgroundConfig,
  BarConfig,
  BarColumnTrackConfig,
  BarDepthBackConfig,
  BarDepthFrontConfig,
  BarDepthProviderConfig,
  BarPulseConfig,
  BarSquaresConfig,
  BarXAxisConfig,
  BrushChildConfig,
  CandlestickConfig,
  ChartTooltipConfig,
  GridConfig,
  LineConfig,
  PatternAreaConfig,
  ScatterConfig,
  SeriesBarConfig,
  XAxisConfig,
  YAxisConfig,
  ExtractedChildren,
} from "./types";
import type {
  ChartMarkersChildProps,
  LineSeriesTerminalMarkerProps,
  ProfitLossLineProps,
  ProjectionLineEndMarkerProps,
  ProjectionLineProps,
} from "./chart-child-carrier";

const CHART_CHILD_PASSTHROUGH = Symbol.for("migrated.chartChildPassthrough");

// Legacy string-key alias: bklit stamps the literal key, so the detector accepts both keys.
const CHART_CLIP_PASSTHROUGH = "__chartClipPassthrough" as const;

interface RoleCarrier { readonly [CHART_ROLE]?: string }
interface PassthroughCarrier {
  readonly [CHART_CHILD_PASSTHROUGH]?: boolean;
  readonly [CHART_CLIP_PASSTHROUGH]?: boolean;
}

// The `type` field of a React element: a host tag, a component (function,
// Class, or memo object), or absent. Spelled with unknown props so every
// Component shape stays assignable; the carrier interfaces above describe
// The marker properties the predicate below probes for.
type ChartChildType = string | JSXElementConstructor<unknown> | null | undefined;

type MarkerCarrier = JSXElementConstructor<unknown> & RoleCarrier & PassthroughCarrier;

const isMarkerCarrier = (value: ChartChildType): value is MarkerCarrier =>
  value !== null && value !== undefined && typeof value !== "string";

/** True for clip/child passthrough wrappers under either key (memo() types are objects, not functions). */
const isChartClipPassthrough = (type: ChartChildType): boolean => {
  if (!isMarkerCarrier(type)) {
    return false;
  }
  return (
    type[CHART_CHILD_PASSTHROUGH] === true ||
    type[CHART_CLIP_PASSTHROUGH] === true
  );
}

const roleOf = (type: ChartChildType): string | undefined => {
  if (!isMarkerCarrier(type)) {
    return undefined;
  }
  return type[CHART_ROLE];
};


const displayNameOf = <WithDisplayName extends { displayName?: string }>(componentType: Readonly<WithDisplayName> | null | undefined): string | undefined => componentType?.displayName;


const visitFrameChild = (child: ReactElement, recurse: (node: ReactNode) => void): boolean => {
  if (isChartClipPassthrough(child.type) && isValidElement<{ children?: ReactNode }>(child)) {recurse(child.props.children); return true;}
  if (child.type === Fragment && isValidElement<{ children?: ReactNode }>(child)) {recurse(child.props.children); return true;}
  return false;
};

const visit = (node: ReactNode, out: ExtractedChildren): void => {
  const recurse = (nested: ReactNode): void => {visit(nested, out);};
  for (const child of Children.toArray(node)) {
    if (isValidElement(child) && !visitFrameChild(child, recurse)) {
      const role = roleOf(child.type);
      if (role === "line" && isValidElement<LineConfig>(child)) {out.lines.push(child.props);}
      else if (role === "area" && isValidElement<AreaConfig>(child)) {out.areas.push(child.props);}
      else if (role === "patternArea" && isValidElement<PatternAreaConfig>(child)) {out.patternAreas.push(child.props);}
      else if (role === "scatter" && isValidElement<ScatterConfig>(child)) {out.scatters.push(child.props);}
      else if (role === "bar" && isValidElement<BarConfig>(child)) {out.bars.push(child.props);}
      else if (role === "barSquares" && isValidElement<BarSquaresConfig>(child)) {out.barSquares.push(child.props);}
      else if (role === "barColumnTrack" && isValidElement<BarColumnTrackConfig>(child)) {out.barColumnTracks.push(child.props);}
      else if (role === "barDepthBack" && isValidElement<BarDepthBackConfig>(child)) {out.barDepthBacks.push(child.props);}
      else if (role === "barDepthFront" && isValidElement<BarDepthFrontConfig>(child)) {out.barDepthFronts.push(child.props);}
      else if (role === "barPulse" && isValidElement<BarPulseConfig>(child)) {out.barPulses.push(child.props);}
      else if (role === "barDepthProvider" && isValidElement<BarDepthProviderConfig & { children?: ReactNode }>(child)) {out.barDepthProvider = child.props;}
      else if (role === "seriesBar" && isValidElement<SeriesBarConfig>(child)) {out.seriesBars.push(child.props);}
      else if (role === "grid" && isValidElement<GridConfig>(child)) {out.grid = child.props;}
      else if (role === "xAxis" && isValidElement<XAxisConfig>(child)) {out.xAxis = child.props;}
      else if (role === "barXAxis" && isValidElement<BarXAxisConfig>(child)) {out.barXAxis = child.props;}
      else if (role === "background" && isValidElement<BackgroundConfig>(child)) {out.background = child.props;}
      else if (role === "tooltip" && isValidElement<ChartTooltipConfig>(child)) {out.tooltip = { enabled: true, ...child.props };}
      else if (role === "candlestick" && isValidElement<CandlestickConfig>(child)) {out.candlestick = { ...child.props };}
      else if (role === "yAxis" && isValidElement<YAxisConfig>(child)) {out.yAxis = { ...child.props };}
      else if (role === "projectionLine" && isValidElement<ProjectionLineProps>(child)) {out.projectionLines.push(child.props);}
      else if (role === "projectionEndMarker" && isValidElement<ProjectionLineEndMarkerProps>(child)) {out.projectionEndMarkers.push(child.props);}
      else if (role === "terminalMarker" && isValidElement<LineSeriesTerminalMarkerProps>(child)) {out.terminalMarkers.push(child.props);}
      else if (role === "profitLossLine" && isValidElement<ProfitLossLineProps>(child)) {out.profitLossLines.push(child.props);}
      else if (role === "chartMarkers" && isValidElement<ChartMarkersChildProps>(child)) {out.chartMarkers = child.props;}
      else if (role === "brush" && isValidElement<BrushChildConfig>(child)) {out.brushes.push(child.props);}
      else {
        // Unknown roles carry no chart config: only known carriers populate the spec.
      }
    }
  }
};


const extractChildren = (children: ReactNode): ExtractedChildren => {
  const out: ExtractedChildren = {
    areas: [],
    background: null,
    barColumnTracks: [],
    barDepthBacks: [],
    barDepthFronts: [],
    barDepthProvider: null,
    barPulses: [],
    barSquares: [],
    barXAxis: null,
    bars: [],
    brushes: [],
    candlestick: null,
    chartMarkers: null,
    grid: null,
    lines: [],
    patternAreas: [],
    profitLossLines: [],
    projectionEndMarkers: [],
    projectionLines: [],
    scatters: [],
    seriesBars: [],
    terminalMarkers: [],
    tooltip: null,
    xAxis: null,
    yAxis: null,
  };
  visit(children, out);
  return out;
}

export {
  CHART_CHILD_PASSTHROUGH,
  CHART_CLIP_PASSTHROUGH,
  displayNameOf,
  extractChildren,
  isChartClipPassthrough,
  roleOf,
};
