// Shared area-chart model: series resolution, pattern/gradient defs, extents, datum guards.
// Verbatim logic from area-chart.tsx; no behaviour change.
import { curveMonotoneX } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { parseAspectRatio } from "./parse-aspect-ratio";
import { renderPatternPreset } from "./pattern-preset-render";
import type { PatternPresetId } from "./pattern-preset";
import type {
  AreaConfig,
  ChartDatum,
  SeriesPointMarkerStyle,
} from "./types";
import type { ReactNode } from "react";

// Dimmed (legend/pointer) area opacity; legend dim rides reactive fillOpacity.
const AREA_DIM_OPACITY = 0.6;
// Bklit default area-fill alpha when a series omits fillOpacity.
const DEFAULT_AREA_FILL_OPACITY = 0.4;
// Area boundary default stroke width when a series omits one.
const DEFAULT_AREA_STROKE_WIDTH_PX = 2;
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
// Fallback accent stroke for terminal/projection chrome when a series omits one.
const PROJECTION_FALLBACK_STROKE = "var(--chart-3)";

interface ResolvedArea {
  readonly dataKey: string;
  yAxisId?: string | number;
  readonly fill: string;
  stroke: string;
  strokeWidth: number;
  readonly fillOpacity: number;
  readonly curve: CurveFactory;
  readonly showLine: boolean;
  readonly gradientToOpacity: number;
  readonly gradientSpan: number;
  readonly fadeEdges: boolean | "left" | "right";
  showHighlight: boolean;
  readonly dashFromIndex?: number;
  readonly dashArray?: string;
  readonly showMarkers?: boolean;
  readonly markers?: SeriesPointMarkerStyle;
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
  readonly dataKey: string;
  readonly fill?: string;
  readonly patternPreset?: PatternPresetId;
  readonly patternColor?: string;
  readonly curve: CurveFactory;
}

interface AreaPatternDef {
  readonly dataKey: string;
  readonly id: string;
  readonly preset: PatternPresetId;
  readonly color?: string;
  readonly node: ReactNode;
}

interface AreaGradientDef {
  readonly dataKey: string;
  readonly fill: string;
  readonly fillOpacity: number;
  readonly gradientToOpacity: number;
  readonly id: string;
  readonly spanPct: number;
}

interface NativeAreaGradientStop {
  readonly color: string;
  readonly offset: number;
  readonly opacity: number;
}

interface NativeAreaGradient {
  readonly id: string;
  readonly stops: readonly NativeAreaGradientStop[];
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
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

const buildPatternIdMap = (patternDefs: readonly Readonly<AreaPatternDef>[]): Map<string, string> => {
  const idByKey = new Map<string, string>();
  for (const patternDef of patternDefs) {idByKey.set(patternDef.dataKey, patternDef.id);}
  return idByKey;
};

// Bklit defaults: stroke = fill = var(--chart-line-primary), width 2, fillOpacity 0.4, curveMonotoneX.
const resolveResolvedAreas = (areas: readonly ReadonlyAreaConfig[]): ResolvedArea[] =>
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
      strokeWidth: area.strokeWidth ?? DEFAULT_AREA_STROKE_WIDTH_PX,
      yAxisId: area.yAxisId,
    };
  });

interface PatternAreaSource {
  readonly curve?: CurveFactory;
  readonly dataKey: string;
  readonly fill?: string;
  readonly patternColor?: string;
  readonly patternPreset?: PatternPresetId;
}

// Pattern areas resolve with the same curve default as fills; no stroke (fill-only mark).
const resolvePatternAreas = (patternAreaList: readonly Readonly<PatternAreaSource>[]): ResolvedPatternArea[] =>
  patternAreaList.map((patternArea: Readonly<PatternAreaSource>) => ({
    curve: patternArea.curve ?? curveMonotoneX,
    dataKey: patternArea.dataKey,
    fill: patternArea.fill,
    patternColor: patternArea.patternColor,
    patternPreset: patternArea.patternPreset,
  }));

