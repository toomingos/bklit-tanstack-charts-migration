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
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartConfig } from "./internal/chart-config-context";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { BarXAxisOverlay, barCategoryAccessor } from "./internal/bar-x-axis-overlay";
import { createBarFocusStrategy } from "./internal/bar-focus-strategy";
import { barSquaresMark } from "./internal/bar-squares-mark";
import { barColumnTrackMark } from "./internal/bar-column-track-mark";
import { barDepthBackMark, barDepthFrontMark, buildNegBarStops, buildPosBarStops, DEFAULT_GROUND_SHADOW as DEFAULT_BAR_DEPTH_GROUND_SHADOW } from "./internal/bar-depth-marks";
import type { BarDepthGradientIds } from "./internal/bar-depth-marks";
import { barPulseMark } from "./internal/bar-pulse-mark";
import { barTrimmedMark } from "./internal/bar-trimmed-mark";
import { renderPatternPreset } from "./internal/pattern-preset";
import type { BarConfig, BarSquaresConfig, BarColumnTrackConfig, ChartDatum, ChartPhase } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { useChartMargin, useContainerWidth } from "./internal";
import { createNicedYScale } from "./internal/y-domain";
import "./styles.css";

// bklit animation.ts / bar-chart.tsx: reveal 1100ms, cubic-bezier(.85,0,.15,1)
// tween (DEFAULT_CHART_ENTER_TRANSITION) — same duration as the per-bar
// stagger spread, unlike scatter's separate fixed-500ms enter tween.
const DEFAULT_ANIMATION_DURATION_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// bklit bar.tsx BarInner default `groupGap` (grouped, non-stacked bars only —
// the pilot's only supported layout).
const GROUP_GAP = 4;
// bklit bar.tsx BarInner default `fill` — a single fixed color, NOT a
// rotating per-series palette (unlike scatter's chart-1..5 rotation).
const DEFAULT_BAR_FILL = "var(--chart-line-primary)";

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

export interface BarChartProps {
  data: ChartDatum[];
  /** Key in data for the categorical axis. Default: "name" (bklit default). */
  xDataKey?: string;
  animationDuration?: number;
  margin?: Partial<Margin>;
  aspectRatio?: string;
  className?: string;
  /** Gap between bar groups as a fraction of band width (0-1). Default: 0.2. */
  barGap?: number;
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: React.ReactNode;
}

