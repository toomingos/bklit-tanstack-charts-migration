// bklit CandlestickChart as one native TanStack definition: per direction a `barY` wick (1.5px) and body (80% slot = bklit's 0.2 gap).
// Hover/legend dimming is the fixed `CANDLE_HOVER_CSS`; crosshair, pill and close dot are native guides; the entrance is local `motion`.
import type { EnterTransition } from "../kit/motion/phase";
import { resumeEnter } from "../kit/motion/resume-enter";
import { revealEndFromEnter } from "../kit/size/parent-size-arm";
import { REST_GRANULAR, REST_NEVER, settleMs, springFrequency, springOf } from "../kit/motion/spring-curve";
import type { Spring } from "../kit/motion/springs";
import type { RevealClock } from "../kit/size/parent-size-arm";
import { barY, defineChart } from "@tanstack/charts";
import type { ChartMark, ChartMotionDefinition, ChartMotionTransition, ChartPoint, DomChartDefinition } from "@tanstack/charts";
import { crosshair } from "@tanstack/charts/crosshair";
import { focusNearestX } from "@tanstack/charts/focus";
import { decorative } from "@tanstack/charts/mark/decorative";
import { bklitTooltip } from "../kit/tooltip/bklit-tooltip";
import { tooltipBoxMotion } from "../kit/tooltip/box-motion";
import type { TooltipBoxMotionProps } from "../kit/tooltip/box-motion";
import { scaleLinear, scaleTime, scaleUtc } from "d3-scale";
import { propsFor } from "../kit/read-children";
import type { ChildTable } from "../kit/read-children";
import { erase } from "../kit/cartesian/erased-types";
import { buildOverlays } from "../kit/cartesian/overlays";
import { shortDateFmt } from "../kit/format";
import { toDate } from "../kit/cartesian/series";
import { dataTickValues } from "../kit/cartesian/x-axis";
import { niced } from "../kit/cartesian/domains";
import { gridColumnGuides, gridHostAttrs, gridLineStyle, gridRowGuides } from "../kit/cartesian/grid-guides";
import type { GridGuideProps as GridProps } from "../kit/cartesian/grid-guides";
import { BKLIT_TOOLTIP_PLACEMENT, MS_PER_SECOND, X_TICK_PADDING, bklitTheme } from "../kit/theme";
import { BKLIT_GUIDE_SPRING, crosshairGradient, crosshairRuleMark, datePillGuides, guideMark, pillLayout, pillGuideMotion, withPillGeometry } from "../kit/cartesian/date-pill";
import type { ChartMargin } from "../kit/theme";
import type { CandlestickProps } from "./carrier";
import { readyGateCss } from "../kit/cartesian/gate-css";
import { NOT_MOTION, typedAttr } from "../kit/css-hooks";

export type Candle = Record<string, unknown>;

export interface CandlestickInput {
  readonly data: readonly Candle[];
  readonly xKey: string;
  readonly table: ChildTable;
  readonly margin: ChartMargin;
  readonly uid: string;
  readonly animationDuration: number;
  readonly enterTransition?: EnterTransition;
  readonly xDomain?: readonly [Date, Date];
  readonly xDomainSlotCount?: number;
  readonly candleWidth?: number;
  /** Paint the scene without candles first so they ENTER (native enter only animates marks added to a painted scene). */
  readonly seedOnly?: boolean;
  /** bklit's reveal timer clock: the swap to static candles lands `animationDuration` after the chart's mount effect. */
  readonly revealClock?: RevealClock;
  /** bklit's AnimatedCandle phase (before `isLoaded`): body and wick split at the centre into two bars growing outward (native `scaleY`); `isLoaded` swaps in static candles. */
  readonly entrance?: boolean;
}

