import { Fragment, isValidElement, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { roleOf } from "./children-extract";
import { ChildPropGuards } from "./chart-child-carrier";
import type { AnyChildProps } from "./chart-child-carrier";
import { shallowEqualChildProps } from "./chart-child-registry";
import type { ChartChildRegistration } from "./chart-child-registry";
import { DEFAULT_AREA_STROKE_WIDTH, DEFAULT_COLOR, DEFAULT_LINE_STROKE_WIDTH, NOTHING } from "./composed-series";
import type { ComposedSeriesEntry } from "./composed-model";
import { extractProjectionLineConfigs } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import type {
  AreaConfig,
  BackgroundConfig,
  ChartDatum,
  ChartTooltipConfig,
  GridConfig,
  LineConfig,
  SeriesBarConfig,
  SeriesPointMarkerStyle,
  XAxisConfig,
} from "./types";
import { useSanitizedId } from "./use-sanitized-id";

/*
 * Readonly is shallow, so the nested markers object needs its own readonly wrapper.
 */
type ReadonlyAreaConfig = Readonly<Omit<AreaConfig, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};
type ReadonlyLineConfig = Readonly<Omit<LineConfig, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};

interface ExtractedComposed {
  readonly barConfigs: SeriesBarConfig[];
  readonly areaConfigs: AreaConfig[];
  readonly lineConfigs: LineConfig[];
  /** One upserted entry per dataKey, in first-seen order. */
  readonly composedSeries: ComposedSeriesEntry[];
  grid: GridConfig | null;
  xAxis: XAxisConfig | undefined;
  background: BackgroundConfig | null;
  tooltip: ChartTooltipConfig | undefined;
}

const upsertComposedSeries = (list: ComposedSeriesEntry[], entry: Readonly<ComposedSeriesEntry>): void => {
  const existing = list.find((candidate: Readonly<ComposedSeriesEntry>) => candidate.dataKey === entry.dataKey);
  if (existing) {
    existing.stroke = entry.stroke;
    existing.strokeWidth = entry.strokeWidth;
    existing.showHighlight = entry.showHighlight;
    existing.dimOpacity = entry.dimOpacity;
    existing.yAxisId = entry.yAxisId;
  } else {
    list.push(entry);
  }
};

interface ComposedChildSink {
  readonly areaConfigs: AreaConfig[];
  background: BackgroundConfig | null;
  readonly barConfigs: SeriesBarConfig[];
  readonly composedSeries: ComposedSeriesEntry[];
  grid: GridConfig | null;
  readonly lineConfigs: LineConfig[];
  tooltip: ChartTooltipConfig | undefined;
  xAxis: XAxisConfig | undefined;
}

const registerSeriesBarChild = (child: Readonly<ReactElement<Readonly<SeriesBarConfig>>>, sink: ComposedChildSink): void => {
  const bar = child.props;
  sink.barConfigs.push(bar);
  upsertComposedSeries(sink.composedSeries, {
    dataKey: bar.dataKey,
    /*
     * Bars carry no hover-dim role and paint on the primary axis, so both fields stay unset.
     */
    showHighlight: false,
    stroke: bar.stroke ?? bar.fill ?? DEFAULT_COLOR,
    strokeWidth: 0,
  });
};

const registerAreaChild = (child: Readonly<ReactElement<ReadonlyAreaConfig>>, sink: ComposedChildSink): void => {
  const area = child.props;
  sink.areaConfigs.push(area);
  upsertComposedSeries(sink.composedSeries, {
    dataKey: area.dataKey,
    dimOpacity: 0.6,
    showHighlight: area.showHighlight ?? true,
    stroke: area.stroke ?? area.fill ?? DEFAULT_COLOR,
    strokeWidth: area.strokeWidth ?? DEFAULT_AREA_STROKE_WIDTH,
    yAxisId: area.yAxisId,
  });
};

const registerLineChild = (child: Readonly<ReactElement<ReadonlyLineConfig>>, sink: ComposedChildSink): void => {
  const line = child.props;
  sink.lineConfigs.push(line);
  upsertComposedSeries(sink.composedSeries, {
    dataKey: line.dataKey,
    dimOpacity: 0.3,
    showHighlight: line.showHighlight ?? true,
    stroke: line.stroke ?? DEFAULT_COLOR,
    strokeWidth: line.strokeWidth ?? DEFAULT_LINE_STROKE_WIDTH,
    yAxisId: line.yAxisId,
  });
};

const registerAxisChild = (child: Readonly<ReactElement>, sink: ComposedChildSink): boolean => {
  const role = roleOf(child.type);
  if (role === "grid" && isValidElement<GridConfig>(child)) {
    sink.grid = child.props;
    return true;
  }
  if (role === "xAxis" && isValidElement<XAxisConfig>(child)) {
    sink.xAxis = child.props;
    return true;
  }
  return false;
};

