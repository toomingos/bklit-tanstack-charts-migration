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
// Reveal (bklit candlestick.tsx AnimatedCandle, framer spring): B4 (C5,
// D432) moved this onto the native motion renderer's own spring/tween
// integrator — mount collapsed (center-anchored, height 0), then a
// `revealed` boolean state flips on a later commit, and the KEYED
// update-phase diff (same `data-ts-key`s) is what native motion actually
// animates, fed `{ stiffness, damping }` from `candle-spring.ts`'s KEPT
// `findSpringStiffnessDamping` duration/bounce solver (see `candleMotion`,
// in `definition`'s useMemo below). bklit's reveal effect deps are
// `[animationDuration, revealSignature]`, NOT `data` (verified directly) —
// reproduced here as the literal deps of the `revealed`-flipping effect;
// data-only updates never touch that effect, so `revealed` naturally stays
// `true` and the reveal never replays (ordinary React state persistence,
// no DOM guard needed — see that effect's comment).
//
// Hover chrome: TanStack-native ChartFocusStrategy (`internal/candlestick-focus-strategy.ts`
// `bisectDateLeft`/`resolveNearestIndex` strict `>` tie-break over ChartPoint.xValue epoch ms)
// drives native crosshair/hover-dot/highlight marks (built inside
// `definition`, C3) directly — plus a thin `<RendererChart onFocusGroupChange>`
// adapter that only drives the app-owned date-pill + axis-label fade
// (`internal/date-pill.ts`, C3), no native pointermove/bisect listener.
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { createMark } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type { ChartMark, ChartMarkState, ChartMotionContext, ChartMotionDefinition, ChartMotionTransition, ChartPoint, ChartRendererRenderContext, ChartScale, SceneNode } from "@tanstack/charts";
import { extractChildren } from "./children";
import { TooltipContent } from "./internal/tooltip-components";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, TOOLTIP_BOX_SPRING } from "./internal/design-tokens";
import { buildPill, type PillBuild } from "./internal/date-pill";
import { buildXAxisTickValues, formatYAxisTick, buildFadeXAxisOptions } from "./internal/axis-ticks";
import { resolveVerticalFadeSides, indicatorFadeGradientStops } from "./internal/fade-mask";
import { toDotConfig, toIndicatorConfig, type DotConfig } from "./internal/tooltip-mappers";
import { findSpringStiffnessDamping } from "./internal/candle-spring";
import { resolveMotionEasing } from "./internal/reveal-easing";
import { chartRendererFor } from "./internal/motion-renderer";
import {
  resolveEnterTransition,
  TWEEN_FALLBACK,
  type CandlestickEnterTransition,
} from "./internal/enter-transition";
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
import { resolveYAxisTickCount } from "./internal/y-axis-ticks";
import type { ChartDatum, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { createCandlestickFocusStrategy } from "./internal/candlestick-focus-strategy";
import { useChartMargin, DEFAULT_CHART_MARGIN, useContainerWidth, type ChartMargin } from "./internal";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { useFocusInjection, whenSeriesDimmed, useLegendFocusBroadcast } from "./internal/focus-injection";
import { buildIndicatorMark } from "./internal/hover-geometry";
import { buildNativeTooltipExtension } from "./internal/native-tooltip";
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
// bklit candlestick.tsx AnimatedCandle: opacity always tweened over a fixed,
// undelayed 150ms, PARALLEL to the (staggered) scaleY spring — B4 (C5,
// D432) dropped this: native motion batches every changed attribute on one
// keyed element into ONE track sharing ONE timing (dist/motion.js
// `addUpdateTrack`), so a SEPARATE undelayed-opacity / staggered-geometry
// pair on the same rect isn't expressible. Collapsed geometry (height 0)
// already makes a candle invisible pre-reveal, so opacity was redundant
// once the fade-in illusion is achieved by growth alone — D-ledger
// residual (the "150ms opacity mask, unrelated to the scaleY spring's own
// timing" visual nuance is gone; the reveal's overall shape is unchanged).
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
              // B7: matches bar-chart.tsx's identical hover-dot rename.
              { kind: "group", key: "hover-dot", className: "bkm-chart__hover-dot", ariaHidden: true, children: nodes },
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
              // B7: census cleanliness — app-owned mark group, `bkm-chart__`
              // prefix (matches the wicks/bodies rename above). Requires a
              // `styles.css` follow-up — see final report.
              { kind: "group", key: "hover-highlight", className: "bkm-chart__candle-highlight", ariaHidden: true, children: nodes },
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
  // B4 (C5, D432): the old DOM-stamp/data-identity replay guard
  // (`latestRenderDataRef`/`revealedForDataRef`, `isRevealed`/
  // `markRevealed`) is gone — React's `revealed` state already persists
  // across data-only re-renders (it is not a dependency of the reveal-arm
  // effect, matching bklit's own reveal being state-keyed on
  // `[animationDuration, revealSignature]`, D218), so "data-only updates
  // always snap and never replay the reveal" now falls out of ordinary
  // React state semantics instead of a manual DOM guard.

  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext, focusSeries, clearFocus, sceneRef, clientToScene } = useFocusInjection<ChartDatum, Date, number>();

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

  // B4 (C5, D432): native motion's two-phase enter/update growth. Mounts
  // collapsed (center-anchored, height 0 — see wicksMark/bodiesMark render
  // below) under `motion:false` on enter; this effect then flips `revealed`
  // to `true` on a later commit, and the KEYED update-phase diff (same
  // `data-ts-key`s) is what native motion actually spring/tweens — see the
  // `[animationDuration, revealSignature]` effect below. K7 (`animate:
  // false`) and a non-positive `animationDuration` both skip the reveal
  // entirely by lazy-initializing straight to `true` (matches legacy's
  // "CandlestickBodies immediately, no AnimatedCandle pass at all").
  const [revealed, setRevealed] = React.useState(
    () => animationDuration <= 0 || !resolvedCandlestick.animate,
  );

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
        // C4: when `xAxis` is configured, tick CHOICE comes from the same
        // pure algorithm the deleted `XAxisOverlay` used (`buildXAxisTickValues`
        // — data-aligned selection / domain-interpolated / brushed-tail
        // modes); positions are mapped through THIS resolver's own inset
        // scale, which spans the identical range the overlay used to
        // interpolate over (`insetLo`/`insetHi` above === the overlay's
        // `margin.left + slotWidth/2` .. `width - margin.right - slotWidth/2`).
        // No `xAxis` (labels off): keep the prior plain `scale.ticks()`
        // emission verbatim.
        const ticks = xAxis
          ? buildXAxisTickValues({
              data: renderData,
              xDataKey,
              rangeStart: insetLo,
              rangeEnd: insetHi,
              numTicks: xAxis.numTicks ?? 5,
              formatValue: xAxis.formatValue,
              tickMode: xAxis.tickMode,
            }).map(({ value, label }) => ({
              value,
              position: scale(value) ?? Number.NaN,
              label,
            }))
          : scale.ticks(context.tickCount ?? 5).map((value) => ({
              value,
              position: scale(value) ?? Number.NaN,
              label: value.toISOString(),
            }));
        return {
          id: context.id,
          type: "time",
          domain: scale.domain(),
          map: (value: unknown) => {
            const mapped = scale(value as Date);
            return mapped === undefined ? Number.NaN : mapped;
          },
          ticks,
          bandwidth: 0,
        };
      },
    };
  }, [renderData, xDataKey, timeExtent, xAxis]);

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

  // C4: axis-label proximity fade, formerly `date-pill.ts`'s imperative
  // `applyLabelFade`/`resetLabelFade` DOM-span mutators. `hidePill`/
  // `handleFocusGroupChange` set/clear this; the `definition` memo below
  // reads it in a native `tickLabels.opacity` per-tick callback
  // (`tickLabelFadeOpacity`). A per-focus-step `definition` rebuild is
  // accepted (research decision, not throttled).
  const [labelFade, setLabelFade] = React.useState<{ primaryX: number; hoveredLabel: string | null } | null>(null);

  // B4 (C5, D432): K7 (`candlestick.animate === false`) and a non-positive
  // `animationDuration` both skip the reveal entirely — rendered here
  // (render time), not folded into the reveal-arm effect's deps (which stay
  // EXACTLY `[animationDuration, revealSignature]`, matching bklit's own
  // reveal-effect deps — see that effect's comment). Every wick/body/
  // pattern/inset-stroke rect's `render()` branches on this flag between
  // its collapsed and target geometry.
  const showTargetGeometry = revealed || animationDuration <= 0 || !resolvedCandlestick.animate;

  // B4 (C5, D432): the native two-phase growth transition. `false` on
  // enter (mount paints already-collapsed geometry with no animation, so
  // there's nothing to enter-animate); on update (the `showTargetGeometry`
  // flip from `false` -> `true`, which changes every rect's keyed x/y/
  // width/height) a spring or tween per `enterTransition`, exactly
  // mirroring legacy's own K4 branch (candlestick-chart.tsx handleRender,
  // pre-B4): `enterTransition?.type === "tween"` routes through the shared
  // `resolveEnterTransition`/`TWEEN_FALLBACK` engine (native `easing` needs
  // a JS progress function, not a CSS string, hence `resolveMotionEasing`);
  // anything else (spring, or no `enterTransition` at all) uses bklit's own
  // `defaultEnter = { type: "spring", duration: 0.8, bounce: 0.15 }`
  // (`DEFAULT_ENTER_DURATION_SEC`/`DEFAULT_ENTER_BOUNCE` above) through
  // `candle-spring.ts`'s KEPT `findSpringStiffnessDamping` duration/bounce
  // -> stiffness/damping solver — the same solver legacy's WAAPI keyframe
  // sampler used, now feeding the native spring integrator directly instead
  // of a 60-sample keyframe bake.
  //
  // Per-candle stagger (legacy: `nativeStaggerDelayMs(staggerBaseMs, 0,
  // index, "rect")`, `staggerBaseMs = (animationDuration*0.6)/n`) is
  // DROPPED here, not reimplemented via delaying the state flip: confirmed
  // via `@tanstack/charts/dist/motion.js:2552` —
  // `if (context.phase === "update" && transition.type === "spring") delay
  // = 0;` — the engine unconditionally zeroes any authored `delay` on an
  // update-phase SPRING transition (candlestick's default, and by far its
  // most common, path), so a per-candle `delay` callback here would be
  // silently discarded for the spring branch regardless. Staggering the
  // `revealed` flip itself (one `setState` per candle) would require N
  // sequential React commits per reveal, which is both a correctness
  // hazard (mid-sequence remounts/unmounts) and a functional change to the
  // reveal architecture the brief did not ask for. All candles now animate
  // in synchronized lockstep — D-ledger residual.
  const candleMotion = React.useMemo<ChartMotionDefinition<ChartDatum>>(() => {
    let transition: ChartMotionTransition;
    if (enterTransition?.type === "tween") {
      // `resolveEnterTransition` dispatches on `transition.type ?? fallback.kind`
      // (enter-transition.ts:126) — since `enterTransition.type === "tween"`
      // here, `resolved.kind` is PROVABLY always `"tween"`; the `TWEEN_FALLBACK`
      // fallback below is unreachable at runtime and exists only to satisfy
      // the narrow (TWEEN_FALLBACK's own static type is the full
      // `ResolvedTiming` union, even though its literal value is always
      // `kind: "tween"` — enter-transition.ts:60-64).
      const resolved = resolveEnterTransition(enterTransition, TWEEN_FALLBACK);
      const tweenFallback = TWEEN_FALLBACK as Extract<typeof TWEEN_FALLBACK, { kind: "tween" }>;
      const durationMs = resolved.kind === "tween" ? resolved.durationMs : tweenFallback.durationMs;
      const easingCss = resolved.kind === "tween" ? resolved.easingCss : tweenFallback.easingCss;
      transition = { type: "tween", duration: durationMs, easing: resolveMotionEasing(easingCss) };
    } else {
      const enterDurationMs = Math.max(1, (enterTransition?.duration ?? DEFAULT_ENTER_DURATION_SEC) * 1000);
      const enterBounce = enterTransition?.bounce ?? DEFAULT_ENTER_BOUNCE;
      const { stiffness, damping } = findSpringStiffnessDamping(enterDurationMs, enterBounce);
      transition = { type: "spring", stiffness, damping };
    }
    return (ctx: ChartMotionContext<ChartDatum>) => (ctx.phase === "enter" ? false : { transition });
  }, [enterTransition]);

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
        // C4: when `yAxis` is configured, tick VALUES + labels are the same
        // single source the deleted `YAxisOverlay` used (`resolveYAxisTickCount`
        // clamp, `formatYAxisTick` formatting) rather than the plain grid-line
        // count. DEVIATION: horizontal grid lines now follow the label ticks
        // in that case (previously always count-driven) — identical output
        // for default configs since both start from the same niced domain.
        const tickCount = yAxis ? resolveYAxisTickCount(yAxis.numTicks) : (context.tickCount ?? grid?.numTicks ?? 5);
        const tickValues = scale.ticks(tickCount);
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
            label: yAxis ? formatYAxisTick(value, yAxis.formatValue, yAxis.formatLargeNumbers ?? true) : String(value),
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
            // B4 (C5, D432): center-anchored collapse — matches legacy's
            // own `rect.style.transformOrigin = "${cx}px ${centerY}px"`
            // (candle-spring.ts-era WAAPI `scaleY` reveal, pre-B4), so the
            // native update-phase diff on `y`/`height` reproduces the same
            // grow-from-center appearance the old `scaleY(0)->scaleY(1)`
            // transform gave, without needing a CSS transform at all.
            const wickTargetY = Math.min(yLow, yHigh);
            const wickTargetHeight = Math.abs(yHigh - yLow) || 1;
            nodes.push({
              kind: "rect",
              key,
              className: "chart-candle-cell",
              x: cx - WICK_WIDTH_PX / 2,
              y: showTargetGeometry ? wickTargetY : wickTargetY + wickTargetHeight / 2,
              width: WICK_WIDTH_PX,
              height: showTargetGeometry ? wickTargetHeight : 0,
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
            // B7: census cleanliness — `ts-chart__candle` accidentally
            // matched no native role-resolution branch anyway (custom
            // `<rect>` marks resolve to role "rect" via `markMotionRole`'s
            // localName fallback, not "candle"), but the `ts-chart__`
            // prefix is reserved for native-emitted role classes; this is
            // an app-owned mark group, so it takes `bkm-chart__` (matches
            // `bkm-chart__bar-pulse`/`bkm-chart__hover-dot`'s B3/B7
            // renames). Requires a `styles.css` follow-up — see final
            // report (not made here: styles.css is outside this executor's
            // file set).
            nodes: [{ kind: "group", key: "wicks", className: "bkm-chart__candle", ariaHidden: true, children: nodes }],
            points,
          };
        },
      };
    }, candleMotion);

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
            // B4 (C5, D432): center-anchored collapse (see wicksMark's
            // identical comment) applied uniformly to ALL THREE rects —
            // including the K10 inset-stroke rect. Legacy deliberately
            // EXCLUDED the inset-stroke rect from the animated reveal
            // entirely (held at `opacity:0`, unanimated pop-in at the flat
            // `animationDuration` deadline) because it was a separate WAAPI
            // element with no natural place in the per-rect `.animate()`
            // loop; under native motion, this rect shares the exact same
            // `data-ts-key` (`bodies:${i}:stroke`) and geometry shape as
            // the body rect it's nested inside, so animating it identically
            // is strictly simpler AND visually closer to intent (the inset
            // stroke now grows in lockstep with its own body, rather than
            // popping in abruptly after) — recorded as a deliberate
            // behavior IMPROVEMENT, not a regression, for the D-ledger.
            const bodyTargetY = Math.min(yOpen, yClose);
            const bodyTargetHeight = Math.abs(yClose - yOpen) || 1;
            const bodyY = showTargetGeometry ? bodyTargetY : bodyTargetY + bodyTargetHeight / 2;
            const bodyHeight = showTargetGeometry ? bodyTargetHeight : 0;
            // bklit CandlestickBody: solid body rect (self-stroke), then the
            // pattern overlay rect (same geometry/rx, NO self-stroke), then
            // the K10 inset stroke rect when insideStrokeWidth > 0.
            nodes.push({
              kind: "rect",
              key,
              className: "chart-candle-cell",
              x: cx - bodyWidthPx / 2,
              y: bodyY,
              width: bodyWidthPx,
              height: bodyHeight,
              radius: 1,
              style: { fill, stroke: fill, strokeWidth: 1 },
            });
            if (hasOwnPattern) {
              nodes.push({
                kind: "rect",
                key: `${key}:pattern`,
                className: "chart-candle-cell",
                x: cx - bodyWidthPx / 2,
                y: bodyY,
                width: bodyWidthPx,
                height: bodyHeight,
                radius: 1,
                style: { fill: candlePattern.href },
              });
            }
            if (insideStrokeW > 0) {
              const strokeTargetY = bodyTargetY + insideStrokeW / 2;
              const strokeTargetHeight = bodyTargetHeight - insideStrokeW;
              nodes.push({
                kind: "rect",
                key: `${key}:stroke`,
                className: "chart-candle-cell",
                x: cx - bodyWidthPx / 2 + insideStrokeW / 2,
                y: showTargetGeometry ? strokeTargetY : strokeTargetY + strokeTargetHeight / 2,
                width: bodyWidthPx - insideStrokeW,
                height: showTargetGeometry ? strokeTargetHeight : 0,
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
            // B7 — see wicksMark's identical rename comment above.
            nodes: [{ kind: "group", key: "bodies", className: "bkm-chart__candle", ariaHidden: true, children: nodes }],
            points,
          };
        },
      };
    }, candleMotion);

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
          buildIndicatorMark({
            gradientId: indicatorGradientId,
            width: indicatorCfg.width,
            span: indicatorCfg.span,
            columnWidth: indicatorCfg.columnWidth,
            dasharray: indicatorCfg.dasharray,
            color: indicatorColorValue,
            useGradient: !isDashed && fadeSides.any,
            strokeOpacity: 1,
            spring: indicatorSpringCfg,
            discrete,
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
    const tooltipOption = buildNativeTooltipExtension<ChartDatum, Date, number>({
      enabled: tooltipEnabled,
      spring: TOOLTIP_BOX_SPRING,
      discrete,
      // Host chrome reset by the `.bkm-native-tooltip` rule in styles.css;
      // panel chrome comes from TooltipContent's own `.bkm-tooltip-panel`.
      className: "bkm-native-tooltip",
      offset: BOX_OFFSET,
      anchor: { x: "value", y: "plot-top" } as const,
    });

    return defineChart({
      marks,
      // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
      // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
      // key on the spec is never read.
      scales: {
        x: {
          scale: xScale,
          grid: gridGuide.vertical,
          axis: buildFadeXAxisOptions(gridGuide.columnTicks, xAxis ?? undefined, margin.bottom, labelFade),
        },
        y: {
          scale: yScale,
          grid: gridGuide.horizontal,
          axis: {
            line: false,
            ticks: { count: gridGuide.ticks, size: 0, padding: 0 },
            tickLabels: yAxis ? { fontSize: 12, thin: false, opacity: 1, dx: -8 } : false,
          },
        },
      },
      margin,
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
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
    xAxis,
    yAxis,
    labelFade,
    // B4 (C5, D432): `showTargetGeometry` gates every rect's collapsed vs.
    // target geometry (folds in `revealed`, `animationDuration`, and K7's
    // `resolvedCandlestick.animate`); `candleMotion` is the mark-level
    // motion definition passed to both `createMark` calls.
    showTargetGeometry,
    candleMotion,
  ]);

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
    // B4 (C5, D432): collapse-then-flip across two SEPARATE commits so
    // native motion's keyed update-phase diff always has a "before"
    // (collapsed) and "after" (target) geometry to interpolate between —
    // including on a REPLAY (a `revealSignature` bump with unchanged data,
    // where `revealed` may already be `true` from a prior reveal). A
    // same-tick batched update would collapse both states into a single
    // commit and there would be nothing for the diff to animate. K7
    // (`candlestick.animate === false`) is handled separately, at render
    // time (`showTargetGeometry` below in `definition`) rather than here —
    // this effect's deps stay EXACTLY `[animationDuration, revealSignature]`
    // (bklit's own reveal-effect deps, verified directly — see header),
    // matching legacy's own "the flat animationDuration deadline timer runs
    // regardless of animate" behavior.
    setRevealed(false);
    const flipTimer = window.setTimeout(() => {
      if (revealEpochRef.current === epoch) setRevealed(true);
    }, 0);
    // bklit's own isLoaded timer: interaction unlocks at the flat
    // `animationDuration` deadline regardless of whether any individual
    // candle's own (possibly still-settling) spring has actually finished.
    // Native motion has no completion callback to hook (unlike WAAPI's
    // `Animation.finished`), so — unlike legacy, which force-`.cancel()`ed
    // every in-flight WAAPI animation to its end state at this same
    // deadline — the native springs are simply left to keep settling on
    // their own past this point; interaction unlocks on the same schedule,
    // but a very early user interaction could observe a candle still
    // mid-spring. Visually inconsequential at bklit's own default duration/
    // bounce (settles well inside `animationDuration`) — recorded as a
    // D-ledger residual for pathological custom `enterTransition` configs.
    revealDeadlineTimerRef.current = window.setTimeout(() => {
      if (revealEpochRef.current === epoch) canInteractRef.current = true;
    }, animationDuration);
    return () => {
      window.clearTimeout(flipTimer);
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, [animationDuration, revealSignature]);

  // Teardown: B4 (C5, D432) dropped the old dedicated teardown effect
  // entirely — no more WAAPI Animations / CSS fast-path rects / post-paint
  // chain to cancel on unmount. The reveal deadline `setTimeout` is already
  // cleaned up by the reveal-arm effect's own cleanup function above (D205
  // canonical wording: teardown lives with the effect that owns the
  // resource).

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
  const resolveLegendFocusKey = React.useCallback(
    (index: number) => (index === 0 ? "positive" : index === 1 ? "negative" : null),
    [],
  );
  useLegendFocusBroadcast(legendHoveredIndex, resolveLegendFocusKey, focusSeries, clearFocus);

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
    setLabelFade((prev) => (prev === null ? prev : null));
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

      // C4: hoveredLabel must use the SAME formatter the axis ticks render
      // with — `xAxis.formatValue ?? shortDateFmt.format` — not always
      // `shortDateFmt`, so the fade's "hide the label under the pointer"
      // text match actually lands on custom `formatValue` configs (this
      // mismatch existed in the deleted DOM version too; fixed here since
      // the native `tickLabels.opacity` callback needs one true label per
      // tick to compare against).
      const hoveredLabel = (xAxis?.formatValue ?? shortDateFmt.format)(date);
      setLabelFade((prev) =>
        prev && prev.primaryX === centerX && prev.hoveredLabel === hoveredLabel
          ? prev
          : { primaryX: centerX, hoveredLabel },
      );
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

  // B4 (C5, D432): the reveal itself moved entirely to native motion
  // (`candleMotion` above) + the `revealed` state/effect — `handleRender`
  // now does only what every other migrated chart's `onRender` does: hand
  // the render context to focus-injection. B1: the renderer context type is
  // `ChartRendererRenderContext` under `RendererChart` (no `svg` member;
  // nothing here needed it anyway).
  const handleRender = React.useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
  }, [captureRenderContext]);

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
  // C6: replaces the deleted plot-local `xScaleCandleSel` duplicate d3
  // scale (which approximated candle-slot centering via a hand-rolled
  // half-slot-width inset) — resolves through the host's own live
  // interaction/scene refs, which already reflect the chart's real
  // candle-slot geometry exactly.
  const invertSceneXCandle = React.useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? null,
    [sceneRef],
  );
  const { selection: candleSelection } = useChartSelection({
    enabled: true,
    innerWidth: innerWidthCandle,
    marginLeft: margin.left,
    data: renderData as unknown as Array<Record<string, unknown>>,
    xDataKey,
    resolveScenePos: clientToScene,
    invertSceneX: invertSceneXCandle,
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
          <RendererChart
            ariaLabel="Candlestick chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            renderer={chartRendererFor<ChartDatum, Date, number>(renderData.length)}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
            renderTooltipBody={tooltipEnabled ? renderTooltipBody : undefined}
          />
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