interface XAxisProps {
  numTicks?: number;
  tickMode?: "domain" | "data";
  formatValue?: (value: Date) => string;
}
interface YAxisProps {
  numTicks?: number;
  formatLargeNumbers?: boolean;
  formatValue?: (value: number) => string;
}
interface TooltipProps extends TooltipBoxMotionProps {
  showDatePill?: boolean;
  showCrosshair?: boolean;
  showDots?: boolean;
  dotSize?: number;
  dotStrokeWidth?: number;
  indicatorColor?: string | ((point: Candle) => string);
  indicatorDasharray?: string;
  dotColor?: string | ((point: Candle, line: { dataKey: string }) => string);
}

const POSITIVE = "var(--color-emerald-500)";
const NEGATIVE = "var(--color-red-500)";
const DEFAULT_GRADIENT_FILLS = new Set(["url(#candlestick-positive)", "url(#candlestick-negative)"]);
const WICK_WIDTH = 1.5;
const outsideSpan = (value: number, start: number, size: number): boolean => value < start || value > start + size;
// bklit tooltipSpring (crosshair + dot); the panel follows tooltipBoxMotion.
const GUIDE_SPRING = BKLIT_GUIDE_SPRING;

// SAFETY: a candle x is a Date, ISO string or epoch number; any other value yields an Invalid Date, which every caller already filters.
// null / undefined are missing (Number(null) would be 0 and drag the y domain to zero); bklit draws such a candle as garbage at the top edge, here it is a gap.
const num = (v: unknown): number => (v === null || v === undefined ? Number.NaN : Number(v));
const isPositive = (d: Candle): boolean => num(d.close) >= num(d.open);

/** Maps bklit's motion-style `Transition` to a native tween; every spring runs as an analytic curve (`resolveEnterCurve`) on a tween. */
function resolveEnterTransition(t: EnterTransition | undefined): ChartMotionTransition {
  return { type: "tween", duration: (t?.duration ?? 0.8) * MS_PER_SECOND, easing: "ease-out" };
}

interface EnterCurve {
  /** Total run time (ms): motion ends the spring here. */
  readonly durationMs: number;
  /** Position at time t (ms, 0..durationMs) for a 0 -> 1 move, overshoot included. */
  readonly at: (tMs: number) => number;
}

const SETTLE_STEP_MS = 8;
const SETTLE_LIMIT_MS = 10_000;
// bklit animates `scaleY` 0 -> 1 about the candle centre: a span under 5, so motion's granular rest thresholds (REST_GRANULAR).
const UNIT_MOVE = { from: 0, to: 1, velocity: 0 };

/** The analytic 0 -> 1 curve of a physics spring (motion's defaults 100 / 10 / 1), ended where motion's granular rest thresholds are met. */
function physicsCurve(spring: Spring, capMs: number): EnterCurve {
  const native = springOf(spring, REST_GRANULAR);
  return { durationMs: settleMs(native, UNIT_MOVE, SETTLE_STEP_MS, Math.min(capMs, SETTLE_LIMIT_MS)), at: (tMs) => native.sample(tMs, UNIT_MOVE).value };
}

/** The analytic curve of bklit's spring enter (duration/bounce, or stiffness/damping), or null for a tween. Runs on a tween so the reveal timer's cut (below)
 * lands on it like bklit's; rest is on the `scaleY` span, not the native px geometry of the two half bars. */
function resolveEnterCurve(t: EnterTransition | undefined): EnterCurve | null {
  if (t?.type === "tween") {
    return null;
  }
  if (t?.stiffness !== undefined || t?.damping !== undefined) {
    return physicsCurve({ damping: t.damping ?? 10, mass: t.mass ?? 1, stiffness: t.stiffness ?? 100 }, SETTLE_LIMIT_MS);
  }
  const duration = t?.duration ?? 0.8;
  const bounce = t?.bounce ?? 0.15;
  if (bounce <= 0 || bounce >= 0.95) {
    const omega = (2 * Math.PI) / duration;
    return physicsCurve({ damping: 2 * (1 - bounce) * omega, mass: 1, stiffness: omega * omega }, duration * MS_PER_SECOND);
  }
  const w0 = springFrequency(duration, bounce);
  // motion ends this spring at `duration`, not where it rests: sampled without a snap to the target.
  const native = springOf({ damping: 2 * (1 - bounce) * w0, mass: 1, stiffness: w0 * w0 }, REST_NEVER);
  return { durationMs: duration * MS_PER_SECOND, at: (tMs) => native.sample(tMs, UNIT_MOVE).value };
}

