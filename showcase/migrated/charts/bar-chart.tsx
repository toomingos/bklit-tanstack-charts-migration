// Migrated bklit-ui BarChart — same public API, rendered by TanStack Charts.
// Pilot scope: vertical, grouped (NOT stacked) bars only — one `barY()` mark
// per <Bar> series (bar-chart.tsx bklit source's `stacked`/`orientation`/
// `perspective`/`minBarHeight`/`squareSnap` branches are all out of scope).
//
// Geometry mirrors bklit's ChartCore but now TanStack-native for
// sizing/hover: `x`/`y` scales are passed as factories (not pre-ranged
// instances) so `resolveConfiguredScale` applies the margin-inclusive range
// itself; hover is a custom ChartFocusStrategy (`internal/bar-focus-
// strategy.ts`) wired via `defineChart(spec, {focus, maxFocusDistance})`
// and consumed via `<RendererChart onFocusGroupChange>` → chrome adapter. No manual
// `pointermove` listener, no `columnWidth` arithmetic, no per-move
// `querySelector("svg")`/`getBoundingClientRect`.
//
// The per-series horizontal offset within each category band (bklit's
// `individualBarWidth`/`groupGap` grouped-bar math, fixed `groupGap = 4`) is
// reproduced via a `groupScale` — a second, nested `scaleBand<string>`
// instance whose domain is the full list of series dataKeys and whose
// `paddingInner` is derived so that its resulting `.bandwidth()` equals
// bklit's own `individualBarWidth` exactly (verified algebraically: for n
// series, fixed pixel gap g, category bandwidth W — step = (W+g)/n,
// paddingInner = n·g/(W+g), paddingOuter = 0 — d3's own band-scale formula
// then yields `bandwidth = step·(1-paddingInner) = (W-g·(n-1))/n`, bklit's
// formula verbatim). This is passed to the grouped `barY()` layout as a
// pre-built, already-domained scale INSTANCE (not a factory) — TanStack's
// group layout copies it and re-ranges it to `[0, totalBandwidth]` itself,
// but preserves the domain/padding we set, so every series' call resolves the
// identical group layout and each `z: () => series.dataKey` constant picks
// out that series' own slot.
//
// Dot Y positions come from scene `ChartPoint.y` (TanStack-resolved
// y-scale), not a local `valueScale(numValue)` — the only local y range
// that existed before now is owned by TanStack's ChartScale (C2).
// C5 (D432): the mount reveal is now the NATIVE motion renderer's own
// baseline-growth choreography (`internal/motion-renderer.ts`) — bar/
// squares/track marks all keep (or, for squares/track/depth, are reported
// to keep — see handleRender) a `ts-chart__bar*` class alias, which native
// motion's role resolver keys its bar-growth transform off of. This file's
// own `barY()` calls additionally carry an explicit per-mark `motion`
// (`barEnterMotion` below) that encodes bklit's stagger/duration/easing
// exactly, since the renderer-wide automatic stagger's base duration is
// fixed at 1100ms regardless of this chart's `animationDuration` prop
// (dist/motion.js — see handleRender comment). `handleRender` no longer
// drives any WAAPI `.animate()` itself; it only tracks reveal phase and the
// BarPulse hold-gate (`internal/bar-pulse-mark.ts`), which still can't be
// expressed as scene geometry (D381).
import * as React from "react";
import { scaleBand } from "d3-scale";
import type { ScaleBand } from "d3-scale";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { barY, crosshair, defineChart, group, whenFocused } from "@tanstack/charts";
import { tooltip as tooltipExtension } from "@tanstack/charts/tooltip";
import type { ChartAxisTickLabelContext, ChartMark, ChartMarkState, ChartMotionContext, ChartMotionDefinition, ChartPoint, ChartRenderContext, ChartRendererRenderContext, SceneNode } from "@tanstack/charts";
import { extractChildren } from "./children";
import { TooltipContent } from "./internal/tooltip-components";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, FADE_BUFFER, TICKER_HALF_WIDTH, TOOLTIP_BOX_SPRING, TOOLTIP_SPRING } from "./internal/design-tokens";
import { buildPill, type PillBuild } from "./internal/date-pill";
import { selectBarLabelIndices, tickLabelFadeOpacity } from "./internal/axis-ticks";
import { resolveVerticalFadeSides, indicatorFadeGradientStops } from "./internal/fade-mask";
import { resolveIndicatorPixelWidth, toDotConfig, toIndicatorConfig } from "./internal/tooltip-mappers";
import type { SpringConfig } from "./internal/chart-config-context";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartConfig } from "./internal/chart-config-context";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { useFocusInjection, whenSeriesDimmed } from "./internal/focus-injection";
import { createBarFocusStrategy } from "./internal/bar-focus-strategy";
import { barSquaresMark } from "./internal/bar-squares-mark";
import { barColumnTrackMark } from "./internal/bar-column-track-mark";
import { barDepthBackMark, barDepthFrontMark, buildNegBarStops, buildPosBarStops, BAR_FADED_OPACITY, DEFAULT_GROUND_SHADOW as DEFAULT_BAR_DEPTH_GROUND_SHADOW } from "./internal/bar-depth-marks";
import type { BarDepthGradientIds } from "./internal/bar-depth-marks";
import { barPulseMark, buildPulseWaveStops, syncBarPulseGroups } from "./internal/bar-pulse-mark";
import { barTrimmedMark } from "./internal/bar-trimmed-mark";
import { renderPatternPreset } from "./internal/pattern-preset";
import type { BarConfig, BarSquaresConfig, BarColumnTrackConfig, ChartDatum, ChartPhase, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { resolveGridGuide } from "./internal/grid";
import { isRevealed, markRevealed, setRevealDeadline } from "./internal/deferred-reveal";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { resolveMotionEasing } from "./internal/reveal-easing";
import { bezierEasing } from "./internal/bezier-easing";
import { useChartMargin, DEFAULT_CHART_MARGIN, useContainerWidth, type ChartMargin } from "./internal";
import { shortDateFmt } from "./internal/formatters";
import { useSanitizedId } from "./internal/use-sanitized-id";
import {
  createAxisValueProjector,
  createNicedYScale,
  resolveYDomainsByAxis,
} from "./internal/y-domain";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import "./styles.css";

// bklit animation.ts / bar-chart.tsx: reveal 1100ms, cubic-bezier(.85,0,.15,1)
// tween (DEFAULT_CHART_ENTER_TRANSITION) — same duration as the per-bar
// stagger spread, unlike scatter's separate fixed-500ms enter tween.
// P5.5 B1 RETIRES this file's local `REVEAL_EASING`. D327's ground for keeping
// it was verbatim "BarChart has no `animationEasing` prop, so this is the
// INTERNAL reveal ease, not the prop default" — B1 adds that prop, inverting
// the ground, so the value now comes from `./internal/animation-defaults`
// (legacy `animation.ts:4` provenance). It is still NOT `design-tokens.ts`'s
// `REVEAL_EASE_CSS`, which mirrors upstream `motion.ts:209`; see
// animation-defaults.ts's header for why those two must never alias.
// (Closes the bar third of P6.2's narrowed scope.)
// bklit bar.tsx BarInner default `groupGap` (grouped, non-stacked bars only —
// the pilot's only supported layout).
const GROUP_GAP = 4;
// bklit bar.tsx BarInner default `fill` — a single fixed color, NOT a
// rotating per-series palette (unlike scatter's chart-1..5 rotation).
const DEFAULT_BAR_FILL = "var(--chart-line-primary)";

// C1: native mark-state transitions — values verified against the legacy
// bar-hover-chrome.ts DOM-mutation constants (now deleted, replaced by
// `states` below): bars/trimmed-bars use 150ms ease-in-out (legacy
// `DIM_TRANSITION`), squares/depth use 150ms ease-out (legacy
// `BAR_SQUARES_DIM_TRANSITION` / `BAR_DEPTH_DIM_TRANSITION`), and the
// column track uses 150ms ease-in-out (legacy `BAR_TRACK_DIM_TRANSITION`).
const BAR_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { type: "tween", duration: 150, easing: "ease-in-out" };
const BAR_SQUARES_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { type: "tween", duration: 150, easing: "ease-out" };
const BAR_TRACK_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { type: "tween", duration: 150, easing: "ease-in-out" };
const BAR_DEPTH_DIM_TRANSITION: NonNullable<ChartMarkState["transition"]> = { type: "tween", duration: 150, easing: "ease-out" };

/** Row (pointer-hover) dim + legend (programmatic focusSeries) dim — the
 * shared shape used by barY, trimmed bars, and squares. `{focus:'unmatched'}`
 * is group-scoped (dims a candidate unless one of its points is in the
 * currently-focused row); `whenSeriesDimmed()` is `'series'`-scoped
 * (dataKey/group identity), matching legend-driven dim regardless of row. */
function barRowAndSeriesDimStates(
  fadedOpacity: number,
  transition: NonNullable<ChartMarkState["transition"]>,
): ChartMarkState<ChartDatum>[] {
  return [
    { when: { focus: "unmatched" }, style: { opacity: fadedOpacity }, transition },
    { when: whenSeriesDimmed(), style: { opacity: fadedOpacity }, transition },
  ];
}

/** Bar-depth back/front blanket dim: legacy dimmed on `dimByRow (pointer,
 * this row unmatched) || hasLegend (ANY legend hover, not series-matched)` —
 * NOT gated by which series is hovered, unlike bars/squares above. */
function barDepthDimStates(): ChartMarkState<ChartDatum>[] {
  return [
    { when: { focus: "unmatched", source: "pointer" }, style: { opacity: BAR_FADED_OPACITY }, transition: BAR_DEPTH_DIM_TRANSITION },
    { when: (context) => context.focus.source === "programmatic", style: { opacity: BAR_FADED_OPACITY }, transition: BAR_DEPTH_DIM_TRANSITION },
  ];
}

/** Bar-column-track dim: legacy set opacity to 0 whenever ANY pointer-row
 * hover was active, regardless of which row/series — not gated by legend. */
const BAR_TRACK_DIM_STATES: ChartMarkState<ChartDatum>[] = [
  { when: (context) => context.focus.source === "pointer", style: { opacity: 0 }, transition: BAR_TRACK_DIM_TRANSITION },
];

/** bklit bar-chart.tsx:57 — named union, exported so `import type { BarOrientation }` matches legacy. */
export type BarOrientation = "vertical" | "horizontal";

export interface BarChartProps {
  data: ChartDatum[];
  /** Key in data for the categorical axis. Default: "name" (bklit default). */
  xDataKey?: string;
  animationDuration?: number;
  /** P5.5 B1 — bklit `time-series-chart-shell.tsx:136` / `bar-chart.tsx:677`.
      Easing for the per-bar grow reveal. Default: legacy's
      `cubic-bezier(0.85, 0, 0.15, 1)`. */
  animationEasing?: string;
  /** P5.5 B2 — bklit `bar-chart.tsx:71`. Overrides the reveal timing; a spring
      is coerced to a tween (bklit `animation.ts:18`). */
  enterTransition?: EnterTransition;
  /** P5.5 B3 — bklit `bar-chart.tsx:73`. Replay epoch input: bumping it
      replays the grow reveal with no data change (bklit `bar-chart.tsx:386`
      keys its epoch effect on `[animationDuration, revealSignature]`). */
  revealSignature?: string;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  /** Gap between bar groups as a fraction of band width (0-1). Default: 0.2. */
  barGap?: number;
  /** DOC-9 (B13): bklit `barWidth` (bar-chart.tsx:81) — type surface only, no behavior. */
  barWidth?: number;
  /** DOC-9 (B13): bklit `orientation` (bar-chart.tsx:83) — type surface only; pilot renders vertical. */
  orientation?: BarOrientation;
  /** DOC-9 (B13): bklit `stacked` (bar-chart.tsx:85) — type surface only; pilot renders grouped. */
  stacked?: boolean;
  /** DOC-9 (B13): bklit `stackGap` (bar-chart.tsx:87) — type surface only, no behavior. */
  stackGap?: number;
  /** DOC-9 (B13): bklit `squareSnap` (bar-chart.tsx:89) — type surface only, no behavior. */
  squareSnap?: { squareGap: number; groupGap?: number; fit?: boolean };
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: React.ReactNode;
}

// T-E7: DOC-9's bar pilot accepts the five props above so callers typecheck
// identically against legacy and migrated, but renders none of them. Warn once
// per process, in dev only, naming exactly which ones the caller passed.
let didWarnInertBarProps = false;

interface ResolvedSeries {
  dataKey: string;
  /** P6.1 / B7 — bklit `bar.tsx:58`. Undefined means the default ("left") axis. */
  yAxisId?: string | number;
  fill: string;
  /** Tooltip dot / swatch color (bklit extractBarConfigs: stroke ?? fill). */
  dotColor: string;
  lineCap: BarConfig["lineCap"];
  fadedOpacity: number;
}

// C3: what's left of the deleted bar-hover-chrome.ts's `BarHoverChromeState`
// after crosshair/dots moved to native marks — just what the date-pill mount
// effect and `renderTooltipBody`'s rows-fallback still need at call time.
interface BarChromeState {
  series: { dataKey: string; color: string }[];
  tooltip: ChartTooltipConfig | null;
  dateLabels: string[];
}

function resolveCornerRadius(
  lineCap: BarConfig["lineCap"] | undefined,
  groupBandwidth: number,
): number {
  if (typeof lineCap === "number") return lineCap;
  if (lineCap === "butt") return 0;
  // "round" (default): bklit bar.tsx cornerRadius = min(barWidth/2, 8).
  return groupBandwidth > 0 ? Math.min(groupBandwidth / 2, 8) : 0;
}

// C3: static color resolution for the native per-series hover-dot mark —
// preserves the deleted bar-hover-chrome.ts's `resolveDotColor` precedence
// for its two STATIC branches (`tooltip.rows[i].color`, string-typed
// `tooltip.dotColor`) verbatim. The FUNCTION-typed `tooltip.dotColor(point,
// line)` branch is dropped: a native mark's `fill` is one static string per
// mark (DotOptions.fill?: string, dist/dot.d.ts), not a per-hover-frame
// channel, so a color that depends on which point is currently hovered has
// no native route without a renderer reach-in — reported in the C3 summary.
// Legacy's own `tooltip.rows({})` call (bar-hover-chrome.ts) was ALREADY
// point-independent — invoked every hover-move with a bogus empty object,
// only its per-series `.color` fields were ever read — so that branch
// reproduces exactly, evaluated once here instead of once per pointer-move.
function resolveBarDotColor(
  tooltip: ChartTooltipConfig | null | undefined,
  seriesColor: string,
  seriesIndex: number,
  tooltipRowColors: (string | undefined)[] | null,
): string {
  if (tooltip?.rows && tooltipRowColors?.[seriesIndex]) return tooltipRowColors[seriesIndex]!;
  if (typeof tooltip?.dotColor === "string") return tooltip.dotColor;
  return seriesColor;
}

// C3 (byte-identical port of the deleted bar-hover-chrome.ts's ring-dot
// corner-radius formula, itself shared verbatim by every hover-chrome fork).
function barRingCornerRadius(halfExtent: number, cornerRadiusFraction: number): number {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(0.5, cornerRadiusFraction));
}

