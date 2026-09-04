// Candlestick mark scenes: hover-dot, highlight, wicks, and bodies geometry.
import type { ChartPoint, MarkRenderContext, SceneNode } from "@tanstack/charts";
import type { DotConfig } from "./tooltip-mappers";
import type { ChartDatum } from "./types";
import {
  areBothFinite,
  COLLAPSED_GEOMETRY_PX,
  FLAT_EXTENT_FALLBACK_PX,
  GEOMETRY_HALF_DIVISOR,
  isFiniteNumber,
  isNumber,
  MIN_GEOMETRY_EXTENT_PX,
} from "./candlestick-chart-shared";
import type { CandlePatternRef } from "./candlestick-chart-shared";

const WICK_WIDTH_PX = 1.5;
// Mark id for the hover-highlight mark (mirrors wick/body geometry, snaps instead of springing).
const HOVER_HIGHLIGHT_MARK_ID = "hover-highlight";
// Shared class for every candle rect node (wicks and bodies read it for styling hooks).
const CANDLE_CELL_CLASS_NAME = "chart-candle-cell";
const ROW_INDEX_STEP = 1;

// DotConfig color is string | fn | undefined; this names the fn branch for narrowing.
type CandleDotColorFn = Exclude<DotConfig["color"], string | undefined>;
const isCandleDotColorFn = <Value,>(value: Value): value is Value & CandleDotColorFn => typeof value === "function";

interface CandleWickSegmentNodesParams {
  readonly collapseY: number;
  readonly cx: number;
  readonly dimOpacity: number | undefined;
  readonly segKey: string;
  readonly segTargetHeight: number;
  readonly segTargetY: number;
  readonly showTarget: boolean;
  readonly wickFill: string;
}

// Wick segments split at the body edge so stacked dim opacities never double-composite on overlap.
const buildWickSegmentNodes = (params: Readonly<CandleWickSegmentNodesParams>): SceneNode[] => {
  const { collapseY, cx, dimOpacity, segKey, segTargetHeight, segTargetY, showTarget, wickFill } = params;
  if (segTargetHeight <= MIN_GEOMETRY_EXTENT_PX) {return [];}
  const collapsedY = Math.min(Math.max(collapseY, segTargetY), segTargetY + segTargetHeight);
  return [{
    className: CANDLE_CELL_CLASS_NAME,
    height: showTarget ? segTargetHeight : COLLAPSED_GEOMETRY_PX,
    key: segKey,
    kind: "rect",
    style: { fill: wickFill, opacity: dimOpacity },
    width: WICK_WIDTH_PX,
    x: cx - WICK_WIDTH_PX / GEOMETRY_HALF_DIVISOR,
    y: showTarget ? segTargetY : collapsedY,
  }];
};

// DotColor precedence (incl. function branch) evaluates once at mark-build time, not per hover.
const resolveCandleDotColor = (color: DotConfig["color"], date: Readonly<Date>, close: number): string => {
  if (color !== undefined && color !== "") {
    if (isCandleDotColorFn(color)) {
      return color({ close, date }, { dataKey: "close" });
    }
    return color;
  }
  return "var(--chart-line-primary)";
}

interface CandleMarkScene {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, Date, number>[];
}

interface CandleHoverDotSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly (Date | undefined)[];
  readonly closeValues: readonly (number | undefined)[];
  readonly dotCfg: Readonly<DotConfig>;
  readonly size: number;
  readonly strokeWidth: number;
  readonly isRing: boolean;
}

interface CandleHoverDotEntryParams {
  readonly close: number | undefined;
  readonly date: Date | undefined;
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly dotCfg: Readonly<DotConfig>;
  readonly isRing: boolean;
  readonly scales: MarkRenderContext["scales"];
  readonly size: number;
  readonly strokeWidth: number;
}

