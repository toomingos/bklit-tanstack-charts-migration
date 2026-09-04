// Bklit ScatterChart on TanStack Charts. One dot mark per series (gradient fill+ring); no decimation.
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { RendererChart } from '@tanstack/react-charts/tooltip';
import type { ChartTooltipBodyRenderContext } from '@tanstack/react-charts/tooltip';
import { defineChart } from "@tanstack/charts/scene";
import { dot } from "@tanstack/charts/dot";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type {
  ChartMark,
  ChartMotionDefinition,
  ChartPoint,
  ChartRendererRenderContext,
  ChartScale,
  DomChartDefinition,
  ResolvedScale,
} from "@tanstack/charts";
import { extractChildren } from "./internal/children-extract";
import { ChartSelectionContext, useChartSelection } from "./internal/chart-selection";
import { buildXAxisTickValues, buildFadeXAxisOptions, hiddenAxisOptions } from "./internal/axis-ticks";
import { resolveVerticalFadeSides, indicatorFadeGradientStops } from "./internal/fade-mask";
import type { IndicatorFadeGradientStop } from "./internal/fade-mask";
import { toIndicatorConfig } from './internal/tooltip-mappers';
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartConfig } from './internal/chart-config-context';
import type { SpringConfig } from './internal/chart-config-context';
import { TooltipContent } from "./internal/tooltip-components";
import type { ChartDatum, ChartPhase, ExtractedChildren, TooltipRow } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { resolveGridGuide } from "./internal/grid";
import { createScatterFocusStrategy } from "./internal/scatter-focus-strategy";
import "./styles.css";
import { isRevealed, markRevealed, setRevealDeadline } from "./internal/deferred-reveal";
import { useChartMargin, DEFAULT_CHART_MARGIN } from './internal/use-chart-margin';
import type { ChartMargin } from './internal/use-chart-margin';
import { useContainerWidth } from './internal/use-container-size';
import {
  BOX_OFFSET,
  CHART_CATEGORY_PALETTE,
  DISCRETE_INTERACTION_THRESHOLD,
} from "./internal/design-tokens";
import { useFocusInjection } from "./internal/focus-injection";
import { buildIndicatorMark } from "./internal/hover-geometry";
import { withMarkerBaseClassName } from "./internal/series-marker-mark";
import { buildNativeTooltipExtension } from "./internal/native-tooltip";
import type { NativeTooltipExtension } from "./internal/native-tooltip";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { toDate } from "./internal/coerce-date";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { useChartRenderer } from "./internal/motion-renderer";
import { resolveMotionEasing } from './internal/reveal-easing';
import type { MotionEasing } from './internal/reveal-easing';
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { clipRevealTiming } from './internal/enter-transition';
import type { EnterTransition } from './internal/enter-transition';
import {
  createAxisValueProjector,
  createNicedYScale,
  resolveYDomainsByAxis,
} from "./internal/y-domain";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
import { attachScatterPillChrome } from "./internal/scatter-pill-chrome";
import type { ScatterLabelFade, ScatterPillChrome, ScatterPillChromeState } from "./internal/scatter-pill-chrome";
import { createScatterEnterMotion, createYGradientScatterMark } from "./internal/scatter-marks";
import { createHoverDotMark } from "./internal/scatter-hover-dot-mark";
import type { ResolvedSeries } from "./internal/scatter-marks";

// Fixed 0.5s enter tween (bklit SeriesPointMarker).
const ENTER_TWEEN_MS = 500;
// Shared 5-entry categorical palette (not TanStack's native 6-entry theme).
const DEFAULT_SCATTER_COLORS: readonly string[] = CHART_CATEGORY_PALETTE;

// Seconds<->milliseconds conversion for enter-motion delay math.
const MS_PER_SECOND = 1000;
// Default dim opacity for non-focused series (bklit inactiveOpacity).
const SCATTER_INACTIVE_OPACITY_DEFAULT = 0.5;
// Default dot radius when the series omits it.
const SCATTER_SERIES_RADIUS_DEFAULT = 5;
// X range padding with no series yet (bklit shell fallback).
const SCATTER_EMPTY_RANGE_PADDING_PX = 12;
// X range padding adds this to the largest series radius.
const SCATTER_RANGE_PADDING_EXTRA_PX = 10;
// Y domain fallback max when no positive value exists; positives get headroom scale.
const SCATTER_DOMAIN_FALLBACK_MAX = 100;
const SCATTER_DOMAIN_HEADROOM_SCALE = 1.1;
// Default tick count for x/y axes when no count is configured.
const SCATTER_TICK_COUNT_DEFAULT = 5;
// Gradient stop percents: full-scale percent plus the ~1px anti-facet fade band half-width.
const SCATTER_GRADIENT_PERCENT_MAX = 100;
const SCATTER_GRADIENT_HALF_PX = 0.5;
// Enter-motion highlight pad as a fraction of the dot radius.
const SCATTER_ENTER_HIGHLIGHT_PAD_FRACTION = 0.35;
// Default crosshair edge-fade length when the indicator config omits it.
const SCATTER_FADE_LENGTH_DEFAULT = 10;

const DEFAULT_Y_GRADIENT_FROM = "var(--color-red-500)";
const DEFAULT_Y_GRADIENT_TO = "var(--color-emerald-500)";

// Hovered group pops to 1.35x radius; the rest dim to inactiveOpacity (default 0.5).
const ACTIVE_HIGHLIGHT_SCALE = 1.35;

// Explicit form of `first || second || fallback` for nullable strings: undefined and
// "" both fall through (strict-boolean-expressions forbids truthiness tests on strings).
const firstNonEmptyString = (first: string | undefined, second: string | undefined): string | undefined => {
  if (first !== undefined && first !== "") {return first;}
  if (second !== undefined && second !== "") {return second;}
  return undefined;
};

// Primitive narrowing predicates; typeof stays inside type guards (allowInTypeGuards).
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number";
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// Pre-render placeholder: the ref below is reassigned every render before any reader runs.
const INITIAL_SCATTER_PILL_CHROME_STATE: ScatterPillChromeState = {
  dateLabels: [],
  pointCount: 0,
  showDatePill: true,
  xDataKey: "",
};