interface ResolvedSeries {
  dataKey: string;
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
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  barGap = 0.2,
  onPhaseChange,
  children,
}: BarChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
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

  const { bars, barSquares: barSquaresRaw, barColumnTracks: barColumnTracksRaw, barDepthBacks: barDepthBacksRaw, barDepthFronts: barDepthFrontsRaw, barPulses: barPulsesRaw, barDepthProvider, grid, barXAxis, tooltip } = React.useMemo(
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

  const categoryAccessor = React.useMemo(() => barCategoryAccessor(xDataKey), [xDataKey]);

  const resolvedSeries = React.useMemo<ResolvedSeries[]>(
    () =>
      bars.map((s) => {
        const fill = s.fill ?? DEFAULT_BAR_FILL;
        return {
          dataKey: s.dataKey,
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
    () => [...resolvedSeries.map((s) => ({ dataKey: s.dataKey })), ...resolvedBarSquares.map((s) => ({ dataKey: s.dataKey }))],
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

  // bklit grouped-bar maxValue: max single value across all series/rows.
  const maxValue = React.useMemo(() => {
    let max = 0;
    for (const series of allSeriesForDomain) {
      for (const d of renderData) {
        const v = d[series.dataKey];
        if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
      }
    }
    return max || 100;
  }, [renderData, allSeriesForDomain]);

  const yDomain = React.useMemo<[number, number]>(
    () => [0, maxValue * 1.1] as [number, number],
    [maxValue],
  );
  // y as a pre-domained instance (not a factory) so its domain/nice is
  // preserved (factory would be re-inferred from channel values, losing the
  // explicit *1.1 headroom). No `.range()` set — TanStack applies the
  // margin-inclusive range itself (C2).
  const yScale = React.useMemo(() => createNicedYScale(yDomain), [yDomain]);

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

  const squaresBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
  const depthBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
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

  const definition = React.useMemo(() => {
    if (width <= 0 || (resolvedSeries.length === 0 && resolvedBarSquares.length === 0)) return null;
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
            y: (d: ChartDatum) => d[series.dataKey] as number,
            z: () => series.dataKey,
             layout: group({ scale: groupScale }),
            fill: series.fill,
            radius: resolveCornerRadius(series.lineCap, groupBandwidth),
          }),
        );
      }
      const spec = {
        marks,
        x: { scale: xScaleFactory, guide: false },
        y: { scale: yScale, grid: grid?.horizontal ?? false, ticks: grid?.numTicks ?? 5 },
        margin,
        animate: false as const,
      } as const;
      const base = defineChart(spec);
      return defineChart<ChartDatum, string, number>(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY });
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
              yAccessor: (d: ChartDatum) => d[dataKey] as number,
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
            yAccessor: (d: ChartDatum) => d[s.dataKey] as number,
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
            yAccessor: (d: ChartDatum) => d[b.dataKey] as number,
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
            yAccessor: (d: ChartDatum) => d[series.dataKey] as number,
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
          y: (d: ChartDatum) => d[series.dataKey] as number,
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
            yAccessor: (d: ChartDatum) => d[f.dataKey] as number,
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
          yAccessor: (d: ChartDatum) => d[p.dataKey] as number,
          activeIndex: p.activeIndex,
          pulsePaused: p.pulsePaused,
        });
        if (m) marks.push(m);
      }
    }
    const spec = {
      marks,
      x: { scale: xScaleFactory, guide: false },
      y: { scale: yScale, grid: grid?.horizontal ?? false, ticks: grid?.numTicks ?? 5 },
      margin,
      animate: false as const,
    } as const;
    const base = defineChart(spec);
    return defineChart<ChartDatum, string, number>(base, { focus: barFocusStrategy, focusRing: false, maxFocusDistance: Number.POSITIVE_INFINITY });
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
  ]);

  // Hover chrome (bklit ChartTooltip, bar per-category-index dim variant).
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chartConfig = useChartConfig();
  const chromeRef = React.useRef<BarHoverChrome | null>(null);
  const chromeStateRef = React.useRef<BarHoverChromeState | null>(null);
  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return v.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      tooltipBoxSpring: chartConfig.tooltipBoxSpring,
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
      const barPoints: BarFocusPoint[] = points.map((p) => ({
        markId: p.markId,
        value: p.yValue as number,
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
    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup || animationDuration <= 0) {
      setPhase("ready");
      return;
    }
    // TanStack double-fires onRender in the same mount commit; once a reveal
    // is scheduled, "ready" is owned solely by the reveal deadline below —
    // these guards must not short-circuit the phase to ready mid-reveal.
    if (marksGroup.dataset.bkmRevealed === "1") {
      return;
    }
    if (revealedForDataRef.current === latestRenderDataRef.current) {
      marksGroup.dataset.bkmRevealed = "1";
      return;
    }
    revealedForDataRef.current = latestRenderDataRef.current;
    marksGroup.dataset.bkmRevealed = "1";
    setPhase("revealing");

    const staggerSpreadMs = animationDuration * 0.4;
    const staggerMs = renderData.length > 1 ? staggerSpreadMs : 0;
    const deadlineMs = animationDuration + staggerMs;

    if (animationDuration <= 0) {
      setPhase("ready");
    } else {
      revealDeadlineTimerRef.current = setRevealDeadline(deadlineMs, {
        animationsRef: revealAnimationsRef,
        onDeadline: () => { setPhase("ready"); },
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
        const columns = [...byX.values()].sort((a, b) => {
          const ay = Number.parseFloat(a[0]?.getAttribute("y") ?? "0");
          const by = Number.parseFloat(b[0]?.getAttribute("y") ?? "0");
          return ay - by;
        });
        // Simpler: use DOM order grouped by data index (already column-major).
        // So just apply cascade per rect using its dataIndex ordering.
        const perColumnDelayMs = staggerDelaySec * 1000;
        const xs = [...byX.keys()].sort((a, b) => a - b);
          rects.forEach((rectEl) => {
          const targetY = Number.parseFloat(rectEl.getAttribute("y") ?? "0");
          const targetHeight = Number.parseFloat(rectEl.getAttribute("height") ?? "0");
          const baselineY = targetY + targetHeight;
          // Determine column index + square index within column by x grouping
          const x = Number.parseFloat(rectEl.getAttribute("x") ?? "0");
          const bucket = Math.round(x * 100);
          const colIdx = Math.max(0, xs.indexOf(bucket));
          const colRects = byX.get(bucket) ?? [rectEl];
          const sqIdx = colRects.indexOf(rectEl);
          const sqCount = colRects.length;
          const cascadeSpreadMs = animationDuration * 0.4;
          const cascadeStepMs = sqCount > 1 ? cascadeSpreadMs / (sqCount - 1) : 0;
          const delayMs = colIdx * perColumnDelayMs + sqIdx * cascadeStepMs;
          const anim = rectEl.animate(
            [
              { height: "0px", y: String(baselineY) },
              { height: `${targetHeight}px`, y: String(targetY) },
            ],
            { duration: animationDuration, delay: delayMs, easing: REVEAL_EASING, fill: "backwards" },
          );
          revealAnimationsRef.current.push(anim);
        });
        void columns;
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
            { duration: animationDuration, delay: delaySec * 1000, easing: REVEAL_EASING, fill: "backwards" },
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
              { duration: animationDuration, delay: delaySec * 1000, easing: REVEAL_EASING, fill: "backwards" },
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
                duration: animationDuration,
                delay: delaySec * 1000,
                easing: REVEAL_EASING,
                fill: "backwards",
              },
            );
            revealAnimationsRef.current.push(anim);
          });
        }
      }
      marksGroup.classList.remove("ts-chart__marks--revealing");
    });
  }, [animationDuration, resolvedSeries, resolvedBarSquares, barSquaresEnabled, barColumnTrackEnabled, setPhase, renderData.length]);

  const refAreaChildrenBar = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const heightPxBar = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
  const yDomainBar = React.useMemo(() => [0, (maxValue * 1.1)] as [number, number], [maxValue]);
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
                yDomain: yDomainBar,
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
      {barDepthEnabled && (
        // bklit bar-depth.tsx BarDepthBack/BarDepthFront <defs> — per-bar
        // (objectBoundingBox, default gradientUnits) glass + directional
        // side/lid shade gradients. Deliberately NOT gradientUnits=
        // "userSpaceOnUse" (unlike squaresDefs above): objectBoundingBox
        // makes ONE gradient def correct for every bar's own height/bbox.
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={depthGradientIds.glassPosId} x1="0" x2="0" y1="0" y2="1">
              {depthGlassPosStops.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
              ))}
            </linearGradient>
            <linearGradient id={depthGradientIds.glassNegId} x1="0" x2="0" y1="0" y2="1">
              {depthGlassNegStops.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
              ))}
            </linearGradient>
            <linearGradient id={depthGradientIds.sideShadeRtlId} x1="1" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="black" stopOpacity="0.05" />
              <stop offset="100%" stopColor="black" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id={depthGradientIds.sideShadeLtrId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="black" stopOpacity="0.05" />
              <stop offset="100%" stopColor="black" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id={depthGradientIds.topShadeId} x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stopColor="black" stopOpacity="0" />
              <stop offset="100%" stopColor="black" stopOpacity="0.18" />
            </linearGradient>
          </defs>
        </svg>
      )}
    </div>
  );
}
