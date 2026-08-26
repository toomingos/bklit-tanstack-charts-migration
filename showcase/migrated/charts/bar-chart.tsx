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
// and consumed via `<Chart onFocusGroupChange>` → chrome adapter. No manual
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
// The mount reveal remains a per-bar imperative WAAPI grow-from-baseline
// tween (K2), deferred past first paint (see `handleRender`).
import * as React from "react";
import { scaleBand } from "d3-scale";
import type { ScaleBand } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart, group } from "@tanstack/charts";
import type { ChartMark, ChartPoint } from "@tanstack/charts";
import { extractChildren } from "./children";
import {
  attachBarHoverChrome,
  type BarFocusGroup,
  type BarFocusPoint,
  type BarHoverChrome,
  type BarHoverChromeState,
} from "./internal/bar-hover-chrome";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartConfig } from "./internal/chart-config-context";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { BarXAxisOverlay, barCategoryAccessor } from "./internal/bar-x-axis-overlay";
import { createBarFocusStrategy } from "./internal/bar-focus-strategy";
import { barSquaresMark } from "./internal/bar-squares-mark";
import { barColumnTrackMark } from "./internal/bar-column-track-mark";
import { barDepthBackMark, barDepthFrontMark, buildNegBarStops, buildPosBarStops, DEFAULT_GROUND_SHADOW as DEFAULT_BAR_DEPTH_GROUND_SHADOW } from "./internal/bar-depth-marks";
import type { BarDepthGradientIds } from "./internal/bar-depth-marks";
import { barPulseMark, buildPulseWaveStops, syncBarPulseGroups } from "./internal/bar-pulse-mark";
import { barTrimmedMark } from "./internal/bar-trimmed-mark";
import { renderPatternPreset } from "./internal/pattern-preset";
import type { BarConfig, BarSquaresConfig, BarColumnTrackConfig, ChartDatum, ChartPhase } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { resolveGridGuide } from "./internal/grid";
import { isRevealed, markRevealed, onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
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

function resolveCornerRadius(
  lineCap: BarConfig["lineCap"] | undefined,
  groupBandwidth: number,
): number {
  if (typeof lineCap === "number") return lineCap;
  if (lineCap === "butt") return 0;
  // "round" (default): bklit bar.tsx cornerRadius = min(barWidth/2, 8).
  return groupBandwidth > 0 ? Math.min(groupBandwidth / 2, 8) : 0;
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
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  const revealPostPaintCancelRef = React.useRef<(() => void) | null>(null);
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

  // Teardown: cancel the pending reveal deadline + post-paint chain + any
  // in-flight per-bar WAAPI animations on unmount (D205 canonical wording —
  // uncancellable post-paint/deadline races would otherwise fire on detached
  // DOM after the chart is gone).
  React.useEffect(() => {
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const anim of revealAnimationsRef.current) {
        try {
          anim.cancel();
        } catch { /* teardown race — already cancelled */ }
      }
      revealAnimationsRef.current = [];
    };
  }, []);

  const { bars, barSquares: barSquaresRaw, barColumnTracks: barColumnTracksRaw, barDepthBacks: barDepthBacksRaw, barDepthFronts: barDepthFrontsRaw, barPulses: barPulsesRaw, barDepthProvider, grid, barXAxis, background, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();

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

  const innerWidth = Math.max(0, width - margin.left - margin.right);

  const categoryOrder = React.useMemo(
    () => renderData.map(categoryAccessor),
    [renderData, categoryAccessor],
  );

  // C2: x/y as factories — TanStack's resolveConfiguredScale infers domain
  // from the barY channels (x values) / numeric channels (y) and applies
  // margin-inclusive range itself. We do NOT construct a margin-inclusive
  // range locally; host `<Chart aspectRatio>` owns height (C2), and y domain
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

  const definition = React.useMemo(() => {
    if (width <= 0 || (resolvedSeries.length === 0 && resolvedBarSquares.length === 0)) return null;
    const gridGuide = resolveGridGuide(grid);
    const hasSquares = barSquaresEnabled;
    const hasTrack = barColumnTrackEnabled;
    const hasDepth = barDepthEnabled;
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
          }),
        );
      }
      const spec = {
        marks,
        // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
        // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
        // key on the spec is never read.
        x: { scale: xScaleFactory, grid: gridGuide.vertical, axis: { ticks: { count: gridGuide.columnTicks } } },
        y: {
          scale: yScale,
          grid: gridGuide.horizontal,
          axis: { ticks: { count: gridGuide.ticks } },
        },
        margin,
        svgAnimation: false as const,
      } as const;
      const base = defineChart(spec);
      return defineChart(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY });
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
    const spec = {
      marks,
      // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
      // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
      // key on the spec is never read.
      x: { scale: xScaleFactory, grid: gridGuide.vertical, axis: { ticks: { count: gridGuide.columnTicks } } },
      y: {
        scale: yScale,
        grid: gridGuide.horizontal,
        axis: { ticks: { count: gridGuide.ticks } },
      },
      margin,
      gradients: nativeDepthGradients,
      svgAnimation: false as const,
    } as const;
    const base = defineChart(spec);
    return defineChart(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY });
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
  ]);

  // Hover chrome (bklit ChartTooltip, bar per-category-index dim variant).
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chartConfig = useChartConfig();
  const chromeRef = React.useRef<BarHoverChrome | null>(null);
  const chromeStateRef = React.useRef<BarHoverChromeState | null>(null);
  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return shortDateFmt.format(v);
    return String(v ?? "");
  }), [renderData, xDataKey]);
  const squaresDotColor = (fill: string, stroke: string | undefined) => stroke ?? fill;
  chromeStateRef.current = {
    margin,
    series: [...resolvedSeries.map((s) => ({
      dataKey: s.dataKey,
      color: s.dotColor,
      fadedOpacity: s.fadedOpacity,
    })), ...resolvedBarSquares.map((s) => ({
      dataKey: s.dataKey,
      color: squaresDotColor(s.fill, s.stroke),
      fadedOpacity: s.fadedOpacity,
    }))],
    barSquaresSeries: resolvedBarSquares.map((s) => ({ dataKey: s.dataKey, fadedOpacity: s.fadedOpacity })),
    barTrackOpacity: resolvedBarColumnTracks[0]?.opacity ?? 0.3,
    pointCount: renderData.length,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
    // B12: bklit BarXAxis.tickerHalfWidth drives the date-pill label-fade radius.
    tickerHalfWidth: barXAxis?.tickerHalfWidth,
    tooltip: tooltip ?? null,
    dateLabels: dateLabelsForPill,
    legendHoveredIndex,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useEffect(() => {
    chromeRef.current?.syncDim();
  }, [legendHoveredIndex]);

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachBarHoverChrome(el, () => chromeStateRef.current!, {
      tooltipSpring: chartConfig.tooltipSpring,
    });
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig]);

  // C1: TanStack-native focus → BarFocusGroup adapter, driven only by
  // `onFocusGroupChange` (no container pointer listeners).
  const categoryIndexByLabel = React.useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < categoryOrder.length; i++) m.set(categoryOrder[i]!, i);
    return m;
  }, [categoryOrder]);

  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, string, number>[]) => {
      if (points.length === 0) {
        chromeRef.current?.onFocusChange(null);
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

      // Dot per series must be AT THAT SERIES' OWN bar midpoint, not the
      // shared band center (bar.tsx `xPositions[dataKey] = barPos +
      // idx*(W_gap)+W/2`). TanStack's ChartPoint.x already is that
      // per-series midpoint (barY sets point.x = bandCenter-bandW/2 +
      // groupOffset+groupW/2), so we keep point.x as-is for dot x.
      // Dot y already comes from TanStack's scene-resolved y (no local scale).
      // P6.1 — `value` is the RAW datum value, deliberately NOT `p.yValue`.
      // Once a series can sit on a secondary axis, `p.yValue` is the value
      // REPROJECTED into the primary domain (see `projectYByKey`), which is a
      // rendering-space number: correct for placing the dot, wrong for the
      // tooltip row and for the object handed to a caller's `tooltip.rows()`.
      // Line, area and scatter all already read the raw datum here; bar was
      // the only chart reading the scale-space value, and the QA gate does NOT
      // catch this — a few wrong digits of tooltip text is ~0.05% of the
      // viewport, well under the 0.5% gate (D337 again).
      const barPoints: BarFocusPoint[] = points.map((p) => ({
        markId: p.markId,
        value: (() => {
          const raw = (p.datum as ChartDatum | undefined)?.[p.markId];
          return typeof raw === "number" ? raw : (p.yValue as number);
        })(),
        x: p.x as number,
        y: p.y as number,
        color: p.color,
      }));

      const group: BarFocusGroup = {
        categoryIndex,
        categoryLabel,
        anchorX,
        points: barPoints,
      };
      chromeRef.current?.onFocusChange(group);
    },
    [categoryIndexByLabel, categoryScaleForOverlay, bandWidth],
  );

  // Mount reveal: bklit AnimatedBar's per-bar framer entrance equivalent —
  // one WAAPI tween per rendered <rect>, growing from the baseline (bottom
  // edge unchanged, height 0 -> target, y bottom -> target — `x`/`width`
  // never animate, matching bklit's own AnimatedBar initial/target
  // keyframes exactly). Deferred past first paint for the identical reason
  // documented in scatter-chart.tsx's handleRender (full rationale ported
  // verbatim: instantiating one Animation per bar synchronously inside
  // TanStack's mount `useLayoutEffect` would block that very paint at scale;
  // the marks group is hidden via the shared `.ts-chart__marks--revealing`
  // CSS class the instant it commits, and the actual tween setup runs two
  // rAFs + one macrotask later, after the browser has already painted the
  // (still-hidden) bars).
  const handleRender = React.useCallback(() => {
    // BarPulse loop upkeep (syncBarPulseGroups) runs at every exit path
    // below, AFTER this render's phase decision: TanStack's reconciler wipes
    // injected nodes/attributes (the pulse's <clipPath> def, the group's
    // clip-path/display styles) on every render, so they must be re-applied
    // here — hidden while a reveal is (re)playing (legacy holds the wave
    // until bars finish growing), live again once the deadline fires.
    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup || animationDuration <= 0) {
      setPhase("ready");
      if (containerRef.current) syncBarPulseGroups(containerRef.current, true);
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
      if (containerRef.current) syncBarPulseGroups(containerRef.current, phaseRef.current === "ready");
      return;
    }
    // Reveal replay (data change) or fresh mount: hide the pulse groups for
    // the reveal's duration — legacy holds BarPulse until bars finish growing.
    if (containerRef.current) syncBarPulseGroups(containerRef.current, false);
    if (revealedForDataRef.current === latestRenderDataRef.current && !revealKeyChanged) {
      // Same-data recreation: no reveal replay (D214) — bars are already
      // grown unless a reveal for THIS data is still in flight, so decide
      // by live phase (also restores the injected clip/loop the reconciler
      // just wiped when ready).
      markRevealed(marksGroup);
      if (containerRef.current) syncBarPulseGroups(containerRef.current, phaseRef.current === "ready");
      return;
    }
    revealedForDataRef.current = latestRenderDataRef.current;
    revealedKeyRef.current = revealKeyRef.current;
    markRevealed(marksGroup);
    setPhase("revealing");

    const staggerSpreadMs = revealDurationMs * 0.4;
    const staggerMs = renderData.length > 1 ? staggerSpreadMs : 0;
    const deadlineMs = revealDurationMs + staggerMs;

    if (animationDuration <= 0) {
      setPhase("ready");
    } else {
      revealDeadlineTimerRef.current = setRevealDeadline(deadlineMs, {
        animationsRef: revealAnimationsRef,
        onDeadline: () => {
          setPhase("ready");
          // Reveal finished → un-hide the pulse groups + start their sweep
          // loops (legacy holds BarPulse until bars finish growing).
          if (containerRef.current) syncBarPulseGroups(containerRef.current, true);
        },
      });
    }

    if (animationDuration <= 0) return;

    marksGroup.classList.add("ts-chart__marks--revealing");
    const staggerDelaySec =
      renderData.length > 1 ? staggerSpreadMs / 1000 / renderData.length : 0;

    const animateSquaresCascade = () => {
      if (!barSquaresEnabled) return;
      for (const s of resolvedBarSquares) {
        const group = marksGroup.querySelector<SVGGElement>(`.ts-chart__bar-squares[data-ts-key="${s.dataKey}"]`);
        if (!group) continue;
        const rects = group.querySelectorAll<SVGRectElement>("rect");
        // Group rects by column (per-bar column). Squares are emitted column-major: data bars * squares.
        // Reconstruct per-bar square count via DOM order: infer from visual grouping by x.
        const byX = new Map<number, SVGRectElement[]>();
        rects.forEach((r) => {
          const x = Number.parseFloat(r.getAttribute("x") ?? "0");
          const key = Math.round(x * 100);
          const arr = byX.get(key) ?? [];
          arr.push(r);
          byX.set(key, arr);
        });
        // Simpler: use DOM order grouped by data index (already column-major).
        // So just apply cascade per rect using its dataIndex ordering.
        const perColumnDelayMs = staggerDelaySec * 1000;
        const xs = [...byX.keys()].sort((a, b) => a - b);
        for (const [bucket, colRects] of byX) {
          // Column index + square index within column come straight from the
          // x-bucket grouping above.
          const colIdx = Math.max(0, xs.indexOf(bucket));
          const sqCount = colRects.length;
          const cascadeSpreadMs = revealDurationMs * 0.4;
          const cascadeStepMs = sqCount > 1 ? cascadeSpreadMs / (sqCount - 1) : 0;
          for (let sqIdx = 0; sqIdx < colRects.length; sqIdx++) {
            const rectEl = colRects[sqIdx]!;
            const targetY = Number.parseFloat(rectEl.getAttribute("y") ?? "0");
            const targetHeight = Number.parseFloat(rectEl.getAttribute("height") ?? "0");
            const baselineY = targetY + targetHeight;
            const delayMs = colIdx * perColumnDelayMs + sqIdx * cascadeStepMs;
            const anim = rectEl.animate(
              [
                { height: "0px", y: String(baselineY) },
                { height: `${targetHeight}px`, y: String(targetY) },
              ],
              { duration: revealDurationMs, delay: delayMs, easing: revealEasingCss, fill: "backwards" },
            );
            revealAnimationsRef.current.push(anim);
          }
        }
      }
    };

    const animateTracks = () => {
      if (!barColumnTrackEnabled) return;
      const groups = marksGroup.querySelectorAll<SVGGElement>(`.ts-chart__bar-column-track`);
      groups.forEach((g) => {
        const rects = g.querySelectorAll<SVGRectElement>("rect");
        rects.forEach((rectEl, i) => {
          const targetHeight = Number.parseFloat(rectEl.getAttribute("height") ?? "0");
          const baselineH = Math.max(targetHeight, 0);
          // Track animates height baselineY -> trackHeight at y=0 already
          const delaySec = i * staggerDelaySec;
          const topY = Number.parseFloat(rectEl.getAttribute("y") ?? "0");
          void topY;
          const anim = rectEl.animate(
            [
              { height: `${baselineH + targetHeight}px`, y: "0" },
              { height: `${targetHeight}px`, y: "0" },
            ],
            { duration: revealDurationMs, delay: delaySec * 1000, easing: revealEasingCss, fill: "backwards" },
          );
          revealAnimationsRef.current.push(anim);
        });
      });
    };

    revealPostPaintCancelRef.current = onPostPaint(() => {
      const hasSquaresReveal = barSquaresEnabled;
      const hasTrackReveal = barColumnTrackEnabled;
      if (hasSquaresReveal || hasTrackReveal) {
        // When squares/track present, use their cascade reveals; skip plain bar rect tween for squares keys.
        animateSquaresCascade();
        animateTracks();
        // Still animate any remaining plain bar rects (bars not replaced by squares)
        for (const series of resolvedSeries) {
          if (resolvedBarSquares.some((s) => s.dataKey === series.dataKey)) continue;
          const escaped = series.dataKey.replace(/"/g, '\\"');
          const group = marksGroup.querySelector<SVGGElement>(
            `.ts-chart__bar-y[data-ts-key="${escaped}"]`,
          );
          if (!group) continue;
          const rects = group.querySelectorAll<SVGRectElement>("rect");
          rects.forEach((rectEl, i) => {
            const targetY = Number.parseFloat(rectEl.getAttribute("y") ?? "0");
            const targetHeight = Number.parseFloat(rectEl.getAttribute("height") ?? "0");
            const baselineY = targetY + targetHeight;
            const delaySec = i * staggerDelaySec;
            const anim = rectEl.animate(
              [
                { height: "0px", y: String(baselineY) },
                { height: `${targetHeight}px`, y: String(targetY) },
              ],
              { duration: revealDurationMs, delay: delaySec * 1000, easing: revealEasingCss, fill: "backwards" },
            );
            revealAnimationsRef.current.push(anim);
          });
        }
      } else {
        for (const series of resolvedSeries) {
          const escaped = series.dataKey.replace(/"/g, '\\"');
          const group = marksGroup.querySelector<SVGGElement>(
            `.ts-chart__bar-y[data-ts-key="${escaped}"]`,
          );
          if (!group) continue;
          const rects = group.querySelectorAll<SVGRectElement>("rect");
          rects.forEach((rectEl, i) => {
            const targetY = Number.parseFloat(rectEl.getAttribute("y") ?? "0");
            const targetHeight = Number.parseFloat(rectEl.getAttribute("height") ?? "0");
            const baselineY = targetY + targetHeight;
            const delaySec = i * staggerDelaySec;
            const anim = rectEl.animate(
              [
                { height: "0px", y: String(baselineY) },
                { height: `${targetHeight}px`, y: String(targetY) },
              ],
              {
                duration: revealDurationMs,
                delay: delaySec * 1000,
                easing: revealEasingCss,
                fill: "backwards",
              },
            );
            revealAnimationsRef.current.push(anim);
          });
        }
      }
      marksGroup.classList.remove("ts-chart__marks--revealing");
    });
  }, [animationDuration, revealDurationMs, revealEasingCss, resolvedSeries, resolvedBarSquares, barSquaresEnabled, barColumnTrackEnabled, setPhase, renderData.length]);

  // P6.1 — the reference-area layer used to read a SECOND `[0, maxValue * 1.1]`
  // memo of its own, byte-identical to `yDomain` and recomputed on the same
  // dependency. Collapsed onto `yDomain`. (Note for RA2: both were, and this
  // still is, the UN-niced domain, while the scale the bars are painted with is
  // `createNicedYScale(yDomain)` — a latent misplacement that predates this
  // task and belongs to the reference-area cluster, not here.)
  const refAreaChildrenBar = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const heightPxBar = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
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
          <Chart
            ariaLabel="Bar chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
          />
          {barXAxis ? (
            <BarXAxisOverlay
              data={renderData}
              xDataKey={xDataKey}
              categoryScale={(c) => categoryScaleForOverlay(c)}
              bandWidth={bandWidth}
              categoryAccessor={categoryAccessor}
              marginLeft={0}
              showAllLabels={barXAxis.showAllLabels}
              maxLabels={barXAxis.maxLabels}
            />
          ) : null}
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
      {squaresDefs.length > 0 && (
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
          </defs>
        </svg>
      )}
    </div>
  );
}

// Legacy parity: bklit `bar-chart.tsx` ships `export default BarChart;` (T-E2).
export default BarChart;
