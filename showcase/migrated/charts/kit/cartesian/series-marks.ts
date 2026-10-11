// The line / area / pattern marks of the cartesian definition: fills, strokes (profit-loss, edge fade, dash split), loading
// overlay, point markers and the hover highlight, in bklit's paint order. Each concern appends to the shared BuildState.
import { dot } from "@tanstack/charts";
import type { areaY as areaYRaw, lineY as lineYRaw } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { isGradientRef } from "../gradients";
import { keyAttr, pushDecorative, yScaleOf } from "./build-state";
import type { AnyMark } from "./erased-types";
import type { BuildState } from "./build-state";
import { toNumber } from "./domains";
import { erase } from "./erased-types";
import type { CartesianInput } from "./input";
import type { AreaSeries, ResolvedSeries, Row } from "./series";

export const MARKER_BUCKETS = 12;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
// Pixel rise given to a flat line: path coordinates are serialised to 3 decimals, so this is the smallest non-zero bounding box.
const FLAT_LINE_RISE_PX = 0.002;

export interface SeriesContext {
  readonly input: CartesianInput;
  readonly rows: readonly Row[];
  /** The rows the point markers draw: `rows` clipped to the brushed window (paths draw past it, under the clip). */
  readonly markerRows: readonly Row[];
  /** Every row, only when `rows` is decimated: bklit hovers on every row (use-chart-interaction.ts:81, data = visiblePlotData), so a hidden full-row line takes the focus. */
  readonly focusRows?: readonly Row[];
  readonly yDomains: ReadonlyMap<string, readonly [number, number]>;
  readonly fadeDomain: [Date, Date] | undefined;
  readonly xAccessor: (d: Row) => Date;
  readonly keyOf: (d: Row) => number;
  readonly lineY: typeof lineYRaw;
  readonly areaY: typeof areaYRaw;
  readonly tooltipEnabled: boolean;
  readonly state: BuildState;
}

// bklit passes dimOpacity 0.3 from Line and 0.6 from Area (SeriesHoverDim default 0.5 is unused by either).
const dimOpacityOf = (s: ResolvedSeries): number => (s.kind === "area" ? 0.6 : 0.3);

/** styles.css masks `:fill:fade*` ids with bklit's 0/15/85/100% horizontal edge fade. */
function fadeSuffix(fadeEdges: ResolvedSeries["fadeEdges"]): string {
  if (!fadeEdges) {
    return "";
  }
  if (fadeEdges === "left") {
    return ":fade-left";
  }
  return fadeEdges === "right" ? ":fade-right" : ":fade";
}

function areaFill(ctx: SeriesContext, area: ResolvedSeries & AreaSeries): string {
  if (isGradientRef(area.fill)) {
    // bklit `fill="url(#x)"`: the user's own <LinearGradient id="x"> resource (see gradients.ts).
    return area.fill;
  }
  if (area.pattern) {
    // No <pattern> support in chart gradients: paint solid and let styles.css mask it into hatching.
    return area.pattern.color;
  }
  const id = `${ctx.input.uid}-area-${area.index}`;
  ctx.state.gradients.push({
    id,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, color: area.fill, opacity: area.fillOpacity },
      { offset: 1, color: area.fill, opacity: area.gradientToOpacity ?? 0 },
    ],
  });
  return `url(#${id})`;
}

function pushAreaFill(ctx: SeriesContext, s: ResolvedSeries, area: ResolvedSeries & AreaSeries): void {
  const curve = d3Curve(s.curve);
  const baseline = ctx.yDomains.get(s.yAxisId)?.[0] ?? 0;
  const fill = areaFill(ctx, area);
  pushDecorative(
    ctx.state.marks,
    ctx.areaY(ctx.rows, {
      id: `${s.id}:fill${fadeSuffix(area.fadeEdges)}`,
      ...yScaleOf(s),
      x: ctx.xAccessor,
      y1: baseline,
      y2: (d: Row): number => toNumber(d[s.dataKey]),
      fill,
      fillOpacity: 1,
      curve,
      key: ctx.keyOf,
    }),
  );
  if (s.kind !== "pattern") {
    // Selector on the core `data-ts-key` encoding of our own mark ids; cartesian marks have no class hook (UPSTREAM-GAPS #36).
    ctx.state.hoverDim.push({ select: `g[data-ts-key^="${keyAttr(s.id)}:fill"]`, opacity: dimOpacityOf(s), series: s.index, legendOpacity: dimOpacityOf(s) });
  }
}

