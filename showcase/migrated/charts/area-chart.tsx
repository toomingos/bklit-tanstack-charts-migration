// Bklit AreaChart on TanStack Charts. Two marks per series (areaFill + lineY); hover dim 0.6.
import {
  Fragment,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, Dispatch, ReactElement, ReactNode, SetStateAction } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveMonotoneX } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { defineChart } from "@tanstack/charts/scene";
import { lineY } from "@tanstack/charts/line";
import type {
  ChartAxisTickLabelContext,
  ChartControl,
  ChartMark,
  ChartMotionContext,
  ChartMotionTiming,
  ChartPoint,
  ChartPositionScaleOptions,
  ChartRendererRenderContext,
  ChartScale,
  ChartScaleResolveContext,
  DomChartDefinition,
  SceneStyle,
} from "@tanstack/charts";
import { brushX } from '@tanstack/charts/interaction/brush';
import type { BrushRange, BrushXChange } from '@tanstack/charts/interaction/brush';
import { controlledSignal } from "@tanstack/charts/interaction/signal";
import { useChartRenderer } from "./internal/motion-renderer";
import { areaFill } from "./internal/area-fill-mark";
import { patternAreaMark } from "./internal/pattern-area-mark";
import { renderPatternPreset } from "./internal/pattern-preset-render";
import type { PatternPresetId } from "./internal/pattern-preset";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./internal/children-extract";
import {
  buildCrosshairGradientDef,
  buildHoverDotMark,
  buildIndicatorMark,
  isFocusOutsideXDomain,
  resolveHoverDotFill,
  pointerSeriesDimStates,
  useDatePillOverlay,
} from "./internal/hover-geometry";
import { buildHighlightBandMarks } from "./internal/highlight-band";
import type { CrosshairGradientDef } from "./internal/hover-geometry";
import { useFocusInjection } from "./internal/focus-injection";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import {
  extractReferenceAreaProps,
} from "./internal/reference-area-config";
import {
  ChartSelectionContext,
  extractSegmentComponents,
  useChartSelection,
} from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import {
  extractProjectionLineConfigs,
  mergeProjectionXDomainMax,
  mergeProjectionYDomain,
} from "./internal/projection-config";
import type { ProjectionLineConfig } from "./internal/projection-config";
import { projectionLineMark, resolveProjectionGradientDef } from "./internal/projection-line-mark";
import type { ProjectionGradientDef } from "./internal/projection-line-mark";
import { ProjectionMarkerOverlay } from './internal/terminal-marker';
import type { ProjectionPhaseHandle } from './internal/terminal-marker';
import { toDate } from "./internal/coerce-date";
import { timeToPixelX } from "./internal/x-time-scale";
import {
  DISCRETE_INTERACTION_THRESHOLD,
  FADE_BUFFER,
  SERIES_MARKER_ENTER_MS,
  TICKER_HALF_WIDTH,
  TOOLTIP_BOX_SPRING,
} from "./internal/design-tokens";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import {
  buildPrecomputedXAxisOptions,
  buildXAxisTickValues,
  buildYAxisOptions,
  hiddenAxisOptions,
  tickLabelFadeOpacity,
} from "./internal/axis-ticks";
import { buildNativeTooltipExtension, renderSeriesTooltipBody } from "./internal/native-tooltip";
import type { AreaConfig, BrushChildConfig, ChartDatum, ChartMarker, ChartStatus, PatternAreaConfig, ProjectionLineChildConfig, SeriesPointMarkerStyle } from "./internal/types";
import { DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from './internal/chart-phase';
import type { ChartPhase } from './internal/chart-phase';
import { useChartConfig } from "./internal/chart-config-context";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { resolveGridGuide } from "./internal/grid";
import { resolveFadeEdgesMask } from "./internal/fade-mask";
import { buildLoadingSkeletonRows } from "./internal/loading-chrome";
import { LoadingLabel } from "./internal/loading-label";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import type { DatePillController } from "./internal/date-pill-overlay";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./internal/use-chart-margin";
import { useMeasuredRect } from "./internal/use-container-size";
import type { ChartMargin } from "./internal/use-chart-margin";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
import {
  createAxisValueProjector,
  createNicedYScale,
  domainForAxis,
  resolveTimeSeriesYDomain,
  resolveYDomainsByAxis,
  useNicedYDomainChanged,
} from "./internal/y-domain";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import { filterDataByXDomain, createXAccessor, snapBrushRangeToValues } from "./internal/brush-selection";
import { BrushChrome } from './internal/brush-chrome';
import { selectionToPixelExtent } from "./internal/brush-chrome-helpers";
import type { BrushHost } from './internal/brush-chrome';
import { DashTailOverlay, resolveDashTailBounds } from "./internal/dash-tail";
import { buildProjectionEndAnchors, buildTerminalAnchors } from "./internal/line-marker-anchors";
import { buildMarkerGradientDefs, buildMarkerMarks } from "./internal/series-marker-mark";
import { ChartMarkersOverlay } from "./internal/chart-markers";
import { createActiveMarkersStore } from "./internal/active-markers-store";
import { MarkerActiveTooltipProvider } from "./internal/marker-active-tooltip-provider";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { runRevealWipe, snapRevealWipe } from "./internal/reveal-wipe";
import type { RevealWipeEpochRef } from "./internal/reveal-wipe";
import { clipRevealTiming } from './internal/enter-transition';
import type { EnterTransition } from './internal/enter-transition';
import "./styles.css";

const AREA_DIM_OPACITY = 0.6;
// Bklit default area-fill alpha when a series omits fillOpacity.
const DEFAULT_AREA_FILL_OPACITY = 0.4;
// Gradient span clamps to this fraction at minimum so the stop never collapses to zero-width.
const MIN_GRADIENT_SPAN_FRACTION = 0.01;
const PERCENT_MULTIPLIER = 100;
// Below this, a measured box height reads as "not yet measured" (falls back to aspectRatio).
const MIN_MEASURED_HEIGHT_PX = 0.5;
// Terminal/projection-end marker default radius when a series omits one.
const DEFAULT_TERMINAL_MARKER_RADIUS_PX = 5;
// Terminal marker default stroke width when a series omits one.
const DEFAULT_TERMINAL_MARKER_STROKE_WIDTH_PX = 1.5;
// Projection line default stroke width when a series omits one.
const DEFAULT_PROJECTION_STROKE_WIDTH_PX = 2;
// Fallback y-domain tween duration when yDomainTween is `true` (or truthy) but no explicit ms was given.
const DEFAULT_Y_DOMAIN_TWEEN_FALLBACK_MS = 500;
// Fallback d3 tick count when the axis config omits numTicks.
const DEFAULT_TICK_COUNT = 5;
// Series-marker default radius when a marker config omits one.
const DEFAULT_SERIES_MARKER_RADIUS_PX = 5;
// Active-highlight halo padding as a fraction of the marker radius.
const MARKER_HIGHLIGHT_PAD_RATIO = 0.35;
// Fallback accent stroke for terminal/projection chrome when a series omits one.
const PROJECTION_FALLBACK_STROKE = "var(--chart-3)";
const MS_PER_SECOND = 1000;

// Native brushX painting hidden; the BrushChrome portal reproduces bklit visuals.
const BRUSH_NATIVE_HIDDEN_STYLE: SceneStyle = {
  fill: "transparent",
  fillOpacity: 0,
  stroke: "transparent",
  strokeOpacity: 0,
};
const EMPTY_BRUSH_CONTROLS: readonly ChartControl<Date, number>[] = [];
// Hidden svg hosts for gradient/clip defs; zero-size and removed from layout.
const HIDDEN_DEF_SVG_STYLE: CSSProperties = { position: "absolute" };
// Date pill overlay host; fills the plot and ignores pointer events.
const DATE_PILL_HOST_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };

interface AreaChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  status?: ChartStatus;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  loadingLabel?: string;
  children?: ReactNode;
  style?: CSSProperties;
  animationEasing?: string;
  yDomainTween?: boolean;
  yDomainTweenDuration?: number;
  xDomain?: [Date, Date];
  /** Accepted but inert (no columnWidth consumer here); kept for bklit API parity. */
  xDomainSlotCount?: number;
  tweenYDomainOnXDomainChange?: boolean;
  /** Overrides the clip-reveal timing; springs coerce to tweens. */
  enterTransition?: EnterTransition;
  /** Replay epoch input: changing it replays the mount reveal without a data change. */
  revealSignature?: string;
}

interface ResolvedArea {
  dataKey: string;
  yAxisId?: string | number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  curve: CurveFactory;
  showLine: boolean;
  gradientToOpacity: number;
  gradientSpan: number;
  fadeEdges: boolean | "left" | "right";
  showHighlight: boolean;
  dashFromIndex?: number;
  dashArray?: string;
  showMarkers?: boolean;
  markers?: SeriesPointMarkerStyle;
}

// Bklit `Readonly<ResolvedArea>` alone leaves the nested `markers` object mutable, which
// Typescript(prefer-readonly-parameter-types) still flags; this wraps it deeply.
type ReadonlyResolvedArea = Readonly<Omit<ResolvedArea, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};

// Bklit `Readonly<AreaConfig>` alone leaves the nested `markers` object mutable, which
// Typescript(prefer-readonly-parameter-types) still flags; this wraps it deeply.
type ReadonlyAreaConfig = Readonly<Omit<AreaConfig, "markers">> & {
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
};

interface ResolvedPatternArea {
  dataKey: string;
  fill?: string;
  patternPreset?: PatternPresetId;
  patternColor?: string;
  curve: CurveFactory;
}