/** y domain: low/high padded 5%, niced (bklit). */
function yExtent(rows: readonly Candle[]): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    const low = num(r.low);
    const high = num(r.high);
    if (Number.isFinite(low)) { lo = Math.min(lo, low); }
    if (Number.isFinite(high)) { hi = Math.max(hi, high); }
  }
  if (lo === Number.POSITIVE_INFINITY) { lo = 0; }
  if (hi === Number.NEGATIVE_INFINITY) { hi = 100; }
  const pad = (hi - lo) * 0.05 || 1;
  return [lo - pad, hi + pad];
}

/** x domain padded by half a slot each side, so edge candles sit inside the plot like bklit's range inset. */
function xExtent(rows: readonly Candle[], xKey: string, xDomain?: readonly [Date, Date], slots?: number): [Date, Date] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  if (xDomain) {
    lo = xDomain[0].getTime();
    hi = xDomain[1].getTime();
  } else {
    for (const r of rows) {
      const t = toDate(r[xKey]).getTime();
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
  }
  if (!Number.isFinite(lo)) { return [new Date(0), new Date(1)]; }
  const count = slots ?? rows.length;
  const pad = count > 1 && hi > lo ? (hi - lo) / (count - 1) / 2 : 43_200_000;
  return [new Date(lo - pad), new Date(hi + pad)];
}

export interface CandlestickDomains {
  x: [Date, Date];
  y: [number, number];
}

/** Resolved plot domains (x padded by half a slot, y padded and niced), for the public chart context. */
export function candlestickDomains(
  rows: readonly Candle[],
  xKey: string,
  xDomain?: readonly [Date, Date],
  slots?: number,
): CandlestickDomains {
  return { x: xExtent(rows, xKey, xDomain, slots), y: niced(yExtent(rows)) };
}

export interface CandlestickBuild {
  definition: DomChartDefinition<Candle, Date, number>;
  /** x tick values (ms), the plot-wide x span (ms) and the pill reach (px): scoped tick-blanking CSS. */
  pillTicks: { readonly times: readonly number[]; readonly spanMs: number; readonly reachPx: number; readonly active: boolean };
  /** Chart-hover dim opacity (null when `showHoverFade` is off): the `--bkm-faded` host var. */
  readonly hoverFadeOpacity: number | null;
  readonly fadedOpacity: number;
  /** Host attributes for the static grid edge-fade rules (styles.css). */
  readonly gridAttrs: Record<string, string | undefined>;
}

type CandleMark = ChartMark<Candle, Date, number>;

const wickMid = (d: Candle): number => (num(d.high) + num(d.low)) / 2;

const solid = (fill: string | undefined, fallback: string): string => (fill === undefined || DEFAULT_GRADIENT_FILLS.has(fill) ? fallback : fill);

// A per-point colour function has no single paint here, so it falls back like an unset value.
// oxlint-disable-next-line anti-slop/no-runtime-typeof -- the carrier prop is bklit's public `string | function` union, discriminated at its only boundary.
const colorOr = (value: string | ((...args: never[]) => string) | undefined, fallback: string): string => (typeof value === "function" ? fallback : (value ?? fallback));

const curveEasing = (curve: EnterCurve, run: number) => (u: number): number => (u >= 1 ? 1 : curve.at(u * run));

