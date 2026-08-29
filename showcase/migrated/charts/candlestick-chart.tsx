// Migrated bklit-ui CandlestickChart — same public API, rendered by TanStack
// Charts. Architecture: TWO custom `createMark` marks (wicks + bodies) over
// raw, non-decimated data (D19: bklit's own `decimateOhlcData` is dead code).
// D82.1 redo (stock `link()` marks) REVERTED in D85.1: `<line>` rendering with
// hardcoded `lineCap:'round'` cannot match bklit's `<rect>` fills at both n=100
// and n=1000 simultaneously (round caps protrude beyond flat rect ends;
// crispEdges artifacts at tiny bodyWidthPx). Custom marks are genuinely
// justified per PLAN 1.2, same precedent as Composed D82.2/D83 barY.
//
// Unlike Line/Area/Bar/Scatter, bklit's own CandlestickChart takes NO
// `onPhaseChange`/`status` props (verified by reading
// repos/bklit-ui/packages/ui/src/charts/candlestick-chart.tsx directly) — it
// keeps its reveal-completion entirely internal, observable only via a flat
// `setTimeout(animationDuration)`. This component mirrors that: no phase
// callback exists here either.
//
// Reveal (bklit candlestick.tsx AnimatedCandle, framer spring): ported onto
// WAAPI via `candle-spring.ts` (verbatim duration/bounce -> stiffness/damping
// conversion, sampled once into a shared keyframe array reused by every
// candle) — see `handleRender` below. bklit's reveal effect deps are
// `[animationDuration, revealSignature]`, NOT `data` (verified directly) —
// reproduced here via a DOM dataset guard on `.ts-chart__marks` (the element
// is destroyed/recreated on strict-mode remount, so it naturally resets).
// on exactly those two deps, so data-only updates always SNAP and never
// replay the reveal.
//
// Hover chrome: TanStack-native ChartFocusStrategy (`internal/candlestick-focus-strategy.ts`
// `bisectDateLeft`/`resolveNearestIndex` strict `>` tie-break over ChartPoint.xValue epoch ms)
// drives native crosshair/hover-dot/highlight marks (built inside
// `definition`, C3) directly — plus a thin `<Chart onFocusGroupChange>`
// adapter that only drives the app-owned date-pill + axis-label fade
// (`internal/date-pill.ts`, C3), no native pointermove/bisect listener.
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { Chart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { crosshair, defineChart, createMark, whenFocused } from "@tanstack/charts";
import { tooltip as tooltipExtension } from "@tanstack/charts/tooltip";
import type { ChartMark, ChartMarkState, ChartMotionDefinition, ChartPoint, ChartRenderContext, ChartScale, SceneNode } from "@tanstack/charts";
import { extractChildren } from "./children";
import { TooltipContent } from "./internal/tooltip-components";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, FADE_BUFFER, TICKER_HALF_WIDTH, TOOLTIP_BOX_SPRING } from "./internal/design-tokens";
import { applyLabelFade, buildPill, resetLabelFade, type PillBuild } from "./internal/date-pill";
import { resolveVerticalFadeSides, indicatorFadeGradientStops } from "./internal/fade-mask";
import { resolveIndicatorPixelWidth, toDotConfig, toIndicatorConfig, type DotConfig } from "./internal/tooltip-mappers";
import { sampleSpringKeyframes } from "./internal/candle-spring";
import {
  buildProgressKeyframes,
  resolveEnterTransition,
  revealTiming,
  TWEEN_FALLBACK,
  type CandlestickEnterTransition,
} from "./internal/enter-transition";
import { isRevealed, markRevealed, onPostPaint } from "./internal/deferred-reveal";
import { nativeStaggerDelayMs } from "./internal/native-stagger";
import { resolveGridGuide } from "./internal/grid";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import {
  ChartSelectionContext,
  extractSegmentComponents,
  useChartSelection,
} from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import { useChartConfig } from "./internal/chart-config-context";
import type { SpringConfig } from "./internal/chart-config-context";
import { renderPatternPreset } from "./internal/pattern-preset";
import type { PatternPresetId } from "./internal/pattern-preset";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import { YAxisOverlay } from "./internal/y-axis-overlay";
import { resolveYAxisTickCount } from "./internal/y-axis-ticks";
import type { ChartDatum, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { createCandlestickFocusStrategy } from "./internal/candlestick-focus-strategy";
import { useChartMargin, DEFAULT_CHART_MARGIN, useContainerWidth, type ChartMargin } from "./internal";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { useFocusInjection, whenSeriesDimmed } from "./internal/focus-injection";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { DEFAULT_ANIMATION_DURATION_MS } from "./internal/animation-defaults";
import "./styles.css";
// bklit candlestick.tsx SOLID_POSITIVE/SOLID_NEGATIVE.
const SOLID_POSITIVE = "var(--color-emerald-500)";
const SOLID_NEGATIVE = "var(--color-red-500)";
// bklit candlestick.tsx WICK_WIDTH (rect width, ported as-is).
const WICK_WIDTH_PX = 1.5;
// bklit candlestick.tsx defaultEnter: { type: "spring", duration: 0.8 (sec),
// bounce: 0.15 }.
const DEFAULT_ENTER_DURATION_SEC = 0.8;
const DEFAULT_ENTER_BOUNCE = 0.15;
// bklit candlestick.tsx AnimatedCandle: opacity always tweens over a fixed,
// undelayed 150ms regardless of the (staggered) scaleY spring.
const OPACITY_TWEEN_MS = 150;
// bklit candlestick.tsx getSolidColor: when a body pattern overlay is set,
// the body+wick fall back to these solid tokens (not the caller's fills).
const PATTERN_FALLBACK_POSITIVE = SOLID_POSITIVE;
const PATTERN_FALLBACK_NEGATIVE = SOLID_NEGATIVE;

// C1: native mark-state dim — value verified against the legacy per-candle
// `geometryDimOpacity` (bklit candlestick.tsx:110-126) and the migrated
// `candlestick-hover-chrome.ts` `DIM_TRANSITION` (now deleted): 150ms
// ease-in-out.
const CANDLE_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  type: "tween",
  duration: 150,
  easing: "ease-in-out",
};

/** Legend (series) dim + optional pointer-hover blanket dim, applied to both
 * the wicks and bodies marks. Legend dim is per-candle, keyed off each
 * candle's `positive`/`negative` group identity (`whenSeriesDimmed()` —
 * dataKey/group match, bklit candlestick.tsx:116-121's per-candle
 * `isPositive` branch). Pointer-hover dim (bklit's `showHoverFade` prop,
 * candlestick.tsx:122-124) is a BLANKET dim across every candle whenever any
 * point has pointer focus — not row-selective — because the actual
 * per-candle "which one is hovered" distinction is drawn on top via the
 * separate highlight mark (C3: `createCandlestickHighlightMark` below —
 * formerly the deleted `candlestick-hover-chrome.ts`'s imperative
 * `activeHighlightSvg`). */
function candlestickDimStates(fadedOpacity: number, showHoverFade: boolean): ChartMarkState<ChartDatum>[] {
  const states: ChartMarkState<ChartDatum>[] = [
    { when: whenSeriesDimmed(), style: { opacity: fadedOpacity }, transition: CANDLE_DIM_TRANSITION },
  ];
  if (showHoverFade) {
    states.push({
      when: (context) => context.focus.source === "pointer",
      style: { opacity: fadedOpacity },
      transition: CANDLE_DIM_TRANSITION,
    });
  }
  return states;
}

// C3: what's left of the deleted candlestick-hover-chrome.ts's
// `CandlestickHoverChromeState` after crosshair/dots/highlight moved to
// native marks — just what the date-pill mount effect and
// `renderTooltipBody` still need at call time.
interface CandlestickChromeState {
  tooltip: ChartTooltipConfig | null;
  dateLabels: string[];
}

// C3: static color resolution for the native per-candle hover-dot mark —
// preserves the deleted candlestick-hover-chrome.ts's `dotColor` precedence
// verbatim, INCLUDING its function branch. Unlike bar-hover-chrome.ts's own
// `dotColor` (dead code — bar's chrome never actually called it as a
// function with real per-point data), candlestick-hover-chrome.ts:207-214
// GENUINELY invoked `tooltip.dotColor(point, line)` with the real
// `{date, close}` on every hover-move. Reproduced here as a per-candle
// PRECOMPUTE (invoked once per candle at mark-build time, not once per
// hover-frame — the function is pure over its point/line args, so this is
// observationally identical): a hand-rolled `ChartMark` (unlike native
// `dot()`, whose `fill` is one static string per mark, dist/dot.d.ts) can
// carry a distinct `style.fill` per emitted SceneNode, exactly like
// scatter-chart.tsx's own `resolveDotColor`/`createHoverDotMark` precedent.
function resolveCandleDotColor(
  color: DotConfig["color"],
  date: Date,
  close: number,
): string {
  if (color) {
    if (typeof color === "function") {
      return color({ date, close } as Record<string, unknown>, { dataKey: "close" });
    }
    return color;
  }
  return "var(--chart-line-primary)";
}

