// Native TanStack definition for bklit's ScatterChart: each <Scatter> is a disc `dot` plus ring/outline dots (not `decorative()`, which drops the per-datum enter delay).
// Hover emphasis is fixed CSS (`SCATTER_HOVER_CSS`; native `states` would re-render the scene per move); entrance delay follows x (bklit's clip-reveal stagger).
import { defineChart, dot } from "@tanstack/charts";
import type { ChartDefinition, ChartGradient, ChartMark, ChartMotionTiming } from "@tanstack/charts";
import { crosshair } from "@tanstack/charts/crosshair";
import { focusGroupX } from "@tanstack/charts/focus";
import { bklitTooltip } from "../kit/tooltip/bklit-tooltip";
import { tooltipBoxMotion } from "../kit/tooltip/box-motion";
import type { TooltipBoxMotionProps } from "../kit/tooltip/box-motion";
import { scaleLinear, scaleTime, scaleUtc } from "../kit/scales";
import { shortDateFmt } from "../kit/format";
import { erase } from "../kit/erased-types";
import { niced } from "../kit/cartesian/definition";
import { propsFor } from "../kit/read-children";
import { userGradients } from "../kit/gradients";
import type { ChildTable } from "../kit/read-children";
import { toDate } from "../kit/cartesian/series";
import type { Row } from "../kit/cartesian/series";
import { dataTickValues } from "../kit/cartesian/x-axis";
import { formatTick } from "../kit/cartesian/y-axis";
import { resumeEnter } from "../kit/motion/resume-enter";
import { revealEndFromEnter } from "../kit/size/parent-size-arm";
import type { RevealClock } from "../kit/size/parent-size-arm";
import type { EnterPlan } from "../kit/motion/resume-enter";
import { gridColumnGuides, gridHostAttrs, gridLineStyle, gridRowGuides } from "../kit/cartesian/grid-guides";
import type { GridGuideProps as GridProps } from "../kit/cartesian/grid-guides";
import { bklitTheme, BKLIT_TOOLTIP_PLACEMENT, X_TICK_PADDING } from "../kit/theme";
import { BKLIT_GUIDE_SPRING, crosshairGradient, crosshairRuleMark, datePillGuides, dotGuideMark, pillLayout, pillGuideMotion, withPillGeometry } from "../kit/cartesian/date-pill";
import type { PillLayout } from "../kit/cartesian/date-pill";
import type { ChartMargin } from "../kit/theme";
import { CHART_PALETTE } from "../kit/palette";
import { readyGateCss } from "../kit/cartesian/gate-css";
import { typedAttr } from "../kit/css-hooks";
import { CLS, keyStarts } from "../kit/renderer-dom";

interface ScatterProps {
  dataKey: string;
  yAxisId?: string | number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  ringGap?: number;
  outlineWidth?: number;
  outlineColor?: string;
  radius?: number;
  animate?: boolean;
  fadeOnHover?: boolean;
  inactiveOpacity?: number;
  inactiveBlur?: number;
  enterBlur?: number;
  showActiveHighlight?: boolean;
  yGradient?: boolean | { from?: string; to?: string };
}

interface XAxisProps {
  numTicks?: number;
  tickMode?: "domain" | "data";
  formatValue?: (value: Date) => string;
}
interface YAxisProps {
  yAxisId?: string | number;
  orientation?: "left" | "right";
  numTicks?: number;
  formatLargeNumbers?: boolean;
  formatValue?: (value: number) => string;
}
interface TooltipProps extends TooltipBoxMotionProps {
  showDatePill?: boolean;
  showCrosshair?: boolean;
  showDots?: boolean;
  dotSize?: number;
  dotColor?: string | ((point: Row, line: unknown) => string);
  indicatorColor?: string | ((point: Row) => string);
  indicatorDasharray?: string;
}

interface ScatterSeries {
  readonly dataKey: string;
  readonly yAxisId: string;
  readonly fill: string;
  readonly stroke: string;
  readonly radius: number;
  readonly ringWidth: number;
  readonly ringGap: number;
  readonly outlineWidth: number;
  readonly outlineColor: string;
  readonly animate: boolean;
  readonly dim: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveBlur: number;
  readonly enterBlur: number;
  readonly activeScale: number;
  /** bklit's series colour for tooltip dots and rows: `fill || stroke || palette` (ignores yGradient). */
  readonly tooltipColor: string;
}

