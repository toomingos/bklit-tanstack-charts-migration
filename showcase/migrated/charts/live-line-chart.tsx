"use client";
// Migrated bklit-ui LiveLineChart — same public API (push-model `data`/
// `value`, time-cutoff `window`, `paused`, `<LiveLine>`/`<LiveXAxis>`/
// `<LiveYAxis>`/`<ChartTooltip>` children), rendered via TanStack Charts.
// docs/LOG.md D22: a NEW top-level component (not a LineChart variant),
// reusing only internal/spring.ts and the shared formatters — see
// internal/live-hover-chrome.ts's own header for the hover/tooltip design.
//
// Architecture (bklit live-line-chart.tsx, re-ported line-for-line where
// cited):
//  - One continuous rAF loop (`tick`, mirrors live-line-chart.tsx tick()
//    378-430) runs for the component's lifetime. EVERY raw tick it advances
//    `now` (frozen while `paused`), asymmetrically lerps the y-domain
//    (instant expand / 0.08-exponential contract per tick, `nextAnimFrame`
//    119-143 — this lerp step itself is NOT throttled, exactly like bklit:
//    only the REACT COMMIT of its result is throttled) and re-resolves the
//    hover tooltip from `cursorXRef` (a plain ref written by native pointer
//    listeners — no React state in the pointer path, D16/D22).
//  - Only every LIVE_FRAME_COMMIT_MS=32ms does the loop commit `frame` to
//    React state (`startTransition`, matching bklit 420-427). That
//    throttled commit is what feeds TanStack's `definition` (line + area
//    marks, reconciled by TanStack's own keyed diff) and the five
//    React-rendered "live tip" chrome elements below — this ~30fps
//    "TanStack reconcile" cost is D22's M3b perf point and is deliberately
//    NOT optimized away.
//  - Tooltip/hover resolution never touches React state (a purer
//    application of D16's ref-only-pointer-path rule than bklit's own
//    hybrid — bklit still commits `tooltipData` via `setState` because its
//    whole render model is un-throttled React; here the imperative
//    internal/live-hover-chrome.ts module is driven directly every raw
//    tick instead). The only thing hover changes on the REACT side is a
//    plain DOM opacity toggle on the "live tip" groups, also done
//    imperatively by that module (`registerLiveGroups`/`updateHover`) —
//    matching bklit's `motion.g animate={{opacity: isScrubbing?0.25:1}}`
//    (live-line.tsx:244-247) without any framer-motion or React state.
import * as React from "react";
import { bisector } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { curveMonotoneX, type CurveFactory } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { d3Curve, defineChart } from "@tanstack/charts";
import type { ChartMark } from "@tanstack/charts";
import { roleOf } from "./children";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { createTickColorResolver } from "./internal/reference-area-geometry";
import { hmsTimeFmt } from "./internal/formatters";
import { liveLineMark } from "./internal/live-line-mark";
import { useChartMargin, useMeasuredRect } from "./internal";
import {
  attachLiveHoverChrome,
  type LiveHoverChrome,
  type LiveHoverConfig,
} from "./internal/live-hover-chrome";
import { useChartConfig } from "./internal/chart-config-context";
import type {
  ChartDatum,
  ChartTooltipConfig,
  LiveLineConfig,
  LiveXAxisConfig,
  LiveYAxisConfig,
  MomentumColors,
} from "./internal/types";
import "./styles.css";

// ---------------------------------------------------------------------------
// Constants (bklit live-line-chart.tsx 77-80)
// ---------------------------------------------------------------------------

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const LERP_SPEED = 0.08;
const DEFAULT_MARGIN: Margin = { top: 24, right: 16, bottom: 32, left: 16 };
/** React commit interval for the live animation loop (~30fps). */
const LIVE_FRAME_COMMIT_MS = 32;
/**
 * Once the chart is paused, the bklit-compatible y/value lerp continues to
 * converge.  Keep that state advancing, but do not send changes smaller than
 * a quarter pixel through React/TanStack: they cannot change a rendered
 * pixel, while they otherwise rebuild the complete chart definition.
 */
const PAUSED_FRAME_PIXEL_THRESHOLD = 0.25;

export interface LiveLinePoint {
  time: number;
  value: number;
}