/** The line's stroke paint and opacity: a ProfitLossLine is one sign colour or a gradient with a hard step at the zero crossing. */
interface LinePaint {
  readonly stroke: string;
  readonly plOpacity: number;
}

function profitLossStroke(ctx: SeriesContext, s: ResolvedSeries): LinePaint {
  const { profitLoss } = s;
  if (!profitLoss) {
    return { stroke: s.stroke, plOpacity: 1 };
  }
  const { state, input } = ctx;
  const hoveredSign = input.profitLossHovered ?? null;
  const signOpacity = (sign: 0 | 1): number => (hoveredSign !== null && hoveredSign !== sign ? 0.25 : 1);
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const row of ctx.rows) {
    const v = toNumber(row[s.dataKey]);
    if (Number.isFinite(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  // Selector on the core `data-ts-key` encoding of our own mark ids; cartesian marks have no class hook (UPSTREAM-GAPS #36).
  const lineGroup = `g[data-ts-key^="${keyAttr(s.id)}:"]:not([data-ts-key^="${keyAttr(s.id)}:hl"]):not([data-ts-key^="${keyAttr(s.id)}:fill"]):not([data-ts-key="${keyAttr(s.id)}:dot"])`;
  if (hi <= 0) {
    state.plRules.push({ kind: "dim", select: lineGroup, sign: 1 });
    return { stroke: profitLoss.negative, plOpacity: signOpacity(1) };
  }
  if (lo >= 0) {
    state.plRules.push({ kind: "dim", select: lineGroup, sign: 0 });
    return { stroke: profitLoss.positive, plOpacity: signOpacity(0) };
  }
  // Vertical stroke gradient across the path's own bbox: hard colour step at the zero crossing.
  const id = `${input.uid}-pl-${s.index}`;
  const zero = hi / (hi - lo);
  state.gradients.push({
    id,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, color: profitLoss.positive, opacity: signOpacity(0) },
      { offset: zero, color: profitLoss.positive, opacity: signOpacity(0) },
      { offset: zero, color: profitLoss.negative, opacity: signOpacity(1) },
      { offset: 1, color: profitLoss.negative, opacity: signOpacity(1) },
    ],
  });
  state.plRules.push({ kind: "stops", gradient: id });
  return { stroke: `url(#${id})`, plOpacity: 1 };
}

type Paint = (part: readonly Row[], id: string) => string;

/** The 0/15/85/100% edge fade of a line. bklit pins it to the plot viewport (userSpaceOnUse); native gradients are bbox-relative, so the stops are re-expressed
 * in the x extent of the rows that mark draws (a projection widens the domain; a dashed line is two marks with their own bbox). */
interface FadePaint {
  readonly paintFor: Paint;
  readonly lineValue: (d: Row) => number;
}