export interface ScatterInput {
  readonly data: readonly Row[];
  readonly xKey: string;
  readonly table: ChildTable;
  readonly margin: ChartMargin;
  readonly uid: string;
  /** The chart's idPrefix (RendererChart prop): scopes the crosshair gradient reference, which guide nodes do not get resolved. */
  readonly idPrefix: string;
  readonly animationDuration: number;
  readonly easing: (t: number) => number;
  /** false = first pass: grid + axes only, so the dots enter as new data with their per-datum delay. */
  readonly revealed: boolean;
  /** bklit's reveal timer clock: the swap to static dots lands `animationDuration` after the chart's mount effect. */
  readonly revealClock?: RevealClock;
  /** Receives the size TanStack measured, from the `chart` callback inside its draw. */
  readonly sizeStore: SizeStore;
}

export interface SizeStore {
  readonly get: () => { readonly width: number; readonly height: number };
  readonly subscribe: (cb: () => void) => () => void;
  readonly set: (width: number, height: number) => void;
}

/** The plot size as TanStack measured it: written in its draw, read by hover and by <FocusLayer> only (no React state on the path to the first draw). */
export function createSizeStore(): SizeStore {
  let size = { width: 0, height: 0 };
  const listeners = new Set<() => void>();
  return {
    get: () => size,
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    set: (width, height) => {
      if (width === size.width && height === size.height) {
        return;
      }
      size = { width, height };
      listeners.forEach((l) => { l(); });
    },
  };
}

const GRADIENT_TO = "var(--color-emerald-500)";
// bklit series-markers `enterDuration` (0.5s per dot).
const ENTER_MS = 500;
const DEFAULT_Y_AXIS = "left";

// Kept apart from kit toNumber: a string or null y cell is NaN here (a gap), but 5 / 0 there.
const toNumber = (value: unknown): number => (Number.isFinite(value) ? Number(value) : Number.NaN);
const axisId = (value: string | number | undefined): string => (value === undefined ? DEFAULT_Y_AXIS : String(value));

const gradientEnd = (gradient: ScatterProps["yGradient"]): string | null => {
  if (gradient === undefined || gradient === false) {
    return null;
  }
  return gradient === true ? GRADIENT_TO : (gradient.to ?? GRADIENT_TO);
};
// bklit's `a || b` on colour strings: an empty string falls through.
const firstNonEmpty = (...values: readonly (string | undefined)[]): string | undefined => values.find((v) => v !== undefined && v !== "");

function resolveScatterSeries(table: ChildTable): ScatterSeries[] {
  return propsFor<ScatterProps>(table, "scatter").map((p, index) => {
    // bklit paints the dot with a userSpaceOnUse gradient (y1 = innerHeight, y2 = 0) inside the dot's own translate(cx, cy),
    // so every dot samples the gradient at local y of about 0: the `to` stop (measured: all dots `to`, no per-height colour).
    const gradientTo = gradientEnd(p.yGradient);
    const palette = CHART_PALETTE[index % CHART_PALETTE.length];
    const tooltipColor = firstNonEmpty(p.fill, p.stroke) ?? palette;
    const fill = gradientTo ?? p.fill ?? p.stroke ?? palette;
    const stroke = p.stroke ?? fill;
    const ringWidth = p.strokeWidth ?? 2;
    return {
      dataKey: p.dataKey,
      yAxisId: axisId(p.yAxisId),
      fill,
      stroke,
      radius: p.radius ?? 5,
      ringWidth,
      ringGap: p.ringGap ?? 2,
      outlineWidth: p.outlineWidth ?? 0,
      outlineColor: p.outlineColor ?? stroke,
      animate: p.animate ?? true,
      dim: p.fadeOnHover ?? true,
      inactiveOpacity: p.inactiveOpacity ?? 0.5,
      inactiveBlur: p.inactiveBlur ?? 2,
      enterBlur: p.enterBlur ?? 2,
      activeScale: (p.showActiveHighlight ?? true) ? 1.35 : 1,
      tooltipColor,
    };
  });
}