export interface LiveLineChartProps {
  /** Streaming data — array of { time: unixSeconds, value }. */
  data: LiveLinePoint[];
  /** Latest value (smoothly interpolated to). */
  value: number;
  /** Key used for the value field in context data. Default: "value". */
  dataKey?: string;
  /** Visible time window in seconds. Default: 30. */
  window?: number;
  /** Number of X-axis ticks (used to compute leading offset). Default: 5. */
  numXTicks?: number;
  /** Leading offset in X-tick units (0 = now at right edge). Default: 0. */
  nowOffsetUnits?: number;
  /** Tight Y-axis. Default: false. */
  exaggerate?: boolean;
  /** Interpolation speed (0-1). Default: 0.08. */
  lerpSpeed?: number;
  margin?: Partial<Margin>;
  /** Freeze chart scrolling. Default: false. */
  paused?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface AnimFrame {
  now: number;
  yMin: number;
  yMax: number;
  displayValue: number;
}

// ---------------------------------------------------------------------------
// Ported helpers (bklit live-line-chart.tsx 89-187)
// ---------------------------------------------------------------------------

function computeTargetRange(
  data: LiveLinePoint[],
  value: number,
  exaggerate: boolean,
): { yMin: number; yMax: number } {
  if (data.length === 0) {
    return { yMin: 0, yMax: 100 };
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const d of data) {
    if (d.value < min) min = d.value;
    if (d.value > max) max = d.value;
  }
  if (value < min) min = value;
  if (value > max) max = value;
  const rawRange = max - min;
  const paddingFactor = exaggerate ? 0.03 : 0.15;
  const rangePad = rawRange * paddingFactor || (exaggerate ? 0.04 : 10);
  return { yMin: min - rangePad, yMax: max + rangePad };
}

function nextAnimFrame(
  prev: AnimFrame,
  targetRange: { yMin: number; yMax: number },
  targetValue: number,
  speed: number,
  isPaused: boolean,
): AnimFrame {
  const nextNow = isPaused ? prev.now : Date.now();
  const nextYMin =
    targetRange.yMin < prev.yMin
      ? targetRange.yMin
      : prev.yMin + (targetRange.yMin - prev.yMin) * speed;
  const nextYMax =
    targetRange.yMax > prev.yMax
      ? targetRange.yMax
      : prev.yMax + (targetRange.yMax - prev.yMax) * speed;
  const nextValue = prev.displayValue + (targetValue - prev.displayValue) * speed;
  return { now: nextNow, yMin: nextYMin, yMax: nextYMax, displayValue: nextValue };
}

function frameChangePixels(prev: AnimFrame, next: AnimFrame, height: number): number {
  const range = Math.max(Math.abs(prev.yMax - prev.yMin), Math.abs(next.yMax - next.yMin));
  if (!(range > 0) || !(height > 0)) return Number.POSITIVE_INFINITY;
  const domainChange = Math.max(
    Math.abs(next.yMin - prev.yMin),
    Math.abs(next.yMax - prev.yMax),
  );
  const valueChange = Math.abs(next.displayValue - prev.displayValue);
  return (Math.max(domainChange, valueChange) / range) * height;
}

function interpolateAtTime(points: LiveLinePoint[], timeSec: number): number | null {
  if (points.length === 0) return null;
  const firstPt = points[0] as LiveLinePoint;
  const lastPt = points[points.length - 1] as LiveLinePoint;
  if (timeSec <= firstPt.time) return firstPt.value;
  if (timeSec >= lastPt.time) return lastPt.value;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const midPt = points[mid];
    if (midPt && midPt.time <= timeSec) lo = mid;
    else hi = mid;
  }
  const p1 = points[lo];
  if (!p1) return null;
  const p2 = points[hi];
  if (!p2) return null;
  const dt = p2.time - p1.time;
  if (dt === 0) return p1.value;
  const t = (timeSec - p1.time) / dt;
  return p1.value + (p2.value - p1.value) * t;
}

const bisectTime = bisector<LiveLinePoint, number>((d) => d.time).left;

type Momentum = "up" | "down" | "flat";

/** bklit live-line.tsx `detectMomentum` (21-59), re-targeted at the
    committed `contextData` rows this port builds (same shape:
    `Record<string, unknown>[]` keyed by `dataKey`). */
