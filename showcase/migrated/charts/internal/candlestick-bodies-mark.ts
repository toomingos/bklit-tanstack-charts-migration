// Candlestick bodies mark: body geometry (fill, optional pattern overlay,
// Optional inside stroke).
import { createMark } from "@tanstack/charts";
import type {
  ChartMark,
  ChartMarkState,
  ChartMotionDefinition,
  ChartPoint,
  MarkRenderContext,
  SceneNode,
} from "@tanstack/charts";
import { allFinite, CANDLE_BODY_RADIUS, CANDLE_CELL_CLASS_NAME, parseBodyFields } from "./candlestick-fields";
import type { CandleBodyFields, CandlePattern } from "./candlestick-fields";
import type { ChartDatum } from "./types";

interface CandleBodiesMarkParams {
  source: readonly Readonly<ChartDatum>[];
  xDataKey: string;
  bodyWidthPx: number;
  insideStrokeW: number;
  positivePattern: CandlePattern;
  negativePattern: CandlePattern;
  solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
  legendDimOpacity: (isPositive: boolean) => number | undefined;
  showTargetGeometry: boolean;
  dimStates: readonly ChartMarkState<ChartDatum>[];
  motion: ChartMotionDefinition<ChartDatum>;
}

interface BodyPixels {
  readonly cx: number;
  readonly yClose: number;
  readonly yOpen: number;
}

interface ResolvedBodyRow {
  readonly pixels: BodyPixels;
  readonly row: CandleBodyFields;
}

const resolveBodyRow = (
  row: CandleBodyFields | null,
  scales: MarkRenderContext["scales"],
): ResolvedBodyRow | undefined => {
  if (row === null) {return undefined;}
  const [cx, yOpen, yClose] = [scales.x.map(row.date), scales.y.map(row.open), scales.y.map(row.close)];
  if (!allFinite([cx, yOpen, yClose])) {return undefined;}
  return { pixels: { cx, yClose, yOpen }, row };
};

interface BodyStrokeNodeOptions {
  readonly bodyTargetHeight: number;
  readonly bodyTargetY: number;
  readonly bodyWidthPx: number;
  readonly cx: number;
  readonly fill: string;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly legendOpacity: number | undefined;
  readonly showTargetGeometry: boolean;
}

const buildBodyStrokeNode = (options: Readonly<BodyStrokeNodeOptions>): SceneNode => {
  const { bodyTargetHeight, bodyTargetY, bodyWidthPx, cx, fill, insideStrokeW, key, legendOpacity, showTargetGeometry } = options;
  const strokeTargetY = bodyTargetY + insideStrokeW / 2;
  const strokeTargetHeight = bodyTargetHeight - insideStrokeW;
  return {
    className: CANDLE_CELL_CLASS_NAME,
    height: showTargetGeometry ? strokeTargetHeight : 0,
    key: `${key}:stroke`,
    kind: "rect",
    radius: CANDLE_BODY_RADIUS,
    style: { fill: "none", opacity: legendOpacity, stroke: fill, strokeWidth: insideStrokeW },
    width: bodyWidthPx - insideStrokeW,
    x: cx - bodyWidthPx / 2 + insideStrokeW / 2,
    y: showTargetGeometry ? strokeTargetY : strokeTargetY + strokeTargetHeight / 2,
  };
};

interface BodyNodesOptions {
  readonly bodyWidthPx: number;
  readonly fill: string;
  readonly hasOwnPattern: boolean;
  readonly insideStrokeW: number;
  readonly key: string;
  readonly legendOpacity: number | undefined;
  readonly patternHref: string;
  readonly pixels: Readonly<BodyPixels>;
  readonly showTargetGeometry: boolean;
}

const buildBodyNodes = (options: Readonly<BodyNodesOptions>): SceneNode[] => {
  const { bodyWidthPx, fill, hasOwnPattern, insideStrokeW, key, legendOpacity, patternHref, pixels, showTargetGeometry } = options;
  const bodyTargetY = Math.min(pixels.yOpen, pixels.yClose);
  const bodyTargetHeight = Math.abs(pixels.yClose - pixels.yOpen) || 1;
  const nodes: SceneNode[] = [
    {
      className: CANDLE_CELL_CLASS_NAME,
      height: showTargetGeometry ? bodyTargetHeight : 0,
      key,
      kind: "rect",
      radius: CANDLE_BODY_RADIUS,
      style: { fill, opacity: legendOpacity, stroke: fill, strokeWidth: 1 },
      width: bodyWidthPx,
      x: pixels.cx - bodyWidthPx / 2,
      y: showTargetGeometry ? bodyTargetY : bodyTargetY + bodyTargetHeight / 2,
    },
  ];
  if (hasOwnPattern) {
    nodes.push({
      className: CANDLE_CELL_CLASS_NAME,
      height: showTargetGeometry ? bodyTargetHeight : 0,
      key: `${key}:pattern`,
      kind: "rect",
      radius: CANDLE_BODY_RADIUS,
      style: { fill: patternHref, opacity: legendOpacity },
      width: bodyWidthPx,
      x: pixels.cx - bodyWidthPx / 2,
      y: showTargetGeometry ? bodyTargetY : bodyTargetY + bodyTargetHeight / 2,
    });
  }
  if (insideStrokeW > 0) {
    nodes.push(buildBodyStrokeNode({
      bodyTargetHeight,
      bodyTargetY,
      bodyWidthPx,
      cx: pixels.cx,
      fill,
      insideStrokeW,
      key,
      legendOpacity,
      showTargetGeometry,
    }));
  }
  return nodes;
};