/** bklit swaps to static candles when its reveal timer ends (`animationDuration` after mount), cutting any spring in flight; replay the same cut on the analytic curve. */
function candleMotion(input: CandlestickInput, stagger: number): ChartMotionDefinition<Candle> {
  const curve = resolveEnterCurve(input.enterTransition);
  const transition = resolveEnterTransition(input.enterTransition);
  // Clock of the first enter call: a render forced mid-entrance (web-font swap) is an update and resumes this schedule.
  let enterAt: number | null = null;
  const endAt = (): number => revealEndFromEnter(input.revealClock ?? { mountedAt: null }, enterAt, input.animationDuration);
  return (ctx) => {
    const delay = ctx.datumIndex * stagger;
    if (ctx.phase === "update") {
      if (!curve) {
        return undefined;
      }
      const run = Math.max(1, Math.min(curve.durationMs, endAt() - delay));
      return resumeEnter({ delay: Math.min(delay, endAt()), duration: run, easing: curveEasing(curve, run) }, enterAt);
    }
    if (ctx.phase === "exit") {
      // bklit unmounts a candle instantly (also the entrance's lower body half at the `isLoaded` swap).
      return false;
    }
    enterAt ??= performance.now();
    if (!curve) {
      return { delay, transition };
    }
    const run = Math.max(1, Math.min(curve.durationMs, endAt() - delay));
    return { delay: Math.min(delay, endAt()), transition: { type: "tween", duration: run, easing: curveEasing(curve, run) } };
  };
}

interface CandleMarkInput {
  readonly rows: readonly Candle[];
  readonly xKey: string;
  readonly motion: ChartMotionDefinition<Candle>;
  readonly positiveFill: string;
  readonly negativeFill: string;
  readonly candleWidth: number | undefined;
  readonly entrance: boolean;
  /** Data units per pixel, read per call (the `chart` callback writes the plot height before any mark renders). */
  readonly onePx: () => number;
}

function candleMarks({ rows, xKey, motion, positiveFill, negativeFill, candleWidth, entrance, onePx }: CandleMarkInput): CandleMark[] {
  const keyOf = (d: Candle): string => `${isPositive(d) ? "pos" : "neg"}:${toDate(d[xKey]).getTime()}`;
  const fillOf = (d: Candle): string => (isPositive(d) ? positiveFill : negativeFill);
  const common = { x: (d: Candle): Date => toDate(d[xKey]), key: keyOf, fill: fillOf, motion };
  // bklit's body: open..close, with `|close - open| || 1` px height (a zero-height rect paints nothing, so add that pixel in data units).
  const bodyClose = (d: Candle): number => (num(d.open) === num(d.close) ? num(d.close) - onePx() : num(d.close));
  const bodyHi = (d: Candle): number => Math.max(num(d.open), bodyClose(d));
  const bodyLo = (d: Candle): number => Math.min(num(d.open), bodyClose(d));
  // bklit scales body and wick about their centres (candlestick.tsx AnimatedCandle `bodyOrigin`, `wickCenterY`): during the
  // entrance each is two bars growing from its centre, sharing the candle's delay and curve.
  const bodyMid = (d: Candle): number => (bodyHi(d) + bodyLo(d)) / 2;
  const bodyBase = { stroke: fillOf, strokeWidth: 1, radius: 1, z: (): string => "close" };
  const bodyStyle = candleWidth === undefined ? bodyBase : { ...bodyBase, maxThickness: candleWidth };
  // Each wick covers only the part outside the body at rest (bklit's dimmed candle `g` hides the wick under the body).
  const wick = (id: string, y1: (d: Candle) => number, y2: (d: Candle) => number): CandleMark =>
    decorative(barY(rows, { ...common, id, y1, y2, maxThickness: WICK_WIDTH }));
  return [
    wick("wick", entrance ? wickMid : bodyHi, (d) => num(d.high)),
    wick("wick-lo", entrance ? wickMid : bodyLo, (d) => num(d.low)),
    barY(rows, { ...common, ...bodyStyle, id: "body", y1: entrance ? bodyMid : (d: Candle): number => num(d.open), y2: entrance ? bodyHi : bodyClose }),
    // The emptied lower half stays a mark after the swap so its candles exit through this motion (instant), not the default tween.
    decorative(barY(entrance ? rows : [], { ...common, ...bodyStyle, id: "body-lo", y1: bodyMid, y2: bodyLo })),
  ];
}