/**
 * C3: replaces candlestick-hover-chrome.ts's DOM `dot` circle (ensureDot-
 * style single-element update) with a hand-built ChartMark emitting one
 * `dot`-kind SceneNode per candle, wrapped by the caller in
 * `whenFocused(mark, {match:'group', retarget:true})` so exactly the
 * currently-focused candle's dot renders.
 *
 * Two chart-specific quirks preserved verbatim from candlestick-hover-
 * chrome.ts's `update()` (lines 207-224):
 *  - The PLAIN (non-ring) dot's radius/stroke-width stay HARDCODED at their
 *    initial `<circle r="5" stroke-width="2">` creation values and are
 *    NEVER re-read from `dotSize`/`dotScale`/`dotStrokeWidth` — only the
 *    RING branch reads those config fields.
 *  - The ring variant stays a hollow CIRCLE (fill:transparent,
 *    stroke:color), not a rounded rect like bar/scatter's own ring dots —
 *    legacy's ring conversion only flipped the SAME `<circle>` element's
 *    fill/stroke, it never swapped to a `<rect>`.
 */
function createCandlestickHoverDotMark(
  source: readonly ChartDatum[],
  xDataKey: string,
  dotCfg: DotConfig,
  tooltipSpring: SpringConfig,
): ChartMark<ChartDatum, Date, number> {
  const isRing = (dotCfg.variant ?? "dot") === "ring";
  const size = isRing ? (dotCfg.size ?? 5) * (dotCfg.scale ?? 1) : 5;
  const strokeWidth = isRing ? (dotCfg.strokeWidth ?? 1.5) : 2;
  // Legacy's dot spring is NEVER gated on `discrete` (candlestick-hover-
  // chrome.ts comment: "Dot always springs (bklit ChartTooltip never passes
  // discrete to TooltipDot)"), same unconditional-motion precedent as bar's
  // own `createBarHoverDotMark`.
  const motion: ChartMotionDefinition<ChartDatum> = {
    transition: { type: "spring", stiffness: tooltipSpring.stiffness, damping: tooltipSpring.damping },
  };
  return {
    initialize: () => {
      const xValues: (Date | undefined)[] = [];
      const closeValues: (number | undefined)[] = [];
      for (const d of source) {
        xValues.push(d[xDataKey] as Date);
        const close = d.close as number | undefined;
        closeValues.push(typeof close === "number" && Number.isFinite(close) ? close : undefined);
      }
      return {
        id: "hover-dot",
        motion,
        channels: {
          x: { scale: "x", values: xValues },
          y: { scale: "y", values: closeValues },
        },
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          source.forEach((datum, datumIndex) => {
            const date = xValues[datumIndex];
            const close = closeValues[datumIndex];
            if (date === undefined || close === undefined) return;
            const x = scales.x.map(date);
            const y = scales.y.map(close);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const fill = resolveCandleDotColor(dotCfg.color, date, close);
            const point: ChartPoint<ChartDatum, Date, number> = {
              key: `hover-dot:${datumIndex}`,
              markId: "hover-dot",
              group: null,
              groupLabel: "hover-dot",
              datum,
              datumIndex,
              xValue: date,
              yValue: close,
              x,
              y,
              color: fill,
            };
            nodes.push({
              kind: "dot",
              key: `hover-dot:${datumIndex}`,
              x,
              y,
              radius: size,
              style: isRing
                ? { fill: "transparent", stroke: fill, strokeWidth }
                : { fill, stroke: "var(--chart-background)", strokeWidth },
              pointOwner: point,
            });
            points.push(point);
          });
          return {
            nodes: [
              { kind: "group", key: "hover-dot", className: "ts-chart__hover-dot", ariaHidden: true, children: nodes },
            ],
            points,
          };
        },
      };
    },
  };
}

/**
 * C3: replaces candlestick-hover-chrome.ts's `activeHighlightSvg` (unconditional
 * undimmed redraw of the hovered candle's wick+body, painted ON TOP of the
 * blanket pointer-dim from `candlestickDimStates` above) with a hand-built
 * ChartMark that mirrors `wicksMark`/`bodiesMark`'s own geometry exactly —
 * same wick rect, same body rect (+ optional K9 pattern overlay / K10 inset
 * stroke), just with no dim `states` of its own. All SceneNodes for one
 * candle share a single `pointOwner` so `whenFocused(..., {match:'group'})`
 * reveals/hides them together. No `motion`: legacy's `applyRectGeometry`
 * never sprang the highlight rects (only the crosshair/dot/pill did) — this
 * mark snaps to the newly-focused candle exactly like legacy did.
 */
function createCandlestickHighlightMark(
  source: readonly ChartDatum[],
  xDataKey: string,
  bodyWidthPx: number,
  insideStrokeW: number,
  positivePattern: { href: string; preset: PatternPresetId | null },
  negativePattern: { href: string; preset: PatternPresetId | null },
  solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string,
): ChartMark<ChartDatum, Date, number> {
  return {
    initialize: () => {
      const xValues = source.map((d) => d[xDataKey] as Date);
      const lowValues = source.map((d) => d.low as number | undefined);
      const highValues = source.map((d) => d.high as number | undefined);
      const openValues = source.map((d) => d.open as number | undefined);
      const closeValues = source.map((d) => d.close as number | undefined);
      return {
        id: "hover-highlight",
        channels: {
          x: { scale: "x", values: xValues },
          y: {
            scale: "y",
            values: ([] as number[]).concat(
              lowValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
              highValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
              openValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
              closeValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
            ),
          },
        },
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          for (let i = 0; i < source.length; i++) {
            const d = source[i]!;
            const date = xValues[i]!;
            const low = lowValues[i];
            const high = highValues[i];
            const open = openValues[i];
            const close = closeValues[i];
            if (
              typeof low !== "number" || typeof high !== "number" ||
              typeof open !== "number" || typeof close !== "number" ||
              !Number.isFinite(low) || !Number.isFinite(high) ||
              !Number.isFinite(open) || !Number.isFinite(close)
            ) continue;
            const cx = scales.x.map(date);
            const yLow = scales.y.map(low);
            const yHigh = scales.y.map(high);
            const yOpen = scales.y.map(open);
            const yClose = scales.y.map(close);
            if (
              !Number.isFinite(cx) || !Number.isFinite(yLow) || !Number.isFinite(yHigh) ||
              !Number.isFinite(yOpen) || !Number.isFinite(yClose)
            ) continue;
            const isPositive = close >= open;
            const candlePattern = isPositive ? positivePattern : negativePattern;
            const hasOwnPattern = Boolean(candlePattern.href);
            const fill = solidFillFor(isPositive, hasOwnPattern);
            const key = `hover-highlight:${i}`;
            const point: ChartPoint<ChartDatum, Date, number> = {
              key, markId: "hover-highlight", group: null, groupLabel: "hover-highlight",
              datum: d, datumIndex: i, xValue: date, yValue: close,
              x: cx, y: yClose, color: fill,
            };
            // Wick — mirrors wicksMark geometry exactly.
            nodes.push({
              kind: "rect",
              key: `${key}:wick`,
              x: cx - WICK_WIDTH_PX / 2,
              y: Math.min(yLow, yHigh),
              width: WICK_WIDTH_PX,
              height: Math.abs(yHigh - yLow) || 1,
              style: { fill },
              pointOwner: point,
            });
            const bodyX = cx - bodyWidthPx / 2;
            const bodyY = Math.min(yOpen, yClose);
            const bodyHeight = Math.abs(yClose - yOpen) || 1;
            // Body — mirrors bodiesMark's solid rect (self-stroke).
            nodes.push({
              kind: "rect",
              key: `${key}:body`,
              x: bodyX,
              y: bodyY,
              width: bodyWidthPx,
              height: bodyHeight,
              radius: 1,
              style: { fill, stroke: fill, strokeWidth: 1 },
              pointOwner: point,
            });
            // K9: pattern overlay, same geometry/rx, no self-stroke.
            if (hasOwnPattern) {
              nodes.push({
                kind: "rect",
                key: `${key}:body-pattern`,
                x: bodyX,
                y: bodyY,
                width: bodyWidthPx,
                height: bodyHeight,
                radius: 1,
                style: { fill: candlePattern.href },
                pointOwner: point,
              });
            }
            // K10: inset stroke rect.
            if (insideStrokeW > 0) {
              nodes.push({
                kind: "rect",
                key: `${key}:body-stroke`,
                x: bodyX + insideStrokeW / 2,
                y: bodyY + insideStrokeW / 2,
                width: bodyWidthPx - insideStrokeW,
                height: bodyHeight - insideStrokeW,
                radius: 1,
                style: { fill: "none", stroke: fill, strokeWidth: insideStrokeW },
                pointOwner: point,
              });
            }
            points.push(point);
          }
          return {
            nodes: [
              { kind: "group", key: "hover-highlight", className: "ts-chart__candle-highlight", ariaHidden: true, children: nodes },
            ],
            points,
          };
        },
      };
    },
  };
}

