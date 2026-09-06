// Candlestick marks: enter transitions, wick/body/hover marks, and the mark assembly.
import { createMark } from "@tanstack/charts";
import type {
  ChartMark,
  ChartMarkState,
  ChartMotionDefinition,
  ChartMotionTransition,
  MarkScene,
} from "@tanstack/charts";
import { whenFocused } from "@tanstack/charts/focus/mark";
import { toDotConfig, toIndicatorConfig } from "./tooltip-mappers";
import type { DotConfig, TooltipMapperSource } from "./tooltip-mappers";
import { findSpringStiffnessDamping } from "./candle-spring";
import { resolveMotionEasing } from "./reveal-easing";
import { resolveEnterTransition, TWEEN_FALLBACK } from "./enter-transition";
import type { CandlestickEnterTransition } from "./enter-transition";
import { buildIndicatorMark, formatShortDateLabel } from "./focus-marks";
import { indicatorFadeGradientStops, resolveVerticalFadeSides } from "./fade-mask";
import type { IndicatorFadeGradientStop } from "./fade-mask";
import type { SpringConfig } from "./chart-config-context";
import type { ChartDatum } from "./types";
import {
  collectCandleHighlightChannels,
  collectCandleHoverDotChannels,
  HOVER_HIGHLIGHT_MARK_ID,
  renderCandleBodiesScene,
  renderCandleHighlightScene,
  renderCandleHoverDotScene,
  renderCandleWicksScene,
} from "./candlestick-chart-scenes";
import {
  DEFAULT_ENTER_DURATION_SEC,
  EMPTY_COUNT,
  MIN_ENTER_DURATION_MS,
  MS_PER_SECOND,
  NO_ANIMATION_DURATION_MS,
  isNumber,
  isString,
} from "./candlestick-chart-shared";
import type { CandlePatternRef } from "./candlestick-chart-shared";

// Bklit parity: enter bounce pairs with the default enter duration (bklit).
const DEFAULT_ENTER_BOUNCE = 0.15;
// Plain-dot hover mark defaults (only ring reads dotSize/scale/strokeWidth).
const DEFAULT_HOVER_DOT_SIZE = 5;
const DEFAULT_HOVER_DOT_STROKE_WIDTH = 1.5;
const LEGEND_POSITIVE_INDEX = 0;
const LEGEND_NEGATIVE_INDEX = 1;
const PLAIN_HOVER_DOT_STROKE_WIDTH = 2;
const DEFAULT_DOT_SCALE = 1;
// Bklit parity default for the crosshair fade length.
const DEFAULT_INDICATOR_FADE_LENGTH = 10;

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

interface CandleHoverDotMarkParams {
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly dotCfg: Readonly<DotConfig>;
  readonly tooltipSpring: Readonly<SpringConfig>;
}

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
    xLabelFormat: (tooltip?.showDatePill ?? true) ? formatShortDateLabel : undefined,
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

interface CandleCrosshairFadeGradientParams {
  readonly indicatorGradientId: string;
  readonly tooltip: Readonly<TooltipMapperSource> | null | undefined;
  readonly tooltipEnabled: boolean;
}

interface CandleCrosshairFadeGradient {
  readonly color: string;
  readonly id: string;
  readonly stops: IndicatorFadeGradientStop[];
}

/**
 * Resolves the crosshair fade gradient for the defs layer (render-memo time).
 *
 * @param {Readonly<CandleCrosshairFadeGradientParams>} params - Tooltip inputs and the gradient id.
 * @returns {CandleCrosshairFadeGradient | undefined} Gradient spec, or undefined when no fade applies.
 */
const buildCandleCrosshairFadeGradient = (params: Readonly<CandleCrosshairFadeGradientParams>): CandleCrosshairFadeGradient | undefined => {
  const { indicatorGradientId, tooltip, tooltipEnabled } = params;
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
};

export {
  buildCandleCrosshairFadeGradient,
  buildCandleDefinitionMarks,
  resolveSpringCandleTransition,
  resolveTweenCandleTransition,
};