interface AreaPatternDef {
  dataKey: string;
  id: string;
  preset: PatternPresetId;
  color?: string;
  node: ReactNode;
}

// Bklit parity: height comes from the measured box in both modes, not width/aspectRatio.
const resolveHeightPx = (width: number, measuredHeight: number, aspectRatio: string): number => {
  if (width <= 0) {return 0;}
  if (measuredHeight > MIN_MEASURED_HEIGHT_PX) {return measuredHeight;}
  return width / parseAspectRatio(aspectRatio);
};

// Only series that omit fill AND resolve to a real (non-"none") preset get a <pattern> def.
const buildPatternAreaDefs = (
  patternAreaList: readonly Readonly<ResolvedPatternArea>[],
  baseId: string,
): AreaPatternDef[] => {
  const defs: AreaPatternDef[] = [];
  for (const [index, patternArea] of patternAreaList.entries()) {
    const preset = patternArea.patternPreset ?? "diagonal";
    const needsPatternDef = patternArea.fill === undefined && preset !== "none";
    if (needsPatternDef) {
      const id = `${baseId}-pattern-area-${index}`;
      const node = renderPatternPreset(preset, `${id}-base`, { color: patternArea.patternColor });
      if (node !== null) {
        defs.push({ color: patternArea.patternColor, dataKey: patternArea.dataKey, id, node, preset });
      }
    }
  }
  return defs;
};

// Primitive narrowing predicates; typeof stays inside type guards (allowInTypeGuards).
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";
const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isBoolean = <Value,>(value: Value): value is Value & boolean => typeof value === "boolean";
const isAnimationFrameScheduler = <Value,>(value: Value): value is Value & typeof globalThis.requestAnimationFrame => typeof value === "function";

// First non-empty entry wins; absent/empty entries fall through (bklit `||`-chain parity).
const firstNonEmptyString = (values: readonly (string | undefined)[]): string | undefined =>
  values.find((value) => (value?.length ?? 0) > 0);

// Stringifies an untyped datum field without Object's default "[object Object]" dump.
const stringifyDatumField = <Value,>(value: Value, absent: string): string => {
  if (isString(value)) {return value;}
  if (isNumber(value)) {return String(value);}
  if (value instanceof Date) {return String(value);}
  if (value === null || value === undefined) {return absent;}
  return JSON.stringify(value) ?? absent;
};

// Focus dates arrive as Date instances or raw timestamps; anything else reads as absent.
const resolveFocusDate = (datum: Readonly<ChartDatum> | undefined, xDataKey: string): Date | undefined => {
  const rawDate = datum?.[xDataKey];
  if (rawDate instanceof Date) {return rawDate;}
  return isString(rawDate) || isNumber(rawDate) ? new Date(rawDate) : undefined;
};

// First matching point color for a mark id; absent when the series has no focused point.
const pointColorForMark = (points: readonly { readonly markId: string; readonly color?: string }[], markId: string): string | undefined =>
  points.find((point) => point.markId === markId)?.color;

// Marker visibility is opt-in; an absent flag reads as hidden.
const isMarkerConfigShown = (config: Readonly<{ showMarkers: boolean | undefined }>): boolean =>
  config.showMarkers ?? false;

// Resolves the boolean-tween-on case (true -> fallback ms, false -> 0).
// Split out from the caller below so it stays a single, non-nested ternary.
const resolveBooleanTweenBaseMs = (yDomainTweenEnabled: boolean): number =>
  yDomainTweenEnabled ? DEFAULT_Y_DOMAIN_TWEEN_FALLBACK_MS : 0;

// The `yDomainTween` prop's declared type is boolean-only, but this also accepts a raw ms
// Number for callers that bypass the TS surface — preserved for backward compatibility.
const resolveEffectiveYDomainTweenDuration = (
  yDomainTween: boolean,
  forceTweenOnXDomainChange: boolean,
  xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined,
): number => {
  // SAFETY: non-boolean runtime callers (untyped JS consumers) may still pass a raw ms number.
  const base = isBoolean(yDomainTween) ? resolveBooleanTweenBaseMs(yDomainTween) : (yDomainTween as number);
  if (!forceTweenOnXDomainChange || !xDomain) {return base;}
  return base || DEFAULT_Y_DOMAIN_TWEEN_FALLBACK_MS;
};

// Brush ranges compare by endpoint time so a re-created but equal range keeps stable identity.
const isSameBrushRange = (
  left: { readonly start: Date; readonly end: Date } | undefined,
  right: { readonly start: Date; readonly end: Date } | undefined,
): boolean => {
  if (left === right) {return true;}
  if (!left || !right) {return false;}
  return left.start.getTime() === right.start.getTime() && left.end.getTime() === right.end.getTime();
};

// Raw x-extent from the rendered rows; xDomain short-circuits the scan (bklit parity).
interface TimeExtentMs {
  readonly minTime: number;
  readonly maxTime: number;
}

const collectDatumTimes = (
  renderData: readonly Readonly<ChartDatum>[],
  xDataKey: string,
): number[] => {
  const times: number[] = [];
  for (const datum of renderData) {
    const value = datum[xDataKey];
    if (value instanceof Date) {times.push(value.getTime());}
  }
  return times;
};

const computeTimeExtentRaw = (
  renderData: readonly Readonly<ChartDatum>[],
  xDataKey: string,
  xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined,
): TimeExtentMs | undefined => {
  if (xDomain) {return { maxTime: xDomain[1].getTime(), minTime: xDomain[0].getTime() };}
  const times = collectDatumTimes(renderData, xDataKey);
  if (times.length === 0) {return undefined;}
  return { maxTime: Math.max(...times), minTime: Math.min(...times) };
};

interface CrosshairGradientStop {
  readonly offset: string;
  readonly opacity: number;
}

interface CrosshairGradientSource {
  readonly color: string;
  readonly id: string;
  readonly stops: readonly CrosshairGradientStop[];
}