function fadePaint(ctx: SeriesContext, s: ResolvedSeries, fade: true | "left" | "right", yValue: (d: Row) => number): FadePaint {
  const { input, rows } = ctx;
  const [d0, d1] = ctx.fadeDomain ?? [new Date(0), new Date(1)];
  let vLo = Number.POSITIVE_INFINITY;
  let vHi = Number.NEGATIVE_INFINITY;
  let lastRow: Row | undefined;
  for (const row of rows) {
    const v = toNumber(row[s.dataKey]);
    if (Number.isFinite(v)) {
      vLo = Math.min(vLo, v);
      vHi = Math.max(vHi, v);
      lastRow = row;
    }
  }
  let lineValue = yValue;
  // A flat line has a zero-height bounding box, which an objectBoundingBox gradient cannot paint (bklit's userSpaceOnUse
  // fade draws it): give it a sub-pixel rise, as the sankey flat flows do.
  if (vLo === vHi && lastRow !== undefined) {
    const [yLo, yHi] = ctx.yDomains.get(s.yAxisId) ?? [0, 100];
    const rise = ((yHi - yLo) * FLAT_LINE_RISE_PX) / Math.max(1, input.plotHeight ?? 200);
    lineValue = (d: Row): number => yValue(d) + (d === lastRow ? rise : 0);
  }
  const spanD = d1.getTime() - d0.getTime();
  const view: { p: number; o: number }[] = [
    { p: 0, o: fade === "right" ? 1 : 0 },
    { p: 0.15, o: 1 },
    { p: 0.85, o: 1 },
    { p: 1, o: fade === "left" ? 1 : 0 },
  ];
  const opacityAt = (p: number): number => {
    for (let i = 1; i < view.length; i += 1) {
      const a = view[i - 1];
      const b = view[i];
      if (p <= b.p) {
        return a.o + ((b.o - a.o) * (p - a.p)) / (b.p - a.p);
      }
    }
    return fade === "left" ? 1 : 0;
  };
  const paintFor: Paint = (part, id) => {
    let tLo = Number.POSITIVE_INFINITY;
    let tHi = Number.NEGATIVE_INFINITY;
    for (const row of part) {
      if (Number.isFinite(toNumber(row[s.dataKey]))) {
        const t = ctx.keyOf(row);
        tLo = Math.min(tLo, t);
        tHi = Math.max(tHi, t);
      }
    }
    const spanL = tHi - tLo;
    const stops: { offset: number; color: string; opacity: number }[] = [];
    if (spanD > 0 && spanL > 0 && Number.isFinite(spanL)) {
      const pAt = (o: number): number => (tLo + o * spanL - d0.getTime()) / spanD;
      const oAt = (p: number): number => (d0.getTime() + p * spanD - tLo) / spanL;
      const startOpacity = opacityAt(clamp01(pAt(0)));
      const endOpacity = opacityAt(clamp01(pAt(1)));
      stops.push({ offset: 0, color: s.stroke, opacity: startOpacity });
      for (const v of view) {
        const o = oAt(v.p);
        if (o > 1e-6 && o < 1 - 1e-6) {
          stops.push({ offset: o, color: s.stroke, opacity: v.o });
        }
      }
      stops.push({ offset: 1, color: s.stroke, opacity: endOpacity });
    } else {
      for (const v of view) {
        stops.push({ offset: v.p, color: s.stroke, opacity: v.o });
      }
    }
    ctx.state.gradients.push({ id, x1: 0, y1: 0, x2: 1, y2: 0, stops });
    return `url(#${id})`;
  };
  return { paintFor, lineValue };
}

/** Row index the dashed tail starts from, when it falls inside the data. */
function dashedAt(ctx: SeriesContext, s: ResolvedSeries): number | undefined {
  return s.dashFromIndex !== undefined && s.dashFromIndex > 0 && s.dashFromIndex < ctx.input.data.length ? s.dashFromIndex : undefined;
}

interface DashSplit {
  readonly head: readonly Row[];
  readonly tail: readonly Row[];
}

/** The rows up to and from the dash row (kept in both so the halves join); undecimated, the full data is split by index. */
function splitAtDash(ctx: SeriesContext, dashAt: number): DashSplit {
  const { data } = ctx.input;
  if (!ctx.focusRows) {
    return { head: data.slice(0, dashAt + 1), tail: data.slice(dashAt) };
  }
  const at = ctx.keyOf(data[dashAt] ?? {});
  return { head: ctx.rows.filter((r) => ctx.keyOf(r) <= at), tail: ctx.rows.filter((r) => ctx.keyOf(r) >= at) };
}

