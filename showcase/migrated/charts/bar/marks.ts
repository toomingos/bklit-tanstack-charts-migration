// Bar-family marks that have no native equivalent (squares, depth, pulse).
import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMotionContext, ChartPoint, ResolvedScale, SceneNode } from "@tanstack/charts";
import { propsFor } from "../kit/read-children";
import { guideMark } from "../kit/cartesian/date-pill";
import { computeSquareColumn } from "./geometry";
import type { BarColumnTrackProps } from "./carriers";
import type { ChildTable } from "../kit/read-children";
import { REVEAL_EASING } from "../kit/motion/easing";
import { enterOrResume } from "./enter-timing";
import type { EnterTiming } from "./enter-timing";
import { barIndexClass } from "./hover";
import type { HoverTarget } from "./hover";
import type { BarDatum, BarSeries } from "./model";

export interface ExtraMarkInput {
  readonly datums: readonly BarDatum[];
  readonly series: readonly BarSeries[];
  readonly table: ChildTable;
  readonly categories: readonly string[];
  readonly animationDuration: number;
  readonly faded: number;
  readonly uid: string;
  /** First paint of an entrance: square columns render collapsed so the next build tweens them in (D714). */
  readonly seed: boolean;
  /** Entrance clock shared across builds (the seed build and the one after it): later updates resume it, then snap. */
  readonly clock: { at: number | null };
}

/** Documented node `className` (reference/runtime-and-scene.md "Scene nodes") the hover CSS selects, instead of the key encoding. */
const columnClass = (kind: "squares" | "track", seriesIndex: number): string => `bkm-b${kind}-s${seriesIndex}`;

const SQUARE_GAP = 3;
const SQUARE_RADIUS = 0.25;

type Scales = Readonly<Record<string, ResolvedScale>>;

/** A chart scale by channel name; typed optional because a chart without that channel has no scale. */
export const scaleAt = (scales: Scales, key: string): ResolvedScale | undefined => scales[key];

/** Linear blend across gradient stops, expressed with CSS `color-mix` so `var(--chart-*)` colours stay themeable. */
function stopColor(stops: readonly { offset: number; color: string }[], t: number): string {
  if (stops.length === 0) { return "currentColor"; }
  // bklit emits `offset={`${offset}%`}`: offsets are PERCENTAGES (0..100), so a 0..1 pair is ~flat (0% / 1%).
  const scale = 100;
  const pos = Math.min(1, Math.max(0, t));
  let prev = stops[0];
  if (pos <= prev.offset / scale) { return prev.color; }
  for (const next of stops.slice(1)) {
    if (pos <= next.offset / scale) {
      const span = (next.offset - prev.offset) / scale || 1;
      const u = (pos - prev.offset / scale) / span;
      return `color-mix(in srgb, ${prev.color} ${((1 - u) * 100).toFixed(1)}%, ${next.color})`;
    }
    prev = next;
  }
  return prev.color;
}

interface ColumnInput {
  readonly id: string;
  readonly datums: readonly BarDatum[];
  readonly slot: number;
  readonly slots: number;
  readonly groupGap: number;
  readonly kind: "squares" | "track";
  readonly squareGap: number;
  readonly squareRadius: number;
  readonly squareFit: boolean;
  readonly fill: string;
  readonly opacity: number;
  readonly stops?: readonly { offset: number; color: string }[];
  readonly animationDuration: number;
  readonly staggerMs: number;
  readonly seed: boolean;
  readonly clock: { at: number | null };
  readonly uid: string;
}

interface ColumnFrame {
  readonly pointKey: string;
  readonly className: string;
  readonly x: number;
  readonly size: number;
  readonly radius: number;
  readonly columnTop: number;
  readonly baseline: number;
}

function trackNode(input: ColumnInput, f: ColumnFrame, seedTop: number): SceneNode {
  const height = Math.max(0, f.columnTop - seedTop);
  // Seed: bklit starts the track as a full-height column (y 0 .. baseline) that shrinks to its remainder.
  return {
    kind: "rect",
    key: `${f.pointKey}:sq0`,
    className: f.className,
    x: f.x,
    y: input.seed ? seedTop : f.columnTop - height,
    width: f.size,
    height: input.seed ? f.baseline - seedTop : height,
    radius: f.radius,
    ariaHidden: true,
    style: { fill: input.fill, opacity: input.opacity },
  };
}

