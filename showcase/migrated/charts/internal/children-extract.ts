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

/** True for clip/child passthrough wrappers under either key (memo() types are objects, not functions).
 * @param {ChartChildType} type - Element type to probe for either passthrough marker property.
 * @returns {boolean} Whether the type carries a passthrough marker and its children should be unwrapped.
 */
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

// Line-family series carriers: each appends its props to the matching spec array.
const applyLineAreaRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "line" && isValidElement<LineConfig>(child)) { out.lines.push(child.props); return true; }
  else if (role === "area" && isValidElement<AreaConfig>(child)) { out.areas.push(child.props); return true; }
  else if (role === "patternArea" && isValidElement<PatternAreaConfig>(child)) { out.patternAreas.push(child.props); return true; }
  else if (role === "scatter" && isValidElement<ScatterConfig>(child)) { out.scatters.push(child.props); return true; }
  else { return false; }
};

// Bar-row carriers: each appends its props to the matching spec array.
const applyBarRowRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "bar" && isValidElement<BarConfig>(child)) { out.bars.push(child.props); return true; }
  else if (role === "barSquares" && isValidElement<BarSquaresConfig>(child)) { out.barSquares.push(child.props); return true; }
  else if (role === "barColumnTrack" && isValidElement<BarColumnTrackConfig>(child)) { out.barColumnTracks.push(child.props); return true; }
  else if (role === "seriesBar" && isValidElement<SeriesBarConfig>(child)) { out.seriesBars.push(child.props); return true; }
  else { return false; }
};

// Bar-depth carriers: variants push, the provider assigns the singleton slot.
const applyBarDepthRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "barDepthBack" && isValidElement<BarDepthBackConfig>(child)) { out.barDepthBacks.push(child.props); return true; }
  else if (role === "barDepthFront" && isValidElement<BarDepthFrontConfig>(child)) { out.barDepthFronts.push(child.props); return true; }
  else if (role === "barPulse" && isValidElement<BarPulseConfig>(child)) { out.barPulses.push(child.props); return true; }
  else if (role === "barDepthProvider" && isValidElement<BarDepthProviderConfig & { children?: ReactNode }>(child)) { out.barDepthProvider = child.props; return true; }
  else { return false; }
};

// Axis carriers: each assigns its singleton spec slot, last one wins as before.
const applyFrameAxisRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "grid" && isValidElement<GridConfig>(child)) { out.grid = child.props; return true; }
  else if (role === "xAxis" && isValidElement<XAxisConfig>(child)) { out.xAxis = child.props; return true; }
  else if (role === "barXAxis" && isValidElement<BarXAxisConfig>(child)) { out.barXAxis = child.props; return true; }
  else if (role === "yAxis" && isValidElement<YAxisConfig>(child)) { out.yAxis = { ...child.props }; return true; }
  else { return false; }
};

// Surface carriers: each assigns its singleton spec slot, last one wins as before.
const applyFrameSurfaceRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "background" && isValidElement<BackgroundConfig>(child)) { out.background = child.props; return true; }
  else if (role === "tooltip" && isValidElement<ChartTooltipConfig>(child)) { out.tooltip = { enabled: true, ...child.props }; return true; }
  else if (role === "candlestick" && isValidElement<CandlestickConfig>(child)) { out.candlestick = { ...child.props }; return true; }
  else { return false; }
};

// Projection carriers: each appends its props to the matching spec array.
const applyProjectionRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "projectionLine" && isValidElement<ProjectionLineProps>(child)) { out.projectionLines.push(child.props); return true; }
  else if (role === "projectionEndMarker" && isValidElement<ProjectionLineEndMarkerProps>(child)) { out.projectionEndMarkers.push(child.props); return true; }
  else if (role === "terminalMarker" && isValidElement<LineSeriesTerminalMarkerProps>(child)) { out.terminalMarkers.push(child.props); return true; }
  else { return false; }
};

// Marker carriers: marker lines push, chart markers assign the singleton slot.
const applyMarkerRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "profitLossLine" && isValidElement<ProfitLossLineProps>(child)) { out.profitLossLines.push(child.props); return true; }
  else if (role === "chartMarkers" && isValidElement<ChartMarkersChildProps>(child)) { out.chartMarkers = child.props; return true; }
  else if (role === "brush" && isValidElement<BrushChildConfig>(child)) { out.brushes.push(child.props); return true; }
  else { return false; }
};

// Series-family fan-out: line, bar-row, and bar-depth carriers in the original chain order.
const applySeriesConfigRole = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean =>
  applyLineAreaRoles(child, role, out) || applyBarRowRoles(child, role, out) || applyBarDepthRoles(child, role, out);

// Frame-and-overlay fan-out: axes, surfaces, projections, and markers in the original chain order.
const applyFrameOverlayRole = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean =>
  applyFrameAxisRoles(child, role, out) || applyFrameSurfaceRoles(child, role, out) ||
  applyProjectionRoles(child, role, out) || applyMarkerRoles(child, role, out);

const visit = (node: ReactNode, out: ExtractedChildren): void => {
  const recurse = (nested: ReactNode): void => {visit(nested, out);};
  for (const child of Children.toArray(node)) {
    if (isValidElement(child) && !visitFrameChild(child, recurse)) {
      const role = roleOf(child.type);
      // Unknown roles carry no chart config: only known carriers populate the spec.
      applySeriesConfigRole(child, role, out);
      applyFrameOverlayRole(child, role, out);
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
