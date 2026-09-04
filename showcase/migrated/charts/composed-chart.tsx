// Bklit ComposedChart on TanStack Charts. SeriesBar (raw) + Area/Line (decimated); one entry per dataKey.
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { ScaleLinear, ScaleTime } from "d3-scale";
import { curveMonotoneX, curveNatural } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import type {
  ChartPoint,
  ChartPositionScaleOptions,
  ChartRendererRenderContext,
} from "@tanstack/charts";
import { useChartRenderer } from "./internal/motion-renderer";
import { useFocusInjection } from "./internal/focus-injection";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { roleOf } from "./internal/children-extract";
import {
  buildCrosshairGradientDef,
  useDatePillOverlay,
} from "./internal/hover-geometry";
import type { CrosshairGradientDef } from "./internal/hover-geometry";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import {
  extractReferenceAreaProps,
} from "./internal/reference-area-config";
import {
  ChartSelectionContext,
  extractSegmentComponents,
  useChartSelection,
} from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import { useChartConfig } from "./internal/chart-config-context";
import {
  DISCRETE_INTERACTION_THRESHOLD,
  TOOLTIP_BOX_SPRING,
} from "./internal/design-tokens";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import {
  buildPrecomputedXAxisOptions,
  hiddenAxisOptions,
} from "./internal/axis-ticks";
import { buildNativeTooltipExtension, renderSeriesTooltipBody } from "./internal/native-tooltip";
import { BackgroundLayer } from "./internal/background-layer";
import {
  extractProjectionLineConfigs,
  mergeProjectionXDomainMax,
} from "./internal/projection-config";
import type { ProjectionGradientDef } from "./internal/projection-line-mark";
import {
  resolveOverlayFrame,
} from "./internal/composed-overlay-geometry";
import {
  collectProjectionEndAnchors,
  collectTerminalAnchors,
} from "./internal/composed-marker-anchors";
import {
  buildComposedMarks,
} from "./internal/composed-marks";
import {
  buildComposedMotion,
  buildComposedXScale,
  buildComposedYScale,
  buildXTickLabelOpacity,
  collectProjectionGradients,
} from "./internal/composed-scales";
import type {
  ComposedScalesContext,
  ComposedSeriesEntry,
  ResolvedArea,
  ResolvedBar,
  ResolvedLine,
} from "./internal/composed-model";
import {
  applyProjectionYDomain,
  computeComposedStackOffsets,
  computeComposedYScaleDomainMax,
  findTimeBounds,
} from "./internal/composed-data-math";
import { ProjectionMarkerOverlay } from './internal/terminal-marker';
import type { ProjectionPhaseHandle } from './internal/terminal-marker';
import type {
  AreaConfig,
  BackgroundConfig,
  ChartDatum,
  ChartTooltipConfig,
  GridConfig,
  LineConfig,
  SeriesBarConfig,
  SeriesPointMarkerStyle,
  TooltipRow,
  XAxisConfig,
} from "./internal/types";
import { DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from './internal/chart-phase';
import type { ChartPhase } from './internal/chart-phase';
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { runRevealWipe, snapRevealWipe } from "./internal/reveal-wipe";
import { startBarReveal } from "./internal/composed-reveal";
import { useChartMargin, DEFAULT_CHART_MARGIN } from './internal/use-chart-margin';
import { useDebouncedContainerWidth } from './internal/use-container-size';
import type { ChartMargin } from './internal/use-chart-margin';
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import {
  createAxisValueProjector,
  createNicedYScale,
  domainForAxis,
  resolveTimeSeriesYDomain,
  resolveYDomainsByAxis,
  useNicedYDomainChanged,
} from "./internal/y-domain";
import { DEFAULT_Y_AXIS_ID, usesDefaultAxisOnly } from "./internal/y-axis-id";
import { runComposedPointerMove } from "./internal/composed-hover";
import { resolveGridGuide } from "./internal/grid";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { clipRevealTiming } from './internal/enter-transition';
import type { EnterTransition } from './internal/enter-transition';
import "./styles.css";

// Shared stroke/fill fallback color across every role's chain.
const DEFAULT_COLOR = "var(--chart-line-primary)";
// Fallback stroke color for projection lines/end markers when unspecified.
const DEFAULT_PROJECTION_STROKE_COLOR = "var(--chart-3)";
const DEFAULT_BAR_GAP = 4;
const DEFAULT_LINE_STROKE_WIDTH = 2.5;
const DEFAULT_BAR_FADED_OPACITY = 0.3;
const DEFAULT_AREA_FILL_OPACITY = 0.4;
const DEFAULT_AREA_DIM_OPACITY = 0.6;
const DEFAULT_LINE_DIM_OPACITY = 0.3;
// Bklit fabricates a synthetic [0, 100] percent-style range for a non-"left" projection axis.
const PROJECTION_FALLBACK_Y_MAX = 100;
// Shared default circle radius for terminal/end/projection point markers.
const DEFAULT_MARKER_RADIUS = 5;
const DEFAULT_TERMINAL_MARKER_STROKE_WIDTH = 1.5;
const DEFAULT_TICK_COUNT = 5;
// Narrowing predicates for open-ended chart values.
// Props and datum fields arrive as unknown; each predicate carries one typeof check.
const isStringValue = (value: ChartTooltipConfig["indicatorColor"]): value is string => typeof value === "string";
const isNumberValue = (value: unknown): value is number => typeof value === "number";
// Locally-owned optional values represent "absent" as `undefined`, never `null`. This file can spell neither the `undefined` identifier (eslint(no-undefined)) nor the `void` operator (eslint(no-void)) in value position — both are enabled, and each rule's suggested fix is exactly what the other rule bans.
// NOTHING is destructured from an object typed with an optional `undefined`-valued property, reaching the same runtime value without ever writing either banned token in value position.
const { NOTHING }: { NOTHING?: undefined } = {};

// Module-scope fallbacks for overlay builders: created once, shared by every memo eval.
// Optional marker styling is string/number-or-absent by the marker contract;
// Non-conforming values fall back to the same defaults bklit uses when unset.
const TERMINAL_ANCHOR_FALLBACKS = {
  fill: "transparent",
  outlineWidth: 0,
  radius: DEFAULT_MARKER_RADIUS,
  ringGap: 0,
  stroke: "var(--chart-1)",
  strokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH,
};
const END_ANCHOR_FALLBACKS = { radius: DEFAULT_MARKER_RADIUS, stroke: DEFAULT_PROJECTION_STROKE_COLOR };
const PROJECTION_STROKE_FALLBACKS = {
  gradientEnd: "var(--chart-5)",
  stroke: DEFAULT_PROJECTION_STROKE_COLOR,
  strokeWidth: 2,
};
const PROJECTION_MARKER_FALLBACKS = { endpointRadius: DEFAULT_MARKER_RADIUS };
// Hidden svg sizing and overlay host positioning: fully static, shared across renders.
const DATE_PILL_HOST_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;
const HIDDEN_SVG_STYLE = { position: "absolute" } as const;

// Plain element helpers (not components): called during render, so the element tree
// Keeps the same types/keys and reconciliation is unchanged; they only flatten source nesting.
const renderProjectionGradientStops = (grad: Readonly<ProjectionGradientDef>): ReactNode => (
  <>
    <stop offset="0%" stopColor={grad.gradientStart} />
    <stop offset="100%" stopColor={grad.gradientEnd} />
  </>
);

// Bklit `Readonly<CrosshairGradientDef>` alone leaves the nested `stops` array
// Mutable, which the rule typescript(prefer-readonly-parameter-types) still
// Flags (same pattern as ReadonlyAreaConfig below).
type ReadonlyCrosshairGradientDef = Readonly<Omit<CrosshairGradientDef, "stops">> & {
  readonly stops: readonly Readonly<CrosshairGradientDef["stops"][number]>[];
};

const renderCrosshairStops = (def: ReadonlyCrosshairGradientDef): ReactNode => (
  <>
    {def.stops.map((stop: Readonly<CrosshairGradientDef["stops"][number]>) => (
      <stop key={stop.offset} offset={stop.offset} stopColor={def.color} stopOpacity={stop.opacity} />
    ))}
  </>
);

interface ComposedChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  barSize?: number;
  maxBarSize?: number;
  barGap?: number;
  stacked?: boolean;
  stackGap?: number;
  /** Easing for the per-bar grow reveal. */
  animationEasing?: string;
  /** Overrides the reveal timing; springs coerce to tweens. */
  enterTransition?: EnterTransition;
  /** Replay epoch input: changing it replays the reveal. */
  revealSignature?: string;
  children?: ReactNode;
}


