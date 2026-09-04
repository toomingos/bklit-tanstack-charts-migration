// Bklit CandlestickChart on TanStack Charts. Custom wick/body marks over raw data; no status prop.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, Dispatch, ReactElement, ReactNode, RefObject, SetStateAction } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { createMark } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type { ChartMark, ChartMarkState, ChartMotionContext, ChartMotionDefinition, ChartMotionTiming, ChartMotionTransition, ChartPoint, ChartRendererRenderContext, ChartScale, DomChartDefinition, MarkRenderContext, MarkScene, ResolvedScale, SceneNode } from "@tanstack/charts";
import { extractChildren } from "./internal/children-extract";
import { TooltipContent } from "./internal/tooltip-components";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, TOOLTIP_BOX_SPRING } from "./internal/design-tokens";
import { buildPill } from './internal/date-pill';
import type { PillBuild } from './internal/date-pill';
import { buildXAxisTickValues, formatYAxisTick, buildFadeXAxisOptions } from "./internal/axis-ticks";
import { resolveVerticalFadeSides, indicatorFadeGradientStops } from "./internal/fade-mask";
import type { IndicatorFadeGradientStop } from "./internal/fade-mask";
import { toDotConfig, toIndicatorConfig } from './internal/tooltip-mappers';
import type { DotConfig, TooltipMapperSource } from './internal/tooltip-mappers';
import { findSpringStiffnessDamping } from "./internal/candle-spring";
import { resolveMotionEasing } from "./internal/reveal-easing";
import { useChartRenderer } from "./internal/motion-renderer";
import { resolveEnterTransition, TWEEN_FALLBACK } from './internal/enter-transition';
import type { CandlestickEnterTransition } from './internal/enter-transition';
import { resolveGridGuide } from "./internal/grid";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import {
  ChartSelectionContext,
  extractSegmentComponents,
  useChartSelection,
} from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import { useChartConfig } from "./internal/use-chart-config";
import type { SpringConfig } from "./internal/chart-config-context";
import { renderPatternPreset } from "./internal/pattern-preset-render";
import type { PatternPresetId } from "./internal/pattern-preset";
import { resolveYAxisTickCount } from "./internal/y-axis-ticks";
import type { ChartDatum, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { createCandlestickFocusStrategy } from "./internal/candlestick-focus-strategy";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import { useContainerWidth } from "./internal/use-container-size";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import { useFocusInjection } from "./internal/focus-injection";
import { buildIndicatorMark } from "./internal/hover-geometry";
import { buildNativeTooltipExtension } from "./internal/native-tooltip";
import type { NativeTooltipExtension } from "./internal/native-tooltip";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { DEFAULT_ANIMATION_DURATION_MS } from "./internal/animation-defaults";
import "./styles.css";

const SOLID_POSITIVE = "var(--color-emerald-500)";
const SOLID_NEGATIVE = "var(--color-red-500)";
const WICK_WIDTH_PX = 1.5;
// Default enter is a spring: duration 0.8s, bounce 0.15 (bklit).
const DEFAULT_ENTER_DURATION_SEC = 0.8;
const DEFAULT_ENTER_BOUNCE = 0.15;
// Plain-dot hover mark defaults (only ring reads dotSize/scale/strokeWidth).
const DEFAULT_HOVER_DOT_SIZE = 5;
const DEFAULT_HOVER_DOT_STROKE_WIDTH = 1.5;
// Bklit parity defaults: faded opacity, y-domain pad fraction, tick counts, fade length.
const DEFAULT_FADED_OPACITY = 0.3;
const Y_DOMAIN_PAD_FRACTION = 0.05;
const DEFAULT_TICK_COUNT = 5;
const DEFAULT_INDICATOR_FADE_LENGTH = 10;
// Reveal settle grace after the longest of enter/animation durations.
const REVEAL_SETTLE_GRACE_MS = 300;
const MS_PER_SECOND = 1000;
// Opacity fade dropped: collapsed geometry already hides pre-reveal candles; one timing track only.
const PATTERN_FALLBACK_POSITIVE = SOLID_POSITIVE;
const PATTERN_FALLBACK_NEGATIVE = SOLID_NEGATIVE;
// Mark id for the hover-highlight mark (mirrors wick/body geometry, snaps instead of springing).
const HOVER_HIGHLIGHT_MARK_ID = "hover-highlight";
// Shared class for every candle rect node (wicks and bodies read it for styling hooks).
const CANDLE_CELL_CLASS_NAME = "chart-candle-cell";
// Known pattern presets; anything else renders only when it is a legacy url(#id) string.
const CANDLE_PATTERN_PRESETS: ReadonlySet<string> = new Set(["diagonal", "horizontal", "vertical", "cross", "dots", "circles", "accent"]);
// Zero-size defs layers sit outside layout; the style never varies.
const HIDDEN_DEFS_SVG_STYLE = { position: "absolute" } as const;
// Pill host covers the plot without intercepting pointer events.
const PILL_OVERLAY_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;
// Shared numeric spellings for the geometry and timing below (no bare literals).
const GEOMETRY_HALF_DIVISOR = 2;
const FLAT_EXTENT_FALLBACK_PX = 1;
const COLLAPSED_GEOMETRY_PX = 0;
const MIN_GEOMETRY_EXTENT_PX = 0;
const NO_ANIMATION_DURATION_MS = 0;
const NO_INSIDE_STROKE_PX = 0;
const EMPTY_CONTAINER_PX = 0;
const EMPTY_COUNT = 0;
const EMPTY_TIME_BOUND_MS = 0;
const MIN_ROW_COUNT = 1;
const MIN_ENTER_DURATION_MS = 1;
const FULL_SLOT_RATIO = 1;
const LEGEND_POSITIVE_INDEX = 0;
const LEGEND_NEGATIVE_INDEX = 1;
const FIRST_POINT_INDEX = 0;
const ROW_INDEX_STEP = 1;
const PLAIN_HOVER_DOT_STROKE_WIDTH = 2;
const DEFAULT_DOT_SCALE = 1;
const DEFAULT_CANDLE_GAP_RATIO = 0.2;
const INITIAL_REVEAL_EPOCH = 0;
const REVEAL_FLIP_DELAY_MS = 0;
const FALLBACK_Y_DOMAIN_MIN = 0;
const FALLBACK_Y_DOMAIN_MAX = 1;

// Both segment ends must be finite before they are mapped through the scales.
const areBothFinite = (first: number, second: number): boolean => Number.isFinite(first) && Number.isFinite(second);

// Primitive narrowing lives in these predicates (anti-slop allowInTypeGuards);
// Call sites branch on the domain value instead of repeating `typeof`.
const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";
const isFiniteNumber = <Value,>(value: Value): value is Value & number => isNumber(value) && Number.isFinite(value);

// DotConfig color is string | fn | undefined; this names the fn branch for narrowing.
type CandleDotColorFn = Exclude<DotConfig["color"], string | undefined>;
const isCandleDotColorFn = <Value,>(value: Value): value is Value & CandleDotColorFn => typeof value === "function";

// Pattern overlay reference shared by the wicks/bodies/highlight marks and the resolver.
interface CandlePatternRef {
  readonly href: string;
  readonly preset: PatternPresetId | undefined;
}

// Tween enter reads the resolved timing, falling back to the shared tween default.
const resolveTweenCandleTransition = (enter: Readonly<CandlestickEnterTransition> | undefined): ChartMotionTransition => {
  const resolved = resolveEnterTransition(enter, TWEEN_FALLBACK);
  const tweenFallback = TWEEN_FALLBACK.kind === "tween" ? TWEEN_FALLBACK : undefined;
  const durationMs = resolved.kind === "tween" ? resolved.durationMs : tweenFallback?.durationMs ?? NO_ANIMATION_DURATION_MS;
  const easingCss = resolved.kind === "tween" ? resolved.easingCss : tweenFallback?.easingCss ?? "";
  return { duration: durationMs, easing: resolveMotionEasing(easingCss), type: "tween" };
};

// Spring enter converts duration/bounce into stiffness/damping (bklit motion-utils formula).
const resolveSpringCandleTransition = (enter: Readonly<CandlestickEnterTransition> | undefined): ChartMotionTransition => {
  const enterDurationMs = Math.max(MIN_ENTER_DURATION_MS, (enter?.duration ?? DEFAULT_ENTER_DURATION_SEC) * MS_PER_SECOND);
  const enterBounce = enter?.bounce ?? DEFAULT_ENTER_BOUNCE;
  const { damping, stiffness } = findSpringStiffnessDamping({ bounce: enterBounce, durationMs: enterDurationMs });
  return { damping, stiffness, type: "spring" };
};

interface CandleWickSegmentNodesParams {
  readonly collapseY: number;
  readonly cx: number;
  readonly dimOpacity: number | undefined;
  readonly segKey: string;
  readonly segTargetHeight: number;
  readonly segTargetY: number;
  readonly showTarget: boolean;
  readonly wickFill: string;
}

// Wick segments split at the body edge so stacked dim opacities never double-composite on overlap.
const buildWickSegmentNodes = (params: Readonly<CandleWickSegmentNodesParams>): SceneNode[] => {
  const { collapseY, cx, dimOpacity, segKey, segTargetHeight, segTargetY, showTarget, wickFill } = params;
  if (segTargetHeight <= MIN_GEOMETRY_EXTENT_PX) {return [];}
  const collapsedY = Math.min(Math.max(collapseY, segTargetY), segTargetY + segTargetHeight);
  return [{
    className: CANDLE_CELL_CLASS_NAME,
    height: showTarget ? segTargetHeight : COLLAPSED_GEOMETRY_PX,
    key: segKey,
    kind: "rect",
    style: { fill: wickFill, opacity: dimOpacity },
    width: WICK_WIDTH_PX,
    x: cx - WICK_WIDTH_PX / GEOMETRY_HALF_DIVISOR,
    y: showTarget ? segTargetY : collapsedY,
  }];
};

// Grid fallback stays so builds against engines omitting tickCount keep the legacy default.
// Nullable params keep the coalescing guards genuinely conditional.
const coalesceTickCount = (primary: number | undefined, secondary: number | undefined): number =>
  primary ?? secondary ?? DEFAULT_TICK_COUNT;

// Per-candle dim transitions at 150ms ease-in-out (legacy).
const CANDLE_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  duration: 150,
  easing: "ease-in-out",
  type: "tween",
};

/**
 * Pointer hover dims all candles uniformly; the hovered one redraws on top via a highlight mark.
 *
 * @param {number} fadedOpacity - Opacity applied to non-hovered candles while a pointer focus is active.
 * @param {boolean} showHoverFade - Whether the dim state should be registered at all.
 * @returns {ChartMarkState<ChartDatum>[]} The dim-state list to attach to a candle mark (empty when hover-fade is disabled).
 */
const candlestickDimStates = (fadedOpacity: number, showHoverFade: boolean): ChartMarkState<ChartDatum>[] => {
  const states: ChartMarkState<ChartDatum>[] = [];
  if (showHoverFade) {
    states.push({
      style: { opacity: fadedOpacity },
      transition: CANDLE_DIM_TRANSITION,
      when: (context) => context.focus.source === "pointer",
    });
  }
  return states;
};

interface CandlestickChromeState {
  tooltip: ChartTooltipConfig | undefined;
  readonly dateLabels: string[];
}

// Legacy pattern names are an open string at the prop boundary; only known presets render.
const isCandlePatternPreset = (value: string): value is PatternPresetId =>
  CANDLE_PATTERN_PRESETS.has(value);

// DotColor precedence (incl. function branch) evaluates once at mark-build time, not per hover.
const resolveCandleDotColor = (color: DotConfig["color"], date: Readonly<Date>, close: number): string => {
  if (color !== undefined && color !== "") {
    if (isCandleDotColorFn(color)) {
      return color({ close, date }, { dataKey: "close" });
    }
    return color;
  }
  return "var(--chart-line-primary)";
}

interface CandleMarkScene {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, Date, number>[];
}

interface CandleHoverDotSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly (Date | undefined)[];
  readonly closeValues: readonly (number | undefined)[];
  readonly dotCfg: Readonly<DotConfig>;
  readonly size: number;
  readonly strokeWidth: number;
  readonly isRing: boolean;
}

