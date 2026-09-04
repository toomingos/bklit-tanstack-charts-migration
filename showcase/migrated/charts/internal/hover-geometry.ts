"use client";
// Native-mark hover geometry; date-pill overlay is app-owned HTML (see ./date-pill).
import { crosshair } from "@tanstack/charts/crosshair";
import { createMark } from "@tanstack/charts";
import { dot } from "@tanstack/charts/dot";
import { lineY } from "@tanstack/charts/line";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type {
  ChartCurve,
  ChartMark,
  ChartMarkState,
  ChartMarkStateSelector,
  ChartValue,
  SceneNode,
} from "@tanstack/charts";
import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { crosshairFadeStops } from "./fade-mask";
import { HIGHLIGHT_SPRING, TOOLTIP_SPRING } from "./design-tokens";
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

// WhenFocused(match:"x", retarget:true): one shared dot glides between x positions,
// Not a fresh crossfade per focus change.
const buildHoverDotMark = (renderData: readonly Readonly<ChartDatum>[], xDataKey: string, series: Readonly<HoverDotSeries>, fill: string, options: Readonly<HoverDotOptions> = {}): ChartMark<ChartDatum, Date, number> => {
  const size = options.size ?? DEFAULT_HOVER_DOT_SIZE;
  const strokeWidth = options.strokeWidth ?? 2;
  const mark = dot(renderData, {
    fill,
    id: `${series.dataKey}__hoverdot`,
    motion: options.discrete === true
      ? false
      : { transition: { damping: TOOLTIP_SPRING.damping, stiffness: TOOLTIP_SPRING.stiffness, type: "spring" } },
    r: size,
    stroke: options.stroke ?? "var(--chart-background)",
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


interface HighlightBandSeries {
  readonly dataKey: string;
  readonly color: string;
  readonly strokeWidth: number;
  readonly showHighlight: boolean;
// Area only: band needs showHighlight && showLine; dim needs showHighlight alone.
  readonly showLine?: boolean;
  readonly curve?: ChartCurve;
}

// Display-only recursion: strips interaction so the re-sliced band can't re-resolve focus
// And feed back into setHoveredIndex (infinite update loop).
const stripInteraction = (node: SceneNode): SceneNode => {
  if (node.kind === "group") {
    return { ...node, children: node.children.map(stripInteraction) };
  }
  if ("interaction" in node && node.interaction) {
    const { interaction: _interaction, ...rest } = node;
    return _interaction ? rest : node;
  }
  return node;
};

// Display-only wrapper: strips interaction so the re-sliced band can't re-resolve focus
// And feed back into setHoveredIndex (infinite update loop).
const withoutInteraction = <TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(mark: ChartMark<TDatum, TXValue, TYValue>): ChartMark<TDatum, TXValue, TYValue> => createMark((ctx) => {
  const inner = mark.initialize(ctx);
  return {
    ...inner,
    render: (renderCtx) => {
      const scene = inner.render(renderCtx);
      return { ...scene, nodes: scene.nodes.map(stripInteraction) };
    },
  };
}, mark.motion, mark.renderer);

interface HighlightLineMarkArgs {
  readonly slice: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly hoverSeries: Readonly<HighlightBandSeries>;
  readonly discrete: boolean | undefined;
}

// One re-sliced highlight line; hoisted so buildHighlightBandMarks stays short.
const buildHighlightLineMark = (markArgs: Readonly<HighlightLineMarkArgs>): ChartMark<ChartDatum, Date, number> =>
  withoutInteraction(
    lineY(markArgs.slice, {
      curve: markArgs.hoverSeries.curve,
      id: `${markArgs.hoverSeries.dataKey}__highlight`,
      motion: markArgs.discrete === true
        ? false
        : {
            path: "morph",
            transition: { damping: HIGHLIGHT_SPRING.damping, stiffness: HIGHLIGHT_SPRING.stiffness, type: "spring" },
          },
      stroke: markArgs.hoverSeries.color,
      strokeWidth: markArgs.hoverSeries.strokeWidth,
      x: (datum: Readonly<ChartDatum>) => {
        const raw: unknown = datum[markArgs.xDataKey];
        return raw instanceof Date ? raw : undefined;
      },
      y: (datum: Readonly<ChartDatum>) => {
        const raw: unknown = datum[markArgs.hoverSeries.dataKey];
        return isNumber(raw) ? raw : undefined;
      },
    }),
  );

// 2-3-point hover window; undefined when there is nothing to highlight.
const sliceHighlightWindow = (renderData: readonly Readonly<ChartDatum>[], hoveredIndex: number | null): readonly Readonly<ChartDatum>[] | undefined => {
  if (hoveredIndex === null || renderData.length === 0) {return undefined;}
  const lo = Math.max(0, hoveredIndex - 1);
  const hi = Math.min(renderData.length - 1, hoveredIndex + 1);
  if (hi < lo) {return undefined;}
  const slice = renderData.slice(lo, hi + 1);
  if (slice.length === 0) {return undefined;}
  return slice;
};

// 2-3-point slice at full brightness; path morph approximates the old clip sweep,
// Exact for adjacent-index moves only.
const buildHighlightBandMarks = (renderData: readonly Readonly<ChartDatum>[], xDataKey: string, hoveredIndex: number | null, series: readonly Readonly<HighlightBandSeries>[], options: { readonly discrete?: boolean } = {}): ChartMark<ChartDatum, Date, number>[] => {
  const slice = sliceHighlightWindow(renderData, hoveredIndex);
  if (slice === undefined) {return [];}
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const hoverSeries of series) {
    if (hoverSeries.showHighlight && hoverSeries.showLine !== false) {
      marks.push(buildHighlightLineMark({ discrete: options.discrete, hoverSeries, slice, xDataKey }));
    }
  }
  return marks;
}


// Real shape check for x-domain probing.
// Focus callbacks hand us untyped datum values, so confirm object-ness before key lookup instead of asserting it.
const isStringKeyedRecord = <Subject>(value: Subject): value is Subject & ChartDatum =>
  typeof value === "object" && value !== null;

const toDateOrUndefined = (value: unknown): Date | undefined => {
  if (value instanceof Date) {return value;}
  if (isString(value) || isNumber(value)) {return new Date(value);}
  return undefined;
};

// True when datum's x falls outside the inclusive xDomain.
const isFocusOutsideXDomain = (datum: Readonly<ChartDatum>, xDataKey: string, xDomain: readonly [Date, Date] | undefined): boolean => {
  if (!xDomain) {return false;}
  const rawValue: unknown = isStringKeyedRecord(datum) ? datum[xDataKey] : undefined;
  const resolvedDate = toDateOrUndefined(rawValue);
  if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) {return false;}
  const timeMs = resolvedDate.getTime();
  const domainStart = xDomain[0].getTime();
  const domainEnd = xDomain[1].getTime();
  return timeMs < Math.min(domainStart, domainEnd) || timeMs > Math.max(domainStart, domainEnd);
}


export {
  buildCrosshairGradientDef,
  buildHighlightBandMarks,
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
  HighlightBandSeries,
  HoverDotOptions,
  HoverDotSeries,
  IndicatorMarkOptions,
};
