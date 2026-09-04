"use client";
// Native-mark hover geometry; date-pill overlay is app-owned HTML (see ./date-pill).
import { crosshair } from "@tanstack/charts/crosshair";
import { dot } from "@tanstack/charts/dot";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type {
  ChartMark,
  ChartMarkState,
  ChartMarkStateSelector,
} from "@tanstack/charts";
import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { crosshairFadeStops } from "./fade-mask";
import { TOOLTIP_SPRING } from "./design-tokens";
import type { SpringConfig } from "./chart-config-context";
import type { ChartDatum, IndicatorWidth } from "./types";

// Default hover-dot size (passed as the dot mark's `r`) when no size is provided.
const DEFAULT_HOVER_DOT_SIZE = 5;

const isNumber = <Subject>(value: Subject): value is Subject & number => typeof value === "number";
const isString = <Subject>(value: Subject): value is Subject & string => typeof value === "string";


interface CrosshairGradientDef {
  id: string;
  color: string;
  stops: { offset: string; opacity: number }[];
}

// Bklit TooltipIndicator default vertical fade ("both", fadeLength=10).
const buildCrosshairGradientDef = (id: string, color: string): CrosshairGradientDef => (
  { color, id, stops: crosshairFadeStops() }
);

interface IndicatorMarkOptions {
  readonly gradientId: string;
  readonly width?: IndicatorWidth;
  readonly span?: number;
  readonly columnWidth?: number;
  readonly dasharray?: string;
  readonly color?: string;
  readonly discrete?: boolean;
// Precomputed gradient-vs-solid gate; defaults to `!dasharray`.
  readonly useGradient?: boolean;
  readonly strokeOpacity?: number;
  readonly spring?: Readonly<SpringConfig>;
}

// Native crosshair() x-only rule replacing the imperative indicator.
const buildIndicatorMark = (options: Readonly<IndicatorMarkOptions>): ChartMark<never, never, never> => {
  const strokeWidth = resolveIndicatorPixelWidth({
    columnWidth: options.columnWidth,
    span: options.span,
    width: options.width,
  });
  const useGradient = options.useGradient ?? (options.dasharray ?? "") === "";
  const spring = options.spring ?? TOOLTIP_SPRING;
  return crosshair({
    marker: false,
    motion: options.discrete === true
      ? false
      : { transition: { damping: spring.damping, stiffness: spring.stiffness, type: "spring" } },
    x: {
      label: false,
      stroke: useGradient ? `url(#${options.gradientId})` : (options.color ?? "var(--chart-crosshair)"),
      strokeDasharray: options.dasharray,
      strokeOpacity: options.strokeOpacity,
      strokeWidth,
    },
    y: false,
  });
}


interface HoverDotSeries {
  dataKey: string;
  color: string;
}

interface HoverDotOptions {
  size?: number;
  strokeWidth?: number;
  stroke?: string;
  discrete?: boolean;
}

interface BuildHoverDotMarkParams {
  readonly fill: string;
  readonly options?: Readonly<HoverDotOptions>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly series: Readonly<HoverDotSeries>;
  readonly xDataKey: string;
}

// WhenFocused(match:"x", retarget:true): one shared dot glides between x positions,
// Not a fresh crossfade per focus change.
const buildHoverDotMark = (params: Readonly<BuildHoverDotMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const { fill, renderData, series, xDataKey } = params;
  const dotOptions = params.options ?? {};
  const size = dotOptions.size ?? DEFAULT_HOVER_DOT_SIZE;
  const strokeWidth = dotOptions.strokeWidth ?? 2;
  const mark = dot(renderData, {
    fill,
    id: `${series.dataKey}__hoverdot`,
    motion: dotOptions.discrete === true
      ? false
      : { transition: { damping: TOOLTIP_SPRING.damping, stiffness: TOOLTIP_SPRING.stiffness, type: "spring" } },
    r: size,
    stroke: dotOptions.stroke ?? "var(--chart-background)",
    strokeWidth,
    x: (datum: Readonly<ChartDatum>) => {
      const raw: unknown = datum[xDataKey];
      return raw instanceof Date ? raw : undefined;
    },
    y: (datum: Readonly<ChartDatum>) => {
      const raw: unknown = datum[series.dataKey];
      return isNumber(raw) ? raw : undefined;
    },
  });
  return whenFocused(mark, { match: "x", retarget: true });
}

// Native fill is static: per-point-dynamic dot colors have no native route.
const resolveHoverDotFill = (seriesColor: string, dotColor: string | ((point: Readonly<ChartDatum>, line: { readonly dataKey: string; readonly stroke?: string }) => string) | undefined): string => {
  if (isString(dotColor)) {return dotColor;}
  return seriesColor;
}

// Dim transition lives in styles.css, not in states[].transition.

// "group" match dims every series uniformly while any point is pointer-focused.
const POINTER_HOVER_DIM_SELECTOR: ChartMarkStateSelector = {
  focus: "group",
  source: "pointer",
};

const pointerHoverDimState = <TDatum = unknown>(opacity: number): ChartMarkState<TDatum> => (
  { style: { opacity }, when: POINTER_HOVER_DIM_SELECTOR }
);

// No transition field; legend dim is computed per-mark from legendHoveredIndex.
const pointerSeriesDimStates = <TDatum = unknown>(opacity: number): ChartMarkState<TDatum>[] => [pointerHoverDimState<TDatum>(opacity)];


// No declarative "not x" selector exists, so this is a predicate function.
const pointerRowDimState = <TDatum = unknown>(opacity: number): ChartMarkState<TDatum> => (
  {
    style: { opacity },
    when: (ctx) => ctx.focus.source === "pointer" && !ctx.matches("x"),
  }
);


// Real shape check for x-domain probing.
// Focus callbacks hand us untyped datum values, so confirm object-ness before key lookup instead of asserting it.
const isStringKeyedRecord = <Subject>(value: Subject): value is Subject & ChartDatum =>
  typeof value === "object" && value !== null;

// Parses a datum's x cell into a Date; unparseable input yields undefined (caller treats it as in-domain).
const toDateOrUndefined = (datum: Readonly<ChartDatum>, xDataKey: string): Date | undefined => {
  const rawValue: unknown = isStringKeyedRecord(datum) ? datum[xDataKey] : undefined;
  if (rawValue instanceof Date) {return rawValue;}
  if (isString(rawValue) || isNumber(rawValue)) {return new Date(rawValue);}
  return undefined;
};

// True when datum's x falls outside the inclusive xDomain.
const isFocusOutsideXDomain = (datum: Readonly<ChartDatum>, xDataKey: string, xDomain: readonly [Date, Date] | undefined): boolean => {
  if (!xDomain) {return false;}
  const resolvedDate = toDateOrUndefined(datum, xDataKey);
  if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) {return false;}
  const timeMs = resolvedDate.getTime();
  const domainStart = xDomain[0].getTime();
  const domainEnd = xDomain[1].getTime();
  return timeMs < Math.min(domainStart, domainEnd) || timeMs > Math.max(domainStart, domainEnd);
}


export {
  buildCrosshairGradientDef,
  buildHoverDotMark,
  buildIndicatorMark,
  isFocusOutsideXDomain,
  POINTER_HOVER_DIM_SELECTOR,
  pointerHoverDimState,
  pointerRowDimState,
  pointerSeriesDimStates,
  resolveHoverDotFill,
};

export { useDatePillOverlay } from "./date-pill-overlay";
export type { DatePillController } from "./date-pill-overlay";

export type {
  CrosshairGradientDef,
  HoverDotOptions,
  HoverDotSeries,
  IndicatorMarkOptions,
};
