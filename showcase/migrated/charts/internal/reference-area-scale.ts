import { useMemo } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleLinear } from "d3-scale";
import { applyReferenceAreaOverflow, computeReferenceAreaRect } from "./reference-area-geometry";
import type { ReferenceAreaIfOverflow, ReferenceAreaRect } from "./reference-area-geometry";
import type { ChartMargin } from "./use-chart-margin";
import { domainForAxis } from "./y-domain";
import { normalizeYAxisId } from "./y-axis-id";
import { useSanitizedId } from "./use-sanitized-id";

type XScaleMapper = (value: Date) => number;

interface BarScale {
  (value: string): number | undefined;
  readonly bandwidth: () => number;
  readonly domain: () => string[];
}

// Child configs are untyped, so an explicit null can reach this file.
// The props type only admits undefined; both spell absence.
const isYValuePresent = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

const isReferenceAreaVisiblePhase = (phase: string | undefined): boolean => {
  if (phase === undefined) {return true;}
  return phase === "ready" || phase === "revealing" || phase === "gridTweenReady";
}

const toBandKey = (value: Date | number | string | null | undefined): string | undefined => {
  if (value === null || value === undefined) {return undefined;}
  if (value instanceof Date) {return value.toISOString();}
  return String(value);
}

interface ResolveBarXOptions {
  readonly band: BarScale;
  readonly value: Date | number | string | null | undefined;
  readonly fallback: number;
}

const resolveBarXValue = (options: Readonly<ResolveBarXOptions>): number => {
  const { band, value, fallback } = options;
  const key = toBandKey(value);
  if (key === undefined) {return fallback;}
  const position = band(key);
  return position === undefined ? fallback : position + band.bandwidth() / 2;
}

const buildBarDateMapper = (band: BarScale): XScaleMapper => (date: Date): number =>
  resolveBarXValue({ band, fallback: 0, value: date });

interface InsetTimeMapperOptions {
  readonly t0: number;
  readonly t1: number;
  readonly innerWidth: number;
  readonly xRangePadding: number;
}

const buildInsetTimeMapper = (options: Readonly<InsetTimeMapperOptions>): XScaleMapper => {
  const { t0, t1, innerWidth, xRangePadding } = options;
  const insetLo = xRangePadding;
  const insetHi = innerWidth - xRangePadding;
  const insetScale = scaleUtc().domain([t0, t1]).range([insetLo, insetHi]);
  return (date: Date): number => insetScale(date);
}

interface TimeDomainMapperOptions {
  readonly t0: number;
  readonly t1: number;
  readonly innerWidth: number;
  readonly xRangePadding: number | undefined;
  readonly isCandlestickXScale: boolean | undefined;
}

const buildTimeDomainMapper = (options: Readonly<TimeDomainMapperOptions>): XScaleMapper => {
  const { t0, t1, innerWidth, xRangePadding, isCandlestickXScale } = options;
  if (xRangePadding !== undefined && xRangePadding > 0) {return buildInsetTimeMapper({ innerWidth, t0, t1, xRangePadding });}
  if (isCandlestickXScale === true) {
    const candleScale = scaleUtc().domain([t0, t1]).range([0, innerWidth]);
    return (date: Date): number => candleScale(date);
  }
  const timeScale = scaleUtc().domain([t0, t1]).range([0, innerWidth]);
  return (date: Date): number => timeScale(date);
}

interface BuildXScaleOptions {
  readonly isBarChart: boolean | undefined;
  readonly barScale: BarScale | null | undefined;
  readonly xDomain: readonly [number, number] | readonly [Date, Date] | undefined;
  readonly isTimeScale: boolean | undefined;
  readonly isCandlestickXScale: boolean | undefined;
  readonly innerWidth: number;
  readonly xRangePadding: number | undefined;
}

interface XDomainMapperOptions {
  readonly xDomain: readonly [number, number] | readonly [Date, Date];
  readonly isTimeScale: boolean | undefined;
  readonly isCandlestickXScale: boolean | undefined;
  readonly innerWidth: number;
  readonly xRangePadding: number | undefined;
}

