// Candlestick hover-highlight mark: wick/body geometry mirrored exactly with no dim
// States; it snaps, never springs. Keyed by row index.
import type {
  ChartMark,
  ChartPoint,
  MarkRenderContext,
  SceneNode,
} from "@tanstack/charts";
import { allFinite, CANDLE_BODY_RADIUS, HOVER_HIGHLIGHT_ID, parseAllFields, WICK_WIDTH_PX } from "./candlestick-fields";
import type { CandleAllFields, CandlePattern } from "./candlestick-fields";
import type { ChartDatum } from "./types";

interface CandleHighlightMarkParams {
  source: readonly Readonly<ChartDatum>[];
  xDataKey: string;
  bodyWidthPx: number;
  insideStrokeW: number;
  positivePattern: CandlePattern;
  negativePattern: CandlePattern;
  solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface HighlightPixels {
  readonly bodyHeight: number;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly cx: number;
  readonly yClose: number;
  readonly yHigh: number;
  readonly yLow: number;
}

interface MapHighlightPixelsOptions {
  readonly bodyWidthPx: number;
  readonly row: Readonly<CandleAllFields>;
  readonly scales: MarkRenderContext["scales"];
}

const mapHighlightPixels = (options: Readonly<MapHighlightPixelsOptions>): HighlightPixels | undefined => {
  const { bodyWidthPx, row, scales } = options;
  const [cx, yLow, yHigh, yOpen, yClose] = [scales.x.map(row.date), scales.y.map(row.low), scales.y.map(row.high), scales.y.map(row.open), scales.y.map(row.close)];
  if (!allFinite([cx, yLow, yHigh, yOpen, yClose])) {return undefined;}
  const bodyX = cx - bodyWidthPx / 2;
  const bodyY = Math.min(yOpen, yClose);
  return { bodyHeight: Math.abs(yClose - yOpen) || 1, bodyX, bodyY, cx, yClose, yHigh, yLow };
};

interface HighlightWickNodeOptions {
  readonly fill: string;
  readonly key: string;
  readonly pixels: Readonly<HighlightPixels>;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

const buildHighlightWickNode = (options: Readonly<HighlightWickNodeOptions>): SceneNode => {
  const { fill, key, pixels, point } = options;
  return {
    height: Math.abs(pixels.yHigh - pixels.yLow) || 1,
    key: `${key}:wick`,
    kind: "rect",
    pointOwner: point,
    style: { fill },
    width: WICK_WIDTH_PX,
    x: pixels.cx - WICK_WIDTH_PX / 2,
    y: Math.min(pixels.yLow, pixels.yHigh),
  };
};

interface HighlightNodesOptions {
  readonly bodyWidthPx: number;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly patternHref: string;
  readonly pixels: Readonly<HighlightPixels>;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

const buildHighlightNodes = (options: Readonly<HighlightNodesOptions>): SceneNode[] => {
  const { bodyWidthPx, fill, hasOwnPattern, insideStrokeW, key, patternHref, pixels, point } = options;
  const nodes: SceneNode[] = [
    buildHighlightWickNode({ fill, key, pixels, point }),
    {
      height: pixels.bodyHeight,
      key: `${key}:body`,
      kind: "rect",
      pointOwner: point,
      radius: CANDLE_BODY_RADIUS,
      style: { fill, stroke: fill, strokeWidth: 1 },
      width: bodyWidthPx,
      x: pixels.bodyX,
      y: pixels.bodyY,
    },
  ];
  if (hasOwnPattern) {
    nodes.push({
      height: pixels.bodyHeight,
      key: `${key}:body-pattern`,
      kind: "rect",
      pointOwner: point,
      radius: CANDLE_BODY_RADIUS,
      style: { fill: patternHref },
      width: bodyWidthPx,
      x: pixels.bodyX,
      y: pixels.bodyY,
    });
  }
  if (insideStrokeW > 0) {
    nodes.push({
      height: pixels.bodyHeight - insideStrokeW,
      key: `${key}:body-stroke`,
      kind: "rect",
      pointOwner: point,
      radius: CANDLE_BODY_RADIUS,
      style: { fill: "none", stroke: fill, strokeWidth: insideStrokeW },
      width: bodyWidthPx - insideStrokeW,
      x: pixels.bodyX + insideStrokeW / 2,
      y: pixels.bodyY + insideStrokeW / 2,
    });
  }
  return nodes;
};

interface HighlightFramingOptions {
  readonly index: number;
  readonly negativePattern: CandlePattern;
  readonly positivePattern: CandlePattern;
  readonly row: Readonly<CandleAllFields>;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface HighlightFraming {
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly key: string;
  readonly patternHref: string;
}

const resolveHighlightFraming = (options: Readonly<HighlightFramingOptions>): HighlightFraming => {
  const { index, negativePattern, positivePattern, row, solidFillFor } = options;
  const isPositive = row.close >= row.open;
  const candlePattern = isPositive ? positivePattern : negativePattern;
  const hasOwnPattern = Boolean(candlePattern.href);
  return {
    fill: solidFillFor(isPositive, hasOwnPattern),
    hasOwnPattern,
    key: `${HOVER_HIGHLIGHT_ID}:${index}`,
    patternHref: candlePattern.href,
  };
};

interface HighlightDatumOptions {
  readonly bodyWidthPx: number;
  readonly datum: Readonly<ChartDatum>;
  readonly index: number;
  readonly insideStrokeW: number;
  readonly negativePattern: CandlePattern;
  readonly positivePattern: CandlePattern;
  readonly row: CandleAllFields | undefined;
  readonly scales: MarkRenderContext["scales"];
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface HighlightEntry {
  readonly nodes: SceneNode[];
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

const buildHighlightEntry = (options: Readonly<HighlightDatumOptions>): HighlightEntry | undefined => {
  const { bodyWidthPx, datum, index, insideStrokeW, negativePattern, positivePattern, row, scales, solidFillFor } = options;
  if (row === undefined) {return undefined;}
  const pixels = mapHighlightPixels({ bodyWidthPx, row, scales });
  if (pixels === undefined) {return undefined;}
  const framing = resolveHighlightFraming({ index, negativePattern, positivePattern, row, solidFillFor });
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: framing.fill,
    datum,
    datumIndex: index,
    group: null,
    groupLabel: HOVER_HIGHLIGHT_ID,
    key: framing.key,
    markId: HOVER_HIGHLIGHT_ID,
    x: pixels.cx,
    xValue: row.date,
    y: pixels.yClose,
    yValue: row.close,
  };
  return {
    nodes: buildHighlightNodes({
      bodyWidthPx,
      fill: framing.fill,
      hasOwnPattern: framing.hasOwnPattern,
      insideStrokeW,
      key: framing.key,
      patternHref: framing.patternHref,
      pixels,
      point,
    }),
    point,
  };
};

/**
 * Highlight mark mirrors wick/body geometry exactly with no dim states; it snaps, never springs.
 *
 * @param {Readonly<CandleHighlightMarkParams>} params - Row data plus the same geometry/pattern inputs the wick and body marks use.
 * @returns {ChartMark<ChartDatum, Date, number>} The hover-highlight mark, keyed by row index.
 */
const createCandlestickHighlightMark = (
  params: Readonly<CandleHighlightMarkParams>,
): ChartMark<ChartDatum, Date, number> => {
  const { source, xDataKey, bodyWidthPx, insideStrokeW, positivePattern, negativePattern, solidFillFor } = params;
  return {
    initialize: () => {
      const rows = source.map((datum) => parseAllFields(datum, xDataKey));
      return {
        channels: {
          x: { scale: "x", values: rows.map((row) => row?.date ?? undefined) },
          y: {
            scale: "y",
            values: rows.flatMap((row) => (row ? [row.low, row.high, row.open, row.close] : [])),
          },
        },
        id: HOVER_HIGHLIGHT_ID,
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          for (const [index, datum] of source.entries()) {
            const entry = buildHighlightEntry({
              bodyWidthPx,
              datum,
              index,
              insideStrokeW,
              negativePattern,
              positivePattern,
              row: rows[index],
              scales,
              solidFillFor,
            });
            if (entry !== undefined) {
              nodes.push(...entry.nodes);
              points.push(entry.point);
            }
          }
          return {
            nodes: [
              // App-owned mark groups use the bkm-chart__ prefix, not ts-chart__.
              { ariaHidden: true, children: nodes, className: "bkm-chart__candle-highlight", key: HOVER_HIGHLIGHT_ID, kind: "group" },
            ],
            points,
          };
        },
      };
    },
  };
};

export type {
  CandleHighlightMarkParams,
};
export {
  createCandlestickHighlightMark,
};