interface CandleHoverDotEntryParams {
  readonly close: number | undefined;
  readonly date: Date | undefined;
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly dotCfg: Readonly<DotConfig>;
  readonly isRing: boolean;
  readonly scales: MarkRenderContext["scales"];
  readonly size: number;
  readonly strokeWidth: number;
}

interface CandleHoverDotEntry {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

/**
 * Builds the hover-dot entry for one candle row; invalid rows build nothing.
 *
 * @param {Readonly<CandleHoverDotEntryParams>} params - Resolved scales, row values, and dot styling inputs.
 * @returns {CandleHoverDotEntry | undefined} Node plus point, or undefined when the row is invalid.
 */
const buildCandleHoverDotEntry = (params: Readonly<CandleHoverDotEntryParams>): CandleHoverDotEntry | undefined => {
  const { close, date, datum, datumIndex, dotCfg, isRing, scales, size, strokeWidth } = params;
  const pixelX = date === undefined ? Number.NaN : scales.x.map(date);
  const pixelY = close === undefined ? Number.NaN : scales.y.map(close);
  if (!Number.isFinite(pixelX) || !Number.isFinite(pixelY) || date === undefined || close === undefined) {return undefined;}
  const fill = resolveCandleDotColor(dotCfg.color, date, close);
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fill,
    datum,
    datumIndex,
    group: null,
    groupLabel: "hover-dot",
    key: `hover-dot:${datumIndex}`,
    markId: "hover-dot",
    x: pixelX,
    xValue: date,
    y: pixelY,
    yValue: close,
  };
  const node: SceneNode = {
    key: `hover-dot:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: size,
    style: isRing
      ? { fill: "transparent", stroke: fill, strokeWidth }
      : { fill, stroke: "var(--chart-background)", strokeWidth },
    x: pixelX,
    y: pixelY,
  };
  return { node, point };
};

/**
 * Builds the hover-dot scene for one render pass (nodes plus interaction points).
 *
 * @param {Readonly<CandleHoverDotSceneParams>} params - Resolved scales, channel values, and dot styling inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the hover-dot mark plus their points.
 */
const renderCandleHoverDotScene = (params: Readonly<CandleHoverDotSceneParams>): CandleMarkScene => {
  const { scales, source, xValues, closeValues, dotCfg, size, strokeWidth, isRing } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (const [datumIndex, datum] of source.entries()) {
    const entry = buildCandleHoverDotEntry({ close: closeValues[datumIndex], date: xValues[datumIndex], datum, datumIndex, dotCfg, isRing, scales, size, strokeWidth });
    if (entry !== undefined) {
      nodes.push(entry.node);
      points.push(entry.point);
    }
  }
  return { nodes, points };
};

interface CandleHoverDotMarkParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly dotCfg: Readonly<DotConfig>;
  readonly tooltipSpring: Readonly<SpringConfig>;
}

interface CandleHoverDotChannels {
  readonly xValues: (Date | undefined)[];
  readonly closeValues: (number | undefined)[];
}

/**
 * Collects hover-dot channel values once at mark-build time (bklit parity: no decimation).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the mark.
 * @param {string} xDataKey - Datum field holding the point date.
 * @returns {CandleHoverDotChannels} Parallel date/close arrays with non-conforming entries cleared to undefined.
 */
const collectCandleHoverDotChannels = (
  source: readonly Readonly<ChartDatum>[],
  xDataKey: string,
): CandleHoverDotChannels => {
  const xValues: (Date | undefined)[] = [];
  const closeValues: (number | undefined)[] = [];
  for (const datum of source) {
    const xRaw = datum[xDataKey];
    xValues.push(xRaw instanceof Date ? xRaw : undefined);
    const closeRaw = datum.close;
    closeValues.push(isFiniteNumber(closeRaw) ? closeRaw : undefined);
  }
  return { closeValues, xValues };
};

/**
 * Plain-dot radius/stroke are hardcoded (only ring reads dotSize/scale/strokeWidth); ring stays a circle.
 *
 * @param {Readonly<CandleHoverDotMarkParams>} params - Row data plus the resolved dot config and tooltip spring.
 * @returns {ChartMark<ChartDatum, Date, number>} The hover-dot mark, keyed by row index.
 */
const createCandlestickHoverDotMark = (params: Readonly<CandleHoverDotMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const { source, xDataKey, dotCfg, tooltipSpring } = params;
  const isRing = (dotCfg.variant ?? "dot") === "ring";
  const size = isRing ? (dotCfg.size ?? DEFAULT_HOVER_DOT_SIZE) * (dotCfg.scale ?? DEFAULT_DOT_SCALE) : DEFAULT_HOVER_DOT_SIZE;
  const strokeWidth = isRing ? (dotCfg.strokeWidth ?? DEFAULT_HOVER_DOT_STROKE_WIDTH) : PLAIN_HOVER_DOT_STROKE_WIDTH;
  // Bklit parity: dots always spring; ChartTooltip never gates them on discrete.
  const motion: ChartMotionDefinition<ChartDatum> = {
    transition: { damping: tooltipSpring.damping, stiffness: tooltipSpring.stiffness, type: "spring" },
  };
  return {
    initialize: () => {
      const { xValues, closeValues } = collectCandleHoverDotChannels(source, xDataKey);
      return {
        channels: {
          x: { scale: "x", values: xValues },
          y: { scale: "y", values: closeValues },
        },
        id: "hover-dot",
        motion,
        render: ({ scales }): MarkScene<ChartDatum, Date, number> => {
          const scene = renderCandleHoverDotScene({ closeValues, dotCfg, isRing, scales, size, source, strokeWidth, xValues });
          return {
            nodes: [
              { ariaHidden: true, children: scene.nodes, className: "bkm-chart__hover-dot", key: "hover-dot", kind: "group" },
            ],
            points: scene.points,
          };
        },
      };
    },
  };
}

interface CandleHighlightMarkParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface CandleHighlightChannels {
  readonly xValues: (Date | undefined)[];
  readonly lowValues: (number | undefined)[];
  readonly highValues: (number | undefined)[];
  readonly openValues: (number | undefined)[];
  readonly closeValues: (number | undefined)[];
  readonly yValues: number[];
}

/**
 * Collects highlight channel values once at mark-build time (bklit parity: no decimation).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the mark.
 * @param {string} xDataKey - Datum field holding the point date.
 * @returns {CandleHighlightChannels} Date channel plus the finite low/high/open/close values for the y channel.
 */
const collectCandleHighlightChannels = (
  source: readonly Readonly<ChartDatum>[],
  xDataKey: string,
): CandleHighlightChannels => {
  const xValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum[xDataKey];
    return raw instanceof Date ? raw : undefined;
  });
  const lowValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.low;
    return isNumber(raw) ? raw : undefined;
  });
  const highValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.high;
    return isNumber(raw) ? raw : undefined;
  });
  const openValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.open;
    return isNumber(raw) ? raw : undefined;
  });
  const closeValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.close;
    return isNumber(raw) ? raw : undefined;
  });
  return {
    closeValues,
    highValues,
    lowValues,
    openValues,
    xValues,
    yValues: [
      ...lowValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ...highValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ...openValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ...closeValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    ],
  };
};

interface CandleHighlightSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly xValues: readonly (Date | undefined)[];
  readonly lowValues: readonly (number | undefined)[];
  readonly highValues: readonly (number | undefined)[];
  readonly openValues: readonly (number | undefined)[];
  readonly closeValues: readonly (number | undefined)[];
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
}

interface AppendCandleRowSink {
  readonly index: number;
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, Date, number>[];
}

interface CandleHighlightRowFields {
  readonly close: number;
  readonly datum: Readonly<ChartDatum>;
  readonly date: Date;
  readonly high: number;
  readonly low: number;
  readonly open: number;
}

interface CandleHighlightRowPixels {
  readonly cx: number;
  readonly yClose: number;
  readonly yHigh: number;
  readonly yLow: number;
  readonly yOpen: number;
}

interface CandleHighlightPixelParams {
  readonly close: number;
  readonly date: Date;
  readonly high: number;
  readonly low: number;
  readonly open: number;
  readonly scales: MarkRenderContext["scales"];
}

interface CandleRowFillParams {
  readonly close: number;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly open: number;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface CandleRowFill {
  readonly candlePattern: Readonly<CandlePatternRef>;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly isPositive: boolean;
}

interface CandleHighlightStrokeParams {
  readonly bodyHeight: number;
  readonly bodyWidthPx: number;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly fill: string;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

interface CandleHighlightRowNodesParams {
  readonly bodyWidthPx: number;
  readonly candlePattern: Readonly<CandlePatternRef>;
  readonly cx: number;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly point: ChartPoint<ChartDatum, Date, number>;
  readonly yClose: number;
  readonly yHigh: number;
  readonly yLow: number;
  readonly yOpen: number;
}

interface CandleRangeFields {
  readonly date: Date;
  readonly high: number;
  readonly low: number;
}

interface CandleHighlightPrices {
  readonly close: number;
  readonly open: number;
}

/**
 * Parses the date/low/high branch of one candle row; invalid branches parse nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleRangeFields | undefined} Validated range fields, or undefined when the branch is invalid.
 */
const parseCandleRangeFields = (params: Readonly<CandleRowReadInput>): CandleRangeFields | undefined => {
  const datum = params.source[params.index];
  const date = datum[params.xDataKey];
  if (!(date instanceof Date)) {return undefined;}
  const { high, low } = datum;
  if (!isNumber(low) || !isNumber(high) || !areBothFinite(low, high)) {return undefined;}
  return { date, high, low };
};

/**
 * Parses the open/close branch of one highlight row; invalid branches parse nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleHighlightPrices | undefined} Validated price fields, or undefined when the branch is invalid.
 */
const parseCandleHighlightPrices = (params: Readonly<CandleRowReadInput>): CandleHighlightPrices | undefined => {
  const datum = params.source[params.index];
  const { close, open } = datum;
  if (!isNumber(open)) {return undefined;}
  if (!isNumber(close) || !areBothFinite(open, close)) {return undefined;}
  return { close, open };
};

/**
 * Reads one highlight row; invalid rows read nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleHighlightRowFields | undefined} Validated row fields, or undefined when the row is invalid.
 */
const readCandleHighlightFields = (params: Readonly<CandleRowReadInput>): CandleHighlightRowFields | undefined => {
  const range = parseCandleRangeFields(params);
  if (range === undefined) {return undefined;}
  const prices = parseCandleHighlightPrices(params);
  if (prices === undefined) {return undefined;}
  const datum = params.source[params.index];
  return { close: prices.close, date: range.date, datum, high: range.high, low: range.low, open: prices.open };
};

/**
 * Maps one highlight row through the scales; off-scale rows map nothing.
 *
 * @param {Readonly<CandleHighlightPixelParams>} params - Validated row fields plus resolved scales.
 * @returns {CandleHighlightRowPixels | undefined} Pixel coordinates, or undefined when any map is non-finite.
 */
const mapCandleHighlightPixels = (params: Readonly<CandleHighlightPixelParams>): CandleHighlightRowPixels | undefined => {
  const { close, date, high, low, open, scales } = params;
  const cx = scales.x.map(date);
  const yLow = scales.y.map(low);
  const yHigh = scales.y.map(high);
  const yOpen = scales.y.map(open);
  const yClose = scales.y.map(close);
  if (!areBothFinite(cx, yLow) || !areBothFinite(yHigh, yOpen) || !Number.isFinite(yClose)) {return undefined;}
  return { cx, yClose, yHigh, yLow, yOpen };
};

/**
 * Resolves the fill for one candle row from polarity and pattern presence.
 *
 * @param {Readonly<CandleRowFillParams>} params - Row open/close plus pattern and fill inputs.
 * @returns {CandleRowFill} Polarity, pattern, and resolved fill.
 */
const resolveCandleRowFill = (params: Readonly<CandleRowFillParams>): CandleRowFill => {
  const { close, negativePattern, open, positivePattern, solidFillFor } = params;
  const isPositive = close >= open;
  const candlePattern = isPositive ? positivePattern : negativePattern;
  const hasOwnPattern = Boolean(candlePattern.href);
  const fill = solidFillFor(isPositive, hasOwnPattern);
  return { candlePattern, fill, hasOwnPattern, isPositive };
};

/**
 * Builds the inside-stroke node for one highlight row; zero widths build nothing.
 *
 * @param {Readonly<CandleHighlightStrokeParams>} params - Body geometry, fill, and the row point.
 * @returns {SceneNode | undefined} Stroke node, or undefined when the stroke width is zero.
 */
const buildCandleHighlightStrokeNode = (params: Readonly<CandleHighlightStrokeParams>): SceneNode | undefined => {
  const { bodyHeight, bodyWidthPx, bodyX, bodyY, fill, insideStrokeW, key, point } = params;
  if (insideStrokeW <= MIN_GEOMETRY_EXTENT_PX) {return undefined;}
  const strokeTargetY = bodyY + insideStrokeW / GEOMETRY_HALF_DIVISOR;
  const strokeTargetHeight = bodyHeight - insideStrokeW;
  return {
    height: strokeTargetHeight,
    key: `${key}:body-stroke`,
    kind: "rect",
    pointOwner: point,
    radius: 1,
    style: { fill: "none", stroke: fill, strokeWidth: insideStrokeW },
    width: bodyWidthPx - insideStrokeW,
    x: bodyX + insideStrokeW / GEOMETRY_HALF_DIVISOR,
    y: strokeTargetY,
  };
};

/**
 * Builds every highlight node for one mapped row (wick, body, pattern overlay, inside stroke).
 *
 * @param {Readonly<CandleHighlightRowNodesParams>} params - Mapped pixels, fill, geometry, and the row point.
 * @returns {SceneNode[]} Wick node first, then body, then overlays.
 */
const buildCandleHighlightRowNodes = (params: Readonly<CandleHighlightRowNodesParams>): SceneNode[] => {
  const { bodyWidthPx, candlePattern, cx, fill, hasOwnPattern, insideStrokeW, key, point, yClose, yHigh, yLow, yOpen } = params;
  const wickNode: SceneNode = {
    height: Math.abs(yHigh - yLow) || FLAT_EXTENT_FALLBACK_PX,
    key: `${key}:wick`,
    kind: "rect",
    pointOwner: point,
    style: { fill },
    width: WICK_WIDTH_PX,
    x: cx - WICK_WIDTH_PX / GEOMETRY_HALF_DIVISOR,
    y: Math.min(yLow, yHigh),
  };
  const bodyX = cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR;
  const bodyY = Math.min(yOpen, yClose);
  const bodyHeight = Math.abs(yClose - yOpen) || FLAT_EXTENT_FALLBACK_PX;
  const bodyNode: SceneNode = {
    height: bodyHeight,
    key: `${key}:body`,
    kind: "rect",
    pointOwner: point,
    radius: 1,
    style: { fill, stroke: fill, strokeWidth: 1 },
    width: bodyWidthPx,
    x: bodyX,
    y: bodyY,
  };
  const patternNode: SceneNode | undefined = hasOwnPattern ? {
    height: bodyHeight,
    key: `${key}:body-pattern`,
    kind: "rect",
    pointOwner: point,
    radius: 1,
    style: { fill: candlePattern.href },
    width: bodyWidthPx,
    x: bodyX,
    y: bodyY,
  } : undefined;
  const strokeNode = buildCandleHighlightStrokeNode({ bodyHeight, bodyWidthPx, bodyX, bodyY, fill, insideStrokeW, key, point });
  return [wickNode, bodyNode, ...(patternNode === undefined ? [] : [patternNode]), ...(strokeNode === undefined ? [] : [strokeNode])];
};

/**
 * Appends the hover-highlight nodes for one candle row; invalid rows append nothing.
 *
 * @param {Readonly<CandleHighlightSceneParams> & AppendCandleRowSink} params - Resolved scales, channel values, and pattern/fill inputs plus the row index and accumulators.
 * @returns {void} Nothing; appends into params.nodes and params.points.
 */
const appendCandleHighlightRow = (params: Readonly<CandleHighlightSceneParams> & AppendCandleRowSink): void => {
  const fields = readCandleHighlightFields(params);
  if (fields === undefined) {return;}
  const pixels = mapCandleHighlightPixels({ close: fields.close, date: fields.date, high: fields.high, low: fields.low, open: fields.open, scales: params.scales });
  if (pixels === undefined) {return;}
  const fillInfo = resolveCandleRowFill({ close: fields.close, negativePattern: params.negativePattern, open: fields.open, positivePattern: params.positivePattern, solidFillFor: params.solidFillFor });
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fillInfo.fill, datum: fields.datum, datumIndex: params.index, group: null, groupLabel: HOVER_HIGHLIGHT_MARK_ID, key: `hover-highlight:${params.index}`, markId: HOVER_HIGHLIGHT_MARK_ID, x: pixels.cx, xValue: fields.date, y: pixels.yClose, yValue: fields.close,
  };
  params.nodes.push(...buildCandleHighlightRowNodes({ bodyWidthPx: params.bodyWidthPx, candlePattern: fillInfo.candlePattern, cx: pixels.cx, fill: fillInfo.fill, hasOwnPattern: fillInfo.hasOwnPattern, insideStrokeW: params.insideStrokeW, key: `hover-highlight:${params.index}`, point, yClose: pixels.yClose, yHigh: pixels.yHigh, yLow: pixels.yLow, yOpen: pixels.yOpen }));
  params.points.push(point);
};

/**
 * Builds the hover-highlight scene for one render pass (mirrors wick/body geometry).
 *
 * @param {Readonly<CandleHighlightSceneParams>} params - Resolved scales, channel values, and pattern/fill inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the hover-highlight mark plus their points.
 */
const renderCandleHighlightScene = (params: Readonly<CandleHighlightSceneParams>): CandleMarkScene => {
  const { scales, source, xDataKey, xValues, lowValues, highValues, openValues, closeValues, positivePattern, negativePattern, solidFillFor, bodyWidthPx, insideStrokeW } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (let rowIndex = 0; rowIndex < source.length; rowIndex += ROW_INDEX_STEP) {
    appendCandleHighlightRow({ bodyWidthPx, closeValues, highValues, index: rowIndex, insideStrokeW, lowValues, negativePattern, nodes, openValues, points, positivePattern, scales, solidFillFor, source, xDataKey, xValues });
  }
  return { nodes, points };
};

// Highlight mark mirrors wick/body geometry exactly with no dim states; it snaps, never springs.
const createCandlestickHighlightMark = (params: Readonly<CandleHighlightMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const { source, xDataKey, bodyWidthPx, insideStrokeW, positivePattern, negativePattern, solidFillFor } = params;
  return (
  {
    initialize: () => {
      const { xValues, lowValues, highValues, openValues, closeValues, yValues } = collectCandleHighlightChannels(source, xDataKey);
      return {
        channels: {
          x: { scale: "x", values: xValues },
          y: {
            scale: "y",
            values: yValues,
          },
        },
        id: HOVER_HIGHLIGHT_MARK_ID,
        render: ({ scales }): MarkScene<ChartDatum, Date, number> => {
          const scene = renderCandleHighlightScene({ bodyWidthPx, closeValues, highValues, insideStrokeW, lowValues, negativePattern, openValues, positivePattern, scales, solidFillFor, source, xDataKey, xValues });
          return {
            nodes: [
              // App-owned mark groups use the bkm-chart__ prefix, not ts-chart__.
              { ariaHidden: true, children: scene.nodes, className: "bkm-chart__candle-highlight", key: HOVER_HIGHLIGHT_MARK_ID, kind: "group" },
            ],
            points: scene.points,
          };
        },
      };
    },
    }
  );
};

interface CandleWicksSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
}

interface CandleRowReadInput {
  readonly index: number;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

interface CandleWickRowFields {
  readonly close: unknown;
  readonly datum: Readonly<ChartDatum>;
  readonly date: Date;
  readonly high: number;
  readonly isPositive: boolean;
  readonly low: number;
  readonly open: unknown;
  readonly wickFill: string;
}

interface CandleWickPixelParams {
  readonly close: unknown;
  readonly date: Date;
  readonly high: number;
  readonly low: number;
  readonly open: unknown;
  readonly scales: MarkRenderContext["scales"];
}

interface CandleWickRowPixels {
  readonly bodyTargetHeight: number | undefined;
  readonly bodyTargetY: number | undefined;
  readonly cx: number;
  readonly wickTargetHeight: number;
  readonly wickTargetY: number;
  readonly yHigh: number;
}

interface CandleWickReadInput {
  readonly index: number;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

interface CandleWickRowNodesParams {
  readonly bodyTargetHeight: number | undefined;
  readonly bodyTargetY: number | undefined;
  readonly cx: number;
  readonly isPositive: boolean;
  readonly key: string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
  readonly wickFill: string;
  readonly wickTargetHeight: number;
  readonly wickTargetY: number;
}

const readCandleWickFields = (params: Readonly<CandleWickReadInput>): CandleWickRowFields | undefined => {
  const range = parseCandleRangeFields(params);
  if (range === undefined) {return undefined;}
  const datum = params.source[params.index];
  const { close, open } = datum;
  const isPositive = isNumber(close) && isNumber(open) && close >= open;
  const candlePattern = isPositive ? params.positivePattern : params.negativePattern;
  const wickFill = params.solidFillFor(isPositive, Boolean(candlePattern.href));
  return { close, date: range.date, datum, high: range.high, isPositive, low: range.low, open, wickFill };
};

/**
 * Maps one wick row through the scales; off-scale rows map nothing.
 *
 * @param {Readonly<CandleWickPixelParams>} params - Validated range plus raw open/close and resolved scales.
 * @returns {CandleWickRowPixels | undefined} Pixel coordinates and body targets, or undefined when off-scale.
 */
const mapCandleWickPixels = (params: Readonly<CandleWickPixelParams>): CandleWickRowPixels | undefined => {
  const { close, date, high, low, open, scales } = params;
  const cx = scales.x.map(date);
  const yLow = scales.y.map(low);
  const yHigh = scales.y.map(high);
  if (!Number.isFinite(cx) || !Number.isFinite(yLow) || !Number.isFinite(yHigh)) {return undefined;}
  const hasBodyValues = isFiniteNumber(open) && isFiniteNumber(close);
  const bodyTargetY = hasBodyValues ? Math.min(scales.y.map(open), scales.y.map(close)) : undefined;
  const bodyTargetHeight = hasBodyValues ? Math.abs(scales.y.map(close) - scales.y.map(open)) || FLAT_EXTENT_FALLBACK_PX : undefined;
  return { bodyTargetHeight, bodyTargetY, cx, wickTargetHeight: Math.abs(yHigh - yLow) || FLAT_EXTENT_FALLBACK_PX, wickTargetY: Math.min(yLow, yHigh), yHigh };
};

/**
 * Builds the wick-segment nodes for one mapped row, split at the body edge.
 *
 * @param {Readonly<CandleWickRowNodesParams>} params - Mapped pixels, fill/dim inputs, and the row key.
 * @returns {SceneNode[]} Upper/lower segments, or the whole wick when no body values exist.
 */
const buildCandleWickRowNodes = (params: Readonly<CandleWickRowNodesParams>): SceneNode[] => {
  const { bodyTargetHeight, bodyTargetY, cx, isPositive, key, legendDimOpacity, showTargetGeometry, wickFill, wickTargetHeight, wickTargetY } = params;
  const dimOpacity = legendDimOpacity(isPositive);
  if (bodyTargetY === undefined || bodyTargetHeight === undefined) {
    // Collapsed geometry is center-anchored, matching legacy's scaleY reveal origin.
    return buildWickSegmentNodes({ collapseY: wickTargetY + wickTargetHeight / GEOMETRY_HALF_DIVISOR, cx, dimOpacity, segKey: key, segTargetHeight: wickTargetHeight, segTargetY: wickTargetY, showTarget: showTargetGeometry, wickFill });
  }
  // Wicks split at the body edge: stacked dim opacities must not double-composite on overlap.
  const collapseY = wickTargetY + wickTargetHeight / GEOMETRY_HALF_DIVISOR;
  const bodyBottom = bodyTargetY + bodyTargetHeight;
  const wickBottom = wickTargetY + wickTargetHeight;
  return [
    ...buildWickSegmentNodes({ collapseY, cx, dimOpacity, segKey: `${key}:upper`, segTargetHeight: bodyTargetY - wickTargetY, segTargetY: wickTargetY, showTarget: showTargetGeometry, wickFill }),
    ...buildWickSegmentNodes({ collapseY, cx, dimOpacity, segKey: `${key}:lower`, segTargetHeight: wickBottom - bodyBottom, segTargetY: bodyBottom, showTarget: showTargetGeometry, wickFill }),
  ];
};

/**
 * Appends the wick-segment nodes for one candle row; invalid rows append nothing.
 *
 * @param {Readonly<CandleWicksSceneParams> & AppendCandleRowSink} params - Resolved scales, rows, and fill/dim inputs plus the row index and accumulators.
 * @returns {void} Nothing; appends into params.nodes and params.points.
 */
const appendCandleWickRow = (params: Readonly<CandleWicksSceneParams> & AppendCandleRowSink): void => {
  const fields = readCandleWickFields(params);
  if (fields === undefined) {return;}
  const pixels = mapCandleWickPixels({ close: fields.close, date: fields.date, high: fields.high, low: fields.low, open: fields.open, scales: params.scales });
  if (pixels === undefined) {return;}
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fields.wickFill, datum: fields.datum, datumIndex: params.index, group: fields.isPositive ? "positive" : "negative", groupLabel: fields.isPositive ? "positive" : "negative", key: `wicks:${params.index}`, markId: "wicks", x: pixels.cx, xValue: fields.date, y: pixels.yHigh, yValue: fields.high,
  };
  params.nodes.push(...buildCandleWickRowNodes({ bodyTargetHeight: pixels.bodyTargetHeight, bodyTargetY: pixels.bodyTargetY, cx: pixels.cx, isPositive: fields.isPositive, key: `wicks:${params.index}`, legendDimOpacity: params.legendDimOpacity, showTargetGeometry: params.showTargetGeometry, wickFill: fields.wickFill, wickTargetHeight: pixels.wickTargetHeight, wickTargetY: pixels.wickTargetY }));
  params.points.push(point);
};

/**
 * Builds the wicks scene for one render pass (wick segments split at the body edge).
 *
 * @param {Readonly<CandleWicksSceneParams>} params - Resolved scales, rows, and fill/dim inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the wicks mark plus their points.
 */
const renderCandleWicksScene = (params: Readonly<CandleWicksSceneParams>): CandleMarkScene => {
  const { scales, source, xDataKey, positivePattern, negativePattern, solidFillFor, legendDimOpacity, showTargetGeometry } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (let rowIndex = 0; rowIndex < source.length; rowIndex += ROW_INDEX_STEP) {
    appendCandleWickRow({ index: rowIndex, legendDimOpacity, negativePattern, nodes, points, positivePattern, scales, showTargetGeometry, solidFillFor, source, xDataKey });
  }
  return { nodes, points };
};

interface CandleBodiesSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
}

interface CandleBodyRowFields {
  readonly close: number;
  readonly datum: Readonly<ChartDatum>;
  readonly date: Date;
  readonly open: number;
}

interface CandleBodyPixelParams {
  readonly close: number;
  readonly date: Date;
  readonly open: number;
  readonly scales: MarkRenderContext["scales"];
}

interface CandleBodyRowPixels {
  readonly cx: number;
  readonly yClose: number;
  readonly yOpen: number;
}

interface CandleBodyStrokeParams {
  readonly bodyTargetHeight: number;
  readonly bodyTargetY: number;
  readonly bodyWidthPx: number;
  readonly cx: number;
  readonly dimOpacity: number | undefined;
  readonly fill: string;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly showTargetGeometry: boolean;
}

interface CandleBodyRowNodesParams {
  readonly bodyWidthPx: number;
  readonly candlePattern: Readonly<CandlePatternRef>;
  readonly cx: number;
  readonly dimOpacity: number | undefined;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly showTargetGeometry: boolean;
  readonly yClose: number;
  readonly yOpen: number;
}

/**
 * Reads one body row; invalid rows read nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleBodyRowFields | undefined} Validated row fields, or undefined when the row is invalid.
 */
const readCandleBodyFields = (params: Readonly<CandleRowReadInput>): CandleBodyRowFields | undefined => {
  const datum = params.source[params.index];
  const date = datum[params.xDataKey];
  if (!(date instanceof Date)) {return undefined;}
  const { close, open } = datum;
  if (!isNumber(open) || !isNumber(close) || !areBothFinite(open, close)) {return undefined;}
  return { close, date, datum, open };
};

/**
 * Maps one body row through the scales; off-scale rows map nothing.
 *
 * @param {Readonly<CandleBodyPixelParams>} params - Validated row fields plus resolved scales.
 * @returns {CandleBodyRowPixels | undefined} Pixel coordinates, or undefined when any map is non-finite.
 */
const mapCandleBodyPixels = (params: Readonly<CandleBodyPixelParams>): CandleBodyRowPixels | undefined => {
  const { close, date, open, scales } = params;
  const cx = scales.x.map(date);
  const yOpen = scales.y.map(open);
  const yClose = scales.y.map(close);
  if (!Number.isFinite(cx) || !Number.isFinite(yOpen) || !Number.isFinite(yClose)) {return undefined;}
  return { cx, yClose, yOpen };
};

/**
 * Builds the inside-stroke node for one body row; zero widths build nothing.
 *
 * @param {Readonly<CandleBodyStrokeParams>} params - Body targets, dim opacity, and fill.
 * @returns {SceneNode | undefined} Stroke node, or undefined when the stroke width is zero.
 */
const buildCandleBodyStrokeNode = (params: Readonly<CandleBodyStrokeParams>): SceneNode | undefined => {
  const { bodyTargetHeight, bodyTargetY, bodyWidthPx, cx, dimOpacity, fill, insideStrokeW, key, showTargetGeometry } = params;
  if (insideStrokeW <= MIN_GEOMETRY_EXTENT_PX) {return undefined;}
  const strokeTargetY = bodyTargetY + insideStrokeW / GEOMETRY_HALF_DIVISOR;
  const strokeTargetHeight = bodyTargetHeight - insideStrokeW;
  return {
    className: CANDLE_CELL_CLASS_NAME,
    height: showTargetGeometry ? strokeTargetHeight : COLLAPSED_GEOMETRY_PX,
    key: `${key}:stroke`,
    kind: "rect",
    radius: 1,
    style: { fill: "none", opacity: dimOpacity, stroke: fill, strokeWidth: insideStrokeW },
    width: bodyWidthPx - insideStrokeW,
    x: cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR + insideStrokeW / GEOMETRY_HALF_DIVISOR,
    y: showTargetGeometry ? strokeTargetY : strokeTargetY + strokeTargetHeight / GEOMETRY_HALF_DIVISOR,
  };
};

/**
 * Builds every body node for one mapped row (fill, pattern overlay, inside stroke).
 *
 * @param {Readonly<CandleBodyRowNodesParams>} params - Mapped pixels plus fill/dim inputs.
 * @returns {SceneNode[]} Fill node first, then overlays.
 */
const buildCandleBodyRowNodes = (params: Readonly<CandleBodyRowNodesParams>): SceneNode[] => {
  const { bodyWidthPx, candlePattern, cx, dimOpacity, fill, hasOwnPattern, insideStrokeW, key, showTargetGeometry, yClose, yOpen } = params;
  const bodyTargetY = Math.min(yOpen, yClose);
  const bodyTargetHeight = Math.abs(yClose - yOpen) || FLAT_EXTENT_FALLBACK_PX;
  const bodyY = showTargetGeometry ? bodyTargetY : bodyTargetY + bodyTargetHeight / GEOMETRY_HALF_DIVISOR;
  const bodyHeight = showTargetGeometry ? bodyTargetHeight : COLLAPSED_GEOMETRY_PX;
  const bodyNode: SceneNode = {
    className: CANDLE_CELL_CLASS_NAME,
    height: bodyHeight,
    key,
    kind: "rect",
    radius: 1,
    style: { fill, opacity: dimOpacity, stroke: fill, strokeWidth: 1 },
    width: bodyWidthPx,
    x: cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR,
    y: bodyY,
  };
  const strokeNode = buildCandleBodyStrokeNode({ bodyTargetHeight, bodyTargetY, bodyWidthPx, cx, dimOpacity, fill, insideStrokeW, key, showTargetGeometry });
  const patternNode: SceneNode | undefined = hasOwnPattern ? {
    className: CANDLE_CELL_CLASS_NAME,
    height: bodyHeight,
    key: `${key}:pattern`,
    kind: "rect",
    radius: 1,
    style: { fill: candlePattern.href, opacity: dimOpacity },
    width: bodyWidthPx,
    x: cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR,
    y: bodyY,
  } : undefined;
  return [
    bodyNode,
    ...(patternNode === undefined ? [] : [patternNode]),
    ...(strokeNode === undefined ? [] : [strokeNode]),
  ];
};

/**
 * Appends the body nodes for one candle row; invalid rows append nothing.
 *
 * @param {Readonly<CandleBodiesSceneParams> & AppendCandleRowSink} params - Resolved scales, rows, and fill/dim inputs plus the row index and accumulators.
 * @returns {void} Nothing; appends into params.nodes and params.points.
 */
const appendCandleBodyRow = (params: Readonly<CandleBodiesSceneParams> & AppendCandleRowSink): void => {
  const fields = readCandleBodyFields(params);
  if (fields === undefined) {return;}
  const pixels = mapCandleBodyPixels({ close: fields.close, date: fields.date, open: fields.open, scales: params.scales });
  if (pixels === undefined) {return;}
  const fillInfo = resolveCandleRowFill({ close: fields.close, negativePattern: params.negativePattern, open: fields.open, positivePattern: params.positivePattern, solidFillFor: params.solidFillFor });
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fillInfo.fill, datum: fields.datum, datumIndex: params.index, group: fillInfo.isPositive ? "positive" : "negative", groupLabel: fillInfo.isPositive ? "positive" : "negative", key: `bodies:${params.index}`, markId: "bodies", x: pixels.cx, xValue: fields.date, y: pixels.yClose, yValue: fields.close,
  };
  params.nodes.push(...buildCandleBodyRowNodes({ bodyWidthPx: params.bodyWidthPx, candlePattern: fillInfo.candlePattern, cx: pixels.cx, dimOpacity: params.legendDimOpacity(fillInfo.isPositive), fill: fillInfo.fill, hasOwnPattern: fillInfo.hasOwnPattern, insideStrokeW: params.insideStrokeW, key: `bodies:${params.index}`, showTargetGeometry: params.showTargetGeometry, yClose: pixels.yClose, yOpen: pixels.yOpen }));
  params.points.push(point);
};

/**
 * Builds the bodies scene for one render pass (fill, pattern overlay, inside stroke).
 *
 * @param {Readonly<CandleBodiesSceneParams>} params - Resolved scales, rows, and fill/dim inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the bodies mark plus their points.
 */
const renderCandleBodiesScene = (params: Readonly<CandleBodiesSceneParams>): CandleMarkScene => {
  const { scales, source, xDataKey, bodyWidthPx, insideStrokeW, positivePattern, negativePattern, solidFillFor, legendDimOpacity, showTargetGeometry } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (let rowIndex = 0; rowIndex < source.length; rowIndex += ROW_INDEX_STEP) {
    appendCandleBodyRow({ bodyWidthPx, index: rowIndex, insideStrokeW, legendDimOpacity, negativePattern, nodes, points, positivePattern, scales, showTargetGeometry, solidFillFor, source, xDataKey });
  }
  return { nodes, points };
};

interface CandleWicksMarkParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
  readonly dimStates: readonly ChartMarkState<ChartDatum>[];
  readonly candleMotion: ChartMotionDefinition<ChartDatum>;
}

/**
 * Builds the wicks mark (definition-memo time).
 *
 * @param {Readonly<CandleWicksMarkParams>} params - Rows, patterns, dim inputs, and shared candle motion.
 * @returns {ChartMark<ChartDatum, Date, number>} The `createMark`-built wicks mark.
 */
const buildCandleWicksMark = (params: Readonly<CandleWicksMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const { source, xDataKey, positivePattern, negativePattern, solidFillFor, legendDimOpacity, showTargetGeometry, dimStates, candleMotion } = params;
  return createMark(() => {
    const xValues = source.map((datum: Readonly<ChartDatum>) => {
      const raw = datum[xDataKey];
      return raw instanceof Date ? raw : undefined;
    });
    const lowValues = source.map((datum: Readonly<ChartDatum>) => {
      const raw = datum.low;
      return isNumber(raw) ? raw : undefined;
    });
    const highValues = source.map((datum: Readonly<ChartDatum>) => {
      const raw = datum.high;
      return isNumber(raw) ? raw : undefined;
    });
    return {
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: [
            ...lowValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
            ...highValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
          ],
        },
      },
      id: "wicks",
      render: ({ scales }): MarkScene<ChartDatum, Date, number> => {
        const scene = renderCandleWicksScene({ legendDimOpacity, negativePattern, positivePattern, scales, showTargetGeometry, solidFillFor, source, xDataKey });
        return {
          nodes: [{ ariaHidden: true, children: scene.nodes, className: "bkm-chart__candle", key: "wicks", kind: "group" }],
          points: scene.points,
        };
      },
      states: dimStates.length > EMPTY_COUNT ? { data: source, definitions: dimStates } : undefined,
    };
  }, candleMotion);
};

interface CandleBodiesMarkParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
  readonly dimStates: readonly ChartMarkState<ChartDatum>[];
  readonly candleMotion: ChartMotionDefinition<ChartDatum>;
}

/**
 * Builds the bodies mark (definition-memo time).
 *
 * @param {Readonly<CandleBodiesMarkParams>} params - Rows, patterns, dim inputs, and shared candle motion.
 * @returns {ChartMark<ChartDatum, Date, number>} The `createMark`-built bodies mark.
 */
const buildCandleBodiesMark = (params: Readonly<CandleBodiesMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const { source, xDataKey, bodyWidthPx, insideStrokeW, positivePattern, negativePattern, solidFillFor, legendDimOpacity, showTargetGeometry, dimStates, candleMotion } = params;
  return createMark(() => {
    const xValues = source.map((datum: Readonly<ChartDatum>) => {
      const raw = datum[xDataKey];
      return raw instanceof Date ? raw : undefined;
    });
    const openValues = source.map((datum: Readonly<ChartDatum>) => {
      const raw = datum.open;
      return isNumber(raw) ? raw : undefined;
    });
    const closeValues = source.map((datum: Readonly<ChartDatum>) => {
      const raw = datum.close;
      return isNumber(raw) ? raw : undefined;
    });
    return {
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: [
            ...openValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
            ...closeValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
          ],
        },
      },
      id: "bodies",
      render: ({ scales }): MarkScene<ChartDatum, Date, number> => {
        const scene = renderCandleBodiesScene({ bodyWidthPx, insideStrokeW, legendDimOpacity, negativePattern, positivePattern, scales, showTargetGeometry, solidFillFor, source, xDataKey });
        return {
          nodes: [{ ariaHidden: true, children: scene.nodes, className: "bkm-chart__candle", key: "bodies", kind: "group" }],
          points: scene.points,
        };
      },
      states: dimStates.length > EMPTY_COUNT ? { data: source, definitions: dimStates } : undefined,
    };
  }, candleMotion);
};

interface CandleCoreMarksParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly legendHoveredIndex: number | null;
  readonly fadedOpacity: number;
  readonly showHoverFade: boolean;
  readonly showTargetGeometry: boolean;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
  readonly candleMotion: ChartMotionDefinition<ChartDatum>;
}

interface CandleCoreMarks {
  readonly wicksMark: ChartMark<ChartDatum, Date, number>;
  readonly bodiesMark: ChartMark<ChartDatum, Date, number>;
}

/**
 * Builds the wicks and bodies marks sharing one legend-dim rule (definition-memo time).
 *
 * @param {Readonly<CandleCoreMarksParams>} params - Rows, patterns, dim inputs, and shared candle motion.
 * @returns {CandleCoreMarks} The wicks and bodies marks for the chart definition.
 */
const buildCandleCoreMarks = (params: Readonly<CandleCoreMarksParams>): CandleCoreMarks => {
  const { source, xDataKey, positivePattern, negativePattern, solidFillFor, legendHoveredIndex, fadedOpacity, showHoverFade, showTargetGeometry, bodyWidthPx, insideStrokeW, candleMotion } = params;
  // Legend index 0 = positive, 1 = negative; the other polarity dims to fadedOpacity.
  const legendDimOpacity = (isPositive: boolean): number | undefined => {
    if (legendHoveredIndex !== LEGEND_POSITIVE_INDEX && legendHoveredIndex !== LEGEND_NEGATIVE_INDEX) {return undefined;}
    return (legendHoveredIndex === LEGEND_POSITIVE_INDEX) === isPositive ? undefined : fadedOpacity;
  };
  const wicksDimStates = candlestickDimStates(fadedOpacity, showHoverFade);
  const wicksMark = buildCandleWicksMark({ candleMotion, dimStates: wicksDimStates, legendDimOpacity, negativePattern, positivePattern, showTargetGeometry, solidFillFor, source, xDataKey });
  const bodiesDimStates = candlestickDimStates(fadedOpacity, showHoverFade);
  const bodiesMark = buildCandleBodiesMark({ bodyWidthPx, candleMotion, dimStates: bodiesDimStates, insideStrokeW, legendDimOpacity, negativePattern, positivePattern, showTargetGeometry, solidFillFor, source, xDataKey });
  return { bodiesMark, wicksMark };
};

interface CandleCrosshairMarkParams {
  readonly tooltip: Readonly<TooltipMapperSource> | null | undefined;
  readonly discrete: boolean;
  readonly indicatorGradientId: string;
  readonly tooltipSpring: Readonly<SpringConfig>;
}

/**
 * Builds the crosshair indicator mark when the tooltip enables it (definition-memo time).
 *
 * @param {Readonly<CandleCrosshairMarkParams>} params - Tooltip config plus indicator inputs.
 * @returns {ChartMark<ChartDatum, Date, number> | undefined} The indicator mark, or undefined when hidden.
 */
const buildCandleCrosshairMark = (params: Readonly<CandleCrosshairMarkParams>): ChartMark<ChartDatum, Date, number> | undefined => {
  const { tooltip, discrete, indicatorGradientId, tooltipSpring } = params;
  if (!(tooltip?.showCrosshair ?? true)) {return undefined;}
  // Bklit parity quirk: function indicatorColor is dropped here (no per-frame channel); string only.
  const indicatorCfg = toIndicatorConfig(tooltip);
  const isDashed = Boolean(indicatorCfg.dasharray);
  const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
  const indicatorColorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
  const indicatorSpringCfg = indicatorCfg.springConfig ?? tooltipSpring;
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

interface CandleDotMarkParams {
  readonly tooltip: Readonly<TooltipMapperSource> | null | undefined;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly tooltipSpring: Readonly<SpringConfig>;
}

/**
 * Builds the hover-dot mark when the tooltip enables it (definition-memo time).
 *
 * @param {Readonly<CandleDotMarkParams>} params - Tooltip config, rows, and tooltip spring.
 * @returns {ChartMark<ChartDatum, Date, number> | undefined} The focused hover-dot mark, or undefined when hidden.
 */
const buildCandleDotMark = (params: Readonly<CandleDotMarkParams>): ChartMark<ChartDatum, Date, number> | undefined => {
  const { tooltip, source, xDataKey, tooltipSpring } = params;
  if (!(tooltip?.showDots ?? true)) {return undefined;}
  const dotConfig = toDotConfig(tooltip);
  return whenFocused(
    createCandlestickHoverDotMark({ dotCfg: dotConfig, source, tooltipSpring, xDataKey }),
    { match: "group", retarget: true },
  );
};

interface CandleHoverMarksParams {
  readonly enabled: boolean;
  readonly tooltip: Readonly<TooltipMapperSource> | null | undefined;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly discrete: boolean;
  readonly indicatorGradientId: string;
  readonly tooltipSpring: Readonly<SpringConfig>;
}

/**
 * Builds the hover marks in legacy paint order: highlight first, then crosshair, then dots.
 *
 * @param {Readonly<CandleHoverMarksParams>} params - Rows and every hover-mark input.
 * @returns {ChartMark<ChartDatum, Date, number>[]} The hover marks (empty when the tooltip is disabled).
 */
const buildCandleHoverMarks = (params: Readonly<CandleHoverMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const { enabled, tooltip, source, xDataKey, bodyWidthPx, insideStrokeW, positivePattern, negativePattern, solidFillFor, discrete, indicatorGradientId, tooltipSpring } = params;
  if (!enabled) {return [];}
  // Highlight paints first (bottom of paint order), mirroring legacy append order.
  const hoverMarks: ChartMark<ChartDatum, Date, number>[] = [
    whenFocused(
      createCandlestickHighlightMark({ bodyWidthPx, insideStrokeW, negativePattern, positivePattern, solidFillFor, source, xDataKey }),
      { match: "group" },
    ),
  ];
  const crosshairMark = buildCandleCrosshairMark({ discrete, indicatorGradientId, tooltip, tooltipSpring });
  const dotMark = buildCandleDotMark({ source, tooltip, tooltipSpring, xDataKey });
  for (const mark of [crosshairMark, dotMark]) {
    if (mark !== undefined) {hoverMarks.push(mark);}
  }
  return hoverMarks;
};

interface CandleRevealCycleParams {
  readonly animationDuration: number;
  readonly revealEpochRef: RefObject<number>;
  readonly canInteractRef: RefObject<boolean>;
  readonly revealDeadlineTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>;
  readonly setRevealed: (revealed: boolean) => void;
  /** Re-arm signal (bklit [animationDuration, revealSignature] deps). Changing it re-runs the reveal effect; the cycle itself needs no value from it, so it stays unread. */
  readonly signature: unknown;
}

/**
 * Clears a pending reveal-deadline timer (reveal-effect time).
 *
 * @param {{ current: ReturnType<typeof globalThis.setTimeout> | undefined }} timerRef - Mutable ref holding the deadline timer handle.
 * @returns {void} Nothing.
 */
const clearCandleRevealDeadline = (timerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>): void => {
  if (timerRef.current !== undefined) {
    globalThis.clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }
};

/**
 * Creates the reveal-effect cleanup clearing both timers (reveal-effect time).
 *
 * @param {number} flipTimer - Handle of the collapsed-to-target flip timer.
 * @param {{ current: ReturnType<typeof globalThis.setTimeout> | undefined }} revealDeadlineTimerRef - Mutable ref holding the deadline timer handle.
 * @returns {() => void} Cleanup clearing both timers.
 */
const createCandleRevealCleanup = (flipTimer: Readonly<ReturnType<typeof globalThis.setTimeout>>, revealDeadlineTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>): (() => void) => (): void => {
  globalThis.clearTimeout(flipTimer);
  clearCandleRevealDeadline(revealDeadlineTimerRef);
};

interface CandleRevealTimersParams {
  readonly epoch: number;
  readonly animationDuration: number;
  readonly revealEpochRef: RefObject<number>;
  readonly canInteractRef: RefObject<boolean>;
  readonly revealDeadlineTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>;
  readonly setRevealed: (revealed: boolean) => void;
}

/**
 * Arms the reveal flip and interaction-deadline timers (reveal-effect time).
 *
 * @param {Readonly<CandleRevealTimersParams>} params - Epoch, refs, durations, and state setter.
 * @returns {() => void} Cleanup clearing both timers.
 */
const armCandleRevealTimers = (params: Readonly<CandleRevealTimersParams>): (() => void) => {
  const { epoch, animationDuration, revealEpochRef, canInteractRef, revealDeadlineTimerRef, setRevealed } = params;
  setRevealed(false);
  const flipTimer = globalThis.setTimeout(() => {
    if (revealEpochRef.current === epoch) {setRevealed(true);}
  }, REVEAL_FLIP_DELAY_MS);
  revealDeadlineTimerRef.current = globalThis.setTimeout(() => {
    if (revealEpochRef.current === epoch) {canInteractRef.current = true;}
  }, animationDuration);
  return createCandleRevealCleanup(flipTimer, revealDeadlineTimerRef);
};

/**
 * Runs one reveal cycle: resets interaction state, then arms timers unless animation is off.
 *
 * @param {Readonly<CandleRevealCycleParams>} params - Durations, epoch/interaction refs, and state setter.
 * @returns {(() => void) | undefined} Effect cleanup, or undefined when animation is disabled.
 */
const runCandleRevealCycle = (params: Readonly<CandleRevealCycleParams>): ((() => void) | undefined) => {
  const { animationDuration, revealEpochRef, canInteractRef, revealDeadlineTimerRef, setRevealed } = params;
  revealEpochRef.current += 1;
  const epoch = revealEpochRef.current;
  canInteractRef.current = false;
  clearCandleRevealDeadline(revealDeadlineTimerRef);
  if (animationDuration <= NO_ANIMATION_DURATION_MS) {
    canInteractRef.current = true;
    return undefined;
  }
  return armCandleRevealTimers({ animationDuration, canInteractRef, epoch, revealDeadlineTimerRef, revealEpochRef, setRevealed });
};

interface CandlePillContentParams {
  readonly centerX: number;
  readonly dateLabels: readonly string[] | undefined;
  readonly discrete: boolean;
  readonly formattedDate: string;
  readonly showing: boolean;
  readonly tickerIndex: number;
}

/**
 * Shows the date pill: layer visibility, ticker-or-formatted label, then jump-or-spring position.
 * First pill show jumps; later moves spring (mirrors legacy showing flag).
 *
 * @param {PillBuild} pillBuild - Live pill build (non-null when chrome is mounted).
 * @param {Readonly<CandlePillContentParams>} content - Label and positioning inputs.
 * @returns {void} Nothing.
 */
const displayCandlePill = (pillBuild: PillBuild, content: Readonly<CandlePillContentParams>): void => {
  const { centerX, dateLabels, discrete, formattedDate, showing, tickerIndex } = content;
  pillBuild.layer.style.display = "";
  if (pillBuild.ticker && dateLabels !== undefined && dateLabels.length > EMPTY_COUNT) {
    pillBuild.ticker.update(tickerIndex, discrete);
  } else {
    pillBuild.label.textContent = formattedDate;
  }
  if (showing || discrete) {pillBuild.spring.jump(centerX);}
  else {pillBuild.spring.set(centerX);}
};

interface CandlePillParams {
  readonly centerX: number;
  readonly dateLabels: readonly string[] | undefined;
  readonly formattedDate: string;
  readonly pillBuild: PillBuild | null;
  readonly pillVisibleRef: RefObject<boolean>;
  readonly rowCount: number;
  readonly showDatePill: boolean;
  readonly tickerIndex: number;
}

/**
 * Updates pill chrome for a focus change; hides it when the pill is disabled or unmounted.
 *
 * @param {Readonly<CandlePillParams>} params - Pill refs, visibility flags, and label inputs.
 * @returns {void} Nothing.
 */
const updateCandlePill = (params: Readonly<CandlePillParams>): void => {
  const { centerX, dateLabels, formattedDate, pillBuild, pillVisibleRef, rowCount, showDatePill, tickerIndex } = params;
  // Dense data snaps instead of springing (same threshold as every other chart).
  const discrete = rowCount > DISCRETE_INTERACTION_THRESHOLD;
  const showing = !pillVisibleRef.current;
  pillVisibleRef.current = true;
  if (pillBuild === null) {return;}
  if (!showDatePill) {
    pillBuild.layer.style.display = "none";
    return;
  }
  displayCandlePill(pillBuild, { centerX, dateLabels, discrete, formattedDate, showing, tickerIndex });
};

interface CandleLabelFadeState {
  readonly primaryX: number;
  readonly hoveredLabel: string | null;
}

interface CandleLabelFadeParams {
  readonly centerX: number;
  readonly hoveredLabel: string;
  readonly setLabelFade: Dispatch<SetStateAction<CandleLabelFadeState | null>>;
}

/**
 * Syncs the faded-axis label state to the hovered candle (hoveredLabel must match tick format).
 *
 * @param {Readonly<CandleLabelFadeParams>} params - Hover position, label, and state setter.
 * @returns {void} Nothing.
 */
const updateCandleLabelFade = (params: Readonly<CandleLabelFadeParams>): void => {
  const { centerX, hoveredLabel, setLabelFade } = params;
  // Returning prev when unchanged keeps React from scheduling a no-op render.
  setLabelFade((prev: Readonly<CandleLabelFadeState> | null) => (prev?.primaryX === centerX && prev.hoveredLabel === hoveredLabel ? prev : { hoveredLabel, primaryX: centerX }));
};

interface CandleTooltipModel {
  readonly tt: ChartTooltipConfig | undefined;
  readonly date: Date;
  readonly close: string | number;
  readonly pointRec: ChartTooltipPoint;
}

/**
 * Resolves the tooltip close value, preserving the legacy string fallback.
 *
 * @param {Readonly<ChartDatum>} datum - Raw candle row backing the hovered point.
 * @returns {string | number} Numeric close when number-typed, the raw string, or empty.
 */
const resolveCandleTooltipClose = (datum: Readonly<ChartDatum>): string | number => {
  const closeRaw = datum.close;
  if (isNumber(closeRaw)) {return closeRaw;}
  if (isString(closeRaw)) {return closeRaw;}
  return "";
};

/**
 * Resolves the tooltip model for a hovered candle (tooltip-render time).
 *
 * @param {ChartTooltipBodyRenderContext<ChartDatum, Date, number>} ctx - Tooltip render context with focus points.
 * @param {CandlestickChromeState | null} chromeState - Latest chrome snapshot (tooltip config plus date labels).
 * @returns {CandleTooltipModel | undefined} Model for panel building, or undefined with no points.
 */
const resolveCandleTooltipModel = (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>, chromeState: CandlestickChromeState | null): CandleTooltipModel | undefined => {
  if (ctx.points.length === EMPTY_COUNT) {return undefined;}
  const tt = chromeState?.tooltip ?? undefined;
  const bodyPoint = ctx.points.find((point) => point.markId === "bodies") ?? ctx.points[FIRST_POINT_INDEX];
  const { datum } = bodyPoint;
  const date = bodyPoint.xValue;
  const close = resolveCandleTooltipClose(datum);
  const pointRec = { close, date };
  return { close, date, pointRec, tt };
};

interface CandleTooltipPanel {
  readonly className: string;
  readonly style: CSSProperties | undefined;
}

/**
 * Builds the default close row for a hovered candle (no custom rows configured).
 *
 * @param {string | number} close - Resolved close value for the default row.
 * @returns {TooltipRow[]} The single default close row.
 */
const buildDefaultCandleCloseRow = (close: string | number): TooltipRow[] =>
  [{ color: "var(--chart-line-primary)", label: "close", value: close }];

/**
 * Resolves the tooltip panel class and style from the tooltip config (tooltip-render time).
 *
 * @param {ChartTooltipConfig | undefined} tt - Tooltip config snapshot, if the tooltip is enabled.
 * @returns {CandleTooltipPanel} Panel class name and optional overriding style.
 */
const resolveCandleTooltipPanel = (tt: ChartTooltipConfig | undefined): CandleTooltipPanel => {
  const panelClassName = tt?.className !== undefined && tt.className !== "" ? `bkm-tooltip-panel ${tt.className}` : "bkm-tooltip-panel";
  const backgroundOverride = tt?.backgroundColor !== undefined && tt.backgroundColor !== "" ? { backgroundColor: tt.backgroundColor } : undefined;
  const panelStyle: CSSProperties | undefined =
    tt !== undefined && (tt.panelStyle !== undefined || backgroundOverride !== undefined)
      ? { ...tt.panelStyle, ...backgroundOverride }
      : undefined;
  return { className: panelClassName, style: panelStyle };
};

/**
 * Tracks the lower time bound across scanned rows (pure; NaN candidates never win).
 *
 * @param {number} current - Bound accumulated so far.
 * @param {number} candidate - New scanned time value.
 * @returns {number} The earlier of the two values.
 */
const lowerTimeBound = (current: number, candidate: number): number => (candidate < current ? candidate : current);

/**
 * Tracks the upper time bound across scanned rows (pure; NaN candidates never win).
 *
 * @param {number} current - Bound accumulated so far.
 * @param {number} candidate - New scanned time value.
 * @returns {number} The later of the two values.
 */
const upperTimeBound = (current: number, candidate: number): number => (candidate > current ? candidate : current);

interface CandleYExtremes {
  readonly min: number;
  readonly max: number;
}

/**
 * Scans candle rows for the y-domain extremes (definition-memo time).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the chart.
 * @returns {CandleYExtremes | undefined} Finite low/high extremes, or undefined when no row qualifies.
 */
const findCandleYExtremes = (source: readonly Readonly<ChartDatum>[]): CandleYExtremes | undefined => {
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  for (const row of source) {
    const { high, low } = row;
    minVal = isNumber(low) && low < minVal ? low : minVal;
    maxVal = isNumber(high) && high > maxVal ? high : maxVal;
  }
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {return undefined;}
  return { max: maxVal, min: minVal };
};

interface CandleTimeExtent {
  readonly minTime: number;
  readonly maxTime: number;
}

/**
 * Scans rows for the selection time extent (selection-memo time).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the chart.
 * @param {string} xDataKey - Datum field holding the point date.
 * @returns {CandleTimeExtent | undefined} Finite time bounds, or undefined with no dates.
 */
const findCandleTimeExtent = (source: readonly Readonly<ChartDatum>[], xDataKey: string): CandleTimeExtent | undefined => {
  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const datum of source) {
    const value = datum[xDataKey];
    if (value instanceof Date) {
      minTime = lowerTimeBound(minTime, value.getTime());
      maxTime = upperTimeBound(maxTime, value.getTime());
    }
  }
  if (!Number.isFinite(minTime)) {return undefined;}
  return { maxTime, minTime };
};

interface CandleYScaleParams {
  readonly formatLargeNumbers: boolean | undefined;
  readonly formatValue: ((value: number) => string) | undefined;
  readonly gridNumTicks: number | undefined;
  readonly hasYAxis: boolean;
  readonly yMax: number;
  readonly yMin: number;
  readonly yNumTicks: number | undefined;
}

/**
 * Builds the y scale with padded domain ticks (definition-memo time).
 *
 * @param {Readonly<CandleYScaleParams>} params - Padded domain bounds plus axis/grid inputs.
 * @returns {ChartScale} Linear y scale with legacy label formatting.
 */
const buildCandleYScale = (params: Readonly<CandleYScaleParams>): ChartScale => {
  const { formatLargeNumbers, formatValue, gridNumTicks, hasYAxis, yMax, yMin, yNumTicks } = params;
  const yScale: ChartScale = {
    id: "y",
    resolve(context) {
      const scale = scaleLinear()
        .domain([yMin, yMax])
        .nice()
        .range(context.range);
      // Native y ticks follow the label-tick source; the grid follows the labels in that case.
      const tickCount = hasYAxis ? resolveYAxisTickCount(yNumTicks) : coalesceTickCount(context.tickCount, gridNumTicks);
      const tickValues = scale.ticks(tickCount);
      return {
        bandwidth: 0,
        domain: scale.domain(),
        id: context.id,
        map: (value: unknown) => {
          if (!isNumber(value)) {return Number.NaN;}
          return scale(value);
        },
        ticks: tickValues.map((value) => ({
          label: hasYAxis ? formatYAxisTick(value, formatValue, formatLargeNumbers ?? true) : String(value),
          position: scale(value),
          value,
        })),
        type: "linear",
      };
    },
  };
  return yScale;
};

interface CandleDefinitionMarksParams {
  readonly bodyWidthPx: number;
  readonly candleMotion: ChartMotionDefinition<ChartDatum>;
  readonly discrete: boolean;
  readonly fadedOpacity: number;
  readonly indicatorGradientId: string;
  readonly insideStrokeW: number;
  readonly legendHoveredIndex: number | null;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly showHoverFade: boolean;
  readonly showTargetGeometry: boolean;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly tooltip: Readonly<TooltipMapperSource> | null | undefined;
  readonly tooltipSpring: Readonly<SpringConfig>;
  readonly xDataKey: string;
}

/**
 * Builds the core and hover marks in legacy paint order (definition-memo time).
 *
 * @param {Readonly<CandleDefinitionMarksParams>} params - Rows and every mark input.
 * @returns {ChartMark<ChartDatum, Date, number>[]} Wicks, bodies, then hover marks.
 */
const buildCandleDefinitionMarks = (params: Readonly<CandleDefinitionMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const { bodyWidthPx, candleMotion, discrete, fadedOpacity, indicatorGradientId, insideStrokeW, legendHoveredIndex, negativePattern, positivePattern, showHoverFade, showTargetGeometry, solidFillFor, source, tooltip, tooltipSpring, xDataKey } = params;
  const coreMarks = buildCandleCoreMarks({ bodyWidthPx, candleMotion, fadedOpacity, insideStrokeW, legendHoveredIndex, negativePattern, positivePattern, showHoverFade, showTargetGeometry, solidFillFor, source, xDataKey });
  const hoverMarks = buildCandleHoverMarks({ bodyWidthPx, discrete, enabled: tooltip?.enabled ?? false, indicatorGradientId, insideStrokeW, negativePattern, positivePattern, solidFillFor, source, tooltip, tooltipSpring, xDataKey });
  return [coreMarks.wicksMark, coreMarks.bodiesMark, ...hoverMarks];
};

interface CandleTooltipOptionParams {
  readonly discrete: boolean;
  readonly tooltipEnabled: boolean;
}

/**
 * Builds the native tooltip extension for the chart definition (definition-memo time).
 *
 * @param {Readonly<CandleTooltipOptionParams>} params - Discrete mode and tooltip enablement.
 * @returns {NativeTooltipExtension<ChartDatum, Date, number> | false} Tooltip extension, or false when disabled.
 */
const buildCandleTooltipOption = (params: Readonly<CandleTooltipOptionParams>): NativeTooltipExtension<ChartDatum, Date, number> | false => {
  const { discrete, tooltipEnabled } = params;
  return buildNativeTooltipExtension<ChartDatum, Date, number>({
    anchorX: "value",
    className: "bkm-native-tooltip",
    discrete,
    enabled: tooltipEnabled,
    offset: BOX_OFFSET,
    spring: TOOLTIP_BOX_SPRING,
  });
};

/**
 * Resolves whether candle marks render target geometry (shown once revealed or when animation is off).
 *
 * @param {boolean} revealed - Whether the reveal flip has run.
 * @param {number} animationDuration - Enter animation duration in milliseconds.
 * @param {boolean} animate - Whether candle animation is enabled.
 * @returns {boolean} True when target geometry should render.
 */
const resolveCandleTargetGeometry = (revealed: boolean, animationDuration: number, animate: boolean): boolean =>
  revealed || animationDuration <= NO_ANIMATION_DURATION_MS || !animate;

interface CandlestickChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly margin?: Partial<ChartMargin>;
  readonly animationDuration?: number;
  readonly enterTransition?: CandlestickEnterTransition;
  /** Changing it re-arms the reveal (bklit [animationDuration, revealSignature] deps). */
  readonly revealSignature?: unknown;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly candleGap?: number;
  /** Explicit constant body width in px (overrides the computed width). */
  readonly candleWidth?: number;
  readonly children?: ReactNode;
}


/**
 * Renders one crosshair fade-gradient stop (keeps the layer tree shallow).
 *
 * @param {Readonly<{ offset: string; opacity: number }>} stop - Stop offset and opacity.
 * @param {string} color - Gradient color shared by every stop.
 * @returns {ReactElement} The gradient stop element.
 */
const renderCandleCrosshairStop = (stop: Readonly<{ offset: string; opacity: number }>, color: string): ReactElement => (
  <stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
);

const CandlestickChart = ({
  data,
  xDataKey = "date",
  margin: marginProp,
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  className,
  style,
  candleGap = DEFAULT_CANDLE_GAP_RATIO,
  candleWidth: candleWidthProp,
  children,
}: CandlestickChartProps): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);

  const canInteractRef = useRef(false);
  const revealEpochRef = useRef(INITIAL_REVEAL_EPOCH);
  const revealDeadlineTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);


  const { candlestick, grid, xAxis, yAxis, background, tooltip } = useMemo(
    () => extractChildren(children),
    [children],
  );
  const tooltipEnabled = tooltip?.enabled ?? false;

  // Bklit parity: no decimation — every raw candle renders.
  const renderData = data;

  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext, sceneRef, clientToScene } = useFocusInjection<ChartDatum, Date, number>();

  const resolvedPositiveFill = candlestick?.positiveFill ?? SOLID_POSITIVE;
  const resolvedNegativeFill = candlestick?.negativeFill ?? SOLID_NEGATIVE;

  const resolvedCandlestick = useMemo(() => ({
    animate: candlestick?.animate ?? true,
    bodyPatternNegative: candlestick?.bodyPatternNegative,
    bodyPatternPositive: candlestick?.bodyPatternPositive,
    fadedOpacity: candlestick?.fadedOpacity ?? DEFAULT_FADED_OPACITY,
    insideStrokeWidth: candlestick?.insideStrokeWidth ?? NO_INSIDE_STROKE_PX,
    showHoverFade: candlestick?.showHoverFade ?? true,
  }), [candlestick]);

  // Mounts collapsed (center-anchored, height 0); a later revealed flip drives the animated update diff.
  const [revealed, setRevealed] = useState(
    () => animationDuration <= NO_ANIMATION_DURATION_MS || !resolvedCandlestick.animate,
  );
  const revealSettledRef = useRef(revealed);
  const revealSpanMs = useMemo(() => {
    const enterMs =
      enterTransition?.type === "tween"
        ? ((): number => {
            const resolved = resolveEnterTransition(enterTransition, TWEEN_FALLBACK);
            return resolved.kind === "tween" ? resolved.durationMs : NO_ANIMATION_DURATION_MS;
          })()
        : Math.max(MIN_ENTER_DURATION_MS, (enterTransition?.duration ?? DEFAULT_ENTER_DURATION_SEC) * MS_PER_SECOND);
    return Math.max(enterMs, animationDuration) + REVEAL_SETTLE_GRACE_MS;
  }, [enterTransition, animationDuration]);
  useEffect((): (() => void) | undefined => {
    if (!revealed) {
      revealSettledRef.current = false;
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      revealSettledRef.current = true;
    }, revealSpanMs);
    return (): void =>{  globalThis.clearTimeout(timer); };
  }, [revealed, revealSpanMs]);

    // Legacy url(#id) strings pass through; other names render as pattern presets in this chart's defs.
  const candlePatternDefsId = useSanitizedId();
  const resolveCandlePattern = useCallback(
    (value: string | undefined, defsId: string): CandlePatternRef => {
      if (value === undefined || value === "" || value === "none") {return { href: "", preset: undefined };}
      const trimmed = value.trim();
      const urlMatch = /^url\(#[^)]+\)$/u.exec(trimmed);
      if (urlMatch) {return { href: trimmed, preset: undefined };}
      if (isCandlePatternPreset(trimmed)) {return { href: `url(#${defsId})`, preset: trimmed };}
      return { href: "", preset: undefined };
    },
    [],
  );
  const positivePattern = useMemo(
    () => resolveCandlePattern(
      resolvedCandlestick.bodyPatternPositive,
      `${candlePatternDefsId}-candle-pattern-pos`,
    ),
    [resolvedCandlestick.bodyPatternPositive, candlePatternDefsId, resolveCandlePattern],
  );
  const negativePattern = useMemo(
    () => resolveCandlePattern(
      resolvedCandlestick.bodyPatternNegative,
      `${candlePatternDefsId}-candle-pattern-neg`,
    ),
    [resolvedCandlestick.bodyPatternNegative, candlePatternDefsId, resolveCandlePattern],
  );
  // Pattern-overlay candles render wick+body in solid tokens, ignoring caller fill (bklit).
  const solidFillFor = useCallback((isPositive: boolean, hasOwnPattern: boolean) => {
    if (hasOwnPattern) {return isPositive ? PATTERN_FALLBACK_POSITIVE : PATTERN_FALLBACK_NEGATIVE;}
    return isPositive ? resolvedPositiveFill : resolvedNegativeFill;
  }, [resolvedPositiveFill, resolvedNegativeFill]);