function squareNodes(input: ColumnInput, f: ColumnFrame, col: ReturnType<typeof computeSquareColumn>): SceneNode[] {
  return col.positions.map((rel, i): SceneNode => {
    const centreT = col.columnHeight > 0 ? (col.columnHeight - (rel + f.size / 2)) / col.columnHeight : 0;
    // Seed: each square starts as a zero-height sliver on its own bottom edge (bklit grows it in place).
    const squareY = f.columnTop + rel;
    return {
      kind: "rect",
      key: `${f.pointKey}:sq${i}`,
      className: f.className,
      x: f.x,
      y: input.seed ? squareY + f.size : squareY,
      width: f.size,
      height: input.seed ? 0 : f.size,
      radius: f.radius,
      style: { fill: input.stops ? stopColor(input.stops, centreT) : input.fill, opacity: 1 },
    };
  });
}

function columnTiming(input: ColumnInput, counts: ReadonlyMap<string, number>, ctx: ChartMotionContext<BarDatum>): EnterTiming {
  const { id, kind } = input;
  const total = input.animationDuration;
  const cat = Math.max(0, ctx.datumIndex);
  const sqIndex = Number(/:sq(\d+)$/u.exec(ctx.key)?.[1] ?? 0);
  const count = counts.get(ctx.key.slice(id.length + 1).replace(/:sq\d+$/u, "")) ?? 1;
  const cascade = kind === "squares" && count > 1 ? (total * 0.4) / (count - 1) : 0;
  // bklit runs every square on the full enter tween (delay = column stagger + square cascade); the track
  // shrinks from the full plot height over that tween plus the column's whole cascade.
  const trackSpan = count > 1 ? total * 1.4 : total;
  const plan = { delay: cat * input.staggerMs + sqIndex * cascade, duration: kind === "squares" ? total : trackSpan, easing: REVEAL_EASING };
  // Seeded squares are collapsed nodes, so the entrance arrives as the first UPDATE. A render forced mid-entrance
  // (web-font swap) re-enters here as another update: resume the schedule instead of restarting it; false once it is over.
  return enterOrResume(input.clock, ctx.phase, plan);
}

/** One column of stacked squares per category (kind "squares") or the empty remainder above it (kind "track"), as plain rect nodes keyed under a point key. */
function columnMark(input: ColumnInput): ChartMark<BarDatum, string, number> {
  const { id, datums, slot, slots, groupGap, kind } = input;
  const counts = new Map<string, number>();
  const gapPx = slots > 1 ? groupGap : 0;
  // The schedule must outlive the mark thunk (re-run per render) and the build (seed, then full): clock lives in the input.
  return createMark<BarDatum, string, number>(() => ({
    id,
    channels: {
      x: { scale: "x", values: datums.map((d) => d.category) },
      y: { scale: "y", includeZero: true, values: datums.map((d) => d.value) },
    },
    motion: (ctx: ChartMotionContext<BarDatum>): EnterTiming => columnTiming(input, counts, ctx),
    render: ({ scales, color }) => {
      const sx = scaleAt(scales, "x");
      const sy = scaleAt(scales, "y");
      const nodes: SceneNode[] = [];
      const points: ChartPoint<BarDatum, string, number>[] = [];
      if (sx === undefined || sy === undefined) {
        return { nodes, points };
      }
      const bw = sx.bandwidth || 0;
      const size = Math.max(0, (bw - gapPx * (slots - 1)) / slots);
      const radius = size * input.squareRadius;
      const baseline = sy.map(0);
      for (const [index, d] of datums.entries()) {
        const centre = sx.map(d.category);
        const top = sy.map(d.value);
        if (Number.isFinite(centre) && Number.isFinite(top) && d.value > 0) {
          const x = centre - bw / 2 + slot * (size + gapPx);
          const col = computeSquareColumn(baseline - top, size, input.squareGap, input.squareFit);
          const columnTop = baseline - col.columnHeight;
          const pointKey = `${id}:${d.index}`;
          const className = `${columnClass(kind, slot)} ${barIndexClass(d.index)}`;
          counts.set(String(d.index), col.count);
          points.push({
            key: pointKey,
            markId: id,
            group: d.series,
            groupLabel: d.series,
            datum: d,
            datumIndex: index,
            xValue: d.category,
            yValue: d.value,
            x: x + size / 2,
            y: columnTop,
            color: color(d.series),
          });
          const frame: ColumnFrame = { pointKey, className, x, size, radius, columnTop, baseline };
          nodes.push(...(kind === "track" ? [trackNode(input, frame, sy.map(sy.domain[1]))] : squareNodes(input, frame, col)));
        }
      }
      return { nodes, points };
    },
  }));
}

export interface ExtraMarks {
  readonly marks: ChartMark<BarDatum, string, number>[];
  readonly hover: HoverTarget[];
}

