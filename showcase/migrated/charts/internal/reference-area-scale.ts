import { useMemo } from "react";
import { applyReferenceAreaOverflow, computeReferenceAreaRect } from "./reference-area-geometry";
import type { ReferenceAreaIfOverflow, ReferenceAreaRect } from "./reference-area-geometry";
import { domainForAxis } from "./y-domain";
import { normalizeYAxisId } from "./y-axis-id";
import { useSanitizedId } from "./use-sanitized-id";
import { useChartStable } from "./chart-context";
import type { ResolvedBandBinding } from "./chart-host-store";

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

// Band-scale lookup key: child configs are untyped, so an explicit null can reach this file.
type BandKeyValue = Date | number | string | null | undefined;

const toBandKey = (value: BandKeyValue): string | undefined => {
  if (value === null || value === undefined) {return undefined;}
  if (value instanceof Date) {return value.toISOString();}
  return String(value);
}

interface ResolveBarXOptions {
  readonly band: BarScale;
  readonly value: BandKeyValue;
  readonly fallback: number;
}

const resolveBarXValue = (options: Readonly<ResolveBarXOptions>): number => {
  const { band, value, fallback } = options;
  const key = toBandKey(value);
  if (key === undefined) {return fallback;}
  const position = band(key);
  return position === undefined ? fallback : position + band.bandwidth() / 2;
}

const buildBarDateMapper = (band: ResolvedBandBinding): XScaleMapper => (date: Date): number =>
  resolveBarXValue({ band, fallback: 0, value: date });

// Host scale supplies the x range; the area only supplies its domain.

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
  readonly yDomain: [number, number];
  readonly yDomainsByAxis?: Record<string, [number, number]>;
  readonly yAxisId?: string | number;
  readonly xDomain?: readonly [number, number] | [Date, Date];
  readonly isBarChart?: boolean;
  readonly x1?: Date | number;
  readonly x2?: Date | number;
  readonly y1?: number;
  readonly y2?: number;
  readonly ifOverflow?: ReferenceAreaIfOverflow;
}

interface ReferenceAreaSpatial {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly margin: { readonly bottom: number; readonly left: number; readonly right: number; readonly top: number };
  readonly xScale: XScaleMapper;
  readonly yScale: (value: number) => number;
  readonly rect: ReferenceAreaRect | undefined;
  readonly patternId: string;
  readonly hMaskId: string;
  readonly hGradientId: string;
}

const useReferenceAreaGeometry = (options: Readonly<ReferenceAreaGeometryOptions>): ReferenceAreaSpatial => {
  const { yDomain, yDomainsByAxis, yAxisId, xDomain, isBarChart, x1, x2, y1, y2, ifOverflow } = options;
  // Plot bounds come from the host scene, never from margin props (V1.2/G6).
  const { chart, margin, xBand, xScale: hostXScale, yScale: hostYScale } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const innerWidth = plot.width;
  const innerHeight = plot.height;
  const ids = useReferenceAreaIds();
  const effectiveYDomain = useMemo<[number, number]>(
    // Areas place in their own yAxisId's scale, not the chart primary.
    () => (yDomainsByAxis ? domainForAxis(yDomainsByAxis, normalizeYAxisId(yAxisId)) : yDomain),
    [yDomainsByAxis, yAxisId, yDomain],
  );
  // Package scales map to full-container pixels; the figure svg sits at the plot origin, so mappings shift to plot-local here.
  const yScale = ((hostCopy) => (value: number): number => hostCopy(value) - plot.y)(
    hostYScale.copy().domain(effectiveYDomain),
  );
  const xScale: XScaleMapper = (() => {
    if (isBarChart === true && xBand !== undefined) {
      return (date: Date): number => buildBarDateMapper(xBand)(date) - plot.x;
    }
    if (xDomain === undefined) {return (): number => 0;}
    const [d0, d1] = xDomain;
    const t0 = d0 instanceof Date ? d0.getTime() : d0;
    const t1 = d1 instanceof Date ? d1.getTime() : d1;
    const ranged = hostXScale.copy().domain([t0, t1]);
    return (date: Date): number => ranged(date) - plot.x;
  })();
  const rect = useMemo<ReferenceAreaRect | undefined>(() => {
    if (innerWidth <= 0 || innerHeight <= 0) {return undefined;}
    if (isBarChart === true) {
      if (xBand === undefined) {return undefined;}
      const leftRaw = resolveBarXValue({ band: xBand, fallback: Number.NaN, value: x1 });
      const rightRaw = resolveBarXValue({ band: xBand, fallback: Number.NaN, value: x2 });
      const left = Number.isFinite(leftRaw) ? leftRaw - plot.x : 0;
      const right = Number.isFinite(rightRaw) ? rightRaw - plot.x : innerWidth;
      const topPx = isYValuePresent(y1) ? yScale(y1) : 0;
      const bottomPx = isYValuePresent(y2) ? yScale(y2) : innerHeight;
      return clipBarAreaRect({ bottomPx, ifOverflow: ifOverflow ?? "hidden", innerHeight, innerWidth, left, right, topPx });
    }
    return computeReferenceAreaRect({ ifOverflow, innerHeight, innerWidth, x1, x2, xScale, y1, y2, yScale }) ?? undefined;
  }, [innerWidth, innerHeight, x1, x2, y1, y2, ifOverflow, xScale, yScale, isBarChart, xBand, plot.x]);
  return { hGradientId: ids.hGradientId, hMaskId: ids.hMaskId, innerHeight, innerWidth, margin, patternId: ids.patternId, rect, xScale, yScale };
}

export { applyReferenceAreaVisibility, clipBarAreaRect, isReferenceAreaVisiblePhase, isYValuePresent, resolveBarXValue, useReferenceAreaGeometry, useReferenceAreaIds };
export type { BarScale, ReferenceAreaGeometryOptions, ReferenceAreaSpatial, ReferenceAreaVisibility, XScaleMapper };