  const timeExtent = useMemo(() => findCandleTimeExtent(renderData, xDataKey) ?? { maxTime: EMPTY_TIME_BOUND_MS, minTime: EMPTY_TIME_BOUND_MS }, [renderData, xDataKey]);

  const innerWidth = Math.max(MIN_GEOMETRY_EXTENT_PX, width - margin.left - margin.right);

  const slotWidth = useMemo(
    () => innerWidth / Math.max(renderData.length, MIN_ROW_COUNT),
    [innerWidth, renderData.length],
  );

  // Bklit parity: candleWidth = min(override ?? slotWidth*(1-candleGap), slotWidth).
  const bodyWidthPx = useMemo(() => {
    const raw = candleWidthProp ?? slotWidth * (FULL_SLOT_RATIO - candleGap);
    return Math.min(raw, slotWidth);
  }, [candleWidthProp, slotWidth, candleGap]);



  // Bklit parity: y-domain pads low/high min/max by 5% (or flat 1); nice() comes from the scale.
  const yDomain = useMemo<[number, number]>(() => {
    const extremes = findCandleYExtremes(renderData);
    if (extremes === undefined) {return [FALLBACK_Y_DOMAIN_MIN, FALLBACK_Y_DOMAIN_MAX];}
    const pad = (extremes.max - extremes.min) * Y_DOMAIN_PAD_FRACTION || FLAT_EXTENT_FALLBACK_PX;
    return [extremes.min - pad, extremes.max + pad];
  }, [renderData]);

