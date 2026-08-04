// Migrated bklit-ui BarChart — same public API, rendered by TanStack Charts.
// Pilot scope: vertical, grouped (NOT stacked) bars only — one `barY()` mark
// per <Bar> series (bar-chart.tsx bklit source's `stacked`/`orientation`/
// `perspective`/`minBarHeight`/`squareSnap` branches are all out of scope).
//
// Geometry mirrors bklit's ChartCore exactly (repos/bklit-ui/.../bar-
// chart.tsx): a local `scaleBand<string>` category scale (`padding: barGap`,
// default 0.2) and a local `scaleLinear` value scale (`domain: [0, max*1.1]`,
// `.nice()`), both constructed with MARGIN-INCLUSIVE ranges up front (unlike
// bklit's own locally-ranged scale + separate margin-translated `<g>`) so
// every downstream consumer here — the barY() marks via defineChart, our own
// pointermove hover math, and the axis-label overlay — all agree on one
// single coordinate frame (the same convention line-chart.tsx/scatter-
// chart.tsx already use). TanStack's `resolveConfiguredScale` overwrites
// `.range()` on a plain scale instance unconditionally, but recomputes the
// exact same margin-inclusive range from the same `margin`/`width`/`height`
// we pass to `defineChart`, so there is no drift between what we compute
// locally and what TanStack actually renders.
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
// Hover is native `pointermove` + plain band-index division (bklit's own
// `Math.floor(pos / columnWidth)`), NOT TanStack focus/bisect — see
// `internal/bar-hover-chrome.ts` for the per-category-index dim + per-series
// dot positioning this feeds (both confirmed against bklit's chart-
// tooltip.tsx / bar.tsx / bar-chart.tsx source directly). The mount reveal is
// a per-bar imperative WAAPI grow-from-baseline tween (bklit's AnimatedBar
// framer-motion equivalent — `{height:0, y:bottom} -> {height, y}`, `x`/
// `width` unchanged throughout), deferred past first paint exactly like
// scatter's per-circle reveal (see `handleRender` below for the full
// rationale, ported verbatim from scatter-chart.tsx).
import * as React from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import type { ScaleBand, ScaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, barY } from "@tanstack/charts";
import type { ChartMark } from "@tanstack/charts";
import { extractChildren } from "./children";
import {
  attachBarHoverChrome,
  type BarFocusGroup,
  type BarFocusPoint,
  type BarHoverChrome,
  type BarHoverChromeState,
} from "./internal/bar-hover-chrome";
import { BarXAxisOverlay, barCategoryAccessor } from "./internal/bar-x-axis-overlay";
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
  // Mirrors @tanstack/charts-core `resolveChartSize` (packages/core/src/
  // sizing.ts) EXACTLY: `height = Math.round(available.width / aspectRatio)`
  // — `available.width` there is TanStack's own internal measurement of this
  // same container (both observe the identical zero-padding element), so
  // `Math.round` here is load-bearing, not cosmetic: `resolveConfiguredScale`
  // (configured-scale.ts) ALWAYS `.copy()`s whatever scale instance we pass
  // in before calling `.range()` on the copy — it can NEVER mutate our
  // original `valueScale` instance in place (confirmed by reading
  // scale-input.ts `resolveScaleInput`: `const scale = created.copy()`,
  // unconditionally). That means our own `valueScale.range(...)` below is
  // the ONLY source of truth our later hover-math reads from — it must
  // independently reproduce TanStack's real internal chart height pixel-for-
  // pixel, not merely approximate it, or every hover dot's y position would
  // drift from where the bars actually paint. (This is also, in hindsight,
  // the root cause of the separately-flagged scatter-chart.tsx y-scale-stash
  // hover bug — that file stashes its ORIGINAL scale instance expecting
  // TanStack to mutate it in place post-render, which per this same source
  // never happens; out of scope to fix here, but the same trap is avoided
  // in this file by never relying on post-render mutation at all.)
  const chartHeight = width > 0 ? Math.round(width / parseAspectRatio(aspectRatio)) : 0;
  const innerHeight = Math.max(0, chartHeight - margin.top - margin.bottom);

  // Category scale (band) — MARGIN-INCLUSIVE range, unlike bklit's own
  // locally-ranged `[0, innerWidth]` scale (see file header).
  const categoryScale = React.useMemo<ScaleBand<string>>(() => {
    return scaleBand<string>()
      .domain(renderData.map(categoryAccessor))
      .range([margin.left, margin.left + innerWidth])
      .padding(barGap);
  }, [renderData, categoryAccessor, margin.left, innerWidth, barGap]);

  const bandWidth = categoryScale.bandwidth();

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

  const valueScale = React.useMemo<ScaleLinear<number, number>>(() => {
    return scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([margin.top + innerHeight, margin.top]);
  }, [maxValue, margin.top, innerHeight]);

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

  // Column width for the native pointermove band-index division (bklit
  // ChartCore `columnWidth`) — LOCAL (margin-exclusive) span per category.
  const columnWidth = renderData.length > 0 ? innerWidth / renderData.length : 0;

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
    return defineChart({
      marks,
      x: {
        scale: categoryScale,
        guide: false,
      },
      y: {
        scale: valueScale,
        grid: grid?.horizontal ?? false,
        ticks: grid?.numTicks ?? 5,
      },
      margin,
      // bklit bar has no data-update tween (Line-only concept) — new data
      // always snaps once loaded, exactly like bklit's static <rect> render.
      animate: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderData, categoryAccessor, resolvedSeries, groupScale, groupBandwidth, categoryScale, valueScale, grid, margin.top, margin.right, margin.bottom, margin.left, width]);

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

  // Native hover targeting (bklit ChartCore handleMouseMove, vertical grouped
  // branch, ported verbatim) — plain band-index division, NOT bisect/focus.
  const hoverInputsRef = React.useRef({
    renderData,
    categoryAccessor,
    categoryScale,
    valueScale,
    resolvedSeries,
    bandWidth,
    groupBandwidth,
    columnWidth,
  });
  hoverInputsRef.current = {
    renderData,
    categoryAccessor,
    categoryScale,
    valueScale,
    resolvedSeries,
    bandWidth,
    groupBandwidth,
    columnWidth,
  };

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !tooltipEnabled) return;

    const handlePointerMove = (event: PointerEvent) => {
      const {
        renderData: rows,
        categoryAccessor: catAcc,
        categoryScale: catScale,
        valueScale: valScale,
        resolvedSeries: series,
        groupBandwidth: gBandwidth,
        columnWidth: colWidth,
      } = hoverInputsRef.current;
      // bklit gates interaction on the ready phase (canInteract = isLoaded).
      if (phaseRef.current !== "ready" || rows.length === 0 || colWidth <= 0) {
        chromeRef.current?.onFocusChange(null);
        return;
      }
      const svg = container.querySelector("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const pointX = event.clientX - rect.left;
      const pos = pointX - margin.left;
      const bandIndex = Math.floor(pos / colWidth);
      const clampedIndex = Math.max(0, Math.min(rows.length - 1, bandIndex));
      const d = rows[clampedIndex];
      if (!d) {
        chromeRef.current?.onFocusChange(null);
        return;
      }
      const categoryLabel = catAcc(d);
      const barPos = catScale(categoryLabel) ?? 0;
      const anchorX = barPos + bandWidth / 2;

      const n = series.length;
      const groupGap = n > 1 ? GROUP_GAP : 0;
      const points: BarFocusPoint[] = series.map((s, idx) => {
        const value = d[s.dataKey];
        const numValue = typeof value === "number" ? value : 0;
        const y = valScale(numValue) ?? 0;
        const x = barPos + idx * (gBandwidth + groupGap) + gBandwidth / 2;
        return { markId: s.dataKey, value: numValue, x, y, color: s.dotColor };
      });

      const group: BarFocusGroup = {
        categoryIndex: clampedIndex,
        categoryLabel,
        anchorX,
        points,
      };
      chromeRef.current?.onFocusChange(group);
    };

    const handlePointerLeave = () => {
      chromeRef.current?.onFocusChange(null);
    };

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooltipEnabled, margin.left, bandWidth]);

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
            onRender={handleRender}
          />
          {barXAxis ? (
            <BarXAxisOverlay
              data={renderData}
              xDataKey={xDataKey}
              categoryScale={(c) => categoryScale(c)}
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

