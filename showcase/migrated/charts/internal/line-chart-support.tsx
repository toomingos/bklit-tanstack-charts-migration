// Shared line-chart primitives: style constants, pure geometry helpers, and defs renderers.
import type { CSSProperties, Dispatch, ReactElement, SetStateAction } from "react";
import type { ChartControl, ChartInteractionController, ChartPoint, SceneStyle } from "@tanstack/charts";
import { isFocusOutsideXDomain } from "./focus-marks";
import { shortDateFmt } from "./formatters";
import { DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import { parseAspectRatio } from "./parse-aspect-ratio";
// eslint-disable-next-line unicorn/prefer-export-from -- re-exported through the single export block below (import/group-exports).
import { useDebouncedContainerSize } from "./use-container-size";
import type { MarkerGradientDef } from "./series-marker-mark";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import type { LabelFadeState } from "./line-x-scale";
import { normalizeYAxisId } from "./y-axis-id";
import type { ProjectionLineConfig } from "./projection-config";
import type { ProjectionPoint } from "./projection-utils";

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

// Latest projection-tail timestamp above the data extent.
// Merge stays a no-op (same ref out) without a projecting tail.
const maxProjectionTailTime = (configs: readonly ProjectionLineConfig[], floor: number): number => {
  let maxTime = floor;
  for (const config of configs) {
    for (const point of config.data) {
      const time = point.date.getTime();
      if (time > maxTime) {maxTime = time;}
    }
  }
  return maxTime;
};

// Projection configs from merged line props; mirrors the children scan.
// Coerced dates, normalized axis id, two-point minimum.
const normalizeProjectionLineConfigs = (lines: readonly { readonly data?: readonly Readonly<ProjectionPoint>[]; readonly yAxisId?: string | number }[]): ProjectionLineConfig[] => {
  const configs: ProjectionLineConfig[] = [];
  for (const line of lines) {
    const data: ProjectionPoint[] = [];
    for (const point of line.data ?? []) {
      data.push({ date: point.date instanceof Date ? point.date : new Date(point.date), value: point.value });
    }
    if (data.length >= 2) {configs.push({ data, yAxisId: normalizeYAxisId(line.yAxisId) });}
  }
  return configs;
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

interface DateLabelFadeParams {
  readonly activeDate: Date | null;
  readonly setLabelFade: Dispatch<SetStateAction<LabelFadeState | undefined>>;
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
}

// The crosshair x label carries the date text now; only the axis label fade stays here.
const syncDateLabelFade = (primary: FocusPoint | undefined, params: Readonly<DateLabelFadeParams>): void => {
  const label = params.activeDate ? shortDateFmt.format(params.activeDate) : null;
  if (primary && (params.tooltip?.showDatePill ?? true)) {
    params.setLabelFade((prev: Readonly<LabelFadeState> | undefined) =>
      prev && prev.primaryX === primary.x && prev.hoveredLabel === label
        ? prev
        : { hoveredLabel: label, primaryX: primary.x },
    );
  } else {
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
  MS_PER_SECOND,
  OVERLAY_HOST_STYLE,
  PROJECTION_FALLBACK_STROKE,
  findPointColorForSeries,
  firstNonEmptyString,
  gateFocusPrimary,
  isBoolean,
  isNumber,
  isString,
  maxProjectionTailTime,
  normalizeProjectionLineConfigs,
  referenceXDomainForExtent,
  renderMarkerGradientDef,
  renderProfitLossGradientDef,
  renderProjectionGradientDef,
  resolveChartHeightPx,
  resolveEffectiveYDomainTweenBase,
  resolveProfitLossSignIndex,
  scanRenderTimeExtent,
  stringifyDatumValue,
  syncDateLabelFade,
  useDebouncedContainerSize,
};
export type { DateLabelFadeParams, FocusClearRef, FocusGate, FocusPoint, GateFocusPrimaryParams, StringifyDatumValueParams };
export type { ProjectionPhaseHandle } from "./terminal-marker-phase";