interface CandleHoverDotEntry {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

/**
 * Builds the hover-dot entry for one candle row; invalid rows build nothing.
 *
 * @param {Readonly<CandleHoverDotEntryParams>} params - Resolved scales, row values, and dot styling inputs.
 * @returns {CandleHoverDotEntry | undefined} Node plus point, or undefined when the row is invalid.
 */
const buildCandleHoverDotEntry = (params: Readonly<CandleHoverDotEntryParams>): CandleHoverDotEntry | undefined => {
  const { close, date, datum, datumIndex, dotCfg, isRing, scales, size, strokeWidth } = params;
  const pixelX = date === undefined ? Number.NaN : scales.x.map(date);
  const pixelY = close === undefined ? Number.NaN : scales.y.map(close);
  if (!Number.isFinite(pixelX) || !Number.isFinite(pixelY) || date === undefined || close === undefined) {return undefined;}
  const fill = resolveCandleDotColor(dotCfg.color, date, close);
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fill,
    datum,
    datumIndex,
    group: null,
    groupLabel: "hover-dot",
    key: `hover-dot:${datumIndex}`,
    markId: "hover-dot",
    x: pixelX,
    xValue: date,
    y: pixelY,
    yValue: close,
  };
  const node: SceneNode = {
    key: `hover-dot:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: size,
    style: isRing
      ? { fill: "transparent", stroke: fill, strokeWidth }
      : { fill, stroke: "var(--chart-background)", strokeWidth },
    x: pixelX,
    y: pixelY,
  };
  return { node, point };
};

/**
 * Builds the hover-dot scene for one render pass (nodes plus interaction points).
 *
 * @param {Readonly<CandleHoverDotSceneParams>} params - Resolved scales, channel values, and dot styling inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the hover-dot mark plus their points.
 */
const renderCandleHoverDotScene = (params: Readonly<CandleHoverDotSceneParams>): CandleMarkScene => {
  const { scales, source, xValues, closeValues, dotCfg, size, strokeWidth, isRing } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (const [datumIndex, datum] of source.entries()) {
    const entry = buildCandleHoverDotEntry({ close: closeValues[datumIndex], date: xValues[datumIndex], datum, datumIndex, dotCfg, isRing, scales, size, strokeWidth });
    if (entry !== undefined) {
      nodes.push(entry.node);
      points.push(entry.point);
    }
  }
  return { nodes, points };
};

interface CandleHoverDotChannels {
  readonly xValues: readonly (Date | undefined)[];
  readonly closeValues: readonly (number | undefined)[];
}

/**
 * Collects hover-dot channel values once at mark-build time (bklit parity: no decimation).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the mark.
 * @param {string} xDataKey - Datum field holding the point date.
 * @returns {CandleHoverDotChannels} Parallel date/close arrays with non-conforming entries cleared to undefined.
 */
const collectCandleHoverDotChannels = (
  source: readonly Readonly<ChartDatum>[],
  xDataKey: string,
): CandleHoverDotChannels => {
  const xValues: (Date | undefined)[] = [];
  const closeValues: (number | undefined)[] = [];
  for (const datum of source) {
    const xRaw = datum[xDataKey];
    xValues.push(xRaw instanceof Date ? xRaw : undefined);
    const closeRaw = datum.close;
    closeValues.push(isFiniteNumber(closeRaw) ? closeRaw : undefined);
  }
  return { closeValues, xValues };
};

interface CandleHighlightChannels {
  readonly xValues: readonly (Date | undefined)[];
  readonly lowValues: readonly (number | undefined)[];
  readonly highValues: readonly (number | undefined)[];
  readonly openValues: readonly (number | undefined)[];
  readonly closeValues: readonly (number | undefined)[];
  readonly yValues: readonly number[];
}

/**
 * Collects highlight channel values once at mark-build time (bklit parity: no decimation).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the mark.
 * @param {string} xDataKey - Datum field holding the point date.
 * @returns {CandleHighlightChannels} Date channel plus the finite low/high/open/close values for the y channel.
 */
const collectCandleHighlightChannels = (
  source: readonly Readonly<ChartDatum>[],
  xDataKey: string,
): CandleHighlightChannels => {
  const xValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum[xDataKey];
    return raw instanceof Date ? raw : undefined;
  });
  const lowValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.low;
    return isNumber(raw) ? raw : undefined;
  });
  const highValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.high;
    return isNumber(raw) ? raw : undefined;
  });
  const openValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.open;
    return isNumber(raw) ? raw : undefined;
  });
  const closeValues = source.map((datum: Readonly<ChartDatum>) => {
    const raw = datum.close;
    return isNumber(raw) ? raw : undefined;
  });
  return {
    closeValues,
    highValues,
    lowValues,
    openValues,
    xValues,
    yValues: [
      ...lowValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ...highValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ...openValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ...closeValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    ],
  };
};

interface CandleHighlightSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly xValues: readonly (Date | undefined)[];
  readonly lowValues: readonly (number | undefined)[];
  readonly highValues: readonly (number | undefined)[];
  readonly openValues: readonly (number | undefined)[];
  readonly closeValues: readonly (number | undefined)[];
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
}

interface AppendCandleRowSink {
  readonly index: number;
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, Date, number>[];
}

interface CandleHighlightRowFields {
  readonly close: number;
  readonly datum: Readonly<ChartDatum>;
  readonly date: Date;
  readonly high: number;
  readonly low: number;
  readonly open: number;
}

interface CandleHighlightRowPixels {
  readonly cx: number;
  readonly yClose: number;
  readonly yHigh: number;
  readonly yLow: number;
  readonly yOpen: number;
}

interface CandleHighlightPixelParams {
  readonly close: number;
  readonly date: Date;
  readonly high: number;
  readonly low: number;
  readonly open: number;
  readonly scales: MarkRenderContext["scales"];
}

interface CandleRowFillParams {
  readonly close: number;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly open: number;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface CandleRowFill {
  readonly candlePattern: Readonly<CandlePatternRef>;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly isPositive: boolean;
}

interface CandleHighlightStrokeParams {
  readonly bodyHeight: number;
  readonly bodyWidthPx: number;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly fill: string;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

interface CandleHighlightRowNodesParams {
  readonly bodyWidthPx: number;
  readonly candlePattern: Readonly<CandlePatternRef>;
  readonly cx: number;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly point: ChartPoint<ChartDatum, Date, number>;
  readonly yClose: number;
  readonly yHigh: number;
  readonly yLow: number;
  readonly yOpen: number;
}

interface CandleRangeFields {
  readonly date: Date;
  readonly high: number;
  readonly low: number;
}

interface CandleHighlightPrices {
  readonly close: number;
  readonly open: number;
}

interface CandleRowReadInput {
  readonly index: number;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

/**
 * Parses the date/low/high branch of one candle row; invalid branches parse nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleRangeFields | undefined} Validated range fields, or undefined when the branch is invalid.
 */
const parseCandleRangeFields = (params: Readonly<CandleRowReadInput>): CandleRangeFields | undefined => {
  const datum = params.source[params.index];
  const date = datum[params.xDataKey];
  if (!(date instanceof Date)) {return undefined;}
  const { high, low } = datum;
  if (!isNumber(low) || !isNumber(high) || !areBothFinite(low, high)) {return undefined;}
  return { date, high, low };
};

/**
 * Parses the open/close branch of one highlight row; invalid branches parse nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleHighlightPrices | undefined} Validated price fields, or undefined when the branch is invalid.
 */
const parseCandleHighlightPrices = (params: Readonly<CandleRowReadInput>): CandleHighlightPrices | undefined => {
  const datum = params.source[params.index];
  const { close, open } = datum;
  if (!isNumber(open)) {return undefined;}
  if (!isNumber(close) || !areBothFinite(open, close)) {return undefined;}
  return { close, open };
};

/**
 * Reads one highlight row; invalid rows read nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleHighlightRowFields | undefined} Validated row fields, or undefined when the row is invalid.
 */
const readCandleHighlightFields = (params: Readonly<CandleRowReadInput>): CandleHighlightRowFields | undefined => {
  const range = parseCandleRangeFields(params);
  if (range === undefined) {return undefined;}
  const prices = parseCandleHighlightPrices(params);
  if (prices === undefined) {return undefined;}
  const datum = params.source[params.index];
  return { close: prices.close, date: range.date, datum, high: range.high, low: range.low, open: prices.open };
};

/**
 * Maps one highlight row through the scales; off-scale rows map nothing.
 *
 * @param {Readonly<CandleHighlightPixelParams>} params - Validated row fields plus resolved scales.
 * @returns {CandleHighlightRowPixels | undefined} Pixel coordinates, or undefined when any map is non-finite.
 */
const mapCandleHighlightPixels = (params: Readonly<CandleHighlightPixelParams>): CandleHighlightRowPixels | undefined => {
  const { close, date, high, low, open, scales } = params;
  const cx = scales.x.map(date);
  const yLow = scales.y.map(low);
  const yHigh = scales.y.map(high);
  const yOpen = scales.y.map(open);
  const yClose = scales.y.map(close);
  if (!areBothFinite(cx, yLow) || !areBothFinite(yHigh, yOpen) || !Number.isFinite(yClose)) {return undefined;}
  return { cx, yClose, yHigh, yLow, yOpen };
};

/**
 * Resolves the fill for one candle row from polarity and pattern presence.
 *
 * @param {Readonly<CandleRowFillParams>} params - Row open/close plus pattern and fill inputs.
 * @returns {CandleRowFill} Polarity, pattern, and resolved fill.
 */
const resolveCandleRowFill = (params: Readonly<CandleRowFillParams>): CandleRowFill => {
  const { close, negativePattern, open, positivePattern, solidFillFor } = params;
  const isPositive = close >= open;
  const candlePattern = isPositive ? positivePattern : negativePattern;
  const hasOwnPattern = Boolean(candlePattern.href);
  const fill = solidFillFor(isPositive, hasOwnPattern);
  return { candlePattern, fill, hasOwnPattern, isPositive };
};

/**
 * Builds the inside-stroke node for one highlight row; zero widths build nothing.
 *
 * @param {Readonly<CandleHighlightStrokeParams>} params - Body geometry, fill, and the row point.
 * @returns {SceneNode | undefined} Stroke node, or undefined when the stroke width is zero.
 */
const buildCandleHighlightStrokeNode = (params: Readonly<CandleHighlightStrokeParams>): SceneNode | undefined => {
  const { bodyHeight, bodyWidthPx, bodyX, bodyY, fill, insideStrokeW, key, point } = params;
  if (insideStrokeW <= MIN_GEOMETRY_EXTENT_PX) {return undefined;}
  const strokeTargetY = bodyY + insideStrokeW / GEOMETRY_HALF_DIVISOR;
  const strokeTargetHeight = bodyHeight - insideStrokeW;
  return {
    height: strokeTargetHeight,
    key: `${key}:body-stroke`,
    kind: "rect",
    pointOwner: point,
    radius: 1,
    style: { fill: "none", stroke: fill, strokeWidth: insideStrokeW },
    width: bodyWidthPx - insideStrokeW,
    x: bodyX + insideStrokeW / GEOMETRY_HALF_DIVISOR,
    y: strokeTargetY,
  };
};

/**
 * Builds every highlight node for one mapped row (wick, body, pattern overlay, inside stroke).
 *
 * @param {Readonly<CandleHighlightRowNodesParams>} params - Mapped pixels, fill, geometry, and the row point.
 * @returns {SceneNode[]} Wick node first, then body, then overlays.
 */
const buildCandleHighlightRowNodes = (params: Readonly<CandleHighlightRowNodesParams>): SceneNode[] => {
  const { bodyWidthPx, candlePattern, cx, fill, hasOwnPattern, insideStrokeW, key, point, yClose, yHigh, yLow, yOpen } = params;
  const wickNode: SceneNode = {
    height: Math.abs(yHigh - yLow) || FLAT_EXTENT_FALLBACK_PX,
    key: `${key}:wick`,
    kind: "rect",
    pointOwner: point,
    style: { fill },
    width: WICK_WIDTH_PX,
    x: cx - WICK_WIDTH_PX / GEOMETRY_HALF_DIVISOR,
    y: Math.min(yLow, yHigh),
  };
  const bodyX = cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR;
  const bodyY = Math.min(yOpen, yClose);
  const bodyHeight = Math.abs(yClose - yOpen) || FLAT_EXTENT_FALLBACK_PX;
  const bodyNode: SceneNode = {
    height: bodyHeight,
    key: `${key}:body`,
    kind: "rect",
    pointOwner: point,
    radius: 1,
    style: { fill, stroke: fill, strokeWidth: 1 },
    width: bodyWidthPx,
    x: bodyX,
    y: bodyY,
  };
  const patternNode: SceneNode | undefined = hasOwnPattern ? {
    height: bodyHeight,
    key: `${key}:body-pattern`,
    kind: "rect",
    pointOwner: point,
    radius: 1,
    style: { fill: candlePattern.href },
    width: bodyWidthPx,
    x: bodyX,
    y: bodyY,
  } : undefined;
  const strokeNode = buildCandleHighlightStrokeNode({ bodyHeight, bodyWidthPx, bodyX, bodyY, fill, insideStrokeW, key, point });
  return [wickNode, bodyNode, ...(patternNode === undefined ? [] : [patternNode]), ...(strokeNode === undefined ? [] : [strokeNode])];
};

/**
 * Appends the hover-highlight nodes for one candle row; invalid rows append nothing.
 *
 * @param {Readonly<CandleHighlightSceneParams> & AppendCandleRowSink} params - Resolved scales, channel values, and pattern/fill inputs plus the row index and accumulators.
 * @returns {void} Nothing; appends into params.nodes and params.points.
 */
const appendCandleHighlightRow = (params: Readonly<CandleHighlightSceneParams> & AppendCandleRowSink): void => {
  const fields = readCandleHighlightFields(params);
  if (fields === undefined) {return;}
  const pixels = mapCandleHighlightPixels({ close: fields.close, date: fields.date, high: fields.high, low: fields.low, open: fields.open, scales: params.scales });
  if (pixels === undefined) {return;}
  const fillInfo = resolveCandleRowFill({ close: fields.close, negativePattern: params.negativePattern, open: fields.open, positivePattern: params.positivePattern, solidFillFor: params.solidFillFor });
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fillInfo.fill, datum: fields.datum, datumIndex: params.index, group: null, groupLabel: HOVER_HIGHLIGHT_MARK_ID, key: `hover-highlight:${params.index}`, markId: HOVER_HIGHLIGHT_MARK_ID, x: pixels.cx, xValue: fields.date, y: pixels.yClose, yValue: fields.close,
  };
  params.nodes.push(...buildCandleHighlightRowNodes({ bodyWidthPx: params.bodyWidthPx, candlePattern: fillInfo.candlePattern, cx: pixels.cx, fill: fillInfo.fill, hasOwnPattern: fillInfo.hasOwnPattern, insideStrokeW: params.insideStrokeW, key: `hover-highlight:${params.index}`, point, yClose: pixels.yClose, yHigh: pixels.yHigh, yLow: pixels.yLow, yOpen: pixels.yOpen }));
  params.points.push(point);
};

/**
 * Builds the hover-highlight scene for one render pass (mirrors wick/body geometry).
 *
 * @param {Readonly<CandleHighlightSceneParams>} params - Resolved scales, channel values, and pattern/fill inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the hover-highlight mark plus their points.
 */
const renderCandleHighlightScene = (params: Readonly<CandleHighlightSceneParams>): CandleMarkScene => {
  const { scales, source, xDataKey, xValues, lowValues, highValues, openValues, closeValues, positivePattern, negativePattern, solidFillFor, bodyWidthPx, insideStrokeW } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (let rowIndex = 0; rowIndex < source.length; rowIndex += ROW_INDEX_STEP) {
    appendCandleHighlightRow({ bodyWidthPx, closeValues, highValues, index: rowIndex, insideStrokeW, lowValues, negativePattern, nodes, openValues, points, positivePattern, scales, solidFillFor, source, xDataKey, xValues });
  }
  return { nodes, points };
};

interface CandleWicksSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
}

interface CandleWickRowFields {
  readonly close: unknown;
  readonly datum: Readonly<ChartDatum>;
  readonly date: Date;
  readonly high: number;
  readonly isPositive: boolean;
  readonly low: number;
  readonly open: unknown;
  readonly wickFill: string;
}

interface CandleWickPixelParams {
  readonly close: unknown;
  readonly date: Date;
  readonly high: number;
  readonly low: number;
  readonly open: unknown;
  readonly scales: MarkRenderContext["scales"];
}

interface CandleWickRowPixels {
  readonly bodyTargetHeight: number | undefined;
  readonly bodyTargetY: number | undefined;
  readonly cx: number;
  readonly wickTargetHeight: number;
  readonly wickTargetY: number;
  readonly yHigh: number;
}

interface CandleWickReadInput {
  readonly index: number;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

interface CandleWickRowNodesParams {
  readonly bodyTargetHeight: number | undefined;
  readonly bodyTargetY: number | undefined;
  readonly cx: number;
  readonly isPositive: boolean;
  readonly key: string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
  readonly wickFill: string;
  readonly wickTargetHeight: number;
  readonly wickTargetY: number;
}

const readCandleWickFields = (params: Readonly<CandleWickReadInput>): CandleWickRowFields | undefined => {
  const range = parseCandleRangeFields(params);
  if (range === undefined) {return undefined;}
  const datum = params.source[params.index];
  const { close, open } = datum;
  const isPositive = isNumber(close) && isNumber(open) && close >= open;
  const candlePattern = isPositive ? params.positivePattern : params.negativePattern;
  const wickFill = params.solidFillFor(isPositive, Boolean(candlePattern.href));
  return { close, date: range.date, datum, high: range.high, isPositive, low: range.low, open, wickFill };
};

/**
 * Maps one wick row through the scales; off-scale rows map nothing.
 *
 * @param {Readonly<CandleWickPixelParams>} params - Validated range plus raw open/close and resolved scales.
 * @returns {CandleWickRowPixels | undefined} Pixel coordinates and body targets, or undefined when off-scale.
 */
const mapCandleWickPixels = (params: Readonly<CandleWickPixelParams>): CandleWickRowPixels | undefined => {
  const { close, date, high, low, open, scales } = params;
  const cx = scales.x.map(date);
  const yLow = scales.y.map(low);
  const yHigh = scales.y.map(high);
  if (!Number.isFinite(cx) || !Number.isFinite(yLow) || !Number.isFinite(yHigh)) {return undefined;}
  const hasBodyValues = isFiniteNumber(open) && isFiniteNumber(close);
  const bodyTargetY = hasBodyValues ? Math.min(scales.y.map(open), scales.y.map(close)) : undefined;
  const bodyTargetHeight = hasBodyValues ? Math.abs(scales.y.map(close) - scales.y.map(open)) || FLAT_EXTENT_FALLBACK_PX : undefined;
  return { bodyTargetHeight, bodyTargetY, cx, wickTargetHeight: Math.abs(yHigh - yLow) || FLAT_EXTENT_FALLBACK_PX, wickTargetY: Math.min(yLow, yHigh), yHigh };
};

/**
 * Builds the wick-segment nodes for one mapped row, split at the body edge.
 *
 * @param {Readonly<CandleWickRowNodesParams>} params - Mapped pixels, fill/dim inputs, and the row key.
 * @returns {SceneNode[]} Upper/lower segments, or the whole wick when no body values exist.
 */
const buildCandleWickRowNodes = (params: Readonly<CandleWickRowNodesParams>): SceneNode[] => {
  const { bodyTargetHeight, bodyTargetY, cx, isPositive, key, legendDimOpacity, showTargetGeometry, wickFill, wickTargetHeight, wickTargetY } = params;
  const dimOpacity = legendDimOpacity(isPositive);
  if (bodyTargetY === undefined || bodyTargetHeight === undefined) {
    // Collapsed geometry is center-anchored, matching legacy's scaleY reveal origin.
    return buildWickSegmentNodes({ collapseY: wickTargetY + wickTargetHeight / GEOMETRY_HALF_DIVISOR, cx, dimOpacity, segKey: key, segTargetHeight: wickTargetHeight, segTargetY: wickTargetY, showTarget: showTargetGeometry, wickFill });
  }
  // Wicks split at the body edge: stacked dim opacities must not double-composite on overlap.
  const collapseY = wickTargetY + wickTargetHeight / GEOMETRY_HALF_DIVISOR;
  const bodyBottom = bodyTargetY + bodyTargetHeight;
  const wickBottom = wickTargetY + wickTargetHeight;
  return [
    ...buildWickSegmentNodes({ collapseY, cx, dimOpacity, segKey: `${key}:upper`, segTargetHeight: bodyTargetY - wickTargetY, segTargetY: wickTargetY, showTarget: showTargetGeometry, wickFill }),
    ...buildWickSegmentNodes({ collapseY, cx, dimOpacity, segKey: `${key}:lower`, segTargetHeight: wickBottom - bodyBottom, segTargetY: bodyBottom, showTarget: showTargetGeometry, wickFill }),
  ];
};

/**
 * Appends the wick-segment nodes for one candle row; invalid rows append nothing.
 *
 * @param {Readonly<CandleWicksSceneParams> & AppendCandleRowSink} params - Resolved scales, rows, and fill/dim inputs plus the row index and accumulators.
 * @returns {void} Nothing; appends into params.nodes and params.points.
 */
const appendCandleWickRow = (params: Readonly<CandleWicksSceneParams> & AppendCandleRowSink): void => {
  const fields = readCandleWickFields(params);
  if (fields === undefined) {return;}
  const pixels = mapCandleWickPixels({ close: fields.close, date: fields.date, high: fields.high, low: fields.low, open: fields.open, scales: params.scales });
  if (pixels === undefined) {return;}
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fields.wickFill, datum: fields.datum, datumIndex: params.index, group: fields.isPositive ? "positive" : "negative", groupLabel: fields.isPositive ? "positive" : "negative", key: `wicks:${params.index}`, markId: "wicks", x: pixels.cx, xValue: fields.date, y: pixels.yHigh, yValue: fields.high,
  };
  params.nodes.push(...buildCandleWickRowNodes({ bodyTargetHeight: pixels.bodyTargetHeight, bodyTargetY: pixels.bodyTargetY, cx: pixels.cx, isPositive: fields.isPositive, key: `wicks:${params.index}`, legendDimOpacity: params.legendDimOpacity, showTargetGeometry: params.showTargetGeometry, wickFill: fields.wickFill, wickTargetHeight: pixels.wickTargetHeight, wickTargetY: pixels.wickTargetY }));
  params.points.push(point);
};

/**
 * Builds the wicks scene for one render pass (wick segments split at the body edge).
 *
 * @param {Readonly<CandleWicksSceneParams>} params - Resolved scales, rows, and fill/dim inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the wicks mark plus their points.
 */
const renderCandleWicksScene = (params: Readonly<CandleWicksSceneParams>): CandleMarkScene => {
  const { scales, source, xDataKey, positivePattern, negativePattern, solidFillFor, legendDimOpacity, showTargetGeometry } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (let rowIndex = 0; rowIndex < source.length; rowIndex += ROW_INDEX_STEP) {
    appendCandleWickRow({ index: rowIndex, legendDimOpacity, negativePattern, nodes, points, positivePattern, scales, showTargetGeometry, solidFillFor, source, xDataKey });
  }
  return { nodes, points };
};

interface CandleBodiesSceneParams {
  readonly scales: MarkRenderContext["scales"];
  readonly source: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly bodyWidthPx: number;
  readonly insideStrokeW: number;
  readonly positivePattern: Readonly<CandlePatternRef>;
  readonly negativePattern: Readonly<CandlePatternRef>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly showTargetGeometry: boolean;
}

interface CandleBodyRowFields {
  readonly close: number;
  readonly datum: Readonly<ChartDatum>;
  readonly date: Date;
  readonly open: number;
}

interface CandleBodyPixelParams {
  readonly close: number;
  readonly date: Date;
  readonly open: number;
  readonly scales: MarkRenderContext["scales"];
}

interface CandleBodyRowPixels {
  readonly cx: number;
  readonly yClose: number;
  readonly yOpen: number;
}

interface CandleBodyStrokeParams {
  readonly bodyTargetHeight: number;
  readonly bodyTargetY: number;
  readonly bodyWidthPx: number;
  readonly cx: number;
  readonly dimOpacity: number | undefined;
  readonly fill: string;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly showTargetGeometry: boolean;
}

interface CandleBodyRowNodesParams {
  readonly bodyWidthPx: number;
  readonly candlePattern: Readonly<CandlePatternRef>;
  readonly cx: number;
  readonly dimOpacity: number | undefined;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly showTargetGeometry: boolean;
  readonly yClose: number;
  readonly yOpen: number;
}

/**
 * Reads one body row; invalid rows read nothing.
 *
 * @param {Readonly<CandleRowReadInput>} params - Rows plus the row index.
 * @returns {CandleBodyRowFields | undefined} Validated row fields, or undefined when the row is invalid.
 */
const readCandleBodyFields = (params: Readonly<CandleRowReadInput>): CandleBodyRowFields | undefined => {
  const datum = params.source[params.index];
  const date = datum[params.xDataKey];
  if (!(date instanceof Date)) {return undefined;}
  const { close, open } = datum;
  if (!isNumber(open) || !isNumber(close) || !areBothFinite(open, close)) {return undefined;}
  return { close, date, datum, open };
};

/**
 * Maps one body row through the scales; off-scale rows map nothing.
 *
 * @param {Readonly<CandleBodyPixelParams>} params - Validated row fields plus resolved scales.
 * @returns {CandleBodyRowPixels | undefined} Pixel coordinates, or undefined when any map is non-finite.
 */
const mapCandleBodyPixels = (params: Readonly<CandleBodyPixelParams>): CandleBodyRowPixels | undefined => {
  const { close, date, open, scales } = params;
  const cx = scales.x.map(date);
  const yOpen = scales.y.map(open);
  const yClose = scales.y.map(close);
  if (!Number.isFinite(cx) || !Number.isFinite(yOpen) || !Number.isFinite(yClose)) {return undefined;}
  return { cx, yClose, yOpen };
};

/**
 * Builds the inside-stroke node for one body row; zero widths build nothing.
 *
 * @param {Readonly<CandleBodyStrokeParams>} params - Body targets, dim opacity, and fill.
 * @returns {SceneNode | undefined} Stroke node, or undefined when the stroke width is zero.
 */
const buildCandleBodyStrokeNode = (params: Readonly<CandleBodyStrokeParams>): SceneNode | undefined => {
  const { bodyTargetHeight, bodyTargetY, bodyWidthPx, cx, dimOpacity, fill, insideStrokeW, key, showTargetGeometry } = params;
  if (insideStrokeW <= MIN_GEOMETRY_EXTENT_PX) {return undefined;}
  const strokeTargetY = bodyTargetY + insideStrokeW / GEOMETRY_HALF_DIVISOR;
  const strokeTargetHeight = bodyTargetHeight - insideStrokeW;
  return {
    className: CANDLE_CELL_CLASS_NAME,
    height: showTargetGeometry ? strokeTargetHeight : COLLAPSED_GEOMETRY_PX,
    key: `${key}:stroke`,
    kind: "rect",
    radius: 1,
    style: { fill: "none", opacity: dimOpacity, stroke: fill, strokeWidth: insideStrokeW },
    width: bodyWidthPx - insideStrokeW,
    x: cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR + insideStrokeW / GEOMETRY_HALF_DIVISOR,
    y: showTargetGeometry ? strokeTargetY : strokeTargetY + strokeTargetHeight / GEOMETRY_HALF_DIVISOR,
  };
};

/**
 * Builds every body node for one mapped row (fill, pattern overlay, inside stroke).
 *
 * @param {Readonly<CandleBodyRowNodesParams>} params - Mapped pixels plus fill/dim inputs.
 * @returns {SceneNode[]} Fill node first, then overlays.
 */
const buildCandleBodyRowNodes = (params: Readonly<CandleBodyRowNodesParams>): SceneNode[] => {
  const { bodyWidthPx, candlePattern, cx, dimOpacity, fill, hasOwnPattern, insideStrokeW, key, showTargetGeometry, yClose, yOpen } = params;
  const bodyTargetY = Math.min(yOpen, yClose);
  const bodyTargetHeight = Math.abs(yClose - yOpen) || FLAT_EXTENT_FALLBACK_PX;
  const bodyY = showTargetGeometry ? bodyTargetY : bodyTargetY + bodyTargetHeight / GEOMETRY_HALF_DIVISOR;
  const bodyHeight = showTargetGeometry ? bodyTargetHeight : COLLAPSED_GEOMETRY_PX;
  const bodyNode: SceneNode = {
    className: CANDLE_CELL_CLASS_NAME,
    height: bodyHeight,
    key,
    kind: "rect",
    radius: 1,
    style: { fill, opacity: dimOpacity, stroke: fill, strokeWidth: 1 },
    width: bodyWidthPx,
    x: cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR,
    y: bodyY,
  };
  const strokeNode = buildCandleBodyStrokeNode({ bodyTargetHeight, bodyTargetY, bodyWidthPx, cx, dimOpacity, fill, insideStrokeW, key, showTargetGeometry });
  const patternNode: SceneNode | undefined = hasOwnPattern ? {
    className: CANDLE_CELL_CLASS_NAME,
    height: bodyHeight,
    key: `${key}:pattern`,
    kind: "rect",
    radius: 1,
    style: { fill: candlePattern.href, opacity: dimOpacity },
    width: bodyWidthPx,
    x: cx - bodyWidthPx / GEOMETRY_HALF_DIVISOR,
    y: bodyY,
  } : undefined;
  return [
    bodyNode,
    ...(patternNode === undefined ? [] : [patternNode]),
    ...(strokeNode === undefined ? [] : [strokeNode]),
  ];
};

/**
 * Appends the body nodes for one candle row; invalid rows append nothing.
 *
 * @param {Readonly<CandleBodiesSceneParams> & AppendCandleRowSink} params - Resolved scales, rows, and fill/dim inputs plus the row index and accumulators.
 * @returns {void} Nothing; appends into params.nodes and params.points.
 */
const appendCandleBodyRow = (params: Readonly<CandleBodiesSceneParams> & AppendCandleRowSink): void => {
  const fields = readCandleBodyFields(params);
  if (fields === undefined) {return;}
  const pixels = mapCandleBodyPixels({ close: fields.close, date: fields.date, open: fields.open, scales: params.scales });
  if (pixels === undefined) {return;}
  const fillInfo = resolveCandleRowFill({ close: fields.close, negativePattern: params.negativePattern, open: fields.open, positivePattern: params.positivePattern, solidFillFor: params.solidFillFor });
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fillInfo.fill, datum: fields.datum, datumIndex: params.index, group: fillInfo.isPositive ? "positive" : "negative", groupLabel: fillInfo.isPositive ? "positive" : "negative", key: `bodies:${params.index}`, markId: "bodies", x: pixels.cx, xValue: fields.date, y: pixels.yClose, yValue: fields.close,
  };
  params.nodes.push(...buildCandleBodyRowNodes({ bodyWidthPx: params.bodyWidthPx, candlePattern: fillInfo.candlePattern, cx: pixels.cx, dimOpacity: params.legendDimOpacity(fillInfo.isPositive), fill: fillInfo.fill, hasOwnPattern: fillInfo.hasOwnPattern, insideStrokeW: params.insideStrokeW, key: `bodies:${params.index}`, showTargetGeometry: params.showTargetGeometry, yClose: pixels.yClose, yOpen: pixels.yOpen }));
  params.points.push(point);
};

/**
 * Builds the bodies scene for one render pass (fill, pattern overlay, inside stroke).
 *
 * @param {Readonly<CandleBodiesSceneParams>} params - Resolved scales, rows, and fill/dim inputs.
 * @returns {CandleMarkScene} Scene nodes grouped under the bodies mark plus their points.
 */
const renderCandleBodiesScene = (params: Readonly<CandleBodiesSceneParams>): CandleMarkScene => {
  const { scales, source, xDataKey, bodyWidthPx, insideStrokeW, positivePattern, negativePattern, solidFillFor, legendDimOpacity, showTargetGeometry } = params;
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (let rowIndex = 0; rowIndex < source.length; rowIndex += ROW_INDEX_STEP) {
    appendCandleBodyRow({ bodyWidthPx, index: rowIndex, insideStrokeW, legendDimOpacity, negativePattern, nodes, points, positivePattern, scales, showTargetGeometry, solidFillFor, source, xDataKey });
  }
  return { nodes, points };
};

export {
  collectCandleHighlightChannels,
  collectCandleHoverDotChannels,
  HOVER_HIGHLIGHT_MARK_ID,
  renderCandleBodiesScene,
  renderCandleHighlightScene,
  renderCandleHoverDotScene,
  renderCandleWicksScene,
};