const registerSurfaceChild = (child: Readonly<ReactElement>, sink: ComposedChildSink): boolean => {
  const role = roleOf(child.type);
  if (role === "background" && isValidElement<BackgroundConfig>(child)) {
    sink.background = child.props;
    return true;
  }
  if (role === "tooltip" && isValidElement<ChartTooltipConfig>(child)) {
    sink.tooltip = { enabled: true, ...child.props };
    return true;
  }
  return false;
};

const registerChromeChild = (child: Readonly<ReactElement>, sink: ComposedChildSink): boolean => {
  if (registerAxisChild(child, sink)) {return true;}
  if (registerSurfaceChild(child, sink)) {return true;}
  const role = roleOf(child.type);
  if (role === "projectionLine" || role === "projectionEndMarker" || role === "terminalMarker") {
    // Terminal markers never register as series (bklit LINE_DOMAIN_EXCLUDED parity).
    return true;
  }
  // Unrecognized children (e.g. plain DOM nodes) are ignored.
  return false;
};

const registerBarAreaChild = (child: Readonly<ReactElement>, sink: ComposedChildSink): boolean => {
  const role = roleOf(child.type);
  if (role === "seriesBar" && isValidElement<SeriesBarConfig>(child)) {
    registerSeriesBarChild(child, sink);
    return true;
  }
  if (role === "area" && isValidElement<AreaConfig>(child)) {
    registerAreaChild(child, sink);
    return true;
  }
  return false;
};

// Scanned element identity for registry dedup (V1.2 regression fix).
interface ScannedComposedChild {
  readonly role: string | undefined;
  readonly props: unknown;
}

const visitComposedChild = (child: Readonly<ReactElement>, sink: ComposedChildSink, seen: Set<unknown>, scanned: ScannedComposedChild[]): void => {
  seen.add(child.props);
  scanned.push({ props: child.props, role: roleOf(child.type) });
  if (registerBarAreaChild(child, sink)) {return;}
  const role = roleOf(child.type);
  /*
   * Pin the generic to the role's config type to recover props without asserting.
   */
  if (role === "line" && isValidElement<LineConfig>(child)) {
    registerLineChild(child, sink);
    return;
  }
  registerChromeChild(child, sink);
};

// Flatten nested child arrays without React.Children; unused key assignment.
const visitComposedChildren = (node: ReactNode, sink: ComposedChildSink, seen: Set<unknown>, scanned: ScannedComposedChild[]): void => {
  for (const child of [node].flat(Infinity)) {
    if (isValidElement(child)) {
      // Fragment props are `{ children?: ReactNode }` by React's own contract; pinning the
      // Generic recovers the type without asserting.
      if (child.type === Fragment && isValidElement<{ children?: ReactNode }>(child)) {visitComposedChildren(child.props.children, sink, seen, scanned);}
      else {visitComposedChild(child, sink, seen, scanned);}
    }
  }
};

// Registry union for the composed slots; unknown roles stay ignored.
const pushComposedRegistry = (
  role: string,
  props: AnyChildProps,
  sink: ComposedChildSink,
  seen: Set<unknown>,
): void => {
  if (seen.has(props)) {
    return;
  }
  seen.add(props);
  if (ChildPropGuards.seriesBar(role, props)) {
    sink.barConfigs.push(props);
    upsertComposedSeries(sink.composedSeries, {
      dataKey: props.dataKey,
      showHighlight: false,
      stroke: props.stroke ?? props.fill ?? DEFAULT_COLOR,
      strokeWidth: 0,
    });
    return;
  }
  if (ChildPropGuards.area(role, props)) {
    sink.areaConfigs.push(props);
    upsertComposedSeries(sink.composedSeries, {
      dataKey: props.dataKey,
      dimOpacity: 0.6,
      showHighlight: props.showHighlight ?? true,
      stroke: props.stroke ?? props.fill ?? DEFAULT_COLOR,
      strokeWidth: props.strokeWidth ?? DEFAULT_AREA_STROKE_WIDTH,
      yAxisId: props.yAxisId,
    });
    return;
  }
  if (ChildPropGuards.line(role, props)) {
    sink.lineConfigs.push(props);
    upsertComposedSeries(sink.composedSeries, {
      dataKey: props.dataKey,
      dimOpacity: 0.3,
      showHighlight: props.showHighlight ?? true,
      stroke: props.stroke ?? DEFAULT_COLOR,
      strokeWidth: props.strokeWidth ?? DEFAULT_LINE_STROKE_WIDTH,
      yAxisId: props.yAxisId,
    });
    return;
  }
  if (ChildPropGuards.grid(role, props)) {
    sink.grid = props;
    return;
  }
  if (ChildPropGuards.xAxis(role, props)) {
    sink.xAxis = props;
    return;
  }
  if (ChildPropGuards.background(role, props)) {
    sink.background = props;
    return;
  }
  if (ChildPropGuards.tooltip(role, props)) {
    sink.tooltip = { enabled: true, ...props };
  }
};