function pushLine(ctx: SeriesContext, s: ResolvedSeries): number | undefined {
  const { input, rows, state } = ctx;
  const curve = d3Curve(s.curve);
  const yValue = (d: Row): number => toNumber(d[s.dataKey]);
  const { stroke, plOpacity } = profitLossStroke(ctx, s);
  const fade = s.profitLoss ? false : s.fadeEdges;
  let paintFor: Paint = () => stroke;
  let lineValue = yValue;
  if (fade) {
    ({ paintFor, lineValue } = fadePaint(ctx, s, fade, yValue));
  }
  const dashAt = dashedAt(ctx, s);
  const common = {
    ...yScaleOf(s),
    x: ctx.xAccessor,
    y: lineValue,
    z: (): string => s.dataKey,
    key: ctx.keyOf,
    strokeWidth: s.strokeWidth,
    curve,
    strokeOpacity: plOpacity,
  };
  const lineId = `${input.uid}-line-${s.kind}-${s.index}`;
  // Selector on the core `data-ts-key` encoding of our own mark ids; cartesian marks have no class hook (UPSTREAM-GAPS #36).
  state.hoverDim.push({ select: `g[data-ts-key^="${keyAttr(s.id)}:"]:not([data-ts-key^="${keyAttr(s.id)}:hl"]):not([data-ts-key^="${keyAttr(s.id)}:fill"]):not([data-ts-key="${keyAttr(s.id)}:dot"]):not([data-ts-key^="${keyAttr(s.id)}:active-"]):not([data-ts-key*=":marker"])`, opacity: dimOpacityOf(s), series: s.index, legendOpacity: dimOpacityOf(s) });
  // Decimated: the drawn line is decorative and `${id}:focus` (every row, invisible) is the focus source.
  const pushLineMark = (mark: AnyMark): void => {
    if (ctx.focusRows === undefined) {
      state.marks.push(mark);
    } else {
      pushDecorative(state.marks, mark);
    }
  };
  if (dashAt === undefined) {
    pushLineMark(ctx.lineY(rows, { id: s.id, ...common, stroke: paintFor(rows, lineId) }));
  } else {
    // bklit draws the whole (decimated) path and dashes it from `data[dashFromIndex]` (area.tsx:252-276): split the drawn rows at that row, shared by both halves.
    const { head, tail } = splitAtDash(ctx, dashAt);
    pushLineMark(ctx.lineY(head, { id: s.id, ...common, stroke: paintFor(head, lineId) }));
    pushLineMark(
      ctx.lineY(tail, {
        id: `${s.id}:tail`,
        ...common,
        stroke: paintFor(tail, `${lineId}-tail`),
        strokeDasharray: s.dashArray.replace(",", " "),
      }),
    );
  }
  if (ctx.focusRows !== undefined) {
    state.marks.push(ctx.lineY(ctx.focusRows, erase({ id: `${s.id}:focus`, ...common, stroke: "transparent", strokeOpacity: 0, strokeWidth: 0 })));
  }
  if (s.loading && s.loading.style !== "sweep") {
    // The pulse overlay is a second, decorative line over the real one (bklit line.tsx LineLoadingOverlays); loading-css.ts animates it.
    pushDecorative(state.marks, ctx.lineY(rows, erase({ id: `${s.id}:loading`, ...common, stroke: s.loading.stroke, strokeOpacity: 1 })));
  }
  return dashAt;
}

