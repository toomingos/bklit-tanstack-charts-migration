// Bklit LineChart, same API, on TanStack Charts; children compile to one defineChart spec.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, Dispatch, ReactElement, ReactNode, SetStateAction } from "react";
import { scaleLinear as d3ScaleLinear } from "d3-scale";
import type { ScaleTime } from "d3-scale";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import type {
  ChartControl,
  ChartInteractionController,
  ChartMark,
  ChartPoint,
  ChartRendererRenderContext,
  SceneStyle,
} from "@tanstack/charts";
import { useChartRenderer } from "./internal/motion-renderer";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./internal/children-extract";
import {
  buildCrosshairGradientDef,
  isFocusOutsideXDomain,
  useDatePillOverlay,
} from "./internal/hover-geometry";
import { useFocusInjection } from "./internal/focus-injection";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
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
import { ProjectionMarkerOverlay } from './internal/terminal-marker';
import type { ProjectionPhaseHandle } from './internal/terminal-marker';
import { extractProfitLossHoveredIndex } from "./internal/profit-loss-config";
import { toDate } from "./internal/coerce-date";
import {
  DISCRETE_INTERACTION_THRESHOLD,
  TOOLTIP_BOX_SPRING,
} from "./internal/design-tokens";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { buildNativeTooltipExtension, renderSeriesTooltipBody } from "./internal/native-tooltip";
import type { ChartDatum, ChartMarker, ChartStatus, ChartTooltipConfig, LineConfig } from "./internal/types";
import { DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from './internal/chart-phase';
import type { ChartPhase } from './internal/chart-phase';
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { resolveFadeEdgesMask } from "./internal/fade-mask";
import { resolveGridGuide } from "./internal/grid";
import { buildLoadingSkeletonRows, resolveLineLoadingPulseMode } from "./internal/loading-chrome";
import { LoadingLabel } from "./internal/loading-label";
import { LineLoadingPulse } from "./internal/line-loading-pulse";
import type { LineLoadingPulseMode } from "./internal/loading-chrome";
import {
  createAxisValueProjector,
  createNicedYScale,
  domainForAxis,
  resolveTimeSeriesYDomain,
  resolveYDomainsByAxis,
  useNicedYDomainChanged,
} from "./internal/y-domain";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import { useChartConfig } from "./internal/use-chart-config";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import { useDebouncedContainerSize } from "./internal/use-container-size";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import { filterDataByXDomain, createXAccessor, snapBrushRangeToValues } from "./internal/brush-selection";
import { BrushChrome } from './internal/brush-chrome';
import { selectionToPixelExtent } from "./internal/brush-chrome-helpers";
import type { BrushHost } from './internal/brush-chrome';
import { brushX } from '@tanstack/charts/interaction/brush';
import type { BrushRange, BrushXChange } from '@tanstack/charts/interaction/brush';
import { controlledSignal } from "@tanstack/charts/interaction/signal";
import { DashTailOverlay } from "./internal/dash-tail";
import { buildMarkerGradientDefs } from "./internal/series-marker-mark";
import type { MarkerGradientDef } from "./internal/series-marker-mark";
import { ChartMarkersOverlay } from "./internal/chart-markers";
import { createActiveMarkersStore } from "./internal/active-markers-store";
import { MarkerActiveTooltipProvider } from "./internal/marker-active-tooltip-provider";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import {
  buildProfitLossGradientDefs,
  buildProjectionGradientDefs,
} from "./internal/line-gradient-defs";
import { runRevealWipe, snapRevealWipe } from "./internal/reveal-wipe";
import {
  LEGEND_DIM_OPACITY,
  buildBaseSeriesMarks,
  buildMarkerDotMarks,
  buildTooltipChromeMarks,
} from "./internal/line-series-marks";
import {
  buildGridHighlightRowMarks,
  buildProjectionEndAnchors,
  buildTerminalAnchors,
} from "./internal/line-marker-anchors";
import {
  buildProfitLossMarks,
  buildProjectionLineMarks,
} from "./internal/line-overlay-marks";
import { clipRevealTiming } from './internal/enter-transition';
import type { EnterTransition } from './internal/enter-transition';
import {
  DEFAULT_MARKER_RADIUS_PX,
  cancelPendingMarkerReveal,
  collectMarkerRevealAnimations,
  hasVisibleMarkerSeries,
  scheduleMarkerReveal,
} from "./internal/line-marker-reveal";
import {
  buildLineXScaleOptions,
  buildLineYScaleOptions,
  createLineXScale,
  resolveLineMotions,
  resolveXTickLabelOpacity,
} from "./internal/line-x-scale";
import type { LabelFadeState } from "./internal/line-x-scale";
import { useLineBrushRange } from "./internal/use-line-brush-range";
import "./styles.css";

const BRUSH_NATIVE_HIDDEN_STYLE: SceneStyle = {
  fill: "transparent",
  fillOpacity: 0,
  stroke: "transparent",
  strokeOpacity: 0,
};
const EMPTY_BRUSH_CONTROLS: readonly ChartControl<Date, number>[] = [];
// Sub-pixel measured-height readings (0 < h <= 0.5) are treated as "not yet measured".
const MEASURED_HEIGHT_MIN_PX = 0.5;
const DEFAULT_LINE_STROKE_WIDTH = 2.5;
// Fallback series stroke when a Line child sets no stroke (matches bklit default).
const DEFAULT_LINE_STROKE = "var(--chart-line-primary)";
// Default className for projection-line marks (bklit projection-line.tsx).
const DEFAULT_PROJECTION_LINE_CLASS_NAME = "chart-projection-line";
// `endpointRadius` on projection-line configs (distinct field from marker `radius`).
const DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX = 5;
// Fallback stroke for projection lines and end markers (bklit projection-line.tsx).
const PROJECTION_FALLBACK_STROKE = "var(--chart-3)";
const MS_PER_SECOND = 1000;
const DEFAULT_TERMINAL_MARKER_STROKE_WIDTH = 1.5;
// Deterministic fake sine-wave path used only for the loading-skeleton pulse preview.
const LOADING_SKELETON_BASE_VALUE = 110;
const LOADING_SKELETON_WAVE_FREQUENCY = 1.15;
const LOADING_SKELETON_WAVE_AMPLITUDE = 36;
const LOADING_SKELETON_TREND_STEP = 9;
// Zero-size gradient-defs svg: stacked out of layout without display:none (keeps defs resolvable).
const HIDDEN_DEFS_SVG_STYLE: CSSProperties = { position: "absolute" };
// Full-cover overlay host: stacked above the chart without intercepting pointer input.
const OVERLAY_HOST_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };

const isBoolean = <Subject,>(value: Subject): value is Subject & boolean => typeof value === "boolean";
const isNumber = <Subject,>(value: Subject): value is Subject & number => typeof value === "number";
const isString = <Subject,>(value: Subject): value is Subject & string => typeof value === "string";

// Bklit parity: height comes from the measured box in both modes, not width/aspectRatio.
const resolveChartHeightPx = (width: number, measuredHeight: number, aspectRatio: string): number => {
  if (width <= 0) {return 0;}
  if (measuredHeight > MEASURED_HEIGHT_MIN_PX) {return measuredHeight;}
  return width / parseAspectRatio(aspectRatio);
};

const resolveEffectiveYDomainTweenBase = (yDomainTween: boolean | number): number => {
  if (isBoolean(yDomainTween)) {return yDomainTween ? DEFAULT_Y_DOMAIN_TWEEN_MS : 0;}
  return yDomainTween;
};

// JSON.stringify returns undefined for functions, symbols, and undefined at runtime.
// The lib types it as string, so stringifyJson pins the honest type and fallbacks stay conditional.
const stringifyJson = (params: Readonly<{ value: unknown }>): string | undefined =>
  JSON.stringify(params.value);

interface StringifyDatumValueParams {
  readonly fallback: string;
  readonly value: unknown;
}

// Tooltip rows stringify untyped datum fields without Object's default "[object Object]" dump.
const stringifyDatumValue = (params: Readonly<StringifyDatumValueParams>): string =>
  stringifyJson({ value: params.value }) ?? params.fallback;

// Explicit form of `first || second || fallback` for nullable strings: undefined and
// "" both fall through (strict-boolean-expressions forbids truthiness tests on strings).
const firstNonEmptyString = (first: string | undefined, second: string | undefined): string | undefined => {
  if (first !== undefined && first !== "") {return first;}
  if (second !== undefined && second !== "") {return second;}
  return undefined;
};

// Reference-area geometry needs a real [Date, Date] tuple; a bare literal infers
// Date[], so the tuple shape is pinned on this helper's return type instead.
const referenceXDomainForExtent = (extent: { readonly minTime: number; readonly maxTime: number } | undefined): [Date, Date] | undefined => {
  if (!extent) {return undefined;}
  return [new Date(extent.minTime), new Date(extent.maxTime)];
};

// Scans decimated rows for the [min, max] millisecond extent of the x channel.
const scanRenderTimeExtent = (rows: readonly Readonly<ChartDatum>[], xKey: string): { maxTime: number; minTime: number } | undefined => {
  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const datum of rows) {
    const timeMs = datum[xKey] instanceof Date ? datum[xKey].getTime() : Number.NaN;
    if (Number.isFinite(timeMs)) {
      minTime = Math.min(minTime, timeMs);
      maxTime = Math.max(maxTime, timeMs);
    }
  }
  if (!Number.isFinite(minTime)) {return undefined;}
  return { maxTime, minTime };
};

// Per-role motion for line marks: enter is false (RevealWipe owns it); update tweens only on y-domain change, else snaps.
interface FocusGate {
  readonly chartPhase: ChartPhase;
  readonly dragSelectionActive: boolean;
  readonly isLoaded: boolean;
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
}

interface FocusClearRef {
  readonly current: ChartInteractionController<ChartDatum, Date, number> | null;
}
type FocusPoint = Readonly<ChartPoint<ChartDatum, Readonly<Date>, number>>;

// Focus is suppressed outside the brushed x-domain, during drag selection, or before the interaction phase; a suppressed focus clears the native focus.
interface GateFocusPrimaryParams {
  readonly gate: Readonly<FocusGate>;
  readonly interactionRef: FocusClearRef;
  readonly points: readonly FocusPoint[];
  readonly rawPrimary: FocusPoint | undefined;
}

const gateFocusPrimary = (params: Readonly<GateFocusPrimaryParams>): FocusPoint | undefined => {
  const outsideXDomain = Boolean(
    params.gate.xDomain && params.rawPrimary && isFocusOutsideXDomain(params.rawPrimary.datum, params.gate.xDataKey, params.gate.xDomain),
  );
  const phaseGated = !(isChartInteractionPhase(params.gate.chartPhase) && params.gate.isLoaded);
  const suppressed = outsideXDomain || params.gate.dragSelectionActive || phaseGated;
  if (suppressed && params.points.length > 0) {
    params.interactionRef.current?.setControlledFocus(null, { source: "pointer" });
  }
  return suppressed ? undefined : params.rawPrimary;
};

// Profit/loss tooltip sign follows the hovered datum's series-0 value.
const resolveProfitLossSignIndex = (
  primary: FocusPoint | undefined,
  profitLossLines: readonly Readonly<{ readonly dataKey: string }>[],
): number | null => {
  let next: number | null = null;
  if (primary) {
    const firstConfig = profitLossLines.at(0);
    const dataKey = firstConfig?.dataKey;
    if (dataKey !== undefined && dataKey !== "") {
      const plValue = primary.datum[dataKey];
      if (isNumber(plValue)) {
        next = plValue >= 0 ? 0 : 1;
      }
    }
  }
  return next;
};

interface DatePillSyncParams {
  readonly activeDate: Date | null;
  readonly datePill: Readonly<ReturnType<typeof useDatePillOverlay>>;
  readonly discrete: boolean;
  readonly setLabelFade: Dispatch<SetStateAction<LabelFadeState | undefined>>;
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
  readonly wasVisibleRef: { current: boolean };
}

