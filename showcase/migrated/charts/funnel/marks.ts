// Funnel marks: each stage is `layers` concentric native areas (areaY horizontal / areaX vertical) over a two-point centreline pair, plus pixel-laid-out labels.
// No hover state: dim, pop-out and label dim are static scoped CSS keyed on a host attribute (hover-css.ts), so hover never rebuilds the definition.
import { areaY } from "@tanstack/charts/area";
import { areaX } from "@tanstack/charts/area-x";
import { rect } from "@tanstack/charts/rect";
import { ruleX, ruleY } from "@tanstack/charts/rule";
import { text } from "@tanstack/charts/text";
import type { AreaXCurve } from "@tanstack/charts/area-x";
import type { ChartCurve, ChartLinearGradient, ChartMark, ChartMotionTransition } from "@tanstack/charts";
import { fontContext, textWidth } from "../kit/text-width";
import type { FunnelDatum } from "./focus";

const SSR_WIDTH_RATIO = 0.58;

interface FunnelGradientStopInput {
  readonly offset: string | number;
  readonly color: string;
}

interface FunnelStageInput {
  readonly label: string;
  readonly value: number;
  readonly displayValue?: string;
  readonly color?: string;
  readonly gradient?: readonly FunnelGradientStopInput[];
}

type FunnelMark = ChartMark<FunnelDatum, number, number>;
type LabelAnchor = "start" | "middle" | "end";

interface AreaRow extends FunnelDatum {
  readonly layer: number;
  readonly pos: number;
  readonly half: number;
}

interface LabelRow extends FunnelDatum {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly anchor: LabelAnchor;
}

interface PillRow extends FunnelDatum {
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

interface FunnelMarkConfig {
  readonly stages: readonly FunnelStageInput[];
  readonly horizontal: boolean;
  readonly color: string;
  readonly layers: number;
  readonly gapPx: number;
  readonly curved: boolean;
  readonly transition?: ChartMotionTransition | undefined;
  /** Computed font family of the host: label text is measured in the face it is drawn in (the pill sizes from it). */
  readonly fontFamily: string;
  readonly showLabels: boolean;
  readonly showValues: boolean;
  readonly showPercentage: boolean;
  readonly formatValue: (value: number) => string;
  readonly formatPercentage: (pct: number) => string;
  /** Measured plot size in px (from the rendered scene). */
  readonly size: { readonly width: number; readonly height: number };
  readonly labelLayout: "spread" | "grouped";
  readonly labelOrientation?: "vertical" | "horizontal" | undefined;
  readonly labelAlign: "center" | "start" | "end";
  /** Resource-host id prefix: the innermost ring of stage i paints `url(#<prefix>-<i>)` (bklit renderPattern). */
  readonly patternPrefix?: string | undefined;
  readonly grid: { readonly bands: boolean; readonly bandColor: string; readonly lines: boolean; readonly lineColor: string; readonly lineOpacity: number; readonly lineWidth: number } | null;
}

// bklit's segment edge: one cubic per edge, control points at 55% of the stage length along the stage axis (d3 bump: 50%).
// Written as path strings, so the funnel needs neither TanStack's d3 curve adapters nor d3-shape.
const BKLIT_CONTROL = 0.55;
type Pt = readonly [number, number];
const edgeRun = (points: readonly Pt[], axis: "x" | "y", first: "M" | "L"): string => {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i] as Pt;
    if (i === 0) { d = `${first}${x},${y}`; continue; }
    const [px, py] = points[i - 1] as Pt;
    const dx = (x - px) * BKLIT_CONTROL;
    const dy = (y - py) * BKLIT_CONTROL;
    d += axis === "x" ? `C${px + dx},${py},${x - dx},${y},${x},${y}` : `C${px},${py + dy},${x},${y - dy},${x},${y}`;
  }
  return d;
};
// d3's area order: the top edge forward, the bottom edge back, closed.
const edgeArea = (top: readonly Pt[], bottom: readonly Pt[], axis: "x" | "y"): string =>
  top.length === 0 ? "" : `${edgeRun(top, axis, "M")}${edgeRun([...bottom].reverse(), axis, "L")}Z`;