function detectMomentum(data: ChartDatum[], dataKey: string, lookback = 20): Momentum {
  if (data.length < 5) return "flat";
  const start = Math.max(0, data.length - lookback);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = start; i < data.length; i++) {
    const v = data[i]?.[dataKey];
    if (typeof v === "number") {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return "flat";
  const tailStart = Math.max(start, data.length - 5);
  const first = (data[tailStart]?.[dataKey] as number) ?? 0;
  const last = (data[data.length - 1]?.[dataKey] as number) ?? 0;
  const delta = last - first;
  const threshold = range * 0.12;
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
}

// ---------------------------------------------------------------------------
// LiveYAxis hysteresis interval picker (bklit live-y-axis.tsx 15-72)
// ---------------------------------------------------------------------------

function pickNiceInterval(
  valRange: number,
  chartHeight: number,
  minGap: number,
  prevInterval: number,
): number {
  if (valRange <= 0 || chartHeight <= 0) return 1;
  const pxPerUnit = chartHeight / valRange;
  if (prevInterval > 0) {
    const px = prevInterval * pxPerUnit;
    if (px >= minGap * 0.5 && px <= minGap * 3) return prevInterval;
  }
  const divisorSets = [
    [2, 2.5, 2],
    [2, 2, 2.5],
    [2.5, 2, 2],
  ];
  let best = Number.POSITIVE_INFINITY;
  for (const divs of divisorSets) {
    let span = 10 ** Math.ceil(Math.log10(valRange));
    let i = 0;
    let d = divs[i % 3] ?? 2;
    while ((span / d) * pxPerUnit >= minGap) {
      span /= d;
      i++;
      d = divs[i % 3] ?? 2;
    }
    if (span < best) best = span;
  }
  return best === Number.POSITIVE_INFINITY ? valRange / 5 : best;
}

const EDGE_FADE_PX = 28;

function edgeOpacity(y: number, chartHeight: number): number {
  const fromEdge = Math.min(y, chartHeight - y);
  if (fromEdge >= EDGE_FADE_PX) return 1;
  if (fromEdge <= 0) return 0;
  return fromEdge / EDGE_FADE_PX;
}

// ---------------------------------------------------------------------------
// Dedicated single-pass extraction (docs/LOG.md D22 — mirrors
// composed-chart.tsx's precedent of NOT using the generic extractChildren).
// ---------------------------------------------------------------------------

interface ExtractedLiveLineChildren {
  liveLines: LiveLineConfig[];
  liveXAxis: LiveXAxisConfig | null;
  liveYAxis: LiveYAxisConfig | null;
  tooltip: ChartTooltipConfig | null;
  referenceAreas: Array<Record<string, unknown>>;
}

function extractLiveLineChildren(children: React.ReactNode): ExtractedLiveLineChildren {
  const out: ExtractedLiveLineChildren = {
    liveLines: [],
    liveXAxis: null,
    liveYAxis: null,
    tooltip: null,
    referenceAreas: [],
  };
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = roleOf(child.type);
      if (role === "liveLine") out.liveLines.push(child.props as LiveLineConfig);
      else if (role === "liveXAxis") out.liveXAxis = child.props as LiveXAxisConfig;
      else if (role === "liveYAxis") out.liveYAxis = child.props as LiveYAxisConfig;
      else if (role === "referenceArea") out.referenceAreas.push(child.props as Record<string, unknown>);
      else if (role === "tooltip")
        out.tooltip = { enabled: true, ...(child.props as ChartTooltipConfig) };
    }
  };
  visit(children);
  return out;
}