// First pill/crosshair show jumps; later moves spring (mirrors legacy showing flag).
const syncDatePillChrome = (primary: FocusPoint | undefined, params: Readonly<DatePillSyncParams>): void => {
  const label = params.activeDate ? shortDateFmt.format(params.activeDate) : null;
  if (primary && (params.tooltip?.showDatePill ?? true)) {
    const jump = !params.wasVisibleRef.current;
    params.wasVisibleRef.current = true;
    params.datePill.show(primary.x, { discrete: params.discrete, index: primary.datumIndex, jump, label });
    params.setLabelFade((prev: Readonly<LabelFadeState> | undefined) =>
      prev && prev.primaryX === primary.x && prev.hoveredLabel === label
        ? prev
        : { hoveredLabel: label, primaryX: primary.x },
    );
  } else {
    params.wasVisibleRef.current = false;
    params.datePill.hide();
    params.setLabelFade(undefined);
  }
};

const renderProjectionGradientDef = (
  def: Readonly<{ id: string; startX: number; startY: number; endX: number; endY: number; gradientStart: string; gradientEnd: string }>,
): ReactElement => (
  <linearGradient key={def.id} id={def.id} gradientUnits="userSpaceOnUse" x1={def.startX} y1={def.startY} x2={def.endX} y2={def.endY}>
    <stop offset="0%" stopColor={def.gradientStart} />
    <stop offset="100%" stopColor={def.gradientEnd} />
  </linearGradient>
);

const renderProfitLossGradientDef = (
  def: Readonly<{ id: string; startX: number; endX: number; stops: readonly Readonly<{ offset: string; opacity: number; color: string }>[] }>,
): ReactElement => (
  <linearGradient key={def.id} id={def.id} gradientUnits="userSpaceOnUse" x1={0} x2={def.endX} y1={0} y2={0}>
    {def.stops.map((stop) => (
      <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
    ))}
  </linearGradient>
);

interface CrosshairGradientParams {
  readonly bottom: number;
  readonly color: string;
  readonly id: string;
  readonly stops: readonly Readonly<{ offset: string; opacity: number }>[];
  readonly top: number;
}