/** bklit's scatter y domain: [0, max * 1.1] (100 when there is no positive value), visx-nice'd. */
function yDomain(values: readonly number[]): [number, number] {
  let max = 0;
  for (const v of values) {
    if (Number.isFinite(v) && v > max) {
      max = v;
    }
  }
  return niced([0, max <= 0 ? 100 : max * 1.1]);
}

type ScatterMark = ChartMark<Row, Date, number, Date, number, string, string>;
interface PillTickInfo {
  times: number[];
  spanMs: number;
  plotWidth: number;
  reachPx: number;
}
interface YScaleOption {
  yScale?: string;
}
interface YScaleConfig {
  scale: ReturnType<typeof scaleLinear>;
  grid: ReturnType<typeof gridLineStyle> | false;
  axis: unknown;
  channel?: "y";
  side?: "left" | "right";
}
interface TooltipMarkSet {
  marks: ScatterMark[];
  gradients: ChartGradient[];
}
interface ScatterChartConfig {
  marks: ScatterMark[];
  scales: Record<string, unknown>;
  margin: ChartMargin;
  theme: typeof bklitTheme;
  gradients: ChartGradient[];
  color?: { domain: string[]; range: string[] };
}
/** Mutable entrance state shared by the dot marks and the `chart` callback that measures the plot. */
interface ScatterLive {
  /** Plot inner width, written by the `chart` callback (which runs before the scene's motion is resolved) for the enter delay. */
  innerWidth: number;
  innerHeight: number;
  /** Clock of the first dot entrance (see `enterMotion`). */
  enterAt: number | null;
}

/** The mark option that targets a secondary y axis; the default axis takes none (not kit/cartesian/y-axis.ts yScaleOption, which builds the scale itself). */
function yScaleOption(yAxisId: string): YScaleOption {
  return yAxisId === DEFAULT_Y_AXIS ? {} : { yScale: `y:${yAxisId}` };
}

const colorOr = (value: unknown, fallback: string): string => (typeof value === "string" ? value : fallback);

function resolveYScales(
  yDomains: ReadonlyMap<string, [number, number]>,
  yAxes: readonly YAxisProps[],
  grid: GridProps | undefined,
  rowGuides: ReturnType<typeof gridRowGuides>,
): Map<string, YScaleConfig> {
  const yScales = new Map<string, YScaleConfig>();
  for (const [id, domain] of yDomains) {
    const config = yAxes.find((a) => axisId(a.yAxisId) === id);
    const isPrimary = id === DEFAULT_Y_AXIS;
    const ticks = { count: isPrimary ? rowGuides.count : (config?.numTicks ?? 5) };
    const large = config?.formatLargeNumbers !== false;
    const resolved: YScaleConfig = {
      scale: scaleLinear().domain(domain),
      grid: isPrimary && rowGuides.native && grid !== undefined ? gridLineStyle(grid) : false,
      axis: config
        ? {
            line: false,
            ticks: { ...ticks, size: 0, format: (v: number) => (config.formatValue ? config.formatValue(v) : formatTick(v, large)) },
            // bklit y-axis.tsx:106-142 draws every scale tick, no collision test.
            tickLabels: { fontSize: 12, opacity: 1, thin: false },
          }
        : { line: false, ticks: { ...ticks, size: 0 }, tickLabels: false },
    };
    if (!isPrimary) {
      resolved.channel = "y";
    }
    const side = isPrimary ? config?.orientation : (config?.orientation ?? "right");
    if (side !== undefined) {
      resolved.side = side;
    }
    yScales.set(isPrimary ? "y" : `y:${id}`, resolved);
  }
  return yScales;
}

interface TooltipMarksInput {
  readonly tooltipProps: TooltipProps;
  readonly series: readonly ScatterSeries[];
  readonly data: readonly Row[];
  readonly xOf: (d: Row) => Date;
  readonly margin: ChartMargin;
  readonly idPrefix: string;
  readonly pill: PillLayout | null;
}