const bklitCurve = (): ChartCurve => ({ line: (points) => edgeRun(points, "x", "M"), area: (top, bottom) => edgeArea(top, bottom, "x") });
const bklitCurveX = (): AreaXCurve => ({ areaX: (right, left) => edgeArea(right, left.map(([x], i) => [x, right[i]?.[1] ?? 0] as Pt), "y") });

// Label type (Tailwind text-sm / text-xs): the size/weight each kind is drawn and measured in.
const LABEL_FONT = { name: { size: 12, weight: 500 }, pct: { size: 12, weight: 700 }, value: { size: 14, weight: 600 } } as const;
// bklit: ring half-extent as a share of the chart cross axis.
const HALF_EXTENT = 0.44;
const RING_SHRINK = 0.35;
const HOVER_POP = 0.12;
const DIM_OPACITY = 0.4;
// bklit label metrics (Tailwind text-sm / text-xs line heights, pill padding, grouped gap-1.5).
const VALUE_LINE = 20;
const SMALL_LINE = 16;
const PILL_PAD_X = 12;
const PILL_PAD_Y = 4;
const GROUP_GAP = 6;
const GROUP_PAD = 0.08;
const SPREAD_BAND = 0.16;

const funnelGradientId = (stage: number): string => `funnel-stage-${stage}`;
const ringOpacity = (layer: number, layers: number): number => 0.18 + (layer / (layers - 1 || 1)) * 0.65;
/** Per-layer fill alpha reproducing bklit's group dim (0.4 on the stacked segment): cumulative alpha at depth k is DIM * (1 - prod(1 - a)),
 * so layer k contributes 1 - (1 - T_k) / (1 - T_{k-1}); per-layer opacity would compound to mid-grey. */
const dimmedRingOpacity = (layer: number, layers: number): number => {
  const cumulative = (upTo: number): number => {
    let keep = 1;
    for (let k = 0; k <= upTo; k += 1) { keep *= 1 - ringOpacity(k, layers); }
    return DIM_OPACITY * (1 - keep);
  };
  const previous = layer === 0 ? 0 : cumulative(layer - 1);
  return 1 - (1 - cumulative(layer)) / (1 - previous);
};
const ringScale = (layer: number, layers: number): number => 1 - (layer / layers) * RING_SHRINK;
const popExtra = (layer: number, layers: number): number => (layer / Math.max(layers - 1, 1)) * HOVER_POP;

const stageColor = (stage: FunnelStageInput, fallback: string): string => stage.gradient?.[0]?.color ?? stage.color ?? fallback;


interface FontMetrics {
  /** Rounded font ascent / descent: what an HTML line box centres (the baseline sits (ascent - descent) / 2 below the line centre). */
  readonly ascent: number;
  readonly descent: number;
  /** SVG `dominant-baseline: middle` puts the baseline half an x-height below the y attribute. */
  readonly xHeight: number;
}
const fontMetrics = (fontSize: number, fontWeight: number, fontFamily: string): FontMetrics => {
  const metrics = fontContext(fontSize, fontWeight, fontFamily)?.measureText("x");
  return metrics
    ? { ascent: metrics.fontBoundingBoxAscent, descent: metrics.fontBoundingBoxDescent, xHeight: metrics.actualBoundingBoxAscent }
    : { ascent: fontSize, descent: fontSize / 3, xHeight: fontSize * 0.53 };
};

const buildFunnelGradients = (stages: readonly FunnelStageInput[], horizontal: boolean): readonly ChartLinearGradient[] =>
  stages.flatMap((stage, index) => {
    const stops = stage.gradient;
    if (!stops || stops.length === 0) {return [];}
    return [{
      id: funnelGradientId(index),
      stops: stops.map((stop) => ({
        color: stop.color,
        // oxlint-disable-next-line unicorn/prefer-number-coercion -- offsets like "50%" need parseFloat; Number("50%") is NaN.
        offset: typeof stop.offset === "string" ? Number.parseFloat(stop.offset) / 100 : stop.offset,
      })),
      x1: 0, x2: horizontal ? 1 : 0, y1: 0, y2: horizontal ? 0 : 1,
    }];
  });

interface LabelItem {
  readonly kind: "value" | "pct" | "name";
  readonly text: string;
  readonly width: number;
  readonly height: number;
}