interface TooltipMarkInput {
  readonly tt: TooltipProps;
  readonly rows: readonly Candle[];
  readonly xKey: string;
  readonly uid: string;
  readonly marginBottom: number;
}

interface TooltipMarks {
  readonly marks: CandleMark[];
  readonly gradients: ReturnType<typeof crosshairGradient>[];
}

function tooltipMarks({ tt, rows, xKey, uid, marginBottom }: TooltipMarkInput): TooltipMarks {
  const marks: CandleMark[] = [];
  const gradients: ReturnType<typeof crosshairGradient>[] = [];
  const timeKey = (d: Candle): number => toDate(d[xKey]).getTime();
  if (tt.showDatePill !== false) {
    const labels = rows.map((row) => shortDateFmt.format(toDate(row[xKey])));
    const pill = pillLayout(labels);
    marks.push(...datePillGuides({ rows, x: (d: Candle) => toDate(d[xKey]), y: (d: Candle) => num(d.close), key: timeKey, offset: marginBottom - 19.8, motion: pillGuideMotion(GUIDE_SPRING) }, pill));
  }
  if (tt.showCrosshair !== false) {
    const indicatorColor = colorOr(tt.indicatorColor, "var(--chart-crosshair)");
    const dash = tt.indicatorDasharray;
    if (dash !== undefined && dash !== "") {
      // bklit draws a dashed indicator as a plain stroked line (no fade).
      const ruleMotion = erase(pillGuideMotion(GUIDE_SPRING));
      marks.push(
        crosshair({
          id: "crosshair",
          x: { stroke: indicatorColor, strokeOpacity: 1, strokeWidth: 1, strokeDasharray: dash.replace(",", " "), label: false },
          y: false,
          motion: ruleMotion,
        }),
      );
    } else {
      gradients.push(crosshairGradient("crosshair", indicatorColor));
      marks.push(crosshairRuleMark({ id: "crosshair", paint: `url(#${uid}-crosshair)`, width: 1, motion: pillGuideMotion(GUIDE_SPRING) }));
    }
  }
  if (tt.showDots !== false) {
    const dotFill = colorOr(tt.dotColor, "var(--chart-line-primary)");
    const closeAt = new Map<number, number>(rows.map((row) => [timeKey(row), num(row.close)]));
    const radius = tt.dotSize ?? 5;
    // A guide mark placed after the crosshair rule: both live in the same over layer, so the dot paints above the rule (bklit order).
    marks.push(
      guideMark({
        id: "close:dot",
        motion: pillGuideMotion(GUIDE_SPRING),
        node: (x, _chart, xValue, scales) => {
          const close = closeAt.get(toDate(xValue).getTime());
          if (close === undefined || !Number.isFinite(close)) {
            return undefined;
          }
          return {
            kind: "group" as const,
            key: "close:dot",
            // gap #36: our own guide group borrows core's fixed crosshair class; guide nodes have no documented className.
            className: "ts-chart__crosshair",
            ariaHidden: true,
            translateX: x,
            translateY: scales.y.map(close),
            children: [
              {
                kind: "dot" as const,
                key: "close:dot:marker",
                x: 0,
                y: 0,
                radius,
                style: { fill: dotFill, fillOpacity: 1, stroke: "var(--chart-background)", strokeOpacity: 1, strokeWidth: tt.dotStrokeWidth ?? 2 },
              },
            ],
          };
        },
      }),
    );
  }
  return { marks, gradients };
}