const buildXDomainMapper = (options: Readonly<XDomainMapperOptions>): XScaleMapper => {
  const { xDomain, isTimeScale, isCandlestickXScale, innerWidth, xRangePadding } = options;
  const [d0, d1] = xDomain;
  const t0 = d0 instanceof Date ? d0.getTime() : d0;
  const t1 = d1 instanceof Date ? d1.getTime() : d1;
  if (isTimeScale === true || d0 instanceof Date) {return buildTimeDomainMapper({ innerWidth, isCandlestickXScale, t0, t1, xRangePadding });}
  const linearScale = scaleLinear().domain([t0, t1]).range([0, innerWidth]);
  return (date: Date): number => linearScale(date.getTime());
}

const buildXScaleMapper = (options: Readonly<BuildXScaleOptions>): XScaleMapper => {
  const { isBarChart, barScale, xDomain, isTimeScale, isCandlestickXScale, innerWidth, xRangePadding } = options;
  if (isBarChart === true && barScale !== null && barScale !== undefined) {return buildBarDateMapper(barScale);}
  if (xDomain !== undefined) {return buildXDomainMapper({ innerWidth, isCandlestickXScale, isTimeScale, xDomain, xRangePadding });}
  return (): number => 0;
}

interface BarBoundsOptions {
  readonly left: number;
  readonly right: number;
  readonly topPx: number;
  readonly bottomPx: number;
}

const buildBarBounds = (options: Readonly<BarBoundsOptions>): ReferenceAreaRect | undefined => {
  const { left, right, topPx, bottomPx } = options;
  const x = Math.min(left, right);
  const y = Math.min(topPx, bottomPx);
  const width = Math.abs(right - left);
  const height = Math.abs(bottomPx - topPx);
  if (width <= 0 || height <= 0) {return undefined;}
  return { height, width, x, y };
}