const stringifyDatumValue = (value: unknown, fallback: string): string => {
  if (isString(value)) {return value;}
  if (isNumber(value)) {return String(value);}
  if (value instanceof Date) {return String(value);}
  if (value === undefined || value === null) {return fallback;}
  return JSON.stringify(value);
};

interface YGradientConfig {
  readonly from?: string;
  readonly to?: string;
}

const isYGradientConfig = (value: unknown): value is YGradientConfig => typeof value === "object" && value !== null;

interface ScatterTimeExtent {
  readonly maxTime: number;
  readonly minTime: number;
}

const computeTimeExtent = (data: readonly Readonly<ChartDatum>[], xDataKey: string): ScatterTimeExtent | undefined => {
  const times: number[] = [];
  for (const datum of data) {
    const value = datum[xDataKey];
    if (value instanceof Date) {times.push(value.getTime());}
  }
  if (times.length === 0) {return undefined;}
  return { maxTime: Math.max(...times), minTime: Math.min(...times) };
};

interface BuildSeriesEnterMotionParams {
  readonly animate: boolean;
  readonly durationSec: number;
  readonly easing: MotionEasing;
  readonly innerWidth: number;
  readonly radius: number;
  readonly ringGap: number;
  readonly strokeWidth: number;
}

const buildSeriesEnterMotion = ({
  animate,
  durationSec,
  easing,
  innerWidth,
  radius,
  ringGap,
  strokeWidth,
}: Readonly<BuildSeriesEnterMotionParams>): ChartMotionDefinition<ChartDatum> | false => {
  if (!animate) {return false;}
  const enterRing = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const enterHighlightPad = radius * SCATTER_ENTER_HIGHLIGHT_PAD_FRACTION;
  const enterVisualExtent = radius + enterRing + enterHighlightPad + 2;
  return createScatterEnterMotion({ easing, fadeDurationMs: ENTER_TWEEN_MS, innerWidth, staggerDurationSec: durationSec, visualExtent: enterVisualExtent });
};

