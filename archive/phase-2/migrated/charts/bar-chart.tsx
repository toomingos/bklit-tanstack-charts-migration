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
// formula verbatim). This is passed to EVERY per-series `barY()` call as a
// pre-built, already-domained scale INSTANCE (not a factory) — TanStack's
// `resolveGroupScale` always `.copy()`s it and re-ranges it to
// `[0, totalBandwidth]` itself, but preserves the domain/padding we set,
// so every series' call resolves the identical group layout and each
// `z: () => series.dataKey` constant picks out that series' own slot.
//
// Dot Y positions come from scene `ChartPoint.y` (TanStack-resolved
// y-scale), not a local `valueScale(numValue)` — the only local y range
// that existed before now is owned by TanStack's ChartScale (C2).
// The mount reveal remains a per-bar imperative WAAPI grow-from-baseline
// tween (K2), deferred past first paint (see `handleRender`).
import * as React from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import type { ScaleBand } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart } from "@tanstack/charts";
import type { ChartMark, ChartPoint } from "@tanstack/charts";
import { extractChildren } from "./children";
import {
  attachBarHoverChrome,
  type BarFocusGroup,
  type BarFocusPoint,
  type BarHoverChrome,
  type BarHoverChromeState,
} from "./internal/bar-hover-chrome";
import { BarXAxisOverlay, barCategoryAccessor } from "./internal/bar-x-axis-overlay";
import { createBarFocusStrategy } from "./internal/bar-focus-strategy";
import type { BarConfig, ChartDatum, ChartPhase } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
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
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  // bklit ChartCore: `isLoaded` starts false unconditionally — the initial
  // phase is always "revealing" (mirrors scatter-chart.tsx's phaseRef).
  const phaseRef = React.useRef<ChartPhase>("revealing");
  const revealAnimationsRef = React.useRef<Animation[]>([]);
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

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const { bars, grid, barXAxis, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  // bklit bar-chart.tsx: no decimation — every raw row renders as a bar.
  const renderData = data;

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
    for (const series of resolvedSeries) {
      for (const d of renderData) {
        const v = d[series.dataKey];
        if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
      }
    }
    return max || 100;
  }, [renderData, resolvedSeries]);

  const yDomain = React.useMemo<[number, number]>(
    () => [0, maxValue * 1.1] as [number, number],
    [maxValue],
  );
  // y as a pre-domained instance (not a factory) so its domain/nice is
  // preserved (factory would be re-inferred from channel values, losing the
  // explicit *1.1 headroom). No `.range()` set — TanStack applies the
  // margin-inclusive range itself (C2).
  const yScale = React.useMemo(() => scaleLinear().domain(yDomain).nice(), [yDomain]);

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
  // bklit bar.tsx: individualBarWidth = (bandWidth - effectiveGroupGap*(n-1))/n
  const groupBandwidth = React.useMemo(() => {
    if (seriesCount === 0) return bandWidth;
    const effectiveGroupGap = seriesCount > 1 ? GROUP_GAP : 0;
    return (bandWidth - effectiveGroupGap * (seriesCount - 1)) / seriesCount;
  }, [bandWidth, seriesCount]);

  // Nested band scale positioning each series within its category band —
  // paddingInner derived so `.bandwidth()` equals `groupBandwidth` above
  // (see file header for the algebraic derivation). Passed to every barY()
  // call as an already-domained INSTANCE (not a factory) — see header.
  const groupScale = React.useMemo<ScaleBand<string>>(() => {
    const n = seriesCount;
    const paddingInner = n > 1 ? (n * GROUP_GAP) / (bandWidth + GROUP_GAP) : 0;
    return scaleBand<string>()
      .domain(resolvedSeries.map((s) => s.dataKey))
      .paddingInner(paddingInner)
      .paddingOuter(0);
  }, [resolvedSeries, seriesCount, bandWidth]);

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

  const definition = React.useMemo(() => {
    if (width <= 0 || resolvedSeries.length === 0) return null;
    const marks: ChartMark<ChartDatum, string, number>[] = [];
    for (const series of resolvedSeries) {
      marks.push(
        barY(renderData, {
          id: series.dataKey,
          x: (d: ChartDatum) => categoryAccessor(d),
          y: (d: ChartDatum) => d[series.dataKey] as number,
          z: () => series.dataKey,
          groupScale,
          fill: series.fill,
          radius: resolveCornerRadius(series.lineCap, groupBandwidth),
        }),
      );
    }
    const spec = {
      marks,
      x: {
        scale: xScaleFactory,
        guide: false,
      },
      y: {
        scale: yScale,
        grid: grid?.horizontal ?? false,
        ticks: grid?.numTicks ?? 5,
      },
      margin,
      animate: false as const,
    } as const;
    const base = defineChart(spec);
    // C1: wire custom focus — Infinity so band covers the full column.
    return defineChart<ChartDatum, string, number>(base, {
      focus: barFocusStrategy,
      maxFocusDistance: Number.POSITIVE_INFINITY,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    renderData,
    categoryAccessor,
    resolvedSeries,
    groupScale,
    groupBandwidth,
    xScaleFactory,
    yScale,
    grid,
    margin.top,
    margin.right,
    margin.bottom,
    margin.left,
    width,
    barFocusStrategy,
  ]);

  // Hover chrome (bklit ChartTooltip, bar per-category-index dim variant).
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chromeRef = React.useRef<BarHoverChrome | null>(null);
  const chromeStateRef = React.useRef<BarHoverChromeState | null>(null);
  chromeStateRef.current = {
    margin,
    series: resolvedSeries.map((s) => ({
      dataKey: s.dataKey,
      color: s.dotColor,
      fadedOpacity: s.fadedOpacity,
    })),
    pointCount: renderData.length,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachBarHoverChrome(el, () => chromeStateRef.current!);
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition]);

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
    if (!marksGroup || marksGroup.dataset.bkmRevealed === "1" || animationDuration <= 0) {
      setPhase("ready");
      return;
    }
    marksGroup.dataset.bkmRevealed = "1";
    setPhase("revealing");

    // bklit ChartCore: staggerMs = data.length>1 ? animationDuration*0.4 : 0;
    // setIsLoaded(true) fires at animationDuration + staggerMs.
    const staggerMs = renderData.length > 1 ? animationDuration * 0.4 : 0;
    const deadlineMs = animationDuration + staggerMs;

    if (animationDuration <= 0) {
      setPhase("ready");
    } else {
      setRevealDeadline(deadlineMs, {
        animationsRef: revealAnimationsRef,
        onDeadline: () => { setPhase("ready"); },
      });
    }

    if (animationDuration <= 0) return;

    marksGroup.classList.add("ts-chart__marks--revealing");
    // bklit: staggerSpread = animationDuration*0.4; calculatedStaggerDelay =
    // data.length>1 ? staggerSpread/1000/data.length : 0 (seconds).
    const staggerSpreadMs = animationDuration * 0.4;
    const staggerDelaySec =
      renderData.length > 1 ? staggerSpreadMs / 1000 / renderData.length : 0;

    onPostPaint(() => {
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
              { height: "0", y: String(baselineY) },
              { height: String(targetHeight), y: String(targetY) },
            ],
            {
              duration: animationDuration,
              delay: delaySec * 1000,
              easing: REVEAL_EASING,
              // "backwards" only — see scatter-chart.tsx's rationale
              // (avoids the Animation staying permanently "in effect"
              // once it naturally completes).
              fill: "backwards",
            },
          );
          revealAnimationsRef.current.push(anim);
        });
      }
      marksGroup.classList.remove("ts-chart__marks--revealing");
    });
  }, [animationDuration, resolvedSeries, setPhase, renderData.length]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio }}
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
          {tooltipEnabled ? (
            <div
              ref={overlayHostRef}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
