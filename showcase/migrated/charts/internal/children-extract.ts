// Child-extraction visitor for config-carrier children: compiles element children into a spec object.
// Split from the children barrel so that barrel re-exports components only.
import { Fragment, isValidElement } from "react";
import type { JSXElementConstructor, ReactElement, ReactNode } from "react";
import { ChildPropGuards, roleOf } from "./chart-child-carrier";
import { shallowEqualChildProps } from "./chart-child-registry";
import type { ChartChildRegistration } from "./chart-child-registry";
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
  AnyChildProps,
  ChartMarkersChildProps,
  LineSeriesTerminalMarkerProps,
  ProfitLossLineProps,
  ProjectionLineEndMarkerProps,
  ProjectionLineProps,
} from "./chart-child-carrier";

const CHART_CHILD_PASSTHROUGH = Symbol.for("migrated.chartChildPassthrough");

// Legacy string-key alias: bklit stamps the literal key, so the detector accepts both keys.
const CHART_CLIP_PASSTHROUGH = "__chartClipPassthrough" as const;

interface PassthroughCarrier {
  readonly [CHART_CHILD_PASSTHROUGH]?: boolean;
  readonly [CHART_CLIP_PASSTHROUGH]?: boolean;
}

/*
 * Spelled with unknown props so every component shape stays assignable to the carrier probes below.
 */
type ChartChildType = string | JSXElementConstructor<unknown> | null | undefined;

type MarkerCarrier = JSXElementConstructor<unknown> & PassthroughCarrier;

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

const displayNameOf = <WithDisplayName extends { displayName?: string }>(componentType: Readonly<WithDisplayName> | null | undefined): string | undefined => componentType?.displayName;


const visitFrameChild = (child: ReactElement, recurse: (node: ReactNode) => void): boolean => {
  if (isChartClipPassthrough(child.type) && isValidElement<{ children?: ReactNode }>(child)) {recurse(child.props.children); return true;}
  if (child.type === Fragment && isValidElement<{ children?: ReactNode }>(child)) {recurse(child.props.children); return true;}
  return false;
};

// Line-family series carriers: each appends its props to the matching spec array.
const applyLineAreaRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "line" && isValidElement<LineConfig>(child)) { out.lines.push(child.props); }
  else if (role === "area" && isValidElement<AreaConfig>(child)) { out.areas.push(child.props); }
  else if (role === "patternArea" && isValidElement<PatternAreaConfig>(child)) { out.patternAreas.push(child.props); }
  else if (role === "scatter" && isValidElement<ScatterConfig>(child)) { out.scatters.push(child.props); }
  else { return false; }
  return true;
};

// Bar-row carriers: each appends its props to the matching spec array.
const applyBarRowRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "bar" && isValidElement<BarConfig>(child)) { out.bars.push(child.props); }
  else if (role === "barSquares" && isValidElement<BarSquaresConfig>(child)) { out.barSquares.push(child.props); }
  else if (role === "barColumnTrack" && isValidElement<BarColumnTrackConfig>(child)) { out.barColumnTracks.push(child.props); }
  else if (role === "seriesBar" && isValidElement<SeriesBarConfig>(child)) { out.seriesBars.push(child.props); }
  else { return false; }
  return true;
};

// Bar-depth carriers: variants push; the provider assigns its slot and wraps its children (legacy composition).
const applyBarDepthRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren, recurse: (node: ReactNode) => void): boolean => {
  if (role === "barDepthBack" && isValidElement<BarDepthBackConfig>(child)) { out.barDepthBacks.push(child.props); }
  else if (role === "barDepthFront" && isValidElement<BarDepthFrontConfig>(child)) { out.barDepthFronts.push(child.props); }
  else if (role === "barPulse" && isValidElement<BarPulseConfig>(child)) { out.barPulses.push(child.props); }
  else if (role === "barDepthProvider" && isValidElement<BarDepthProviderConfig & { children?: ReactNode }>(child)) { out.barDepthProvider = child.props; recurse(child.props.children); }
  else { return false; }
  return true;
};