/** Focus guides drawn over the dots: date pill, crosshair rule, active highlight copies and tooltip dots, plus the crosshair gradient. */
function tooltipMarks({ tooltipProps, series, data, xOf, margin, idPrefix, pill }: TooltipMarksInput): TooltipMarkSet {
  const marks: ScatterMark[] = [];
  const gradients: ChartGradient[] = [];
  const showCrosshair = tooltipProps.showCrosshair !== false;
  const showPill = tooltipProps.showDatePill !== false;
  const head = series.at(0);
  const rowAtTime = new Map<number, Row>(data.map((row) => [xOf(row).getTime(), row]));
  const valueAt = (xValue: unknown, dataKey: string): number | undefined => {
    const row = rowAtTime.get(xValue instanceof Date ? xValue.getTime() : Number(xValue));
    return row ? toNumber(row[dataKey]) : undefined;
  };
  // bklit's active highlight: the focused point's markers redrawn on top at activeScale (the dimmed layer keeps its own copy
  // beneath, like bklit). Native focus marks, so the focus retarget moves them with no per-dot DOM work; they snap, no tween.
  const activeDots: ScatterMark[] = [];
  for (const s of series.filter((candidate) => candidate.dim && candidate.activeScale > 1)) {
    const k = s.activeScale;
    const ringOuter = s.ringWidth > 0 ? s.radius + s.ringGap + s.ringWidth : s.radius;
    const active = (id: string, marker: { radius: number; fill: string; stroke: string; strokeWidth: number }): void => {
      activeDots.push(
        dotGuideMark({
          id: `${s.dataKey}:active:${id}`,
          ...yScaleOption(s.yAxisId),
          motion: false,
          valueAt: (xValue) => valueAt(xValue, s.dataKey),
          marker,
        }),
      );
    };
    if (s.outlineWidth > 0) {
      active("outline", { radius: (ringOuter + s.outlineWidth / 2) * k, fill: "none", stroke: s.outlineColor, strokeWidth: s.outlineWidth * k });
    }
    active("disc", { radius: s.radius * k, fill: s.fill, stroke: "none", strokeWidth: 0 });
    if (s.ringWidth > 0) {
      active("ring", { radius: (s.radius + s.ringGap + s.ringWidth / 2) * k, fill: "none", stroke: s.stroke, strokeWidth: s.ringWidth * k });
    }
  }

  // bklit TooltipDot per series: r = dotSize (5), 2px background stroke, springing to the hovered point.
  // Painted after the crosshair (bklit draws the dots over the rule).
  const tooltipDots: ScatterMark[] = [];
  if (tooltipProps.showDots !== false) {
    for (const s of series) {
      const dotMotion = erase(pillGuideMotion(BKLIT_GUIDE_SPRING));
      tooltipDots.push(
        dotGuideMark({
          id: `${s.dataKey}:tooltip-dot`,
          ...yScaleOption(s.yAxisId),
          motion: dotMotion,
          valueAt: (xValue) => valueAt(xValue, s.dataKey),
          marker: {
            radius: tooltipProps.dotSize ?? 5,
            fill: colorOr(tooltipProps.dotColor, s.tooltipColor),
            stroke: "var(--chart-background)",
            strokeWidth: 2,
          },
        }),
      );
    }
  }
  if (head && showPill) {
    const pillMotion = erase(pillGuideMotion(BKLIT_GUIDE_SPRING));
    marks.push(
      ...datePillGuides({
        rows: data,
        x: xOf,
        y: (d: Row) => toNumber(d[head.dataKey]),
        key: (d: Row) => xOf(d).getTime(),
        ...yScaleOption(head.yAxisId),
        // bklit pins the pill 4px above the container bottom, as the shared cartesian kit does.
        offset: margin.bottom - 19.8,
        motion: pillMotion,
      }, pill),
    );
  }
  if (head && showCrosshair) {
    const indicatorColor = colorOr(tooltipProps.indicatorColor, "var(--chart-crosshair)");
    const dasharray = tooltipProps.indicatorDasharray;
    if (dasharray !== undefined && dasharray !== "") {
      const ruleMotion = erase(pillGuideMotion(BKLIT_GUIDE_SPRING));
      marks.push(
        crosshair({
          id: "crosshair",
          x: { stroke: indicatorColor, strokeOpacity: 1, strokeWidth: 1, strokeDasharray: dasharray.replace(",", " "), label: false },
          y: false,
          motion: ruleMotion,
        }),
      );
    } else {
      gradients.push(crosshairGradient("crosshair", indicatorColor));
      marks.push(crosshairRuleMark({ id: "crosshair", paint: `url(#${idPrefix}-crosshair)`, width: 1, motion: pillGuideMotion(BKLIT_GUIDE_SPRING) }));
    }
  }
  marks.push(...activeDots, ...tooltipDots);
  return { marks, gradients };
}