interface Placed {
  readonly item: LabelItem;
  readonly anchor: LabelAnchor;
  readonly px: number;
  readonly py: number;
}

/** A stage cell in px: its origin, size and centre. */
interface LabelBox {
  readonly cxPx: number;
  readonly cyPx: number;
  readonly cellPxStart: number;
  readonly cellPyStart: number;
  readonly cellW: number;
  readonly cellH: number;
}

type Put = (item: LabelItem, px: number, py: number, anchor: LabelAnchor) => void;

interface RingFillInput {
  readonly base: string;
  readonly gradientId: string | undefined;
  readonly index: number;
  readonly innermost: boolean;
  readonly patternPrefix: string | undefined;
}

const ringFill = ({ base, gradientId, index, innermost, patternPrefix }: Readonly<RingFillInput>): string => {
  if (innermost && patternPrefix !== undefined) { return `url(#${patternPrefix}-${index})`; }
  if (innermost && gradientId !== undefined) { return `url(#${gradientId})`; }
  return base;
};

const labelItems = (config: FunnelMarkConfig, stage: FunnelStageInput, pct: number): LabelItem[] => {
  const items: LabelItem[] = [];
  if (config.showValues) {
    const t = stage.displayValue ?? config.formatValue(stage.value);
    items.push({ height: VALUE_LINE, kind: "value", text: t, width: textWidth(t, 14, 600, config.fontFamily, SSR_WIDTH_RATIO) });
  }
  if (config.showPercentage) {
    const t = config.formatPercentage(pct);
    items.push({ height: SMALL_LINE + PILL_PAD_Y * 2, kind: "pct", text: t, width: textWidth(t, 12, 700, config.fontFamily, SSR_WIDTH_RATIO) + PILL_PAD_X * 2 });
  }
  if (config.showLabels) {
    items.push({ height: SMALL_LINE, kind: "name", text: stage.label, width: textWidth(stage.label, 12, 500, config.fontFamily, SSR_WIDTH_RATIO) });
  }
  return items;
};

const findItem = (items: readonly LabelItem[], kind: LabelItem["kind"]): LabelItem | undefined => items.find((it) => it.kind === kind);

const placeSpread = (items: readonly LabelItem[], box: LabelBox, horizontal: boolean, put: Put): void => {
  const value = findItem(items, "value");
  const pctItem = findItem(items, "pct");
  const name = findItem(items, "name");
  const { cxPx, cyPx, cellPxStart, cellPyStart, cellW, cellH } = box;
  if (horizontal) {
    if (value) {put(value, cxPx, cellPyStart + cellH * SPREAD_BAND - 4 - VALUE_LINE / 2, "middle");}
    if (pctItem) {put(pctItem, cxPx, cyPx, "middle");}
    if (name) {put(name, cxPx, cellPyStart + cellH * (1 - SPREAD_BAND) + 4 + SMALL_LINE / 2, "middle");}
  } else {
    if (value) {put(value, cellPxStart + cellW * SPREAD_BAND - 8, cyPx, "end");}
    if (pctItem) {put(pctItem, cxPx, cyPx, "middle");}
    if (name) {put(name, cellPxStart + cellW * (1 - SPREAD_BAND) + 8, cyPx, "start");}
  }
};

// bklit pads the group by 8% of the cell WIDTH on both axes (CSS percentage padding is width-relative).
const groupOffset = (align: FunnelMarkConfig["labelAlign"], size: number, total: number, cellW: number): number => {
  const pad = cellW * GROUP_PAD;
  if (align === "start") {return pad;}
  if (align === "end") {return total - pad - size;}
  return (total - size) / 2;
};

const alignedLeft = (align: FunnelMarkConfig["labelAlign"], left: number, groupWidth: number, width: number): number => {
  if (align === "start") { return left; }
  return align === "end" ? left + groupWidth - width : left + (groupWidth - width) / 2;
};