// Axis carriers: each assigns its singleton spec slot, last one wins as before.
const applyFrameAxisRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "grid" && isValidElement<GridConfig>(child)) { out.grid = child.props; }
  else if (role === "xAxis" && isValidElement<XAxisConfig>(child)) { out.xAxis = child.props; }
  else if (role === "barXAxis" && isValidElement<BarXAxisConfig>(child)) { out.barXAxis = child.props; }
  else if (role === "yAxis" && isValidElement<YAxisConfig>(child)) { out.yAxis = { ...child.props }; }
  else { return false; }
  return true;
};

// Surface carriers: each assigns its singleton spec slot, last one wins as before.
const applyFrameSurfaceRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "background" && isValidElement<BackgroundConfig>(child)) { out.background = child.props; return true; }
  if (role === "tooltip" && isValidElement<ChartTooltipConfig>(child)) { out.tooltip = { enabled: true, ...child.props }; return true; }
  if (role === "candlestick" && isValidElement<CandlestickConfig>(child)) { out.candlestick = { ...child.props }; return true; }
  return false;
};

// Projection carriers: each appends its props to the matching spec array.
const applyProjectionRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "projectionLine" && isValidElement<ProjectionLineProps>(child)) { out.projectionLines.push(child.props); return true; }
  if (role === "projectionEndMarker" && isValidElement<ProjectionLineEndMarkerProps>(child)) { out.projectionEndMarkers.push(child.props); return true; }
  if (role === "terminalMarker" && isValidElement<LineSeriesTerminalMarkerProps>(child)) { out.terminalMarkers.push(child.props); return true; }
  return false;
};

// Marker carriers: marker lines push, chart markers assign the singleton slot.
const applyMarkerRoles = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean => {
  if (role === "profitLossLine" && isValidElement<ProfitLossLineProps>(child)) { out.profitLossLines.push(child.props); return true; }
  if (role === "chartMarkers" && isValidElement<ChartMarkersChildProps>(child)) { out.chartMarkers = child.props; return true; }
  if (role === "brush" && isValidElement<BrushChildConfig>(child)) { out.brushes.push(child.props); return true; }
  return false;
};

// Series-family fan-out: line, bar-row, and bar-depth carriers in the original chain order.
const applySeriesConfigRole = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren, recurse: (node: ReactNode) => void): boolean =>
  applyLineAreaRoles(child, role, out) || applyBarRowRoles(child, role, out) || applyBarDepthRoles(child, role, out, recurse);

// Frame-and-overlay fan-out: axes, surfaces, projections, and markers in the original chain order.
const applyFrameOverlayRole = (child: Readonly<ReactElement>, role: string | undefined, out: ExtractedChildren): boolean =>
  applyFrameAxisRoles(child, role, out) || applyFrameSurfaceRoles(child, role, out) ||
  applyProjectionRoles(child, role, out) || applyMarkerRoles(child, role, out);

// Registry union groups mirror the scan groups; unknown roles are ignored.
const pushLineAreaRegistry = (role: string, props: AnyChildProps, out: ExtractedChildren): boolean => {
  if (ChildPropGuards.line(role, props)) { out.lines.push(props); return true; }
  if (ChildPropGuards.area(role, props)) { out.areas.push(props); return true; }
  if (ChildPropGuards.patternArea(role, props)) { out.patternAreas.push(props); return true; }
  if (ChildPropGuards.scatter(role, props)) { out.scatters.push(props); return true; }
  return false;
};

const pushBarRowRegistry = (role: string, props: AnyChildProps, out: ExtractedChildren): boolean => {
  if (ChildPropGuards.bar(role, props)) { out.bars.push(props); return true; }
  if (ChildPropGuards.barSquares(role, props)) { out.barSquares.push(props); return true; }
  if (ChildPropGuards.barColumnTrack(role, props)) { out.barColumnTracks.push(props); return true; }
  if (ChildPropGuards.seriesBar(role, props)) { out.seriesBars.push(props); return true; }
  return false;
};

const pushBarDepthRegistry = (role: string, props: AnyChildProps, out: ExtractedChildren): boolean => {
  if (ChildPropGuards.barDepthBack(role, props)) { out.barDepthBacks.push(props); return true; }
  if (ChildPropGuards.barDepthFront(role, props)) { out.barDepthFronts.push(props); return true; }
  if (ChildPropGuards.barPulse(role, props)) { out.barPulses.push(props); return true; }
  if (ChildPropGuards.barDepthProvider(role, props)) { out.barDepthProvider = props; return true; }
  return false;
};