interface BuildActiveScatterMarkParams {
  readonly baseR: number;
  readonly projectY: (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedFill: string;
  readonly series: Readonly<ResolvedSeries>;
  readonly xDataKey: string;
}

const buildActiveScatterMark = ({
  baseR,
  projectY,
  renderData,
  resolvedFill,
  series,
  xDataKey,
}: Readonly<BuildActiveScatterMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const activeScatterMark = dot(renderData, {
    fill: resolvedFill,
    id: `${series.dataKey}__active`,
    r: baseR * ACTIVE_HIGHLIGHT_SCALE,
    stroke: "none",
    x: (datum: Readonly<ChartDatum>) => toDate(datum[xDataKey]),
    y: (datum: Readonly<ChartDatum>) => {
      const value = datum[series.dataKey];
      return isFiniteNumber(value) ? projectY(value) : undefined;
    },
  });
  return whenFocused(activeScatterMark, { match: "group", retarget: true });
};

interface BuildScatterSeriesMarksParams {
  readonly enterMotion: ChartMotionDefinition<ChartDatum> | false;
  readonly gradientId: string | undefined;
  readonly hasRing: boolean;
  readonly projectY: (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly scatterDimmed: boolean;
  readonly series: Readonly<ResolvedSeries>;
  readonly xDataKey: string;
}

const buildScatterSeriesMarks = ({
  enterMotion,
  gradientId,
  hasRing,
  projectY,
  renderData,
  scatterDimmed,
  series,
  xDataKey,
}: Readonly<BuildScatterSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (series.useYGradient) {
    return [createYGradientScatterMark({ motion: enterMotion, projectY, series, source: renderData, xDataKey })];
  }
  const baseR = hasRing ? series.radius + series.ringGap + series.strokeWidth : series.radius;
  const resolvedFill = gradientId === undefined ? series.fill : `url(#${gradientId})`;
  const baseScatterMark = dot(renderData, {
    fill: resolvedFill,
    id: series.dataKey,
    motion: enterMotion,
    r: baseR,
    stroke: "none",
    x: (datum: Readonly<ChartDatum>) => toDate(datum[xDataKey]),
    y: (datum: Readonly<ChartDatum>) => {
      const value = datum[series.dataKey];
      return isFiniteNumber(value) ? projectY(value) : undefined;
    },
  });
  if (!series.showActiveHighlight) {return [withMarkerBaseClassName(baseScatterMark, scatterDimmed)];}
  return [
    withMarkerBaseClassName(baseScatterMark, scatterDimmed),
    buildActiveScatterMark({ baseR, projectY, renderData, resolvedFill, series, xDataKey }),
  ];
};

interface SeriesMarksProjector {
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly renderData: readonly ChartDatum[];
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly xDataKey: string;
}

interface BuildAllSeriesMarksParams extends SeriesMarksProjector {
  readonly durationSec: number;
  readonly easing: MotionEasing;
  readonly gradientIdBySeries: Readonly<Map<string, string>>;
  readonly innerWidth: number;
  readonly pointerFocusActive: boolean;
}

const buildAllSeriesMarks = ({
  durationSec,
  easing,
  gradientIdBySeries,
  innerWidth,
  pointerFocusActive,
  projectorFor,
  renderData,
  resolvedSeries,
  xDataKey,
}: Readonly<BuildAllSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const series of resolvedSeries) {
    const projectY = projectorFor(series.yAxisId);
    const enterMotion = buildSeriesEnterMotion({
      animate: series.animate,
      durationSec,
      easing,
      innerWidth,
      radius: series.radius,
      ringGap: series.ringGap,
      strokeWidth: series.strokeWidth,
    });
    const hasRing = series.strokeWidth > 0;
    const gradientId = hasRing ? gradientIdBySeries.get(series.dataKey) : undefined;
    marks.push(
      ...buildScatterSeriesMarks({
        enterMotion,
        gradientId,
        hasRing,
        projectY,
        renderData,
        scatterDimmed: series.fadeOnHover && pointerFocusActive,
        series,
        xDataKey,
      }),
    );
  }
  return marks;
};

interface BuildCrosshairMarkParams {
  readonly crosshairGradientId: string;
  readonly discrete: boolean;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildCrosshairMark = ({
  crosshairGradientId,
  discrete,
  tooltip,
  tooltipSpring,
}: Readonly<BuildCrosshairMarkParams>): ChartMark<ChartDatum, Date, number> | undefined => {
  // Bklit parity quirk: function indicatorColor is never invoked (string form only).
  if (!(tooltip?.enabled ?? false) || !(tooltip?.showCrosshair ?? true)) {return undefined;}
  const indicatorCfg = toIndicatorConfig(tooltip);
  const isDashed = Boolean(indicatorCfg.dasharray);
  const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
  const indicatorColorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
  const indicatorSpringCfg = indicatorCfg.springConfig ?? tooltipSpring;
  // Native crosshair maps legacy indicator geometry one-for-one; strokeOpacity 0.35 overridden to 1.
  return buildIndicatorMark({
    color: indicatorColorValue,
    columnWidth: indicatorCfg.columnWidth,
    dasharray: indicatorCfg.dasharray,
    discrete,
    gradientId: crosshairGradientId,
    span: indicatorCfg.span,
    spring: indicatorSpringCfg,
    strokeOpacity: 1,
    useGradient: !isDashed && fadeSides.any,
    width: indicatorCfg.width,
  });
};

interface BuildHoverDotMarksParams extends SeriesMarksProjector {
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildHoverDotMarks = ({
  projectorFor,
  renderData,
  resolvedSeries,
  tooltip,
  tooltipSpring,
  xDataKey,
}: Readonly<BuildHoverDotMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const [seriesIndex, series] of resolvedSeries.entries()) {
    const projectY = projectorFor(series.yAxisId);
    marks.push(
      whenFocused(
        createHoverDotMark({ projectY, series, seriesIndex, source: renderData, tooltipCfg: tooltip, tooltipSpring, xDataKey }),
        { match: "group", retarget: true },
      ),
    );
  }
  return marks;
};

interface BuildTooltipMarksParams extends SeriesMarksProjector {
  readonly crosshairGradientId: string;
  readonly discrete: boolean;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildTooltipMarks = ({
  crosshairGradientId,
  discrete,
  projectorFor,
  renderData,
  resolvedSeries,
  tooltip,
  tooltipSpring,
  xDataKey,
}: Readonly<BuildTooltipMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (!(tooltip?.enabled ?? false)) {return [];}
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  const crosshair = buildCrosshairMark({ crosshairGradientId, discrete, tooltip, tooltipSpring });
  if (crosshair !== undefined) {marks.push(crosshair);}
  if (tooltip?.showDots ?? true) {
    // Custom whenFocused group/retarget hover dots: legacy draws one enlarged dot per series at x.
    marks.push(...buildHoverDotMarks({ projectorFor, renderData, resolvedSeries, tooltip, tooltipSpring, xDataKey }));
  }
  return marks;
};

interface BuildScatterTooltipExtensionParams {
  readonly discrete: boolean;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipBoxSpring: Readonly<SpringConfig>;
}

const buildScatterTooltipExtension = ({
  discrete,
  tooltip,
  tooltipBoxSpring,
}: Readonly<BuildScatterTooltipExtensionParams>): NativeTooltipExtension<ChartDatum, Date, number> =>
  buildNativeTooltipExtension<ChartDatum, Date, number>({
    // Plot-top anchor: plain point anchor put the panel at the focused point's y.
    anchorX: "point",
    className: tooltip?.className,
    discrete,
    enabled: tooltip?.enabled ?? false,
    offset: BOX_OFFSET,
    spring: tooltipBoxSpring,
  });

interface AssembleScatterDefinitionParams {
  readonly discrete: boolean;
  readonly grid: ExtractedChildren["grid"];
  readonly labelFade: ScatterLabelFade | null;
  readonly margin: ChartMargin;
  readonly scatterFocusStrategy: ReturnType<typeof createScatterFocusStrategy>;
  readonly seriesMarks: readonly ChartMark<ChartDatum, Date, number>[];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipBoxSpring: Readonly<SpringConfig>;
  readonly tooltipMarks: readonly ChartMark<ChartDatum, Date, number>[];
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xScale: ChartScale;
  readonly yScale: ChartScale;
}

const assembleScatterDefinition = ({
  discrete,
  grid,
  labelFade,
  margin,
  scatterFocusStrategy,
  seriesMarks,
  tooltip,
  tooltipBoxSpring,
  tooltipMarks,
  xAxis,
  xScale,
  yScale,
}: Readonly<AssembleScatterDefinitionParams>): DomChartDefinition<ChartDatum, Date, number> => {
  const marks = [...seriesMarks, ...tooltipMarks];
  const gridGuide = resolveGridGuide(grid);
  const spec = {
    margin,
    marks,
    // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
    scales: {
      x: {
        axis: buildFadeXAxisOptions(gridGuide.columnTicks, xAxis ?? undefined, margin.bottom, labelFade),
        grid: gridGuide.vertical,
        scale: xScale,
      },
      y: {
        // Scatter never drew y-axis labels; only the tick-driven grid count is native-configured.
        axis: hiddenAxisOptions(gridGuide.ticks),
        grid: gridGuide.horizontal,
        scale: yScale,
      },
    },
    // Scatter data updates always snap once loaded (tween-on-update is Line-only).
    svgAnimation: false as const,
    theme: { muted: "var(--color-chart-label, var(--chart-label))", palette: CHART_CATEGORY_PALETTE },
  } as const;
  const base = defineChart(spec);
  const withFocus = defineChart(base, {
    focus: scatterFocusStrategy,
    focusRing: false,
    maxFocusDistance: Number.POSITIVE_INFINITY,
  });
  if (!(tooltip?.enabled ?? false)) {return withFocus;}
  return defineChart(withFocus, {
    tooltip: buildScatterTooltipExtension({ discrete, tooltip, tooltipBoxSpring }),
  });
};

// Hidden defs svg sits off-layout; the host reserves no space for it.
const SCATTER_DEFS_SVG_STYLE: React.CSSProperties = { position: "absolute" };
// Selection overlay covers the plot without intercepting pointer input.
const SCATTER_OVERLAY_HOST_STYLE: React.CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };

// Fallback tooltip rows (bklit parity): one row per series, dot color lookup by mark id.
const buildScatterFallbackTooltipRows = (
  datum: Readonly<ChartDatum>,
  resolvedSeries: readonly Readonly<ResolvedSeries>[],
  colorEntries: readonly (readonly [string, string])[],
): TooltipRow[] => {
  const colorByMarkId = new Map<string, string>(colorEntries);
  return resolvedSeries.map((series) => {
    const value = datum[series.dataKey];
    const pointColor = colorByMarkId.get(series.dataKey);
    return {
      color: firstNonEmptyString(series.fill, pointColor) ?? "transparent",
      label: series.dataKey,
      value: isNumber(value) ? value : stringifyDatumValue(value, "0"),
    };
  });
};

interface BuildDefaultTooltipBodyParams {
  readonly datum: ChartDatum;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, Date, number>>[];
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly xDataKey: string;
}

const buildDefaultTooltipBody = ({
  datum,
  points,
  resolvedSeries,
  tooltip,
  xDataKey,
}: Readonly<BuildDefaultTooltipBodyParams>): React.ReactNode => {
  const dateValue = datum[xDataKey];
  const title: string | undefined = dateValue instanceof Date ? weekdayDateFmt.format(dateValue) : undefined;
  const colorEntries: (readonly [string, string])[] = [];
  for (const point of points) {
    colorEntries.push([point.markId, point.color]);
  }
  const rows: TooltipRow[] = tooltip?.rows
    ? tooltip.rows(datum)
    : buildScatterFallbackTooltipRows(datum, resolvedSeries, colorEntries);
  return (
    <TooltipContent title={title} rows={rows}>
      {tooltip?.children}
    </TooltipContent>
  );
};

interface ScatterRevealKeys {
  readonly revealKey: { readonly duration: number; readonly signature: string };
  readonly revealKeyChanged: boolean;
  readonly seen: { readonly duration: number; readonly signature: string } | null;
}

interface ReadScatterRevealKeysParams {
  readonly captureRenderContext: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly context: ChartRendererRenderContext<ChartDatum, Date, number>;
  readonly revealKey: ScatterRevealKeys["revealKey"];
  readonly seenRef: { current: ScatterRevealKeys["seen"] };
}

const readScatterRevealKeys = ({
  captureRenderContext,
  context,
  revealKey,
  seenRef,
}: Readonly<ReadScatterRevealKeysParams>): ScatterRevealKeys & { readonly marksGroup: SVGGElement | null } => {
  const svgRoot = context.surface.element;
  captureRenderContext(context);
  const marksGroup = svgRoot.querySelector<SVGGElement>(".ts-chart__marks");
  const seen = seenRef.current;
  // Test the replay key before the DOM stamp (a latched stamp would swallow signature bumps).
  const revealKeyChanged =
    seen === null || seen.signature !== revealKey.signature || seen.duration !== revealKey.duration;
  return { marksGroup, revealKey, revealKeyChanged, seen };
};

interface SettleStaleRevealTimerParams {
  readonly revealKeyChanged: boolean;
  readonly seen: ScatterRevealKeys["seen"];
  readonly timerRef: { current: number | null };
}

const settleStaleRevealTimer = ({
  revealKeyChanged,
  seen,
  timerRef,
}: Readonly<SettleStaleRevealTimerParams>): boolean => {
  if (seen === null) {return false;}
  if (timerRef.current === null) {return !revealKeyChanged;}
  globalThis.clearTimeout(timerRef.current);
  timerRef.current = null;
  return false;
};

interface ArmScatterRevealParams {
  readonly deadlineMs: number;
  readonly marksGroup: SVGGElement;
  readonly revealKey: ScatterRevealKeys["revealKey"];
  readonly seenRef: { current: ScatterRevealKeys["seen"] };
  readonly setPhase: (phase: ChartPhase) => void;
  readonly timerRef: { current: number | null };
}

const armScatterReveal = ({
  deadlineMs,
  marksGroup,
  revealKey,
  seenRef,
  setPhase,
  timerRef,
}: Readonly<ArmScatterRevealParams>): void => {
  seenRef.current = { ...revealKey };
  markRevealed(marksGroup);
  setPhase("revealing");
  timerRef.current = setRevealDeadline(deadlineMs, {
    onDeadline: () => {
      timerRef.current = null;
      setPhase("ready");
    },
  });
};

interface HandleScatterRenderParams {
  readonly animationDuration: number;
  readonly captureRenderContext: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly context: ChartRendererRenderContext<ChartDatum, Date, number>;
  readonly deadlineMs: number;
  readonly revealKey: ScatterRevealKeys["revealKey"];
  readonly seenRef: { current: ScatterRevealKeys["seen"] };
  readonly setPhase: (phase: ChartPhase) => void;
  readonly timerRef: { current: number | null };
}

const handleScatterRender = ({
  animationDuration,
  captureRenderContext,
  context,
  deadlineMs,
  revealKey,
  seenRef,
  setPhase,
  timerRef,
}: Readonly<HandleScatterRenderParams>): void => {
  const state = readScatterRevealKeys({ captureRenderContext, context, revealKey, seenRef });
  if (
    state.marksGroup === null ||
    animationDuration <= 0 ||
    (isRevealed(state.marksGroup) && !state.revealKeyChanged)
  ) {
    setPhase("ready");
    return;
  }
  if (settleStaleRevealTimer({ revealKeyChanged: state.revealKeyChanged, seen: state.seen, timerRef })) {
    setPhase("ready");
    return;
  }
  armScatterReveal({ deadlineMs, marksGroup: state.marksGroup, revealKey: state.revealKey, seenRef, setPhase, timerRef });
};

interface ScatterChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** Easing for the per-point enter (spring coerced to tween). */
  animationEasing?: string;
  /** Overrides the reveal timing. */
  enterTransition?: EnterTransition;
  /** Replay epoch input: bumping it replays the enter reveal. */
  revealSignature?: string;
  children?: React.ReactNode;
}

interface ScatterGradientDef {
  readonly dataKey: string;
  readonly fill: string;
  readonly fillFadeEnd: number;
  readonly fillFadeStart: number;
  readonly gapFadeEnd: number;
  readonly gapFadeStart: number;
  readonly id: string;
  readonly stroke: string;
}

interface ScatterYGradientDef {
  readonly from: string;
  readonly id: string;
  readonly to: string;
}

const ScatterChart = ({
  data,
  xDataKey = "date",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
}: Readonly<ScatterChartProps>): React.ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);
  // Bklit ScatterChartInner starts unloaded with no status prop: first phase is always "revealing".
  const phaseRef = React.useRef<ChartPhase>("revealing");
  const dragSelectionActiveRef = React.useRef(false);
  const { captureRenderContext, sceneRef, clientToScene } = useFocusInjection<ChartDatum, Date, number>();
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  // Reveal runs once per lifetime; later data swaps snap (bklit StaticSeriesPointMarker).
  // Replay key (sankey shape): a signature bump re-opens a reveal window a boolean would snap shut.
  const seenRevealKeyRef = React.useRef<{ signature: string; duration: number } | null>(null);
  // Reveal span coerces springs to tweens (bklit animation.ts:18).
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = React.useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    [enterTransition, animationDuration, animationEasing],
  );
  // Derived render value (stable unless its inputs change); the render callback closes over it.
  const revealKey = React.useMemo(
    () => ({ duration: animationDuration, signature: revealSignature }),
    [animationDuration, revealSignature],
  );
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  // Latest-callback sync runs post-commit so the render body stays pure.
  React.useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  });
  const setPhase = React.useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) {return;}
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  React.useEffect(() => {
    onPhaseChangeRef.current?.("revealing");
  }, []);

  // Teardown cancels the reveal deadline (native motion needs no imperative cancel).
  React.useEffect(() =>
    (): void => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    }
  , []);

  const { scatters, grid, xAxis, background, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  // Bklit parity: no decimation — every raw point renders, same as the benchmark.
  const renderData = data;

  const gradientBaseId = useSanitizedId();
  const crosshairGradientId = `${gradientBaseId}-crosshair-fade`;

  const resolvedSeries = React.useMemo<ResolvedSeries[]>(
    () =>
      scatters.map((series, index) => {
        const seriesColor =
          DEFAULT_SCATTER_COLORS[index % DEFAULT_SCATTER_COLORS.length];
        const rawFill = series.fill ?? series.stroke ?? seriesColor;
        const useYGradient = series.yGradient !== undefined && series.yGradient !== false;
        const yGradId = useYGradient ? `${gradientBaseId}-ygrad-${index}` : undefined;
        return {
          animate: series.animate ?? true,
          dataKey: series.dataKey,
          enterBlur: series.enterBlur ?? 2,
          fadeOnHover: series.fadeOnHover ?? true,
          fill: rawFill,
          inactiveBlur: series.inactiveBlur ?? 2,
          inactiveOpacity: series.inactiveOpacity ?? SCATTER_INACTIVE_OPACITY_DEFAULT,
          outlineColor: series.outlineColor,
          outlineWidth: series.outlineWidth ?? 0,
          radius: series.radius ?? SCATTER_SERIES_RADIUS_DEFAULT,
          ringGap: series.ringGap ?? 2,
          showActiveHighlight: series.showActiveHighlight ?? true,
          stroke: series.stroke ?? rawFill,
          strokeWidth: series.strokeWidth ?? 2,
          useYGradient,
          yAxisId: series.yAxisId,
          yGradFrom: isYGradientConfig(series.yGradient) ? series.yGradient.from ?? DEFAULT_Y_GRADIENT_FROM : DEFAULT_Y_GRADIENT_FROM,
          yGradId,
          yGradTo: isYGradientConfig(series.yGradient) ? series.yGradient.to ?? DEFAULT_Y_GRADIENT_TO : DEFAULT_Y_GRADIENT_TO,
        };
      }),
    [scatters, gradientBaseId],
  );

  // XRangePadding is max(radius) + 10, or flat 12px with no series yet (bklit shell).
  const xRangePadding = React.useMemo(() => {
    if (resolvedSeries.length === 0) {return SCATTER_EMPTY_RANGE_PADDING_PX;}
    return Math.max(...resolvedSeries.map((series) => series.radius)) + SCATTER_RANGE_PADDING_EXTRA_PX;
  }, [resolvedSeries]);

  // Bklit parity: negatives ignored, max floored at 0, *1.1, fallback 100; nice() from the scale.
  // Per-axis grouping keeps scatter's own rule via the resolveDomain seam (not the time-series one).
  const resolveScatterAxisDomain = React.useCallback(
    (axisSeries: readonly { readonly dataKey: string }[]): [number, number] => {
      let max = 0;
      for (const row of data) {
        for (const series of axisSeries) {
          const value = row[series.dataKey];
          if (isFiniteNumber(value) && value > max) {max = value;}
        }
      }
      return [0, max <= 0 ? SCATTER_DOMAIN_FALLBACK_MAX : max * SCATTER_DOMAIN_HEADROOM_SCALE];
    },
    [data],
  );

  const yDomainsByAxis = React.useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: resolveScatterAxisDomain,
        series: resolvedSeries,
      }),
    [resolvedSeries, resolveScatterAxisDomain],
  );

  // Same closure, not domainForAxis: identical empty answer today, tied together if either changes.
  const yDomain = React.useMemo<[number, number]>(
    () => yDomainsByAxis[DEFAULT_Y_AXIS_ID] ?? resolveScatterAxisDomain([]),
    [yDomainsByAxis, resolveScatterAxisDomain],
  );

  // Secondary axes reproject into the NICED tuple, not yDomain itself (yScale nices yDomain).
  const nicedDomainsByAxis = React.useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      const niced = createNicedYScale(domain).domain();
      const pair: [number, number] = [niced[0] ?? domain[0], niced[1] ?? domain[1]];
      out[axisId] = pair;
    }
    return out;
  }, [yDomainsByAxis]);
  const nicedYDomainScatter = React.useMemo<[number, number]>(() => {
    const niced = createNicedYScale(yDomain).domain();
    return [niced[0] ?? yDomain[0], niced[1] ?? yDomain[1]];
  }, [yDomain]);
  const projectorFor = React.useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, nicedYDomainScatter),
    [nicedDomainsByAxis, nicedYDomainScatter],
  );

  // Single shared x-extent feeds the chart scale, selection scale, and reference-area domain.
  const timeExtentScatter = React.useMemo(() => computeTimeExtent(renderData, xDataKey), [renderData, xDataKey]);

  // Inset ranges need the resolve() escape hatch: plain instances get re-ranged by TanStack.
  const xScale = React.useMemo<ChartScale>(() => {
    const { minTime, maxTime } = timeExtentScatter ?? { maxTime: 0, minTime: 0 };
    return {
      id: "x",
      resolve(context): ResolvedScale {
        const [r0, r1] = context.range;
        const lo = Math.min(r0, r1);
        const hi = Math.max(r0, r1);
        const insetLo = lo + xRangePadding;
        const insetHi = Math.max(insetLo, hi - xRangePadding);
        const scale = scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
        const ticks = xAxis
          ? buildXAxisTickValues({
              data: renderData,
              formatValue: xAxis.formatValue,
              numTicks: xAxis.numTicks ?? SCATTER_TICK_COUNT_DEFAULT,
              rangeEnd: insetHi,
              rangeStart: insetLo,
              tickMode: xAxis.tickMode,
              xDataKey,
            }).map(({ value, label }) => ({
              label,
              position: scale(value),
              value,
            }))
          : scale.ticks(context.tickCount).map((value) => ({
              label: value.toISOString(),
              position: scale(value),
              value,
            }));
        return {
          bandwidth: 0,
          domain: scale.domain(),
          id: context.id,
          map: (value: unknown): number => {
            const parsed = toDate(value);
            if (!parsed) {return Number.NaN;}
            return scale(parsed);
          },
          ticks,
          type: "time",
        };
      },
    };
  }, [timeExtentScatter, xRangePadding, renderData, xDataKey, xAxis]);

  // One dot() mark per series with gradient fill+ring halves per-point DOM nodes (40k to 20k at n=10k).
  // Gradient edges use ~1px bands, not hard stops: hard stops facet into polygons at small radii.
  const gradientDefs = React.useMemo<readonly ScatterGradientDef[]>(
    () => {
      const defs: ScatterGradientDef[] = [];
      for (const series of resolvedSeries) {
        if (series.strokeWidth > 0 && !series.useYGradient) {
          const outerRadius = series.radius + series.ringGap + series.strokeWidth;
          const fillEnd = (series.radius / outerRadius) * SCATTER_GRADIENT_PERCENT_MAX;
          const gapEnd =
            ((series.radius + series.ringGap) / outerRadius) * SCATTER_GRADIENT_PERCENT_MAX;
          const halfPx = (SCATTER_GRADIENT_HALF_PX / outerRadius) * SCATTER_GRADIENT_PERCENT_MAX;
          defs.push({
            dataKey: series.dataKey,
            fill: series.fill,
            fillFadeEnd: Math.min(SCATTER_GRADIENT_PERCENT_MAX, fillEnd + halfPx),
            fillFadeStart: Math.max(0, fillEnd - halfPx),
            gapFadeEnd: Math.min(SCATTER_GRADIENT_PERCENT_MAX, gapEnd + halfPx),
            gapFadeStart: Math.max(0, gapEnd - halfPx),
            id: `${gradientBaseId}-grad-${defs.length}`,
            stroke: series.stroke,
          });
        }
      }
      return defs;
    },
    [gradientBaseId, resolvedSeries],
  );
  const gradientIdBySeries = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const def of gradientDefs) {map.set(def.dataKey, def.id);}
    return map;
  }, [gradientDefs]);

  const yScale = React.useMemo<ChartScale>(
    () => ({
      id: "y",
      resolve(context): ResolvedScale {
        const range: [number, number] = [context.range[0], context.range[1]];
        const scale = scaleLinear()
          .domain(yDomain)
          .nice()
          .range(range);
        const tickValues = scale.ticks(context.tickCount);
        return {
          bandwidth: 0,
          domain: scale.domain(),
          id: context.id,
          map: (value: unknown): number => {
            if (!isNumber(value) || !Number.isFinite(value)) {return Number.NaN;}
            return scale(value);
          },
          ticks: tickValues.map((value) => ({
            label: String(value),
            position: scale(value),
            value,
          })),
          type: "linear",
        };
      },
    }),
    [yDomain],
  );

  // Band-category focus reproduces bklit bisect semantics over ChartPoints (strict > tie-break).
  const scatterFocusStrategy = React.useMemo(
    () => createScatterFocusStrategy(phaseRef),
    [],
  );

  const chartConfig = useChartConfig();

  const [labelFade, setLabelFade] = React.useState<ScatterLabelFade | null>(null);
  // PointerFocusActive drives the base layer's dim+blur class at mark-build time (no blur in states).
  const [pointerFocusActive, setPointerFocusActive] = React.useState(false);

  const definition = React.useMemo((): DomChartDefinition<ChartDatum, Date, number> | undefined => {
    if (width <= 0) {return undefined;}
    const innerWScatterEnter = Math.max(0, width - margin.left - margin.right);
    const durationSecScatterEnter = revealDurationMs / MS_PER_SECOND;
    const scatterEnterEasing = resolveMotionEasing(revealEasingCss);
    // Dense data snaps instead of springing (bklit DISCRETE_INTERACTION_THRESHOLD).
    const discreteScatter = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
    const seriesMarks = buildAllSeriesMarks({
      durationSec: durationSecScatterEnter,
      easing: scatterEnterEasing,
      gradientIdBySeries,
      innerWidth: innerWScatterEnter,
      pointerFocusActive,
      projectorFor,
      renderData,
      resolvedSeries,
      xDataKey,
    });
    const tooltipMarks = buildTooltipMarks({
      crosshairGradientId,
      discrete: discreteScatter,
      projectorFor,
      renderData,
      resolvedSeries,
      tooltip,
      tooltipSpring: chartConfig.tooltipSpring,
      xDataKey,
    });
    return assembleScatterDefinition({
      discrete: discreteScatter,
      grid,
      labelFade,
      margin,
      scatterFocusStrategy,
      seriesMarks,
      tooltip,
      tooltipBoxSpring: chartConfig.tooltipBoxSpring,
      tooltipMarks,
      xAxis,
      xScale,
      yScale,
    });
  }, [renderData, xDataKey, resolvedSeries, grid, width, yScale, xScale, margin, gradientIdBySeries, scatterFocusStrategy, projectorFor, tooltip, chartConfig.tooltipBoxSpring, chartConfig.tooltipSpring, crosshairGradientId, xAxis, labelFade, revealDurationMs, revealEasingCss, pointerFocusActive]);

  const tooltipEnabled = tooltip?.enabled ?? false;
  const pillChromeRef = React.useRef<ScatterPillChrome | null>(null);
  const pillChromeStateRef = React.useRef<ScatterPillChromeState>(INITIAL_SCATTER_PILL_CHROME_STATE);
  const dateLabelsForPill = React.useMemo(() => renderData.map((datum: Readonly<ChartDatum>) => {
    const value = datum[xDataKey];
    if (value instanceof Date) {return shortDateFmt.format(value);}
    return stringifyDatumValue(value, "");
  }), [renderData, xDataKey]);
  // Chrome reads latest committed state lazily via getState; sync runs post-commit, never during render.
  React.useEffect(() => {
    pillChromeStateRef.current = {
      dateLabels: dateLabelsForPill,
      pointCount: renderData.length,
      showDatePill: tooltip?.showDatePill ?? true,
      tickerHalfWidth: xAxis?.tickerHalfWidth,
      xDataKey,
    };
  });

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  const handleLabelFadeChange = React.useCallback(
    (fade: ScatterLabelFade | null) => {
      setLabelFade((prev) => {
        if (fade === null) {return prev === null ? prev : null;}
        if (prev && prev.primaryX === fade.primaryX && prev.hoveredLabel === fade.hoveredLabel) {return prev;}
        return fade;
      });
    },
    [],
  );

  React.useLayoutEffect((): (() => void) | undefined => {
    const el = overlayHostRef.current;
    // The host only mounts once the chart has a definition (width > 0), so the
    // Width flag doubles as the re-attach trigger when the host appears late.
    if (!el || !tooltipEnabled || !hasDefinition) {return undefined;}
    const chrome = attachScatterPillChrome({
      getState: () => pillChromeStateRef.current,
      host: el,
      onLabelFadeChange: handleLabelFadeChange,
      tooltipSpring: chartConfig.tooltipSpring,
    });
    pillChromeRef.current = chrome;
    return (): void => {
      pillChromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig.tooltipSpring, handleLabelFadeChange]);

  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      // Drag arms on pointerdown and clears the tooltip; hover stays suppressed for the drag.
      if (dragSelectionActiveRef.current) {
        pillChromeRef.current?.update([]);
        setPointerFocusActive((prev) => (prev ? false : prev));
        return;
      }
      pillChromeRef.current?.update(points);
      setPointerFocusActive((prev) => {
        const next = points.length > 0;
        return prev === next ? prev : next;
      });
    },
    [],
  );

  // Tooltip panel style merge: backgroundColor wins when non-empty.
  const tooltipPanelStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const panelStyle = tooltip?.panelStyle;
    const backgroundColor = tooltip?.backgroundColor;
    if (panelStyle === undefined && (backgroundColor === undefined || backgroundColor === "")) {return undefined;}
    if (backgroundColor === undefined || backgroundColor === "") {return { ...panelStyle };}
    return { ...panelStyle, backgroundColor };
  }, [tooltip]);

  const renderTooltipBody = React.useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): React.ReactNode => {
      if (ctx.points.length === 0) {return undefined;}
      const [primary] = ctx.points;
      const { datum } = primary;
      const body: React.ReactNode = tooltip?.content
        ? tooltip.content({
            index: primary.datumIndex,
            point: datum,
          })
        : buildDefaultTooltipBody({ datum, points: ctx.points, resolvedSeries, tooltip, xDataKey });
      if (tooltipPanelStyle === undefined) {return body;}
      return (
        <div style={tooltipPanelStyle}>
          {body}
        </div>
      );
    },
    [tooltip, resolvedSeries, xDataKey, tooltipPanelStyle],
  );

  const innerWidthSelection = Math.max(0, width - margin.left - margin.right);

  // Mount reveal is native per-element enter fade (same delay formula); handleRender tracks phase only.
  const handleRender = React.useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    handleScatterRender({
      animationDuration,
      captureRenderContext,
      context,
      deadlineMs: revealDurationMs,
      revealKey,
      seenRef: seenRevealKeyRef,
      setPhase,
      timerRef: revealDeadlineTimerRef,
    });
  }, [animationDuration, revealDurationMs, revealKey, setPhase, captureRenderContext]);

  const refAreaChildrenScatter = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const heightPxScatter = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
  const xDomainScatter: [Date, Date] | undefined = React.useMemo(
    () => timeExtentScatter ? [new Date(timeExtentScatter.minTime), new Date(timeExtentScatter.maxTime)] : undefined,
    [timeExtentScatter],
  );

  const yGradientDefs = React.useMemo<readonly ScatterYGradientDef[]>(
    () =>
      resolvedSeries
        .filter((series): series is ResolvedSeries & { readonly yGradId: string } => series.useYGradient && series.yGradId !== undefined)
        .map((series) => ({ from: series.yGradFrom, id: series.yGradId, to: series.yGradTo })),
    [resolvedSeries],
  );

  const crosshairFadeGradient = React.useMemo((): { color: string; id: string; stops: IndicatorFadeGradientStop[] } | undefined => {
    if (!(tooltip?.enabled ?? false) || !(tooltip?.showCrosshair ?? true)) {return undefined;}
    const indicatorCfg = toIndicatorConfig(tooltip);
    if (indicatorCfg.dasharray !== undefined && indicatorCfg.dasharray !== "") {return undefined;}
    const fadeSides = resolveVerticalFadeSides(indicatorCfg.fadeEdges ?? "both");
    if (!fadeSides.any) {return undefined;}
    const colorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
    return {
      color: colorValue,
      id: crosshairGradientId,
      stops: indicatorFadeGradientStops(fadeSides, indicatorCfg.fadeLength ?? SCATTER_FADE_LENGTH_DEFAULT),
    };
  }, [tooltip, crosshairGradientId]);

  const invertSceneXScatter = React.useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? undefined,
    [sceneRef],
  );

  const { selection: scatterSelection } = useChartSelection({
    containerRef,
    data: renderData,
    enabled: true,
    innerWidth: innerWidthSelection,
    invertSceneX: invertSceneXScatter,
    marginLeft: margin.left,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      pillChromeRef.current?.update([]);
    },
    resolveScenePos: clientToScene,
    xDataKey,
  });
  const scatterChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);
  const containerStyle = React.useMemo<React.CSSProperties>(
    () => ({ aspectRatio, isolation: "isolate", position: "relative", touchAction: "none", width: "100%" }),
    [aspectRatio],
  );

  const showDefsSvg = gradientDefs.length > 0 || yGradientDefs.length > 0 || crosshairFadeGradient !== undefined;
  const crosshairGradientNode: React.ReactNode = crosshairFadeGradient ? (
    <linearGradient
      key={crosshairFadeGradient.id}
      id={crosshairFadeGradient.id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      x2={0}
      y1={margin.top}
      y2={margin.top + Math.max(0, heightPxScatter - margin.top - margin.bottom)}
    >
      {crosshairFadeGradient.stops.map((stop: Readonly<IndicatorFadeGradientStop>) => (
        <stop key={stop.offset} offset={stop.offset} stopColor={crosshairFadeGradient.color} stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
  ) : undefined;
  const radialGradientNodes = gradientDefs.map((def) => (
    <radialGradient key={def.id} id={def.id}>
      <stop offset="0%" stopColor={def.fill} stopOpacity={1} />
      <stop
        offset={`${def.fillFadeStart}%`}
        stopColor={def.fill}
        stopOpacity={1}
      />
      <stop
        offset={`${def.fillFadeEnd}%`}
        stopColor={def.fill}
        stopOpacity={0}
      />
      <stop
        offset={`${def.gapFadeStart}%`}
        stopColor={def.stroke}
        stopOpacity={0}
      />
      <stop
        offset={`${def.gapFadeEnd}%`}
        stopColor={def.stroke}
        stopOpacity={1}
      />
      <stop offset="100%" stopColor={def.stroke} stopOpacity={1} />
    </radialGradient>
  ));
  const yGradientNodes = yGradientDefs.map((def) => (
    <linearGradient
      key={def.id}
      id={def.id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      x2={0}
      y1={heightPxScatter}
      y2={0}
    >
      <stop offset="0%" stopColor={def.from} />
      <stop offset="100%" stopColor={def.to} />
    </linearGradient>
  ));
  const defsSvg: React.ReactNode = showDefsSvg ? (
    // Defs svg renders AFTER the chart: the harness locates charts via #chart-root svg.first().
    <svg
      width={0}
      height={0}
      style={SCATTER_DEFS_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {radialGradientNodes}
        {yGradientNodes}
        {crosshairGradientNode}
      </defs>
    </svg>
  ) : undefined;

  const rendererNode: React.ReactNode = definition !== undefined && (
    <RendererChart
      ariaLabel="Scatter chart"
      aspectRatio={parseAspectRatio(aspectRatio)}
      definition={definition}
      renderer={scatterChartRenderer}
      onFocusGroupChange={handleFocusGroupChange}
      onRender={handleRender}
      renderTooltipBody={renderTooltipBody}
    />
  );
  const refAreaGeom = React.useMemo(() => ({
    height: heightPxScatter,
    isTimeScale: true,
    margin,
    width,
    xDomain: xDomainScatter,
    xRangePadding,
    // Reference areas read the NICED domain the dots paint in, not raw yDomain.
    yDomain: nicedYDomainScatter,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [heightPxScatter, margin, nicedDomainsByAxis, nicedYDomainScatter, width, xDomainScatter, xRangePadding]);
  const refAreaNode: React.ReactNode = heightPxScatter > 0 && (
    <ReferenceAreaLayers
      configs={refAreaChildrenScatter}
      geom={refAreaGeom}
    />
  );
  const overlayNode: React.ReactNode = tooltipEnabled && (
    <div
      ref={overlayHostRef}
      style={SCATTER_OVERLAY_HOST_STYLE}
    />
  );

  return (
    <ChartSelectionContext.Provider value={scatterSelection}>
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="scatter"
    >
      {background && (
        <BackgroundLayer
          config={background}
          innerWidth={Math.max(0, width - margin.left - margin.right)}
          innerHeight={Math.max(0, heightPxScatter - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
        />
      )}
      {definition && (
        <>
          {rendererNode}
          {defsSvg}
          {refAreaNode}
          {overlayNode}
        </>
      )}
    </div>
    </ChartSelectionContext.Provider>
  );
}

export type { ScatterChartProps };
export { DEFAULT_SCATTER_COLORS, ScatterChart };
export default ScatterChart;