function pushPointMarkers(ctx: SeriesContext, s: ResolvedSeries): void {
  const { markerRows: rows, state } = ctx;
  // bklit SeriesMarkersDimWrapper: a focused point or another hovered legend row dims the markers (0.15s transition in styles.css).
  // Selector on the core `data-ts-key` encoding of our own mark ids; cartesian marks have no class hook (UPSTREAM-GAPS #36).
  const mk = s.marker;
  state.hoverDim.push({
    select: `g[data-ts-key^="${keyAttr(s.id)}:marker"]`,
    opacity: mk.fadeOnHover ? mk.inactiveOpacity : 1,
    series: s.index,
    legendOpacity: mk.fadeOnHover ? mk.inactiveOpacity : 1,
    marker: { opacity: mk.fadeOnHover ? mk.inactiveOpacity : 1, blur: mk.fadeOnHover ? mk.inactiveBlur : 0, enterBlur: mk.enterBlur, animate: mk.animate },
  });
  // bklit MarkerCircles (series-point-marker.tsx:55-91): optional outline, filled core, outer ring at radius + ringGap + strokeWidth / 2.
  const r = mk.radius;
  const xy = { ...yScaleOf(s), x: ctx.xAccessor, y: (d: Row): number => toNumber(d[s.dataKey]), key: ctx.keyOf };
  // bklit reveals each marker (0.5s fade, 2px blur) as the line's clip sweep reaches it; `decorative()` strips the datum from the motion context, so markers go in x-ordered buckets
  // that styles.css `bkm-mk-in` staggers (bucket i of MARKER_BUCKETS at i/MARKER_BUCKETS of the entrance, `--bkm-mk` written per bucket id by host-style markerStagger).
  const bucketCount = Math.max(1, Math.min(MARKER_BUCKETS, rows.length));
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const part = rows.slice(Math.floor((bucket * rows.length) / bucketCount), Math.floor(((bucket + 1) * rows.length) / bucketCount));
    if (mk.outlineWidth > 0) {
      const ringOuter = mk.strokeWidth > 0 ? r + mk.ringGap + mk.strokeWidth : r;
      pushDecorative(state.marks, dot(part, erase({ ...xy, id: `${s.id}:marker-out:${bucket}`, r: ringOuter + mk.outlineWidth / 2, fill: "none", stroke: mk.outlineColor, strokeWidth: mk.outlineWidth })));
    }
    if (mk.strokeWidth > 0) {
      pushDecorative(state.marks, dot(part, erase({ ...xy, id: `${s.id}:marker-ring:${bucket}`, r: r + mk.ringGap + mk.strokeWidth / 2, fill: "none", stroke: mk.stroke, strokeWidth: mk.strokeWidth })));
    }
    pushDecorative(state.marks, dot(part, erase({ ...xy, id: `${s.id}:marker:${bucket}`, r, fill: mk.fill })));
  }
}

// Hover highlight (bklit HighlightSegment): the same path re-stroked at full opacity, clipped to the band `--bkm-hl0/1` (`hoverStaticCss` styles) that the focus (hover) or drag (selection) sync writes,
// so neither re-resolves the definition. Always present (transparent when idle) so toggling never re-mounts.
function pushHighlight(ctx: SeriesContext, s: ResolvedSeries, dashAt: number | undefined): void {
  const hlRows = dashAt === undefined ? ctx.rows : ctx.input.data.slice(0, dashAt + 1);
  // Selector on the core `data-ts-key` encoding of our own mark ids; cartesian marks have no class hook (UPSTREAM-GAPS #36).
  ctx.state.hoverHighlights.push({ select: `path[data-ts-key^="${keyAttr(s.id)}:hl"]` });
  const yScale = yScaleOf(s);
  const curve = d3Curve(s.curve);
  pushDecorative(
    ctx.state.marks,
    ctx.lineY(hlRows, erase({
      id: `${s.id}:hl`,
      ...yScale,
      x: ctx.xAccessor,
      y: (d: Row): number => toNumber(d[s.dataKey]),
      key: ctx.keyOf,
      stroke: s.stroke,
      strokeWidth: s.strokeWidth,
      curve,
    })),
  );
}

const isAreaLike = (s: ResolvedSeries): s is ResolvedSeries & AreaSeries => s.kind === "area" || s.kind === "pattern";

/** Appends every series' marks (area fill, line, loading overlay, markers, highlight) in series order. */
export function pushSeriesMarks(ctx: SeriesContext): void {
  for (const s of ctx.input.series) {
    if (isAreaLike(s)) {
      const area = s;
      pushAreaFill(ctx, s, area);
      if (s.kind === "pattern" || !area.showLine) {
        continue;
      }
    }
    const dashAt = pushLine(ctx, s);
    if (s.showMarkers) {
      pushPointMarkers(ctx, s);
    }
    if (s.showHighlight && ctx.tooltipEnabled && !s.profitLoss) {
      pushHighlight(ctx, s, dashAt);
    }
  }
}
