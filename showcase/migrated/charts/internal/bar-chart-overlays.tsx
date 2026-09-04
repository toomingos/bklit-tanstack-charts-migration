// Bar axis, hover chrome, tooltip body, date pill, reveal and depth gradients.
// Split from bar-chart.tsx without behaviour change.
import type { ScaleBand } from "d3-scale";
import type { ChartMark, ChartMotionPhase, ChartMotionTiming, ChartPoint } from "@tanstack/charts";
import { whenFocused } from "@tanstack/charts/focus/mark";
import { selectBarLabelIndices, tickLabelFadeOpacity, hiddenAxisOptions } from "./axis-ticks";
import { createBarHoverDotMark, isNumber, isString, resolveBarDotColor } from "./bar-chart-hover-dots";
import { bezierEasing } from "./bezier-easing";
import type { SpringConfig } from "./chart-config-context";
import type { PillBuild } from "./date-pill";
import { isRevealed, markRevealed, setRevealDeadline } from "./deferred-reveal";
import { FADE_BUFFER, TICKER_HALF_WIDTH } from "./design-tokens";
import { resolveVerticalFadeSides } from "./fade-mask";
import type { resolveGridGuide } from "./grid";
import { buildIndicatorMark } from "./hover-geometry";
import { syncBarPulseGroups } from "./bar-pulse-mark";
import type { PulseWaveGradientStop } from "./bar-pulse-mark";
import { toDotConfig, toIndicatorConfig } from "./tooltip-mappers";
import { TooltipContent } from "./tooltip-components";
import type { BarDepthGradientIds, GlassGradientStop } from "./bar-depth-marks";
import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { BarXAxisConfig, ChartDatum, ChartPhase, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./types";

// Enter stagger spreads 40% of the reveal duration across bars.
const BAR_ENTER_STAGGER_SPREAD_FRACTION = 0.4;
// Percent-string gradient offsets (0-100) scale to 0-1 fractions.
const GRADIENT_STOP_PERCENT_DIVISOR = 100;
// Tick-label baseline offset below the axis (pixels).
const BAR_TICK_LABEL_DY_OFFSET_PX = 26;
// Default cap on visible x tick labels.
const BAR_MAX_TICK_LABELS_DEFAULT = 12;
// Default hover-dot size (pixels).
const DEFAULT_HOVER_DOT_SIZE = 5;
// Default hover-dot stroke width for the ring variant.
const DEFAULT_HOVER_DOT_RING_STROKE_WIDTH = 1.5;
// Default hover-dot corner-radius fraction.
const DEFAULT_HOVER_DOT_RADIUS_FRACTION = 0.25;

interface BarChromeState {
  readonly series: readonly Readonly<{ dataKey: string; color: string }>[];
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly dateLabels: string[];
}

interface ClearDatePillParams {
  readonly pillBuild: PillBuild | null;
  readonly visibilityRef: RefObject<boolean>;
  readonly setLabelFade: Dispatch<SetStateAction<Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined>>;
}

const clearDatePillForEmptyFocus = ({
  pillBuild,
  visibilityRef,
  setLabelFade,
}: Readonly<ClearDatePillParams>): void => {
  visibilityRef.current = false;
  if (pillBuild) {
    pillBuild.layer.style.display = "none";
    pillBuild.spring.stop();
    pillBuild.label.textContent = "";
  }
  setLabelFade((prev) => (prev === undefined ? prev : undefined));
};

interface DatePillContentParams {
  readonly pillBuild: PillBuild;
  readonly dateLabels: readonly string[] | undefined;
  readonly categoryIndex: number;
  readonly categoryLabel: string;
  readonly anchorX: number;
  readonly discrete: boolean;
  readonly showing: boolean;
}

const updateDatePillContent = ({
  pillBuild,
  dateLabels,
  categoryIndex,
  categoryLabel,
  anchorX,
  discrete,
  showing,
}: Readonly<DatePillContentParams>): void => {
  pillBuild.layer.style.display = "";
  if (pillBuild.ticker && dateLabels && dateLabels.length > 0) {
    pillBuild.ticker.update(categoryIndex, discrete);
  } else {
    pillBuild.label.textContent = categoryLabel;
  }
  if (showing || discrete) {pillBuild.spring.jump(anchorX);}
  else {pillBuild.spring.set(anchorX);}
};

interface BarTooltipPanelParams {
  readonly tooltip: ChartTooltipConfig | undefined;
}

interface BarTooltipPanel {
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties | undefined;
}

const resolveBarTooltipPanel = ({ tooltip: tt }: Readonly<BarTooltipPanelParams>): BarTooltipPanel => {
  const tooltipClassName = tt?.className;
  const panelClassName = tooltipClassName !== undefined && tooltipClassName !== "" ? `bkm-tooltip-panel ${tooltipClassName}` : "bkm-tooltip-panel";
  const tooltipPanelStyle = tt?.panelStyle;
  const tooltipBackgroundColor = tt?.backgroundColor;
  const panelStyle: CSSProperties | undefined =
    tooltipPanelStyle !== undefined || (tooltipBackgroundColor !== undefined && tooltipBackgroundColor !== "")
      ? { ...tooltipPanelStyle, ...(tooltipBackgroundColor !== undefined && tooltipBackgroundColor !== "" ? { backgroundColor: tooltipBackgroundColor } : undefined) }
      : undefined;
  return { panelClassName, panelStyle };
};

interface BarRevealSyncParams {
  readonly svgRoot: SVGSVGElement;
  readonly marksGroup: SVGGElement;
  readonly revealKeyChanged: boolean;
  readonly isReadyPhase: boolean;
}

const syncBarPulseIfRevealed = ({
  svgRoot,
  marksGroup,
  revealKeyChanged,
  isReadyPhase,
}: Readonly<BarRevealSyncParams>): boolean => {
  if (isRevealed(marksGroup) && !revealKeyChanged) {
    syncBarPulseGroups(svgRoot, isReadyPhase);
    return true;
  }
  return false;
};

interface BeginBarRevealParams {
  readonly svgRoot: SVGSVGElement;
  readonly marksGroup: SVGGElement;
  readonly renderDataLength: number;
  readonly revealDurationMs: number;
  readonly revealedForDataRef: RefObject<unknown>;
  readonly latestRenderData: unknown;
  readonly revealKeyRef: RefObject<string | null>;
  readonly currentRevealKey: string;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly setPhase: (phase: ChartPhase) => void;
}

interface MarkBarRevealedParams {
  readonly marksGroup: SVGGElement;
  readonly revealedForDataRef: RefObject<unknown>;
  readonly latestRenderData: unknown;
  readonly revealKeyRef: RefObject<string | null>;
  readonly currentRevealKey: string;
  readonly setPhase: (phase: ChartPhase) => void;
}

const markBarRevealed = ({
  marksGroup,
  revealedForDataRef,
  latestRenderData,
  revealKeyRef,
  currentRevealKey,
  setPhase,
}: Readonly<MarkBarRevealedParams>): void => {
  revealedForDataRef.current = latestRenderData;
  revealKeyRef.current = currentRevealKey;
  markRevealed(marksGroup);
  setPhase("revealing");
};

interface ArmBarRevealDeadlineParams {
  readonly svgRoot: SVGSVGElement;
  readonly renderDataLength: number;
  readonly revealDurationMs: number;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly setPhase: (phase: ChartPhase) => void;
}

const armBarRevealDeadline = ({
  svgRoot,
  renderDataLength,
  revealDurationMs,
  revealDeadlineTimerRef,
  setPhase,
}: Readonly<ArmBarRevealDeadlineParams>): void => {
  const staggerSpreadMs = revealDurationMs * BAR_ENTER_STAGGER_SPREAD_FRACTION;
  const staggerMs = renderDataLength > 1 ? staggerSpreadMs : 0;
  const deadlineMs = revealDurationMs + staggerMs;
  revealDeadlineTimerRef.current = setRevealDeadline(deadlineMs, {
    onDeadline: () => {
      setPhase("ready");
      syncBarPulseGroups(svgRoot, true);
    },
  });
};

const beginBarReveal = ({
  svgRoot,
  marksGroup,
  renderDataLength,
  revealDurationMs,
  revealedForDataRef,
  latestRenderData,
  revealKeyRef,
  currentRevealKey,
  revealDeadlineTimerRef,
  setPhase,
}: Readonly<BeginBarRevealParams>): void => {
  markBarRevealed({ currentRevealKey, latestRenderData, marksGroup, revealKeyRef, revealedForDataRef, setPhase });
  armBarRevealDeadline({ renderDataLength, revealDeadlineTimerRef, revealDurationMs, setPhase, svgRoot });
};

interface NativeDepthGradientParams {
  readonly depthGradientIds: BarDepthGradientIds;
  readonly depthGlassPosStops: readonly Readonly<GlassGradientStop>[];
  readonly depthGlassNegStops: readonly Readonly<GlassGradientStop>[];
  readonly pulseWaveStops: readonly Readonly<PulseWaveGradientStop>[];
  readonly pulseWaveGradientId: string;
}

interface BuiltDepthGradientStop {
  readonly color: string;
  readonly offset: number;
  readonly opacity: number;
}

interface BuiltDepthGradient {
  readonly id: string;
  readonly stops: readonly BuiltDepthGradientStop[];
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

interface DepthGlassGradientParams {
  readonly depthGradientIds: BarDepthGradientIds;
  readonly depthGlassPosStops: readonly Readonly<GlassGradientStop>[];
  readonly depthGlassNegStops: readonly Readonly<GlassGradientStop>[];
}

// Glass faces share one objectBoundingBox def each; a single gradient is correct for every bar height.
const buildDepthGlassGradients = ({
  depthGradientIds,
  depthGlassPosStops,
  depthGlassNegStops,
}: Readonly<DepthGlassGradientParams>): BuiltDepthGradient[] => [
  {
    id: depthGradientIds.glassPosId,
    stops: depthGlassPosStops.map((stop: Readonly<GlassGradientStop>) => ({
      color: stop.color,
      offset: Number(stop.offset) / GRADIENT_STOP_PERCENT_DIVISOR,
      opacity: Number(stop.opacity),
    })),
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 1,
  },
  {
    id: depthGradientIds.glassNegId,
    stops: depthGlassNegStops.map((stop: Readonly<GlassGradientStop>) => ({
      color: stop.color,
      offset: Number(stop.offset) / GRADIENT_STOP_PERCENT_DIVISOR,
      opacity: Number(stop.opacity),
    })),
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 1,
  },
];

interface PulseWaveGradientParams {
  readonly pulseWaveStops: readonly Readonly<PulseWaveGradientStop>[];
  readonly pulseWaveGradientId: string;
}

const buildPulseWaveGradient = ({
  pulseWaveStops,
  pulseWaveGradientId,
}: Readonly<PulseWaveGradientParams>): BuiltDepthGradient => ({
  id: pulseWaveGradientId,
  stops: pulseWaveStops.map((stop: Readonly<PulseWaveGradientStop>) => ({
    color: stop.color,
    offset: Number(stop.offset) / GRADIENT_STOP_PERCENT_DIVISOR,
    opacity: Number(stop.opacity),
  })),
  x1: 0,
  x2: 0,
  y1: 1,
  y2: 0,
});

interface DepthShadeGradientParams {
  readonly depthGradientIds: BarDepthGradientIds;
  readonly pulseWaveStops: readonly Readonly<PulseWaveGradientStop>[];
  readonly pulseWaveGradientId: string;
}

const buildDepthShadeGradients = ({
  depthGradientIds,
  pulseWaveStops,
  pulseWaveGradientId,
}: Readonly<DepthShadeGradientParams>): BuiltDepthGradient[] => [
  {
    id: depthGradientIds.sideShadeRtlId,
    stops: [
      { color: "black", offset: 0, opacity: 0.05 },
      { color: "black", offset: 1, opacity: 0.55 },
    ],
    x1: 1,
    x2: 0,
    y1: 0,
    y2: 1,
  },
  {
    id: depthGradientIds.sideShadeLtrId,
    stops: [
      { color: "black", offset: 0, opacity: 0.05 },
      { color: "black", offset: 1, opacity: 0.55 },
    ],
    x1: 0,
    x2: 1,
    y1: 0,
    y2: 1,
  },
  {
    id: depthGradientIds.topShadeId,
    stops: [
      { color: "black", offset: 0, opacity: 0 },
      { color: "black", offset: 1, opacity: 0.18 },
    ],
    x1: 0,
    x2: 0,
    y1: 1,
    y2: 0,
  },
  buildPulseWaveGradient({ pulseWaveGradientId, pulseWaveStops }),
];

// Shared depth gradient defs: objectBoundingBox makes one gradient correct for every bar height.
const buildNativeDepthGradients = ({
  depthGradientIds,
  depthGlassPosStops,
  depthGlassNegStops,
  pulseWaveStops,
  pulseWaveGradientId,
}: Readonly<NativeDepthGradientParams>): BuiltDepthGradient[] => [
  ...buildDepthGlassGradients({ depthGlassNegStops, depthGlassPosStops, depthGradientIds }),
  ...buildDepthShadeGradients({ depthGradientIds, pulseWaveGradientId, pulseWaveStops }),
];

interface BarAxisSectionParams {
  readonly barXAxis: BarXAxisConfig | null;
  readonly gridGuide: ReturnType<typeof resolveGridGuide>;
  readonly marginBottom: number;
  readonly categoryOrder: readonly string[];
  readonly labelFade: Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined;
}

type BarTickLabelMotionResult = false | ChartMotionTiming | undefined;

interface BarVisibleXAxisOptions {
  readonly line: false;
  readonly tickLabels: {
    readonly dy: number;
    readonly fontSize: number;
    readonly motion: (ctx: Readonly<{ phase: ChartMotionPhase; datumCount: number; datumIndex: number }>) => BarTickLabelMotionResult;
    readonly opacity: number | ((ctx: { readonly position: number; readonly value: unknown }) => number);
    readonly thin: boolean;
  };
  readonly ticks: {
    readonly format: StringConstructor;
    readonly padding: number;
    readonly size: number;
  readonly values: readonly string[];
  };
}

interface BarHiddenXAxisOptions {
  readonly line: false;
  readonly tickLabels: false;
  readonly ticks: {
    readonly count: number;
    readonly size: number;
  };
}

interface BarAxisSection {
  readonly gridGuide: ReturnType<typeof resolveGridGuide>;
  readonly xAxisOptions: BarHiddenXAxisOptions | BarVisibleXAxisOptions;
  readonly yAxisOptions: ReturnType<typeof hiddenAxisOptions>;
}

// Values/count are mutually exclusive on tick options (passing both throws).
const buildBarAxisSection = ({
  barXAxis,
  gridGuide,
  marginBottom,
  categoryOrder,
  labelFade,
}: Readonly<BarAxisSectionParams>): BarAxisSection => {
  // Bar never drew y-axis labels; nothing may paint once the axes CSS gate lifts.
  const yAxisOptions = hiddenAxisOptions(gridGuide.ticks);
  const xAxisOptions = barXAxis
    ? {
        line: false as const,
        tickLabels: {
          dy: marginBottom - BAR_TICK_LABEL_DY_OFFSET_PX,
          fontSize: 12,
          // Label position tween returns via tickLabels.motion (native text has no CSS left/top).
          motion: (ctx: Readonly<{ phase: ChartMotionPhase; datumCount: number; datumIndex: number }>): false | ChartMotionTiming | undefined =>
            ctx.phase === "enter" ? false : { transition: { duration: 500, easing: bezierEasing, type: "tween" as const } },
          opacity: labelFade
            ? (ctx: { readonly position: number; readonly value: unknown }): number =>
                tickLabelFadeOpacity({
                  fadeBuffer: FADE_BUFFER,
                  hoveredLabel: labelFade.hoveredLabel,
                  labelText: String(ctx.value),
                  labelX: ctx.position,
                  primaryX: labelFade.primaryX,
                  tickerHalfWidth: barXAxis.tickerHalfWidth ?? TICKER_HALF_WIDTH,
                })
            : 1,
          thin: false,
        },
        ticks: {
          format: String,
          padding: 0,
          size: 0,
          values: selectBarLabelIndices(
            categoryOrder.length,
            barXAxis.showAllLabels ?? false,
            barXAxis.maxLabels ?? BAR_MAX_TICK_LABELS_DEFAULT,
          ).map((labelIndex) => categoryOrder[labelIndex]),
        },
      }
    : {
        line: false as const,
        tickLabels: false as const,
        ticks: { count: gridGuide.columnTicks, size: 0 },
      };
  return { gridGuide, xAxisOptions, yAxisOptions };
};

interface BarCrosshairMarkParams {
  readonly tooltip: ChartTooltipConfig | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly discrete: boolean;
  readonly tooltipSpring: Readonly<SpringConfig>;
  readonly indicatorGradientId: string;
}

const buildBarCrosshairMark = ({
  tooltip,
  tooltipEnabled,
  discrete,
  tooltipSpring,
  indicatorGradientId,
}: Readonly<BarCrosshairMarkParams>): ChartMark<ChartDatum, string, number> | undefined => {
  if (!tooltipEnabled || !(tooltip?.showCrosshair ?? true)) {return undefined;}
  // Bklit parity quirk: function indicatorColor is never invoked (string form only).
  const indicatorCfg = toIndicatorConfig(tooltip);
  const isDashed = Boolean(indicatorCfg.dasharray);
  const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
  const indicatorColorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
  const indicatorSpringCfg = indicatorCfg.springConfig ?? tooltipSpring;
  // Native crosshair defaults strokeOpacity to 0.35; override to 1.
  return buildIndicatorMark({
    color: indicatorColorValue,
    columnWidth: indicatorCfg.columnWidth,
    dasharray: indicatorCfg.dasharray,
    discrete,
    gradientId: indicatorGradientId,
    span: indicatorCfg.span,
    spring: indicatorSpringCfg,
    strokeOpacity: 1,
    useGradient: !isDashed && fadeSides.any,
    width: indicatorCfg.width,
  });
};

interface BarDotMarkerConfig {
  readonly isRing: boolean;
  readonly radiusFraction: number;
  readonly size: number;
  readonly strokeWidth: number;
}

const resolveBarDotMarker = (dotCfg: ReturnType<typeof toDotConfig>): BarDotMarkerConfig => {
  const variant = dotCfg.variant ?? "dot";
  const isRing = variant === "ring";
  const rawSize = dotCfg.size ?? DEFAULT_HOVER_DOT_SIZE;
  return {
    isRing,
    radiusFraction: dotCfg.radiusFraction ?? DEFAULT_HOVER_DOT_RADIUS_FRACTION,
    size: rawSize * (dotCfg.scale ?? 1),
    strokeWidth: dotCfg.strokeWidth ?? (isRing ? DEFAULT_HOVER_DOT_RING_STROKE_WIDTH : 2),
  };
};

interface BarDotHoverMarksParams {
  readonly tooltip: ChartTooltipConfig | null | undefined;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly groupScaleForOverlay: ScaleBand<string>;
  readonly categoryScaleForOverlay: ScaleBand<string>;
  readonly dotSeriesList: readonly Readonly<{ readonly dataKey: string; readonly color: string }>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const buildBarDotHoverMarks = ({
  tooltip,
  categoryAccessor,
  projectValue,
  groupScaleForOverlay,
  categoryScaleForOverlay,
  dotSeriesList,
  renderData,
  tooltipSpring,
}: Readonly<BarDotHoverMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  // Bklit parity: ring-dot sizing is inert (bandWidth was never populated).
  const dotCfg = toDotConfig(tooltip);
  const dotMarker = resolveBarDotMarker(dotCfg);
  const tooltipRowColors = tooltip?.rows?.({}).map((row: Readonly<TooltipRow>) => row.color);
  const groupHalfWidth = groupScaleForOverlay.bandwidth() / 2;
  const hoverMarks: ChartMark<ChartDatum, string, number>[] = [];
  for (const [seriesIndex, series] of dotSeriesList.entries()) {
    const groupOffsetX = groupScaleForOverlay(series.dataKey) ?? 0;
    const fill = resolveBarDotColor({ seriesColor: series.color, seriesIndex, tooltip, tooltipRowColors });
    hoverMarks.push(
      whenFocused(
        createBarHoverDotMark({
          bandStartForCategory: (category) => categoryScaleForOverlay(category) ?? 0,
          categoryAccessor,
          dotMarker,
          fill,
          groupHalfWidth,
          groupOffsetX,
          projectValueForKey: (raw) => projectValue(series.dataKey, raw),
          series,
          source: renderData,
          tooltipSpring,
        }),
        { match: "group", retarget: true },
      ),
    );
  }
  return hoverMarks;
};

interface BarHoverMarksParams {
  readonly tooltip: ChartTooltipConfig | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly discrete: boolean;
  readonly tooltipSpring: Readonly<SpringConfig>;
  readonly indicatorGradientId: string;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly groupScaleForOverlay: ScaleBand<string>;
  readonly categoryScaleForOverlay: ScaleBand<string>;
  readonly dotSeriesList: readonly Readonly<{ readonly dataKey: string; readonly color: string }>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
}

const buildBarHoverMarks = ({
  tooltip,
  tooltipEnabled,
  discrete,
  tooltipSpring,
  indicatorGradientId,
  categoryAccessor,
  projectValue,
  groupScaleForOverlay,
  categoryScaleForOverlay,
  dotSeriesList,
  renderData,
}: Readonly<BarHoverMarksParams>): ChartMark<ChartDatum, string, number>[] => {
  const hoverMarks: ChartMark<ChartDatum, string, number>[] = [];
  const crosshair = buildBarCrosshairMark({ discrete, indicatorGradientId, tooltip, tooltipEnabled, tooltipSpring });
  if (crosshair) {hoverMarks.push(crosshair);}
  if (tooltipEnabled && (tooltip?.showDots ?? true)) {
    hoverMarks.push(...buildBarDotHoverMarks({ categoryAccessor, categoryScaleForOverlay, dotSeriesList, groupScaleForOverlay, projectValue, renderData, tooltip, tooltipSpring }));
  }
  return hoverMarks;
};

interface SyncDatePillParams {
  readonly pillBuild: PillBuild | null;
  readonly showDatePill: boolean;
  readonly dateLabels: readonly string[] | undefined;
  readonly categoryIndex: number;
  readonly categoryLabel: string;
  readonly anchorX: number;
  readonly discrete: boolean;
  readonly showing: boolean;
}

const syncDatePillForCategory = ({
  pillBuild,
  showDatePill,
  dateLabels,
  categoryIndex,
  categoryLabel,
  anchorX,
  discrete,
  showing,
}: Readonly<SyncDatePillParams>): void => {
  if (!pillBuild) {return;}
  if (!showDatePill) {
    pillBuild.layer.style.display = "none";
    return;
  }
  updateDatePillContent({ anchorX, categoryIndex, categoryLabel, dateLabels, discrete, pillBuild, showing });
};

const getBarTooltipValue = (point: Readonly<ChartPoint<ChartDatum, string, number>>): number => {
  const raw: unknown = point.datum[point.markId];
  return isNumber(raw) ? raw : (point.yValue);
};

interface CustomBarTooltipContentParams {
  readonly content: (props: { readonly point: Readonly<ChartTooltipPoint>; readonly index: number }) => ReactNode;
  readonly categoryIndex: number;
  readonly categoryLabel: string;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[];
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties | undefined;
}

const renderCustomBarTooltipContent = ({
  content,
  categoryIndex,
  categoryLabel,
  points,
  panelClassName,
  panelStyle,
}: Readonly<CustomBarTooltipContentParams>): ReactNode => {
  const pointRec: ChartTooltipPoint = { label: categoryLabel };
  for (const point of points) {pointRec[point.markId] = getBarTooltipValue(point);}
  return (
    <div className={panelClassName} style={panelStyle}>
      {content({ index: categoryIndex, point: pointRec })}
    </div>
  );
};

interface DefaultBarTooltipContentParams {
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[];
  readonly pointByMark: ReadonlyMap<string, Readonly<ChartPoint<ChartDatum, string, number>>>;
  readonly seriesList: readonly Readonly<{ dataKey: string; color: string }>[];
  readonly categoryLabel: string;
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties | undefined;
}

interface BarTooltipRowsParams {
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly pointRec: Readonly<ChartTooltipPoint>;
  readonly pointByMark: ReadonlyMap<string, Readonly<ChartPoint<ChartDatum, string, number>>>;
  readonly seriesList: readonly Readonly<{ dataKey: string; color: string }>[];
}

const buildBarTooltipRows = ({
  tooltip: tt,
  pointRec,
  pointByMark,
  seriesList,
}: Readonly<BarTooltipRowsParams>): TooltipRow[] =>
  tt?.rows
    ? tt.rows(pointRec)
    : seriesList.map((series) => {
      const point = pointByMark.get(series.dataKey);
      const pointColor = point?.color;
      return { color: series.color || (pointColor !== undefined && pointColor !== "" ? pointColor : "transparent"), label: series.dataKey, value: point ? getBarTooltipValue(point) : 0 };
    });

const renderDefaultBarTooltipContent = ({
  tooltip: tt,
  points,
  pointByMark,
  seriesList,
  categoryLabel,
  panelClassName,
  panelStyle,
}: Readonly<DefaultBarTooltipContentParams>): ReactNode => {
  const pointRec: ChartTooltipPoint = { label: categoryLabel };
  for (const point of points) {pointRec[point.markId] = getBarTooltipValue(point);}
  const rows = buildBarTooltipRows({ pointByMark, pointRec, seriesList, tooltip: tt });
  return (
    <div className={panelClassName} style={panelStyle}>
      <TooltipContent title={categoryLabel} rows={rows}>
        {tt?.children}
      </TooltipContent>
    </div>
  );
};

interface BarTooltipBodyParams {
  readonly state: BarChromeState | null;
  readonly points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[];
  readonly categoryIndexByLabel: ReadonlyMap<string, number>;
}

const resolveBarTooltipBody = ({
  state,
  points,
  categoryIndexByLabel,
}: Readonly<BarTooltipBodyParams>): ReactNode => {
  if (points.length === 0) {return undefined;}
  const tt = state?.tooltip ?? undefined;
  const categoryLabel = points[0].xValue;
  const categoryIndex = categoryIndexByLabel.get(categoryLabel) ?? 0;
  const pointByMark = new Map(points.map((point: Readonly<ChartPoint<ChartDatum, string, number>>) => [point.markId, point]));
  const { panelClassName, panelStyle } = resolveBarTooltipPanel({ tooltip: tt });
  if (tt?.content) {
    return renderCustomBarTooltipContent({ categoryIndex, categoryLabel, content: tt.content, panelClassName, panelStyle, points });
  }
  return renderDefaultBarTooltipContent({ categoryLabel, panelClassName, panelStyle, pointByMark, points, seriesList: state?.series ?? [], tooltip: tt });
};

interface SettleBarRevealParams {
  readonly svgRoot: SVGSVGElement;
  readonly marksGroup: SVGGElement;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly revealedKeyRef: RefObject<string | null>;
  readonly revealKeyRef: RefObject<string>;
  readonly revealedForDataRef: RefObject<unknown>;
  readonly latestRenderDataRef: RefObject<unknown>;
}

// Settles already-revealed state: replay keys and latched DOM stamps need no new reveal.
// Returns true when settled, false when the caller must begin a fresh reveal.
const settleBarRevealState = ({
  svgRoot,
  marksGroup,
  phaseRef,
  revealedKeyRef,
  revealKeyRef,
  revealedForDataRef,
  latestRenderDataRef,
}: Readonly<SettleBarRevealParams>): boolean => {
  // Test the replay key before the DOM stamp (a latched stamp would swallow signature bumps).
  if (syncBarPulseIfRevealed({ isReadyPhase: phaseRef.current === "ready", marksGroup, revealKeyChanged: revealedKeyRef.current !== revealKeyRef.current, svgRoot })) {
    return true;
  }
  syncBarPulseGroups(svgRoot, false);
  if (revealedForDataRef.current === latestRenderDataRef.current && revealedKeyRef.current === revealKeyRef.current) {
    markRevealed(marksGroup);
    syncBarPulseGroups(svgRoot, phaseRef.current === "ready");
    return true;
  }
  return false;
};

interface BarSvgRenderParams {
  readonly svgRoot: SVGSVGElement;
  readonly animationDuration: number;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly revealedKeyRef: RefObject<string | null>;
  readonly revealKeyRef: RefObject<string>;
  readonly revealedForDataRef: RefObject<unknown>;
  readonly latestRenderDataRef: RefObject<unknown>;
  readonly renderDataLength: number;
  readonly revealDurationMs: number;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly setPhase: (phase: ChartPhase) => void;
}

// HandleRender only tracks phase and syncs BarPulse; native motion owns the reveal.
// Reveal end is timer-approximated: native motion exposes no per-mark completion hook.
const handleBarSvgRender = ({
  svgRoot,
  animationDuration,
  phaseRef,
  revealedKeyRef,
  revealKeyRef,
  revealedForDataRef,
  latestRenderDataRef,
  renderDataLength,
  revealDurationMs,
  revealDeadlineTimerRef,
  setPhase,
}: Readonly<BarSvgRenderParams>): void => {
  const marksGroup = svgRoot.querySelector<SVGGElement>(".ts-chart__marks");
  if (!marksGroup || animationDuration <= 0) {
    setPhase("ready");
    syncBarPulseGroups(svgRoot, true);
    return;
  }
  if (settleBarRevealState({ latestRenderDataRef, marksGroup, phaseRef, revealKeyRef, revealedForDataRef, revealedKeyRef, svgRoot })) {
    return;
  }
  beginBarReveal({
    currentRevealKey: revealKeyRef.current,
    latestRenderData: latestRenderDataRef.current,
    marksGroup,
    renderDataLength,
    revealDeadlineTimerRef,
    revealDurationMs,
    revealKeyRef,
    revealedForDataRef,
    setPhase,
    svgRoot,
  });
};

export type { BarChromeState, BuiltDepthGradient };
export { BAR_ENTER_STAGGER_SPREAD_FRACTION, buildBarAxisSection, buildBarHoverMarks, buildNativeDepthGradients, clearDatePillForEmptyFocus, handleBarSvgRender, resolveBarTooltipBody, syncDatePillForCategory };