// Gradient stops carry fillOpacity (never double-applied); span clamps to [0.01, 1].
const buildAreaGradientDefs = (
  resolvedAreas: readonly ReadonlyResolvedArea[],
  gradientBaseId: string,
): AreaGradientDef[] =>
  resolvedAreas.map((area: ReadonlyResolvedArea, areaIndex: number) => ({
    dataKey: area.dataKey,
    fill: area.fill,
    fillOpacity: area.fillOpacity,
    gradientToOpacity: area.gradientToOpacity,
    id: `${gradientBaseId}-area-grad-${areaIndex}`,
    spanPct: Math.min(1, Math.max(MIN_GRADIENT_SPAN_FRACTION, area.gradientSpan)) * PERCENT_MULTIPLIER,
  }));

const buildNativeAreaGradients = (gradientDefs: readonly Readonly<AreaGradientDef>[]): NativeAreaGradient[] =>
  gradientDefs.map((gradientDef: Readonly<AreaGradientDef>) => ({
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
  }));

const buildGradientIdMap = (gradientDefs: readonly Readonly<AreaGradientDef>[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const gradientDef of gradientDefs) {map.set(gradientDef.dataKey, gradientDef.id);}
  return map;
};

// Primitive narrowing predicates; typeof stays inside type guards (allowInTypeGuards).
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";
const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isBoolean = <Value,>(value: Value): value is Value & boolean => typeof value === "boolean";

// First non-empty entry wins; absent/empty entries fall through (bklit `||`-chain parity).
const firstNonEmptyString = (values: readonly (string | undefined)[]): string | undefined =>
  values.find((value) => (value?.length ?? 0) > 0);

/*
 * D3 scales answer null/NaN with their unknown value, still typed as number, so this widening is real.
 */
const withZeroFallback = (mapped: number | undefined): number => mapped ?? 0;

/*
 * JSON.stringify answers functions/symbols with undefined despite its string return type, so the widening is real.
 */
const withAbsentFallback = (text: string | undefined, absent: string): string => text ?? absent;

// Raw ChartDatum record field at the TanStack I/O boundary; call sites narrow
// It with the isNumber/isString guards instead of asserting a shape.
type RawDatumField = ChartDatum[string];

// Stringifies an untyped datum field without Object's default "[object Object]" dump.
const stringifyDatumField = (value: RawDatumField, absent: string): string => {
  if (isString(value)) {return value;}
  if (isNumber(value)) {return String(value);}
  if (value instanceof Date) {return String(value);}
  if (value === null || value === undefined) {return absent;}
  return withAbsentFallback(JSON.stringify(value), absent);
};

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

export {
  AREA_DIM_OPACITY,
  DEFAULT_TICK_COUNT,
  DEFAULT_TERMINAL_MARKER_RADIUS_PX,
  DEFAULT_TERMINAL_MARKER_STROKE_WIDTH_PX,
  DEFAULT_PROJECTION_STROKE_WIDTH_PX,
  PROJECTION_FALLBACK_STROKE,
  buildAreaGradientDefs,
  buildGradientIdMap,
  buildNativeAreaGradients,
  buildPatternAreaDefs,
  buildPatternIdMap,
  collectDatumTimes,
  computeTimeExtentRaw,
  firstNonEmptyString,
  isBoolean,
  isNumber,
  isSameBrushRange,
  isString,
  resolveEffectiveYDomainTweenDuration,
  resolveHeightPx,
  resolvePatternAreas,
  resolveResolvedAreas,
  stringifyDatumField,
  withAbsentFallback,
  withZeroFallback,
};
export type {
  AreaGradientDef,
  AreaPatternDef,
  NativeAreaGradient,
  NativeAreaGradientStop,
  PatternAreaSource,
  RawDatumField,
  ReadonlyAreaConfig,
  ReadonlyResolvedArea,
  ResolvedArea,
  ResolvedPatternArea,
  TimeExtentMs,
};
