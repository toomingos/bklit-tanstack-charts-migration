// Candlestick wicks mark: wick geometry split at the body edge so stacked dim opacities never double-composite.
import { createMark } from "@tanstack/charts";
import type {
  ChartMark,
  ChartMarkState,
  ChartMotionDefinition,
  ChartPoint,
  MarkRenderContext,
  SceneNode,
} from "@tanstack/charts";
import { allFinite, CANDLE_CELL_CLASS_NAME, parseBodyFields, parseWickHighFields, WICK_WIDTH_PX } from "./candlestick-fields";
import type { CandleBodyFields, CandlePattern, CandleWickHighFields } from "./candlestick-fields";
import type { ChartDatum } from "./types";

interface CandleWicksMarkParams {
  source: readonly Readonly<ChartDatum>[];
  xDataKey: string;
  positivePattern: CandlePattern;
  negativePattern: CandlePattern;
  solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  legendDimOpacity: (isPositive: boolean) => number | undefined;
  showTargetGeometry: boolean;
  dimStates: readonly ChartMarkState<ChartDatum>[];
  motion: ChartMotionDefinition<ChartDatum>;
}

interface WickBodyTargets {
  readonly targetHeight: number | undefined;
  readonly targetY: number | undefined;
}

const resolveWickBodyTargets = (
  bodyRow: CandleBodyFields | null,
  scales: MarkRenderContext["scales"],
): WickBodyTargets => {
  if (bodyRow === null) {return { targetHeight: undefined, targetY: undefined };}
  const openY = scales.y.map(bodyRow.open);
  const closeY = scales.y.map(bodyRow.close);
  return { targetHeight: Math.abs(closeY - openY) || 1, targetY: Math.min(openY, closeY) };
};

interface WickPixels {
  readonly bodyTargetHeight: number | undefined;
  readonly bodyTargetY: number | undefined;
  readonly cx: number;
  readonly date: Date;
  readonly high: number;
  readonly wickTargetHeight: number;
  readonly wickTargetY: number;
  readonly yHigh: number;
}

const resolveWickPixels = (
  highRow: CandleWickHighFields | null,
  bodyRow: CandleBodyFields | null,
  scales: MarkRenderContext["scales"],
): WickPixels | undefined => {
  if (highRow === null) {return undefined;}
  const [cx, yLow, yHigh] = [scales.x.map(highRow.date), scales.y.map(highRow.low), scales.y.map(highRow.high)];
  if (!allFinite([cx, yLow, yHigh])) {return undefined;}
  const bodyTargets = resolveWickBodyTargets(bodyRow, scales);
  return {
    bodyTargetHeight: bodyTargets.targetHeight,
    bodyTargetY: bodyTargets.targetY,
    cx,
    date: highRow.date,
    high: highRow.high,
    wickTargetHeight: Math.abs(yHigh - yLow) || 1,
    wickTargetY: Math.min(yLow, yHigh),
    yHigh,
  };
};

interface WickSegmentOptions {
  readonly collapseY: number;
  readonly cx: number;
  readonly fill: string;
  readonly legendOpacity: number | undefined;
  readonly segKey: string;
  readonly segTargetHeight: number;
  readonly segTargetY: number;
  readonly showTargetGeometry: boolean;
}

const buildWickSegmentNode = (options: Readonly<WickSegmentOptions>): SceneNode | undefined => {
  const { collapseY, cx, fill, legendOpacity, segKey, segTargetHeight, segTargetY, showTargetGeometry } = options;
  if (segTargetHeight <= 0) {return undefined;}
  const collapsedY = Math.min(Math.max(collapseY, segTargetY), segTargetY + segTargetHeight);
  return {
    className: CANDLE_CELL_CLASS_NAME,
    height: showTargetGeometry ? segTargetHeight : 0,
    key: segKey,
    kind: "rect",
    style: { fill, opacity: legendOpacity },
    width: WICK_WIDTH_PX,
    x: cx - WICK_WIDTH_PX / 2,
    y: showTargetGeometry ? segTargetY : collapsedY,
  };
};

interface WickSegmentsOptions {
  readonly bodyTargetHeight: number | undefined;
  readonly bodyTargetY: number | undefined;
  readonly collapseY: number;
  readonly cx: number;
  readonly fill: string;
  readonly key: string;
  readonly legendOpacity: number | undefined;
  readonly showTargetGeometry: boolean;
  readonly wickTargetHeight: number;
  readonly wickTargetY: number;
}