export function buildCandlestickDefinition(input: CandlestickInput): CandlestickBuild {
  const { data, xKey, table, margin, animationDuration } = input;
  const candle: CandlestickProps = propsFor<CandlestickProps>(table, "candlestick").at(0) ?? {};
  const grid = propsFor<GridProps>(table, "grid").at(0);
  const xAxis = propsFor<XAxisProps>(table, "xAxis").at(0);
  const yAxis = propsFor<YAxisProps>(table, "yAxis").at(0);
  const tt = propsFor<TooltipProps>(table, "tooltip").at(0);

  const fadedOpacity = candle.fadedOpacity ?? 0.3;
  const animate = candle.animate !== false;
  const xDomain = xExtent(data, xKey, input.xDomain, input.xDomainSlotCount);
  const yDomain = yExtent(data);
  const overlays = buildOverlays(table, data, xKey, input.uid);

  const stagger = data.length > 0 ? (animationDuration * 0.6) / data.length : 0;
  // Plot size, written by the `chart` callback (runs before any focus resolve) for the plot-rect hover gate.
  const plot = { width: 0, height: 0 };
  const [yNiceLo, yNiceHi] = niced(yDomain);
  const onePx = (): number => (yNiceHi - yNiceLo) / Math.max(1, plot.height);
  // bklit's Grid ticks are independent of the axis labels' and can drop edge lines: those rows / columns are marks under the candles.
  const rowGuides = gridRowGuides(grid, scaleLinear().domain(yDomain).nice(), yAxis !== undefined, yAxis?.numTicks);
  const columnMarks = gridColumnGuides(grid, scaleTime().domain(xDomain));
  const tooltip = tt === undefined ? null : tooltipMarks({ tt, rows: data, xKey, uid: input.uid, marginBottom: margin.bottom });
  const marks: CandleMark[] = [
    ...rowGuides.marks,
    ...columnMarks,
    ...candleMarks({
      rows: input.seedOnly === true ? [] : data,
      xKey,
      motion: animate ? candleMotion(input, stagger) : false,
      positiveFill: solid(candle.positiveFill, POSITIVE),
      negativeFill: solid(candle.negativeFill, NEGATIVE),
      candleWidth: input.candleWidth,
      entrance: input.entrance === true && animate,
      onePx,
    }),
    ...overlays.marks(yDomain, xDomain),
    ...(tooltip?.marks ?? []),
  ];

  const tickCount = xAxis?.numTicks ?? 5;
  const xTicks = xAxis?.tickMode === "domain" ? { count: tickCount } : { values: dataTickValues(data, xKey, tickCount) };
  const baseFormatX = xAxis?.formatValue ?? ((d: Date): string => shortDateFmt.format(d));
  const formatY = (v: number): string => {
    if (yAxis?.formatValue) {
      return yAxis.formatValue(v);
    }
    return yAxis?.formatLargeNumbers !== false && Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
  };
  // nearest-x, but only inside the inner plot (bklit's inner-sized hit rect): no tooltip or pill over the margins and axes.
  const outsidePlot = ({ x, y }: { x: number; y: number }): boolean =>
    plot.width > 0 && plot.height > 0 && (outsideSpan(x, margin.left, plot.width) || outsideSpan(y, margin.top, plot.height));
  const boxMotion = tooltipBoxMotion(tt);
  const definition: DomChartDefinition<Candle, Date, number> = erase(defineChart(erase({
    chart: ({ width, height }: { width: number; height: number }) => {
      plot.width = width - margin.left - margin.right;
      plot.height = height - margin.top - margin.bottom;
      return {
        marks,
        scales: {
          x: {
            scale: scaleUtc().domain(xDomain),
            grid: false,
            // bklit x-axis.tsx:397-430 builds every tick with no collision test.
            axis: xAxis
              ? { line: false, ticks: { ...xTicks, size: 0, padding: X_TICK_PADDING, format: baseFormatX }, tickLabels: { fontSize: 12, opacity: 1, thin: false } }
              : false,
          },
          y: {
            scale: scaleLinear().domain(yDomain).nice(),
            grid: rowGuides.native && grid ? gridLineStyle(grid) : false,
            // bklit y-axis.tsx:106-142 draws every scale tick, no collision test.
            axis: yAxis
              ? { line: false, ticks: { count: rowGuides.count, size: 0, format: formatY }, tickLabels: { fontSize: 12, opacity: 1, thin: false } }
              : false,
          },
        },
        margin,
        theme: bklitTheme,
        gradients: [...overlays.gradients, ...(tooltip?.gradients ?? [])],
      };
    },
    focus:
      tt === undefined
        ? undefined
        : {
            ...focusNearestX,
            resolve: (points: readonly ChartPoint<Candle, Date, number>[], context: { x: number; y: number; maxDistance: number }) =>
              outsidePlot(context) ? [] : focusNearestX.resolve(points, context),
          },
    maxFocusDistance: Number.POSITIVE_INFINITY,
    focusRing: false,
    tooltip: tt === undefined ? false : { use: bklitTooltip, ...BKLIT_TOOLTIP_PLACEMENT, sticky: false, motion: boxMotion },
  })));
  const pillActive = tt !== undefined && tt.showDatePill !== false;
  const tickTimes = pillActive ? (xTicks.values ?? scaleUtc().domain(xDomain).ticks(tickCount)).map((d) => d.getTime()) : [];
  if (pillActive) {
    // The pill geometry rides on the tick array for the static CSS distance ramp (`pillLayoutOf`).
    withPillGeometry(tickTimes, {
      plotLeft: margin.left,
      domainStart: xDomain[0].getTime(),
      pill: pillLayout(data.map((row) => shortDateFmt.format(toDate(row[xKey])))),
    });
  }
  return {
    definition,
    hoverFadeOpacity: candle.showHoverFade === false ? null : fadedOpacity,
    fadedOpacity,
    gridAttrs: gridHostAttrs(grid),
    pillTicks: { times: tickTimes, spanMs: xDomain[1].getTime() - xDomain[0].getTime(), reachPx: 62, active: pillActive },
  };
}