export function buildExtraMarks(input: ExtraMarkInput): ExtraMarks {
  const { series, datums, table, animationDuration } = input;
  const squares = series.flatMap((s) => (s.kind === "squares" && s.squares ? [{ series: s, props: s.squares }] : []));
  const out: ChartMark<BarDatum, string, number>[] = [];
  if (squares.length === 0) {
    return { marks: out, hover: [] };
  }
  const staggerMs = (animationDuration * 0.4) / Math.max(1, input.categories.length);
  const track = propsFor<BarColumnTrackProps>(table, "barColumnTrack").at(0);
  const slots = series.length;
  const hover: HoverTarget[] = [];
  const common = { uid: input.uid, seed: input.seed, clock: input.clock, animationDuration, staggerMs };
  if (track !== undefined) {
    for (const { series: s } of squares) {
      // bklit hides the empty track on any hover.
      hover.push({ select: `.${columnClass("track", s.index)}`, keep: null, dim: 0, snap: true });
      out.push(
        columnMark({
          ...common,
          id: `track:${s.key}`,
          datums: datums.filter((d) => d.series === s.key),
          slot: s.index,
          slots,
          groupGap: track.groupGap ?? 4,
          kind: "track",
          squareGap: track.squareGap ?? SQUARE_GAP,
          squareRadius: track.squareRadius ?? SQUARE_RADIUS,
          squareFit: track.squareFit ?? false,
          fill: track.fill ?? "var(--chart-grid)",
          opacity: track.opacity ?? 0.3,
        }),
      );
    }
  }
  for (const { series: s, props } of squares) {
    hover.push({
      select: `.${columnClass("squares", s.index)}`,
      keep: (index) => `.${barIndexClass(index)}`,
      dim: props.fadedOpacity ?? input.faded,
      easing: "ease-out",
      seriesIndex: s.index,
    });
    const stops = props.useGradient === true && (props.gradientStops?.length ?? 0) >= 2 ? props.gradientStops : undefined;
    out.push(
      columnMark({
        ...common,
        id: `squares:${s.key}`,
        datums: datums.filter((d) => d.series === s.key),
        slot: s.index,
        slots,
        groupGap: props.groupGap ?? 4,
        kind: "squares",
        squareGap: props.squareGap ?? SQUARE_GAP,
        squareRadius: props.squareRadius ?? SQUARE_RADIUS,
        squareFit: props.squareFit ?? false,
        fill: s.fill,
        opacity: 1,
        stops,
      }),
    );
  }
  return { marks: out, hover };
}

/** bklit's category band centre (the x of the rule, dots and date pill) for a focused category, from the chart scales. */
export function bandCentre(scales: Scales, horizontal = false): ((category: unknown) => number) | undefined {
  const band = scaleAt(scales, horizontal ? "y" : "x");
  return band === undefined ? undefined : (category) => band.map(category);
}

/** Where bklit's horizontal-bar crosshair sits for a category: the end of the longest bar (cumulative end when stacked), the `centre` of a `by: "y"` guide. */
export function barEndCentre(datums: readonly BarDatum[], stacked: boolean): (scales: Scales) => ((category: unknown) => number) | undefined {
  const byCategory = new Map<string, number[]>();
  for (const d of datums) {
    if (Number.isFinite(d.value)) {
      const list = byCategory.get(d.category);
      if (list) {
        list.push(d.value);
      } else {
        byCategory.set(d.category, [d.value]);
      }
    }
  }
  return (scales) => {
    const sx = scaleAt(scales, "x");
    if (sx === undefined) {
      return undefined;
    }
    return (category) => {
      const values = byCategory.get(String(category));
      if (!values) {
        return Number.NaN;
      }
      const ends = stacked ? [values.reduce((a, b) => a + b, 0)] : values;
      return Math.max(...ends.map((v) => sx.map(v)));
    };
  };
}

interface DotCross {
  readonly d: BarDatum;
  readonly i: number;
  readonly bandwidth: number;
  readonly slot: number;
  readonly gapPx: number;
  readonly seriesCount: number;
  readonly stacked: boolean;
  readonly square: { readonly groupGap: number } | undefined;
}

/** Offset of a bar's dot from the band centre: stacked bars sit on it, square columns use their own slot width. */
function dotCross({ d, i, bandwidth, slot, gapPx, seriesCount, stacked, square }: DotCross): number {
  if (square && d.value > 0) {
    const sqGap = seriesCount > 1 ? square.groupGap : 0;
    const size = Math.max(0, (bandwidth - sqGap * (seriesCount - 1)) / seriesCount);
    return -bandwidth / 2 + i * (size + sqGap) + size / 2;
  }
  return stacked ? 0 : -bandwidth / 2 + i * (slot + gapPx) + slot / 2;
}