const defaultFormatTime = (t: number) => hmsTimeFmt.format(new Date(t));
const defaultFormatValue = (v: number) => v.toFixed(2);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveLineChart({
  data,
  value,
  dataKey = "value",
  window: windowSecs = 30,
  numXTicks = 5,
  nowOffsetUnits = 0,
  exaggerate = false,
  lerpSpeed = LERP_SPEED,
  margin: marginProp,
  paused = false,
  children,
  className,
  style,
}: LiveLineChartProps) {
  // Keep the value object stable when callers pass the same margin values.
  // TanStack treats definition identity as its update boundary; a fresh
  // margin object would otherwise invalidate the definition even on renders
  // caused by unrelated parent work.  Individual fields are dependencies so
  // this does not hide a public margin change behind a mutable object.
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
  const uid = React.useId();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { width, height } = useMeasuredRect(containerRef);
  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);

  const { liveLines, liveXAxis, liveYAxis, tooltip, referenceAreas: liveRefAreas } = React.useMemo(
    () => extractLiveLineChildren(children),
    [children],
  );

  const windowMs = windowSecs * 1000;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const xTickUnitMs = windowMs / Math.max(1, numXTicks - 1);
  const leadingMs = nowOffsetUnits * xTickUnitMs;

  // ---- Animation state (bklit LiveLineChartCore 335-347) ----
  const initialFrame: AnimFrame = { now: Date.now(), yMin: 0, yMax: 100, displayValue: value };
  const animRef = React.useRef<AnimFrame>(initialFrame);
  const [frame, setFrame] = React.useState<AnimFrame>(initialFrame);
  const committedFrameRef = React.useRef(initialFrame);

  // Refs so the long-lived rAF loop always reads current props/derived
  // values without needing to restart on every render (bklit uses the same
  // ref pattern for `pausedRef`/`dataRef`/`dataKeyRef`, 349-357).
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;
  const dataRef = React.useRef(data);
  dataRef.current = data;
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const dataKeyRef = React.useRef(dataKey);
  dataKeyRef.current = dataKey;
  const lerpSpeedRef = React.useRef(lerpSpeed);
  lerpSpeedRef.current = lerpSpeed;
  const liveLinesRef = React.useRef(liveLines);
  liveLinesRef.current = liveLines;
  const liveXAxisRef = React.useRef(liveXAxis);
  liveXAxisRef.current = liveXAxis;

  const targetRange = React.useMemo(
    () => computeTargetRange(data, value, exaggerate),
    [data, value, exaggerate],
  );
  const targetRangeRef = React.useRef(targetRange);
  targetRangeRef.current = targetRange;

  // ---- Hover chrome (internal/live-hover-chrome.ts) ----
  const chromeRef = React.useRef<LiveHoverChrome | null>(null);
  const chartConfig = useChartConfig();
  // Per-series "live tip" group elements, keyed by dataKey — registered with
  // the chrome as one combined list so multiple <LiveLine> series all dim
  // together while scrubbing (a single flat `registerLiveGroups([el])` call
  // per series, as each LiveTipChrome's own ref callback would otherwise do
  // in isolation, would clobber every OTHER series' registration instead of
  // accumulating them).
  const liveGroupElsRef = React.useRef<Map<string, SVGGElement>>(new Map());
  const chromeConfigRef = React.useRef<LiveHoverConfig>({
    margin,
    series: [],
    showCrosshair: true,
    showDots: true,
    showBox: true,
    showDatePill: true,
  });
  // bklit's tooltip chrome (crosshair/dots/box) only exists when a
  // <ChartTooltip> child is present and enabled — without one, the core still
  // resolves tooltipData (LiveXAxis's pill + label fade key off it) but no
  // tooltip UI renders. The time pill belongs to LiveXAxis, NOT to
  // ChartTooltip's own `showDatePill` (that flag controls ChartTooltip's
  // separate DateTicker pill, which the canonical live demo disables exactly
  // because LiveXAxis brings its own — see live-x-axis.tsx 128-143).
  const tooltipOn = tooltip !== null && tooltip.enabled !== false;
  chromeConfigRef.current = {
    margin,
    series: liveLines.map((cfg) => ({
      dataKey: cfg.dataKey,
      color: cfg.stroke ?? "var(--chart-line-primary)",
      formatValue: cfg.formatValue ?? defaultFormatValue,
    })),
    showCrosshair: tooltipOn && (tooltip?.showCrosshair ?? true),
    showDots: tooltipOn && (tooltip?.showDots ?? true),
    showBox: tooltipOn,
    showDatePill: liveXAxis !== null,
    dotVariant: tooltip?.dotVariant,
    dotSize: tooltip?.dotSize,
    dotRadiusFraction: tooltip?.dotRadiusFraction,
    dotScale: tooltip?.dotScale,
    dotStrokeWidth: tooltip?.dotStrokeWidth,
    dotColor: tooltip?.dotColor as string | ((point: Record<string, unknown>, line: { dataKey: string; stroke?: string }) => string) | undefined,
    indicatorColor: tooltip?.indicatorColor as string | ((point: Record<string, unknown>) => string) | undefined,
    indicatorWidth: tooltip?.indicatorWidth,
    indicatorSpan: tooltip?.indicatorSpan,
    columnWidth: tooltip?.columnWidth,
    indicatorDasharray: tooltip?.indicatorDasharray,
    indicatorFadeEdges: tooltip?.indicatorFadeEdges as import("./internal/tooltip-chrome").IndicatorConfig["fadeEdges"],
    indicatorFadeLength: tooltip?.indicatorFadeLength,
    springConfig: tooltip?.springConfig,
    matchCrosshair: tooltip?.matchCrosshair,
    damping: tooltip?.damping,
    boxSpringConfig: tooltip?.boxSpringConfig,
    className: tooltip?.className,
    panelStyle: tooltip?.panelStyle,
    backgroundColor: tooltip?.backgroundColor,
    rows: tooltip?.rows as LiveHoverConfig["rows"],
    children: tooltip?.children as LiveHoverConfig["children"],
    content: tooltip?.content,
  };

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el) return;
    const chrome = attachLiveHoverChrome(el, () => chromeConfigRef.current, {
      tooltipSpring: chartConfig.tooltipSpring,
      tooltipBoxSpring: chartConfig.tooltipBoxSpring,
    });
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
    // Attaches once per mount (chartConfig is the stable DEFAULT_CHART_CONFIG
    // unless a ChartConfigProvider supplies a value) — the module reads current
    // config via `chromeConfigRef` on every call, matching hover-chrome.ts's own
    // getState-callback convention.
  }, [chartConfig]);

  // ---- Native pointer tracking (D16/D22: ref only, no React state) ----
  // Canvas-space margin-coord snapshot — closing the rAF tick over this
  // snapshot avoids the 32ms staleness window where `chromeConfigRef.margin`
  // could lag a prop `margin` change (audit §4 C3).
  const cursorStateRef = React.useRef<{ x: number | null; margin: Margin; innerWidth: number } | null>(null);
  const cursorXRef = React.useRef<number | null>(null);
  const wakeLoopRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - margin.left;
      cursorXRef.current = x >= 0 && x <= innerWidth ? x : null;
      cursorStateRef.current = { x: cursorXRef.current, margin, innerWidth };
      wakeLoopRef.current?.();
    };
    const onLeave = () => {
      cursorXRef.current = null;
      cursorStateRef.current = { x: null, margin, innerWidth };
      wakeLoopRef.current?.();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [margin, innerWidth]);

  // ---- The rAF loop (bklit LiveLineChartCore tick(), 378-430) ----
  React.useEffect(() => {
    if (innerWidth <= 0 || innerHeight <= 0) return;
    let raf = 0;
    let lastFrameCommit = 0;
    const tick = () => {
      raf = 0;
      const next = nextAnimFrame(
        animRef.current,
        targetRangeRef.current,
        valueRef.current,
        lerpSpeedRef.current,
        pausedRef.current,
      );
      animRef.current = next;

      const chrome = chromeRef.current;
      if (chrome) {
        const cursorState = cursorStateRef.current;
        const cursorX = cursorState?.x ?? cursorXRef.current;
        const resolvedInnerWidth = cursorState?.innerWidth ?? innerWidth;
        const resolvedChromeMargin = cursorState?.margin ?? chromeConfigRef.current.margin;
        if (cursorX === null) {
          chrome.updateHover({ point: null, pillLabel: null, index: 0 });
        } else {
          const domainEndMs = next.now + leadingMs;
          const xScaleNext = scaleTime()
            .domain([new Date(domainEndMs - windowMs), new Date(domainEndMs)])
            .range([0, resolvedInnerWidth]);
          const yScaleNext = scaleLinear()
            .domain([next.yMin, next.yMax])
            .nice()
            .range([innerHeight, 0]);
          const timeMs = xScaleNext.invert(cursorX).getTime();
          const timeSec = timeMs / 1000;
          const windowStartSec = (domainEndMs - windowMs) / 1000;
          const rawBase = dataRef.current;
          const startI = bisectTime(rawBase, windowStartSec, 0);
          const tipNow = next.now / 1000;
          const tipNext = (next.now + xTickUnitMs) / 1000;
          let val: number | null = null;
          const hoverSlice = rawBase.slice(startI);
          const hasRealSlice = hoverSlice.length > 0;
          if (hasRealSlice) {
            // Windowed reuse: the committed `hoverSlice` already covers the
            // hoverable window; tip clamps only matter past the last real
            // point, so extend with the two synthetic tip points when our
            // hover time is beyond the slice end (paste-trail branch).
            const lastT = hoverSlice[hoverSlice.length - 1]!.time;
            let probe: LiveLinePoint[] = hoverSlice as LiveLinePoint[];
            if (timeSec >= tipNow) {
              const extended = hoverSlice.slice();
              extended.push({ time: tipNow, value: next.displayValue });
              extended.push({ time: tipNext, value: next.displayValue });
              probe = extended;
            } else if (timeSec > lastT) {
              const extended = hoverSlice.slice();
              extended.push({ time: tipNow, value: next.displayValue });
              probe = extended;
            }
            val = interpolateAtTime(probe, timeSec);
          } else {
            const visible = rawBase.filter((p) => p.time >= windowStartSec);
            visible.push({ time: tipNow, value: next.displayValue });
            visible.push({ time: tipNext, value: next.displayValue });
            val = interpolateAtTime(visible, timeSec);
          }
          if (val === null) {
            chrome.updateHover({ point: null, pillLabel: null, index: 0 });
          } else {
            // Chrome geometry is CANVAS-space (margins included) — same
            // convention as the shared hover-chrome's TanStack focus points
            // and bklit's own `tooltipData.x + margin.left` (live-x-axis.tsx
            // 78/91); `cursorX`/the scales are inner-space, so offset here.
            const py = (yScaleNext(val) ?? 0) + resolvedChromeMargin.top;
            const formatTime = liveXAxisRef.current?.formatTime ?? defaultFormatTime;
            chrome.updateHover({
              point: {
                x: cursorX + resolvedChromeMargin.left,
                date: new Date(timeMs),
                series: liveLinesRef.current.map((cfg) => ({
                  dataKey: cfg.dataKey,
                  value: val as number,
                  y: py,
                })),
              },
              pillLabel: formatTime(timeMs),
              index: 0,
            });
          }
        }
      }

      const now = performance.now();
      const pixelChange = frameChangePixels(committedFrameRef.current, next, innerHeight);
      const shouldWake = !pausedRef.current || pixelChange >= PAUSED_FRAME_PIXEL_THRESHOLD;
      const shouldCommit = shouldWake;
      if (shouldCommit && now - lastFrameCommit >= LIVE_FRAME_COMMIT_MS) {
        lastFrameCommit = now;
        committedFrameRef.current = next;
        React.startTransition(() => setFrame(next));
      }
      // Fix: paused+below-threshold previously exited without re-arming,
      // dead-ending the loop when targetRange unchanged but new `data`
      // arrived; re-arm via wakeLoopRef instead (audit §4 C2 stall).
      if (!shouldWake) {
        wakeLoopRef.current?.();
        return;
      }
      wakeLoopRef.current?.();
    };
    wakeLoopRef.current = () => {
      if (raf === 0) raf = requestAnimationFrame(tick);
    };
    wakeLoopRef.current();
    return () => {
      wakeLoopRef.current = null;
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [windowMs, xTickUnitMs, leadingMs, innerWidth, innerHeight, paused, targetRange]);

  // ---- Scales from the last COMMITTED frame (bklit 444-464) ----
  const domainEndMs = frame.now + leadingMs;
  const xScale = React.useMemo(
    () =>
      scaleTime()
        .domain([new Date(domainEndMs - windowMs), new Date(domainEndMs)])
        .range([0, innerWidth]),
    [domainEndMs, windowMs, innerWidth],
  );
  const yScale = React.useMemo(
    () =>
      scaleLinear()
        .domain([frame.yMin, frame.yMax])
        .nice()
        .range([innerHeight, 0]),
    [frame.yMin, frame.yMax, innerHeight],
  );

  const xAccessor = React.useCallback(
    (d: ChartDatum): Date => (d.date instanceof Date ? d.date : new Date(d.date as number)),
    [],
  );

  // ---- contextData: sliced window + 2 synthetic tip points (bklit 466-500) ----
  const contextData = React.useMemo<ChartDatum[]>(() => {
    const windowStart = domainEndMs - windowMs;
    let startIdx = bisectTime(data, windowStart / 1000, 0);
    if (startIdx > 0) startIdx--;
    const sliced = data.slice(startIdx);
    const records: ChartDatum[] = sliced.map((p) => ({
      date: new Date(p.time * 1000),
      [dataKey]: p.value,
    }));
    records.push({ date: new Date(frame.now), [dataKey]: frame.displayValue });
    records.push({ date: new Date(frame.now + xTickUnitMs), [dataKey]: frame.displayValue });
    return records;
  }, [data, frame.now, frame.displayValue, domainEndMs, windowMs, dataKey, xTickUnitMs]);

  // ---- LiveXAxis / LiveYAxis chrome (committed-frame cadence) ----
  const yIntervalRef = React.useRef(0);
  const xLabels = React.useMemo(() => {
    if (!liveXAxis) return [];
    const n = liveXAxis.numTicks ?? 5;
    const domain = xScale.domain();
    const startMs = domain[0]?.getTime() ?? 0;
    const endMs = domain[1]?.getTime() ?? 0;
    const step = (endMs - startMs) / Math.max(1, n - 1);
    const formatTime = liveXAxis.formatTime ?? defaultFormatTime;
    return Array.from({ length: n }, (_, i) => {
      const t = startMs + i * step;
      const x = (xScale(new Date(t)) ?? 0) + margin.left;
      return { x, label: formatTime(t), key: i };
    });
  }, [liveXAxis, xScale, margin.left]);

  const yTicks = React.useMemo(() => {
    if (!liveYAxis) return [];
    const domain = yScale.domain() as [number, number];
    const minVal = domain[0] ?? 0;
    const maxVal = domain[1] ?? 0;
    const valRange = maxVal - minVal;
    const minGap = liveYAxis.minGap ?? 36;
    const interval = pickNiceInterval(valRange, innerHeight, minGap, yIntervalRef.current);
    yIntervalRef.current = interval;
    if (interval <= 0 || valRange <= 0) return [];
    const allowDecimals = liveYAxis.allowDecimals ?? true;
    const formatValue = liveYAxis.formatValue ?? defaultFormatValue;
    const expandedMin = minVal - interval * 0.5;
    const expandedMax = maxVal + interval * 0.5;
    const first = Math.ceil(expandedMin / interval) * interval;
    const values: number[] = [];
    for (let v = first; v <= expandedMax; v += interval) {
      const rounded = Math.round(v * 1e10) / 1e10;
      if (!Number.isInteger(rounded) && !allowDecimals) continue;
      values.push(rounded);
    }
    const yDomainLive = yScale.domain() as [number, number];
    const refConfigsLive = liveRefAreas.map((p) => ({ y1: p.y1 as number | undefined, y2: p.y2 as number | undefined, axisLabelColor: p.axisLabelColor as string | undefined }));
    const resolveRefColor = createTickColorResolver(refConfigsLive, yDomainLive);
    return values
      .map((val) => {
        const y = yScale(val) ?? 0;
        return {
          key: val.toPrecision(10),
          y,
          label: formatValue(val),
          edgeAlpha: edgeOpacity(y, innerHeight),
          labelColor: resolveRefColor(val),
        };
      })
      .filter((t) => t.y >= -10 && t.y <= innerHeight + 10);
  }, [liveYAxis, yScale, innerHeight, liveRefAreas]);

  React.useLayoutEffect(() => {
    chromeRef.current?.updateFrame({ width, height, margin, xLabels, yTicks });
  }, [width, height, margin, xLabels, yTicks]);

  // ---- Momentum + resolved colors, per <LiveLine> (bklit live-line.tsx) ----
  const lineVisuals = React.useMemo(() => {
    return liveLines.map((cfg) => {
      const momentum = detectMomentum(contextData, cfg.dataKey);
      const baseStroke = cfg.stroke ?? "var(--chart-line-primary)";
      const defaultMomentumColors: MomentumColors = {
        up: "var(--chart-1)",
        down: "var(--chart-5)",
        flat: baseStroke,
      };
      const dotMomentumColors = cfg.momentumColors ?? defaultMomentumColors;
      const dotColor = dotMomentumColors[momentum];
      const resolvedStroke = cfg.momentumColors ? cfg.momentumColors[momentum] : baseStroke;
      const nowPoint =
        contextData.length >= 2 ? contextData[contextData.length - 2] : contextData[contextData.length - 1];
      const liveValue =
        nowPoint && typeof nowPoint[cfg.dataKey] === "number" ? (nowPoint[cfg.dataKey] as number) : 0;
      const liveDotX = nowPoint ? (xScale(xAccessor(nowPoint)) ?? 0) : innerWidth;
      const liveDotY = yScale(liveValue) ?? 0;
      return { cfg, momentum, baseStroke, resolvedStroke, dotColor, liveValue, liveDotX, liveDotY };
    });
  }, [liveLines, contextData, xScale, yScale, xAccessor, innerWidth]);

  // ---- TanStack definition: line + area marks only (bklit's AreaClosed +
  // LinePath, live-line.tsx 201-229) — the five chrome elements (pulse/
  // glow/solid dot/badge/dashed reference) and the fade mask are rendered
  // by the plain SVG overlay below, exactly mirroring bklit's own split
  // between "data marks" and "decorative chrome" (its <LiveLine> renders
  // both from the same component, but nothing besides the area/line
  // actually needs TanStack's headless/keyed reconciliation — the chrome
  // is pure per-frame decoration, matching the LineChart precedent of a
  // separate imperative/plain overlay after `<Chart>`). ----
  const definition = React.useMemo(() => {
    if (width <= 0 || innerWidth <= 0 || innerHeight <= 0 || contextData.length < 2) return null;
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    for (const v of lineVisuals) {
      const cfg = v.cfg;
      const curve: CurveFactory = cfg.curve ?? curveMonotoneX;
      const strokeGradId = `bkm-live-stroke-${uid}-${cfg.dataKey}`;
      const areaGradId = `bkm-live-area-${uid}-${cfg.dataKey}`;
      marks.push(
        liveLineMark(contextData, {
            id: cfg.dataKey,
            fillId: `${cfg.dataKey}__fill`,
            x: xAccessor,
            y: (d) => d[cfg.dataKey] as number,
            fill: `url(#${areaGradId})`,
            stroke: `url(#${strokeGradId})`,
            strokeWidth: cfg.strokeWidth ?? 2,
            curve: d3Curve(curve),
            baselineY: height - margin.bottom,
            withFill: cfg.fill !== false,
          }),
      );
    }
    return defineChart({
      marks,
      x: { scale: xScale, guide: false },
      y: { scale: yScale, guide: false },
      margin,
      // bklit's own reconcile is un-tweened at the TanStack/D3 level — all
      // motion comes from the outer lerp loop already; a scene-level tween
      // here would double-animate.
      animate: false,
      // Native pointer tracking replaces TanStack's focus system entirely
      // (D16/D22) — no `focus`/`maxFocusDistance` configured.
    });
  }, [width, innerWidth, innerHeight, contextData, lineVisuals, xScale, yScale, margin, height, uid, xAccessor]);

  const fadeMaskId = lineVisuals.length > 0 ? `bkm-live-fade-mask-${uid}` : null;

  return (
    <div
      ref={containerRef}
      className={className}
      data-bkm-chart="liveline"
      style={{ position: "relative", width: "100%", height: 300, touchAction: "none", isolation: "isolate", ...style } as React.CSSProperties}
    >
      {liveRefAreas.length > 0 && width > 0 && height > 0 && (
        <ReferenceAreaLayers
          configs={liveRefAreas}
          geom={{
            width,
            height,
            margin,
            yDomain: yScale.domain() as [number, number],
            xDomain: xScale.domain() as [Date, Date],
            isTimeScale: true,
          }}
        />
      )}
      {definition ? (
        <>
          <div
            style={
              fadeMaskId
                ? ({
                    maskImage: `url(#${fadeMaskId})`,
                    WebkitMaskImage: `url(#${fadeMaskId})`,
                  } as React.CSSProperties)
                : undefined
            }
          >
            <Chart ariaLabel="Live line chart" definition={definition} width={width} height={height} />
          </div>
          <svg
            aria-hidden="true"
            width={width}
            height={height}
            style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              <defs>
                {lineVisuals.map((v) => {
                  const strokeGradId = `bkm-live-stroke-${uid}-${v.cfg.dataKey}`;
                  const areaGradId = `bkm-live-area-${uid}-${v.cfg.dataKey}`;
                  const fadeId = `bkm-live-fade-${uid}-${v.cfg.dataKey}`;
                  return (
                    <React.Fragment key={v.cfg.dataKey}>
                      <linearGradient id={strokeGradId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={v.resolvedStroke} stopOpacity={1} />
                        <stop offset="100%" stopColor={v.resolvedStroke} stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id={areaGradId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={v.resolvedStroke} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={v.resolvedStroke} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id={fadeId} x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="white" stopOpacity={0} />
                        <stop offset="4%" stopColor="white" stopOpacity={1} />
                        {v.liveDotX < innerWidth - 1 ? (
                          <>
                            <stop
                              offset={`${(v.liveDotX / Math.max(1, innerWidth)) * 100}%`}
                              stopColor="white"
                              stopOpacity={1}
                            />
                            <stop offset="100%" stopColor="white" stopOpacity={0} />
                          </>
                        ) : (
                          <stop offset="100%" stopColor="white" stopOpacity={1} />
                        )}
                      </linearGradient>
                      {fadeMaskId && v === lineVisuals[0] ? (
                        <mask id={fadeMaskId} maskUnits="userSpaceOnUse">
                          <rect
                            fill={`url(#${fadeId})`}
                            x={margin.left}
                            y={margin.top - 20}
                            width={innerWidth}
                            height={innerHeight + 40}
                          />
                        </mask>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </defs>

              {lineVisuals.map((v) => (
                <LiveTipChrome
                  key={v.cfg.dataKey}
                  cfg={v.cfg}
                  dotColor={v.dotColor}
                  liveValue={v.liveValue}
                  liveDotX={v.liveDotX}
                  liveDotY={v.liveDotY}
                  resolvedStroke={v.resolvedStroke}
                  innerWidth={innerWidth}
                  registerLiveGroup={(el) => {
                    const groups = liveGroupElsRef.current;
                    if (el) groups.set(v.cfg.dataKey, el);
                    else groups.delete(v.cfg.dataKey);
                    chromeRef.current?.registerLiveGroups(Array.from(groups.values()));
                  }}
                />
              ))}
            </g>
          </svg>
        </>
      ) : null}
      {/* Chrome overlay host — must render on the FIRST commit, outside the
          `definition` conditional: the chrome-attach layout effect runs once
          per mount, and on that first commit `width` is still 0 (ResizeObserver
          hasn't measured) so `definition` is null. Gating this div on it left
          `overlayHostRef.current` null at attach time and the chrome (axes
          labels, crosshair, tooltip box, time pill — ALL painted by
          live-hover-chrome via updateFrame/updateHover) silently never
          mounted. Empty it is inert: absolutely positioned, pointer-events
          none, zero children until the chrome populates it. */}
      <div ref={overlayHostRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Five chrome elements (bklit live-line.tsx 231-317), React-rendered at the
// throttled `frame` commit rate — dashed reference line, pulsing ring (SMIL,
// unchanged from bklit), glow dot, solid dot, value badge. The scrub-dim
// (`isScrubbing`) is applied imperatively by live-hover-chrome.ts via
// `registerLiveGroups`/a plain CSS opacity transition, not React state.
// ---------------------------------------------------------------------------

function LiveTipChrome({
  cfg,
  dotColor,
  liveValue,
  liveDotX,
  liveDotY,
  resolvedStroke,
  innerWidth,
  registerLiveGroup,
}: {
  cfg: LiveLineConfig;
  dotColor: string;
  liveValue: number;
  liveDotX: number;
  liveDotY: number;
  resolvedStroke: string;
  innerWidth: number;
  registerLiveGroup: (el: SVGGElement | null) => void;
}) {
  const pulse = cfg.pulse ?? true;
  const dotSize = cfg.dotSize ?? 4;
  const badge = cfg.badge ?? true;
  const formatValue = cfg.formatValue ?? defaultFormatValue;

  return (
    <>
      <line
        opacity={0.25}
        stroke={resolvedStroke}
        strokeDasharray="4,4"
        strokeWidth={1}
        x1={0}
        x2={innerWidth}
        y1={liveDotY}
        y2={liveDotY}
      />
      <g ref={registerLiveGroup} style={{ transition: "opacity 300ms ease-in-out" }}>
        <g>
          {pulse && (
            <circle
              cx={liveDotX}
              cy={liveDotY}
              fill="none"
              opacity={0.4}
              r={dotSize * 2}
              stroke={dotColor}
              strokeWidth={1.5}
            >
              <animate
                attributeName="r"
                dur="1.5s"
                from={String(dotSize)}
                repeatCount="indefinite"
                to={String(dotSize * 3.5)}
              />
              <animate attributeName="opacity" dur="1.5s" from="0.5" repeatCount="indefinite" to="0" />
            </circle>
          )}
          <circle cx={liveDotX} cy={liveDotY} fill={dotColor} opacity={0.1} r={dotSize + 2} />
          <circle
            cx={liveDotX}
            cy={liveDotY}
            fill={dotColor}
            r={dotSize}
            stroke="var(--chart-background)"
            strokeWidth={2}
          />
        </g>
        {badge && (
          <g transform={`translate(${liveDotX + 12},${liveDotY})`}>
            <rect
              fill="var(--popover)"
              height={24}
              opacity={0.95}
              rx={6}
              width={formatValue(liveValue).length * 7.5 + 16}
              x={0}
              y={-12}
            />
            <text
              fill="var(--popover-foreground)"
              fontFamily="SF Mono, Menlo, Monaco, monospace"
              fontSize={11}
              fontWeight={500}
              x={8}
              y={4}
            >
              {formatValue(liveValue)}
            </text>
          </g>
        )}
      </g>
    </>
  );
}

export default LiveLineChart;
