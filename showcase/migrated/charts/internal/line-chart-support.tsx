// Shared line-chart primitives: style constants, pure geometry helpers, and defs renderers.
import type { CSSProperties, Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import { scaleLinear as d3ScaleLinear } from "d3-scale";
import type { ChartControl, ChartInteractionController, ChartPoint, SceneStyle } from "@tanstack/charts";
import { isFocusOutsideXDomain } from "./hover-geometry";
import type { useDatePillOverlay } from "./hover-geometry";
import { LineLoadingPulse } from "./line-loading-pulse";
import type { LineLoadingPulseMode } from "./loading-chrome";
import { shortDateFmt } from "./formatters";
import { DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import { parseAspectRatio } from "./parse-aspect-ratio";
import type { MarkerGradientDef } from "./series-marker-mark";
import type { ChartDatum, ChartTooltipConfig, LineConfig } from "./types";
import type { LabelFadeState } from "./line-x-scale";

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
const stringifyJson = (params: Readonly<{ value: unknown }>): string | undefined =>
  JSON.stringify(params.value);

interface StringifyDatumValueParams {
  readonly fallback: string;
  readonly value: unknown;
}

// Tooltip rows stringify untyped datum fields without Object's default dump.
const stringifyDatumValue = (params: Readonly<StringifyDatumValueParams>): string =>
  stringifyJson({ value: params.value }) ?? params.fallback;

// Explicit form of `first || second || fallback` for nullable strings.
const firstNonEmptyString = (first: string | undefined, second: string | undefined): string | undefined => {
  if (first !== undefined && first !== "") {return first;}
  if (second !== undefined && second !== "") {return second;}
  return undefined;
};

// Reference-area geometry needs a real [Date, Date] tuple from a time extent.
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

// Per-role motion for line marks: enter is false (RevealWipe owns it).
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

// Focus is suppressed outside the brushed x-domain or before interaction phase.
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
  readonly wasVisibleRef: RefObject<boolean>;
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

export {
  BRUSH_NATIVE_HIDDEN_STYLE,
  DEFAULT_LINE_STROKE,
  DEFAULT_LINE_STROKE_WIDTH,
  DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX,
  DEFAULT_PROJECTION_LINE_CLASS_NAME,
  DEFAULT_TERMINAL_MARKER_STROKE_WIDTH,
  EMPTY_BRUSH_CONTROLS,
  HIDDEN_DEFS_SVG_STYLE,
  MS_PER_SECOND,
  OVERLAY_HOST_STYLE,
  PROJECTION_FALLBACK_STROKE,
  SKELETON_POINT_COUNT,
  buildLoadingSkeletonPath,
  findPointColorForSeries,
  firstNonEmptyString,
  gateFocusPrimary,
  isBoolean,
  isNumber,
  isString,
  referenceXDomainForExtent,
  renderBrushClipDefs,
  renderCrosshairGradient,
  renderLoadingSkeleton,
  renderMarkerGradientDef,
  renderProfitLossGradientDef,
  renderProjectionGradientDef,
  resolveChartHeightPx,
  resolveEffectiveYDomainTweenBase,
  resolveProfitLossSignIndex,
  scanRenderTimeExtent,
  skeletonPathD,
  skeletonWavePoints,
  stringifyDatumValue,
  syncDatePillChrome,
};
export type { BrushClipParams, CrosshairGradientParams, DatePillSyncParams, FocusClearRef, FocusGate, FocusPoint, GateFocusPrimaryParams, LoadingSkeletonParams, LoadingSkeletonPathParams, SkeletonPoint, StringifyDatumValueParams };