  // Custom resolve() owns the slotWidth/2 range inset; a plain instance would lose it to re-ranging.
  const xScale = useMemo<ChartScale>(() => {
    const { minTime, maxTime } = timeExtent;
    const count = Math.max(renderData.length, MIN_ROW_COUNT);
    return {
      id: "x",
      resolve(context): ResolvedScale {
        const [r0, r1] = context.range;
        const lo = Math.min(r0, r1);
        const hi = Math.max(r0, r1);
        const localSlotWidth = Math.max(MIN_GEOMETRY_EXTENT_PX, hi - lo) / count;
        const padding = localSlotWidth / GEOMETRY_HALF_DIVISOR;
        const insetLo = lo + padding;
        const insetHi = Math.max(insetLo, hi - padding);
        const scale = scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
        const ticks = xAxis
          ? buildXAxisTickValues({
              data: renderData,
              formatValue: xAxis.formatValue,
              numTicks: xAxis.numTicks ?? DEFAULT_TICK_COUNT,
              rangeEnd: insetHi,
              rangeStart: insetLo,
              tickMode: xAxis.tickMode,
              xDataKey,
            }).map(({ value, label }: { readonly label: string; readonly value: Readonly<Date> }) => ({
              label,
              position: scale(value),
              value,
            }))
          : scale.ticks(context.tickCount).map((value: Readonly<Date>) => ({
              label: value.toISOString(),
              position: scale(value),
              value,
            }));
        return {
          bandwidth: 0,
          domain: scale.domain(),
          id: context.id,
          map: (value: unknown): number => {
            if (!(value instanceof Date)) {return Number.NaN;}
            return scale(value);
          },
          ticks,
          type: "time",
        };
      },
    };
  }, [renderData, xDataKey, timeExtent, xAxis]);

