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
// driving `candlestick-hover-chrome.ts` via `<Chart onFocusGroupChange>` adapter
// ChartPoint[] → CandlestickFocusPoint (no native pointermove/bisect listener).
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, createMark } from "@tanstack/charts";
import type { ChartMark, ChartPoint, ChartScale, SceneNode } from "@tanstack/charts";
import { extractChildren } from "./children";
import { sampleSpringKeyframes } from "./internal/candle-spring";
import { onPostPaint } from "./internal/deferred-reveal";
import {
  attachCandlestickHoverChrome,
  type CandlestickFocusPoint,
  type CandlestickHoverChrome,
  type CandlestickHoverChromeState,
} from "./internal/candlestick-hover-chrome";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import { YAxisOverlay } from "./internal/y-axis-overlay";
import type { ChartDatum } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { createCandlestickFocusStrategy } from "./internal/candlestick-focus-strategy";
import "./styles.css";

const DEFAULT_ANIMATION_DURATION_MS = 1100;
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
// bklit y-axis-ticks.ts Y_AXIS_DEFAULT_TICK_COUNT / resolveYAxisTickCount
// clamp range.
const Y_AXIS_DEFAULT_TICK_COUNT = 5;
const Y_AXIS_MIN_TICK_COUNT = 1;
const Y_AXIS_MAX_TICK_COUNT = 10;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

// Pilot subset of framer's public spring Transition surface (bklit
// CandlestickProps has no `enterTransition` prop at all — the reveal is
// hardcoded to `defaultEnter` — but the task's architecture calls for one;
// only the spring-relevant fields are exposed since no framer-motion runs in
// this pilot, D19/D10).
export interface CandlestickEnterTransition {
  /** Seconds (framer's own Transition.duration unit for a spring). Default 0.8. */
  duration?: number;
  /** Default 0.15. */
  bounce?: number;
}