// Grouped: a tight stack (gap-1.5) placed within the cell by labelAlign.
const placeGrouped = (items: readonly LabelItem[], box: LabelBox, config: Pick<FunnelMarkConfig, "horizontal" | "labelAlign" | "labelOrientation">, put: Put): void => {
  const { horizontal, labelAlign } = config;
  const { cxPx, cyPx, cellPxStart, cellPyStart, cellW, cellH } = box;
  const stackVertical = (config.labelOrientation ?? (horizontal ? "vertical" : "horizontal")) === "vertical";
  const gapTotal = GROUP_GAP * Math.max(0, items.length - 1);
  const gw = stackVertical ? Math.max(0, ...items.map((it) => it.width)) : items.reduce((sum, it) => sum + it.width, 0) + gapTotal;
  const gh = stackVertical ? items.reduce((sum, it) => sum + it.height, 0) + gapTotal : Math.max(0, ...items.map((it) => it.height));
  // bklit: horizontal funnels place the group vertically; vertical funnels place it horizontally.
  const left = horizontal ? cxPx - gw / 2 : cellPxStart + groupOffset(labelAlign, gw, cellW, cellW);
  const top = horizontal ? cellPyStart + groupOffset(labelAlign, gh, cellH, cellW) : cyPx - gh / 2;
  const itemAlign = horizontal ? "center" : labelAlign;
  let cursor = stackVertical ? top : left;
  for (const item of items) {
    if (stackVertical) {
      put(item, alignedLeft(itemAlign, left, gw, item.width) + item.width / 2, cursor + item.height / 2, "middle");
      cursor += item.height + GROUP_GAP;
    } else {
      put(item, cursor + item.width / 2, top + (gh - item.height) / 2 + item.height / 2, "middle");
      cursor += item.width + GROUP_GAP;
    }
  }
};

/** Plot geometry shared by rings, grid and labels: stage cells along the stage axis and px -> data conversions. */
interface FunnelGeometry {
  readonly W: number;
  readonly H: number;
  readonly count: number;
  readonly norms: readonly number[];
  readonly unitPx: number;
  readonly gapData: number;
  readonly cell: number;
  readonly cellStart: (index: number) => number;
  readonly stageStart: (index: number) => number;
  readonly toX: (px: number) => number;
  readonly toY: (py: number) => number;
}

const funnelGeometry = (config: FunnelMarkConfig): FunnelGeometry => {
  const { stages, horizontal } = config;
  const W = Math.max(1, config.size.width);
  const H = Math.max(1, config.size.height);
  const count = stages.length;
  const first = stages[0]?.value ?? 1;
  const norms = stages.map((stage) => {
    const norm = stage.value / first;
    return Number.isFinite(norm) && norm > 0 ? norm : 0;
  });
  // Stage axis is `count` data units across W (horizontal) or H (vertical); cross axis is 1 unit.
  const axisPx = horizontal ? W : H;
  const unitPx = axisPx / count;
  const gapData = Math.min(0.5, config.gapPx / unitPx);
  const cell = 1 - (gapData * (count - 1)) / count;
  const cellStart = (index: number): number => index * (cell + gapData);
  return {
    W,
    H,
    cell,
    cellStart,
    count,
    gapData,
    norms,
    // bklit paints each stage in its own svg, whose origin Chrome snaps to a whole pixel while the shape keeps its fractional size, so
    // stage edges (and the 1px gap columns between them) land on pixel boundaries.
    stageStart: (index) => Math.round(cellStart(index) * unitPx) / unitPx,
    // px (from the plot's top-left) -> data coordinates.
    toX: (px) => (horizontal ? (px / W) * count : px / W - 0.5),
    toY: (py) => (horizontal ? 0.5 - py / H : (py / H) * count),
    unitPx,
  };
};

type FunnelGrid = NonNullable<FunnelMarkConfig["grid"]>;

const bandMark = (grid: FunnelGrid, config: FunnelMarkConfig, geo: FunnelGeometry): FunnelMark => {
  const { horizontal } = config;
  const { cell, cellStart } = geo;
  const bandRows: PillRow[] = config.stages.map((_stage, index) => ({
    stage: index,
    x1: horizontal ? cellStart(index) : -0.5,
    x2: horizontal ? cellStart(index) + cell : 0.5,
    y1: horizontal ? -0.5 : cellStart(index),
    y2: horizontal ? 0.5 : cellStart(index) + cell,
  }));
  return rect(bandRows.filter((_row, index) => index % 2 === 0), {
    fill: grid.bandColor, id: "funnel-bands", key: "stage", x1: "x1", x2: "x2", y1: "y1", y2: "y2",
  });
};