const pushFrameAxisRegistry = (role: string, props: AnyChildProps, out: ExtractedChildren): boolean => {
  if (ChildPropGuards.grid(role, props)) { out.grid = props; return true; }
  if (ChildPropGuards.xAxis(role, props)) { out.xAxis = props; return true; }
  if (ChildPropGuards.barXAxis(role, props)) { out.barXAxis = props; return true; }
  if (ChildPropGuards.yAxis(role, props)) { out.yAxis = { ...props }; return true; }
  return false;
};

const pushFrameSurfaceRegistry = (role: string, props: AnyChildProps, out: ExtractedChildren): boolean => {
  if (ChildPropGuards.background(role, props)) { out.background = props; return true; }
  if (ChildPropGuards.tooltip(role, props)) { out.tooltip = { enabled: true, ...props }; return true; }
  if (ChildPropGuards.candlestick(role, props)) { out.candlestick = { ...props }; return true; }
  return false;
};

const pushProjectionRegistry = (role: string, props: AnyChildProps, out: ExtractedChildren): boolean => {
  if (ChildPropGuards.projectionLine(role, props)) { out.projectionLines.push(props); return true; }
  if (ChildPropGuards.projectionEndMarker(role, props)) { out.projectionEndMarkers.push(props); return true; }
  if (ChildPropGuards.terminalMarker(role, props)) { out.terminalMarkers.push(props); return true; }
  return false;
};

const pushMarkerRegistry = (role: string, props: AnyChildProps, out: ExtractedChildren): boolean => {
  if (ChildPropGuards.profitLossLine(role, props)) { out.profitLossLines.push(props); return true; }
  if (ChildPropGuards.chartMarkers(role, props)) { out.chartMarkers = props; return true; }
  if (ChildPropGuards.brush(role, props)) { out.brushes.push(props); return true; }
  return false;
};

// Rendered carriers (HOC wrappers) merge here; the scan stays the first path.
const pushRegistryEntry = (role: string, props: AnyChildProps, out: ExtractedChildren): void => {
  if (pushLineAreaRegistry(role, props, out)) { return; }
  if (pushBarRowRegistry(role, props, out)) { return; }
  if (pushBarDepthRegistry(role, props, out)) { return; }
  if (pushFrameAxisRegistry(role, props, out)) { return; }
  if (pushFrameSurfaceRegistry(role, props, out)) { return; }
  if (pushProjectionRegistry(role, props, out)) { return; }
  pushMarkerRegistry(role, props, out);
};

// Scanned element identity for registry dedup (V1.2 regression fix).
interface ScannedChild {
  readonly role: string | undefined;
  readonly props: unknown;
}

const visit = (node: ReactNode, out: ExtractedChildren, seen: Set<unknown>, scanned: ScannedChild[]): void => {
  const recurse = (nested: ReactNode): void => {visit(nested, out, seen, scanned);};
  // Flatten nested child arrays without React.Children; key assignment is unused here.
  for (const child of [node].flat(Infinity)) {
    if (isValidElement(child) && !visitFrameChild(child, recurse)) {
      seen.add(child.props);
      const role = roleOf(child.type);
      scanned.push({ props: child.props, role });
      // Unknown roles carry no chart config: only known carriers populate the spec.
      applySeriesConfigRole(child, role, out, recurse);
      applyFrameOverlayRole(child, role, out);
    }
  }
};


// Shared empty union: keeps hook dependency arrays stable when no host runs.
const NO_REGISTRY_ENTRIES: readonly ChartChildRegistration[] = [];

const extractChildren = (
  children: ReactNode,
  registryEntries: readonly ChartChildRegistration[] = NO_REGISTRY_ENTRIES,
): ExtractedChildren => {
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
  const seen = new Set<unknown>();
  const scanned: ScannedChild[] = [];
  visit(children, out, seen, scanned);
  for (const entry of registryEntries) {
    if (!seen.has(entry.props) && !scanned.some((sibling) => sibling.role === entry.role && shallowEqualChildProps(sibling.props, entry.props))) {
      seen.add(entry.props);
      pushRegistryEntry(entry.role, entry.props, out);
    }
  }
  return out;
}

export {
  CHART_CHILD_PASSTHROUGH,
  CHART_CLIP_PASSTHROUGH,
  displayNameOf,
  extractChildren,
  isChartClipPassthrough,
};
export { roleOf } from "./chart-child-carrier";