// P5.5 K4 — this file used to declare its own spring-only
// `{ duration?, bounce? }` type behind a comment claiming "bklit
// CandlestickProps has no `enterTransition` prop at all". That claim is
// FALSE: bklit types `enterTransition?: Transition` at
// `candlestick-chart.tsx:54,84` and hands it straight to framer
// (`candlestick.tsx:239,400`), so a caller could always configure a TWEEN
// there — migrated's narrow type silently coerced every such caller into a
// spring. That is DOC-7's one named exception (a real regression, not an
// accepted simplification), so the type is now the shared `EnterTransition`,
// re-exported under its old name to keep the public API identical.
export type { CandlestickEnterTransition };

export interface CandlestickChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  margin?: Partial<ChartMargin>;
  animationDuration?: number;
  enterTransition?: CandlestickEnterTransition;
  /** Changing this value re-arms the reveal (same deps as bklit's own
      `[animationDuration, revealSignature]` effect) without needing a
      remount. */
  revealSignature?: unknown;
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
  /** bklit candlestick-chart.tsx candleGap default: 0.2. */
  candleGap?: number;
  /** Explicit constant candle body width in px (overrides the
      slotWidth*(1-candleGap) default, still capped at slotWidth). */
  candleWidth?: number;
  children?: React.ReactNode;
}