/**
 * C3: replaces bar-hover-chrome.ts's DOM `ensureDot`/`updateDotPosition`
 * per-series tooltip-dot layer with a hand-built ChartMark, wrapped by the
 * caller in `whenFocused(mark, {match:'group', retarget:true})` so exactly
 * the currently-focused category's dots render.
 *
 * X position is computed DIRECTLY (bandStart + groupOffset + groupHalf),
 * NOT routed through `scales.x.map()`: a native `dot()` mark's own x channel
 * would resolve to the categorical band scale's OWN position (band center),
 * because per-series group-offsetting within a band is a `barY`-only
 * mark-layout feature (`layout: group({scale})`, dist/group.d.ts's
 * `GroupLayout`) — unrelated to and not interchangeable with `dot()`'s own
 * `layout?: DotLayout` option (dist/dot-layout.d.ts, a same-axis
 * band-anchor concept, confirmed by reading both `.d.ts` files). Reproducing
 * bar's per-series offset therefore requires bypassing the scale-mapped x
 * channel and emitting the already-resolved pixel directly — exactly what
 * `point.x` already carried in the legacy TanStack scene (barY's own
 * `layout: group({scale: groupScale})` did this same math at scene-build
 * time; this mark repeats it for its own dot geometry, via the file's
 * `groupScaleForOverlay`/`categoryScaleForOverlay` ranged clones). Y still
 * routes through the real `y` scale channel, same as every other native
 * mark in this file.
 */
function createBarHoverDotMark(
  source: readonly ChartDatum[],
  series: { dataKey: string },
  categoryAccessor: (d: ChartDatum) => string,
  projectValueForKey: (raw: number) => number,
  bandStartForCategory: (category: string) => number,
  groupOffsetX: number,
  groupHalfWidth: number,
  fill: string,
  dotShape: { size: number; strokeWidth: number; isRing: boolean; radiusFraction: number },
  tooltipSpring: SpringConfig,
): ChartMark<ChartDatum, string, number> {
  const { size, strokeWidth, isRing, radiusFraction } = dotShape;
  const cornerRadius = barRingCornerRadius(size, radiusFraction);
  const side = size * 2;
  // Legacy's dot spring is NEVER gated on `discrete` — only the crosshair
  // and pill are (tooltip-chrome.ts `updateDotPosition`'s own comment:
  // "Dot always springs... only a fresh mount snaps in place"). The
  // caller's `whenFocused(..., {retarget:true})` supplies the "fresh mount
  // snaps" behavior for free (no prior DOM node to interpolate from), so
  // this motion is unconditional.
  const motion: ChartMotionDefinition<ChartDatum> = {
    transition: { type: "spring", stiffness: tooltipSpring.stiffness, damping: tooltipSpring.damping },
  };
  return {
    initialize: () => {
      const xValues: (string | undefined)[] = [];
      const yValues: (number | undefined)[] = [];
      for (const d of source) {
        xValues.push(categoryAccessor(d));
        const raw = d[series.dataKey];
        yValues.push(typeof raw === "number" && Number.isFinite(raw) ? projectValueForKey(raw) : undefined);
      }
      return {
        id: `${series.dataKey}--hover-dot`,
        motion,
        channels: {
          x: { scale: "x", values: xValues },
          y: { scale: "y", values: yValues },
        },
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, string, number>[] = [];
          source.forEach((datum, datumIndex) => {
            const category = xValues[datumIndex];
            const yv = yValues[datumIndex];
            if (category === undefined || yv === undefined) return;
            const y = scales.y.map(yv);
            const x = bandStartForCategory(category) + groupOffsetX + groupHalfWidth;
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const point: ChartPoint<ChartDatum, string, number> = {
              key: `${series.dataKey}:${datumIndex}`,
              markId: series.dataKey,
              group: null,
              groupLabel: series.dataKey,
              datum,
              datumIndex,
              xValue: category,
              yValue: yv,
              x,
              y,
              color: fill,
            };
            if (isRing) {
              nodes.push({
                kind: "rect",
                key: `${series.dataKey}:hover-dot:${datumIndex}`,
                x: x - size,
                y: y - size,
                width: side,
                height: side,
                radius: cornerRadius,
                style: { fill: "transparent", stroke: fill, strokeWidth },
                pointOwner: point,
              });
            } else {
              nodes.push({
                kind: "dot",
                key: `${series.dataKey}:hover-dot:${datumIndex}`,
                x,
                y,
                radius: size,
                style: { fill, stroke: "var(--chart-background)", strokeWidth },
                pointOwner: point,
              });
            }
            points.push(point);
          });
          return {
            nodes: [
              {
                kind: "group",
                key: `${series.dataKey}--hover-dot`,
                // B7: census cleanliness — this is an app-owned mark group,
                // not a native TanStack-emitted role class, so it takes the
                // `bkm-chart__` prefix (matches `bkm-chart__bar-pulse`'s B3
                // rename) rather than `ts-chart__`.
                className: "bkm-chart__hover-dot",
                ariaHidden: true,
                children: nodes,
              },
            ],
            points,
          };
        },
      };
    },
  };
}