interface ClipBarAreaOptions {
  readonly left: number;
  readonly right: number;
  readonly topPx: number;
  readonly bottomPx: number;
  readonly ifOverflow: ReferenceAreaIfOverflow;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

const clipBarAreaRect = (options: Readonly<ClipBarAreaOptions>): ReferenceAreaRect | undefined => {
  const { left, right, topPx, bottomPx, ifOverflow, innerWidth, innerHeight } = options;
  const bounds = buildBarBounds({ bottomPx, left, right, topPx });
  if (bounds === undefined) {return undefined;}
  return applyReferenceAreaOverflow({ ifOverflow, innerHeight, innerWidth, rect: bounds }) ?? undefined;
}

const REFERENCE_AREA_ENTER_MS = 420;

interface ReferenceAreaVisibility {
  readonly visible: boolean;
  readonly prefersReducedMotion: boolean;
  readonly isLoaded: boolean | undefined;
}

const playReferenceAreaEnter = (group: SVGGElement, visible: boolean): void => {
  if (visible) {
    group.style.transition = `opacity ${REFERENCE_AREA_ENTER_MS}ms ease-out`;
    requestAnimationFrame(() => { group.style.opacity = "1"; });
    return;
  }
  group.style.opacity = "0";
}

const applyReferenceAreaVisibility = (group: SVGGElement, options: Readonly<ReferenceAreaVisibility>): void => {
  const { visible, prefersReducedMotion, isLoaded } = options;
  if (prefersReducedMotion) {
    group.style.opacity = visible ? "1" : "0";
    return;
  }
  if (isLoaded === false) {
    group.style.opacity = "0";
    return;
  }
  playReferenceAreaEnter(group, visible);
}

interface ReferenceAreaIds {
  readonly patternId: string;
  readonly hMaskId: string;
  readonly hGradientId: string;
}

const useReferenceAreaIds = (): ReferenceAreaIds => {
  const uid = useSanitizedId();
  return { hGradientId: `bkm-ref-fade-${uid}-grad`, hMaskId: `bkm-ref-fade-${uid}`, patternId: `bkm-ref-pattern-${uid}` };
}

interface ReferenceAreaGeometryOptions {
  readonly width: number;
  readonly height: number;
  readonly margin: ChartMargin;
  readonly yDomain: [number, number];
  readonly yDomainsByAxis?: Record<string, [number, number]>;
  readonly yAxisId?: string | number;
  readonly xDomain?: readonly [number, number] | [Date, Date];
  readonly isTimeScale?: boolean;
  readonly barScale?: BarScale | null;
  readonly isBarChart?: boolean;
  readonly xRangePadding?: number;
  readonly isCandlestickXScale?: boolean;
  readonly x1?: Date | number;
  readonly x2?: Date | number;
  readonly y1?: number;
  readonly y2?: number;
  readonly ifOverflow?: ReferenceAreaIfOverflow;
}

interface ReferenceAreaSpatial {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly margin: ChartMargin;
  readonly xScale: XScaleMapper;
  readonly yScale: ScaleLinear<number, number>;
  readonly rect: ReferenceAreaRect | undefined;
  readonly patternId: string;
  readonly hMaskId: string;
  readonly hGradientId: string;
}

const useReferenceAreaGeometry = (options: Readonly<ReferenceAreaGeometryOptions>): ReferenceAreaSpatial => {
  const { width, height, margin, yDomain, yDomainsByAxis, yAxisId, xDomain, isTimeScale, barScale, isBarChart, xRangePadding, isCandlestickXScale, x1, x2, y1, y2, ifOverflow } = options;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const ids = useReferenceAreaIds();
  const effectiveYDomain = useMemo<[number, number]>(
    // Areas place in their own yAxisId's scale, not the chart primary.
    () => (yDomainsByAxis ? domainForAxis(yDomainsByAxis, normalizeYAxisId(yAxisId)) : yDomain),
    [yDomainsByAxis, yAxisId, yDomain],
  );
  const yScale = useMemo(
    () => scaleLinear().domain(effectiveYDomain).range([innerHeight, 0]),
    [effectiveYDomain, innerHeight],
  );
  const xScale = useMemo<XScaleMapper>(
    () => buildXScaleMapper({ barScale, innerWidth, isBarChart, isCandlestickXScale, isTimeScale, xDomain, xRangePadding }),
    [xDomain, isTimeScale, isBarChart, barScale, isCandlestickXScale, innerWidth, xRangePadding],
  );
  const rect = useMemo<ReferenceAreaRect | undefined>(() => {
    if (innerWidth <= 0 || innerHeight <= 0) {return undefined;}
    if (isBarChart === true && barScale !== null && barScale !== undefined) {
      const band = barScale;
      const left = resolveBarXValue({ band, fallback: 0, value: x1 });
      const right = resolveBarXValue({ band, fallback: innerWidth, value: x2 });
      const topPx = isYValuePresent(y1) ? yScale(y1) : 0;
      const bottomPx = isYValuePresent(y2) ? yScale(y2) : innerHeight;
      return clipBarAreaRect({ bottomPx, ifOverflow: ifOverflow ?? "hidden", innerHeight, innerWidth, left, right, topPx });
    }
    return computeReferenceAreaRect({ ifOverflow, innerHeight, innerWidth, x1, x2, xScale, y1, y2, yScale }) ?? undefined;
  }, [innerWidth, innerHeight, x1, x2, y1, y2, ifOverflow, xScale, yScale, isBarChart, barScale]);
  return { hGradientId: ids.hGradientId, hMaskId: ids.hMaskId, innerHeight, innerWidth, margin, patternId: ids.patternId, rect, xScale, yScale };
}

export { applyReferenceAreaVisibility, buildXScaleMapper, clipBarAreaRect, isReferenceAreaVisiblePhase, isYValuePresent, resolveBarXValue, useReferenceAreaGeometry, useReferenceAreaIds };
export type { BarScale, ReferenceAreaGeometryOptions, ReferenceAreaSpatial, ReferenceAreaVisibility, XScaleMapper };