export function CandlestickChart({
  data,
  xDataKey = "date",
  margin: marginProp,
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  className,
  style,
  candleGap = 0.2,
  candleWidth: candleWidthProp,
  children,
}: CandlestickChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);

  // No `onPhaseChange`/`status` (bklit parity, verified — see header). Hover
  // is gated by a plain boolean ref instead of the full ChartPhase union.
  const canInteractRef = React.useRef(false);
  const revealEpochRef = React.useRef(0);
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const revealPostPaintCancelRef = React.useRef<(() => void) | null>(null);
  // Tracks `<rect>` elements driven by the static `ts-candle-reveal`
  // CSS-animation fast path. Cleared inline at the deadline epoch by
  // removing `animation-name` on each element — avoids the D25
  // `getAnimations()` quadratic trap (see original comment, still applies).
  const revealCssElementsRef = React.useRef<SVGRectElement[]>([]);
  // K10: inset-stroke rects held hidden through the reveal; flipped in at
  // the flat animationDuration deadline (legacy pops them in with isLoaded).
  const revealStrokeRectsRef = React.useRef<SVGRectElement[]>([]);

  // canInteract gate for the TanStack focus strategy (mirrors bklit
  // ChartProvider ready check — plain boolean, not ChartPhase).

  const { candlestick, grid, xAxis, yAxis, background, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );
  // C2: hoisted above `definition` so native `tooltip` extension wiring can
  // read it inside the same memo that builds the marks/scales spec.
  const tooltipEnabled = tooltip?.enabled ?? false;

  // bklit candlestick-chart.tsx: no decimation (D19 — `decimateOhlcData` is
  // dead code) — every raw candle is rendered, same as the benchmark
  // comparison must.
  const renderData = data;
  // Reveal replay guard by DATA identity: the `bkmRevealed` DOM stamp dies
  // whenever TanStack recreates the marks group. C1: legend hover no longer
  // remounts the marks (dim moved to native `states`, evaluated against
  // focus state rather than baked into render output), so this guard is
  // simpler than it once was — data-change recreation is the only replay
  // trigger left, matching bklit's reveal being state-keyed (D218).
  const latestRenderDataRef = React.useRef(renderData);
  latestRenderDataRef.current = renderData;
  const revealedForDataRef = React.useRef<unknown>(null);

  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext, focusSeries, clearFocus } = useFocusInjection();

  const resolvedPositiveFill = candlestick?.positiveFill ?? SOLID_POSITIVE;
  const resolvedNegativeFill = candlestick?.negativeFill ?? SOLID_NEGATIVE;

  const resolvedCandlestick = React.useMemo(() => ({
    bodyPatternPositive: candlestick?.bodyPatternPositive,
    bodyPatternNegative: candlestick?.bodyPatternNegative,
    insideStrokeWidth: candlestick?.insideStrokeWidth ?? 0,
    fadedOpacity: candlestick?.fadedOpacity ?? 0.3,
    showHoverFade: candlestick?.showHoverFade ?? true,
    animate: candlestick?.animate ?? true,
  }), [candlestick]);

  // K9: body patterns resolve two ways — a legacy-style `url(#id)` string is
  // passed through verbatim (caller-authored defs), anything else is treated
  // as a pattern-preset name rendered into this chart's own <defs>.
  const candlePatternDefsId = useSanitizedId();
  const resolveCandlePattern = React.useCallback(
    (value: string | undefined, defsId: string): { href: string; preset: PatternPresetId | null } => {
      if (!value || value === "none") return { href: "", preset: null };
      const urlMatch = /^url\(#([^)]+)\)$/.exec(value.trim());
      if (urlMatch) return { href: value.trim(), preset: null };
      return { href: `url(#${defsId})`, preset: value as PatternPresetId };
    },
    [],
  );
  const positivePattern = React.useMemo(
    () => resolveCandlePattern(
      resolvedCandlestick.bodyPatternPositive,
      `${candlePatternDefsId}-candle-pattern-pos`,
    ),
    [resolvedCandlestick.bodyPatternPositive, candlePatternDefsId, resolveCandlePattern],
  );
  const negativePattern = React.useMemo(
    () => resolveCandlePattern(
      resolvedCandlestick.bodyPatternNegative,
      `${candlePatternDefsId}-candle-pattern-neg`,
    ),
    [resolvedCandlestick.bodyPatternNegative, candlePatternDefsId, resolveCandlePattern],
  );
  // Per-candle solid fill (bklit computeGeometries): a candle carrying a
  // pattern overlay renders body+wick in the SOLID token colors
  // (getSolidColor), ignoring the caller fill for that side.
  const solidFillFor = React.useCallback((isPositive: boolean, hasOwnPattern: boolean) => {
    if (hasOwnPattern) return isPositive ? PATTERN_FALLBACK_POSITIVE : PATTERN_FALLBACK_NEGATIVE;
    return isPositive ? resolvedPositiveFill : resolvedNegativeFill;
  }, [resolvedPositiveFill, resolvedNegativeFill]);

  const timeExtent = React.useMemo(() => {
    const dates = renderData
      .map((d) => d[xDataKey])
      .filter((v): v is Date => v instanceof Date);
    const minTime = dates.length ? Math.min(...dates.map((d) => d.getTime())) : 0;
    const maxTime = dates.length ? Math.max(...dates.map((d) => d.getTime())) : 0;
    return { minTime, maxTime };
  }, [renderData, xDataKey]);

  const innerWidth = Math.max(0, width - margin.left - margin.right);

  // Pixel geometry — used by bodyWidthPx (strokeWidth for body link marks),
  // the x `ChartScale`'s `resolve()` inset, and the X-axis overlay range.
  const slotWidth = React.useMemo(
    () => innerWidth / Math.max(renderData.length, 1),
    [innerWidth, renderData.length],
  );

  // bklit candlestick.tsx Candlestick: candleWidth = Math.min(candleWidth ??
  // slotWidth*(1-candleGap), slotWidth).
  const bodyWidthPx = React.useMemo(() => {
    const raw = candleWidthProp ?? slotWidth * (1 - candleGap);
    return Math.min(raw, slotWidth);
  }, [candleWidthProp, slotWidth, candleGap]);



  // bklit candlestick-chart.tsx yDomain: min/max of low/high fields, padded
  // by 5% (or a flat 1 if that padding would be 0), no `.nice()` on the raw
  // domain itself — `.nice()` is applied by the scaleLinear passed to
  // `defineChart` below, same as the padded-domain-then-nice precedent in
  // line/scatter's own yScale.
  const yDomain = React.useMemo<[number, number]>(() => {
    let minVal = Number.POSITIVE_INFINITY;
    let maxVal = Number.NEGATIVE_INFINITY;
    for (const row of renderData) {
      const low = row.low as number | undefined;
      const high = row.high as number | undefined;
      if (typeof low === "number" && low < minVal) minVal = low;
      if (typeof high === "number" && high > maxVal) maxVal = high;
    }
    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) return [0, 1];
    const pad = (maxVal - minVal) * 0.05 || 1;
    return [minVal - pad, maxVal + pad];
  }, [renderData]);

  // D110 escape hatch: custom ChartScale.resolve owns the scaleUtc range
  // inset by slotWidth/2; a plain scale instance would be re-ranged by
  // TanStack and lose the candlestick slot geometry.
  const xScale = React.useMemo<ChartScale>(() => {
    const { minTime, maxTime } = timeExtent;
    const count = Math.max(renderData.length, 1);
    return {
      id: "x",
      resolve(context) {
        const [r0, r1] = context.range;
        const lo = Math.min(r0, r1);
        const hi = Math.max(r0, r1);
        const localSlotWidth = Math.max(0, hi - lo) / count;
        const padding = localSlotWidth / 2;
        const insetLo = lo + padding;
        const insetHi = Math.max(insetLo, hi - padding);
        const scale = scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
        const ticks = scale.ticks(context.tickCount ?? 5);
        return {
          id: context.id,
          type: "time",
          domain: scale.domain(),
          map: (value: unknown) => {
            const mapped = scale(value as Date);
            return mapped === undefined ? Number.NaN : mapped;
          },
          ticks: ticks.map((value) => ({
            value,
            position: scale(value) ?? Number.NaN,
            label: value.toISOString(),
          })),
          bandwidth: 0,
        };
      },
    };
  }, [renderData.length, timeExtent]);

  const candlestickFocusStrategy = React.useMemo(
    () => createCandlestickFocusStrategy({ canInteractRef }),
    [],
  );

  // C3: hoisted above `definition` — the crosshair/hover-dot/highlight marks
  // built inside it need `chartConfig.tooltipSpring` for their `motion`
  // springs (context-driven override, matching the deleted
  // candlestick-hover-chrome.ts's own `attachCandlestickHoverChrome(el, ...,
  // {tooltipSpring: chartConfig.tooltipSpring})`), and `indicatorGradientId`
  // for the crosshair's optional fade gradient (`crosshairFadeGradient`
  // below reuses the same id).
  const chartConfig = useChartConfig();
  const indicatorGradientId = useSanitizedId();

  const definition = React.useMemo(() => {
    if (width <= 0) return null;

    // K10: legacy insideStrokeWidth — inner inset stroke on the body.
    const insideStrokeW = resolvedCandlestick.insideStrokeWidth;
    // C3: large-dataset motion cutoff, shared by the crosshair/hover-dot
    // marks below (same DISCRETE_INTERACTION_THRESHOLD as every other
    // migrated chart's own hover chrome, verified strict `>`).
    const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

    const yScale: ChartScale = {
      id: "y",
      resolve(context) {
        const scale = scaleLinear()
          .domain(yDomain)
          .nice()
          .range(context.range as [number, number]);
        const tickValues = scale.ticks(context.tickCount ?? grid?.numTicks ?? 5);
        return {
          id: context.id,
          type: "linear",
          domain: scale.domain(),
          map: (value: unknown) => {
            const mapped = scale(value as number);
            return mapped === undefined ? Number.NaN : mapped;
          },
          ticks: tickValues.map((value) => ({
            value,
            position: scale(value) ?? Number.NaN,
            label: String(value),
          })),
          bandwidth: 0,
        };
      },
    };

    // CUSTOM rect marks (D85.1: D82.1 revert — stock `link()` line
    // rendering can't match bklit's rect fills at both n=100 and n=1000).
    //
    // Wicks mark: one thin rect per candle (low→high, width=1.5).
    // Bodies mark: one rect per candle (open→close, width=bodyWidthPx,
    // fill=positiveFill/negativeFill, rx=1, stroke=fill, strokeWidth=1).
    // C1: hover/legend dim is native `states` (declared below, keyed off
    // each candle's positive/negative `group` identity) — no more inline
    // per-point opacity math. Highlight of the hovered candle stays a
    // separate native mark (C3: `createCandlestickHighlightMark`, below).
    const wicksDimStates = candlestickDimStates(resolvedCandlestick.fadedOpacity, resolvedCandlestick.showHoverFade);
    const wicksMark = createMark(() => {
      const xValues = renderData.map((d) => d[xDataKey] as Date);
      const lowValues = renderData.map((d) => d.low as number | undefined);
      const highValues = renderData.map((d) => d.high as number | undefined);
      return {
        id: "wicks",
        states: wicksDimStates.length ? { data: renderData, definitions: wicksDimStates } : undefined,
        channels: {
          x: { scale: "x", values: xValues },
          y: {
            scale: "y",
            values: ([] as number[]).concat(
              lowValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
              highValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
            ),
          },
        },
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          for (let i = 0; i < renderData.length; i++) {
            const d = renderData[i]!;
            const date = d[xDataKey] as Date;
            const low = d.low as number | undefined;
            const high = d.high as number | undefined;
            if (typeof low !== "number" || typeof high !== "number" || !Number.isFinite(low) || !Number.isFinite(high)) continue;
            const cx = scales.x.map(date);
            const yLow = scales.y.map(low);
            const yHigh = scales.y.map(high);
            if (!Number.isFinite(cx) || !Number.isFinite(yLow) || !Number.isFinite(yHigh)) continue;
            const close = d.close as number | undefined;
            const isPositive = typeof close === "number" && typeof d.open === "number" && close >= (d.open as number);
            const candlePattern = isPositive ? positivePattern : negativePattern;
            // bklit computeGeometries: wickFill = bodySolidFill when a
            // pattern overlay is set for this candle, else the caller fill.
            const wickFill = solidFillFor(isPositive, Boolean(candlePattern.href));
            const key = `wicks:${i}`;
            nodes.push({
              kind: "rect",
              key,
              className: "chart-candle-cell",
              x: cx - WICK_WIDTH_PX / 2,
              y: Math.min(yLow, yHigh),
              width: WICK_WIDTH_PX,
              height: Math.abs(yHigh - yLow) || 1,
              style: { fill: wickFill },
            });
            // group/groupLabel carry the candle's positive/negative series
            // identity (not "wicks") so `whenSeriesDimmed()` can match legend
            // hover; `markId` stays "wicks" for handleFocusGroupChange's
            // per-mark point lookup.
            points.push({
              key, markId: "wicks", group: isPositive ? "positive" : "negative", groupLabel: isPositive ? "positive" : "negative",
              datum: d, datumIndex: i, xValue: date, yValue: high,
              x: cx, y: yHigh, color: wickFill,
            });
          }
          return {
            nodes: [{ kind: "group", key: "wicks", className: "ts-chart__candle", ariaHidden: true, children: nodes }],
            points,
          };
        },
      };
    });

    const bodiesDimStates = candlestickDimStates(resolvedCandlestick.fadedOpacity, resolvedCandlestick.showHoverFade);
    const bodiesMark = createMark(() => {
      const xValues = renderData.map((d) => d[xDataKey] as Date);
      const openValues = renderData.map((d) => d.open as number | undefined);
      const closeValues = renderData.map((d) => d.close as number | undefined);
      return {
        id: "bodies",
        states: bodiesDimStates.length ? { data: renderData, definitions: bodiesDimStates } : undefined,
        channels: {
          x: { scale: "x", values: xValues },
          y: {
            scale: "y",
            values: ([] as number[]).concat(
              openValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
              closeValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
            ),
          },
        },
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          for (let i = 0; i < renderData.length; i++) {
            const d = renderData[i]!;
            const date = d[xDataKey] as Date;
            const open = d.open as number | undefined;
            const close = d.close as number | undefined;
            if (typeof open !== "number" || typeof close !== "number" || !Number.isFinite(open) || !Number.isFinite(close)) continue;
            const cx = scales.x.map(date);
            const yOpen = scales.y.map(open);
            const yClose = scales.y.map(close);
            if (!Number.isFinite(cx) || !Number.isFinite(yOpen) || !Number.isFinite(yClose)) continue;
            const isPositive = close >= open;
            const candlePattern = isPositive ? positivePattern : negativePattern;
            const hasOwnPattern = Boolean(candlePattern.href);
            const fill = solidFillFor(isPositive, hasOwnPattern);
            const key = `bodies:${i}`;
            // bklit CandlestickBody: solid body rect (self-stroke), then the
            // pattern overlay rect (same geometry/rx, NO self-stroke), then
            // the K10 inset stroke rect when insideStrokeWidth > 0.
            nodes.push({
              kind: "rect",
              key,
              className: "chart-candle-cell",
              x: cx - bodyWidthPx / 2,
              y: Math.min(yOpen, yClose),
              width: bodyWidthPx,
              height: Math.abs(yClose - yOpen) || 1,
              radius: 1,
              style: { fill, stroke: fill, strokeWidth: 1 },
            });
            if (hasOwnPattern) {
              nodes.push({
                kind: "rect",
                key: `${key}:pattern`,
                className: "chart-candle-cell",
                x: cx - bodyWidthPx / 2,
                y: Math.min(yOpen, yClose),
                width: bodyWidthPx,
                height: Math.abs(yClose - yOpen) || 1,
                radius: 1,
                style: { fill: candlePattern.href },
              });
            }
            if (insideStrokeW > 0) {
              nodes.push({
                kind: "rect",
                key: `${key}:stroke`,
                className: "chart-candle-cell",
                x: cx - bodyWidthPx / 2 + insideStrokeW / 2,
                y: Math.min(yOpen, yClose) + insideStrokeW / 2,
                width: bodyWidthPx - insideStrokeW,
                height: (Math.abs(yClose - yOpen) || 1) - insideStrokeW,
                radius: 1,
                style: { fill: "none", stroke: fill, strokeWidth: insideStrokeW },
              });
            }
            // group/groupLabel carry the candle's positive/negative series
            // identity (not "bodies") so `whenSeriesDimmed()` can match
            // legend hover; `markId` stays "bodies" for
            // handleFocusGroupChange's per-mark point lookup.
            points.push({
              key, markId: "bodies", group: isPositive ? "positive" : "negative", groupLabel: isPositive ? "positive" : "negative",
              datum: d, datumIndex: i, xValue: date, yValue: close,
              x: cx, y: yClose, color: fill,
            });
          }
          return {
            nodes: [{ kind: "group", key: "bodies", className: "ts-chart__candle", ariaHidden: true, children: nodes }],
            points,
          };
        },
      };
    });

    // C3: crosshair + per-candle hover-dot + highlight marks — native
    // replacement for the deleted candlestick-hover-chrome.ts's imperative
    // indicator/dot/highlight SVG layers. All three gated on `tooltipEnabled`
    // (candlestick-hover-chrome.ts was only ever mounted when tooltipEnabled,
    // matching every other migrated chart's own C3 gate). The highlight
    // itself is further UNGATED by showCrosshair/showDots/showDatePill below
    // — legacy's own `update()` painted `activeHighlightSvg` unconditionally
    // whenever a point was focused (candlestick-hover-chrome.ts:230-233, no
    // surrounding `if (state.showXxx)` guard, unlike the crosshair/dot
    // blocks there).
    const hoverMarks: ChartMark<ChartDatum, Date, number>[] = [];
    if (tooltipEnabled) {
      // Highlight FIRST (bottom of paint order) — mirrors legacy's own DOM
      // append order `host.append(activeHighlightSvg, indicator.svg,
      // dotsSvg, pillBuild.layer)`.
      hoverMarks.push(
        whenFocused(
          createCandlestickHighlightMark(
            renderData,
            xDataKey,
            bodyWidthPx,
            insideStrokeW,
            positivePattern,
            negativePattern,
            solidFillFor,
          ),
          { match: "group" },
        ),
      );
      if (tooltip?.showCrosshair ?? true) {
        // Config resolution mirrors legacy's `buildIndicator` exactly
        // (tooltip-mappers.ts's `toIndicatorConfig`, the same mapping
        // candlestick-hover-chrome.ts used inline via
        // `toIndicatorConfig(getState().tooltip)`). DROPPED BEHAVIOR:
        // `indicatorColor` as a function WAS genuinely invoked per hover-move
        // by legacy (candlestick-hover-chrome.ts:182-186 — unlike bar's own
        // dead-code branch of the same name) — native `crosshair()`'s
        // `x.stroke` is one static string for the whole mark
        // (dist/crosshair.d.ts's rule-options `stroke?: string`), not a
        // per-hover-frame channel, so a color that depends on which candle
        // is hovered has no native route without a renderer reach-in.
        // Dropped here; only the STRING form of `indicatorColor` is honored
        // (falls through to the CSS var otherwise, same as every other
        // migrated chart's crosshair).
        const indicatorCfg = toIndicatorConfig(tooltip);
        const isDashed = Boolean(indicatorCfg.dasharray);
        const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
        const indicatorColorValue = typeof indicatorCfg.color === "string" ? indicatorCfg.color : "var(--chart-crosshair)";
        const indicatorSpringCfg = indicatorCfg.springConfig ?? chartConfig.tooltipSpring;
        hoverMarks.push(
          crosshair({
            y: false,
            x: {
              stroke: !isDashed && fadeSides.any ? `url(#${indicatorGradientId})` : indicatorColorValue,
              strokeOpacity: 1,
              strokeWidth: resolveIndicatorPixelWidth(indicatorCfg),
              strokeDasharray: indicatorCfg.dasharray,
            },
            motion: discrete
              ? false
              : {
                  transition: {
                    type: "spring",
                    stiffness: indicatorSpringCfg.stiffness,
                    damping: indicatorSpringCfg.damping,
                  },
                },
          }) as ChartMark<ChartDatum, Date, number>,
        );
      }
      if (tooltip?.showDots ?? true) {
        hoverMarks.push(
          whenFocused(
            createCandlestickHoverDotMark(renderData, xDataKey, toDotConfig(tooltip), chartConfig.tooltipSpring),
            { match: "group", retarget: true },
          ),
        );
      }
    }

    const marks: ChartMark<ChartDatum, Date, number>[] = [
      wicksMark,
      bodiesMark,
      ...hoverMarks,
    ];
    const gridGuide = resolveGridGuide(grid);

    // C2: native tooltip extension — box-follow spring mirrors the legacy
    // TOOLTIP_BOX_SPRING default; springs snap (motion: false) once the
    // series is past the same DISCRETE_INTERACTION_THRESHOLD the chrome's
    // own springs use (verified strict `>`, not `>=`).
    const tooltipOption = tooltipEnabled
      ? {
          use: tooltipExtension,
          // Host chrome reset by the `.bkm-native-tooltip` rule in styles.css;
          // panel chrome comes from TooltipContent's own `.bkm-tooltip-panel`.
          className: "bkm-native-tooltip",
          sticky: false,
          anchor: { x: "value", y: "plot-top" } as const,
          placement: ["right", "left"] as const,
          offset: BOX_OFFSET,
          motion: (renderData.length > DISCRETE_INTERACTION_THRESHOLD
            ? false
            : { type: "spring", stiffness: TOOLTIP_BOX_SPRING.stiffness, damping: TOOLTIP_BOX_SPRING.damping }) as false | { type: "spring"; stiffness: number; damping: number },
        }
      : (false as const);

    return defineChart({
      marks,
      // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
      // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
      // key on the spec is never read.
      scales: {
        x: {
          scale: xScale,
          grid: gridGuide.vertical,
          axis: { ticks: { count: gridGuide.columnTicks } },
        },
        y: {
          scale: yScale,
          grid: gridGuide.horizontal,
          axis: { ticks: { count: gridGuide.ticks } },
        },
      },
      margin,
      focus: candlestickFocusStrategy,
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      // bklit candlestick: data updates SNAP, never tween (I8 is a Line-only
      // concept) — matches every other migrated chart's non-Line behavior.
      svgAnimation: false,
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
    grid,
    width,
    margin,
    candlestickFocusStrategy,
    tooltip,
    chartConfig,
    indicatorGradientId,
  ]);

  // Y-axis ticks — recomputed LOCALLY (not read from `yScaleD3Ref` post-hoc,
  // which would only be populated after Chart's own commit/effect phase) via
  // an "independently exact" duplicate scale (bar-chart.tsx precedent):
  // reproduces the exact same domain/`.nice()`/range formula the y
  // `ChartScale.resolve()` above uses, so the two can never disagree, without
  // needing an extra post-render state update on every render (data ticks
  // included).
  const heightPx = React.useMemo(() => {
    const ratio = parseAspectRatio(aspectRatio);
    return ratio > 0 ? width / ratio : 0;
  }, [width, aspectRatio]);

  const yAxisTicks = React.useMemo(() => {
    if (heightPx <= 0 || !yAxis) return [];
    const scale = scaleLinear()
      .domain(yDomain)
      .nice()
      .range([heightPx - margin.bottom, margin.top]);
    // bklit y-axis-ticks.ts resolveYAxisTickCount clamp — single source in
    // internal/y-axis-ticks.ts (was an inline copy here).
    const clamped = resolveYAxisTickCount(yAxis.numTicks);
    return scale.ticks(clamped).map((value) => ({ value, y: scale(value) ?? 0 }));
  }, [heightPx, margin.top, margin.bottom, yDomain, yAxis]);

  // Reveal re-arm: bklit's own reveal effect deps are EXACTLY
  // `[animationDuration, revealSignature]` — NOT `data` — verified directly
  // in candlestick-chart.tsx. Data-only updates must never replay the
  // reveal.
  React.useEffect(() => {
    revealEpochRef.current += 1;
    const epoch = revealEpochRef.current;
    canInteractRef.current = false;
    if (revealDeadlineTimerRef.current !== null) {
      window.clearTimeout(revealDeadlineTimerRef.current);
      revealDeadlineTimerRef.current = null;
    }
    if (animationDuration <= 0) {
      canInteractRef.current = true;
      return;
    }
    revealDeadlineTimerRef.current = window.setTimeout(() => {
      // bklit: force every candle (whether or not its own delayed spring had
      // actually finished) to its resolved end appearance at the flat
      // `animationDuration` deadline — see scatter-chart.tsx's identical
      // `.cancel()` precedent/rationale (drops the Animation from
      // `document.getAnimations()` entirely, unlike `.finish()`).
      if (revealEpochRef.current === epoch) {
        for (const anim of revealAnimationsRef.current) {
          anim.cancel();
        }
        revealAnimationsRef.current = [];
        // CSS-fast-path rects: clear `animation-name` directly (no
        // `getAnimations()` involved anywhere in this file — see
        // `revealCssElementsRef` comment above) — same identity-transform
        // end-state as the WAAPI `.cancel()` above.
        for (const rect of revealCssElementsRef.current) {
          rect.style.animationName = "none";
        }
        revealCssElementsRef.current = [];
        // K10: pop the inset-stroke rects in at the deadline (no transition
        // — legacy renders them only in the static isLoaded pass).
        for (const rect of revealStrokeRectsRef.current) {
          rect.style.transitionDuration = "0ms";
          rect.style.opacity = "1";
        }
        revealStrokeRectsRef.current = [];
        canInteractRef.current = true;
      }
    }, animationDuration);
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, [animationDuration, revealSignature]);

  // Teardown: cancel the pending post-paint chain + any in-flight WAAPI /
  // CSS-fast-path reveal animations on unmount (D205 canonical wording).
  React.useEffect(() => {
    return () => {
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const anim of revealAnimationsRef.current) {
        try {
          anim.cancel();
        } catch { /* teardown race — already cancelled */ }
      }
      revealAnimationsRef.current = [];
      for (const rect of revealCssElementsRef.current) {
        rect.style.animationName = "none";
      }
      revealCssElementsRef.current = [];
      revealStrokeRectsRef.current = [];
    };
  }, []);

  // C3: date-pill + label-fade chrome only — crosshair/dots/highlight are
  // now native marks built inside `definition` above. `chromeStateRef`
  // shrinks to just what `renderTooltipBody` (tooltip) and the pill mount
  // effect (dateLabels) still need at call time.
  const chromeStateRef = React.useRef<CandlestickChromeState | null>(null);
  // bklit parity (use-chart-interaction.ts): drag selection suppresses the
  // date-pill/label-fade chrome — cleared on mousedown, never rescheduled
  // while dragging. The native crosshair/dot/highlight marks are NOT gated
  // by this ref — they keep reacting directly to whatever
  // ChartFocusStrategy resolves during a drag, same as scatter-chart.tsx's
  // own C3 rewrite (its `handleFocusGroupChange` comment: "same gate as
  // line/candlestick's dragSelectionActiveRef" — this IS that gate).
  const dragSelectionActiveRef = React.useRef(false);
  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return shortDateFmt.format(v);
    return String(v ?? "");
  }), [renderData, xDataKey]);
  chromeStateRef.current = {
    tooltip: tooltip ?? null,
    dateLabels: dateLabelsForPill,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  // C3: date-pill-only mount — crosshair/dots/highlight are native marks now
  // (built inside `definition`), so this effect no longer attaches
  // `attachCandlestickHoverChrome`'s full indicator/dot/highlight/pill
  // quartet, just the sanctioned-extension pill DOM (`internal/date-pill.ts`
  // `buildPill`, byte-identical twin of the deleted candlestick-hover-
  // chrome.ts version's own `buildPill` call).
  const pillRef = React.useRef<PillBuild | null>(null);
  // Tracks whether the pill was already visible on the PREVIOUS focus-change
  // call, mirroring legacy's `showing = !visible` — first appearance jumps
  // the spring in place, subsequent moves while already visible spring.
  const pillVisibleRef = React.useRef(false);

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const doc = el.ownerDocument;
    const pillBuild = buildPill(doc, chartConfig.tooltipSpring, () => chromeStateRef.current?.dateLabels ?? []);
    el.appendChild(pillBuild.layer);
    pillRef.current = pillBuild;
    return () => {
      pillRef.current = null;
      pillVisibleRef.current = false;
      pillBuild.spring.stop();
      pillBuild.ticker?.detach();
      pillBuild.layer.remove();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig]);

  // C1: legend hover drives native mark `states` dim via programmatic focus
  // (replaces the old imperative chrome's syncLegendDim() DOM-mutation sync).
  React.useEffect(() => {
    if (legendHoveredIndex == null) {
      clearFocus();
      return;
    }
    const key = legendHoveredIndex === 0 ? "positive" : legendHoveredIndex === 1 ? "negative" : null;
    if (key != null) {
      focusSeries(key);
    } else {
      clearFocus();
    }
  }, [legendHoveredIndex, focusSeries, clearFocus]);

  // Hides the pill + resets axis-label fade — shared by the drag-suppression
  // branch below and `onDragStart` (useChartSelection, further down).
  const hidePill = React.useCallback(() => {
    pillVisibleRef.current = false;
    const pillBuild = pillRef.current;
    if (pillBuild) {
      pillBuild.layer.style.display = "none";
      pillBuild.spring.stop();
      pillBuild.label.textContent = "";
    }
    if (containerRef.current) resetLabelFade(containerRef.current);
  }, []);

  // C3: shrunk to date-pill + axis-label-fade only (crosshair/dot/highlight
  // positioning is now entirely inside the native marks above — this
  // handler no longer builds a `CandlestickFocusPoint` for a chrome object
  // to consume).
  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      if (dragSelectionActiveRef.current || points.length === 0) {
        hidePill();
        return;
      }
      const pillBuild = pillRef.current;
      const primary = points[0]!;
      const date = primary.xValue;
      const centerX = primary.x;
      const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
      const showDatePill = tooltipEnabled && (tooltip?.showDatePill ?? true);
      const showing = !pillVisibleRef.current;
      pillVisibleRef.current = true;

      if (pillBuild) {
        if (showDatePill) {
          pillBuild.layer.style.display = "";
          if (pillBuild.ticker && chromeStateRef.current?.dateLabels && chromeStateRef.current.dateLabels.length > 0) {
            pillBuild.ticker.update(primary.datumIndex, discrete);
          } else {
            pillBuild.label.textContent = shortDateFmt.format(date);
          }
          if (showing || discrete) pillBuild.spring.jump(centerX);
          else pillBuild.spring.set(centerX);
        } else {
          pillBuild.layer.style.display = "none";
        }
      }

      const container = containerRef.current;
      if (container) {
        const hoveredLabel = shortDateFmt.format(date);
        applyLabelFade(container, centerX, hoveredLabel, xAxis?.tickerHalfWidth ?? TICKER_HALF_WIDTH, FADE_BUFFER);
      }
    },
    [hidePill, renderData.length, tooltipEnabled, tooltip, xAxis],
  );

  // C2: native tooltip body — reuses `TooltipContent` verbatim. Legacy box
  // content was single-row "close" (custom `tooltip.rows`/`content`/
  // `children` honored) keyed off the "bodies" mark's point (carries the
  // full raw OHLC datum + the focused date as `xValue`). Reads
  // `chromeStateRef.current` at call time (mirrors the chrome's own
  // `getState()` pattern).
  const renderTooltipBody = React.useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): React.ReactNode => {
      if (ctx.points.length === 0) return null;
      const tt = chromeStateRef.current?.tooltip ?? null;
      const bodyPoint = ctx.points.find((p) => p.markId === "bodies") ?? ctx.points[0]!;
      const datum = bodyPoint.datum as ChartDatum;
      const date = bodyPoint.xValue as Date;
      const close = datum.close as number;
      const pointRec: Record<string, unknown> = { date, close };
      if (tt?.content) {
        return tt.content({ point: pointRec as ChartTooltipPoint, index: 0 });
      }
      const rows: TooltipRow[] = tt?.rows
        ? tt.rows(pointRec)
        : [{ color: "var(--chart-line-primary)", label: "close", value: close }];
      const title = weekdayDateFmt.format(date);
      return (
        <TooltipContent title={title} rows={rows}>
          {tt?.children}
        </TooltipContent>
      );
    },
    [],
  );

  // Mount/reveal WAAPI setup (bklit candlestick.tsx AnimatedCandle, framer
  // spring -> WAAPI per candle-spring.ts). Deferred two rAFs + a macrotask
  // past commit (scatter-chart.tsx precedent/rationale — keeps the expensive
  // per-rect `.animate()` instantiation loop off the mount->paint critical
  // path; the marks group is hidden via a single cheap CSS class the instant
  // it commits so the "real paint" already matches the tweens' pre-start
  // state). Guarded by a DOM dataset attribute on `.ts-chart__marks` so
  // this only runs once per mount (the element is destroyed/recreated on
  // strict-mode remount, so it naturally resets for the permanent mount).
  //
  // K7: `<Candlestick animate={false}>` skips the whole reveal — candles
  // render statically exactly as bklit (which renders CandlestickBodies
  // immediately when animate=false), while interaction still unlocks at the
  // flat `animationDuration` deadline (bklit's isLoaded timer runs
  // regardless of animate). The gate lives here, at the single reveal
  // entrypoint, so the K4 sampled-keyframe tween (P5.5) can plug into the
  // same gate later without re-touching this path.
  const handleRender = React.useCallback((context: ChartRenderContext<ChartDatum, Date, number>) => {
    // Cast: focus-injection's captureRenderContext takes the library's
    // default-generic Pick<ChartRenderContext, "scene"|"interaction">, which
    // (due to contravariance on interaction.setControlledFocus) isn't
    // structurally assignable from our ChartDatum-specific instantiation —
    // this is a type-system quirk, not a runtime mismatch.
    captureRenderContext(context as Pick<ChartRenderContext, "scene" | "interaction">);
    if (animationDuration <= 0) return;

    // K7: animate=false renders candles statically — bklit renders
    // CandlestickBodies immediately when animate is false (no AnimatedCandle
    // pass at all). Interaction still unlocks at the flat animationDuration
    // deadline: the reveal-arming effect runs unconditionally, matching
    // bklit's isLoaded timer which also ignores animate.
    if (!resolvedCandlestick.animate) {
      const staticMarksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
      if (staticMarksGroup) {
        markRevealed(staticMarksGroup);
        staticMarksGroup.classList.remove("ts-chart__marks--revealing");
      }
      return;
    }

    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup || isRevealed(marksGroup)) return;
    if (revealedForDataRef.current === latestRenderDataRef.current) {
      markRevealed(marksGroup);
      return;
    }
    revealedForDataRef.current = latestRenderDataRef.current;
    markRevealed(marksGroup);
    const mySetupEpoch = revealEpochRef.current;
    marksGroup.classList.add("ts-chart__marks--revealing");

    // K4 — the tween branch. `type: "tween"` routes through the SHARED engine
    // (`resolveEnterTransition` -> `revealTiming` -> `buildProgressKeyframes`),
    // which samples a tween as 64 uniform progress steps with the caller's
    // cubic-bezier as the WAAPI timing-level easing. Its own header proves
    // that shape is exact for a transform: "scale is linear in progress, so
    // piecewise-linear sampling introduces zero error".
    //
    // The SPRING branch below is deliberately left byte-identical — it keeps
    // its own duration+bounce sampler (`internal/candle-spring`) rather than
    // the engine's stiffness/damping one, because K4 adds a capability that
    // was missing; it does not restyle the default reveal.
    const enterTweenTiming =
      enterTransition?.type === "tween"
        ? revealTiming(resolveEnterTransition(enterTransition, TWEEN_FALLBACK))
        : null;
    const enterDurationMs =
      enterTweenTiming?.durationMs ??
      Math.max(1, (enterTransition?.duration ?? DEFAULT_ENTER_DURATION_SEC) * 1000);
    const enterBounce = enterTransition?.bounce ?? DEFAULT_ENTER_BOUNCE;
    const n = renderData.length;

    revealPostPaintCancelRef.current = onPostPaint(() => {
          if (revealEpochRef.current !== mySetupEpoch) {
            marksGroup.classList.remove("ts-chart__marks--revealing");
            return;
          }
          // D85.1: query TWO custom rect marks — `.ts-chart__candle`
          // (not `.ts-chart__link`). Each group contains `<rect>` elements.
          const wicksGroup = marksGroup.querySelector<SVGGElement>(
            '.ts-chart__candle[data-ts-key="wicks"]',
          );
          const bodiesGroup = marksGroup.querySelector<SVGGElement>(
            '.ts-chart__candle[data-ts-key="bodies"]',
          );

          const wickRects = wicksGroup
            ? Array.from(wicksGroup.querySelectorAll<SVGRectElement>("rect"))
            : [];
          const bodyRects = bodiesGroup
            ? Array.from(bodiesGroup.querySelectorAll<SVGRectElement>("rect"))
            : [];

          const staggerBaseMs = n > 0 ? (animationDuration * 0.6) / n : 0;

          // A tween never takes the CSS fast path: that path hardcodes the
          // baked default-spring `ts-candle-reveal` curve.
          const useCssRevealFastPath =
            enterTweenTiming === null &&
            Math.abs(enterBounce - DEFAULT_ENTER_BOUNCE) < 1e-6;
          const transformKeyframes: Keyframe[] | undefined = enterTweenTiming
            ? buildProgressKeyframes(enterTweenTiming, (p) => ({
                transform: `scaleY(${p})`,
              }))
            : useCssRevealFastPath
              ? undefined
              : sampleSpringKeyframes(enterDurationMs, enterBounce, 60).map((v) => ({
                  transform: `scaleY(${v})`,
                }));

          const allRects: SVGRectElement[] = [
            ...wickRects,
            ...bodyRects,
          ];

          // K9/K10: a bodies group now holds up to three rects per candle
          // (body, optional pattern overlay, optional inset stroke), so the
          // stagger delay comes from each rect's own candle index in its
          // `data-ts-key` ("wicks:<i>" / "bodies:<i>") — never DOM position.
          // bklit gives wick+body+pattern the same per-candle delay.
          const candleIndexFor = (rect: SVGRectElement): number => {
            const raw = rect.getAttribute("data-ts-key") ?? "";
            const sep = raw.indexOf(":");
            const idx = sep >= 0 ? Number.parseInt(raw.slice(sep + 1), 10) : Number.NaN;
            return Number.isFinite(idx) && idx >= 0 ? idx : 0;
          };

          const revealRects: SVGRectElement[] = [];
          const pendingStrokeRects: SVGRectElement[] = [];

          const applyReveal = (rect: SVGRectElement, index: number) => {
            // Rect origin is already at the node's x,y (top-left in SVG),
            // so transformOrigin at the center of the rect.
            const rx = Number.parseFloat(rect.getAttribute("x") ?? "0");
            const ry = Number.parseFloat(rect.getAttribute("y") ?? "0");
            const rw = Number.parseFloat(rect.getAttribute("width") ?? "0");
            const rh = Number.parseFloat(rect.getAttribute("height") ?? "0");
            rect.style.transformOrigin = `${rx + rw / 2}px ${ry + rh / 2}px`;
            // T-D3: native stagger({each, offset}) — offset=0,
            // each=staggerBaseMs (recomputed per render from `n`, still
            // linear in `index`).
            const delayMs = nativeStaggerDelayMs(staggerBaseMs, 0, index, "rect");
            if (useCssRevealFastPath) {
              rect.style.animationName = "ts-candle-reveal";
              rect.style.animationDuration = `${enterDurationMs}ms`;
              rect.style.animationDelay = `${delayMs}ms`;
              rect.style.animationTimingFunction = "linear";
              rect.style.animationFillMode = "backwards";
              revealCssElementsRef.current.push(rect);
            } else {
              const scaleAnim = rect.animate(transformKeyframes as Keyframe[], {
                duration: enterDurationMs,
                delay: delayMs,
                // Spring samples carry their own curve, so "linear"; a tween's
                // uniform samples get the caller's bezier here instead.
                easing: enterTweenTiming?.easing ?? "linear",
                fill: "backwards",
              });
              revealAnimationsRef.current.push(scaleAnim);
            }
            rect.style.transitionDuration = `${OPACITY_TWEEN_MS}ms`;
            rect.style.opacity = "0";
            revealRects.push(rect);
          };

          for (const rect of allRects) {
            // K10: the inset stroke rect never joins the reveal — legacy
            // omits it from AnimatedCandle entirely, so it pops in (no fade)
            // exactly when isLoaded flips at the flat animationDuration
            // deadline.
            if ((rect.getAttribute("data-ts-key") ?? "").endsWith(":stroke")) {
              rect.style.opacity = "0";
              pendingStrokeRects.push(rect);
              continue;
            }
            applyReveal(rect, candleIndexFor(rect));
          }
          revealStrokeRectsRef.current = pendingStrokeRects;
          marksGroup.classList.remove("ts-chart__marks--revealing");

          // Phase 2, one frame later: flip every revealing rect to opacity 1
          // in one pass so the shared CSS transition animates them all
          // uniformly, undelayed, over the fixed 150ms window.
          requestAnimationFrame(() => {
            if (revealEpochRef.current !== mySetupEpoch) return;
            for (const rect of revealRects) {
              rect.style.opacity = "1";
            }
          });
    });
  }, [
    animationDuration,
    enterTransition?.type,
    enterTransition?.duration,
    enterTransition?.bounce,
    // K4: a tween's ease changes the sampled curve, so it must re-arm — but
    // as a PRIMITIVE key. Callers pass `enterTransition` inline, so the `ease`
    // tuple is a fresh array identity every render; using it raw would re-arm
    // the reveal on every render instead of only when the curve changes.
    enterTransition?.ease?.join(","),
    renderData.length,
    resolvedCandlestick.animate,
    captureRenderContext,
  ]);

  const refAreaChildrenCandle = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const segChildrenCandle = React.useMemo(() => extractSegmentComponents(children), [children]);
  const innerWidthCandle = Math.max(0, width - margin.left - margin.right);
  const heightPxCandle = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
  const timeExtentCandle = React.useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const d of renderData) {
      const v = d[xDataKey];
      if (v instanceof Date) { const t = v.getTime(); if (t < minTime) minTime = t; if (t > maxTime) maxTime = t; }
    }
    if (!Number.isFinite(minTime)) return null;
    return { minTime, maxTime } as const;
  }, [renderData, xDataKey]);
  const xScaleCandleSel = React.useMemo(() => {
    if (!timeExtentCandle || innerWidthCandle <= 0) return null;
    const { minTime, maxTime } = timeExtentCandle;
    const count = Math.max(renderData.length, 1);
    const lo = 0;
    const hi = innerWidthCandle;
    const localSlotWidth = Math.max(0, hi - lo) / count;
    const padding = localSlotWidth / 2;
    const insetLo = lo + padding;
    const insetHi = Math.max(insetLo, hi - padding);
    return scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
  }, [timeExtentCandle, innerWidthCandle, renderData.length]);
  const { selection: candleSelection } = useChartSelection({
    enabled: true,
    innerWidth: innerWidthCandle,
    marginLeft: margin.left,
    data: renderData as unknown as Array<Record<string, unknown>>,
    xDataKey,
    xScale: xScaleCandleSel as unknown as { invert: (px: number) => Date } | null,
    containerRef,
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      hidePill();
    },
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
  });

  // C3: sanctioned SVG-gradient escape hatch for the native crosshair()'s
  // vertical fade — mirrors bar-chart.tsx's own crosshairFadeGradient
  // exactly (same fade-mask/indicatorFadeGradientStops utilities, same gate
  // conditions: dashed indicators never fade, no-fade configs need no
  // gradient at all). `gradientUnits="userSpaceOnUse"` with explicit pixel
  // `y1`/`y2` is required because the native crosshair renders as a
  // zero-bbox `<line>` — an `objectBoundingBox` gradient (what legacy's
  // `<rect fill="url(#id)">` trick relied on implicitly) has no bounding box
  // to map onto for a line.
  const crosshairFadeGradient = React.useMemo(() => {
    if (!tooltipEnabled || !(tooltip?.showCrosshair ?? true)) return null;
    const indicatorCfg = toIndicatorConfig(tooltip);
    if (indicatorCfg.dasharray) return null;
    const fadeSides = resolveVerticalFadeSides(indicatorCfg.fadeEdges ?? "both");
    if (!fadeSides.any) return null;
    const colorValue = typeof indicatorCfg.color === "string" ? indicatorCfg.color : "var(--chart-crosshair)";
    return {
      id: indicatorGradientId,
      color: colorValue,
      stops: indicatorFadeGradientStops(fadeSides, indicatorCfg.fadeLength ?? 10),
    };
  }, [tooltipEnabled, tooltip, indicatorGradientId]);

  return (
    <ChartSelectionContext.Provider value={candleSelection}>
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, isolation: "isolate", ...style } as React.CSSProperties}
      data-bkm-chart="candlestick"
    >
      {background ? (
        <BackgroundLayer
          config={background}
          innerWidth={innerWidth}
          innerHeight={Math.max(0, heightPxCandle - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
        />
      ) : null}
      {definition ? (
        <>
          {positivePattern.preset ? (
            <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
              <defs>{renderPatternPreset(positivePattern.preset, `${candlePatternDefsId}-candle-pattern-pos`, {})}</defs>
            </svg>
          ) : null}
          {negativePattern.preset ? (
            <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
              <defs>{renderPatternPreset(negativePattern.preset, `${candlePatternDefsId}-candle-pattern-neg`, {})}</defs>
            </svg>
          ) : null}
          <Chart
            ariaLabel="Candlestick chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
            renderTooltipBody={tooltipEnabled ? renderTooltipBody : undefined}
          />
          {xAxis ? (
            <XAxisOverlay
              data={renderData}
              xDataKey={xDataKey}
              rangeStart={margin.left + slotWidth / 2}
              rangeEnd={width - margin.right - slotWidth / 2}
              numTicks={xAxis.numTicks ?? 5}
              formatValue={xAxis.formatValue}
              tickMode={xAxis.tickMode}
            />
          ) : null}
          {yAxis ? (
            <YAxisOverlay
              ticks={yAxisTicks}
              marginLeft={margin.left}
              formatLargeNumbers={yAxis.formatLargeNumbers}
              formatValue={yAxis.formatValue}
            />
          ) : null}
          {heightPxCandle > 0 && (
            <ReferenceAreaLayers
              configs={refAreaChildrenCandle}
              geom={{
                width,
                height: heightPxCandle,
                margin,
                yDomain,
                xDomain: timeExtentCandle ? ([new Date(timeExtentCandle.minTime), new Date(timeExtentCandle.maxTime)] as unknown as [Date, Date]) : undefined,
                isTimeScale: true,
                isCandlestickXScale: true,
              }}
            />
          )}
          <SegmentOverlay
            selection={candleSelection}
            innerWidth={innerWidthCandle}
            innerHeight={heightPxCandle - margin.top - margin.bottom}
            marginLeft={margin.left}
            marginTop={margin.top}
            components={segChildrenCandle}
          />
          {tooltipEnabled ? (
            <div
              ref={overlayHostRef}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          ) : null}
        </>
      ) : null}
      {crosshairFadeGradient ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient
              id={crosshairFadeGradient.id}
              gradientUnits="userSpaceOnUse"
              x1={0}
              x2={0}
              y1={margin.top}
              y2={margin.top + Math.max(0, heightPxCandle - margin.top - margin.bottom)}
            >
              {crosshairFadeGradient.stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={crosshairFadeGradient.color} stopOpacity={s.opacity} />
              ))}
            </linearGradient>
          </defs>
        </svg>
      ) : null}
    </div>
    </ChartSelectionContext.Provider>
  );
}

// Legacy parity: bklit `candlestick-chart.tsx` ships `export default CandlestickChart;` (T-E2).
export default CandlestickChart;