/** bklit bar-chart.tsx categoryAccessor: shortDateFmt for Date, else String.
    C4: moved verbatim from the deleted internal/bar-x-axis-overlay.tsx (the
    overlay component itself died with the native axis-label migration; this
    accessor is still needed for the `x` mark channel + tick `values`). */
function barCategoryAccessor(xDataKey: string) {
  return (d: ChartDatum): string => {
    const value = d[xDataKey];
    if (value instanceof Date) return shortDateFmt.format(value);
    return String(value ?? "");
  };
}

export function BarChart({
  data,
  xDataKey = "name",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  barGap = 0.2,
  barWidth,
  orientation,
  stacked,
  stackGap,
  squareSnap,
  onPhaseChange,
  children,
}: BarChartProps) {
  if (process.env.NODE_ENV !== "production" && !didWarnInertBarProps) {
    const inert: string[] = [];
    if (barWidth !== undefined) inert.push("barWidth");
    if (orientation !== undefined) inert.push("orientation");
    if (stacked !== undefined) inert.push("stacked");
    if (stackGap !== undefined) inert.push("stackGap");
    if (squareSnap !== undefined) inert.push("squareSnap");
    if (inert.length > 0) {
      didWarnInertBarProps = true;
      console.warn(
        `[BarChart] accepted-but-inert prop${inert.length > 1 ? "s" : ""}: ${inert.join(", ")}. ` +
          "The migrated bar pilot renders vertical, grouped bars only (DOC-9); these are accepted for API parity but have no effect.",
      );
    }
  }
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);
  // bklit ChartCore: `isLoaded` starts false unconditionally — the initial
  // phase is always "revealing" (mirrors scatter-chart.tsx's phaseRef).
  const phaseRef = React.useRef<ChartPhase>("revealing");
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const setPhase = React.useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) return;
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  // Mirrors scatter-chart.tsx: React always runs this effect once after the
  // first paint regardless of the *previous* ref value, so bklit's own
  // `onPhaseChange(isLoaded ? "ready" : "revealing")` effect always fires
  // "revealing" first, unconditionally — bypass the ref-guard once to match.
  React.useEffect(() => {
    onPhaseChangeRef.current?.("revealing");
  }, []);

  // Teardown: cancel the pending reveal-deadline hold-gate timer on unmount
  // (D205 canonical wording — an uncancellable deadline would otherwise fire
  // on a detached DOM after the chart is gone). C5 (D432): the WAAPI
  // post-paint chain + in-flight-animation bookkeeping this used to also
  // tear down is gone — native motion owns its own animation lifecycle, and
  // `handleRender` no longer creates any `Animation` this component must
  // track.
  React.useEffect(() => {
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, []);

  const { bars, barSquares: barSquaresRaw, barColumnTracks: barColumnTracksRaw, barDepthBacks: barDepthBacksRaw, barDepthFronts: barDepthFrontsRaw, barPulses: barPulsesRaw, barDepthProvider, grid, barXAxis, background, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext, focusSeries, clearFocus } = useFocusInjection();
  // C2: hoisted above `definition` so native `tooltip` extension wiring can
  // read it inside the same memo that builds the marks/scales spec.
  const tooltipEnabled = tooltip?.enabled ?? false;

  // bklit bar-chart.tsx: no decimation — every raw row renders as a bar.
  const renderData = data;
  // Reveal replay guard by DATA identity: the `bkmRevealed` DOM stamp dies
  // whenever TanStack recreates the marks group, which also happens on
  // re-renders that change no data (legend hover via ChartLegendHoverProvider
  // — bklit's reveal is state-keyed and never replays there). Data-change
  // recreation keeps replaying exactly as the frozen D214 baselines measured.
  const latestRenderDataRef = React.useRef(renderData);
  latestRenderDataRef.current = renderData;
  const revealedForDataRef = React.useRef<unknown>(null);
  // B2/B3 — reveal timing + replay key. BarChart runs no phase orchestrator, so
  // it carries sankey's `seenRevealKeyRef` shape directly (D311): the reveal
  // replays when the DATA changes (D214 baseline, unchanged) OR when this key
  // changes, mirroring bklit's `[animationDuration, revealSignature]` epoch
  // effect (`bar-chart.tsx:386`). A boolean/DOM flag cannot express that.
  const enterType = enterTransition?.type;
  const enterDuration = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = React.useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterType, enterDuration, enterEaseKey, animationDuration, animationEasing],
  );
  const revealKey = `${revealSignature}|${animationDuration}`;
  const revealedKeyRef = React.useRef<string | null>(null);
  const revealKeyRef = React.useRef(revealKey);
  revealKeyRef.current = revealKey;

  // B2 (C5/D432): explicit per-mark motion, NOT a reliance on native
  // motion's automatic bar stagger. `dist/motion.js`'s automatic delay
  // (`baseDuration*0.4*datumIndex/max(1,datumCount)`, ~line 2502-2503)
  // resolves `baseDuration` from the RENDERER-WIDE default transition
  // (`motion({...})`'s own `transition` option), which `internal/motion-
  // renderer.ts` never sets — so `baseDuration` is ALWAYS the library's
  // fixed 1100ms default, regardless of this chart's `animationDuration`/
  // `enterTransition` props. Legacy's own formula (bar-chart.tsx handleRender,
  // pre-C5: `staggerSpreadMs = revealDurationMs*0.4`,
  // `delaySec = i * (staggerSpreadMs/1000/renderData.length)`) uses the
  // PROP-derived `revealDurationMs`, which only equals 1100 at the library
  // default. Whenever a caller supplies `animationDuration`/`enterTransition`,
  // the automatic default silently diverges from legacy — so every `barY()`
  // mark below is given this explicit callback unconditionally, which is
  // legacy's exact formula restated per-datum (same 0.4 stagger fraction,
  // same duration/easing source) and degenerates to the automatic default's
  // shape only when `revealDurationMs` happens to be 1100.
  //
  // Only the 'enter' phase is overridden. Legacy's WAAPI reveal never
  // animated bar geometry on 'update' (a same-key value/resize change snaps
  // instantly — bklit has no framer transition for that) or 'exit' (removed
  // bars vanish instantly, no fade) — `false` on both matches that silence
  // exactly rather than adopting the native renderer's default transition for
  // cases legacy never animated.
  const barEnterMotion = React.useMemo<ChartMotionDefinition<ChartDatum>>(() => {
    const easing = resolveMotionEasing(revealEasingCss);
    return (context) => {
      if (context.phase !== "enter") return false;
      const count = Math.max(1, context.datumCount);
      return {
        delay: (revealDurationMs * 0.4 * context.datumIndex) / count,
        transition: { type: "tween", duration: revealDurationMs, easing },
      };
    };
  }, [revealDurationMs, revealEasingCss]);

  const categoryAccessor = React.useMemo(() => barCategoryAccessor(xDataKey), [xDataKey]);

  const resolvedSeries = React.useMemo<ResolvedSeries[]>(
    () =>
      bars.map((s) => {
        const fill = s.fill ?? DEFAULT_BAR_FILL;
        return {
          dataKey: s.dataKey,
          yAxisId: s.yAxisId,
          fill,
          dotColor: s.stroke ?? fill,
          lineCap: s.lineCap ?? "round",
          fadedOpacity: s.fadedOpacity ?? 0.3,
        };
      }),
    [bars],
  );

  const hasBarSquares = barSquaresRaw.length > 0;
  const hasBarColumnTrack = barColumnTracksRaw.length > 0;

  const resolvedBarSquares = React.useMemo(() => {
    if (!hasBarSquares) return [] as Array<Required<Pick<BarSquaresConfig, "dataKey">> & Omit<BarSquaresConfig, "dataKey"> & { fill: string; squareGap: number; squareRadius: number; squareFit: boolean; useGradient: boolean; gradientStops: { offset: number; color: string }[]; fadedOpacity: number; groupGap: number; animate: boolean }>;
    return barSquaresRaw.map((s) => ({
      dataKey: s.dataKey,
      // P6.1 / B10 — bklit `bar-squares.tsx:29`.
      yAxisId: s.yAxisId,
      fill: s.fill ?? DEFAULT_BAR_FILL,
      stroke: s.stroke,
      squareGap: s.squareGap ?? 3,
      squareRadius: s.squareRadius ?? 0.25,
      squareFit: s.squareFit ?? false,
      useGradient: s.useGradient ?? false,
      gradientStops: s.gradientStops ?? [],
      patternPreset: s.patternPreset,
      animate: s.animate ?? true,
      fadedOpacity: s.fadedOpacity ?? 0.3,
      staggerDelay: s.staggerDelay,
      groupGap: s.groupGap ?? GROUP_GAP,
    }));
  }, [barSquaresRaw, hasBarSquares]);

  const resolvedBarColumnTracks = React.useMemo(() => {
    if (!hasBarColumnTrack) return [] as Array<Required<Pick<BarColumnTrackConfig, "fill">> & BarColumnTrackConfig & { opacity: number; squareGap: number; squareRadius: number; groupGap: number; squareFit: boolean }>;
    return barColumnTracksRaw.map((s) => ({
      fill: s.fill ?? "var(--chart-grid)",
      opacity: s.opacity ?? 0.3,
      squareGap: s.squareGap ?? 3,
      squareRadius: s.squareRadius ?? 0.25,
      groupGap: s.groupGap ?? GROUP_GAP,
      squareFit: s.squareFit ?? false,
      staggerDelay: s.staggerDelay,
    }));
  }, [barColumnTracksRaw, hasBarColumnTrack]);

  const allSeriesForDomain = React.useMemo(
    () => [
      ...resolvedSeries.map((s) => ({ dataKey: s.dataKey, yAxisId: s.yAxisId })),
      ...resolvedBarSquares.map((s) => ({ dataKey: s.dataKey, yAxisId: s.yAxisId })),
    ],
    [resolvedSeries, resolvedBarSquares],
  );

  // C3: combined series list feeding BOTH the native per-series hover-dot
  // marks AND renderTooltipBody's rows-fallback — replaces the deleted
  // bar-hover-chrome.ts's own `chromeStateRef.current.series` construction
  // (`[...resolvedSeries.map(...), ...resolvedBarSquares.map(...)]`) verbatim,
  // including bar-squares' `stroke ?? fill` dot-color fallback (previously
  // the inline `squaresDotColor` helper).
  const dotSeriesList = React.useMemo(
    () => [
      ...resolvedSeries.map((s) => ({ dataKey: s.dataKey, color: s.dotColor })),
      ...resolvedBarSquares.map((s) => ({ dataKey: s.dataKey, color: s.stroke ?? s.fill })),
    ],
    [resolvedSeries, resolvedBarSquares],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);

  const categoryOrder = React.useMemo(
    () => renderData.map(categoryAccessor),
    [renderData, categoryAccessor],
  );

  // C2: x/y as factories — TanStack's resolveConfiguredScale infers domain
  // from the barY channels (x values) / numeric channels (y) and applies
  // margin-inclusive range itself. We do NOT construct a margin-inclusive
  // range locally; host `<RendererChart aspectRatio>` owns height (C2), and y domain
  // still lives locally via maxValue below.
  const xScaleFactory = React.useMemo(
    () => () => scaleBand<string>().domain(categoryOrder).padding(barGap),
    [categoryOrder, barGap],
  );

  // bklit grouped-bar maxValue: max single value across all series/rows —
  // `[0, (max || 100) * 1.1]`, which is bklit's own `resolveDomain` closure
  // (`bar-chart.tsx:299-309`) verbatim, including the `|| 100` empty fallback.
  //
  // P6.1 / T-F1 (B7 + B10) — that closure is now called once per `yAxisId`
  // group rather than once for the chart, which is exactly how bklit calls it
  // (it hands this same closure to `buildYScalesForLines`). `<Bar>` and
  // `<BarSquares>` both carry the id, so both are in `allSeriesForDomain` and
  // both are grouped. Every bar chart in the codebase today leaves `yAxisId`
  // unset, so this returns `{ left: <the old tuple> }` and nothing moves.
  const resolveBarAxisDomain = React.useCallback(
    (axisSeries: { dataKey: string }[]): [number, number] => {
      let max = 0;
      for (const series of axisSeries) {
        for (const d of renderData) {
          const v = d[series.dataKey];
          if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
        }
      }
      return [0, (max || 100) * 1.1];
    },
    [renderData],
  );

  const yDomainsByAxis = React.useMemo(
    () =>
      resolveYDomainsByAxis({
        series: allSeriesForDomain,
        resolveDomain: resolveBarAxisDomain,
      }),
    [allSeriesForDomain, resolveBarAxisDomain],
  );

  // NOT `domainForAxis`, deliberately: its final fallback is `[0, 100]`, but a
  // bar chart with no series at all resolved to `[0, 110]` before this task
  // (empty scan -> `max || 100` -> `* 1.1`). Falling back through the same
  // closure keeps that exact tuple instead of quietly dropping the headroom.
  const yDomain = React.useMemo<[number, number]>(
    () => yDomainsByAxis[DEFAULT_Y_AXIS_ID] ?? resolveBarAxisDomain([]),
    [yDomainsByAxis, resolveBarAxisDomain],
  );
  // y as a pre-domained instance (not a factory) so its domain/nice is
  // preserved (factory would be re-inferred from channel values, losing the
  // explicit *1.1 headroom). No `.range()` set — TanStack applies the
  // margin-inclusive range itself (C2).
  const yScale = React.useMemo(() => createNicedYScale(yDomain), [yDomain]);

  // P6.1 (B7/B10) — a secondary axis is a value reprojection into the primary
  // (niced) domain, since TanStack's spec carries one `y` scale. Bar resolves
  // it per DATAKEY rather than per mark call, because the same series' value is
  // read by four different mark families here (bars, squares, column tracks,
  // depth faces) and they must not disagree about which axis it is on.
  // Hoisted because the reference-area layer needs the same NICED per-axis
  // domains the marks are projected into (RA2).
  const nicedDomainsByAxis = React.useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      out[axisId] = createNicedYScale(domain).domain() as [number, number];
    }
    return out;
  }, [yDomainsByAxis]);

  const projectYByKey = React.useMemo(() => {
    const projectorFor = createAxisValueProjector(
      nicedDomainsByAxis,
      yScale.domain() as [number, number],
    );
    const byKey = new Map<string, (value: number) => number>();
    for (const series of allSeriesForDomain) {
      byKey.set(series.dataKey, projectorFor(series.yAxisId));
    }
    return byKey;
  }, [nicedDomainsByAxis, yScale, allSeriesForDomain]);

  const projectValue = React.useCallback(
    (dataKey: string, value: number) => {
      const project = projectYByKey.get(dataKey);
      return project ? project(value) : value;
    },
    [projectYByKey],
  );

  // Local band geometry still needed for: groupScale paddingInner proof,
  // per-bar `radius`, and BarXAxisOverlay placement (K3 — overlay stays HTML).
  // Re-derive from xScaleFactory's domain/padding (or equivalently from
  // categoryOrder+barGap) without touching the ranged instance TanStack owns.
  const bandWidth = React.useMemo(() => {
    if (innerWidth <= 0 || categoryOrder.length === 0) return 0;
    // Unranged band so `.bandwidth()` is meaningless — instead compute the
    // same grouped-bar width bklit would use for this band span via step
    // arithmetic, purely for groupBandwidth/groupScale symmetry (C2/K1):
    // we need bandWidth (W) to derive paddingInner → individualBarWidth.
    // So we materialize a ranged clone locally for this single measurement
    // (not used for any rendered coordinate — rendered x comes from TanStack).
    const ranged = scaleBand<string>()
      .domain(categoryOrder)
      .range([margin.left, margin.left + innerWidth])
      .padding(barGap);
    return ranged.bandwidth();
  }, [categoryOrder, barGap, innerWidth, margin.left]);

  const seriesCount = resolvedSeries.length;
  const totalSeriesCount = resolvedSeries.length + resolvedBarSquares.length;
  const allSeriesKeys = React.useMemo(() => [...resolvedSeries.map((s) => s.dataKey), ...resolvedBarSquares.map((s) => s.dataKey)], [resolvedSeries, resolvedBarSquares]);
  // bklit bar.tsx: individualBarWidth = (bandWidth - effectiveGroupGap*(n-1))/n
  // When BarSquares is present, band accounting uses totalSeriesCount (bar-squares.tsx:325-331 squareSize formula).
  const groupBandwidth = React.useMemo(() => {
    const n = totalSeriesCount > 0 ? totalSeriesCount : seriesCount;
    if (n === 0) return bandWidth;
    const effectiveGroupGap = n > 1 ? GROUP_GAP : 0;
    return (bandWidth - effectiveGroupGap * (n - 1)) / n;
  }, [bandWidth, seriesCount, totalSeriesCount]);

  // Nested band scale positioning each series within its category band —
  // paddingInner derived so `.bandwidth()` equals `groupBandwidth` above
  // (see file header for the algebraic derivation). Passed to every barY()
  // call through TanStack's public `group({ scale })` layout API — see header.
  const groupScale = React.useMemo<ScaleBand<string>>(() => {
    const n = totalSeriesCount > 0 ? totalSeriesCount : seriesCount;
    const paddingInner = n > 1 ? (n * GROUP_GAP) / (bandWidth + GROUP_GAP) : 0;
    const domain = n === totalSeriesCount && totalSeriesCount > 0 ? allSeriesKeys : resolvedSeries.map((s) => s.dataKey);
    return scaleBand<string>()
      .domain(domain)
      .paddingInner(paddingInner)
      .paddingOuter(0);
  }, [resolvedSeries, seriesCount, totalSeriesCount, bandWidth, allSeriesKeys]);

  // Keep a one-off ranged categoryScale instance ONLY for BarXAxisOverlay
  // (which needs `categoryScale(label) → bandStart` at known margin), not
  // for any focus/hover math. C1 removed the hover math's `categoryScale`
  // read; C2 removed the hover math's `valueScale` read (dots now from
  // scene points).
  const categoryScaleForOverlay = React.useMemo<ScaleBand<string>>(() => {
    return scaleBand<string>()
      .domain(categoryOrder)
      .range([margin.left, margin.left + innerWidth])
      .padding(barGap);
  }, [categoryOrder, margin.left, innerWidth, barGap]);

  // C3: RANGED clone of `groupScale` (same domain/paddingInner, but ranged
  // over `[0, bandWidth]`) so `createBarHoverDotMark` can resolve a real
  // pixel group-offset for its series (`groupScaleForOverlay(dataKey)`) —
  // `groupScale` itself is deliberately left unranged (see its own comment)
  // because barY's `layout: group({scale: groupScale})` ranges its own
  // internal copy; this is a second, ranged copy for app-layer use only,
  // mirroring how `categoryScaleForOverlay` already shadows the unranged
  // band domain for the same reason.
  const groupScaleForOverlay = React.useMemo<ScaleBand<string>>(() => {
    return scaleBand<string>()
      .domain(groupScale.domain())
      .paddingInner(groupScale.paddingInner())
      .paddingOuter(groupScale.paddingOuter())
      .range([0, bandWidth]);
  }, [groupScale, bandWidth]);

  // C1: custom band-category focus strategy — bklit-parity band-index
  // division (Math.floor((x-margin.left)/innerWidth*n)) rather than nearest
  // band-center. Getters keep resolve reading current layout without re-
  // creating the strategy object.
  const getCategoryOrder = React.useCallback(() => categoryOrder, [categoryOrder]);
  const getInnerWidth = React.useCallback(() => innerWidth, [innerWidth]);
  const barFocusStrategy = React.useMemo(
    () =>
      createBarFocusStrategy({
        phaseRef,
        getCategoryOrder,
        getInnerWidth,
        marginLeft: margin.left,
      }),
    [getCategoryOrder, getInnerWidth, margin.left],
  );

  const isHorizontalOrStacked = false;
  const barSquaresEnabled = hasBarSquares && !isHorizontalOrStacked && totalSeriesCount > 0;
  const barColumnTrackEnabled = hasBarColumnTrack && !isHorizontalOrStacked && totalSeriesCount > 0;
  const hasBarDepth = barDepthBacksRaw.length > 0 || barDepthFrontsRaw.length > 0 || barPulsesRaw.length > 0;
  const barDepthEnabled = hasBarDepth && !isHorizontalOrStacked;

  // C3: gradient id for the crosshair rule's fade-edges stroke (`stroke:
  // url(#id)` on a `<line>`, replacing the deleted indicator's `<rect
  // fill="url(#id)">` gradient trick — see the linearGradient JSX below for
  // why `gradientUnits="userSpaceOnUse"` is required for a zero-bbox line).
  const indicatorGradientId = useSanitizedId();
  const squaresBaseId = useSanitizedId();
  const squaresDefs = React.useMemo(() => {
    if (!barSquaresEnabled) return [] as Array<{ dataKey: string; gradientId: string; patternId: string | null; fill: string; gradientStops: { offset: number; color: string }[]; patternPreset?: import("./internal/pattern-preset").PatternPresetId }>;
    const out: Array<{ dataKey: string; gradientId: string; patternId: string | null; fill: string; gradientStops: { offset: number; color: string }[]; patternPreset?: import("./internal/pattern-preset").PatternPresetId }> = [];
    for (let i = 0; i < resolvedBarSquares.length; i++) {
      const s = resolvedBarSquares[i]!;
      if (!s.useGradient) continue;
      const gradientId = `${squaresBaseId}-bar-squares-gradient-${i}`;
      const isPatternFill = s.fill.startsWith("url(");
      const hasPattern = !!(isPatternFill && s.patternPreset && s.patternPreset !== "none");
      const patternId = `${squaresBaseId}-bar-squares-pattern-${i}`;
      const stops = s.gradientStops.length >= 2 ? s.gradientStops : [{ offset: 0, color: s.fill }, { offset: 100, color: s.fill }];
      out.push({ dataKey: s.dataKey, gradientId, patternId: hasPattern ? patternId : null, fill: s.fill, gradientStops: stops, patternPreset: hasPattern ? s.patternPreset : undefined });
    }
    return out;
  }, [barSquaresEnabled, resolvedBarSquares, squaresBaseId]);
  const squaresDefsByKey = React.useMemo(() => {
    const m = new Map<string, typeof squaresDefs[number]>();
    for (const d of squaresDefs) m.set(d.dataKey, d);
    return m;
  }, [squaresDefs]);

  // Depth: bklit bar-depth.tsx's per-bar (objectBoundingBox) glass gradients
  // + directional side/lid shade gradients — built ONCE per chart (not per
  // bar, unlike squaresDefs) since objectBoundingBox makes a single gradient
  // def correct for every bar regardless of its height (bklit's own
  // rationale, bar-depth.tsx:301-306).
  const depthBaseId = useSanitizedId();
  const depthGroundShadow = barDepthProvider?.groundShadow ?? DEFAULT_BAR_DEPTH_GROUND_SHADOW;
  const depthGradientIds = React.useMemo<BarDepthGradientIds>(
    () => ({
      glassPosId: `${depthBaseId}-bar-depth-glass-pos`,
      glassNegId: `${depthBaseId}-bar-depth-glass-neg`,
      sideShadeRtlId: `${depthBaseId}-bar-depth-side-rtl`,
      sideShadeLtrId: `${depthBaseId}-bar-depth-side-ltr`,
      topShadeId: `${depthBaseId}-bar-depth-top-shade`,
    }),
    [depthBaseId],
  );
  const depthGlassPosStops = React.useMemo(() => buildPosBarStops(depthGroundShadow), [depthGroundShadow]);
  const depthGlassNegStops = React.useMemo(() => buildNegBarStops(depthGroundShadow), [depthGroundShadow]);
  // BarPulse wave gradient (bklit bar-depth.tsx BarPulse defs) — one shared
  // def; the wave rect's fill references it by id from inside the marks svg.
  const pulseWaveGradientId = `${depthBaseId}-bar-pulse-wave-grad`;
  const pulseWaveStops = React.useMemo(() => buildPulseWaveStops(), []);

  // T-D5: the six objectBoundingBox depth/pulse gradients emit natively via
  // `spec.gradients` — TanStack's renderer writes them into the chart svg's
  // `<defs data-ts-key="gradients">` and rewrites matching url(#id) mark
  // fills. Fractions (0-1) serialize as percentages; stop opacities pass
  // through the serializer's 2dp rounding (all painted values are exact).
  const nativeDepthGradients = React.useMemo(
    () => [
      {
        id: depthGradientIds.glassPosId,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: depthGlassPosStops.map((s) => ({
          offset: Number.parseFloat(s.offset) / 100,
          color: s.color,
          opacity: Number(s.opacity),
        })),
      },
      {
        id: depthGradientIds.glassNegId,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: depthGlassNegStops.map((s) => ({
          offset: Number.parseFloat(s.offset) / 100,
          color: s.color,
          opacity: Number(s.opacity),
        })),
      },
      {
        id: depthGradientIds.sideShadeRtlId,
        x1: 1,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: [
          { offset: 0, color: "black", opacity: 0.05 },
          { offset: 1, color: "black", opacity: 0.55 },
        ],
      },
      {
        id: depthGradientIds.sideShadeLtrId,
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 1,
        stops: [
          { offset: 0, color: "black", opacity: 0.05 },
          { offset: 1, color: "black", opacity: 0.55 },
        ],
      },
      {
        id: depthGradientIds.topShadeId,
        x1: 0,
        y1: 1,
        x2: 0,
        y2: 0,
        stops: [
          { offset: 0, color: "black", opacity: 0 },
          { offset: 1, color: "black", opacity: 0.18 },
        ],
      },
      {
        id: pulseWaveGradientId,
        x1: 0,
        y1: 1,
        x2: 0,
        y2: 0,
        stops: pulseWaveStops.map((s) => ({
          offset: Number.parseFloat(s.offset) / 100,
          color: s.color,
          opacity: Number(s.opacity),
        })),
      },
    ],
    [depthGradientIds, depthGlassPosStops, depthGlassNegStops, pulseWaveStops, pulseWaveGradientId],
  );

  // C3: hoisted above `definition` — the crosshair/hover-dot marks built
  // inside it need `chartConfig.tooltipSpring` for their `motion` springs
  // (context-driven override, matching the deleted bar-hover-chrome.ts's own
  // `attachBarHoverChrome(el, ..., {tooltipSpring: chartConfig.tooltipSpring})`).
  const chartConfig = useChartConfig();

  // C4: axis-label proximity fade, formerly `date-pill.ts`'s imperative
  // `applyLabelFade`/`resetLabelFade` DOM-span mutators. `handleFocusGroupChange`
  // sets/clears this; the `definition` memo below reads it in a native
  // `tickLabels.opacity` per-tick callback (`tickLabelFadeOpacity`). A
  // per-focus-step `definition` rebuild is accepted (research decision, not
  // throttled).
  const [labelFade, setLabelFade] = React.useState<{ primaryX: number; hoveredLabel: string | null } | null>(null);

  const definition = React.useMemo(() => {
    if (width <= 0 || (resolvedSeries.length === 0 && resolvedBarSquares.length === 0)) return null;
    const gridGuide = resolveGridGuide(grid);
    const hasSquares = barSquaresEnabled;
    const hasTrack = barColumnTrackEnabled;
    const hasDepth = barDepthEnabled;

    // C4: native axis tick labels replace the deleted `BarXAxisOverlay`.
    // `values`/`count` are mutually exclusive on `ChartAxisTickOptions`
    // (passing both throws) — configured `barXAxis` switches x ticks from
    // count-driven to explicit kept categories (bar-x-axis.tsx's own modulo
    // thinning, `selectBarLabelIndices`, NOT the even-spacing optimizer
    // line/scatter's overlay used — bar's category axis has no dedupe-by-
    // label case, every category already has a distinct bar). `dy: margin
    // .bottom - 25` reproduces the overlay's `bottom: 12` HTML placement in
    // tick-label offset space.
    const xAxisOptions = barXAxis
      ? {
          ticks: {
            values: selectBarLabelIndices(
              categoryOrder.length,
              barXAxis.showAllLabels ?? false,
              barXAxis.maxLabels ?? 12,
            ).map((i) => categoryOrder[i]!),
            format: (v: unknown) => String(v),
            size: 0,
            padding: 0,
          },
          line: false as const,
          tickLabels: {
            fontSize: 12,
            thin: false,
            dy: margin.bottom - 25,
            opacity: labelFade
              ? (ctx: ChartAxisTickLabelContext) =>
                  tickLabelFadeOpacity(
                    ctx.position,
                    String(ctx.value),
                    labelFade.primaryX,
                    labelFade.hoveredLabel,
                    barXAxis?.tickerHalfWidth ?? TICKER_HALF_WIDTH,
                    FADE_BUFFER,
                  )
              : 1,
            // B6/AX5 (D431): bklit chart-phase.ts DEFAULT_Y_DOMAIN_TWEEN_MS —
            // the axis-label position tween (design-tokens.ts:48-53) — died
            // in C4 with the HTML axis overlays (native <text> has no CSS
            // `left`/`top` to transition) and returns here through native
            // motion's own `tickLabels.motion`, which C4 could not use yet
            // (no motion renderer existed pre-C5). `false` on enter: legacy
            // never animated a label's FIRST appearance, only its position
            // change on data changes (mirrors `barEnterMotion`'s own
            // enter-only convention above). `ChartMotionContext<unknown>`,
            // not `<ChartDatum>`: `tickLabels.motion`'s declared type is
            // `ChartMotionDefinition` (TDatum defaults to `unknown`), and a
            // narrower parameter type here is contravariantly incompatible
            // with that declared callback shape.
            motion: (ctx: ChartMotionContext<unknown>) =>
              ctx.phase === "enter" ? false : { transition: { type: "tween" as const, duration: 500, easing: bezierEasing } },
          },
        }
      : {
          ticks: { count: gridGuide.columnTicks, size: 0 },
          line: false as const,
          tickLabels: false as const,
        };
    // Bar never drew y-axis labels (BarXAxisOverlay only ever covered x) —
    // nothing may paint once the `.ts-chart__axes { display: none }` CSS
    // gate lifts.
    const yAxisOptions = {
      ticks: { count: gridGuide.ticks, size: 0 },
      line: false as const,
      tickLabels: false as const,
    };
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
          anchor: { x: "group-center", y: "plot-top" } as const,
          placement: ["right", "left"] as const,
          offset: BOX_OFFSET,
          motion: (renderData.length > DISCRETE_INTERACTION_THRESHOLD
            ? false
            : { type: "spring", stiffness: TOOLTIP_BOX_SPRING.stiffness, damping: TOOLTIP_BOX_SPRING.damping }) as false | { type: "spring"; stiffness: number; damping: number },
        }
      : (false as const);

    // C3: large-dataset motion cutoff, shared by the crosshair/hover-dot
    // marks below AND the native tooltip extension's own `motion` above
    // (same DISCRETE_INTERACTION_THRESHOLD, verified strict `>`).
    const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

    // C3: crosshair + per-series hover-dot marks — native replacement for
    // the deleted bar-hover-chrome.ts's imperative indicator/dot SVG layers.
    // Both gated on `tooltip?.enabled` exactly like `tooltipOption` above (no
    // tooltip config -> no hover chrome at all, matching legacy's
    // `attachBarHoverChrome` only being mounted when `tooltipEnabled`).
    const hoverMarks: ChartMark<ChartDatum, string, number>[] = [];
    if (tooltipEnabled) {
      if (tooltip?.showCrosshair ?? true) {
        // Config resolution mirrors legacy's `buildIndicator` exactly
        // (tooltip-mappers.ts's `toIndicatorConfig` is the byte-identical
        // extraction of the same mapping bar-hover-chrome.ts used inline via
        // `toIndicatorConfig(getState().tooltip)`). PRESERVED QUIRK:
        // `indicatorColor` as a function is never actually invoked — legacy's
        // ternary only special-cased the STRING form, falling through to the
        // CSS var for anything else (including functions); reproduced here
        // verbatim, not "fixed" (matches scatter-chart.tsx's own C3 note).
        const indicatorCfg = toIndicatorConfig(tooltip);
        const isDashed = Boolean(indicatorCfg.dasharray);
        const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
        const indicatorColorValue = typeof indicatorCfg.color === "string" ? indicatorCfg.color : "var(--chart-crosshair)";
        const indicatorSpringCfg = indicatorCfg.springConfig ?? chartConfig.tooltipSpring;
        // Native `crosshair()`'s vertical rule reproduces legacy's indicator
        // geometry directly — width/color/dasharray/fade-gradient all map
        // onto its `x` rule options one for one, and its `strokeOpacity`
        // default of 0.35 (dist/crosshair.js `resolveRuleStyle`) is
        // explicitly overridden to 1 to avoid a silent visual regression.
        // `y` stays off (legacy never drew a horizontal guide — bar's
        // indicator was always vertical-only, one per hovered category).
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
          }) as ChartMark<ChartDatum, string, number>,
        );
      }
      if (tooltip?.showDots ?? true) {
        // Ring-dot sizing is inert (bar.md deviation, preserved verbatim from
        // bar-hover-chrome.ts's own comment): bandWidth was never populated
        // by any caller, so dots always used the plain dot config.
        const dotCfg = toDotConfig(tooltip);
        const variant = dotCfg.variant ?? "dot";
        const isRing = variant === "ring";
        const rawSize = dotCfg.size ?? 5;
        const size = rawSize * (dotCfg.scale ?? 1);
        const strokeWidth = dotCfg.strokeWidth ?? (isRing ? 1.5 : 2);
        const radiusFraction = dotCfg.radiusFraction ?? 0.25;
        // Legacy's `resolveDotColor` `tooltip.rows[i].color` branch is
        // point-independent in practice: bar-hover-chrome.ts's own `update()`
        // called `tooltip.rows({})` with a bogus empty object on every
        // hover-move, so only the per-series `.color` fields were ever read.
        // Reproduced faithfully as a ONE-TIME computation here instead of a
        // per-hover-frame one (a native `dot`-style mark's `fill` is a static
        // string per mark, dist/dot.d.ts — it could not be recomputed per
        // frame even if we wanted to).
        const tooltipRowColors = tooltip?.rows ? tooltip.rows({} as Record<string, unknown>).map((r) => r.color) : null;
        const groupHalfWidth = groupScaleForOverlay.bandwidth() / 2;
        dotSeriesList.forEach((series, seriesIndex) => {
          const groupOffsetX = groupScaleForOverlay(series.dataKey) ?? 0;
          const fill = resolveBarDotColor(tooltip, series.color, seriesIndex, tooltipRowColors);
          hoverMarks.push(
            whenFocused(
              createBarHoverDotMark(
                renderData,
                series,
                categoryAccessor,
                (raw) => projectValue(series.dataKey, raw),
                (category) => categoryScaleForOverlay(category) ?? 0,
                groupOffsetX,
                groupHalfWidth,
                fill,
                { size, strokeWidth, isRing, radiusFraction },
                chartConfig.tooltipSpring,
              ),
              { match: "group", retarget: true },
            ),
          );
        });
      }
    }

    if (!hasSquares && !hasTrack && !hasDepth) {
      const marks: ChartMark<ChartDatum, string, number>[] = [];
      for (const series of resolvedSeries) {
        marks.push(
          barY(renderData, {
            id: series.dataKey,
            x: (d: ChartDatum) => categoryAccessor(d),
            y: (d: ChartDatum) => projectValue(series.dataKey, d[series.dataKey] as number),
            z: () => series.dataKey,
             layout: group({ scale: groupScale }),
            fill: series.fill,
            radius: resolveCornerRadius(series.lineCap, groupBandwidth),
            states: barRowAndSeriesDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
            motion: barEnterMotion,
          }),
        );
      }
      marks.push(...hoverMarks);
      const spec = {
        marks,
        // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
        // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
        // key on the spec is never read.
        scales: {
          x: { scale: xScaleFactory, grid: gridGuide.vertical, axis: xAxisOptions },
          y: {
            scale: yScale,
            grid: gridGuide.horizontal,
            axis: yAxisOptions,
          },
        },
        margin,
        theme: { muted: "var(--color-chart-label, var(--chart-label))" },
        svgAnimation: false as const,
      } as const;
      const base = defineChart(spec);
      return defineChart(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY, tooltip: tooltipOption });
    }
    const marks: ChartMark<ChartDatum, string, number>[] = [];
    const bandPosFn = (label: string) => categoryScaleForOverlay(label) ?? 0;
    const totalN = totalSeriesCount;
    // Underlay ordering: BarColumnTrack BEFORE bars/squares (mirror ReferenceArea underlay).
    if (hasTrack) {
      for (let t = 0; t < resolvedBarColumnTracks.length; t++) {
        const track = resolvedBarColumnTracks[t]!;
        for (let sIdx = 0; sIdx < allSeriesKeys.length; sIdx++) {
          const dataKey = allSeriesKeys[sIdx]!;
          const trackId = `bar-column-track-${t}-${sIdx}`;
          marks.push(
            barColumnTrackMark(renderData, {
              id: trackId,
              data: renderData,
              seriesIndex: sIdx,
              seriesCount: totalN,
              groupGap: track.groupGap,
              bandWidth,
              bandPos: bandPosFn,
              categoryAccessor,
              yAccessor: (d: ChartDatum) => projectValue(dataKey, d[dataKey] as number),
              fill: track.fill,
              opacity: track.opacity,
              squareGap: track.squareGap,
              squareRadius: track.squareRadius,
              squareFit: track.squareFit,
              states: BAR_TRACK_DIM_STATES,
            }),
          );
        }
      }
    }
    if (hasSquares) {
      for (let sIdx = 0; sIdx < resolvedBarSquares.length; sIdx++) {
        const s = resolvedBarSquares[sIdx]!;
        const seriesIndex = allSeriesKeys.indexOf(s.dataKey);
        const def = squaresDefsByKey.get(s.dataKey);
        const gradientId = def?.gradientId ?? `${squaresBaseId}-bar-squares-gradient-${sIdx}`;
        const patternId = def?.patternId ?? `${squaresBaseId}-bar-squares-pattern-${sIdx}`;
        marks.push(
          barSquaresMark(renderData, {
            id: s.dataKey,
            data: renderData,
            seriesIndex: seriesIndex >= 0 ? seriesIndex : sIdx,
            seriesCount: totalN,
            groupGap: s.groupGap,
            bandWidth,
            bandPos: bandPosFn,
            categoryAccessor,
            yAccessor: (d: ChartDatum) => projectValue(s.dataKey, d[s.dataKey] as number),
            fill: def ? def.fill : s.fill,
            squareGap: s.squareGap,
            squareRadius: s.squareRadius,
            squareFit: s.squareFit,
            useGradient: s.useGradient,
            gradientStops: s.gradientStops,
            patternPreset: s.patternPreset,
            gradientId,
            patternId,
            states: barRowAndSeriesDimStates(s.fadedOpacity, BAR_SQUARES_DIM_TRANSITION),
          }),
        );
      }
    }
    // Depth: Back faces beneath bars
    if (hasDepth) {
      for (const b of barDepthBacksRaw) {
        const series = resolvedSeries.find((s) => s.dataKey === b.dataKey);
        if (!series) continue;
        marks.push(
          barDepthBackMark(renderData, {
            id: `bar-depth-back-${b.dataKey}`,
            data: renderData,
            bandWidth,
            bandScale: categoryScaleForOverlay as unknown as { step?: () => number },
            bandPos: bandPosFn,
            categoryAccessor,
            yAccessor: (d: ChartDatum) => projectValue(b.dataKey, d[b.dataKey] as number),
            fill: b.color ?? series.fill,
            gradientIds: depthGradientIds,
            states: barDepthDimStates(),
          }),
        );
      }
    }
    // Remaining plain bars — trimmed when depth present, else stock barY
    const squaresKeys = new Set(resolvedBarSquares.map((s) => s.dataKey));
    const depthKeys = hasDepth ? new Set([...barDepthBacksRaw.map((b) => b.dataKey), ...barDepthFrontsRaw.map((b) => b.dataKey)]) : new Set<string>();
    const needsTrim = (dataKey: string) => hasDepth && depthKeys.has(dataKey);
    for (const series of resolvedSeries) {
      if (squaresKeys.has(series.dataKey)) continue;
      if (needsTrim(series.dataKey)) {
        const innerW = Math.max(0, width - margin.left - margin.right);
        marks.push(
          barTrimmedMark(renderData, {
            id: series.dataKey,
            data: renderData,
            groupBandwidth,
            groupScale,
            fill: series.fill,
            // bklit bar.tsx:256-259 — perspective bars force cornerRadius to
            // 0 regardless of `lineCap` so the flat-top 3D lid meets the
            // front face with no gap/wedge (rounded corners would leave one).
            radius: 0,
            bandWidth,
            bandScale: categoryScaleForOverlay as unknown as { step?: () => number },
            categoryAccessor,
            yAccessor: (d: ChartDatum) => projectValue(series.dataKey, d[series.dataKey] as number),
            innerWidth: innerW,
            chartX: margin.left,
            centerX: margin.left + innerW / 2,
            maxDepth: 0,
            states: barRowAndSeriesDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
          }),
        );
        continue;
      }
      marks.push(
        barY(renderData, {
          id: series.dataKey,
          x: (d: ChartDatum) => categoryAccessor(d),
          y: (d: ChartDatum) => projectValue(series.dataKey, d[series.dataKey] as number),
          z: () => series.dataKey,
           layout: group({ scale: groupScale }),
          fill: series.fill,
          radius: resolveCornerRadius(series.lineCap, groupBandwidth),
          states: barRowAndSeriesDimStates(series.fadedOpacity, BAR_DIM_TRANSITION),
          motion: barEnterMotion,
        }),
      );
    }
    // Depth: Front chrome above bars
    if (hasDepth) {
      for (const f of barDepthFrontsRaw) {
        marks.push(
          barDepthFrontMark(renderData, {
            id: `bar-depth-front-${f.dataKey}`,
            data: renderData,
            bandWidth,
            bandScale: categoryScaleForOverlay as unknown as { step?: () => number },
            bandPos: bandPosFn,
            categoryAccessor,
            yAccessor: (d: ChartDatum) => projectValue(f.dataKey, d[f.dataKey] as number),
            gradientIds: depthGradientIds,
            states: barDepthDimStates(),
          }),
        );
      }
      for (const p of barPulsesRaw) {
        const m = barPulseMark(renderData, {
          id: `bar-pulse-${p.dataKey}`,
          data: renderData,
          bandWidth,
          bandScale: categoryScaleForOverlay as unknown as { step?: () => number },
          bandPos: bandPosFn,
          categoryAccessor,
          yAccessor: (d: ChartDatum) => projectValue(p.dataKey, d[p.dataKey] as number),
          activeIndex: p.activeIndex,
          pulsePaused: p.pulsePaused,
          gradientId: pulseWaveGradientId,
        });
        if (m) marks.push(m);
      }
    }
    marks.push(...hoverMarks);
    const spec = {
      marks,
      // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
      // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
      // key on the spec is never read.
      scales: {
        x: { scale: xScaleFactory, grid: gridGuide.vertical, axis: xAxisOptions },
        y: {
          scale: yScale,
          grid: gridGuide.horizontal,
          axis: yAxisOptions,
        },
      },
      margin,
      gradients: nativeDepthGradients,
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      svgAnimation: false as const,
    } as const;
    const base = defineChart(spec);
    return defineChart(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY, tooltip: tooltipOption });
  }, [
    renderData,
    categoryAccessor,
    resolvedSeries,
    resolvedBarSquares,
    resolvedBarColumnTracks,
    barDepthBacksRaw,
    barDepthFrontsRaw,
    barPulsesRaw,
    groupScale,
    groupBandwidth,
    xScaleFactory,
    yScale,
    grid,
    margin,
    width,
    barFocusStrategy,
    barSquaresEnabled,
    barColumnTrackEnabled,
    barDepthEnabled,
    totalSeriesCount,
    allSeriesKeys,
    bandWidth,
    categoryScaleForOverlay,
    squaresDefsByKey,
    squaresBaseId,
    depthGradientIds,
    nativeDepthGradients,
    tooltipEnabled,
    tooltip,
    chartConfig,
    groupScaleForOverlay,
    dotSeriesList,
    indicatorGradientId,
    barXAxis,
    categoryOrder,
    labelFade,
    barEnterMotion,
  ]);

  // C3: date-pill + label-fade chrome only — crosshair/dots are now native
  // marks built inside `definition` above. `chromeStateRef` shrinks to just
  // what `renderTooltipBody` (series/tooltip) and the pill mount effect
  // (dateLabels) still need at call time; `margin`/`showCrosshair`/`showDots`
  // are gone since neither consumer left reads them.
  const chromeStateRef = React.useRef<BarChromeState | null>(null);
  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return shortDateFmt.format(v);
    return String(v ?? "");
  }), [renderData, xDataKey]);
  chromeStateRef.current = {
    series: dotSeriesList,
    tooltip: tooltip ?? null,
    dateLabels: dateLabelsForPill,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  // C1: legend hover drives native mark `states` dim via programmatic focus
  // (replaces the old chromeRef.current?.syncDim() DOM-mutation sync).
  React.useEffect(() => {
    if (legendHoveredIndex == null) {
      clearFocus();
      return;
    }
    const key = allSeriesKeys[legendHoveredIndex];
    if (key != null) {
      focusSeries(key);
    } else {
      clearFocus();
    }
  }, [legendHoveredIndex, allSeriesKeys, focusSeries, clearFocus]);

  // C3: date-pill-only mount — crosshair/dots are native marks now, so this
  // effect no longer attaches `attachBarHoverChrome`'s full indicator/dot/
  // pill trio, just the sanctioned-extension pill DOM (`internal/date-pill.ts`
  // `buildPill`, byte-identical twin of the deleted tooltip-chrome.ts
  // version).
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

  // C1: TanStack-native focus → BarFocusGroup adapter, driven only by
  // `onFocusGroupChange` (no container pointer listeners).
  const categoryIndexByLabel = React.useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < categoryOrder.length; i++) m.set(categoryOrder[i]!, i);
    return m;
  }, [categoryOrder]);

  // C3: shrunk to date-pill + axis-label-fade only (crosshair/dot positioning
  // is now entirely inside the native marks above — this handler no longer
  // builds a `BarFocusGroup`/`BarFocusPoint[]` for a chrome object to consume).
  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, string, number>[]) => {
      const pillBuild = pillRef.current;
      if (points.length === 0) {
        pillVisibleRef.current = false;
        if (pillBuild) {
          pillBuild.layer.style.display = "none";
          pillBuild.spring.stop();
          pillBuild.label.textContent = "";
        }
        setLabelFade((prev) => (prev === null ? prev : null));
        return;
      }
      // Category = xValue of any point in the grouped set.
      const categoryLabel = String(points[0]!.xValue);
      const categoryIndex = categoryIndexByLabel.get(categoryLabel) ?? 0;
      // Band center anchor — recover the TanStack band center from the local
      // ranged clone (parallels the barY `x` computation). Using the mean of
      // per-series point.x is not band-center for even n / asymmetric padding —
      // `point.x = bandCenter - W/2 + groupMid` averages to bandCenter only
      // when group mids are symmetric, which they are not under barY's
      // groupScale `paddingInner` derivation. So derive anchor from the same
      // scale clone BarXAxisOverlay uses (single source of band truth).
      const bandStart = categoryScaleForOverlay(String(categoryLabel)) ?? 0;
      const anchorX = bandStart + bandWidth / 2;
      const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
      const showDatePill = tooltipEnabled && (tooltip?.showDatePill ?? true);
      const showing = !pillVisibleRef.current;
      pillVisibleRef.current = true;

      if (pillBuild) {
        if (showDatePill) {
          pillBuild.layer.style.display = "";
          if (pillBuild.ticker && chromeStateRef.current?.dateLabels && chromeStateRef.current.dateLabels.length > 0) {
            pillBuild.ticker.update(categoryIndex, discrete);
          } else {
            pillBuild.label.textContent = categoryLabel;
          }
          if (showing || discrete) pillBuild.spring.jump(anchorX);
          else pillBuild.spring.set(anchorX);
        } else {
          pillBuild.layer.style.display = "none";
        }
      }

      // C4: axis-label fade — the `definition` memo's native `tickLabels
      // .opacity` callback reads `barXAxis?.tickerHalfWidth`/`FADE_BUFFER`
      // itself; this only carries the raw pill anchor + hovered label.
      setLabelFade((prev) =>
        prev && prev.primaryX === anchorX && prev.hoveredLabel === categoryLabel
          ? prev
          : { primaryX: anchorX, hoveredLabel: categoryLabel },
      );
    },
    [categoryIndexByLabel, categoryScaleForOverlay, bandWidth, renderData.length, tooltipEnabled, tooltip],
  );

  // C2: native tooltip body — reuses `TooltipContent` verbatim (same row
  // component/ordering/formatting as the legacy DOM box). Reads
  // `chromeStateRef.current` at call time (mirrors the chrome's own
  // `getState()` pattern) so it never needs its own copy of `tooltip`/
  // `series` in its dependency array. Value derivation mirrors
  // `handleFocusGroupChange`'s raw-datum-over-`yValue` fallback exactly (see
  // the comment there — `yValue` is reprojected for secondary-axis series
  // and wrong for tooltip text).
  const renderTooltipBody = React.useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, string, number>): React.ReactNode => {
      if (ctx.points.length === 0) return null;
      const state = chromeStateRef.current;
      const tt = state?.tooltip ?? null;
      const categoryLabel = String(ctx.points[0]!.xValue);
      const categoryIndex = categoryIndexByLabel.get(categoryLabel) ?? 0;
      const pointByMark = new Map(ctx.points.map((p) => [p.markId, p]));
      const valueFor = (p: ChartPoint<ChartDatum, string, number>): number => {
        const raw = (p.datum as ChartDatum | undefined)?.[p.markId];
        return typeof raw === "number" ? raw : (p.yValue as number);
      };
      if (tt?.content) {
        const pointRec: ChartTooltipPoint = { label: categoryLabel };
        for (const p of ctx.points) pointRec[p.markId] = valueFor(p);
        return tt.content({ point: pointRec, index: categoryIndex });
      }
      let rows: TooltipRow[];
      if (tt?.rows) {
        const pointRec: Record<string, unknown> = { label: categoryLabel };
        for (const p of ctx.points) pointRec[p.markId] = valueFor(p);
        rows = tt.rows(pointRec);
      } else {
        const seriesList = state?.series ?? [];
        rows = seriesList.map((series) => {
          const p = pointByMark.get(series.dataKey);
          return { color: series.color || p?.color || "transparent", label: series.dataKey, value: p ? valueFor(p) : 0 };
        });
      }
      return (
        <TooltipContent title={categoryLabel} rows={rows}>
          {tt?.children}
        </TooltipContent>
      );
    },
    [categoryIndexByLabel],
  );

  // C5 (D432): mount reveal is now the native motion renderer's own
  // baseline-growth choreography, driven by `barEnterMotion` (bar rects) and
  // the class aliases KEPT on squares/track/depth marks (see the definition
  // memo above / this file's B2 report for the foreign-file citations) —
  // native motion runs synchronously as part of `mount()`/`adopt()`, so
  // there is no more "hide behind `.ts-chart__marks--revealing`, defer past
  // first paint, then imperatively `.animate()` every rect" dance; that
  // entire WAAPI apparatus (`animateSquaresCascade`/`animateTracks`/the
  // `onPostPaint` per-bar-rect loops) is deleted.
  //
  // `handleRender` now only does two things every render: (1) tracks
  // `phaseRef` ("revealing" -> "ready") for `onPhaseChange`, and (2) keeps
  // BarPulse's imperative clip+sweep (`syncBarPulseGroups`, D381 — still not
  // expressible as scene geometry) in sync, held hidden while a reveal is
  // (re)playing exactly as legacy did. B3: native motion has no
  // motion-completion callback (no per-mark "animation finished" hook is
  // exposed anywhere in the renderer/mark API — confirmed against
  // dist/motion.js and dist/types.d.ts's `ChartMotionContext`/
  // `ChartMotionTiming` shapes), so the "reveal is done" moment is
  // APPROXIMATED by a timer set to the same value the old deadline used:
  // bar enter duration + the max per-datum stagger (last bar's delay is
  // `revealDurationMs*0.4*(n-1)/n`, so `duration + spread` safely covers
  // every bar's individual finish time, matching the pre-C5 `deadlineMs`
  // formula verbatim).
  const handleRender = React.useCallback((context: ChartRendererRenderContext<ChartDatum, string, number>) => {
    // Cast: focus-injection's captureRenderContext takes the library's
    // default-generic Pick<ChartRenderContext, "scene"|"interaction">, which
    // (due to contravariance on interaction.setControlledFocus) isn't
    // structurally assignable from our ChartDatum-specific instantiation —
    // this is a type-system quirk, not a runtime mismatch.
    captureRenderContext(context as Pick<ChartRenderContext, "scene" | "interaction">);
    // B1: the renderer context has no `svg` member under RendererChart —
    // `surface.element` is the mounted `<svg class="ts-chart">` root itself.
    const svgRoot = context.surface.element as SVGSVGElement;
    // BarPulse loop upkeep (syncBarPulseGroups) runs at every exit path
    // below, AFTER this render's phase decision: TanStack's reconciler wipes
    // injected nodes/attributes (the pulse's <clipPath> def, the group's
    // clip-path/display styles) on every render, so they must be re-applied
    // here — hidden while a reveal is (re)playing (legacy holds the wave
    // until bars finish growing), live again once the deadline fires.
    const marksGroup = svgRoot.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup || animationDuration <= 0) {
      setPhase("ready");
      syncBarPulseGroups(svgRoot, true);
      return;
    }
    // TanStack double-fires onRender in the same mount commit; once a reveal
    // is scheduled, "ready" is owned solely by the reveal deadline below —
    // these guards must not short-circuit the phase to ready mid-reveal.
    // B3: the replay KEY must be tested BEFORE the DOM stamp, not after. The
    // stamp latches for the life of the marks node, so a caller bumping
    // `revealSignature` on a surviving node would be swallowed here and B3
    // would land inert while typechecking clean (the exact D311 failure).
    const revealKeyChanged = revealedKeyRef.current !== revealKeyRef.current;
    if (isRevealed(marksGroup) && !revealKeyChanged) {
      // Any re-render here (hover/focus) still went through the reconciler,
      // which wiped the pulse group's injected clip + styles — restore them,
      // staying hidden while a reveal is in flight.
      syncBarPulseGroups(svgRoot, phaseRef.current === "ready");
      return;
    }
    // Reveal replay (data change) or fresh mount: hide the pulse groups for
    // the reveal's duration — legacy holds BarPulse until bars finish growing.
    syncBarPulseGroups(svgRoot, false);
    if (revealedForDataRef.current === latestRenderDataRef.current && !revealKeyChanged) {
      // Same-data recreation: no reveal replay (D214) — bars are already
      // grown unless a reveal for THIS data is still in flight, so decide
      // by live phase (also restores the injected clip/loop the reconciler
      // just wiped when ready).
      markRevealed(marksGroup);
      syncBarPulseGroups(svgRoot, phaseRef.current === "ready");
      return;
    }
    revealedForDataRef.current = latestRenderDataRef.current;
    revealedKeyRef.current = revealKeyRef.current;
    markRevealed(marksGroup);
    setPhase("revealing");

    const staggerSpreadMs = revealDurationMs * 0.4;
    const staggerMs = renderData.length > 1 ? staggerSpreadMs : 0;
    const deadlineMs = revealDurationMs + staggerMs;

    revealDeadlineTimerRef.current = setRevealDeadline(deadlineMs, {
      onDeadline: () => {
        setPhase("ready");
        // Reveal finished → un-hide the pulse groups + start their sweep
        // loops (legacy holds BarPulse until bars finish growing).
        syncBarPulseGroups(svgRoot, true);
      },
    });
  }, [animationDuration, revealDurationMs, setPhase, renderData.length, captureRenderContext]);

  // P6.1 — the reference-area layer used to read a SECOND `[0, maxValue * 1.1]`
  // memo of its own, byte-identical to `yDomain` and recomputed on the same
  // dependency. Collapsed onto `yDomain`. (Note for RA2: both were, and this
  // still is, the UN-niced domain, while the scale the bars are painted with is
  // `createNicedYScale(yDomain)` — a latent misplacement that predates this
  // task and belongs to the reference-area cluster, not here.)
  const refAreaChildrenBar = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const heightPxBar = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;

  // C3: the crosshair's vertical fade-mask gradient, an app-owned
  // `linearGradient` def referenced by the native `crosshair()` mark's
  // `stroke: url(#id)` (the mark protocol has no built-in fade-mask concept —
  // this is the sanctioned escape hatch for a renderer-visual legacy owned
  // imperatively). Stops come from the same `indicatorFadeGradientStops`
  // legacy's `buildIndicator` used; gate conditions mirror the `definition`
  // useMemo's crosshair-mark branch exactly (dashed indicators never fade;
  // no-fade configs need no gradient at all). `gradientUnits="userSpaceOnUse"`
  // with explicit pixel `y1`/`y2` is required because the native crosshair
  // renders as a zero-bbox `<line>` — an `objectBoundingBox` gradient (what
  // legacy's `<rect fill="url(#id)">` trick relied on implicitly) has no
  // bounding box to map onto for a line.
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

  const barScaleForRef = React.useMemo(() => {
    if (categoryOrder.length === 0) return null;
    return scaleBand<string>().domain(categoryOrder).range([0, Math.max(0, width - margin.left - margin.right)]).padding(barGap);
  }, [categoryOrder, width, margin.left, margin.right, barGap]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, isolation: "isolate" } as React.CSSProperties}
      data-bkm-chart="bar"
    >
      {background ? (
        <BackgroundLayer
          config={background}
          innerWidth={innerWidth}
          innerHeight={Math.max(0, heightPxBar - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
        />
      ) : null}
      {definition ? (
        <>
          <RendererChart
            ariaLabel="Bar chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            renderer={chartMotionRenderer<ChartDatum, string, number>()}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
            renderTooltipBody={tooltipEnabled ? renderTooltipBody : undefined}
          />
          {heightPxBar > 0 && barScaleForRef && (
            <ReferenceAreaLayers
              configs={refAreaChildrenBar}
              geom={{
                width,
                height: heightPxBar,
                margin,
                // RA2 — the NICED domain the bars actually paint in. Passing the
                // raw `yDomain` here misplaced every bar reference area by the
                // nicing delta (recorded in D343, fixed here).
                yDomain: yScale.domain() as [number, number],
                yDomainsByAxis: nicedDomainsByAxis,
                isBarChart: true,
                barScale: barScaleForRef as unknown as { (v: string): number | undefined; bandwidth: () => number; domain: () => string[] },
              }}
            />
          )}
          {tooltipEnabled ? (
            <div
              ref={overlayHostRef}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          ) : null}
        </>
      ) : null}
      {squaresDefs.length > 0 || crosshairFadeGradient ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            {squaresDefs.map((d) => (
              <React.Fragment key={d.gradientId}>
                <linearGradient id={d.gradientId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={100}>
                  {d.gradientStops.map((s) => (
                    <stop key={`${s.offset}-${s.color}`} offset={`${s.offset}%`} stopColor={s.color} />
                  ))}
                </linearGradient>
                {d.patternId && d.patternPreset ? renderPatternPreset(d.patternPreset, d.patternId, { color: `url(#${d.gradientId})` }) : null}
              </React.Fragment>
            ))}
            {crosshairFadeGradient ? (
              <linearGradient
                key={crosshairFadeGradient.id}
                id={crosshairFadeGradient.id}
                gradientUnits="userSpaceOnUse"
                x1={0}
                x2={0}
                y1={margin.top}
                y2={margin.top + Math.max(0, heightPxBar - margin.top - margin.bottom)}
              >
                {crosshairFadeGradient.stops.map((s, i) => (
                  <stop key={i} offset={s.offset} stopColor={crosshairFadeGradient.color} stopOpacity={s.opacity} />
                ))}
              </linearGradient>
            ) : null}
          </defs>
        </svg>
      ) : null}
    </div>
  );
}

// Legacy parity: bklit `bar-chart.tsx` ships `export default BarChart;` (T-E2).
export default BarChart;
