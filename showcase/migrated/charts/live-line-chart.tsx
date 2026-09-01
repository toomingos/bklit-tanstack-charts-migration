"use client";
// Migrated bklit-ui LiveLineChart — same public API (push-model `data`/
// `value`, time-cutoff `window`, `paused`, `<LiveLine>`/`<LiveXAxis>`/
// `<LiveYAxis>`/`<ChartTooltip>` children), rendered via TanStack Charts.
// docs/LOG.md D22: a NEW top-level component (not a LineChart variant),
// reusing only internal/spring.ts and the shared formatters.
//
// C5 (E1-E6): the mark, axis overlays, and hover/tooltip chrome are now all
// native — replacing internal/live-line-mark.ts's old `createMark` polyline
// builder and internal/live-hover-chrome.ts's imperative DOM chrome (deleted;
// see git history / the C5 report for its prior contents). Architecture:
//  - One continuous rAF loop (`tick`, mirrors live-line-chart.tsx tick()
//    378-430) runs for the component's lifetime. EVERY raw tick it advances
//    `now` (frozen while `paused`) and asymmetrically lerps the y-domain
//    (instant expand / 0.08-exponential contract per tick, `nextAnimFrame`
//    below — this lerp step itself is NOT throttled: only the REACT COMMIT
//    of its result is throttled, exactly like bklit).
//  - Only every LIVE_FRAME_COMMIT_MS=32ms does the loop commit `frame` to
//    React state (`startTransition`, matching bklit 420-427). That throttled
//    commit is what feeds TanStack's `definition` (line/area marks,
//    reconciled by the native rolling-path motion contract) and the five
//    React-rendered "live tip" chrome elements below.
//  - E2: the y-lerp (`frame.yMin`/`frame.yMax`) affects ONLY the x/y SCALE
//    DOMAINS the marks are plotted against — every committed SAMPLE (real or
//    synthetic "tip") carries the TRUE, un-lerped value (`frame.trueValue`,
//    literally the `value` prop as of that commit). The old contextData used
//    to push two synthetic points carrying `frame.displayValue` (the LERPED
//    value) — that broke the rolling contract's "retained semantic value
//    unchanged" invariant once those points got stable keys, and the task
//    explicitly calls out that the lerp must stay a domain-only affair.
//  - E3: hover/tooltip is now the C2/C3 native pattern (`focus:"group-x"` +
//    the `@tanstack/charts/tooltip` extension + `renderTooltipBody`, native
//    `crosshair()`/`dot()` marks via internal/hover-geometry.ts) instead of
//    live-hover-chrome.ts's imperative pointer-ref/DOM-write path — this is
//    exactly the follow-up that file's own header called out: "once
//    live-line-mark gains rolling-path/ChartPoints support, re-evaluate
//    whether the native tooltip extension can anchor to those points."
//  - E4: LiveXAxis/LiveYAxis no longer paint an HTML overlay — they configure
//    the native x/y axis (tick values + format + tickLabels), C4-style.
import * as React from "react";
import { bisector } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveMonotoneX, type CurveFactory } from "d3-shape";
import { RendererChart, type ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { defineChart } from "@tanstack/charts/scene";
import type {
  ChartInteractionController,
  ChartKey,
  ChartMark,
  ChartMotionDefinition,
  ChartPoint,
  ChartPositionScaleOptions,
  ChartRendererRenderContext,
} from "@tanstack/charts";
import { roleOf } from "./children";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { hmsTimeFmt } from "./internal/formatters";
import { liveLineMark } from "./internal/live-line-mark";
import { useChartMargin, useMeasuredRect } from "./internal";
import { chartMotionRenderer } from "./internal/motion-renderer";
import {
  buildCrosshairGradientDef,
  buildIndicatorMark,
  buildHoverDotMark,
  resolveHoverDotFill,
  useDatePillOverlay,
} from "./internal/hover-geometry";
import { TOOLTIP_SPRING } from "./internal/design-tokens";
import { useChartConfig } from "./internal/chart-config-context";
import { buildNativeTooltipExtension, renderSeriesTooltipBody } from "./internal/native-tooltip";
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
/** React commit interval for the live animation loop (~30fps). Also used as
 *  the rolling-path motion's tween `duration` (fact 15 / E2): each commit's
 *  shift animates over exactly the interval between commits, so consecutive
 *  shifts hand off into one continuous motion instead of stair-stepping. */
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
  /** E2: the TRUE current value as of this frame — never lerped. Mirrors the
   *  `targetValue` argument `nextAnimFrame` was called with. Committed
   *  samples read this, never `displayValue`. */
  trueValue: number;
  /** Monotonic per-COMMIT sequence number (bumped only when `setFrame`
   *  actually runs, not every raw rAF tick). Used to mint a fresh key for
   *  the two synthetic "tip" samples every commit — see contextData below. */
  seq: number;
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
): Omit<AnimFrame, "seq"> {
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
  return { now: nextNow, yMin: nextYMin, yMax: nextYMax, displayValue: nextValue, trueValue: targetValue };
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

const bisectTime = bisector<LiveLinePoint, number>((d) => d.time).left;

export type Momentum = "up" | "down" | "flat";

/** bklit live-line.tsx `detectMomentum` (21-59), re-targeted at the
    committed `contextData` rows this port builds (same shape:
    `Record<string, unknown>[]` keyed by `dataKey`). */
export function detectMomentum(data: ChartDatum[], dataKey: string, lookback = 20): Momentum {
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
  // E2: also the rolling contract's "fixed plot margins" requirement — the
  // margin passed to `defineChart` must not vary between committed frames.
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
  const uid = React.useId();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { width, height } = useMeasuredRect(containerRef);

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
  const initialFrame: AnimFrame = { now: Date.now(), yMin: 0, yMax: 100, displayValue: value, trueValue: value, seq: 0 };
  const animRef = React.useRef<AnimFrame>(initialFrame);
  const [frame, setFrame] = React.useState<AnimFrame>(initialFrame);
  const committedFrameRef = React.useRef(initialFrame);
  const seqRef = React.useRef(0);

  // Refs so the long-lived rAF loop always reads current props/derived
  // values without needing to restart on every render (bklit uses the same
  // ref pattern for `pausedRef`/`dataRef`/`dataKeyRef`, 349-357).
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const lerpSpeedRef = React.useRef(lerpSpeed);
  lerpSpeedRef.current = lerpSpeed;

  const targetRange = React.useMemo(
    () => computeTargetRange(data, value, exaggerate),
    [data, value, exaggerate],
  );
  const targetRangeRef = React.useRef(targetRange);
  targetRangeRef.current = targetRange;

  // ---- The rAF loop (bklit LiveLineChartCore tick(), 378-430) — now DATA
  // POLICY ONLY (now/y-domain lerp + throttled commit). Hover/tooltip
  // resolution used to live here too (cursorXRef, live-hover-chrome); that
  // is entirely native now (E3) and needs no per-tick imperative work. ----
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
      animRef.current = { ...next, seq: animRef.current.seq };

      const now = performance.now();
      const pixelChange = frameChangePixels(committedFrameRef.current, animRef.current, innerHeight);
      const shouldWake = !pausedRef.current || pixelChange >= PAUSED_FRAME_PIXEL_THRESHOLD;
      if (shouldWake && now - lastFrameCommit >= LIVE_FRAME_COMMIT_MS) {
        lastFrameCommit = now;
        seqRef.current += 1;
        const committed: AnimFrame = { ...next, seq: seqRef.current };
        committedFrameRef.current = committed;
        animRef.current = committed;
        React.startTransition(() => setFrame(committed));
      }
      if (!shouldWake) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [innerWidth, innerHeight, paused, targetRange]);

  // ---- Scales from the last COMMITTED frame (bklit 444-464). y is NOT
  // `.nice()`'d here (unlike the legacy hover-only scale) — motion.md's
  // `y:'reproject'` requires "one affine y transform maps the new
  // projection back to the previous frame"; `.nice()` can round `[yMin,
  // yMax]` to a different multiple between two commits with almost-equal raw
  // bounds, which is not an affine step. Tick VALUES are still niced for
  // display via `pickNiceInterval` below — only the mark-facing domain itself
  // stays the raw lerped range. ----
  const domainEndMs = frame.now + leadingMs;
  const xScale = React.useMemo(
    () =>
      scaleUtc()
        .domain([new Date(domainEndMs - windowMs), new Date(domainEndMs)])
        .range([0, innerWidth]),
    [domainEndMs, windowMs, innerWidth],
  );
  const yScale = React.useMemo(
    () => scaleLinear().domain([frame.yMin, frame.yMax]).range([innerHeight, 0]),
    [frame.yMin, frame.yMax, innerHeight],
  );

  const xAccessor = React.useCallback(
    (d: ChartDatum): Date => (d.date instanceof Date ? d.date : new Date(d.date as number)),
    [],
  );
  const keyAccessor = React.useCallback((d: ChartDatum): ChartKey => d.__key as ChartKey, []);

  // ---- contextData: overscanned window slice + 2 synthetic "tip" samples
  // (bklit 466-500) ----
  const contextData = React.useMemo<ChartDatum[]>(() => {
    const windowStart = domainEndMs - windowMs;
    let startIdx = bisectTime(data, windowStart / 1000, 0);
    if (startIdx > 0) startIdx--;
    const sliced = data.slice(startIdx);
    const records: ChartDatum[] = sliced.map((p) => ({
      date: new Date(p.time * 1000),
      [dataKey]: p.value,
      // Rolling contract: retained keys must be the exact old suffix / new
      // prefix (motion.md:301-313) — a real sample's own timestamp is stable
      // for its whole lifetime in the window, so it is always "the same key"
      // across commits until it scrolls out.
      __key: p.time,
    }));
    // E2: TRUE value (frame.trueValue), never the lerped frame.displayValue.
    // E5/rolling contract: a fresh key EVERY commit (frame.seq) — these two
    // points must never be "retained" across commits, since their x AND y
    // both legitimately change every commit (they track `now`); a stable key
    // here would violate "retained semantic x, y values must be unchanged"
    // and force a fallback snap on every single frame instead of only when
    // truly needed. A per-commit-unique key instead makes them a clean
    // balanced remove+add pair every commit, which the contract allows
    // alongside the affine shift of the real, retained samples.
    records.push({ date: new Date(frame.now), [dataKey]: frame.trueValue, __key: `__tipA:${frame.seq}` });
    records.push({ date: new Date(frame.now + xTickUnitMs), [dataKey]: frame.trueValue, __key: `__tipB:${frame.seq}` });
    return records;
  }, [data, frame.now, frame.trueValue, frame.seq, domainEndMs, windowMs, dataKey, xTickUnitMs]);

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

  // D465: per-series stroke/area gradients, previously two JSX <linearGradient>
  // elements per series (see the removed <defs> entries below) — moved into
  // the chart definition's `gradients:` array (area-chart.tsx's
  // nativeAreaGradients is the model). Explicit y1:0/y2:1 required: the
  // library default is y1:1/y2:0, the opposite of the retired JSX attrs
  // (x1="0" x2="0" y1="0" y2="1"), which would flip the gradient direction.
  const nativeLineGradients = React.useMemo(
    () =>
      lineVisuals.flatMap((v) => [
        {
          id: `bkm-live-stroke-${uid}-${v.cfg.dataKey}`,
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
          stops: [
            { offset: 0, color: v.resolvedStroke, opacity: 1 },
            { offset: 1, color: v.resolvedStroke, opacity: 0.6 },
          ],
        },
        {
          id: `bkm-live-area-${uid}-${v.cfg.dataKey}`,
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
          stops: [
            { offset: 0, color: v.resolvedStroke, opacity: 0.1 },
            { offset: 1, color: v.resolvedStroke, opacity: 0 },
          ],
        },
      ]),
    [lineVisuals, uid],
  );

  // ---- E3: native hover/tooltip wiring ----
  const tooltipOn = tooltip !== null && tooltip.enabled !== false;
  const chartConfig = useChartConfig();
  const liveGroupElsRef = React.useRef<Map<string, SVGGElement>>(new Map());
  const dateLabelsForPill = React.useMemo(() => [] as string[], []);
  const datePill = useDatePillOverlay({
    enabled: tooltipOn && (tooltip?.showDatePill ?? true) && liveXAxis !== null,
    dateLabels: dateLabelsForPill,
    tooltipSpring: chartConfig.tooltipSpring,
  });
  const wasVisibleRef = React.useRef(false);
  const liveXAxisRef = React.useRef(liveXAxis);
  liveXAxisRef.current = liveXAxis;

  const handleFocusChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      const primary = points[0];
      // Legacy live-hover-chrome.ts's registerLiveGroups/updateHover dimmed
      // the "live tip" groups (pulse/glow/solid dot/badge) to opacity 0.25
      // while scrubbing, via a plain CSS transition already on the group
      // element (`transition: "opacity 300ms ease-in-out"` below). Native
      // focus now drives that same toggle directly, independent of whether
      // a <ChartTooltip> is even configured — bklit's dim keyed off pointer
      // position, not tooltip presence.
      const dim = primary != null;
      for (const el of liveGroupElsRef.current.values()) {
        el.style.opacity = dim ? "0.25" : "1";
      }
      if (!tooltipOn) return;
      const axisCfg = liveXAxisRef.current;
      if (primary && axisCfg) {
        const datum = primary.datum as ChartDatum;
        const dateVal = datum.date instanceof Date ? datum.date : new Date(datum.date as number);
        const formatTime = axisCfg.formatTime ?? defaultFormatTime;
        const label = formatTime(dateVal.getTime());
        const jump = !wasVisibleRef.current;
        wasVisibleRef.current = true;
        datePill.show(primary.x, { index: primary.datumIndex, label, discrete: false, jump });
      } else {
        wasVisibleRef.current = false;
        datePill.hide();
      }
    },
    [tooltipOn, datePill],
  );

  const interactionRef = React.useRef<ChartInteractionController<ChartDatum, Date, number> | null>(null);
  const handleRender = React.useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    interactionRef.current = context.interaction;
  }, []);

  const crosshairGradientId = `bkm-live-crosshair-${uid}`;
  const crosshairGradientDef = React.useMemo(() => {
    if (!(tooltipOn && (tooltip?.showCrosshair ?? true))) return null;
    const color = typeof tooltip?.indicatorColor === "string" ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipOn, tooltip, crosshairGradientId]);

  const renderTooltipBody = React.useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): React.ReactNode =>
      renderSeriesTooltipBody(ctx, {
        tooltip,
        resolveTitle: (datum) => {
          const dateVal = datum.date instanceof Date ? datum.date : new Date(datum.date as number);
          const formatTime = liveXAxisRef.current?.formatTime ?? defaultFormatTime;
          return formatTime(dateVal.getTime());
        },
        buildRows: (datum) =>
          lineVisuals.map((v) => {
            const raw = datum[v.cfg.dataKey];
            const formatValue = v.cfg.formatValue ?? defaultFormatValue;
            return {
              color: v.resolvedStroke,
              label: v.cfg.dataKey,
              value: typeof raw === "number" ? formatValue(raw) : String(raw ?? ""),
            };
          }),
      }),
    [tooltip, lineVisuals],
  );

  // ---- E4: native axis tick lists (values only — position/format/opacity
  // come from the native axis machinery itself, unlike the deleted HTML
  // overlay which had to compute pixel coordinates by hand). ----
  const xTickValues = React.useMemo(() => {
    if (!liveXAxis) return [] as Date[];
    const n = liveXAxis.numTicks ?? numXTicks;
    const [start, end] = xScale.domain();
    const startMs = start.getTime();
    const endMs = end.getTime();
    const step = (endMs - startMs) / Math.max(1, n - 1);
    return Array.from({ length: n }, (_, i) => new Date(startMs + i * step));
  }, [liveXAxis, xScale, numXTicks]);

  const yIntervalRef = React.useRef(0);
  const yTickValues = React.useMemo(() => {
    if (!liveYAxis) return [] as number[];
    const [minVal, maxVal] = yScale.domain() as [number, number];
    const valRange = maxVal - minVal;
    const minGap = liveYAxis.minGap ?? 36;
    const interval = pickNiceInterval(valRange, innerHeight, minGap, yIntervalRef.current);
    yIntervalRef.current = interval;
    if (interval <= 0 || valRange <= 0) return [] as number[];
    const allowDecimals = liveYAxis.allowDecimals ?? true;
    const expandedMin = minVal - interval * 0.5;
    const expandedMax = maxVal + interval * 0.5;
    const first = Math.ceil(expandedMin / interval) * interval;
    const values: number[] = [];
    for (let v = first; v <= expandedMax; v += interval) {
      const rounded = Math.round(v * 1e10) / 1e10;
      if (!Number.isInteger(rounded) && !allowDecimals) continue;
      values.push(rounded);
    }
    return values;
  }, [liveYAxis, yScale, innerHeight]);

  // ---- TanStack definition: native line/area, crosshair, hover dots ----
  const definition = React.useMemo(() => {
    if (width <= 0 || innerWidth <= 0 || innerHeight <= 0 || contextData.length < 2) return null;
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    for (const v of lineVisuals) {
      const cfg = v.cfg;
      const curve: CurveFactory = cfg.curve ?? curveMonotoneX;
      const strokeGradId = `bkm-live-stroke-${uid}-${cfg.dataKey}`;
      const areaGradId = `bkm-live-area-${uid}-${cfg.dataKey}`;
      marks.push(
        ...liveLineMark(contextData, {
          id: cfg.dataKey,
          x: xAccessor,
          y: (d) => d[cfg.dataKey] as number,
          key: keyAccessor,
          fill: `url(#${areaGradId})`,
          stroke: `url(#${strokeGradId})`,
          strokeWidth: cfg.strokeWidth ?? 2,
          curve: d3Curve(curve),
          // E2: DOMAIN-space baseline (this commit's yMin), not a pixel
          // constant — keeps the area reproject-compatible (see
          // internal/live-line-mark.ts).
          y1: frame.yMin,
          withFill: cfg.fill !== false,
        }),
      );
    }
    // E3 (C3 pattern): crosshair + per-series hover dot, gated the same way
    // live-hover-chrome.ts's chromeConfigRef used to gate showCrosshair/
    // showDots — both require tooltipOn (bklit: no <ChartTooltip>, no chrome
    // at all).
    if (tooltipOn && (tooltip?.showCrosshair ?? true)) {
      marks.push(
        buildIndicatorMark({
          gradientId: crosshairGradientId,
          width: tooltip?.indicatorWidth,
          dasharray: tooltip?.indicatorDasharray,
          color: typeof tooltip?.indicatorColor === "string" ? tooltip.indicatorColor : undefined,
        }) as unknown as ChartMark<ChartDatum, Date, number>,
      );
    }
    if (tooltipOn && (tooltip?.showDots ?? true)) {
      for (const v of lineVisuals) {
        marks.push(
          buildHoverDotMark(
            contextData,
            "date",
            { dataKey: v.cfg.dataKey, color: v.resolvedStroke },
            resolveHoverDotFill(v.dotColor, tooltip?.dotColor),
            { size: tooltip?.dotSize, strokeWidth: tooltip?.dotStrokeWidth },
          ),
        );
      }
    }
    // E5: definition-level rolling contract (fact 15 / motion.md:270-313).
    // Marks themselves suppress their own one-time mount ENTER
    // (internal/live-line-mark.ts) and fall through to this for every other
    // phase — this is the steady-state timing every ordinary commit uses.
    const rollingMotion: ChartMotionDefinition<ChartDatum> = {
      path: { update: "rolling", x: "shift", y: "reproject", fallback: "snap" },
      transition: { type: "tween", duration: LIVE_FRAME_COMMIT_MS, easing: "linear" },
    };
    const xScaleOptions: ChartPositionScaleOptions<Date> = {
      scale: xScale,
      axis: liveXAxis
        ? {
            ticks: { values: xTickValues, size: 0, padding: 0 },
            line: false,
            tickLabels: { fontSize: 12, thin: false, opacity: 1 },
          }
        : false,
    };
    const yScaleOptions: ChartPositionScaleOptions<number> = {
      scale: yScale,
      side: liveYAxis?.position === "right" ? "right" : "left",
      axis: liveYAxis
        ? {
            ticks: {
              values: yTickValues,
              format: (v: number) => (liveYAxis.formatValue ?? defaultFormatValue)(v),
              size: 0,
              padding: 0,
            },
            line: false,
            tickLabels: {
              fontSize: 12,
              thin: false,
              // C4 parity with the deleted `edgeOpacity` HTML fade —
              // `ctx.position` is the tick's rendered plot-space y (line-
              // chart.tsx's xTickLabelOpacity uses the same convention for x).
              opacity: (ctx: { value: unknown; position: number }) => edgeOpacity(ctx.position, innerHeight),
              dx: liveYAxis.position === "right" ? 8 : -8,
            },
          }
        : false,
    };
    return defineChart({
      marks,
      scales: {
        x: xScaleOptions,
        y: yScaleOptions,
      },
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      margin,
      clip: true,
      motion: rollingMotion,
      focus: "group-x" as const,
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      gradients: nativeLineGradients,
      tooltip: buildNativeTooltipExtension<ChartDatum, Date, number>({
        enabled: tooltipOn,
        spring: TOOLTIP_SPRING,
        discrete: false,
        className: "bkm-native-tooltip",
      }),
    });
  }, [
    width,
    innerWidth,
    innerHeight,
    contextData,
    lineVisuals,
    nativeLineGradients,
    xScale,
    yScale,
    margin,
    uid,
    xAccessor,
    keyAccessor,
    frame.yMin,
    tooltipOn,
    tooltip,
    crosshairGradientId,
    liveXAxis,
    liveYAxis,
    xTickValues,
    yTickValues,
  ]);

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
            <RendererChart
              ariaLabel="Live line chart"
              renderer={chartMotionRenderer<ChartDatum, Date, number>()}
              definition={definition}
              width={width}
              height={height}
              onFocusGroupChange={handleFocusChange}
              onRender={handleRender}
              renderTooltipBody={tooltipOn ? renderTooltipBody : undefined}
            />
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
                  const fadeId = `bkm-live-fade-${uid}-${v.cfg.dataKey}`;
                  return (
                    <React.Fragment key={v.cfg.dataKey}>
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
                {crosshairGradientDef ? (
                  <linearGradient
                    id={crosshairGradientDef.id}
                    gradientUnits="userSpaceOnUse"
                    x1={0}
                    x2={0}
                    y1={margin.top}
                    y2={margin.top + innerHeight}
                  >
                    {crosshairGradientDef.stops.map((s) => (
                      <stop key={s.offset} offset={s.offset} stopColor={crosshairGradientDef.color} stopOpacity={s.opacity} />
                    ))}
                  </linearGradient>
                ) : null}
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
                  }}
                />
              ))}
            </g>
          </svg>
        </>
      ) : null}
      {tooltipOn && liveXAxis ? (
        <div ref={datePill.overlayHostRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Five chrome elements (bklit live-line.tsx 231-317), React-rendered at the
// throttled `frame` commit rate — dashed reference line, pulsing ring (SMIL,
// unchanged from bklit), glow dot, solid dot, value badge. The scrub-dim
// (`isScrubbing`) is applied imperatively via `handleFocusChange` above
// (`el.style.opacity`), a plain CSS transition already declared inline here —
// not React state, not the deleted live-hover-chrome.ts module.
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