// bklit: one line per gap between stages, at the gap centre, spanning the whole cross axis.
const lineMark = (grid: FunnelGrid, config: FunnelMarkConfig, geo: FunnelGeometry): FunnelMark => {
  const gapCentres = config.stages.slice(0, -1).map((_stage, index) => geo.cellStart(index) + geo.cell + geo.gapData / 2);
  const options = { id: "funnel-lines", motion: false as const, stroke: grid.lineColor, strokeOpacity: grid.lineOpacity, strokeWidth: grid.lineWidth };
  return config.horizontal ? ruleX(gapCentres, { ...options, x: (row: number) => row }) : ruleY(gapCentres, { ...options, y: (row: number) => row });
};

interface RingCurves {
  readonly curve: ChartCurve | undefined;
  readonly curveX: AreaXCurve | undefined;
}

interface RingContext {
  readonly config: FunnelMarkConfig;
  readonly geo: FunnelGeometry;
  readonly curves: RingCurves;
}

const ringMark = ({ config, geo, curves }: RingContext, stage: FunnelStageInput, index: number, layer: number): FunnelMark => {
  const { horizontal, layers, curved } = config;
  const startNorm = geo.norms[index] ?? 0;
  const endNorm = index < geo.count - 1 ? (geo.norms[index + 1] ?? startNorm) : startNorm;
  const gradientId = stage.gradient && stage.gradient.length > 0 ? funnelGradientId(index) : undefined;
  const scale = ringScale(layer, layers);
  const rows: AreaRow[] = [
    { half: startNorm * HALF_EXTENT * scale, layer, pos: geo.stageStart(index), stage: index },
    { half: endNorm * HALF_EXTENT * scale, layer, pos: geo.stageStart(index) + geo.cell, stage: index },
  ];
  const common = {
    fill: ringFill({ base: stageColor(stage, config.color), gradientId, index, innermost: layer === layers - 1, patternPrefix: config.patternPrefix }),
    fillOpacity: ringOpacity(layer, layers),
    id: `funnel-s${index}-l${layer}`,
    key: (_row: AreaRow, meta: { readonly index: number }): string => `${index}:${layer}:${meta.index}`,
    // Entrance is a CSS scale (host data-entering); geometry changes (resize) snap.
    motion: false as const,
  };
  if (horizontal) {
    return areaY(rows, { ...common, curve: curved ? curves.curve : undefined, x: "pos", y1: (row: AreaRow) => -row.half, y2: (row: AreaRow) => row.half });
  }
  return areaX(rows, { ...common, curve: curved ? curves.curveX : undefined, x1: (row: AreaRow) => -row.half, x2: (row: AreaRow) => row.half, y: "pos" });
};

type PlacedByKind = Record<LabelItem["kind"], Placed[]>;

// Labels laid out in pixels (bklit renders them as HTML in the cell).
const placeLabels = (config: FunnelMarkConfig, geo: FunnelGeometry): PlacedByKind => {
  const { horizontal } = config;
  const placedByKind: PlacedByKind = { name: [], pct: [], value: [] };
  const put: Put = (item, px, py, anchor) => { placedByKind[item.kind].push({ anchor, item, px, py }); };
  for (const [index, stage] of config.stages.entries()) {
    const items = labelItems(config, stage, (geo.norms[index] ?? 0) * 100);
    // Cell box in px.
    const cellPxStart = horizontal ? geo.cellStart(index) * geo.unitPx : 0;
    const cellW = horizontal ? geo.cell * geo.unitPx : geo.W;
    const cellPyStart = horizontal ? 0 : geo.cellStart(index) * geo.unitPx;
    const cellH = horizontal ? geo.H : geo.cell * geo.unitPx;
    const box: LabelBox = { cellH, cellPxStart, cellPyStart, cellW, cxPx: cellPxStart + cellW / 2, cyPx: cellPyStart + cellH / 2 };
    if (config.labelLayout === "spread") { placeSpread(items, box, horizontal, put); } else { placeGrouped(items, box, config, put); }
  }
  return placedByKind;
};