interface SeriesMarksInput {
  readonly input: ScatterInput;
  readonly data: readonly Row[];
  readonly xOf: (d: Row) => Date;
  readonly minT: number;
  readonly span: number;
  readonly xPad: number;
  readonly live: ScatterLive;
  readonly colorDomain: string[];
  readonly colorRange: string[];
}

/** The dot marks of one series (outline ring, disc + ring, or separate ring) with their per-datum entrance. */
function seriesMarks(s: ScatterSeries, deps: SeriesMarksInput): ScatterMark[] {
  const { input, data, xOf, minT, span, xPad, live, colorDomain, colorRange } = deps;
  const { animationDuration, easing, revealed } = input;
  const marks: ScatterMark[] = [];
  const keyOf = (d: Row): string => `${s.dataKey}:${xOf(d).getTime()}`;
  const yOf = (d: Row): number => toNumber(d[s.dataKey]);
  const rows = revealed ? data.filter((d) => Number.isFinite(yOf(d))) : [];
  const visualExtent = s.radius + (s.ringWidth > 0 ? s.ringGap + s.ringWidth : 0) + Math.max(0, s.outlineWidth) + (s.activeScale > 1 ? s.radius * 0.35 : 0) + 2;
  // Entrance per bklit series-markers: delay (max(0, cx - visualExtent) / innerWidth) * revealDuration, cx inset by xPad.
  // At reveal end bklit swaps to static markers (a fading dot snaps visible): run `remain / ENTER_MS` of the curve, then land on 1.
  const planOf = (datum: Row): EnterPlan => {
    const cx = xPad + ((xOf(datum).getTime() - minT) / span) * (live.innerWidth - xPad * 2);
    const delay = live.innerWidth > 0 ? (Math.max(0, cx - visualExtent) / live.innerWidth) * animationDuration : 0;
    const endAt = revealEndFromEnter(input.revealClock ?? { mountedAt: null }, live.enterAt, animationDuration);
    const remain = endAt - delay;
    if (remain <= 1) {
      return { delay: endAt, duration: 1, easing };
    }
    return remain < ENTER_MS
      ? { delay, duration: remain, easing: (t) => (t >= 1 ? 1 : easing((t * remain) / ENTER_MS)) }
      : { delay, duration: ENTER_MS, easing };
  };
  // A render forced mid-entrance (web font swap after a hydrated mount, resize) re-runs the dots as an `update` and resumes the
  // same schedule; once the entrance is over an update is a data change and bklit snaps the dots.
  const enterMotion = s.animate
    ? (ctx: { phase: string; datum: Row }): ChartMotionTiming<Row> | false | undefined => {
        if (ctx.phase === "enter") {
          live.enterAt ??= performance.now();
          const plan = planOf(ctx.datum);
          return { delay: plan.delay, transition: { duration: plan.duration, easing: plan.easing, type: "tween" } };
        }
        return ctx.phase === "update" ? resumeEnter(planOf(ctx.datum), live.enterAt) : undefined;
      }
    : false;
  const pre = s.dim ? "" : "nodim:";
  const common = {
    ...yScaleOption(s.yAxisId),
    x: xOf,
    z: (): string => s.dataKey,
    motion: erase(enterMotion),
  };

  if (s.outlineWidth > 0) {
    const ringOuter = s.ringWidth > 0 ? s.radius + s.ringGap + s.ringWidth : s.radius;
    marks.push(
      dot(rows, {
        ...common,
        id: `${pre}${s.dataKey}:outline`,
        y: yOf,
        key: keyOf,
        r: ringOuter + s.outlineWidth / 2,
        fill: "none",
        stroke: s.outlineColor,
        strokeWidth: s.outlineWidth,
      }),
    );
  }

  if (s.ringWidth > 0 && s.stroke === s.fill) {
    // bklit dims a point's disc + ring as ONE group, so the pair rides one mark: two circles per datum told apart by a colour key
    // (series colour or "none"); the disc is inset by half the ring width and its stroke fills the rest, keeping its outer edge at `radius`.
    const discKey = `${s.dataKey}:disc`;
    const ringKey = `${s.dataKey}:ring`;
    colorDomain.push(discKey, ringKey);
    colorRange.push(s.fill, "none");
    marks.push(
      dot(
        rows.flatMap((d) => [d, d]),
        {
          ...common,
          id: `${pre}${s.dataKey}`,
          y: yOf,
          color: (_d: Row, { index }: { index: number }) => (index % 2 === 0 ? discKey : ringKey),
          key: (d: Row, { index }: { index: number }) => `${keyOf(d)}:${index % 2}`,
          r: (_d: Row, { index }: { index: number }) => (index % 2 === 0 ? s.radius - s.ringWidth / 2 : s.radius + s.ringGap + s.ringWidth / 2),
          stroke: s.stroke,
          strokeWidth: s.ringWidth,
        },
      ),
    );
  } else {
    marks.push(dot(rows, { ...common, id: `${pre}${s.dataKey}`, y: yOf, key: keyOf, r: s.radius, fill: s.fill }));
    if (s.ringWidth > 0) {
      marks.push(
        dot(rows, {
          ...common,
          id: `${pre}${s.dataKey}:ring`,
          y: yOf,
          key: keyOf,
          r: s.radius + s.ringGap + s.ringWidth / 2,
          fill: "none",
          stroke: s.stroke,
          strokeWidth: s.ringWidth,
        }),
      );
    }
  }
  return marks;
}