  const candlestickFocusStrategy = useMemo(
    () => createCandlestickFocusStrategy({ canInteractRef }),
    [canInteractRef],
  );

  const chartConfig = useChartConfig();
  const indicatorGradientId = useSanitizedId();

  const [labelFade, setLabelFade] = useState<{ primaryX: number; hoveredLabel: string | null } | null>(null);

  const showTargetGeometry = resolveCandleTargetGeometry(revealed, animationDuration, resolvedCandlestick.animate);

  // Update-phase delay is zeroed for springs by the engine, so per-candle stagger is dropped (lockstep).
  const candleMotion = useMemo<ChartMotionDefinition<ChartDatum>>(() => {
    const transition: ChartMotionTransition = enterTransition?.type === "tween"
      ? resolveTweenCandleTransition(enterTransition)
      : resolveSpringCandleTransition(enterTransition);
    // After the reveal settles, later rebuilds must snap or the motion surface re-tweens dim opacity.
    return (ctx: Readonly<ChartMotionContext<ChartDatum>>): false | ChartMotionTiming | undefined => ctx.phase === "enter" || revealSettledRef.current ? false : { transition };
  }, [enterTransition]);

  const definition = useMemo((): DomChartDefinition<ChartDatum, Date, number> | undefined => {
    if (width <= EMPTY_CONTAINER_PX) {return undefined;}

    const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

    const [yDomainMin, yDomainMax] = yDomain;
    const yScale = buildCandleYScale({ formatLargeNumbers: yAxis?.formatLargeNumbers, formatValue: yAxis?.formatValue, gridNumTicks: grid?.numTicks, hasYAxis: yAxis !== null, yMax: yDomainMax, yMin: yDomainMin, yNumTicks: yAxis?.numTicks });

    const marks = buildCandleDefinitionMarks({ bodyWidthPx, candleMotion, discrete, fadedOpacity: resolvedCandlestick.fadedOpacity, indicatorGradientId, insideStrokeW: resolvedCandlestick.insideStrokeWidth, legendHoveredIndex, negativePattern, positivePattern, showHoverFade: resolvedCandlestick.showHoverFade, showTargetGeometry, solidFillFor, source: renderData, tooltip, tooltipSpring: chartConfig.tooltipSpring, xDataKey });
    const gridGuide = resolveGridGuide(grid);

    const tooltipOption = buildCandleTooltipOption({ discrete, tooltipEnabled });

    return defineChart({
      focus: candlestickFocusStrategy,
      focusRing: false,
      margin,
      marks,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: {
        x: {
          axis: buildFadeXAxisOptions({
            columnTicks: gridGuide.columnTicks,
            labelFade,
            marginBottom: margin.bottom,
            xAxis: xAxis ?? undefined,
          }),
          grid: gridGuide.vertical,
          scale: xScale,
        },
        y: {
          axis: {
            line: false,
            tickLabels: yAxis ? { dx: -8, fontSize: 12, opacity: 1, thin: false } : false,
            ticks: { count: gridGuide.ticks, padding: 0, size: 0 },
          },
          grid: gridGuide.horizontal,
          scale: yScale,
        },
      },
      // Candle data updates snap, never tween (tween-on-update is Line-only).
      svgAnimation: false,
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: tooltipOption,
    });
  }, [
    renderData,
    xDataKey,
    xScale,
    yDomain,
    bodyWidthPx,
    positivePattern,
    negativePattern,
    solidFillFor,
    resolvedCandlestick.insideStrokeWidth,
    tooltipEnabled,
    resolvedCandlestick.fadedOpacity,
    resolvedCandlestick.showHoverFade,
    legendHoveredIndex,
    grid,
    width,
    margin,
    candlestickFocusStrategy,
    tooltip,
    chartConfig,
    indicatorGradientId,
    xAxis,
    yAxis,
    labelFade,
    showTargetGeometry,
    candleMotion,
  ]);