interface BodyDatumOptions {
  readonly bodyWidthPx: number;
  readonly datum: Readonly<ChartDatum>;
  readonly index: number;
  readonly insideStrokeW: number;
  readonly legendDimOpacity: (isPositive: boolean) => number | undefined;
  readonly negativePattern: CandlePattern;
  readonly positivePattern: CandlePattern;
  readonly resolved: Readonly<ResolvedBodyRow>;
  readonly showTargetGeometry: boolean;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface BodyDatumScene {
  readonly nodes: SceneNode[];
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

const buildBodyDatumScene = (options: Readonly<BodyDatumOptions>): BodyDatumScene => {
  const { bodyWidthPx, datum, index, insideStrokeW, legendDimOpacity, negativePattern, positivePattern, resolved, showTargetGeometry, solidFillFor } = options;
  const { pixels, row } = resolved;
  const isPositive = row.close >= row.open;
  const candlePattern = isPositive ? positivePattern : negativePattern;
  const hasOwnPattern = Boolean(candlePattern.href);
  const fill = solidFillFor(isPositive, hasOwnPattern);
  const key = `bodies:${index}`;
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: fill, datum, datumIndex: index, group: isPositive ? "positive" : "negative",
    groupLabel: isPositive ? "positive" : "negative", key, markId: "bodies",
    x: pixels.cx, xValue: row.date, y: pixels.yClose, yValue: row.close,
  };
  return {
    nodes: buildBodyNodes({
      bodyWidthPx,
      fill,
      hasOwnPattern,
      insideStrokeW,
      key,
      legendOpacity: legendDimOpacity(isPositive),
      patternHref: candlePattern.href,
      pixels,
      showTargetGeometry,
    }),
    point,
  };
};

/**
 * Body geometry (fill, optional pattern overlay, optional inside stroke).
 *
 * @param {Readonly<CandleBodiesMarkParams>} params - Row data, pattern/fill/dim inputs, and the shared candle motion definition.
 * @returns {ChartMark<ChartDatum, Date, number>} The `createMark`-built bodies mark.
 */
const createCandlestickBodiesMark = (
  params: Readonly<CandleBodiesMarkParams>,
): ChartMark<ChartDatum, Date, number> => {
  const {
    source, xDataKey, bodyWidthPx, insideStrokeW, positivePattern, negativePattern,
    solidFillFor, legendDimOpacity, showTargetGeometry, dimStates, motion,
  } = params;
  return createMark(() => {
    const rows = source.map((datum) => parseBodyFields(datum, xDataKey));
    return {
      channels: {
          x: { scale: "x", values: rows.map((row) => row?.date) },
        y: {
          scale: "y",
          values: rows.flatMap((row) => (row ? [row.open, row.close] : [])),
        },
      },
      id: "bodies",
      render: ({ scales }) => {
        const nodes: SceneNode[] = [];
        const points: ChartPoint<ChartDatum, Date, number>[] = [];
        for (const [index, datum] of source.entries()) {
          const resolved = resolveBodyRow(rows[index], scales);
          if (resolved !== undefined) {
            const scene = buildBodyDatumScene({
              bodyWidthPx,
              datum,
              index,
              insideStrokeW,
              legendDimOpacity,
              negativePattern,
              positivePattern,
              resolved,
              showTargetGeometry,
              solidFillFor,
            });
            nodes.push(...scene.nodes);
            points.push(scene.point);
          }
        }
        return {
          nodes: [{ ariaHidden: true, children: nodes, className: "bkm-chart__candle", key: "bodies", kind: "group" }],
          points,
        };
      },
      states: dimStates.length > 0 ? { data: source, definitions: dimStates } : undefined,
    };
  }, motion);
};

export type {
  CandleBodiesMarkParams,
};
export {
  createCandlestickBodiesMark,
};