interface ScatterBuild {
  definition: ChartDefinition<Row, Date, number>;
  series: readonly ScatterSeries[];
  tooltipEnabled: boolean;
  /** Resolved plot domains: x depends on the measured width (px inset), y is per axis id. */
  domains: { x: (width: number) => [Date, Date]; y: Record<string, [number, number]> };
  /** Tick values (ms) and span (ms) at a measured width, for the date pill's scoped tick-blanking CSS. */
  pillTicks: (width: number) => PillTickInfo | null;
  /** Host attributes for the static grid edge-fade rules (styles.css). */
  gridAttrs: Record<string, string | undefined>;
}

export function buildScatterDefinition(input: ScatterInput): ScatterBuild {
  const { data, xKey, table, margin } = input;
  const series = resolveScatterSeries(table);
  const tooltipProps = propsFor<TooltipProps>(table, "tooltip").at(0);
  const tooltipEnabled = tooltipProps !== undefined;
  const grid = propsFor<GridProps>(table, "grid").at(0);
  const xAxis = propsFor<XAxisProps>(table, "xAxis").at(0);
  const yAxes = propsFor<YAxisProps>(table, "yAxis");

  const rowTimes = data.map((row) => toDate(row[xKey]).getTime());
  const minT = rowTimes.length > 0 ? Math.min(...rowTimes) : 0;
  const maxT = rowTimes.length > 0 ? Math.max(...rowTimes) : 1;
  const span = Math.max(1, maxT - minT);
  const xPad = (series.length > 0 ? Math.max(...series.map((s) => s.radius)) : 5) + 10;
  const live: ScatterLive = { innerWidth: 0, innerHeight: 0, enterAt: null };

  const valuesByAxis = new Map<string, number[]>();
  for (const s of series) {
    const list = valuesByAxis.get(s.yAxisId) ?? [];
    for (const row of data) {
      list.push(toNumber(row[s.dataKey]));
    }
    valuesByAxis.set(s.yAxisId, list);
  }
  if (!valuesByAxis.has(DEFAULT_Y_AXIS)) {
    valuesByAxis.set(DEFAULT_Y_AXIS, []);
  }
  const yDomains = new Map([...valuesByAxis].map(([id, values]) => [id, yDomain(values)] as const));

  const gradients: ChartGradient[] = userGradients(table);
  // bklit's Grid ticks are independent of the axis labels' and can drop edge lines: those rows are marks under the series.
  const primaryAxis = yAxes.find((a) => axisId(a.yAxisId) === DEFAULT_Y_AXIS);
  const rowGuides = gridRowGuides(grid, scaleLinear().domain(yDomains.get(DEFAULT_Y_AXIS) ?? [0, 100]), primaryAxis !== undefined, primaryAxis?.numTicks);
  const xOf = (d: Row): Date => toDate(d[xKey]);

  const colorDomain: string[] = [];
  const colorRange: string[] = [];
  const marks: ScatterMark[] = [...rowGuides.marks];
  for (const s of series) {
    marks.push(...seriesMarks(s, { input, data, xOf, minT, span, xPad, live, colorDomain, colorRange }));
  }

  const pill = tooltipProps === undefined || tooltipProps.showDatePill === false ? null : pillLayout(data.map((row) => shortDateFmt.format(toDate(row[xKey]))));
  const crosshairMarks: ScatterMark[] = [];
  if (tooltipProps !== undefined) {
    const tooltip = tooltipMarks({ tooltipProps, series, data, xOf, margin, idPrefix: input.idPrefix, pill });
    crosshairMarks.push(...tooltip.marks);
    gradients.push(...tooltip.gradients);
  }

  const yScales = resolveYScales(yDomains, yAxes, grid, rowGuides);

  const xTicks: { count: number } | { values: Date[] } = xAxis?.tickMode === "domain" ? { count: xAxis.numTicks ?? 5 } : { values: dataTickValues(data, xKey, xAxis?.numTicks ?? 5) };
  const baseFormatX = xAxis?.formatValue ?? ((d: Date): string => shortDateFmt.format(d));

  // bklit insets the x range by (radius + 10)px; widen the domain by the same pixel amount.
  const xDomainAt = (width: number): [Date, Date] => {
    const plot = Math.max(1, width - margin.left - margin.right - xPad * 2);
    // A single time has no extent: Date holds whole ms, so a sub-ms pad rounds away and the dot lands on the edge; 1ms either side centres it.
    if (maxT === minT) {
      return [new Date(minT - 1), new Date(maxT + 1)];
    }
    const padMs = (xPad * span) / plot;
    return [new Date(minT - padMs), new Date(maxT + padMs)];
  };
  const outsidePlot = (context: { x: number; y: number }): boolean => {
    const outsideX = context.x < margin.left || context.x > margin.left + live.innerWidth;
    const outsideY = context.y < margin.top || context.y > margin.top + live.innerHeight;
    return live.innerHeight > 0 && (outsideX || outsideY);
  };
  const boxMotion = tooltipBoxMotion(tooltipProps);
  const definition: ChartDefinition<Row, Date, number> = erase(defineChart(erase({
    chart: ({ width, height }: { width: number; height: number }): ScatterChartConfig => {
      input.sizeStore.set(Math.round(width), Math.round(height));
      live.innerWidth = Math.max(1, width - margin.left - margin.right);
      live.innerHeight = height - margin.top - margin.bottom;
      const xDomain = xDomainAt(width);
      const columnMarks = gridColumnGuides(grid, scaleTime().domain(xDomain));
      const xScale = {
        scale: scaleUtc().domain(xDomain),
        grid: false,
        // bklit x-axis.tsx:397-430 builds every tick with no collision test.
        axis: xAxis === undefined
          ? false
          : { line: false, ticks: { ...xTicks, size: 0, padding: X_TICK_PADDING, format: baseFormatX }, tickLabels: { fontSize: 12, opacity: 1, thin: false } },
      };
      const scaleEntries: [string, unknown][] = [["x", xScale], ...yScales];
      if (!yScales.has("y")) {
        scaleEntries.push(["y", { scale: scaleLinear().domain([0, 100]), axis: false }]);
      }
      const config: ScatterChartConfig = {
        marks: [...columnMarks, ...marks, ...crosshairMarks],
        scales: Object.fromEntries(scaleEntries),
        margin,
        theme: bklitTheme,
        gradients,
      };
      if (colorDomain.length > 0) {
        config.color = { domain: colorDomain, range: colorRange };
      }
      return config;
    },
    // group-x, but only inside the inner plot (bklit's inner-sized hit rect): no tooltip or pill over the margins and axes.
    focus: tooltipEnabled
      ? {
          ...focusGroupX,
          resolve: (points: Parameters<typeof focusGroupX.resolve>[0], context: { x: number; y: number; maxDistance: number }): ReturnType<typeof focusGroupX.resolve> =>
            outsidePlot(context) ? [] : focusGroupX.resolve(points, context),
        }
      : undefined,
    maxFocusDistance: Number.POSITIVE_INFINITY,
    focusRing: false,
    tooltip: tooltipEnabled
      ? { use: bklitTooltip, ...BKLIT_TOOLTIP_PLACEMENT, sticky: false, motion: boxMotion }
      : false,
  })));

  let pillCache: { width: number; info: PillTickInfo | null } | null = null;
  const pillTicks = (width: number): PillTickInfo | null => {
    if (pillCache?.width === width) {
      return pillCache.info;
    }
    const info = pillTicksAt(width);
    pillCache = { width, info };
    return info;
  };
  const pillTicksAt = (width: number): PillTickInfo | null => {
    if (!tooltipEnabled || tooltipProps.showDatePill === false || series.length === 0) {
      return null;
    }
    const domain = xDomainAt(width);
    const tickDates = "values" in xTicks ? xTicks.values : scaleUtc().domain(domain).ticks(xTicks.count);
    const times = withPillGeometry(tickDates.map((d) => d.getTime()), { plotLeft: margin.left, domainStart: domain[0].getTime(), pill });
    return { times, spanMs: domain[1].getTime() - domain[0].getTime(), plotWidth: Math.max(1, width - margin.left - margin.right), reachPx: 62 };
  };
  return { definition, series, tooltipEnabled, domains: { x: xDomainAt, y: Object.fromEntries(yDomains) }, pillTicks, gridAttrs: gridHostAttrs(grid) };
}