  // Reveal deps are exactly [animationDuration, revealSignature] — data-only updates never replay.
  useEffect(() => runCandleRevealCycle({ animationDuration, canInteractRef, revealDeadlineTimerRef, revealEpochRef, setRevealed, signature: revealSignature }), [animationDuration, revealSignature]);


  const chromeStateRef = useRef<CandlestickChromeState | null>(null);
  // Drag selection suppresses pill/label-fade chrome (native marks keep reacting).
  const dragSelectionActiveRef = useRef(false);
  const dateLabelsForPill = useMemo(() => renderData.map((datum: Readonly<ChartDatum>) => {
    const value = datum[xDataKey];
    if (value instanceof Date) {return shortDateFmt.format(value);}
    if (isString(value)) {return value;}
    if (isNumber(value) || value === true || value === false) {return String(value);}
    return "";
  }), [renderData, xDataKey]);
  // Latest-chrome sync runs post-commit so the render body stays pure.
  useEffect(() => {
    chromeStateRef.current = {
      dateLabels: dateLabelsForPill,
      tooltip: tooltip ?? undefined,
    };
  }, [dateLabelsForPill, tooltip]);

  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > EMPTY_CONTAINER_PX;

  const pillRef = useRef<PillBuild | null>(null);
  // First pill show jumps; later moves spring (mirrors legacy showing flag).
  const pillVisibleRef = useRef(false);