const collectWickSegmentNodes = (options: Readonly<WickSegmentsOptions>): SceneNode[] => {
  const { bodyTargetHeight, bodyTargetY, collapseY, cx, fill, key, legendOpacity, showTargetGeometry, wickTargetHeight, wickTargetY } = options;
  const shared = { collapseY, cx, fill, legendOpacity, showTargetGeometry };
  if (bodyTargetY !== undefined && bodyTargetHeight !== undefined) {
    const bodyBottom = bodyTargetY + bodyTargetHeight;
    const wickBottom = wickTargetY + wickTargetHeight;
    const upper = buildWickSegmentNode({ ...shared, segKey: `${key}:upper`, segTargetHeight: bodyTargetY - wickTargetY, segTargetY: wickTargetY });
    const lower = buildWickSegmentNode({ ...shared, segKey: `${key}:lower`, segTargetHeight: wickBottom - bodyBottom, segTargetY: bodyBottom });
    return [upper, lower].filter((node): node is SceneNode => node !== undefined);
  }
  const whole = buildWickSegmentNode({ ...shared, segKey: key, segTargetHeight: wickTargetHeight, segTargetY: wickTargetY });
  return whole === undefined ? [] : [whole];
};

interface WickDatumOptions {
  readonly bodyRow: CandleBodyFields | null;
  readonly datum: Readonly<ChartDatum>;
  readonly index: number;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly negativePattern: CandlePattern;
  readonly pixels: Readonly<WickPixels>;
  readonly positivePattern: CandlePattern;
  readonly showTargetGeometry: boolean;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface WickDatumScene {
  readonly nodes: SceneNode[];
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

const buildWickDatumScene = (options: Readonly<WickDatumOptions>): WickDatumScene => {
  const { bodyRow, datum, index, legendDimOpacity, negativePattern, pixels, positivePattern, showTargetGeometry, solidFillFor } = options;
  const isPositive = bodyRow !== null && bodyRow.close >= bodyRow.open;
  const candlePattern = isPositive ? positivePattern : negativePattern;
  const wickFill = solidFillFor(isPositive, Boolean(candlePattern.href));
  const key = `wicks:${index}`;
  return {
    nodes: collectWickSegmentNodes({
      bodyTargetHeight: pixels.bodyTargetHeight,
      bodyTargetY: pixels.bodyTargetY,
      collapseY: pixels.wickTargetY + pixels.wickTargetHeight / 2,
      cx: pixels.cx,
      fill: wickFill,
      key,
      legendOpacity: legendDimOpacity(isPositive),
      showTargetGeometry,
      wickTargetHeight: pixels.wickTargetHeight,
      wickTargetY: pixels.wickTargetY,
    }),
    point: {
      color: wickFill, datum, datumIndex: index, group: isPositive ? "positive" : "negative",
      groupLabel: isPositive ? "positive" : "negative", key, markId: "wicks",
      x: pixels.cx, xValue: pixels.date, y: pixels.yHigh, yValue: pixels.high,
    },
  };
};

/**
 * Wick geometry, split at the body edge so stacked dim opacities never double-composite.
 *
 * @param {Readonly<CandleWicksMarkParams>} params - Row data, pattern/fill/dim inputs, and the shared candle motion definition.
 * @returns {ChartMark<ChartDatum, Date, number>} The `createMark`-built wicks mark.
 */
const createCandlestickWicksMark = (
  params: Readonly<CandleWicksMarkParams>,
): ChartMark<ChartDatum, Date, number> => {
  const {
    source, xDataKey, positivePattern, negativePattern, solidFillFor,
    legendDimOpacity, showTargetGeometry, dimStates, motion,
  } = params;
  return createMark(() => {
    const highRows = source.map((datum) => parseWickHighFields(datum, xDataKey));
    const bodyRows = source.map((datum) => parseBodyFields(datum, xDataKey));
    return {
      channels: {
        x: { scale: "x", values: highRows.map((row) => row?.date ?? undefined) },
        y: {
          scale: "y",
          values: highRows.flatMap((row) => (row ? [row.low, row.high] : [])),
        },
      },
      id: "wicks",
      render: ({ scales }) => {
        const nodes: SceneNode[] = [];
        const points: ChartPoint<ChartDatum, Date, number>[] = [];
        for (const [index, datum] of source.entries()) {
          const pixels = resolveWickPixels(highRows[index], bodyRows[index], scales);
          if (pixels !== undefined) {
            const scene = buildWickDatumScene({
              bodyRow: bodyRows[index],
              datum,
              index,
              legendDimOpacity,
              negativePattern,
              pixels,
              positivePattern,
              showTargetGeometry,
              solidFillFor,
            });
            nodes.push(...scene.nodes);
            points.push(scene.point);
          }
        }
        return {
          nodes: [{ ariaHidden: true, children: nodes, className: "bkm-chart__candle", key: "wicks", kind: "group" }],
          points,
        };
      },
      states: dimStates.length > 0 ? { data: source, definitions: dimStates } : undefined,
    };
  }, motion);
};

export type {
  CandleWicksMarkParams,
};
export {
  createCandlestickWicksMark,
};