const renderCrosshairGradient = (params: Readonly<CrosshairGradientParams>): ReactElement => (
  <linearGradient id={params.id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={params.top} y2={params.bottom}>
    {params.stops.map((stop) => (
      <stop key={stop.offset} offset={stop.offset} stopColor={params.color} stopOpacity={stop.opacity} />
    ))}
  </linearGradient>
);

const renderMarkerGradientDef = (def: Readonly<MarkerGradientDef>): ReactElement => (
  <radialGradient key={def.id} id={def.id}>
    <stop offset="0%" stopColor={def.fill} stopOpacity={1} />
    <stop offset={`${def.fillFadeStart}%`} stopColor={def.fill} stopOpacity={1} />
    <stop offset={`${def.fillFadeEnd}%`} stopColor={def.fill} stopOpacity={0} />
    <stop offset={`${def.gapFadeStart}%`} stopColor={def.stroke} stopOpacity={0} />
    <stop offset={`${def.gapFadeEnd}%`} stopColor={def.stroke} stopOpacity={1} />
    <stop offset="100%" stopColor={def.stroke} stopOpacity={1} />
  </radialGradient>
);

// Deterministic skeleton pulse: a fixed-count sine-wave preview of the series shape.
const SKELETON_POINT_COUNT = 7;

interface SkeletonPoint {
  readonly x: number;
  readonly y: number;
}

const skeletonWavePoints = (innerWidth: number, yScale: (value: number) => number, seriesCount: number): SkeletonPoint[] => {
  if (seriesCount === 0) {
    return [];
  }
  const points: SkeletonPoint[] = [];
  for (let index = 0; index < SKELETON_POINT_COUNT; index += 1) {
    const x = (index / (SKELETON_POINT_COUNT - 1)) * innerWidth;
    const waveValue = LOADING_SKELETON_BASE_VALUE + Math.sin(index * LOADING_SKELETON_WAVE_FREQUENCY) * LOADING_SKELETON_WAVE_AMPLITUDE + index * LOADING_SKELETON_TREND_STEP;
    points.push({ x, y: yScale(waveValue) });
  }
  return points;
};

const skeletonPathD = (points: readonly SkeletonPoint[]): string => {
  if (points.length < 2) {
    return "";
  }
  let pathD = `M${points[0].x},${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    pathD += ` L${points[index].x},${points[index].y}`;
  }
  return pathD;
};

interface LoadingSkeletonPathParams {
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly seriesCount: number;
  readonly yDomain: readonly [number, number];
}

const buildLoadingSkeletonPath = (params: Readonly<LoadingSkeletonPathParams>): string => {
  const yScale = d3ScaleLinear().domain(params.yDomain).range([params.innerHeight, 0]);
  return skeletonPathD(skeletonWavePoints(params.innerWidth, yScale, params.seriesCount));
};

interface BrushClipParams {
  readonly clipId: string;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

const renderBrushClipDefs = (params: Readonly<BrushClipParams>): ReactElement => (
  <defs>
    <clipPath id={params.clipId}>
      <rect x={params.left} y={params.top} width={params.width} height={params.height} />
    </clipPath>
  </defs>
);

interface LoadingSkeletonParams {
  readonly heightPx: number;
  readonly lines: readonly Readonly<LineConfig>[];
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly pulseMode: LineLoadingPulseMode | null;
  readonly width: number;
  readonly yDomainFinal: [number, number];
}

const renderLoadingSkeleton = (params: Readonly<LoadingSkeletonParams>): ReactElement => {
  const innerWidth = Math.max(0, params.width - params.marginLeft - params.marginRight);
  const innerHeight = Math.max(0, params.heightPx - params.marginTop - params.marginBottom);
  const linePts = innerWidth <= 0 || innerHeight <= 0
    ? ""
    : buildLoadingSkeletonPath({ innerHeight, innerWidth, seriesCount: params.lines.length, yDomain: params.yDomainFinal });
  return (
    <svg
      width={params.width}
      height={params.heightPx}
      style={OVERLAY_HOST_STYLE}
      aria-hidden="true"
    >
      <g transform={`translate(${params.marginLeft},${params.marginTop})`}>
        {linePts !== "" && (
          // LoadingStroke/Opacity forward to LineLoadingPulse (bklit drives the pulse off series 0).
          <LineLoadingPulse
            pathD={linePts}
            width={innerWidth}
            height={innerHeight}
            stroke={params.lines[0]?.loadingStroke}
            strokeOpacity={params.lines[0]?.loadingStrokeOpacity}
            strokeWidth={params.lines[0]?.strokeWidth ?? DEFAULT_LINE_STROKE_WIDTH}
            mode={params.pulseMode ?? "loop"}
          />
        )}
      </g>
    </svg>
  );
};

// First-match native point color for a series key; keeps the tooltip row map shallow.
const findPointColorForSeries = (
  points: readonly { readonly markId: string; readonly color: string }[],
  dataKey: string,
): string | undefined => points.find((point) => point.markId === dataKey)?.color;

export interface LineChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  status?: ChartStatus;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: ReactNode;
  loadingLabel?: string;
  style?: CSSProperties;
  animationEasing?: string;
  yDomainTween?: boolean;
  yDomainTweenDuration?: number;
  xDomain?: [Date, Date];
  /** Accepted but inert (no columnWidth consumer here); kept for bklit API parity. */
  xDomainSlotCount?: number;
  tweenYDomainOnXDomainChange?: boolean;
  /** Overrides the clip-reveal timing; springs coerce to tweens (bklit animation.ts:18). */
  enterTransition?: EnterTransition;
  /** Replay epoch input: changing it replays the mount reveal without a data change. */
  revealSignature?: string;
  ariaLabel?: string;
  ariaDescription?: string;
}

export const LineChart = ({
  data,
  xDataKey = "date",
  status = "ready",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
  loadingLabel,
  style,
  animationEasing = DEFAULT_ANIMATION_EASING,
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount: _xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  enterTransition,
  revealSignature = "",
  ariaLabel = "Line chart",
  ariaDescription,
}: Readonly<LineChartProps>): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height: measuredHeight } = useDebouncedContainerSize(containerRef);
  const heightPx = resolveChartHeightPx(width, measuredHeight, aspectRatio);
  const xScaleD3Ref = useRef<ScaleTime<number, number> | null>(null);
  const onPhaseChangeEvent = useEffectEvent((phase: ChartPhase): void => {
    onPhaseChange?.(phase);
  });
  const projectionPhasePortRef = useRef<ProjectionPhaseHandle | null>(null);

  const effectiveYDomainTweenDuration = useMemo(() => {
    const base = resolveEffectiveYDomainTweenBase(yDomainTween);
    if (!tweenYDomainOnXDomainChange || !xDomain) {return base;}
    return base || DEFAULT_Y_DOMAIN_TWEEN_MS;
  }, [yDomainTween, tweenYDomainOnXDomainChange, xDomain]);
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

  const { lines, grid, xAxis, yAxis, background, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, profitLossLines, chartMarkers, brushes } = useMemo(
    () => extractChildren(children),
    [children],
  );

  const tooltipEnabled = tooltip?.enabled ?? false;
  const projectionConfigs = useMemo(() => extractProjectionLineConfigs(children), [children]);
  const projectionGradientBaseId = useSanitizedId();
  const profitLossHoveredIndex = extractProfitLossHoveredIndex(children);
  const hoveredIndexForPL = profitLossHoveredIndex;
  const [plTooltipSignIndex, setPlTooltipSignIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [labelFade, setLabelFade] = useState<LabelFadeState>();
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { captureRenderContext, sceneRef, interactionRef, clientToScene } =
    useFocusInjection<ChartDatum, Date, number>();

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = useMemo(() => {
    if (innerWidth <= 0) {return data;}
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      lines.map((line: Readonly<LineConfig>) => line.dataKey),
    );
  }, [data, innerWidth, lines]);
  // Dense data snaps instead of springing (bklit pointCount gate).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

  const markerGradientBaseId = useSanitizedId();
  const crosshairGradientId = useSanitizedId();
  const markerSeriesConfigs = useMemo(() => lines.map((line: Readonly<LineConfig>) => ({ dataKey: line.dataKey, markers: line.markers, showMarkers: line.showMarkers, stroke: line.stroke ?? DEFAULT_LINE_STROKE })), [lines]);
  const markerGradientDefs = useMemo(() => buildMarkerGradientDefs(markerSeriesConfigs, markerGradientBaseId), [markerSeriesConfigs, markerGradientBaseId]);
  const markerGradientIdByKey = useMemo(() => {
    const gradientIdByKey = new Map<string, string>();
    for (const def of markerGradientDefs) {gradientIdByKey.set(def.dataKey, def.id);}
    return gradientIdByKey;
  }, [markerGradientDefs]);

  // YDomain scans visibleData when brushing; marks stay on full data (domain-clamp).
  const xAccessorForBrush = useMemo(() => createXAccessor(xDataKey), [xDataKey]);
  const visibleData = useMemo(() => {
    if (!xDomain) {return data;}
    return filterDataByXDomain(data, xDomain, xAccessorForBrush);
  }, [data, xDomain, xAccessorForBrush]);

  const timeExtentRaw = useMemo(() => {
    if (xDomain) {return { maxTime: xDomain[1].getTime(), minTime: xDomain[0].getTime() } as const;}
    return scanRenderTimeExtent(renderData, xDataKey);
  }, [renderData, xDataKey, xDomain]);
  // Rendered x-domain extends the data extent by the projection tail; xDomain skips the merge.
  const timeExtent = useMemo((): { maxTime: number; minTime: number } | undefined => {
    if (!timeExtentRaw) {return undefined;}
    if (xDomain) {return timeExtentRaw;}
    if (projectionConfigs.length === 0) {return timeExtentRaw;}
    return { maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs), minTime: timeExtentRaw.minTime } as const;
  }, [timeExtentRaw, projectionConfigs, xDomain]);

  const brushConfig = brushes.at(0);
  const hasBrush = Boolean(brushConfig);
  const brushTrackExtent = useMemo((): [Date, Date] | undefined => {
    if (!timeExtent) {return undefined;}
    return [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)];
  }, [timeExtent]);
  const brushFallbackRange = useMemo((): BrushRange<Date> | undefined => {
    if (!brushTrackExtent) {return undefined;}
    return { end: brushTrackExtent[1], start: brushTrackExtent[0] };
  }, [brushTrackExtent]);
  const brushRangeValue = useLineBrushRange({ fallbackRange: brushFallbackRange, initialSelection: brushConfig?.initialSelection });
  const brushOnSelectionChange = brushConfig?.onSelectionChange;
  // Brush fires on every preview tick and commit (legacy tracked live), not commit-only.
  const handleBrushChange = useCallback((next: BrushRange<Readonly<Date>>, context: Readonly<{ reason: BrushXChange<Readonly<Date>> }>) => {
    const { reason } = context;
    if (reason.type === "cancel") {return;}
    const startMs = next.start.getTime();
    const endMs = next.end.getTime();
    if (startMs === endMs) {
      // Zero-width clears only on commit; transient mid-drag previews must not null xDomain.
      if (reason.type === "commit") {brushOnSelectionChange?.(null);}
      return;
    }
    brushOnSelectionChange?.({ end: next.end, start: next.start });
  }, [brushOnSelectionChange]);
  // Brush values use full (non-decimated) x data for snap points and keyboard stepping.
  const brushValues = useMemo((): Date[] | undefined => {
    if (!hasBrush) {return undefined;}
    const out: Date[] = [];
    for (const datum of data) {
      const value = xAccessorForBrush(datum);
      if (value instanceof Date) {out.push(value);}
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
        format: (date: Readonly<Date>) => shortDateFmt.format(date),
        handleStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(snappedRange, handleBrushChange),
        selectionStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        startAriaLabel: "Selection start",
        values: brushValues,
      }),
    ];
  }, [hasBrush, brushRangeValue, brushValues, handleBrushChange]);

  // Bklit parity: all>=0 -> [0, max*1.1]; mixed-sign -> [min,max] +/-5%; empty -> [0,100].
  const skeletonRows = useMemo(
    () => buildLoadingSkeletonRows(data.length, lines[0]?.dataKey ?? "value"),
    [data.length, lines],
  );
  const yDomainSource = useMemo(
    () => status === "loading" ? skeletonRows : visibleData,
    [status, skeletonRows, visibleData],
  );
  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: (axisLines: readonly Readonly<LineConfig>[]) => resolveTimeSeriesYDomain(yDomainSource, axisLines),
        series: lines,
      }),
    [yDomainSource, lines],
  );
  const yDomain = useMemo(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );

  const { niced: nicedYDomain, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);

  const yDomainFinal = useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) {return nicedYDomain;}
    return mergeProjectionYDomain(nicedYDomain, projectionConfigs, DEFAULT_Y_AXIS_ID);
  }, [nicedYDomain, projectionConfigs]);

  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      const nicedPair = createNicedYScale(domain).domain();
      out[axisId] = [nicedPair[0] ?? domain[0], nicedPair[1] ?? domain[1]];
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
  const yDomainChangedForTween =
    projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinal[0] !== yDomainFinal[0] ||
        prevYDomainFinal[1] !== yDomainFinal[1];

  const isLoading = status === "loading";
  // Pulse mode follows lifecycle phase (loading loops, exiting finishes, revealing grows in).
  const pulseMode = resolveLineLoadingPulseMode(chartPhase);
  const marks = useMemo<ChartMark<ChartDatum, Date, number>[]>(
    () => {
      if (isLoading) {return [];}
      // Bklit parity: legend dim is plain strokeOpacity 0.3, not a focus state (single-owner slot).
      const legendHoveredKey = legendHoveredIndex === null ? undefined : lines[legendHoveredIndex]?.dataKey;
      const base = buildBaseSeriesMarks({ defaultStroke: DEFAULT_LINE_STROKE, defaultStrokeWidth: DEFAULT_LINE_STROKE_WIDTH, legendDimOpacity: LEGEND_DIM_OPACITY, legendHoveredKey, lines, projectorFor, renderData, xDataKey });
      base.push(
        ...buildMarkerDotMarks({ hasHover: hoveredIndex !== null, legendHoveredKey, markerGradientIdByKey, markerSeriesConfigs, renderData, xDataKey }),
        ...buildTooltipChromeMarks({ crosshairGradientId, defaultStroke: DEFAULT_LINE_STROKE, defaultStrokeWidth: DEFAULT_LINE_STROKE_WIDTH, hoveredIndex, isDiscrete, lines, renderData, tooltip, tooltipEnabled, xDataKey }),
      );
      base.unshift(...buildGridHighlightRowMarks({ grid, heightPx, marginBottom: margin.bottom, marginLeft: margin.left, marginRight: margin.right, marginTop: margin.top, width, yDomainFinal }));
      base.push(
        ...buildProfitLossMarks({ focusedIndex: hoveredIndexForPL ?? plTooltipSignIndex, gradientBaseId: projectionGradientBaseId, heightPx, isLoading, marginBottom: margin.bottom, marginLeft: margin.left, marginRight: margin.right, marginTop: margin.top, profitLossLines, renderData, timeExtent, timeExtentRaw, width, xDataKey, yDomainFinal }),
        ...buildProjectionLineMarks({ fallbackStroke: PROJECTION_FALLBACK_STROKE, gradientBaseId: projectionGradientBaseId, heightPx, isLoading, marginBottom: margin.bottom, marginLeft: margin.left, marginRight: margin.right, marginTop: margin.top, projectionConfigs, projectionDefaultClassName: DEFAULT_PROJECTION_LINE_CLASS_NAME, projectionDefaultEndpointRadius: DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX, projectionLines, timeExtent, timeExtentRaw, width, yDomainFinal }),
      );
      return base;
    },
    [renderData, xDataKey, lines, isLoading, width, heightPx, yDomainFinal, projectorFor, projectionConfigs, projectionLines, projectionGradientBaseId, margin, profitLossLines, hoveredIndexForPL, plTooltipSignIndex, grid, markerSeriesConfigs, markerGradientIdByKey, timeExtent, timeExtentRaw, tooltipEnabled, tooltip, crosshairGradientId, isDiscrete, hoveredIndex, legendHoveredIndex],
  );

  const spec = useMemo(() => {
    if (width <= 0) {return undefined;}
    const xScale = createLineXScale({ renderData, scaleRef: xScaleD3Ref, timeExtent, visibleData, xAxis, xDataKey, xDomain });
    const gridGuide = resolveGridGuide(grid);
    const xTickLabelOpacity = resolveXTickLabelOpacity(labelFade, xAxis);
    // Enter is false (RevealWipe owns it); update tweens only on y-domain change, else snaps.
    const yDomainTweenGateActive = isChartInteractionPhase(chartPhase) && isLoaded && yDomainChangedForTween;
    const { motion, tickLabelMotion } = resolveLineMotions(yDomainTweenGateActive, effectiveYDomainTweenDuration);
    const xScaleOptions = buildLineXScaleOptions({ gridGuide, marginBottom: margin.bottom, tickLabelMotion, xAxis, xScale, xTickLabelOpacity });
    const yScaleOptions = buildLineYScaleOptions({ gridGuide, niced: yDomainFinal, tickLabelMotion, yAxis });
    return {
      controls: brushControls,
      focus: "group-x" as const,
      // Bklit has no focus ring; the hover dot is the indicator.
      focusRing: false,
      margin,
      marks,
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
    };
  }, [marks, renderData, xDataKey, grid, width, yDomainFinal, yDomainChangedForTween, margin, chartPhase, isLoaded, effectiveYDomainTweenDuration, xDomain, timeExtent, tooltip, xAxis, yAxis, visibleData, labelFade, brushControls, xScaleD3Ref]);

  const definition = useMemo(
    () => (spec === undefined ? undefined : defineChart(spec)),
    [spec],
  );

  const renderTooltipBody = useCallback(
    (ctx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, Readonly<Date>, number>>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum, rowsCtx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, Readonly<Date>, number>>) =>
          lines.map((line: Readonly<LineConfig>) => {
            const rowValue = datum[line.dataKey];
            return {
              color: firstNonEmptyString(line.stroke, findPointColorForSeries(rowsCtx.points, line.dataKey)) ?? "transparent",
              label: line.dataKey,
              value: isNumber(rowValue) || isString(rowValue) ? rowValue : stringifyDatumValue({ fallback: "0", value: rowValue ?? 0 }),
            };
          }),
        resolveTitle: (datum) => {
          const date = datum[xDataKey];
          return date instanceof Date ? weekdayDateFmt.format(date) : undefined;
        },
        tooltip,
      }),
    [tooltip, xDataKey, lines],
  );
  // Drag selection suppresses hover chrome (bklit use-chart-interaction.ts parity).
  const dragSelectionActiveRef = useRef(false);
  // First pill/crosshair show jumps; later moves spring (mirrors legacy showing flag).
  const wasVisibleRef = useRef(false);
  const chartConfig = useChartConfig();
  const dateLabelsForPill = useMemo(
    () =>
      renderData.map((datum: Readonly<ChartDatum>) => {
        const rawX = datum[xDataKey] ?? "";
        if (rawX instanceof Date) {return shortDateFmt.format(rawX);}
        if (isString(rawX)) {return rawX;}
        if (isNumber(rawX)) {return String(rawX);}
        return stringifyDatumValue({ fallback: "", value: rawX });
      }),
    [renderData, xDataKey],
  );
  const datePill = useDatePillOverlay({
    dateLabels: dateLabelsForPill,
    enabled: tooltipEnabled && (tooltip?.showDatePill ?? true),
    tooltipSpring: chartConfig.tooltipSpring,
  });
  const markerActiveStore = useMemo(() => createActiveMarkersStore(), []);

  const clearFocusChrome = useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(null);
    if (profitLossLines.length > 0) {setPlTooltipSignIndex(null);}
    markerActiveStore.setActiveDate(null);
    wasVisibleRef.current = false;
    datePill.hide();
    setLabelFade(undefined);
  }, [profitLossLines, markerActiveStore, datePill, interactionRef]);

  const handleFocusChange = useCallback(
    (points: readonly Readonly<ChartPoint<ChartDatum, Readonly<Date>, number>>[]) => {
      const rawPrimary = points.at(0);
      const primary = gateFocusPrimary({ gate: { chartPhase, dragSelectionActive: dragSelectionActiveRef.current, isLoaded, xDataKey, xDomain }, interactionRef, points, rawPrimary });
      if (profitLossLines.length > 0) {
        const next = resolveProfitLossSignIndex(primary, profitLossLines);
        setPlTooltipSignIndex((prev) => (prev === next ? prev : next));
      }
      setHoveredIndex(primary ? primary.datumIndex : null);
      const activeDate = toDate(primary?.datum[xDataKey]);
      markerActiveStore.setActiveDate(activeDate && !Number.isNaN(activeDate.getTime()) ? activeDate : null);
      syncDatePillChrome(primary, { activeDate, datePill, discrete: isDiscrete, setLabelFade, tooltip, wasVisibleRef });
    },
    [xDomain, xDataKey, chartPhase, isLoaded, profitLossLines, markerActiveStore, tooltip, isDiscrete, datePill, interactionRef],
  );

  const markerRevealAnimsRef = useRef<Animation[]>([]);
  const markerRevealCancelRef = useRef<(() => void) | null>(null);
  // Replay key re-opens a reveal window the bkmRevealed latch closed (signature bumps replay).
  const revealedEpochRef = useRef<number | null>(null);
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => {
    captureRenderContext(context);
    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    // Reveal sweep lives in internal/reveal-wipe.ts; its return gates the marker stagger.
    const shouldAnimate = runRevealWipe({
      active: chartPhase === "revealing",
      animationDuration,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      marks: marksGroup,
      prefersReducedMotion,
    });
    if (!marksGroup || !shouldAnimate) {return;}
    if (!hasVisibleMarkerSeries(markerSeriesConfigs)) {return;}
    cancelPendingMarkerReveal(markerRevealAnimsRef, markerRevealCancelRef);
    // Marker stagger spans the clip reveal's duration (bklit series-markers.tsx:102).
    const doMarkerReveal = (): void => {
      markerRevealAnimsRef.current.push(...collectMarkerRevealAnimations({
        animationEasing,
        durationSec: revealDurationMs / MS_PER_SECOND,
        innerWidth: Math.max(0, width - margin.left - margin.right),
        markerSeriesConfigs,
        marksGroup,
      }));
    };
    scheduleMarkerReveal(doMarkerReveal, markerRevealCancelRef);
  }, [animationDuration, animationEasing, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, markerSeriesConfigs, width, margin.left, margin.right, prefersReducedMotion, captureRenderContext]);

  useEffect(() => {
    if (chartPhase !== "revealing") {return;}
    snapRevealWipe({
      active: true,
      animationDuration,
      marks: containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks"),
      prefersReducedMotion,
    });
  }, [chartPhase, animationDuration, prefersReducedMotion]);
  useEffect((): (() => void) => () => {
    for (const pendingAnim of markerRevealAnimsRef.current) {
      try {
        pendingAnim.cancel();
      } catch {
        // Animation already settled — nothing to cancel.
      }
    }
    markerRevealAnimsRef.current = [];
    markerRevealCancelRef.current?.();
  }, []);

  const fadeEdgesMask = resolveFadeEdgesMask(lines.map((line: Readonly<LineConfig>) => line.fadeEdges ?? true));


  const lineTerminalAnchors = useMemo(() => buildTerminalAnchors({
    defaults: { fallbackStroke: "var(--chart-1)", markerRadius: DEFAULT_MARKER_RADIUS_PX, terminalStrokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH },
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
  }), [terminalMarkers, renderData, width, heightPx, margin, xDataKey, yDomainFinal, timeExtent, timeExtentRaw]);
  const lineEndAnchors = useMemo(() => buildProjectionEndAnchors({
    fallbackStroke: PROJECTION_FALLBACK_STROKE,
    heightPx,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    markerRadius: DEFAULT_MARKER_RADIUS_PX,
    projectionEndMarkers,
    timeExtent,
    timeExtentRaw,
    width,
    yDomainFinal,
  }), [projectionEndMarkers, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw]);
  const projectionGradientDefs = useMemo(() => buildProjectionGradientDefs({
    defaultClassName: DEFAULT_PROJECTION_LINE_CLASS_NAME,
    defaultEndpointRadius: DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX,
    fallbackStroke: PROJECTION_FALLBACK_STROKE,
    gradientBaseId: projectionGradientBaseId,
    heightPx,
    isLoading,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    projectionConfigs,
    projectionLines,
    timeExtent,
    timeExtentRaw,
    width,
    yDomainFinal,
  }), [projectionConfigs, projectionLines, width, margin, heightPx, yDomainFinal, timeExtent, timeExtentRaw, projectionGradientBaseId, isLoading]);

  const profitLossGradientDefs = useMemo(() => buildProfitLossGradientDefs({
    gradientBaseId: projectionGradientBaseId,
    marginLeft: margin.left,
    marginRight: margin.right,
    profitLossLines,
    width,
  }), [profitLossLines, width, margin, projectionGradientBaseId]);

  const crosshairGradientDef = useMemo(() => {
    const color = isString(tooltip?.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return tooltipEnabled && (tooltip?.showCrosshair ?? true) ? buildCrosshairGradientDef(crosshairGradientId, color) : undefined;
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  const overlayRendered = (lineTerminalAnchors.length > 0 || lineEndAnchors.length > 0) && width > 0 && heightPx > 0;
  const pushPhaseToProjectionPort = useEffectEvent((): void => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  });
  useLayoutEffect(() => {
    if (!overlayRendered) {return;}
    pushPhaseToProjectionPort();
  }, [overlayRendered]);

  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const resolveScenePos = clientToScene;
  const invertSceneX = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX),
    [sceneRef],
  );

  const { selection: chartSelection } = useChartSelection({
    containerRef,
    data,
    enabled: true,
    innerWidth,
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
  const brushClipId = useSanitizedId();
  const needsBrushClip = Boolean(xDomain) && innerWidthForBrush > 0 && innerHeightForBrush > 0;
  const brushHost = useMemo((): BrushHost | undefined => {
    if (!brushTrackExtent || innerWidthForBrush <= 0) {return undefined;}
    return { containerRef, margin, trackExtent: brushTrackExtent };
  }, [brushTrackExtent, innerWidthForBrush, margin]);
  const brushPixelExtent = useMemo(() => {
    const hasBrushPixelExtent = brushTrackExtent !== undefined && brushRangeValue !== undefined && innerWidthForBrush > 0;
    if (!hasBrushPixelExtent) {return undefined;}
    return selectionToPixelExtent(brushRangeValue, brushTrackExtent, innerWidthForBrush) ?? undefined;
  }, [brushTrackExtent, brushRangeValue, innerWidthForBrush]);
  const lineChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  // Overlay subtrees live outside the definition fragment so no single
  // Expression stacks more than a few conditional operators.
  const referenceAreaGeom = useMemo(() => ({
    height: heightPx,
    isLoaded,
    isTimeScale: true,
    margin,
    phase: chartPhase,
    width,
    xDomain: referenceXDomainForExtent(timeExtent),
    yDomain: yDomainFinal,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [heightPx, isLoaded, margin, chartPhase, width, timeExtent, yDomainFinal, nicedDomainsByAxis]);
  const referenceAreaLayersNode = heightPx > 0 && (
    <ReferenceAreaLayers
      configs={refAreaChildren}
      geom={referenceAreaGeom}
    />
  );
  const projectionGradientDefsNode = projectionGradientDefs.length > 0 && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {projectionGradientDefs.map((def: Parameters<typeof renderProjectionGradientDef>[0]) => renderProjectionGradientDef(def))}
      </defs>
    </svg>
  );
  const profitLossGradientDefsNode = profitLossGradientDefs.length > 0 && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {profitLossGradientDefs.map((def: Parameters<typeof renderProfitLossGradientDef>[0]) => renderProfitLossGradientDef(def))}
      </defs>
    </svg>
  );
  const crosshairGradientDefNode = crosshairGradientDef && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {renderCrosshairGradient({
          bottom: margin.top + Math.max(0, heightPx - margin.top - margin.bottom),
          color: crosshairGradientDef.color,
          id: crosshairGradientDef.id,
          stops: crosshairGradientDef.stops,
          top: margin.top,
        })}
      </defs>
    </svg>
  );
  const projectionMarkerOverlayNode = overlayRendered && (
    <ProjectionMarkerOverlay
      width={width}
      height={heightPx}
      margin={margin}
      terminalMarkers={lineTerminalAnchors}
      projectionEndMarkers={lineEndAnchors}
      phasePort={projectionPhasePortRef}
    />
  );
  const datePillHostNode = tooltipEnabled && (
    <div
      ref={datePill.overlayHostRef}
      style={OVERLAY_HOST_STYLE}
    />
  );
  const markerGradientDefsNode = markerGradientDefs.length > 0 && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {markerGradientDefs.map((def: Parameters<typeof renderMarkerGradientDef>[0]) => renderMarkerGradientDef(def))}
      </defs>
    </svg>
  );
  const projectMarkerX = useCallback((date: Readonly<Date>): number | undefined => {
    // Subtract margin.left: the scale is margin-inclusive and the overlay adds margin itself.
    const timeScale = xScaleD3Ref.current;
    if (!timeScale) {return undefined;}
    // Note: s() always returns a finite number for a numeric range (d3-scale ScaleTime.Output = number, never undefined).
    return timeScale(date) - margin.left;
  }, [margin.left, xScaleD3Ref]);
  const handleMarkerHoverChange = useCallback((markers: readonly Readonly<ChartMarker>[] | null): void => {
    // Hovering markers hides crosshair/tooltip and drops isActive until next chart hover (legacy).
    if (markers) {
      clearFocusChrome();
    }
  }, [clearFocusChrome]);
  const chartMarkersOverlayNode = chartMarkers && (
    <MarkerActiveTooltipProvider store={markerActiveStore}>
    <ChartMarkersOverlay
      items={chartMarkers.items}
      size={chartMarkers.size}
      showLines={chartMarkers.showLines}
      animate={chartMarkers.animate}
      maxFanned={chartMarkers.maxFanned}
      xScale={projectMarkerX}
      marginLeft={margin.left}
      marginTop={margin.top}
      innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
      containerRef={containerRef}
      animationDuration={animationDuration}
      onMarkerHoverChange={handleMarkerHoverChange}
    />
    </MarkerActiveTooltipProvider>
  );

  const rendererClipStyle = useMemo(
    () => (needsBrushClip ? { clipPath: `url(#${brushClipId})` } : undefined),
    [brushClipId, needsBrushClip],
  );
  const rendererNode = definition && (
    <div style={rendererClipStyle}>
      <RendererChart
        renderer={lineChartRenderer}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        aspectRatio={parseAspectRatio(aspectRatio)}
        height={heightPx > 0 ? heightPx : undefined}
        definition={definition}
        onFocusGroupChange={handleFocusChange}
        onRender={handleRender}
        renderTooltipBody={tooltipEnabled ? renderTooltipBody : undefined}
      />
    </div>
  );
  const dashTailSeries = useMemo(() => lines.map((line: Readonly<LineConfig>) => ({
    dashArray: line.dashArray,
    dashFromIndex: line.dashFromIndex,
    dataKey: line.dataKey,
    stroke: line.stroke ?? DEFAULT_LINE_STROKE,
    strokeWidth: line.strokeWidth ?? DEFAULT_LINE_STROKE_WIDTH,
  })), [lines]);
  const definitionOverlayNode = definition && (
    <>
      {referenceAreaLayersNode}
      <SegmentOverlay
        selection={chartSelection}
        innerWidth={innerWidth}
        innerHeight={heightPx - margin.top - margin.bottom}
        marginLeft={margin.left}
        marginTop={margin.top}
        components={segmentComponents}
      />
      {projectionGradientDefsNode}
      {profitLossGradientDefsNode}
      {crosshairGradientDefNode}
      {projectionMarkerOverlayNode}
      {datePillHostNode}
      {markerGradientDefsNode}
      <DashTailOverlay
        containerRef={containerRef}
        width={width}
        height={heightPx}
        margin={margin}
        renderData={renderData}
        xDataKey={xDataKey}
        series={dashTailSeries}
        innerWidth={innerWidth}
        innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
      />
      {chartMarkersOverlayNode}
    </>
  );

  const containerStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%", ...style }), [aspectRatio, style]);
  return (
    <ChartSelectionContext.Provider value={chartSelection}>
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="line"
      data-bkm-fade-edges={fadeEdgesMask["data-bkm-fade-edges"]}
      data-bkm-fade-edges-left={fadeEdgesMask["data-bkm-fade-edges-left"]}
      data-bkm-fade-edges-right={fadeEdgesMask["data-bkm-fade-edges-right"]}
    >
      {needsBrushClip && (
        <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
          {renderBrushClipDefs({ clipId: brushClipId, height: innerHeightForBrush, left: margin.left, top: margin.top, width: innerWidthForBrush })}
        </svg>
      )}
      {hasBrush && brushHost && brushPixelExtent && (
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
      )}
      {isLoading && loadingLabel !== undefined && loadingLabel !== "" && <LoadingLabel text={loadingLabel} />}
      {background && (
        <BackgroundLayer
          config={background}
          innerWidth={innerWidth}
          innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
          isLoaded={isLoaded}
        />
      )}
      {rendererNode}
      {definitionOverlayNode}
      {!definition && isLoading && width > 0 && renderLoadingSkeleton({
        heightPx,
        lines,
        marginBottom: margin.bottom,
        marginLeft: margin.left,
        marginRight: margin.right,
        marginTop: margin.top,
        pulseMode,
        width,
        yDomainFinal,
      })}
    </div>
    </ChartSelectionContext.Provider>
  );
};