  useLayoutEffect((): (() => void) | undefined => {
    const el = overlayHostRef.current;
    // The overlay host mounts only under the chart definition (width > 0).
    if (!hasDefinition || !el || !tooltipEnabled) {return undefined;}
    const doc = el.ownerDocument;
    const pillBuild = buildPill(doc, chartConfig.tooltipSpring, () => chromeStateRef.current?.dateLabels ?? []);
    el.append(pillBuild.layer);
    pillRef.current = pillBuild;
    return (): void => {
      pillRef.current = null;
      pillVisibleRef.current = false;
      pillBuild.spring.stop();
      pillBuild.ticker?.detach();
      pillBuild.layer.remove();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig]);


  const hidePill = useCallback(() => {
    pillVisibleRef.current = false;
    const pillBuild = pillRef.current;
    if (pillBuild) {
      pillBuild.layer.style.display = "none";
      pillBuild.spring.stop();
      pillBuild.label.textContent = "";
    }
    // Nullable labelFade state is read by buildFadeXAxisOptions; clearing it means null,
    // Returning prev when already cleared keeps React from scheduling a no-op render.
    setLabelFade((prev: Readonly<{ primaryX: number; hoveredLabel: string | null }> | null) => (prev === null ? prev : null));
  }, []);

  const handleFocusGroupChange = useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      if (dragSelectionActiveRef.current || points.length === EMPTY_COUNT) {
        hidePill();
        return;
      }
      const pillBuild = pillRef.current;
      const [primary] = points;
      updateCandlePill({ centerX: primary.x, dateLabels: chromeStateRef.current?.dateLabels, formattedDate: shortDateFmt.format(primary.xValue), pillBuild, pillVisibleRef, rowCount: renderData.length, showDatePill: tooltipEnabled && (tooltip?.showDatePill ?? true), tickerIndex: primary.datumIndex });
      // HoveredLabel uses the same formatter as the axis ticks or the fade text-match misses.
      const hoveredLabel = xAxis?.formatValue ? xAxis.formatValue(primary.xValue) : shortDateFmt.format(primary.xValue);
      updateCandleLabelFade({ centerX: primary.x, hoveredLabel, setLabelFade });
    },
    [hidePill, renderData.length, tooltipEnabled, tooltip, xAxis],
  );

  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode => {
      const model = resolveCandleTooltipModel(ctx, chromeStateRef.current);
      if (model === undefined) {return undefined;}
      const { tt, date, close, pointRec } = model;
      const rows: TooltipRow[] = tt?.rows ? tt.rows(pointRec) : buildDefaultCandleCloseRow(close);
      const panel = resolveCandleTooltipPanel(tt);
      if (tt?.content) {
        return (
          <div className={panel.className} style={panel.style}>
            {tt.content({ index: 0, point: pointRec })}
          </div>
        );
      }
      const title = weekdayDateFmt.format(date);
      return (
        <div className={panel.className} style={panel.style}>
          <TooltipContent title={title} rows={rows}>
            {tt?.children}
          </TooltipContent>
        </div>
      );
    },
    [],
  );

  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
  }, [captureRenderContext]);

  const refAreaChildrenCandle = useMemo(() => extractReferenceAreaProps(children), [children]);
  const segChildrenCandle = useMemo(() => extractSegmentComponents(children), [children]);
  const heightPxCandle = width > EMPTY_CONTAINER_PX ? width / parseAspectRatio(aspectRatio) : COLLAPSED_GEOMETRY_PX;
  const timeExtentCandle = useMemo(() => findCandleTimeExtent(renderData, xDataKey), [renderData, xDataKey]);
  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const invertSceneXCandle = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? undefined,
    [sceneRef],
  );
  const { selection: candleSelection } = useChartSelection({
    containerRef,
    data: renderData,
    enabled: true,
    innerWidth,
    invertSceneX: invertSceneXCandle,
    marginLeft: margin.left,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      hidePill();
    },
    resolveScenePos: clientToScene,
    xDataKey,
  });

  // UserSpaceOnUse required: the crosshair is a zero-bbox line with nothing to map onto.
  const crosshairFadeGradient = useMemo((): { readonly color: string; readonly id: string; readonly stops: IndicatorFadeGradientStop[] } | undefined => {
    if (!tooltipEnabled || !(tooltip?.showCrosshair ?? true)) {return undefined;}
    const indicatorCfg = toIndicatorConfig(tooltip);
    if (indicatorCfg.dasharray !== undefined && indicatorCfg.dasharray !== "") {return undefined;}
    const fadeSides = resolveVerticalFadeSides(indicatorCfg.fadeEdges ?? "both");
    if (!fadeSides.any) {return undefined;}
    const colorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
    return {
      color: colorValue,
      id: indicatorGradientId,
      stops: indicatorFadeGradientStops(fadeSides, indicatorCfg.fadeLength ?? DEFAULT_INDICATOR_FADE_LENGTH),
    };
  }, [tooltipEnabled, tooltip, indicatorGradientId]);
  const candlestickChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  // Hoisted out of the definition JSX below so no single expression stacks conditionals.
  const containerStyle = useMemo((): CSSProperties => ({
    aspectRatio,
    isolation: "isolate",
    position: "relative",
    width: "100%",
    ...style,
  }), [aspectRatio, style]);
  const positivePatternLayer = positivePattern.preset ? (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>{renderPatternPreset(positivePattern.preset, `${candlePatternDefsId}-candle-pattern-pos`, {})}</defs>
    </svg>
  ) : undefined;
  const negativePatternLayer = negativePattern.preset ? (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>{renderPatternPreset(negativePattern.preset, `${candlePatternDefsId}-candle-pattern-neg`, {})}</defs>
    </svg>
  ) : undefined;
  const enabledRenderTooltipBody = tooltipEnabled ? renderTooltipBody : undefined;
  const referenceAreaGeomCandle = useMemo((): ReferenceAreaLayersGeom => ({
    height: heightPxCandle,
    isCandlestickXScale: true,
    isTimeScale: true,
    margin,
    width,
    xDomain: timeExtentCandle ? [new Date(timeExtentCandle.minTime), new Date(timeExtentCandle.maxTime)] : undefined,
    yDomain,
  }), [heightPxCandle, margin, timeExtentCandle, width, yDomain]);
  const referenceAreaLayer = heightPxCandle > EMPTY_CONTAINER_PX ? (
    <ReferenceAreaLayers
      configs={refAreaChildrenCandle}
      geom={referenceAreaGeomCandle}
    />
  ) : undefined;
  const pillOverlayLayer = tooltipEnabled ? (
    <div
      ref={overlayHostRef}
      style={PILL_OVERLAY_STYLE}
    />
  ) : undefined;

  // Hoisted so the returned tree stays shallow (variables inline into the same element tree).
  const definitionContentNode = definition ? (
    <>
      {positivePatternLayer}
      {negativePatternLayer}
      <RendererChart
        ariaLabel="Candlestick chart"
        aspectRatio={parseAspectRatio(aspectRatio)}
        definition={definition}
        renderer={candlestickChartRenderer}
        onFocusGroupChange={handleFocusGroupChange}
        onRender={handleRender}
        renderTooltipBody={enabledRenderTooltipBody}
      />
      {referenceAreaLayer}
      <SegmentOverlay
        selection={candleSelection}
        innerWidth={innerWidth}
        innerHeight={heightPxCandle - margin.top - margin.bottom}
        marginLeft={margin.left}
        marginTop={margin.top}
        components={segChildrenCandle}
      />
      {pillOverlayLayer}
    </>
  ) : undefined;
  const crosshairLayerNode = crosshairFadeGradient ? (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient
          id={crosshairFadeGradient.id}
          gradientUnits="userSpaceOnUse"
          x1={0}
          x2={0}
          y1={margin.top}
          y2={margin.top + Math.max(MIN_GEOMETRY_EXTENT_PX, heightPxCandle - margin.top - margin.bottom)}
        >
          {crosshairFadeGradient.stops.map((stop: { readonly offset: string; readonly opacity: number }) => renderCandleCrosshairStop(stop, crosshairFadeGradient.color))}
        </linearGradient>
      </defs>
    </svg>
  ) : undefined;

  return (
    <ChartSelectionContext.Provider value={candleSelection}>
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="candlestick"
    >
      {background ? (
        <BackgroundLayer
          config={background}
          innerWidth={innerWidth}
          innerHeight={Math.max(MIN_GEOMETRY_EXTENT_PX, heightPxCandle - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
        />
      ) : undefined}
      {definitionContentNode}
      {crosshairLayerNode}
    </div>
    </ChartSelectionContext.Provider>
  );
};

export { CandlestickChart };
export type { CandlestickEnterTransition } from './internal/enter-transition';
export type { CandlestickChartProps };