/** Hover emphasis (bklit `fadeOnHover` + `showActiveHighlight`) as FIXED rules: the host carries `data-bkm-hover` while a column is focused plus `--bkm-inactive` (opacity) and `--bkm-blur` (px);
 * every dot group dims + blurs as one layer (like bklit), the focused column's active copy is a native focus mark, and series with `fadeOnHover` off carry a `nodim:` mark id. */
const GROUPS = `[data-bkm-chart="scatter"] g${CLS.dot}:not(${keyStarts("nodim:")})`;
const HOVERING = '[data-bkm-chart="scatter"][data-bkm-ready][data-bkm-hover]';
export const SCATTER_HOVER_CSS = [
  // bklit's enter blur (`--bkm-enter-blur`, default 2px) follows the in-flight `opacity` attribute. Not in styles.css (the CSS pipeline drops `attr(type())`);
  // typed attr() is Chromium-only (133+), so under `@supports` other browsers enter without the blur.
  typedAttr(`[data-bkm-chart="scatter"] ${CLS.dot} circle[opacity]:not([opacity="1"]){filter:blur(calc((1 - attr(opacity type(<number>), 1)) * var(--bkm-enter-blur, 2) * 1px))}`),
  // Hover and keyboard focus are inert until the reveal timer fires (`data-bkm-ready`).
  readyGateCss('[data-bkm-chart="scatter"]'),
  // No transition on the dots (series-point-marker.tsx:95); the 150ms fade lives on the dim wrapper group (series-markers.tsx:240-251).
  // Dim layer: one opacity + blur per series' dot group while hovered, toggled on enter / leave only; the active copy is a focus mark.
  `${GROUPS}{transition:opacity .15s ease-in-out,filter .15s ease-in-out}`,
  `${HOVERING} g${CLS.dot}:not(${keyStarts("nodim:")}){opacity:var(--bkm-inactive);filter:blur(calc(var(--bkm-blur) * 1px))}`,
].join("");