// Shared empty union: keeps hook dependency arrays stable when no host runs.
const NO_REGISTRY_ENTRIES: readonly ChartChildRegistration[] = [];

const extractComposed = (
  children: ReactNode,
  registryEntries: readonly ChartChildRegistration[] = NO_REGISTRY_ENTRIES,
): ExtractedComposed => {
  const sink: ComposedChildSink = {
    areaConfigs: [],
    background: null,
    barConfigs: [],
    composedSeries: [],
    grid: null,
    lineConfigs: [],
    tooltip: NOTHING,
    xAxis: NOTHING,
  };
  const seen = new Set<unknown>();
  const scanned: ScannedComposedChild[] = [];
  visitComposedChildren(children, sink, seen, scanned);
  for (const entry of registryEntries) {
    if (!seen.has(entry.props) && !scanned.some((sibling) => sibling.role === entry.role && shallowEqualChildProps(sibling.props, entry.props))) {
      pushComposedRegistry(entry.role, entry.props, sink, seen);
    }
  }
  return {
    areaConfigs: sink.areaConfigs,
    background: sink.background,
    barConfigs: sink.barConfigs,
    composedSeries: sink.composedSeries,
    grid: sink.grid,
    lineConfigs: sink.lineConfigs,
    tooltip: sink.tooltip,
    xAxis: sink.xAxis,
  };
};

interface UseComposedChildrenResult {
  readonly areaConfigs: AreaConfig[];
  readonly background: BackgroundConfig | null;
  readonly barConfigs: SeriesBarConfig[];
  readonly composedProjectionEndMarkers: ChartDatum[];
  readonly composedProjectionLines: ChartDatum[];
  readonly composedSeries: ComposedSeriesEntry[];
  readonly composedTerminalMarkers: ChartDatum[];
  readonly grid: GridConfig | null;
  readonly lineConfigs: LineConfig[];
  readonly projectionConfigs: Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly xAxis: XAxisConfig | undefined;
}

const useComposedChildren = (
  children: ReactNode,
  registryEntries: readonly ChartChildRegistration[] = NO_REGISTRY_ENTRIES,
): UseComposedChildrenResult => {
  const { barConfigs, areaConfigs, lineConfigs, composedSeries, grid, xAxis, background, tooltip } =
    useMemo(() => extractComposed(children, registryEntries), [children, registryEntries]);
  const projectionConfigs = useMemo(() => extractProjectionLineConfigs(children), [children]);
  const composedProjectionLines = useMemo((): ChartDatum[] => {
    const out: ChartDatum[] = [];
    for (const child of [children].flat(Infinity)) {
      if (isValidElement(child) && child.type !== Fragment) {
        const role = roleOf(child.type);
        if (role === "projectionLine" && isValidElement<ChartDatum>(child)) {out.push(child.props);}
      }
    }
    return out;
  }, [children]);
  const composedProjectionEndMarkers = useMemo((): ChartDatum[] => {
    const out: ChartDatum[] = [];
    for (const child of [children].flat(Infinity)) {
      if (isValidElement(child) && child.type !== Fragment) {
        const role = roleOf(child.type);
        if (role === "projectionEndMarker" && isValidElement<ChartDatum>(child)) {out.push(child.props);}
      }
    }
    return out;
  }, [children]);
  const composedTerminalMarkers = useMemo((): ChartDatum[] => {
    const out: ChartDatum[] = [];
    for (const child of [children].flat(Infinity)) {
      if (isValidElement(child) && child.type !== Fragment) {
        const role = roleOf(child.type);
        if (role === "terminalMarker" && isValidElement<ChartDatum>(child)) {out.push(child.props);}
      }
    }
    return out;
  }, [children]);
  const projectionGradientBaseId = useSanitizedId();
  return {
    areaConfigs,
    background,
    barConfigs,
    composedProjectionEndMarkers,
    composedProjectionLines,
    composedSeries,
    composedTerminalMarkers,
    grid,
    lineConfigs,
    projectionConfigs,
    projectionGradientBaseId,
    tooltip,
    xAxis,
  };
};

export { extractComposed, useComposedChildren };
export type { ExtractedComposed, UseComposedChildrenResult };