export interface CandlestickChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  margin?: Partial<Margin>;
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
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);

  // No `onPhaseChange`/`status` (bklit parity, verified — see header). Hover
  // is gated by a plain boolean ref instead of the full ChartPhase union.
  const canInteractRef = React.useRef(false);
  const revealEpochRef = React.useRef(0);
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  // Tracks `<rect>` elements driven by the static `ts-candle-reveal`
  // CSS-animation fast path. Cleared inline at the deadline epoch by
  // removing `animation-name` on each element — avoids the D25
  // `getAnimations()` quadratic trap (see original comment, still applies).
  const revealCssElementsRef = React.useRef<SVGRectElement[]>([]);

  // canInteract gate for the TanStack focus strategy (mirrors bklit
  // ChartProvider ready check — plain boolean, not ChartPhase).

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

  const { candlestick, grid, xAxis, yAxis, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  // bklit candlestick-chart.tsx: no decimation (D19 — `decimateOhlcData` is
  // dead code) — every raw candle is rendered, same as the benchmark
  // comparison must.
  const renderData = data;

  const resolvedCandlestick = React.useMemo(
    () => ({
      positiveFill: candlestick?.positiveFill ?? SOLID_POSITIVE,
      negativeFill: candlestick?.negativeFill ?? SOLID_NEGATIVE,
      insideStrokeWidth: candlestick?.insideStrokeWidth ?? 0,
      fadedOpacity: candlestick?.fadedOpacity ?? 0.3,
      showHoverFade: candlestick?.showHoverFade ?? true,
    }),
    [candlestick],
  );

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

  // Custom x scale: scaleUtc, range inset by slotWidth/2 per side via the
  // object-with-`resolve` escape hatch (TanStack's `resolveConfiguredScale`
  // unconditionally overwrites a plain scale instance's `.range()`).
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

  const definition = React.useMemo(() => {
    if (width <= 0) return null;

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
    // Hover dim: dim both marks as wholes; highlight via separate overlay.
    const wicksMark = createMark(() => {
      const xValues = renderData.map((d: any) => d[xDataKey] as Date);
      const lowValues = renderData.map((d: any) => d.low as number | undefined);
      const highValues = renderData.map((d: any) => d.high as number | undefined);
      return {
        id: "wicks",
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
            const wickFill = isPositive ? resolvedCandlestick.positiveFill : resolvedCandlestick.negativeFill;
            const key = `wicks:${i}`;
            nodes.push({
              kind: "rect",
              key,
              x: cx - WICK_WIDTH_PX / 2,
              y: Math.min(yLow, yHigh),
              width: WICK_WIDTH_PX,
              height: Math.abs(yHigh - yLow) || 1,
              style: { fill: wickFill },
            });
            points.push({
              key, markId: "wicks", group: "wicks", groupLabel: "wicks",
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

    const bodiesMark = createMark(() => {
      const xValues = renderData.map((d: any) => d[xDataKey] as Date);
      const openValues = renderData.map((d: any) => d.open as number | undefined);
      const closeValues = renderData.map((d: any) => d.close as number | undefined);
      return {
        id: "bodies",
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
            const fill = isPositive ? resolvedCandlestick.positiveFill : resolvedCandlestick.negativeFill;
            const key = `bodies:${i}`;
            nodes.push({
              kind: "rect",
              key,
              x: cx - bodyWidthPx / 2,
              y: Math.min(yOpen, yClose),
              width: bodyWidthPx,
              height: Math.abs(yClose - yOpen) || 1,
              radius: 1,
              style: { fill, stroke: fill, strokeWidth: 1 },
            });
            points.push({
              key, markId: "bodies", group: "bodies", groupLabel: "bodies",
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

    const marks: ChartMark<ChartDatum, Date, number>[] = [
      wicksMark,
      bodiesMark,
    ];

    return defineChart({
      marks,
      x: {
        scale: xScale,
        guide: false,
        grid: grid?.vertical ?? false,
      },
      y: {
        scale: yScale,
        grid: grid?.horizontal ?? false,
        ticks: grid?.numTicks ?? 5,
      },
      margin,
      focus: candlestickFocusStrategy,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      // bklit candlestick: data updates SNAP, never tween (I8 is a Line-only
      // concept) — matches every other migrated chart's non-Line behavior.
      animate: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    renderData,
    xDataKey,
    xScale,
    yDomain,
    bodyWidthPx,
    resolvedCandlestick.positiveFill,
    resolvedCandlestick.negativeFill,
    grid,
    width,
    margin.top,
    margin.right,
    margin.bottom,
    margin.left,
    candlestickFocusStrategy,
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
    const rawCount = yAxis.numTicks ?? Y_AXIS_DEFAULT_TICK_COUNT;
    const clamped = Math.min(
      Y_AXIS_MAX_TICK_COUNT,
      Math.max(Y_AXIS_MIN_TICK_COUNT, Math.round(rawCount)),
    );
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

  // Hover chrome (bklit ChartTooltip + candlestick's own dim/highlight idiom).
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chromeRef = React.useRef<CandlestickHoverChrome | null>(null);
  const chromeStateRef = React.useRef<CandlestickHoverChromeState | null>(null);
  chromeStateRef.current = {
    margin,
    pointCount: renderData.length,
    fadedOpacity: resolvedCandlestick.fadedOpacity,
    showHoverFade: resolvedCandlestick.showHoverFade,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachCandlestickHoverChrome(el, () => chromeStateRef.current!);
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition]);

  // TanStack-native hover — ChartFocusStrategy resolves nearest xValue
  // (bisect-epoch semantics with strict `>` tie-break) and groups wick+body
  // points for that date; this adapter maps ChartPoint[] → CandlestickFocusPoint
  // for the chrome. Pixel y for open/low/high/close via a locally-recreated
  // y scale (same domain/nice/range as the mark's yScale) so no d3 ref is
  // stashed.
  const yScaleForChrome = React.useMemo(() => {
    if (heightPx <= 0) return null;
    return scaleLinear()
      .domain(yDomain)
      .nice()
      .range([heightPx - margin.bottom, margin.top]);
  }, [yDomain, heightPx, margin.top, margin.bottom]);

  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      if (points.length === 0) {
        chromeRef.current?.onFocusChange(null);
        return;
      }
      const primary = points[0]!;
      const datum = primary.datum;
      const date = primary.xValue;
      const open = datum.open as number | undefined;
      const close = datum.close as number | undefined;
      const low = datum.low as number | undefined;
      const high = datum.high as number | undefined;
      if (
        typeof open !== "number" ||
        typeof close !== "number" ||
        typeof low !== "number" ||
        typeof high !== "number" ||
        !Number.isFinite(open) ||
        !Number.isFinite(close) ||
        !Number.isFinite(low) ||
        !Number.isFinite(high)
      ) {
        chromeRef.current?.onFocusChange(null);
        return;
      }
      // Center x from TanStack point (both wick+body share same x). y values
      // via reconstructed scale (or directly from points when available) to
      // match the mark's own mapping.
      const yScale = yScaleForChrome;
      // Prefer point y when markId matches, else fall back to scale.
      let closeY: number | null = null;
      let highY: number | null = null;
      for (const p of points) {
        if (p.markId === "bodies") closeY = p.y;
        if (p.markId === "wicks") highY = p.y;
      }
      const yOpen = yScale ? (yScale(open) ?? 0) : 0;
      const yClose = closeY ?? (yScale ? (yScale(close) ?? 0) : 0);
      const yLow = yScale ? (yScale(low) ?? 0) : 0;
      const yHigh = highY ?? (yScale ? (yScale(high) ?? 0) : 0);
      const centerXpx = primary.x;
      const isPositive = close >= open;
      const fill = isPositive
        ? resolvedCandlestick.positiveFill
        : resolvedCandlestick.negativeFill;
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.abs(yClose - yOpen) || 1;
      const wickTop = Math.min(yHigh, yLow);
      const wickHeight = Math.abs(yLow - yHigh) || 1;
      const point: CandlestickFocusPoint = {
        date,
        close,
        centerX: centerXpx,
        closeY: yClose,
        body: {
          x: centerXpx - bodyWidthPx / 2,
          y: bodyTop,
          width: bodyWidthPx,
          height: bodyHeight,
          fill,
          radius: 1,
          strokeWidth: WICK_WIDTH_PX,
        },
        wick: {
          x: centerXpx - WICK_WIDTH_PX / 2,
          y: wickTop,
          width: WICK_WIDTH_PX,
          height: wickHeight,
          fill,
        },
      };
      chromeRef.current?.onFocusChange(point);
    },
    [yScaleForChrome, bodyWidthPx, resolvedCandlestick.positiveFill, resolvedCandlestick.negativeFill],
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
  const handleRender = React.useCallback(() => {
    if (animationDuration <= 0) return;

    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup || marksGroup.dataset.bkmRevealed === "1") return;
    marksGroup.dataset.bkmRevealed = "1";
    const mySetupEpoch = revealEpochRef.current;
    marksGroup.classList.add("ts-chart__marks--revealing");

    const enterDurationMs = Math.max(
      1,
      (enterTransition?.duration ?? DEFAULT_ENTER_DURATION_SEC) * 1000,
    );
    const enterBounce = enterTransition?.bounce ?? DEFAULT_ENTER_BOUNCE;
    const n = renderData.length;

    onPostPaint(() => {
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

          const useCssRevealFastPath = Math.abs(enterBounce - DEFAULT_ENTER_BOUNCE) < 1e-6;
          const keyframeValues = useCssRevealFastPath
            ? null
            : sampleSpringKeyframes(enterDurationMs, enterBounce, 60);
          const transformKeyframes = keyframeValues?.map((v) => ({
            transform: `scaleY(${v})`,
          }));

          const allRects: SVGRectElement[] = [
            ...wickRects,
            ...bodyRects,
          ];

          const applyReveal = (rect: SVGRectElement, index: number) => {
            // Rect origin is already at the node's x,y (top-left in SVG),
            // so transformOrigin at the center of the rect.
            const rx = Number.parseFloat(rect.getAttribute("x") ?? "0");
            const ry = Number.parseFloat(rect.getAttribute("y") ?? "0");
            const rw = Number.parseFloat(rect.getAttribute("width") ?? "0");
            const rh = Number.parseFloat(rect.getAttribute("height") ?? "0");
            rect.style.transformOrigin = `${rx + rw / 2}px ${ry + rh / 2}px`;
            const delayMs = index * staggerBaseMs;
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
                easing: "linear",
                fill: "backwards",
              });
              revealAnimationsRef.current.push(scaleAnim);
            }
            rect.style.transitionDuration = `${OPACITY_TWEEN_MS}ms`;
            rect.style.opacity = "0";
          };

          wickRects.forEach((rect, i) => applyReveal(rect, i));
          bodyRects.forEach((rect, i) => applyReveal(rect, i));
          marksGroup.classList.remove("ts-chart__marks--revealing");

          // Phase 2, one frame later: flip every rect to opacity 1 in one
          // pass so the shared CSS transition animates them all uniformly,
          // undelayed, over the fixed 150ms window.
          requestAnimationFrame(() => {
            if (revealEpochRef.current !== mySetupEpoch) return;
            for (const rect of allRects) {
              rect.style.opacity = "1";
            }
          });
    });
  }, [animationDuration, enterTransition?.duration, enterTransition?.bounce, renderData.length]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, ...style }}
      data-bkm-chart="candlestick"
    >
      {definition ? (
        <>
          <Chart
            ariaLabel="Candlestick chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
          />
          {xAxis ? (
            <XAxisOverlay
              data={renderData}
              xDataKey={xDataKey}
              rangeStart={margin.left + slotWidth / 2}
              rangeEnd={width - margin.right - slotWidth / 2}
              numTicks={xAxis.numTicks ?? 5}
              formatValue={xAxis.formatValue}
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