/** bklit TooltipDot variant "ring": a transparent rounded square around the bar end (tooltip-dot.tsx:30-35, 132-148; chart-tooltip.tsx:145-160). */
export interface RingDots {
  readonly fraction: number;
  readonly scale: number;
  readonly size: number;
  /** Gap between square slots: the squareSnap group gap, else 4 for several series. */
  readonly slotGap: number;
  readonly strokeWidth: number;
  readonly color?: string;
}

function ringHalfExtent(ring: RingDots, bandwidth: number, count: number): number {
  if (bandwidth <= 0) {
    return ring.size * ring.scale;
  }
  return (Math.max(0, (bandwidth - ring.slotGap * (count - 1)) / count) / 2) * ring.scale;
}

function ringNode({ key, ring, half, cross, end, color }: { key: string; ring: RingDots; half: number; cross: number; end: number; color: string }): SceneNode {
  return {
    kind: "rect",
    key,
    x: cross - half,
    y: end - half,
    width: half * 2,
    height: half * 2,
    radius: half * 2 * Math.max(0, Math.min(0.5, ring.fraction)),
    ariaHidden: true,
    style: { fill: "transparent", stroke: color, strokeWidth: ring.strokeWidth },
  };
}

export interface HoverDotsOptions {
  readonly id: string;
  readonly datums: readonly BarDatum[];
  readonly series: readonly BarSeries[];
  readonly groupGap: number;
  readonly ring?: RingDots;
  readonly radius?: number;
  readonly motion?: unknown;
  readonly horizontal?: boolean;
  readonly stacked?: boolean;
  readonly stackGap?: number;
  /** Series drawn as stacked squares: dots sit on the column top, not the raw value. */
  readonly squares?: ReadonlyMap<string, { readonly gap: number; readonly fit: boolean; readonly groupGap: number }>;
}

/** Vertical-bar dots as a focus-guide-only mark (bklit's per-bar TooltipDot): resolved for the focused category only, so a hover reconciles just the guide fragment. */
export function barDotsGuide(options: Omit<HoverDotsOptions, "horizontal">): ChartMark<BarDatum, string, number> {
  const { id, datums, series, groupGap, radius = 5, squares, stacked = false, stackGap = 0, ring } = options;
  const slots = new Map(series.map((s, i) => [s.key, i] as const));
  const byCategory = new Map<string, BarDatum[]>();
  for (const d of datums) {
    const list = byCategory.get(d.category);
    if (list) {
      list.push(d);
    } else {
      byCategory.set(d.category, [d]);
    }
  }
  return guideMark({
    id,
    motion: options.motion,
    centre: (scales: Scales) => bandCentre(scales),
    node: (x, _chart, category, scales: Scales) => {
      const list = byCategory.get(String(category));
      const sx = scaleAt(scales, "x");
      const sy = scaleAt(scales, "y");
      if (!list || sx === undefined || sy === undefined) {
        return undefined;
      }
      const bandwidth = sx.bandwidth || 0;
      const count = Math.max(1, series.length);
      const gapPx = count > 1 ? groupGap : 0;
      const slot = Math.max(0, (bandwidth - gapPx * (count - 1)) / count);
      const half = ring ? ringHalfExtent(ring, bandwidth, count) : 0;
      let cumulative = 0;
      let seen = 0;
      const children: unknown[] = [];
      for (const d of list) {
        const i = slots.get(d.series) ?? 0;
        let { value } = d;
        let along = 0;
        if (stacked) {
          cumulative += Number.isFinite(d.value) ? d.value : 0;
          value = cumulative;
          along = seen * stackGap * -1;
          seen += 1;
        }
        const end = sy.map(value) + along;
        if (Number.isFinite(end)) {
          const cross = dotCross({ d, i, bandwidth, slot, gapPx, seriesCount: series.length, stacked, square: squares?.get(d.series) });
          const fill = series[i]?.fill ?? "currentColor";
          const key = `${id}:${d.series}:dot`;
          children.push(ring ? ringNode({ key, ring, half, cross, end, color: ring.color ?? fill }) : { kind: "dot" as const, key, x: cross, y: end, radius, ariaHidden: true, style: { fill, stroke: "var(--chart-background)", strokeWidth: 2 } });
        }
      }
      // gap #36: our own guide group borrows core's fixed crosshair class; guide nodes have no documented className.
      return { kind: "group" as const, key: id, className: "ts-chart__crosshair", ariaHidden: true, translateX: x, children };
    },
  });
}