// Crosshair svg in one place. Stops render one level deep, so the svg tree
// Stays within jsx-max-depth (svg > defs > linearGradient).
const renderCrosshairNode = (
  crosshairGradientDef: CrosshairGradientSource | undefined,
  marginTop: number,
  plotHeight: number,
): ReactNode => {
  if (!crosshairGradientDef) {return undefined;}
  const { color, id, stops: gradientStops } = crosshairGradientDef;
  const stops = gradientStops.map((stop: Readonly<{ offset: string; opacity: number }>) => (
    <stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
  ));
  return (
    <svg width={0} height={0} style={HIDDEN_DEF_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={marginTop} y2={marginTop + plotHeight}>
          {stops}
        </linearGradient>
      </defs>
    </svg>
  );
};

interface AreaProjectionGradientInput {
  readonly baseId: string;
  readonly config: Readonly<ProjectionLineConfig> | undefined;
  readonly index: number;
  readonly innerWidth: number;
  readonly isLoading: boolean;
  readonly line: Readonly<ProjectionLineChildConfig>;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

// Gradient def for one projection line; undefined unless the line uses a gradient stroke.
const resolveAreaProjectionGradient = (input: Readonly<AreaProjectionGradientInput>): ProjectionGradientDef | undefined => {
  const { config, line } = input;
  if ((line.strokeStyle ?? "solid") !== "gradient" || !config || config.data.length < 2) {return undefined;}
  const stroke = line.stroke ?? PROJECTION_FALLBACK_STROKE;
  const gradientStart = line.gradientStart ?? stroke;
  const gradientEnd = line.gradientEnd ?? "var(--chart-5)";
  const strokeWidth = line.strokeWidth ?? DEFAULT_PROJECTION_STROKE_WIDTH_PX;
  const curveKind = line.curveKind ?? "linear";
  const endpointRadius = line.endpointRadius ?? DEFAULT_TERMINAL_MARKER_RADIUS_PX;
  return resolveProjectionGradientDef({
    className: line.className ?? "chart-projection-line",
    curveKind,
    data: config.data,
    endpointRadius,
    gradientEnd,
    gradientId: `${input.baseId}-proj-${input.index}`,
    gradientStart,
    id: `projection-line-${input.index}`,
    innerWidth: input.innerWidth,
    showEndMarker: line.showEndMarker ?? line.showEndpoints ?? true,
    stroke,
    strokeDasharray: line.strokeDasharray ?? "6,4",
    strokeOpacity: line.strokeOpacity ?? 1,
    strokeStyle: "gradient",
    strokeVisible: !input.isLoading,
    strokeWidth,
    translateX: input.marginLeft,
    translateY: input.marginTop,
    xScale: input.xScale,
    yAxisId: config.yAxisId,
    yScale: input.yScale,
  });
};

interface AreaProjectionGradientFrame {
  readonly baseId: string;
  readonly configs: readonly Readonly<ProjectionLineConfig>[];
  readonly innerWidth: number;
  readonly isLoading: boolean;
  readonly lines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

// Gradient defs for every projection line; non-gradient lines contribute nothing.
const buildAreaProjectionGradientDefs = (frame: Readonly<AreaProjectionGradientFrame>): ProjectionGradientDef[] => frame.lines.flatMap((line: Readonly<ProjectionLineChildConfig>, index: number) => {
  const gradient = resolveAreaProjectionGradient({
    baseId: frame.baseId,
    config: frame.configs.at(index),
    index,
    innerWidth: frame.innerWidth,
    isLoading: frame.isLoading,
    line,
    marginLeft: frame.marginLeft,
    marginTop: frame.marginTop,
    xScale: frame.xScale,
    yScale: frame.yScale,
  });
  return gradient ? [gradient] : [];
});

interface AreaFocusPrimaryInput {
  readonly chartPhase: ChartPhase;
  readonly dragActive: boolean;
  readonly isLoaded: boolean;
  readonly points: readonly ChartPoint<ChartDatum, Date, number>[];
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
}

interface AreaFocusPrimary {
  readonly clearStaleFocus: boolean;
  readonly primary: ChartPoint<ChartDatum, Date, number> | undefined;
}

// Picks the focused point, suppressing it while brushing, outside the x-domain, or pre-interaction.
const resolveAreaFocusPrimary = (input: Readonly<AreaFocusPrimaryInput>): AreaFocusPrimary => {
  const rawPrimary = input.points.at(0);
  const outsideXDomain =
    input.xDomain !== undefined && rawPrimary !== undefined && isFocusOutsideXDomain(rawPrimary.datum, input.xDataKey, input.xDomain);
  const phaseGated = !(isChartInteractionPhase(input.chartPhase) && input.isLoaded);
  const suppressed = outsideXDomain || input.dragActive || phaseGated;
  return {
    clearStaleFocus: suppressed && input.points.length > 0,
    primary: suppressed ? undefined : rawPrimary,
  };
};

interface AreaLabelFade {
  hoveredLabel: string | undefined;
  primaryX: number;
}

interface AreaDatePillRequest {
  readonly datumIndex: number;
  readonly primaryX: number;
}

interface AreaPillVisibilityRef {
  current: boolean;
}

interface AreaDatePillParams {
  readonly datePill: Readonly<DatePillController>;
  readonly discrete: boolean;
  readonly primary: Readonly<AreaDatePillRequest> | undefined;
  readonly setLabelFade: Dispatch<SetStateAction<AreaLabelFade | undefined>>;
  readonly showDatePill: boolean;
  readonly validDate: Date | undefined;
  readonly wasVisibleRef: AreaPillVisibilityRef;
}

// Mirrors the hover date-pill choreography; extracted so the focus callback stays short.
const updateAreaDatePill = (params: Readonly<AreaDatePillParams>): void => {
  const { datePill, primary, showDatePill, validDate, wasVisibleRef } = params;
  if (primary && showDatePill) {
    const label = validDate ? shortDateFmt.format(validDate) : null;
    const jump = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    datePill.show(primary.primaryX, { discrete: params.discrete, index: primary.datumIndex, jump, label });
    // Skip definition rebuilds when the focus point didn't change.
    params.setLabelFade((prev: Readonly<AreaLabelFade> | undefined) =>
      prev && prev.primaryX === primary.primaryX && prev.hoveredLabel === label
        ? prev
        : { hoveredLabel: label ?? undefined, primaryX: primary.primaryX },
    );
  } else {
    wasVisibleRef.current = false;
    datePill.hide();
    params.setLabelFade(undefined);
  }
};

interface AreaRevealContainerRef {
  readonly current: HTMLDivElement | null;
}

interface AreaRevealStateInput {
  readonly animationDuration: number;
  readonly chartPhase: ChartPhase;
  readonly containerRef: AreaRevealContainerRef;
  readonly durationMs: number;
  readonly easingCss: string;
  readonly epoch: number;
  readonly epochRef: RevealWipeEpochRef;
  readonly prefersReducedMotion: boolean;
}

interface AreaRevealState {
  readonly marks: SVGGElement | null | undefined;
  readonly shouldAnimate: boolean;
}

// Queries the marks layer and runs the reveal wipe; extracted so the render callback stays short.
const resolveAreaRevealState = (input: Readonly<AreaRevealStateInput>): AreaRevealState => {
  const marks = input.containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
  const shouldAnimate = runRevealWipe({
    active: input.chartPhase === "revealing",
    animationDuration: input.animationDuration,
    durationMs: input.durationMs,
    easingCss: input.easingCss,
    epoch: input.epoch,
    epochRef: input.epochRef,
    marks,
    prefersReducedMotion: input.prefersReducedMotion,
  });
  return { marks, shouldAnimate };
};

interface AreaMarkerAnimsRef {
  current: Animation[];
}

interface AreaMarkerRevealCancelRef {
  current: (() => void) | null;
}

// Settled animations reject on cancel; the list is rebuilt by the reveal below.
const cancelAreaMarkerAnims = (animsRef: AreaMarkerAnimsRef): void => {
  for (const anim of animsRef.current) {
    try {
      anim.cancel();
    } catch {
      // Cancel rejects for settled animations; ignoring it is intentional.
    }
  }
  animsRef.current = [];
};

// Visual extent of one marker config; mirrors the bklit series-marker stagger inputs.
const resolveAreaMarkerVisualExtent = (markers: Readonly<SeriesPointMarkerStyle> | undefined): number => {
  const radius = markers?.radius ?? DEFAULT_SERIES_MARKER_RADIUS_PX;
  const strokeWidth = markers?.strokeWidth ?? 2;
  const ringGap = markers?.ringGap ?? 2;
  const outlineWidth = markers?.outlineWidth ?? 0;
  const showActiveHighlight = markers?.showActiveHighlight ?? true;
  const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const outline = Math.max(outlineWidth, 0);
  const highlightPad = showActiveHighlight ? radius * MARKER_HIGHLIGHT_PAD_RATIO : 0;
  return radius + ring + outline + highlightPad + 2;
};

interface AreaMarkerCircleFrame {
  readonly animationEasing: string;
  readonly durationSec: number;
  readonly innerWidth: number;
  readonly visualExtent: number;
}

// Staggers one marker circle with the reveal sweep; extracted so the group walk stays short.
const animateAreaMarkerCircle = (circle: SVGCircleElement, frame: Readonly<AreaMarkerCircleFrame>): Animation => {
  const cx = Number(circle.getAttribute("cx") ?? "0");
  const leadingEdge = Math.max(0, cx - frame.visualExtent);
  const delaySec = frame.innerWidth > 0 ? (leadingEdge / frame.innerWidth) * frame.durationSec : 0;
  return circle.animate(
    [{ filter: "blur(2px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1 }],
    { delay: delaySec * MS_PER_SECOND, duration: SERIES_MARKER_ENTER_MS, easing: frame.animationEasing, fill: "backwards" },
  );
};

interface AreaMarkerStaggerConfig {
  readonly dataKey: string;
  readonly markers: Readonly<SeriesPointMarkerStyle> | undefined;
  readonly showMarkers: boolean | undefined;
}

interface AreaMarkerStaggerFrame {
  readonly animationEasing: string;
  readonly durationSec: number;
  readonly innerWidth: number;
}

interface AreaMarkerGroupInput {
  readonly config: Readonly<AreaMarkerStaggerConfig>;
  readonly frame: Readonly<AreaMarkerStaggerFrame>;
  readonly marks: SVGGElement;
}

// Reveal animations for one marker config; empty when its dot group is absent.
const revealAreaMarkerGroup = (input: Readonly<AreaMarkerGroupInput>): Animation[] => {
  const visualExtent = resolveAreaMarkerVisualExtent(input.config.markers);
  const escaped = `${input.config.dataKey}__marker`.replaceAll('"', String.raw`\"`);
  const group = input.marks.querySelector<SVGGElement>(`.ts-chart__dot[data-ts-key="${escaped}"]`);
  if (!group) {return [];}
  const anims: Animation[] = [];
  const circles = group.querySelectorAll<SVGCircleElement>("circle");
  for (const circle of circles) {
    anims.push(animateAreaMarkerCircle(circle, { ...input.frame, visualExtent }));
  }
  return anims;
};

interface AreaMarkerCollectInput {
  readonly animsRef: AreaMarkerAnimsRef;
  readonly configs: readonly Readonly<AreaMarkerStaggerConfig>[];
  readonly frame: Readonly<AreaMarkerStaggerFrame>;
  readonly marks: SVGGElement;
}

// Runs the marker stagger for every opted-in config; extracted so the reveal runner stays short.
const collectAreaMarkerAnims = (input: Readonly<AreaMarkerCollectInput>): void => {
  for (const cfg of input.configs.filter((candidate) => isMarkerConfigShown(candidate))) {
    input.animsRef.current.push(...revealAreaMarkerGroup({ config: cfg, frame: input.frame, marks: input.marks }));
  }
};

interface AreaMarkerRevealState {
  cancelled: boolean;
  raf1: number;
  raf2: number;
  tId: ReturnType<typeof globalThis.setTimeout> | 0;
}

interface AreaMarkerRevealSchedule {
  readonly animationEasing: string;
  readonly animsRef: AreaMarkerAnimsRef;
  readonly cancelRef: AreaMarkerRevealCancelRef;
  readonly configs: readonly Readonly<AreaMarkerStaggerConfig>[];
  readonly durationMs: number;
  readonly innerWidth: number;
  readonly marks: SVGGElement;
}

// Defers the marker stagger by two frames so the clip sweep has started; reuses the prior cancel.
const scheduleAreaMarkerReveal = (schedule: Readonly<AreaMarkerRevealSchedule>): void => {
  schedule.cancelRef.current?.();
  // Marker stagger spans the clip reveal's duration (bklit series-markers.tsx:102).
  const durationSec = schedule.durationMs / MS_PER_SECOND;
  const frame: AreaMarkerStaggerFrame = { animationEasing: schedule.animationEasing, durationSec, innerWidth: schedule.innerWidth };
  if (!isAnimationFrameScheduler(globalThis.requestAnimationFrame)) {
    collectAreaMarkerAnims({ animsRef: schedule.animsRef, configs: schedule.configs, frame, marks: schedule.marks });
    return;
  }
  const state: AreaMarkerRevealState = { cancelled: false, raf1: 0, raf2: 0, tId: 0 };
  const doReveal = (): void => {
    collectAreaMarkerAnims({ animsRef: schedule.animsRef, configs: schedule.configs, frame, marks: schedule.marks });
  };
  schedule.cancelRef.current = (): void => {
    state.cancelled = true;
    if (state.raf1) {cancelAnimationFrame(state.raf1);}
    if (state.raf2) {cancelAnimationFrame(state.raf2);}
    if (state.tId !== 0) {globalThis.clearTimeout(state.tId);}
  };
  globalThis.requestAnimationFrame(() => {
    state.raf2 = globalThis.requestAnimationFrame(() => {
      state.tId = globalThis.setTimeout(() => {
        if (!state.cancelled) {doReveal();}
      }, 0);
    });
  });
};

const AreaChart = ({
  data,
  xDataKey = "date",
  status = "ready",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  loadingLabel,
  children,
  style,
  animationEasing = DEFAULT_ANIMATION_EASING,
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount: _xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  enterTransition,
  revealSignature = "",
}: Readonly<AreaChartProps>): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height: measuredHeight } = useMeasuredRect(containerRef);
  const onPhaseChangeEvent = useEffectEvent((phase: ChartPhase): void => {
    onPhaseChange?.(phase);
  });
  const projectionPhasePortRef = useRef<ProjectionPhaseHandle | null>(null);

  // XDomain-driven tweening forces a nonzero duration even when yDomainTween is 0/false.
  const effectiveYDomainTweenDuration = useMemo(
    () => resolveEffectiveYDomainTweenDuration(yDomainTween, tweenYDomainOnXDomainChange, xDomain),
    [yDomainTween, tweenYDomainOnXDomainChange, xDomain],
  );
  const {
    chartPhase,
    isLoaded: orchIsLoaded,
    revealEpoch,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus: status,
    revealSignature,
    skeletonData: [],
    targetData: data,
    yDomainTweenDuration: effectiveYDomainTweenDuration,
  });

  // Primitive deps: enterTransition is usually an inline object literal.
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    [enterTransition, animationDuration, animationEasing],
  );

  const isLoaded = orchIsLoaded;

  useEffect(() => { onPhaseChangeEvent(chartPhase); }, [chartPhase]);

  useEffect(() => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  }, [chartPhase]);

  useEffect(() => {
    if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
      notifyYDomainTweenComplete();
    }
  }, [chartPhase, notifyYDomainTweenComplete]);

  const { areas, patternAreas, grid, xAxis, yAxis, background, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, chartMarkers, brushes } = useMemo(
    () => extractChildren(children),
    [children],
  );
  const tooltipEnabled = tooltip?.enabled ?? false;
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { captureRenderContext, sceneRef, interactionRef, clientToScene } =
    useFocusInjection<ChartDatum, Date, number>();
  const projectionConfigs = useMemo(() => extractProjectionLineConfigs(children), [children]);
  const projectionGradientBaseId = useSanitizedId();

  // Bklit defaults: stroke = fill = var(--chart-line-primary), width 2, fillOpacity 0.4, curveMonotoneX.
  const resolvedAreas = useMemo<ResolvedArea[]>(
    () =>
      areas.map((area: ReadonlyAreaConfig) => {
        const fill = area.fill ?? "var(--chart-line-primary)";
        return {
          curve: area.curve ?? curveMonotoneX,
          dashArray: area.dashArray,
          dashFromIndex: area.dashFromIndex,
          dataKey: area.dataKey,
          fadeEdges: area.fadeEdges ?? false,
          fill,
          fillOpacity: area.fillOpacity ?? DEFAULT_AREA_FILL_OPACITY,
          gradientSpan: area.gradientSpan ?? 1,
        gradientToOpacity: area.gradientToOpacity ?? 0,
          markers: area.markers,
          showHighlight: area.showHighlight ?? true,
          showLine: area.showLine ?? true,
          showMarkers: area.showMarkers,
          stroke: area.stroke ?? fill,
          strokeWidth: area.strokeWidth ?? 2,
          yAxisId: area.yAxisId,
        };
      }),
    [areas],
  );

  const resolvedPatternAreas = useMemo<ResolvedPatternArea[]>(
    () =>
      patternAreas.map((patternArea: Readonly<PatternAreaConfig>) => ({
        curve: patternArea.curve ?? curveMonotoneX,
        dataKey: patternArea.dataKey,
        fill: patternArea.fill,
        patternColor: patternArea.patternColor,
        patternPreset: patternArea.patternPreset,
      })),
    [patternAreas],
  );
  const patternBaseId = useSanitizedId();
  const patternDefs = useMemo(
    () => buildPatternAreaDefs(resolvedPatternAreas, patternBaseId),
    [resolvedPatternAreas, patternBaseId],
  );
  const patternIdByKey = useMemo(() => {
    const idByKey = new Map<string, string>();
    for (const patternDef of patternDefs) {idByKey.set(patternDef.dataKey, patternDef.id);}
    return idByKey;
  }, [patternDefs]);

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = useMemo(() => {
    if (innerWidth <= 0) {return data;}
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      [...resolvedAreas.map((area: ReadonlyResolvedArea) => area.dataKey), ...resolvedPatternAreas.map((patternArea: Readonly<ResolvedPatternArea>) => patternArea.dataKey)],
    );
  }, [data, innerWidth, resolvedAreas, resolvedPatternAreas]);
  // Dense data snaps instead of springing (bklit pointCount gate).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  const [labelFade, setLabelFade] = useState<{ primaryX: number; hoveredLabel: string | undefined } | undefined>();
  const crosshairGradientId = useSanitizedId();

  const areaMarkerBaseId = useSanitizedId();
  const areaMarkerConfigs = useMemo(() => resolvedAreas.map((area: ReadonlyResolvedArea) => ({ dataKey: area.dataKey, markers: area.markers, showMarkers: area.showMarkers, stroke: area.stroke })), [resolvedAreas]);
  const areaMarkerGradientDefs = useMemo(() => buildMarkerGradientDefs(areaMarkerConfigs, areaMarkerBaseId), [areaMarkerConfigs, areaMarkerBaseId]);
  const areaMarkerGradientIdByKey = useMemo(() => {
    const idByKey = new Map<string, string>();
    for (const gradientDef of areaMarkerGradientDefs) {idByKey.set(gradientDef.dataKey, gradientDef.id);}
    return idByKey;
  }, [areaMarkerGradientDefs]);

  // YDomain scans visibleData when brushing; marks stay on full data (domain-clamp).
  const xAccessorForBrush = useMemo(() => createXAccessor(xDataKey), [xDataKey]);
  const visibleData = useMemo(() => {
    if (!xDomain) {return data;}
    return filterDataByXDomain(data, xDomain, xAccessorForBrush);
  }, [data, xDomain, xAccessorForBrush]);

  // Bklit parity: all>=0 -> [0, max*1.1]; mixed-sign -> [min,max] +/-5%; empty -> [0,100].
  // Loading gridlines derive from skeleton rows, not caller data (bklit shells its own).
  const skeletonRows = useMemo(
    () => buildLoadingSkeletonRows(data.length, resolvedAreas[0]?.dataKey ?? "value"),
    [data.length, resolvedAreas],
  );
  const yDomainSource = status === "loading" ? skeletonRows : visibleData;
  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: (axisAreas: readonly ReadonlyResolvedArea[]) => resolveTimeSeriesYDomain(yDomainSource, axisAreas),
        series: resolvedAreas,
      }),
    [yDomainSource, resolvedAreas],
  );
  const yDomain = useMemo(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );

  // Bklit parity: new data paints immediately; only a y-domain change tweens.
  const { niced: nicedYDomain, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);

  // Projection merge is not re-niced (bklit builds scaleLinear({domain}) with no nice).
  const yDomainFinal = useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) {return nicedYDomain;}
    return mergeProjectionYDomain(nicedYDomain, projectionConfigs, DEFAULT_Y_AXIS_ID);
  }, [nicedYDomain, projectionConfigs]);

  // One y scale in the spec; secondary axes reproject values into the primary domain.
  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      const nicedDomain = createNicedYScale(domain).domain();
      out[axisId] = [nicedDomain[0], nicedDomain[1]];
    }
    return out;
  }, [yDomainsByAxis]);
  const projectorFor = useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, yDomainFinal),
    [nicedDomainsByAxis, yDomainFinal],
  );

  const [prevYDomainFinal, setPrevYDomainFinal] = useState(yDomainFinal);
  if (prevYDomainFinal[0] !== yDomainFinal[0] || prevYDomainFinal[1] !== yDomainFinal[1]) {
    setPrevYDomainFinal(yDomainFinal);
  }
  const yDomainChanged =
    projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinal[0] !== yDomainFinal[0] || prevYDomainFinal[1] !== yDomainFinal[1];

  // Gradient stops carry fillOpacity (never double-applied); span clamps to [0.01, 1].
  const gradientBaseId = useSanitizedId();
  const gradientDefs = useMemo(
    () =>
      resolvedAreas.map((area: ReadonlyResolvedArea, areaIndex) => ({
        dataKey: area.dataKey,
        fill: area.fill,
        fillOpacity: area.fillOpacity,
        gradientToOpacity: area.gradientToOpacity,
        id: `${gradientBaseId}-area-grad-${areaIndex}`,
        spanPct: Math.min(1, Math.max(MIN_GRADIENT_SPAN_FRACTION, area.gradientSpan)) * PERCENT_MULTIPLIER,
      })),
    [gradientBaseId, resolvedAreas],
  );
  const nativeAreaGradients = useMemo(
    () =>
      gradientDefs.map((gradientDef: Readonly<(typeof gradientDefs)[number]>) => ({
        id: gradientDef.id,
        stops: [
          { color: gradientDef.fill, offset: 0, opacity: gradientDef.fillOpacity },
          { color: gradientDef.fill, offset: gradientDef.spanPct / PERCENT_MULTIPLIER, opacity: gradientDef.gradientToOpacity },
          ...(gradientDef.spanPct < PERCENT_MULTIPLIER
            ? [{ color: gradientDef.fill, offset: 1, opacity: gradientDef.gradientToOpacity }]
            : []),
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
    for (const gradientDef of gradientDefs) {map.set(gradientDef.dataKey, gradientDef.id);}
    return map;
  }, [gradientDefs]);

  const heightPx = resolveHeightPx(width, measuredHeight, aspectRatio);
  const timeExtentRaw = useMemo(
    () => computeTimeExtentRaw(renderData, xDataKey, xDomain),
    [renderData, xDataKey, xDomain],
  );
  // Rendered x-domain extends the data extent by the projection tail; xDomain skips the merge.
  const timeExtent = useMemo(() => {
    if (timeExtentRaw === undefined) {return timeExtentRaw;}
    if (xDomain) {return timeExtentRaw;}
    if (projectionConfigs.length === 0) {return timeExtentRaw;}
    return { maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs), minTime: timeExtentRaw.minTime } as const;
  }, [timeExtentRaw, projectionConfigs, xDomain]);

  const brushConfig: BrushChildConfig | undefined = brushes.at(0);
  const hasBrush = Boolean(brushConfig);
  const brushTrackExtent = useMemo<[Date, Date] | undefined>(
    () => timeExtent === undefined ? undefined : [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)],
    [timeExtent],
  );
  const brushFallbackRange = useMemo((): BrushRange<Date> | undefined => {
    if (!brushTrackExtent) {return undefined;}
    return { end: brushTrackExtent[1], start: brushTrackExtent[0] };
  }, [brushTrackExtent]);
  const brushInitialSelection = brushConfig?.initialSelection;
  const nextBrushRangeValue: BrushRange<Date> | undefined = brushInitialSelection
    ? { end: brushInitialSelection.end, start: brushInitialSelection.start }
    : brushFallbackRange;
  const [brushRangeValue, setBrushRangeValue] = useState<BrushRange<Date> | undefined>(nextBrushRangeValue);
  if (!isSameBrushRange(brushRangeValue, nextBrushRangeValue)) {
    setBrushRangeValue(nextBrushRangeValue);
  }
  const brushOnSelectionChangeRef = useRef(brushConfig?.onSelectionChange);
  useEffect(() => {
    brushOnSelectionChangeRef.current = brushConfig?.onSelectionChange;
  });
  const handleBrushChange = useCallback((next: BrushRange<Date>, context: { reason: BrushXChange<Date> }) => {
    const { reason } = context;
    if (reason.type === "cancel") {return;}
    const startMs = next.start.getTime();
    const endMs = next.end.getTime();
    if (startMs === endMs) {
      if (reason.type === "commit") {brushOnSelectionChangeRef.current?.(null);}
      return;
    }
    brushOnSelectionChangeRef.current?.({ end: next.end, start: next.start });
  }, []);
  const brushValues = useMemo((): Date[] | undefined => {
    if (!hasBrush) {return undefined;}
    const out: Date[] = [];
    for (const datum of data) {
      const xValue = xAccessorForBrush(datum);
      if (xValue instanceof Date) {out.push(xValue);}
    }
    return out;
  }, [hasBrush, data, xAccessorForBrush]);
  const brushControls = useMemo<readonly ChartControl<Date, number>[]>(() => {
    if (!hasBrush || !brushRangeValue || !brushValues || brushValues.length === 0) {return EMPTY_BRUSH_CONTROLS;}
    // Brush endpoints must be members of values (snap first).
    const snappedRange = snapBrushRangeToValues(brushRangeValue, brushValues) ?? brushRangeValue;
    return [
      brushX<Date>({
        ariaLabel: "Brush selection",
        endAriaLabel: "Selection end",
        format: (date: Date) => shortDateFmt.format(date),
        handleStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(snappedRange, handleBrushChange),
        selectionStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        startAriaLabel: "Selection start",
        values: brushValues,
      }),
    ];
  }, [hasBrush, brushRangeValue, brushValues, handleBrushChange]);

  const isLoading = status === "loading";

  // Edge-fade mask aggregates per-series fadeEdges; sides resolve via CSS :not() rules.
  const fadeEdgesMask = resolveFadeEdgesMask(resolvedAreas.map((area: ReadonlyResolvedArea) => area.fadeEdges));

  // Terminal markers anchor to the last visible row via the shared line-marker builder.
  const areaTerminalAnchors = useMemo(() => buildTerminalAnchors({
    defaults: {
      fallbackStroke: "var(--chart-1)",
      markerRadius: DEFAULT_TERMINAL_MARKER_RADIUS_PX,
      terminalStrokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH_PX,
    },
    heightPx,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    renderData,
    terminalMarkers,
    timeExtent,
    timeExtentRaw,
    width,
    xDataKey,
    yDomainFinal,
  }), [terminalMarkers, renderData, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw, xDataKey]);
  // Projection end markers clamp to the plot edge via the shared line-marker builder.
  const areaEndAnchors = useMemo(() => buildProjectionEndAnchors({
    fallbackStroke: PROJECTION_FALLBACK_STROKE,
    heightPx,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    markerRadius: DEFAULT_TERMINAL_MARKER_RADIUS_PX,
    projectionEndMarkers,
    timeExtent,
    timeExtentRaw,
    width,
    yDomainFinal,
  }), [projectionEndMarkers, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw]);
  const projectionGradientDefsArea = useMemo(() => {
    if (projectionConfigs.length === 0 || width <= 0) {return [];}
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) {return [];}
    if (!timeExtent || !timeExtentRaw) {return [];}
    const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    return buildAreaProjectionGradientDefs({
      baseId: projectionGradientBaseId,
      configs: projectionConfigs,
      innerWidth: innerW,
      isLoading,
      lines: projectionLines,
      marginLeft: margin.left,
      marginTop: margin.top,
      xScale: (value: Date): number => timeToPixelX(value, timeExtentRaw.minTime, timeExtent.maxTime, innerW),
      yScale: (value: number): number => yScale(value) ?? 0,
    });
  }, [projectionConfigs, projectionLines, width, margin, heightPx, yDomainFinal, timeExtent, timeExtentRaw, projectionGradientBaseId, isLoading]);

  const crosshairGradientDef = useMemo((): CrosshairGradientDef | undefined => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) {return undefined;}
    const indicatorColor = tooltip?.indicatorColor;
    const color = isString(indicatorColor) ? indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  const definition = useMemo((): DomChartDefinition<ChartDatum, Date, number> | undefined => {
    if (width <= 0) {return undefined;}
    if (isLoading) {
      const gridGuide = resolveGridGuide(grid);
      const emptyMarks: ChartMark<ChartDatum, Date, number>[] = [];
      return defineChart({
        focus: "group-x",
        // Bklit has no focus ring; the hover dot is the indicator.
        focusRing: false,
        margin,
        marks: emptyMarks,
        maxFocusDistance: Number.POSITIVE_INFINITY,
        scales: {
          x: {
            axis: { line: false, tickLabels: false, ticks: { count: gridGuide.columnTicks, size: 0 } },
            grid: gridGuide.vertical,
            scale: scaleUtc,
          },
          y: {
            axis: hiddenAxisOptions(gridGuide.ticks),
            grid: gridGuide.horizontal,
            scale: scaleLinear().domain(yDomainFinal),
          },
        },
        svgAnimation: false,
      });
    }
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    for (const pa of resolvedPatternAreas) {
      const curve = d3Curve(pa.curve);
      const patternId = patternIdByKey.get(pa.dataKey);
      const fill = pa.fill ?? (patternId !== undefined ? `url(#${patternId})` : "var(--chart-1)");
      marks.push(
        patternAreaMark(renderData, {
          curve,
          fill,
          id: `pattern-area-${pa.dataKey}`,
          x: (datum: Readonly<ChartDatum>) => xAccessorForBrush(datum),
          y: (datum: Readonly<ChartDatum>) => Number(datum[pa.dataKey]),
        }),
      );
    }
    // AreaFill emits no ChartPoints, so legend + pointer dim ride reactive fillOpacity (0.6).
    const legendHoveredKey =
      legendHoveredIndex === null ? undefined : (areas[legendHoveredIndex]?.dataKey ?? undefined);
    const pointerHoverDimmed = tooltipEnabled && hoveredIndex !== undefined;
    for (const area of resolvedAreas) {
      const gradientId = gradientIdBySeries.get(area.dataKey);
      const curve = d3Curve(area.curve);
      const projectY = projectorFor(area.yAxisId);
      // Fill first, lineY second: area marks draw no boundary stroke (documented TanStack pattern).
      // Do not swap areaFill for areaY: duplicate focus geometry failed the heap gate at n=1000.
      marks.push(
        areaFill(renderData, {
          curve,
          fill: (gradientId?.length ?? 0) > 0 ? `url(#${gradientId})` : area.fill,
          fillOpacity:
            pointerHoverDimmed || !(legendHoveredKey === undefined || legendHoveredKey === area.dataKey)
              ? AREA_DIM_OPACITY
              : 1,
          id: `${area.dataKey}__fill`,
          x: (datum: Readonly<ChartDatum>) => xAccessorForBrush(datum),
          y: (datum: Readonly<ChartDatum>) => projectY(Number(datum[area.dataKey])),
        }),
      );
      // Boundary shares Line's mark id scheme so crosshair/dots/tooltip need no Area branch.
      {
        const hasDashTail = resolveDashTailBounds(area.dashFromIndex, renderData.length);
        // ShowLine=false keeps the mark mounted with transparent stroke (carries focus geometry).
        const boundaryVisible = area.showLine && !hasDashTail;
        // Bklit parity: legend dim is plain strokeOpacity, not a focus state (single-owner slot).
        const legendDimmed = legendHoveredKey !== undefined && legendHoveredKey !== area.dataKey;
        const legendStrokeOpacity: number | undefined = legendDimmed ? AREA_DIM_OPACITY : undefined;
        marks.push(
          lineY(renderData, {
            curve,
            id: area.dataKey,
            states: pointerSeriesDimStates<ChartDatum>(AREA_DIM_OPACITY),
            stroke: boundaryVisible ? area.stroke : "transparent",
            strokeOpacity: boundaryVisible ? legendStrokeOpacity : 0,
            strokeWidth: area.strokeWidth,
            x: (datum: Readonly<ChartDatum>) => xAccessorForBrush(datum),
            y: (datum: Readonly<ChartDatum>) => projectY(Number(datum[area.dataKey])),
            // Z carries series identity; without it group-x focus dedupes to one series.
            z: () => area.dataKey,
          }),
        );
      }
      if (areaMarkerConfigs.some((cfg: Readonly<(typeof areaMarkerConfigs)[number]>) => cfg.showMarkers ?? false)) {
        marks.push(...buildMarkerMarks({ gradientIdByKey: areaMarkerGradientIdByKey, renderData, series: areaMarkerConfigs, xDataKey }));
      }
    }
    if (tooltipEnabled && (tooltip?.showCrosshair ?? true)) {
      const indicatorColor = tooltip?.indicatorColor;
      marks.push(
        buildIndicatorMark({
          color: isString(indicatorColor) ? indicatorColor : undefined,
          columnWidth: tooltip?.columnWidth,
          dasharray: tooltip?.indicatorDasharray,
          discrete: isDiscrete,
          gradientId: crosshairGradientId,
          span: tooltip?.indicatorSpan,
          width: tooltip?.indicatorWidth,
        }),
      );
    }
    if (tooltipEnabled && (tooltip?.showDots ?? true)) {
      for (const area of resolvedAreas) {
        // Hover dots reproject second-axis values into primary-domain space before the mark.
        const projectYForDot = projectorFor(area.yAxisId);
        const hoverDotData = renderData.map((datum: Readonly<ChartDatum>) => ({
          ...datum,
          [area.dataKey]: projectYForDot(Number(datum[area.dataKey])),
        }));
        marks.push(
          buildHoverDotMark(
            {
              fill: resolveHoverDotFill(area.stroke, tooltip?.dotColor),
              options: { discrete: isDiscrete, size: tooltip?.dotSize, strokeWidth: tooltip?.dotStrokeWidth },
              renderData: hoverDotData,
              series: { color: area.stroke, dataKey: area.dataKey },
              xDataKey,
            },
          ),
        );
      }
    }
    if (tooltipEnabled) {
      marks.push(
        ...buildHighlightBandMarks(
          {
            hoveredIndex: hoveredIndex ?? null,
            options: { discrete: isDiscrete },
            renderData,
            series: resolvedAreas.map((area: ReadonlyResolvedArea) => ({
              color: area.stroke,
              curve: d3Curve(area.curve),
              dataKey: area.dataKey,
              showHighlight: area.showHighlight,
              // Highlight band also gates on showLine; the dim state does not.
              showLine: area.showLine,
              strokeWidth: area.strokeWidth,
            })),
            xDataKey,
          },
        ),
      );
    }
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    if (projectionConfigs.length > 0 && Math.min(innerW, innerH) > 0 && te && teRaw) {
        const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
        const xScaleWithProjection = (value: Date): number => timeToPixelX(value, teRaw.minTime, te.maxTime, innerW);
        for (const [index, cfg] of projectionConfigs.entries()) {
          // Defensive runtime check: projectionConfigs and projectionLines walk `children` via separate
          // Extractors; nothing statically guarantees they stay index-aligned in length.
          const line = projectionLines.at(index);
          const stroke = line?.stroke ?? PROJECTION_FALLBACK_STROKE;
          const gid = `${projectionGradientBaseId}-proj-${index}`;
          const mark = line && cfg.data.length >= 2 ? projectionLineMark({
            className: line.className ?? "chart-projection-line",
            curveKind: line.curveKind ?? "linear",
            data: cfg.data,
            endpointRadius: line.endpointRadius ?? DEFAULT_TERMINAL_MARKER_RADIUS_PX,
            gradientEnd: line.gradientEnd ?? "var(--chart-5)",
            gradientId: gid,
            gradientStart: line.gradientStart ?? stroke,
            id: `projection-line-${index}`,
            innerWidth: innerW,
            showEndMarker: line.showEndMarker ?? line.showEndpoints ?? true,
            stroke,
            strokeDasharray: line.strokeDasharray ?? "6,4",
            strokeOpacity: line.strokeOpacity ?? 1,
            strokeStyle: line.strokeStyle ?? "solid",
            strokeVisible: !isLoading,
            strokeWidth: line.strokeWidth ?? DEFAULT_PROJECTION_STROKE_WIDTH_PX,
            translateX: margin.left,
            translateY: margin.top,
            xScale: xScaleWithProjection,
            yAxisId: cfg.yAxisId,
            yScale: (value: number) => yScale(value) ?? 0,
          }) : undefined;
          if (mark) {marks.push(mark);}
        }
    }
    const xScale: ChartScale = {
      id: "x",
      resolve(context: Readonly<ChartScaleResolveContext>) {
        const [r0, r1] = context.range;
        if (!te) {
          const base = scaleUtc().domain([0, 0]).range([r0, r1]);
          return {
            bandwidth: 0,
            domain: base.domain(),
            id: context.id,
            map: (value) => {
              const date = toDate(value);
              if (date === null) {return Number.NaN;}
              return base(date) ?? Number.NaN;
            },
            ticks: [],
            type: "time" as const,
          };
        }
        const base = scaleUtc().domain([te.minTime, te.maxTime]).range([r0, r1]);
        const tickList = xAxis
          ? buildXAxisTickValues({
              data: xDomain ? visibleData : renderData,
              domainMaxTime: timeExtent?.maxTime,
              formatValue: xAxis.formatValue,
              numTicks: xAxis.numTicks ?? DEFAULT_TICK_COUNT,
              rangeEnd: r1,
              rangeStart: r0,
              tickMode: xAxis.tickMode,
              xDataKey,
              xDomain,
            })
          : base.ticks(context.tickCount ?? DEFAULT_TICK_COUNT).map((value: Date) => ({ label: value.toISOString(), value }));
        return {
          bandwidth: 0,
          domain: base.domain(),
          id: context.id,
          map: (value) => {
            const date = toDate(value);
            if (date === null) {return Number.NaN;}
            return base(date) ?? Number.NaN;
          },
          ticks: tickList.map((tick) => ({
            label: tick.label,
            position: base(tick.value) ?? Number.NaN,
            value: tick.value,
          })),
          type: "time" as const,
        };
      },
    };
    const gridGuide = resolveGridGuide(grid);
    const xTickLabelOpacity = labelFade
      ? (ctx: ChartAxisTickLabelContext<Date>): number =>
          tickLabelFadeOpacity(
            ctx.position,
            xAxis?.formatValue ? xAxis.formatValue(ctx.value) : shortDateFmt.format(ctx.value),
            labelFade.primaryX,
            labelFade.hoveredLabel ?? null,
            xAxis?.tickerHalfWidth ?? TICKER_HALF_WIDTH,
            FADE_BUFFER,
          )
      : 1;
    // Enter is false (RevealWipe owns it); update tweens only on y-domain change, else snaps.
    const yDomainTweenGateActive = isChartInteractionPhase(chartPhase) && isLoaded && yDomainChanged;
    const motion = (context: ChartMotionContext): false | ChartMotionTiming | undefined => {
      if (context.role === "line" || context.role === "area" || context.role === "dot") {
        if (context.phase === "enter") {return false as const;}
        if (context.phase === "update") {
          return yDomainTweenGateActive
            ? {
                transition: {
                  duration: effectiveYDomainTweenDuration,
                  easing: bezierEasing,
                  type: "tween" as const,
                },
              }
            : (false as const);
        }
      }
      return undefined;
    };
    // Label position tween returns via tickLabels.motion (native text has no CSS left/top).
    const tickLabelMotion = (context: ChartMotionContext): false | ChartMotionTiming | undefined =>
      context.phase === "enter"
        ? (false as const)
        : {
            transition: {
              duration: DEFAULT_Y_DOMAIN_TWEEN_MS,
              easing: bezierEasing,
              type: "tween" as const,
            },
          };
    const xScaleOptions: ChartPositionScaleOptions<Date> = {
      axis: buildPrecomputedXAxisOptions({
        columnTicks: gridGuide.columnTicks,
        marginBottom: margin.bottom,
        tickLabelMotion,
        xAxis: xAxis ?? undefined,
        xTickLabelOpacity,
      }),
      grid: gridGuide.vertical,
      scale: xScale,
    };
    // Native y ticks follow bklit's niced-domain clamp; the grid follows the label ticks.
    const yScaleOptions: ChartPositionScaleOptions<number> = yAxis
      ? buildYAxisOptions({
        gridHorizontal: gridGuide.horizontal,
        scale: scaleLinear().domain(yDomainFinal),
        tickLabelMotion,
        yAxis,
        yDomainForTicks: yDomainFinal,
      })
      : {
          axis: hiddenAxisOptions(gridGuide.ticks),
          grid: gridGuide.horizontal,
          scale: scaleLinear().domain(yDomainFinal),
        };
    return defineChart({
      controls: brushControls,
      focus: "group-x",
      focusRing: false,
      gradients: nativeAreaGradients,
      margin,
      marks,
      // Hover works anywhere over the plot; TanStack defaults to 48px.
      maxFocusDistance: Number.POSITIVE_INFINITY,
      motion,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: {
        x: xScaleOptions,
        y: yScaleOptions,
      },
      svgAnimation: yDomainTweenGateActive
        ? { duration: effectiveYDomainTweenDuration, easing: bezierEasing }
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
  }, [renderData, xDataKey, xAccessorForBrush, resolvedAreas, resolvedPatternAreas, patternIdByKey, gradientIdBySeries, grid, width, yDomainFinal, yDomainChanged, projectorFor, margin, isLoading, chartPhase, isLoaded, projectionConfigs, projectionLines, projectionGradientBaseId, heightPx, timeExtent, timeExtentRaw, effectiveYDomainTweenDuration, areaMarkerConfigs, areaMarkerGradientIdByKey, nativeAreaGradients, legendHoveredIndex, areas, tooltip, tooltipEnabled, crosshairGradientId, isDiscrete, hoveredIndex, xAxis, yAxis, visibleData, xDomain, labelFade, brushControls]);

  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum, rowsCtx) =>
          resolvedAreas.map((area: ReadonlyResolvedArea) => {
            const value = datum[area.dataKey];
            // First non-empty color wins (bklit || chain); preserves "" falling through to transparent.
            const pointColor = pointColorForMark(rowsCtx.points, area.dataKey);
            return {
              color: firstNonEmptyString([area.stroke, pointColor]) ?? "transparent",
              label: area.dataKey,
              value: isNumber(value) ? value : stringifyDatumField(value, "0"),
            };
          }),
        resolveTitle: (datum) => {
          const date = datum[xDataKey];
          return date instanceof Date ? weekdayDateFmt.format(date) : undefined;
        },
        tooltip,
      }),
    [tooltip, xDataKey, resolvedAreas],
  );
  const dragSelectionActiveRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const chartConfig = useChartConfig();
  const dateLabelsForPill = useMemo(
    () =>
      renderData.map((datum: Readonly<ChartDatum>) => {
        const value = datum[xDataKey];
        if (value instanceof Date) {return shortDateFmt.format(value);}
        return stringifyDatumField(value, "");
      }),
    [renderData, xDataKey],
  );
  const datePill = useDatePillOverlay({
    dateLabels: dateLabelsForPill,
    enabled: tooltipEnabled && (tooltip?.showDatePill ?? true),
    tooltipSpring: chartConfig.tooltipSpring,
  });
  // Live tooltip date store for marker-active consumers.
  const markerActiveStore = useMemo(() => createActiveMarkersStore(), []);

  const clearFocusChrome = useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(undefined);
    markerActiveStore.setActiveDate(null);
    wasVisibleRef.current = false;
    datePill.hide();
    setLabelFade(undefined);
  }, [markerActiveStore, datePill, interactionRef]);

  const handleFocusChange = useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      const { clearStaleFocus, primary } = resolveAreaFocusPrimary({
        chartPhase,
        dragActive: dragSelectionActiveRef.current,
        isLoaded,
        points,
        xDataKey,
        xDomain,
      });
      if (clearStaleFocus) {
        interactionRef.current?.setControlledFocus(null, { source: "pointer" });
      }
      setHoveredIndex(primary ? primary.datumIndex : undefined);
      const dateValue = resolveFocusDate(primary?.datum, xDataKey);
      const validDate = dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue : undefined;
      markerActiveStore.setActiveDate(validDate ?? null);
      updateAreaDatePill({
        datePill,
        discrete: isDiscrete,
        primary: primary ? { datumIndex: primary.datumIndex, primaryX: primary.x } : undefined,
        setLabelFade,
        showDatePill: tooltip?.showDatePill ?? true,
        validDate,
        wasVisibleRef,
      });
    },
    [xDomain, xDataKey, chartPhase, isLoaded, markerActiveStore, tooltip, isDiscrete, datePill, interactionRef],
  );

  const areaMarkerRevealAnimsRef = useRef<Animation[]>([]);
  const areaMarkerRevealCancelRef = useRef<(() => void) | null>(null);
  // Replay key re-opens a reveal window the bkmRevealed latch closed (signature bumps replay).
  const revealedEpochRef = useRef<number | null>(null);
  // Reveal sweep lives in internal/reveal-wipe.ts; its return gates the marker stagger.
  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
    const reveal = resolveAreaRevealState({
      animationDuration,
      chartPhase,
      containerRef,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      prefersReducedMotion,
    });
    const marks = reveal.marks;
    if (!marks || !reveal.shouldAnimate) {return;}
    if (!areaMarkerConfigs.some((cfg: Readonly<(typeof areaMarkerConfigs)[number]>) => cfg.showMarkers ?? false)) {return;}
    cancelAreaMarkerAnims(areaMarkerRevealAnimsRef);
    scheduleAreaMarkerReveal({
      animationEasing,
      animsRef: areaMarkerRevealAnimsRef,
      cancelRef: areaMarkerRevealCancelRef,
      configs: areaMarkerConfigs,
      durationMs: revealDurationMs,
      innerWidth: Math.max(0, width - margin.left - margin.right),
      marks,
    });
  }, [animationDuration, animationEasing, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, areaMarkerConfigs, width, margin.left, margin.right, prefersReducedMotion, captureRenderContext]);

  useEffect(() => {
    if (chartPhase !== "revealing") {return;}
    snapRevealWipe({
      active: true,
      animationDuration,
      marks: containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks"),
      prefersReducedMotion,
    });
  }, [chartPhase, animationDuration, prefersReducedMotion]);
  useEffect((): () => void => (): void => {
    // Settled animations reject on cancel; unmount discards them.
    for (const anim of areaMarkerRevealAnimsRef.current) {
      try {
        anim.cancel();
      } catch {
        // Cancel rejects for settled animations; ignoring it is intentional.
      }
    }
    areaMarkerRevealCancelRef.current?.();
  }, []);

  const overlayRenderedArea = (areaTerminalAnchors.length > 0 || areaEndAnchors.length > 0) && width > 0 && heightPx > 0;
  const pushPhaseToProjectionPort = useEffectEvent((): void => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  });
  useLayoutEffect(() => {
    if (!overlayRenderedArea) {return;}
    pushPhaseToProjectionPort();
  }, [overlayRenderedArea]);

  const innerWidthArea = Math.max(0, width - margin.left - margin.right);
  const areaXScaleD3Ref = useRef<((value: Date) => number | undefined) | null>(null);
  useEffect(() => {
    if (!timeExtent) { areaXScaleD3Ref.current = null; return; }
    areaXScaleD3Ref.current = scaleUtc().domain([timeExtent.minTime, timeExtent.maxTime]).range([0, innerWidthArea]);
  }, [timeExtent, innerWidthArea]);
  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const resolveScenePos = clientToScene;
  const invertSceneX = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? undefined,
    [sceneRef],
  );
  const { selection: chartSelection } = useChartSelection({
    containerRef,
    data,
    enabled: true,
    innerWidth: innerWidthArea,
    invertSceneX,
    marginLeft: margin.left,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      clearFocusChrome();
    },
    resolveScenePos,
    xDataKey,
  });
  const segmentComponents = useMemo(() => extractSegmentComponents(children), [children]);
  const refAreaChildren = useMemo(() => extractReferenceAreaProps(children), [children]);
  // Per-tick y-label color dropped: native tickLabels have no per-tick fill channel.

  // With narrowed xDomain, full-data paths map outside the plot; clip them to the plot rect.
  const innerWidthForBrush = Math.max(0, width - margin.left - margin.right);
  const innerHeightForBrush = Math.max(0, heightPx - margin.top - margin.bottom);
  const areaBrushClipId = useSanitizedId();
  const needsAreaBrushClip = Boolean(xDomain) && innerWidthForBrush > 0 && innerHeightForBrush > 0;
  const brushHost = useMemo((): BrushHost | undefined => {
    if (!brushTrackExtent || innerWidthForBrush <= 0) {return undefined;}
    return { containerRef, margin, trackExtent: brushTrackExtent };
  }, [brushTrackExtent, innerWidthForBrush, margin]);
  const brushPixelExtent = useMemo((): { x0: number; x1: number } | undefined => {
    if (!brushTrackExtent || innerWidthForBrush <= 0 || !brushRangeValue) {return undefined;}
    return selectionToPixelExtent(brushRangeValue, brushTrackExtent, innerWidthForBrush) ?? undefined;
  }, [brushTrackExtent, brushRangeValue, innerWidthForBrush]);
  const areaChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  // Stable identities for layer props that would otherwise allocate per render.
  const referenceAreaGeom = useMemo(
    (): ReferenceAreaLayersGeom => ({
      height: heightPx,
      isLoaded,
      isTimeScale: true,
      margin,
      phase: chartPhase,
      width,
      xDomain: timeExtent ? [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)] : undefined,
      yDomain: yDomainFinal,
      yDomainsByAxis: nicedDomainsByAxis,
    }),
    [heightPx, isLoaded, margin, chartPhase, width, timeExtent, yDomainFinal, nicedDomainsByAxis],
  );
  const resolveAreaX = useCallback((date: Readonly<Date>): number | undefined => {
    const scale = areaXScaleD3Ref.current;
    if (!scale) {return undefined;}
    return scale(date);
  }, []);
  const handleMarkerHoverChange = useCallback((markers: readonly Readonly<ChartMarker>[] | null): void => {
    // Hovering markers hides crosshair/tooltip and drops isActive until next chart hover (legacy).
    if (markers) {
      clearFocusChrome();
    }
  }, [clearFocusChrome]);
  const chartBodyClipStyle = useMemo((): CSSProperties | undefined =>
    (needsAreaBrushClip ? { clipPath: `url(#${areaBrushClipId})` } : undefined),
  [needsAreaBrushClip, areaBrushClipId]);
  const containerStyle = useMemo((): CSSProperties => ({
    aspectRatio,
    isolation: "isolate",
    position: "relative",
    touchAction: "none",
    width: "100%",
    ...style,
  }), [aspectRatio, style]);

  const referenceAreaLayer = heightPx > 0 ? (
    <ReferenceAreaLayers
      configs={refAreaChildren}
      geom={referenceAreaGeom}
    />
  ) : undefined;
  const projectionMarkerLayer = overlayRenderedArea ? (
    <ProjectionMarkerOverlay
      width={width}
      height={heightPx}
      margin={margin}
      terminalMarkers={areaTerminalAnchors}
      projectionEndMarkers={areaEndAnchors}
      phasePort={projectionPhasePortRef}
    />
  ) : undefined;
  const datePillLayer = tooltipEnabled ? (
    <div
      ref={datePill.overlayHostRef}
      style={DATE_PILL_HOST_STYLE}
    />
  ) : undefined;
  const chartMarkerLayer = chartMarkers ? (
    <MarkerActiveTooltipProvider store={markerActiveStore}>
    <ChartMarkersOverlay
      items={chartMarkers.items}
      size={chartMarkers.size}
      showLines={chartMarkers.showLines}
      animate={chartMarkers.animate}
      maxFanned={chartMarkers.maxFanned}
      xScale={resolveAreaX}
      marginLeft={margin.left}
      marginTop={margin.top}
      innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
      containerRef={containerRef}
      animationDuration={animationDuration}
      onMarkerHoverChange={handleMarkerHoverChange}
    />
    </MarkerActiveTooltipProvider>
  ) : undefined;

  // Brush clip rect sits one level deep so the svg > defs tree stays within jsx-max-depth.
  // Conditional-held (like the other layer nodes) so the depth rule counts each tree on its own.
  const brushClipContent = needsAreaBrushClip ? (
    <clipPath id={areaBrushClipId}>
      <rect x={margin.left} y={margin.top} width={innerWidthForBrush} height={innerHeightForBrush} />
    </clipPath>
  ) : undefined;
  const brushClipNode = needsAreaBrushClip ? (
    <svg width={0} height={0} style={HIDDEN_DEF_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {brushClipContent}
      </defs>
    </svg>
  ) : undefined;
  const brushChromeNode = hasBrush && brushHost && brushPixelExtent ? (
    <BrushChrome
      host={brushHost}
      x0={brushPixelExtent.x0}
      x1={brushPixelExtent.x1}
      innerWidth={innerWidthForBrush}
      innerHeight={innerHeightForBrush}
      blurPx={brushConfig?.blurPx}
      fadeOuterEdges={brushConfig?.fadeOuterEdges}
      selectionPattern={brushConfig?.selectionPattern}
      selectedBoxStyle={brushConfig?.selectedBoxStyle}
    />
  ) : undefined;
  const loadingLabelNode = isLoading && (loadingLabel?.length ?? 0) > 0 ? <LoadingLabel text={loadingLabel ?? ""} /> : undefined;
  const backgroundNode = background ? (
    <BackgroundLayer
      config={background}
      innerWidth={innerWidth}
      innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
      marginLeft={margin.left}
      marginTop={margin.top}
      isLoaded={isLoaded}
    />
  ) : undefined;
  const chartBodyNode = definition ? (
    <div style={chartBodyClipStyle}>
      <RendererChart
        renderer={areaChartRenderer}
        ariaLabel="Area chart"
        aspectRatio={parseAspectRatio(aspectRatio)}
        height={heightPx > 0 ? heightPx : undefined}
        definition={definition}
        onFocusGroupChange={handleFocusChange}
        onRender={handleRender}
        renderTooltipBody={tooltipEnabled ? renderTooltipBody : undefined}
      />
    </div>
  ) : undefined;
  const overlayNode = definition && (
    <>
      {referenceAreaLayer}
      <SegmentOverlay
        selection={chartSelection}
        innerWidth={innerWidthArea}
        innerHeight={heightPx - margin.top - margin.bottom}
        marginLeft={margin.left}
        marginTop={margin.top}
        components={segmentComponents}
      />
      {projectionMarkerLayer}
      {datePillLayer}
      <DashTailOverlay
        containerRef={containerRef}
        width={width}
        height={heightPx}
        margin={margin}
        renderData={renderData}
        xDataKey={xDataKey}
        series={resolvedAreas.flatMap((area: ReadonlyResolvedArea) =>
          area.showLine
            ? [{
                dashArray: area.dashArray,
                dashFromIndex: area.dashFromIndex,
                dataKey: area.dataKey,
                stroke: area.stroke,
                strokeWidth: area.strokeWidth,
              }]
            : [],
        )}
        innerWidth={innerWidth}
        innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
      />
      {chartMarkerLayer}
    </>
  );
  const crosshairNode = renderCrosshairNode(crosshairGradientDef, margin.top, Math.max(0, heightPx - margin.top - margin.bottom));
  const projectionGradientNodes = projectionGradientDefsArea.map((grad: Readonly<(typeof projectionGradientDefsArea)[number]>) => (
    <linearGradient key={grad.id} id={grad.id} gradientUnits="userSpaceOnUse" x1={grad.startX} y1={grad.startY} x2={grad.endX} y2={grad.endY}>
      <stop offset="0%" stopColor={grad.gradientStart} />
      <stop offset="100%" stopColor={grad.gradientEnd} />
    </linearGradient>
  ));
  const areaMarkerGradientNodes = areaMarkerGradientDefs.map((grad: Readonly<(typeof areaMarkerGradientDefs)[number]>) => (
    <radialGradient key={grad.id} id={grad.id}>
      <stop offset="0%" stopColor={grad.fill} stopOpacity={1} />
      <stop offset={`${grad.fillFadeStart}%`} stopColor={grad.fill} stopOpacity={1} />
      <stop offset={`${grad.fillFadeEnd}%`} stopColor={grad.fill} stopOpacity={0} />
      <stop offset={`${grad.gapFadeStart}%`} stopColor={grad.stroke} stopOpacity={0} />
      <stop offset={`${grad.gapFadeEnd}%`} stopColor={grad.stroke} stopOpacity={1} />
      <stop offset="100%" stopColor={grad.stroke} stopOpacity={1} />
    </radialGradient>
  ));
  const markerGradientDefsNode = (projectionGradientDefsArea.length > 0 || areaMarkerGradientDefs.length > 0) && (
    <svg
      width={0}
      height={0}
      style={HIDDEN_DEF_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {projectionGradientNodes}
        {areaMarkerGradientNodes}
      </defs>
    </svg>
  );
  const patternDefNodes = patternDefs.map((patternDef: Readonly<(typeof patternDefs)[number]>) => (
    <Fragment key={patternDef.id}>
      {patternDef.node}
      {/* Tile grid shifts by margin: bklit anchors tiles at (margin.left, margin.top). */}
      <pattern
        id={patternDef.id}
        href={`#${patternDef.id}-base`}
        xlinkHref={`#${patternDef.id}-base`}
        patternTransform={`translate(${margin.left} ${margin.top})`}
      />
    </Fragment>
  ));
  const patternDefsNode = patternDefs.length > 0 && (
    <svg
      width={0}
      height={0}
      style={HIDDEN_DEF_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>{patternDefNodes}</defs>
    </svg>
  );

  return (
    <ChartSelectionContext.Provider value={chartSelection}>
    <div
      ref={containerRef}
      className={className}
      // Touch-action none: vertical page scroll must not hijack touch drag-selection.
      style={containerStyle}
      data-bkm-chart="area"
      data-bkm-fade-edges={fadeEdgesMask["data-bkm-fade-edges"]}
      data-bkm-fade-edges-left={fadeEdgesMask["data-bkm-fade-edges-left"]}
      data-bkm-fade-edges-right={fadeEdgesMask["data-bkm-fade-edges-right"]}
    >
      {brushClipNode}
      {brushChromeNode}
      {loadingLabelNode}
      {backgroundNode}
      {chartBodyNode}
      {overlayNode}
      {crosshairNode}
      {markerGradientDefsNode}
      {patternDefsNode}
    </div>
    </ChartSelectionContext.Provider>
  );
};

export { AreaChart };
export type { AreaChartProps };