const pillMarks = (placed: readonly Placed[], geo: FunnelGeometry): FunnelMark[] => {
  const { toX, toY } = geo;
  const pills: PillRow[] = placed.map((p, order) => ({
    stage: order,
    x1: toX(Math.round(p.px - p.item.width / 2)),
    x2: toX(Math.round(p.px + p.item.width / 2)),
    y1: toY(Math.round(p.py + p.item.height / 2)),
    y2: toY(Math.round(p.py - p.item.height / 2)),
  }));
  // One rect mark per stage so each pill has its own stable key.
  return pills.map((pill) => rect([pill], {
    fill: "var(--foreground)", id: `funnel-pill-${pill.stage}`, inset: 0, key: "stage",
    motion: false as const,
    radius: (PILL_PAD_Y * 2 + SMALL_LINE) / 2,
    x1: "x1", x2: "x2", y1: "y1", y2: "y2",
  }));
};

// HTML line boxes put the baseline (ascent - descent) / 2 below the line centre and paint it on a whole pixel; SVG text is placed by
// its x-height centre, so each label's y is that rounded baseline minus half the x-height.
const textMarks = (config: FunnelMarkConfig, geo: FunnelGeometry, placedByKind: PlacedByKind): FunnelMark[] => {
  const metricsByKind = {
    name: fontMetrics(LABEL_FONT.name.size, LABEL_FONT.name.weight, config.fontFamily),
    pct: fontMetrics(LABEL_FONT.pct.size, LABEL_FONT.pct.weight, config.fontFamily),
    value: fontMetrics(LABEL_FONT.value.size, LABEL_FONT.value.weight, config.fontFamily),
  };
  const textY = (kind: LabelItem["kind"], centre: number): number => {
    const metrics = metricsByKind[kind];
    return Math.round(centre + (metrics.ascent - metrics.descent) / 2) - metrics.xHeight / 2;
  };
  // The entrance fade is CSS (entrance-css.ts); labels and pills snap on a rebuild (resize) like bklit's re-laid-out stages.
  // The stage index is the placed order: each kind list holds one entry per stage.
  const rowsFor = (kind: LabelItem["kind"]): LabelRow[] => placedByKind[kind].map((placed, order) => ({
    anchor: placed.anchor, stage: order, text: placed.item.text, x: geo.toX(placed.px), y: geo.toY(textY(kind, placed.py)),
  }));
  const emitText = (kind: LabelItem["kind"], id: string, fill: string): FunnelMark[] => {
    const rows = rowsFor(kind);
    if (rows.length === 0) { return []; }
    return [text(rows, {
      anchor: (row: LabelRow) => row.anchor, fill, fontSize: LABEL_FONT[kind].size, fontWeight: LABEL_FONT[kind].weight,
      id, key: (row: LabelRow) => row.stage, motion: false as const,
      text: (row: LabelRow) => row.text, x: (row: LabelRow) => row.x, y: (row: LabelRow) => row.y,
    })];
  };
  return [...emitText("value", "funnel-value", "var(--foreground)"), ...emitText("pct", "funnel-pct", "var(--background)"), ...emitText("name", "funnel-name", "var(--muted-foreground)")];
};

interface FunnelMarks {
  readonly marks: readonly FunnelMark[];
}

const createFunnelMarks = (config: FunnelMarkConfig): FunnelMarks => {
  const { stages, horizontal, layers, grid } = config;
  const geo = funnelGeometry(config);
  const curves: RingCurves = { curve: horizontal ? bklitCurve() : undefined, curveX: horizontal ? undefined : bklitCurveX() };

  const ring: RingContext = { config, curves, geo };
  const marks: FunnelMark[] = [];
  if (grid?.bands === true) { marks.push(bandMark(grid, config, geo)); }
  for (const [index, stage] of stages.entries()) {
    for (let layer = 0; layer < layers; layer += 1) { marks.push(ringMark(ring, stage, index, layer)); }
  }
  // bklit paints the gap lines above the stages.
  if (grid?.lines === true && geo.count > 1) { marks.push(lineMark(grid, config, geo)); }

  const placedByKind = placeLabels(config, geo);
  marks.push(...pillMarks(placedByKind.pct, geo), ...textMarks(config, geo, placedByKind));
  return { marks };
};

export { buildFunnelGradients, createFunnelMarks, dimmedRingOpacity, popExtra, ringOpacity, stageColor };
export type { FunnelGradientStopInput, FunnelStageInput };