/** Fixed rules; the host carries state: `data-bkm-hover` + `--bkm-hx` (focused candle centre, svg px) dims every other candle to `--bkm-faded`;
 * `data-bkm-legend=0|1` dims the other direction and wins over hover (after the reveal, as bklit). Guarded so it never lags the entrance tweens. */
// gap #36: barY marks take no className, so candle rects and the pos/neg legend split are selected by data-ts-key.
const CANDLE_RECTS = ["wick", "wick-lo", "body", "body-lo"].map((id) => `g[data-ts-key="${id}"]>rect`).join(",");
const hostSel = '[data-bkm-chart="candlestick"]';
const on = (state: string, tail = ""): string => CANDLE_RECTS.split(",").map((r) => `${hostSel}${state} ${r}${tail}`).join(",");
// Typed attr() is Chromium-only (133+): under `@supports` (unguarded, the var() keeps it past parsing and it is invalid at
// computed time, i.e. `opacity:1`), other browsers hover without the dim.
const HOVER_DIM_CSS = typedAttr(`${on("[data-bkm-ready][data-bkm-hover]")}{opacity:clamp(var(--bkm-faded),calc((1.5 - abs(attr(x type(<number>)) + attr(width type(<number>)) / 2 - var(--bkm-hx))) * 1000),1)}`);
// bklit `canInteract = isLoaded`: hover is inert until the reveal timer fires (host `data-bkm-ready`).
export const CANDLE_HOVER_CSS = [
  readyGateCss(hostSel),
  `${on("", NOT_MOTION)}{transition:opacity .15s ease-in-out}`,
  HOVER_DIM_CSS,
  `${on('[data-bkm-ready][data-bkm-legend="0"]', '[data-ts-key*=":neg:"]')},${on('[data-bkm-ready][data-bkm-legend="1"]', '[data-ts-key*=":pos:"]')}{opacity:var(--bkm-faded)}`,
  `${on('[data-bkm-ready][data-bkm-legend="0"]', ':not([data-ts-key*=":neg:"])')},${on('[data-bkm-ready][data-bkm-legend="1"]', ':not([data-ts-key*=":pos:"])')}{opacity:1}`,
].join("");
