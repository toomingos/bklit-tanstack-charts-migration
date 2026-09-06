// Package focus chrome: crosshair/hover-dot builders, pointer dim states, x-domain probe.
import { crosshair } from "@tanstack/charts/crosshair";
import { dot } from "@tanstack/charts/dot";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type { ChartMark, ChartMarkState, ChartValue } from "@tanstack/charts";
import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { crosshairFadeStops } from "./fade-mask";
import { TOOLTIP_SPRING } from "./design-tokens";
import { DEFAULT_CHART_MARGIN } from "./use-chart-margin";
import { shortDateFmt } from "./formatters";
import type { SpringConfig } from "./chart-config-context";
import type { ChartDatum, IndicatorWidth } from "./types";
// Default hover-dot size (passed as the dot mark's `r`) when no size is provided.
const DEFAULT_HOVER_DOT_SIZE = 5;
// Default hover-dot ring width (passed as the dot mark's `strokeWidth`) when none is provided.
const DEFAULT_HOVER_DOT_STROKE_WIDTH = 2;
const isNumber = <Subject>(value: Subject): value is Subject & number => typeof value === "number";
const isString = <Subject>(value: Subject): value is Subject & string => typeof value === "string";
interface CrosshairGradientDef {
  readonly id: string;
  readonly color: string;
  readonly stops: readonly { offset: string; opacity: number }[];
}
// Bklit TooltipIndicator default vertical fade ("both", fadeLength=10).
const buildCrosshairGradientDef = (id: string, color: string): CrosshairGradientDef => (
  { color, id, stops: crosshairFadeStops() }
);
// Legacy pill text stays on the package crosshair x label: formatted dates, raw values otherwise.
// The pill itself is the package label halo (stroke under the text), not an HTML overlay.
const formatShortDateLabel = (value: ChartValue): string =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? shortDateFmt.format(value) : String(value);
// Date pill halo: 14px medium text over a strokeWidth-20 round halo (~30px pill).
// Offset centres the pill ~20px above the container bottom (margin 40 → 14).
const DATE_PILL_FONT_SIZE = 14;
const DATE_PILL_FONT_WEIGHT = 500;
const DATE_PILL_HALO_WIDTH = 20;
const DATE_PILL_BOTTOM_CLEARANCE = 26;
interface IndicatorMarkOptions {
  readonly gradientId: string;
  readonly width?: IndicatorWidth;
  readonly span?: number;
  readonly columnWidth?: number;
  readonly dasharray?: string;
  readonly color?: string;
  readonly discrete?: boolean;
  readonly useGradient?: boolean;
  readonly strokeOpacity?: number;
  readonly spring?: Readonly<SpringConfig>;
  readonly band?: boolean;
  readonly xLabelFormat?: (value: ChartValue) => string;
  readonly marginBottom?: number;
}
// Native crosshair() x-only rule replacing the imperative indicator; band form replaces the rule.
// The date pill is the package x label halo, positioned by the bottom margin.
const buildIndicatorMark = (options: Readonly<IndicatorMarkOptions>): ChartMark<never, never, never> => {
  const useGradient = options.useGradient ?? (options.dasharray ?? "") === "";
  const spring = options.spring ?? TOOLTIP_SPRING;
  const motion = options.discrete === true
    ? false
    : { transition: { damping: spring.damping, stiffness: spring.stiffness, type: "spring" as const } };
  const marginBottom = options.marginBottom ?? DEFAULT_CHART_MARGIN.bottom;
  const label = options.xLabelFormat === undefined ? false : {
    fill: "var(--chart-date-pill-foreground)",
    fontSize: DATE_PILL_FONT_SIZE,
    fontWeight: DATE_PILL_FONT_WEIGHT,
    format: options.xLabelFormat,
    offset: Math.max(0, marginBottom - DATE_PILL_BOTTOM_CLEARANCE),
    stroke: "var(--chart-date-pill-background)",
    strokeOpacity: 1,
    strokeWidth: DATE_PILL_HALO_WIDTH,
  };
  const strokeWidth = resolveIndicatorPixelWidth({
    columnWidth: options.columnWidth,
    span: options.span,
    width: options.width,
  });
  const x = options.band === true
    ? { band: true as const, label }
    : {
      label,
      stroke: useGradient ? `url(#${options.gradientId})` : (options.color ?? "var(--chart-crosshair)"),
      strokeDasharray: options.dasharray,
      strokeOpacity: options.strokeOpacity,
      strokeWidth,
    };
  return crosshair({ marker: false, motion, x, y: false });
};
interface BuildHoverDotMarkParams {
  readonly fill: string;
  readonly options?: Readonly<{ readonly size?: number; strokeWidth?: number; stroke?: string; readonly discrete?: boolean }>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly series: Readonly<{ readonly dataKey: string; readonly color: string }>;
  readonly xDataKey: string;
}
// WhenFocused(match:"x", retarget:true): one shared dot glides between x positions.
const buildHoverDotMark = (params: Readonly<BuildHoverDotMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const { fill, renderData, series, xDataKey } = params;
  const dotOptions = params.options ?? {};
  const mark = dot(renderData, {
    fill,
    id: `${series.dataKey}__hoverdot`,
    motion: dotOptions.discrete === true
      ? false
      : { transition: { damping: TOOLTIP_SPRING.damping, stiffness: TOOLTIP_SPRING.stiffness, type: "spring" } },
    r: dotOptions.size ?? DEFAULT_HOVER_DOT_SIZE,
    stroke: dotOptions.stroke ?? "var(--chart-background)",
    strokeWidth: dotOptions.strokeWidth ?? DEFAULT_HOVER_DOT_STROKE_WIDTH,
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
};
// Native fill is static: per-point-dynamic dot colors have no native route.
const resolveHoverDotFill = (seriesColor: string, dotColor: string | ((point: Readonly<ChartDatum>, line: { readonly dataKey: string; readonly stroke?: string }) => string) | undefined): string => {
  if (isString(dotColor)) {return dotColor;}
  return seriesColor;
};
// "Group" match dims every series uniformly while any point is pointer-focused.
// Time term rides the state (V3.5): the 0.4s line-path CSS rule is V3.6's to delete.
const pointerSeriesDimStates = <TDatum = unknown>(opacity: number): ChartMarkState<TDatum>[] => (
  [{ style: { opacity }, transition: { duration: 400, easing: "ease-in-out", type: "tween" }, when: { focus: "group", source: "pointer" } }]
);
// No declarative "not x" selector exists, so this is a predicate function.
// Time term rides the state (V3.5): the 0.12s composed-bar CSS rule is V3.6's to delete.
const pointerRowDimState = <TDatum = unknown>(opacity: number): ChartMarkState<TDatum> => (
  { style: { opacity }, transition: { duration: 120, easing: "ease-in-out", type: "tween" }, when: (ctx) => ctx.focus.source === "pointer" && !ctx.matches("x") }
);
// Focus callbacks hand us untyped datum values, so confirm record shape before key lookup.
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
};
export {
  buildCrosshairGradientDef,
  buildHoverDotMark,
  buildIndicatorMark,
  formatShortDateLabel,
  isFocusOutsideXDomain,
  pointerRowDimState,
  pointerSeriesDimStates,
  resolveHoverDotFill,
};
export type { CrosshairGradientDef };