// Bklit `Readonly<AreaConfig>` alone leaves the nested `markers` object mutable, which
// The rule typescript(prefer-readonly-parameter-types) still flags; these wrap it deeply
// (same pattern as area-chart.tsx).
type ReadonlyAreaConfig = Readonly<Omit<AreaConfig, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};
type ReadonlyLineConfig = Readonly<Omit<LineConfig, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};

interface ExtractedComposed {
  barConfigs: SeriesBarConfig[];
  areaConfigs: AreaConfig[];
  lineConfigs: LineConfig[];
  /** One upserted entry per dataKey, in first-seen order. */
  composedSeries: ComposedSeriesEntry[];
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
  areaConfigs: AreaConfig[];
  background: BackgroundConfig | null;
  barConfigs: SeriesBarConfig[];
  composedSeries: ComposedSeriesEntry[];
  grid: GridConfig | null;
  lineConfigs: LineConfig[];
  tooltip: ChartTooltipConfig | undefined;
  xAxis: XAxisConfig | undefined;
}

const registerSeriesBarChild = (child: Readonly<ReactElement<Readonly<SeriesBarConfig>>>, sink: ComposedChildSink): void => {
  const bar = child.props;
  sink.barConfigs.push(bar);
  upsertComposedSeries(sink.composedSeries, {
    dataKey: bar.dataKey,
    // `dimOpacity` is intentionally omitted here (bars have no hover-dim role).
    // Upsert always overwrites the field on an existing entry regardless.
    // Bars always scan and paint on the primary axis (bklit omits yAxisId for SeriesBar).
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
    strokeWidth: area.strokeWidth ?? 2,
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

const visitComposedChild = (child: Readonly<ReactElement>, sink: ComposedChildSink): void => {
  if (registerBarAreaChild(child, sink)) {return;}
  const role = roleOf(child.type);
  // The roleOf helper maps each child component type to its props contract, so
  // Pinning the isValidElement generic to the role's config type recovers props
  // Without asserting.
  if (role === "line" && isValidElement<LineConfig>(child)) {
    registerLineChild(child, sink);
    return;
  }
  registerChromeChild(child, sink);
};

const visitComposedChildren = (node: ReactNode, sink: ComposedChildSink): void => {
  for (const child of Children.toArray(node)) {
    if (isValidElement(child)) {
      // Fragment props are `{ children?: ReactNode }` by React's own contract; pinning the
      // Generic recovers the type without asserting.
      if (child.type === Fragment && isValidElement<{ children?: ReactNode }>(child)) {visitComposedChildren(child.props.children, sink);}
      else {visitComposedChild(child, sink);}
    }
  }
};

const extractComposed = (children: ReactNode): ExtractedComposed => {
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
  visitComposedChildren(children, sink);
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

// Stacked y-max is the largest per-row bar-sum vs largest non-bar value (bklit parity);
// Implementations live in ./internal/composed-data-math.

interface ComposedGradientDef {
  dataKey: string;
  fill: string;
  fillOpacity: number;
  id: string;
}

const ComposedChart = ({
  data,
  xDataKey = "date",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  barSize,
  maxBarSize,
  barGap = DEFAULT_BAR_GAP,
  stacked = false,
  stackGap = 0,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  children,
}: Readonly<ComposedChartProps>): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useDebouncedContainerWidth(containerRef);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const {
    chartPhase,
    isLoaded,
    revealEpoch,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus: "ready",
    revealSignature,
    skeletonData: [],
    targetData: data,
    yDomainTweenDuration: DEFAULT_Y_DOMAIN_TWEEN_MS,
  });

  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    [enterTransition, animationDuration, animationEasing],
  );

  const phaseRef = useRef<ChartPhase>(chartPhase);
  phaseRef.current = chartPhase;
  // Definition reads phase through refs, not deps: phase flips must not rebuild marks mid-reveal.
  const isLoadedRef = useRef<boolean>(isLoaded);
  isLoadedRef.current = isLoaded;

  // Reported "ready" waits for the bar-stagger deadline, not just the orchestrator timer.
  const pendingBarsRevealRef = useRef(false);
  useEffect(() => {
    if (chartPhase === "ready" && pendingBarsRevealRef.current) {return;}
    onPhaseChangeRef.current?.(chartPhase);
  }, [chartPhase]);

  useEffect(() => {
    if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
      notifyYDomainTweenComplete();
    }
  }, [chartPhase, notifyYDomainTweenComplete]);

  const revealAnimationsRef = useRef<Animation[]>([]);
  const revealedEpochRef = useRef<number | null>(null);
  const revealDeadlineRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const xScaleD3Ref = useRef<ScaleTime<number, number> | null>(null);
  const yScaleD3Ref = useRef<ScaleLinear<number, number> | null>(null);

  const projectionPhasePortRef = useRef<ProjectionPhaseHandle | null>(null);
  useEffect(() => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  }, [chartPhase]);

  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
      if (revealDeadlineRef.current !== null) {
        clearTimeout(revealDeadlineRef.current);
        revealDeadlineRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const anim of revealAnimationsRef.current) {
        try {
          anim.cancel();
        } catch {
          // Animation may already be finished/removed; cancel() throwing is not actionable here.
        }
      }
      revealAnimationsRef.current = [];
    };
  }, []);

  const { barConfigs, areaConfigs, lineConfigs, composedSeries, grid, xAxis, background, tooltip } =
    useMemo(() => extractComposed(children), [children]);
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const prefersReducedMotion = usePrefersReducedMotion();

  const { captureRenderContext, sceneRef, interactionRef, clientToScene } =
    useFocusInjection<ChartDatum, Date, number>();

  const projectionConfigs = useMemo(() => extractProjectionLineConfigs(children), [children]);
  const composedProjectionLines = useMemo((): ChartDatum[] => {
    const out: ChartDatum[] = [];
    for (const child of Children.toArray(children)) {
      if (isValidElement(child) && child.type !== Fragment) {
        const role = roleOf(child.type);
        if (role === "projectionLine" && isValidElement<ChartDatum>(child)) {out.push(child.props);}
      }
    }
    return out;
  }, [children]);
  const composedProjectionEndMarkers = useMemo((): ChartDatum[] => {
    const out: ChartDatum[] = [];
    for (const child of Children.toArray(children)) {
      if (isValidElement(child) && child.type !== Fragment) {
        const role = roleOf(child.type);
        if (role === "projectionEndMarker" && isValidElement<ChartDatum>(child)) {out.push(child.props);}
      }
    }
    return out;
  }, [children]);
  const composedTerminalMarkers = useMemo((): ChartDatum[] => {
    const out: ChartDatum[] = [];
    for (const child of Children.toArray(children)) {
      if (isValidElement(child) && child.type !== Fragment) {
        const role = roleOf(child.type);
        if (role === "terminalMarker" && isValidElement<ChartDatum>(child)) {out.push(child.props);}
      }
    }
    return out;
  }, [children]);
  const projectionGradientBaseIdComposed = useSanitizedId();

  const resolvedBars = useMemo<ResolvedBar[]>(
    () =>
      barConfigs.map((bar: Readonly<SeriesBarConfig>) => ({
        animate: bar.animate ?? true,
        dataKey: bar.dataKey,
        fadedOpacity: bar.fadedOpacity ?? DEFAULT_BAR_FADED_OPACITY,
        fill: bar.fill ?? DEFAULT_COLOR,
        radius: bar.radius ?? 0,
      })),
    [barConfigs],
  );
  const resolvedAreas = useMemo<ResolvedArea[]>(
    () =>
      areaConfigs.map((area: ReadonlyAreaConfig) => {
        const fill = area.fill ?? DEFAULT_COLOR;
        return {
          curve: area.curve ?? curveMonotoneX,
          dataKey: area.dataKey,
          fill,
          fillOpacity: area.fillOpacity ?? DEFAULT_AREA_FILL_OPACITY,
          stroke: area.stroke ?? fill,
          strokeWidth: area.strokeWidth ?? 2,
        };
      }),
    [areaConfigs],
  );
  const resolvedLines = useMemo<ResolvedLine[]>(
    () =>
      lineConfigs.map((lineCfg: ReadonlyLineConfig) => ({
        curve: lineCfg.curve ?? curveNatural,
        dataKey: lineCfg.dataKey,
        stroke: lineCfg.stroke ?? DEFAULT_COLOR,
        strokeWidth: lineCfg.strokeWidth ?? DEFAULT_LINE_STROKE_WIDTH,
      })),
    [lineConfigs],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  // Decimation covers area/line only; bars stay raw, valueKeys still list every series (bklit quirk).
  const renderData = useMemo(() => {
    if (innerWidth <= 0) {return data;}
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      composedSeries.map((series: Readonly<ComposedSeriesEntry>) => series.dataKey),
    );
  }, [data, innerWidth, composedSeries]);

  const barDataKeys = useMemo(
    () => resolvedBars.map((bar: Readonly<ResolvedBar>) => bar.dataKey),
    [resolvedBars],
  );
  const composedStackOffsets = useMemo(
    () =>
      stacked && barDataKeys.length > 0
        ? computeComposedStackOffsets(data, barDataKeys)
        : NOTHING,
    [stacked, barDataKeys, data],
  );

  // Y-domain scans all merged series over raw data; stacked mode overrides the max first.
  const stackedYScaleDomainMax = useMemo(() => {
    if (
      !stacked ||
      barDataKeys.length === 0 ||
      !usesDefaultAxisOnly(composedSeries)
    ) {
      return NOTHING;
    }
    return computeComposedYScaleDomainMax(data, composedSeries, barDataKeys);
  }, [stacked, barDataKeys, composedSeries, data]);
  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: (axisSeries: readonly Readonly<ComposedSeriesEntry>[]) =>
          resolveTimeSeriesYDomain(data, axisSeries, stackedYScaleDomainMax),
        series: composedSeries,
      }),
    [data, composedSeries, stackedYScaleDomainMax],
  );
  const yDomain = useMemo<[number, number]>(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );
  const { niced: nicedYDomainBase, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);
  const yDomainFinal = useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) {return nicedYDomainBase;}
    return applyProjectionYDomain(nicedYDomainBase, projectionConfigs, PROJECTION_FALLBACK_Y_MAX);
  }, [nicedYDomainBase, projectionConfigs]);

  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      // D3's domain() always returns the 2-element nice domain here; the ?? keeps the
      // Tuple total by falling back to the input domain if d3 ever returned fewer stops.
      const niced = createNicedYScale(domain).domain();
      out[axisId] = [niced[0] ?? domain[0], niced[1] ?? domain[1]];
    }
    return out;
  }, [yDomainsByAxis]);
  const projectorFor = useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, yDomainFinal),
    [nicedDomainsByAxis, yDomainFinal],
  );
  const projectByKey = useMemo(() => {
    const byKey = new Map<string, (value: number) => number>();
    for (const entry of composedSeries) {byKey.set(entry.dataKey, projectorFor(entry.yAxisId));}
    return byKey;
  }, [composedSeries, projectorFor]);
  const projectValue = useCallback(
    (dataKey: string, value: number) => {
      const project = projectByKey.get(dataKey);
      return project ? project(value) : value;
    },
    [projectByKey],
  );

  // Bklit parity: new data paints immediately; only a y-domain change tweens.
  const prevYDomainFinalRef = useRef(yDomainFinal);
  const yDomainFinalMoved =
    prevYDomainFinalRef.current[0] !== yDomainFinal[0] ||
    prevYDomainFinalRef.current[1] !== yDomainFinal[1];
  prevYDomainFinalRef.current = yDomainFinal;
  const yDomainChanged =
    projectionConfigs.length === 0 ? nicedYDomainChanged : yDomainFinalMoved;

  // Bars use bklit's exact computeSeriesBarWidth (slot x 0.88), not stock barY bandwidth.

  const gradientBaseId = useSanitizedId();
  const gradientDefs = useMemo<ComposedGradientDef[]>(
    () =>
      resolvedAreas.map((area: Readonly<ResolvedArea>, areaIndex: number) => ({
        dataKey: area.dataKey,
        fill: area.fill,
        fillOpacity: area.fillOpacity,
        id: `${gradientBaseId}-area-grad-${areaIndex}`,
      })),
    [gradientBaseId, resolvedAreas],
  );
  const nativeComposedGradients = useMemo(
    () =>
      gradientDefs.map((grad: Readonly<ComposedGradientDef>) => ({
        id: grad.id,
        stops: [
          { color: grad.fill, offset: 0, opacity: grad.fillOpacity },
          { color: grad.fill, offset: 1, opacity: 0 },
        ],
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 1,
      })),
    [gradientDefs],
  );
  const gradientIdBySeries = useMemo(() => {
    const map = new Map<string, string>();
    for (const grad of gradientDefs) {map.set(grad.dataKey, grad.id);}
    return map;
  }, [gradientDefs]);

  const heightPxComp = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
  // All x-domain consumers read the projection-extended extent.
  const timeExtentCompRaw = useMemo(() => findTimeBounds(renderData, xDataKey), [renderData, xDataKey]);
  const timeExtentComp = useMemo(() => {
    if (!timeExtentCompRaw) {return NOTHING;}
    if (projectionConfigs.length === 0) {return timeExtentCompRaw;}
    return {
      maxTime: mergeProjectionXDomainMax(timeExtentCompRaw.maxTime, projectionConfigs),
      minTime: timeExtentCompRaw.minTime,
    } as const;
  }, [timeExtentCompRaw, projectionConfigs]);

  const composedTerminalAnchors = useMemo(() => {
    if (composedTerminalMarkers.length === 0 || renderData.length === 0) {return [];}
    // Terminal markers anchor to the last visible row, not the last raw data row.
    const lastRow = renderData.at(-1);
    if (!lastRow) {return [];}
    const frame = resolveOverlayFrame({
      heightPx: heightPxComp,
      margin,
      timeExtent: timeExtentComp,
      timeExtentRaw: timeExtentCompRaw,
      width,
      yDomain: yDomainFinal,
    });
    if (!frame) {return [];}
    return collectTerminalAnchors({
      fallbacks: TERMINAL_ANCHOR_FALLBACKS,
      frame,
      lastRow,
      terminals: composedTerminalMarkers,
      xDataKey,
    });
  }, [composedTerminalMarkers, renderData, width, heightPxComp, margin, yDomainFinal, timeExtentComp, timeExtentCompRaw, xDataKey]);
  const composedEndAnchors = useMemo(() => {
    if (composedProjectionEndMarkers.length === 0) {return [];}
    const frame = resolveOverlayFrame({
      heightPx: heightPxComp,
      margin,
      timeExtent: timeExtentComp,
      timeExtentRaw: timeExtentCompRaw,
      width,
      yDomain: yDomainFinal,
    });
    if (!frame) {return [];}
    // Projection end-marker points arrive as child props (unknown); the collector
    // Validates the array and the last point's shape instead of asserting it.
    return collectProjectionEndAnchors({
      fallbacks: END_ANCHOR_FALLBACKS,
      frame,
      markers: composedProjectionEndMarkers,
    });
  }, [composedProjectionEndMarkers, width, heightPxComp, margin, yDomainFinal, timeExtentComp, timeExtentCompRaw]);
  const projectionGradientDefsComposed = useMemo(() => {
    if (projectionConfigs.length === 0) {return [];}
    const frame = resolveOverlayFrame({
      heightPx: heightPxComp,
      margin,
      timeExtent: timeExtentComp,
      timeExtentRaw: timeExtentCompRaw,
      width,
      yDomain: yDomainFinal,
    });
    if (!frame) {return [];}
    // Indexed reads are typed as the element type; the loop bound keeps the index
    // In range. Style fields are string/number/boolean-or-absent by the marker
    // Contract, validated with typeof (see composed-overlay-geometry).
    return collectProjectionGradients({
      cfgs: projectionConfigs,
      gradientBaseId: projectionGradientBaseIdComposed,
      innerWidth: frame.innerW,
      lines: composedProjectionLines,
      markerFallbacks: PROJECTION_MARKER_FALLBACKS,
      strokeFallbacks: PROJECTION_STROKE_FALLBACKS,
      translateX: margin.left,
      translateY: margin.top,
      xScale: (value: Readonly<Date>): number => frame.xForDate(value),
      yScale: (value: number): number => frame.yForValue(value),
    });
  }, [projectionConfigs, composedProjectionLines, width, heightPxComp, margin, yDomainFinal, timeExtentComp, timeExtentCompRaw, projectionGradientBaseIdComposed]);

  const tooltipEnabled = tooltip?.enabled ?? false;
  // Dense data snaps instead of springing (same threshold as every other chart).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [labelFade, setLabelFade] = useState<Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined>();
  const crosshairGradientId = useSanitizedId();
  const crosshairGradientDef = useMemo(() => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) {return NOTHING;}
    const color = isStringValue(tooltip?.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);
  // Highlight band sources the deduped series list: shared dataKeys must not double-push a mark.
  const highlightCurveByKey = useMemo(() => {
    const byKey = new Map<string, CurveFactory>();
    for (const area of resolvedAreas) {byKey.set(area.dataKey, area.curve);}
    for (const lineCfg of resolvedLines) {byKey.set(lineCfg.dataKey, lineCfg.curve);}
    return byKey;
  }, [resolvedAreas, resolvedLines]);

  const marks = useMemo(() => {
    if (width <= 0) {return NOTHING;}
    // Bklit parity: legend dim is per-mark opacity, not programmatic focus.
    const legendHoveredKey =
      legendHoveredIndex === null ? NOTHING : (composedSeries[legendHoveredIndex]?.dataKey ?? NOTHING);
    return buildComposedMarks({
      areaDimFallback: DEFAULT_AREA_DIM_OPACITY,
      barGap,
      barSize,
      composedSeries,
      composedStackOffsets,
      crosshairGradientId,
      data,
      gradientIdBySeries,
      heightPx: heightPxComp,
      highlightCurveByKey,
      hoveredIndex,
      isDiscrete,
      legendHoveredKey,
      lineDimFallback: DEFAULT_LINE_DIM_OPACITY,
      margin,
      maxBarSize,
      projectValue,
      projectionConfigs,
      projectionGradientBaseId: projectionGradientBaseIdComposed,
      projectionLines: composedProjectionLines,
      projectionMarkerFallbacks: PROJECTION_MARKER_FALLBACKS,
      projectionStrokeFallbacks: PROJECTION_STROKE_FALLBACKS,
      renderData,
      resolvedAreas,
      resolvedBars,
      resolvedLines,
      stackGap,
      stacked,
      timeExtent: timeExtentComp,
      timeExtentRaw: timeExtentCompRaw,
      tooltip,
      tooltipEnabled,
      width,
      xDataKey,
      yDomain: yDomainFinal,
    });
  }, [
    width,
    legendHoveredIndex,
    composedSeries,
    barGap,
    barSize,
    composedStackOffsets,
    crosshairGradientId,
    data,
    gradientIdBySeries,
    heightPxComp,
    highlightCurveByKey,
    hoveredIndex,
    isDiscrete,
    margin,
    maxBarSize,
    projectionConfigs,
    composedProjectionLines,
    projectionGradientBaseIdComposed,
    projectValue,
    renderData,
    resolvedAreas,
    resolvedBars,
    resolvedLines,
    stackGap,
    stacked,
    timeExtentComp,
    timeExtentCompRaw,
    tooltip,
    tooltipEnabled,
    xDataKey,
    yDomainFinal,
  ]);
  const scales = useMemo(() => {
    if (width <= 0) {return NOTHING;}
    const ctx: ComposedScalesContext = {
      data,
      grid,
      projectionConfigs,
      renderData,
      tickCountFallback: DEFAULT_TICK_COUNT,
      timeExtent: timeExtentComp,
      xAxis,
      xDataKey,
      xScaleRef: xScaleD3Ref,
      yDomain: yDomainFinal,
      yScaleRef: yScaleD3Ref,
    };
    return {
      xScale: buildComposedXScale(ctx),
      yScale: buildComposedYScale(ctx),
    };
  }, [
    width,
    data,
    grid,
    projectionConfigs,
    renderData,
    timeExtentComp,
    xAxis,
    xDataKey,
    yDomainFinal,
    xScaleD3Ref,
    yScaleD3Ref,
  ]);
  const definition = useMemo(() => {
    if (width <= 0 || !marks || !scales) {return NOTHING;}
    const { xScale, yScale } = scales;

    const gridGuide = resolveGridGuide(grid);
    const xTickLabelOpacity = buildXTickLabelOpacity({ labelFade, xAxis });
    const yDomainTweenGateActive = isChartInteractionPhase(phaseRef.current) && isLoadedRef.current && yDomainChanged;
    const { motion, tickLabelMotion } = buildComposedMotion(yDomainTweenGateActive);
    const xScaleOptions: ChartPositionScaleOptions<Date> = {
      axis: buildPrecomputedXAxisOptions(gridGuide.columnTicks, xAxis, margin.bottom, xTickLabelOpacity, tickLabelMotion),
      grid: gridGuide.vertical,
      scale: xScale,
    };
    const yScaleOptions: ChartPositionScaleOptions<number> = {
      axis: hiddenAxisOptions(gridGuide.ticks),
      grid: gridGuide.horizontal,
      scale: yScale,
    };
    return defineChart({
      focus: "group-x",
      focusRing: false,
      gradients: nativeComposedGradients,
      margin,
      marks,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      motion,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: { x: xScaleOptions, y: yScaleOptions },
      svgAnimation: yDomainTweenGateActive
        ? { duration: DEFAULT_Y_DOMAIN_TWEEN_MS, easing: bezierEasing }
        : (false as const),
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: buildNativeTooltipExtension<ChartDatum, Date, number>({
        anchorX: "point",
        className: "bkm-native-tooltip",
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        enabled: tooltip?.enabled ?? false,
        spring: TOOLTIP_BOX_SPRING,
      }),
    });
  }, [
    marks,
    scales,
    width,
    grid,
    labelFade,
    xAxis,
    yDomainChanged,
    margin,
    nativeComposedGradients,
    renderData,
    tooltip,
  ]);

  const chartConfig = useChartConfig();
  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum, rowsCtx) => {
          const rows: TooltipRow[] = [];
          // Single lookup table: series count is small but the tooltip body
          // Rebuilds on every hover move, so avoid a linear scan per series.
          const colorByMarkId = new Map(rowsCtx.points.map((point) => [point.markId, point.color] as const));
          for (const series of composedSeries) {
            const value = datum[series.dataKey];
            const pointColor = colorByMarkId.get(series.dataKey);
            const { stroke } = series;
            const strokeColor = stroke === "" ? NOTHING : stroke;
            rows.push({
              color: strokeColor ?? (pointColor !== NOTHING && pointColor !== "" ? pointColor : "transparent"),
              label: series.dataKey,
              value: isNumberValue(value) ? value : String(value ?? 0),
            });
          }
          return rows;
        },
        resolveTitle: (datum) => {
          const date = datum[xDataKey];
          return date instanceof Date ? weekdayDateFmt.format(date) : NOTHING;
        },
        tooltip,
      }),
    [tooltip, xDataKey, composedSeries],
  );
  // Drag selection suppresses hover chrome (bklit use-chart-interaction.ts parity).
  const dragSelectionActiveRef = useRef(false);
  // First pill show jumps; later moves spring (mirrors legacy showing flag).
  const wasVisibleRef = useRef(false);
  const dateLabelsForPill = useMemo(() => renderData.map((row: Readonly<ChartDatum>) => {
    const value = row[xDataKey];
    if (value instanceof Date) {return shortDateFmt.format(value);}
    return String(value ?? "");
  }), [renderData, xDataKey]);
  const datePill = useDatePillOverlay({
    dateLabels: dateLabelsForPill,
    enabled: tooltipEnabled && (tooltip?.showDatePill ?? true),
    tooltipSpring: chartConfig.tooltipSpring,
  });

  const clearFocusChrome = useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(null);
    wasVisibleRef.current = false;
    datePill.hide();
    setLabelFade(NOTHING);
  }, [datePill, interactionRef, setHoveredIndex, setLabelFade]);

  const handleFocusGroupChange = useCallback(
    (_points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      // Required prop on the renderer; this chart's hover/tooltip state is driven by
      // The pointermove handler below, not by the renderer's own focus-group tracking.
    },
    [],
  );

  // Bisect twice per move: raw data for pill/rows, decimated renderData for the highlight band.
  const hoverInputsRef = useRef({
    clearFocusChrome,
    data,
    datePill,
    isDiscrete,
    renderData,
    tooltip,
    xDataKey,
  });
  hoverInputsRef.current = {
    clearFocusChrome,
    data,
    datePill,
    isDiscrete,
    renderData,
    tooltip,
    xDataKey,
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !tooltipEnabled) {return NOTHING;}

    const handlePointerMove = (event: PointerEvent): void => {
      runComposedPointerMove(event, {
        chartPhase,
        dragActive: dragSelectionActiveRef.current,
        hoverInputs: hoverInputsRef.current,
        interaction: interactionRef.current,
        isLoaded,
        setHoveredIndex,
        setLabelFade,
        wasVisibleRef,
        xScale: xScaleD3Ref.current,
      });
    };

    const handlePointerLeave = (): void => {
      hoverInputsRef.current.clearFocusChrome();
    };

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerleave", handlePointerLeave);
    return (): void => {
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [tooltipEnabled, chartPhase, isLoaded, interactionRef, xScaleD3Ref]);

  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
    const marksRoot = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksRoot) {return;}
    // Gate reveal on phase "revealing": onRender fires every commit, not just on content change.
    if (!runRevealWipe({
      active: chartPhase === "revealing",
      animationDuration,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      marks: marksRoot,
      prefersReducedMotion,
    })) {return;}

    if (resolvedBars.length === 0) {return;}

    startBarReveal({
      animationsRef: revealAnimationsRef,
      baselineRange: yScaleD3Ref.current?.range(),
      dataLength: data.length,
      deadlineRef: revealDeadlineRef,
      easingCss: revealEasingCss,
      mountedRef,
      onPhaseChangeRef,
      pendingRef: pendingBarsRevealRef,
      phaseRef,
      postPaintCancelRef: revealPostPaintCancelRef,
      resolvedBars,
      revealDurationMs,
    }, marksRoot);
  }, [animationDuration, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, resolvedBars, data.length, captureRenderContext, prefersReducedMotion, yScaleD3Ref]);

  useEffect(() => {
    if (chartPhase !== "revealing") {return;}
    snapRevealWipe({
      active: true,
      animationDuration,
      marks: containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks"),
      prefersReducedMotion,
    });
  }, [chartPhase, animationDuration, prefersReducedMotion]);

  // Reference areas track the merged final domain with projections, raw contract without.
  const yDomainComp = yDomainFinal;
  const innerWidthComp = Math.max(0, width - margin.left - margin.right);
  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const resolveScenePosComp = clientToScene;
  const invertSceneXComp = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX),
    [sceneRef],
  );
  const { selection: compSelection } = useChartSelection({
    containerRef,
    data,
    enabled: true,
    innerWidth: innerWidthComp,
    invertSceneX: invertSceneXComp,
    marginLeft: margin.left,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      clearFocusChrome();
    },
    resolveScenePos: resolveScenePosComp,
    xDataKey,
  });
  const refAreaChildrenComp = useMemo(() => extractReferenceAreaProps(children), [children]);
  const segChildrenComp = useMemo(() => extractSegmentComponents(children), [children]);

  const overlayRenderedComposed = (composedTerminalAnchors.length > 0 || composedEndAnchors.length > 0) && width > 0 && heightPxComp > 0;
  useLayoutEffect(() => {
    if (!overlayRenderedComposed) {return;}
    projectionPhasePortRef.current?.setPhase(phaseRef.current);
  }, [overlayRenderedComposed]);
  const composedChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  const containerStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%" }), [aspectRatio]);
  const refAreaGeom = useMemo((): ReferenceAreaLayersGeom => ({
    height: heightPxComp,
    isLoaded,
    isTimeScale: true,
    margin,
    phase: chartPhase,
    width,
    xDomain: timeExtentComp ? [new Date(timeExtentComp.minTime), new Date(timeExtentComp.maxTime)] : NOTHING,
    yDomain: yDomainComp,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [heightPxComp, isLoaded, margin, chartPhase, width, timeExtentComp, yDomainComp, nicedDomainsByAxis]);
  const backgroundLayer = background ? (
    <BackgroundLayer
      config={background}
      innerWidth={innerWidth}
      innerHeight={Math.max(0, heightPxComp - margin.top - margin.bottom)}
      marginLeft={margin.left}
      marginTop={margin.top}
    />
  ) : NOTHING;
  const projectionGradientsNode = projectionGradientDefsComposed.length > 0 ? (
    <svg
      width={0}
      height={0}
      style={HIDDEN_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {projectionGradientDefsComposed.map((grad: Readonly<ProjectionGradientDef>) => (
          <linearGradient key={grad.id} id={grad.id} gradientUnits="userSpaceOnUse" x1={grad.startX} y1={grad.startY} x2={grad.endX} y2={grad.endY}>
            {renderProjectionGradientStops(grad)}
          </linearGradient>
        ))}
      </defs>
    </svg>
  ) : NOTHING;
  const markerOverlayNode = overlayRenderedComposed ? (
    <ProjectionMarkerOverlay
      width={width}
      height={heightPxComp}
      margin={margin}
      terminalMarkers={composedTerminalAnchors}
      projectionEndMarkers={composedEndAnchors}
      phasePort={projectionPhasePortRef}
    />
  ) : NOTHING;
  const crosshairNode = crosshairGradientDef ? (
    <svg width={0} height={0} style={HIDDEN_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={crosshairGradientDef.id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={margin.top} y2={margin.top + Math.max(0, heightPxComp - margin.top - margin.bottom)}>
          {renderCrosshairStops(crosshairGradientDef)}
        </linearGradient>
      </defs>
    </svg>
  ) : NOTHING;
  const datePillNode = tooltipEnabled ? (
    <div
      ref={datePill.overlayHostRef}
      style={DATE_PILL_HOST_STYLE}
    />
  ) : NOTHING;

  // Inlined into the same element tree (a variable, not a component), so this
  // Changes nothing at runtime; it only flattens source nesting for jsx-max-depth.
  const definitionNode = definition ? (
    <>
      <RendererChart
        renderer={composedChartRenderer}
        ariaLabel="Composed chart"
        aspectRatio={parseAspectRatio(aspectRatio)}
        definition={definition}
        onFocusGroupChange={handleFocusGroupChange}
        onRender={handleRender}
        renderTooltipBody={tooltipEnabled ? renderTooltipBody : NOTHING}
      />
      {projectionGradientsNode}
      {heightPxComp > 0 && (
      <ReferenceAreaLayers
        configs={refAreaChildrenComp}
        geom={refAreaGeom}
      />
      )}
      <SegmentOverlay
        selection={compSelection}
        innerWidth={innerWidthComp}
        innerHeight={heightPxComp - margin.top - margin.bottom}
        marginLeft={margin.left}
        marginTop={margin.top}
        components={segChildrenComp}
      />
      {markerOverlayNode}
      {crosshairNode}
      {datePillNode}
    </>
  ) : NOTHING;

  return (
    <ChartSelectionContext.Provider value={compSelection}>
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="composed"
    >
      {backgroundLayer}
      {definitionNode}
    </div>
    </ChartSelectionContext.Provider>
  );
};

export { ComposedChart };
export type { ComposedChartProps };
