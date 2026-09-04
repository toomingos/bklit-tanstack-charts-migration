import type { ChartPoint, SceneNode } from "@tanstack/charts";
import { computeSquareColumn } from "./bar-squares-layout";
import type { ChartDatum } from "./types";

// Typeof checks live only in the predicate below; call sites use the guard.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

interface SquareYScale {
  readonly map: (value: number) => number;
}

interface SquareDatumMetrics {
  readonly datum: Readonly<ChartDatum>;
  readonly xValue: string;
  readonly yValue: number;
  readonly barLengthPx: number;
}

interface SquareDatumMetricsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly index: number;
  readonly baseline: number;
  readonly yScale: SquareYScale;
}

interface SquareBarLengthParams {
  readonly yScale: SquareYScale;
  readonly baseline: number;
  readonly yValue: number;
}

const resolveSquareBarLength = (params: Readonly<SquareBarLengthParams>): number | undefined => {
  const valuePos = params.yScale.map(params.yValue);
  if (!Number.isFinite(valuePos)) {return undefined;}
  const barLengthPx = params.baseline - valuePos;
  if (barLengthPx <= 0) {return undefined;}
  return barLengthPx;
}

const resolveSquareDatumMetrics = (params: Readonly<SquareDatumMetricsParams>): SquareDatumMetrics | undefined => {
  const datum = params.data[params.index];
  const xValue = params.xValues[params.index];
  const yValue = params.yValues[params.index];
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue <= 0) {return undefined;}
  const barLengthPx = resolveSquareBarLength({ baseline: params.baseline, yScale: params.yScale, yValue });
  if (barLengthPx === undefined) {return undefined;}
  return { barLengthPx, datum, xValue, yValue };
}

type ComputedSquareColumn = ReturnType<typeof computeSquareColumn>;

interface SquareColumnPlacement {
  readonly x: number;
  readonly columnTop: number;
  readonly layout: ComputedSquareColumn;
}

interface SquareColumnPlacementParams {
  readonly metrics: Readonly<SquareDatumMetrics>;
  readonly bandPos: (categoryLabel: string) => number;
  readonly seriesIndex: number;
  readonly squareSize: number;
  readonly effectiveGroupGap: number;
  readonly squareFit: boolean;
  readonly squareGap: number;
  readonly baseline: number;
}

const resolveSquareColumnPlacement = (params: Readonly<SquareColumnPlacementParams>): SquareColumnPlacement | undefined => {
  const layout = computeSquareColumn({ barLengthPx: params.metrics.barLengthPx, fit: params.squareFit, gap: params.squareGap, squareSize: params.squareSize });
  if (layout.count === 0) {return undefined;}
  const columnTop = params.baseline - layout.columnHeight;
  const bandStart = params.bandPos(params.metrics.xValue);
  const x = bandStart + params.seriesIndex * (params.squareSize + params.effectiveGroupGap);
  return { columnTop, layout, x };
}

interface AppendSquaresParams {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
  readonly datum: Readonly<ChartDatum>;
  readonly index: number;
  readonly id: string;
  readonly xValue: string;
  readonly yValue: number;
  readonly x: number;
  readonly columnTop: number;
  readonly layout: ComputedSquareColumn;
  readonly squareSize: number;
  readonly rx: number;
  readonly effectiveFill: string;
  readonly fill: string;
  readonly opacity: number | undefined;
}

const appendSquaresForDatum = (params: Readonly<AppendSquaresParams>): void => {
  for (let squareIndex = 0; squareIndex < params.layout.count; squareIndex += 1) {
    const relY = params.layout.positions[squareIndex];
    const squareY = params.columnTop + relY;
    const key = `${params.id}:sq:${params.index}:${squareIndex}`;
    params.nodes.push({
      height: params.squareSize,
      key,
      kind: "rect",
      radius: params.rx || undefined,
      style: { fill: params.effectiveFill, opacity: params.opacity },
      width: params.squareSize,
      x: params.x,
      y: squareY,
    });
    if (squareIndex === 0) {
      const xCenter = params.x + params.squareSize / 2;
      const yCenter = squareY + params.squareSize / 2;
      params.points.push({
        color: params.fill,
        datum: params.datum,
        datumIndex: params.index,
        group: params.id,
        groupLabel: params.id,
        // Point key is a `:`-boundary prefix of the square rect keys for prefix-based point ownership.
        key: `${params.id}:sq:${params.index}`,
        markId: params.id,
        x: xCenter,
        xValue: params.xValue,
        y: yCenter,
        yValue: params.yValue,
      });
    }
  }
}

interface SquareSceneParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly baseline: number;
  readonly yScale: SquareYScale;
  readonly id: string;
  readonly seriesIndex: number;
  readonly squareSize: number;
  readonly effectiveGroupGap: number;
  readonly bandPos: (categoryLabel: string) => number;
  readonly bandWidth: number;
  readonly squareFit: boolean;
  readonly squareGap: number;
  readonly rx: number;
  readonly effectiveFill: string;
  readonly fill: string;
  readonly opacity: number | undefined;
}

interface SquareScene {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
}

interface DegenerateSquarePointParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly index: number;
  readonly id: string;
  readonly fill: string;
  readonly bandPos: (categoryLabel: string) => number;
  readonly bandWidth: number;
  readonly yScale: SquareYScale;
}

// Degenerate-column focus proxy: bands narrower than the group gap paint no
// Squares, so each column emits a focus-only point (no nodes, pixels unchanged).
const appendDegenerateSquarePoint = (params: Readonly<DegenerateSquarePointParams>, points: ChartPoint<ChartDatum, string, number>[]): void => {
  const yValue = params.yValues[params.index];
  if (!Number.isFinite(yValue)) {return;}
  const mappedY = params.yScale.map(yValue);
  if (!Number.isFinite(mappedY)) {return;}
  const xValue = params.xValues[params.index];
  const centerX = params.bandWidth > 0 ? params.bandPos(xValue) + params.bandWidth / 2 : params.bandPos(xValue);
  points.push({
    color: params.fill,
    datum: params.data[params.index],
    datumIndex: params.index,
    group: params.id,
    groupLabel: params.id,
    // Same `:`-boundary prefix convention as painted squares for point ownership.
    key: `${params.id}:sq:${params.index}`,
    markId: params.id,
    x: centerX,
    xValue,
    y: mappedY,
    yValue,
  });
};

const buildSquareScene = (params: Readonly<SquareSceneParams>): SquareScene => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, string, number>[] = [];
  const degenerate = params.squareSize <= 0;
  for (let i = 0; i < params.data.length; i += 1) {
    const metrics = resolveSquareDatumMetrics({ baseline: params.baseline, data: params.data, index: i, xValues: params.xValues, yScale: params.yScale, yValues: params.yValues });
    const placement = metrics === undefined ? undefined : resolveSquareColumnPlacement({ bandPos: params.bandPos, baseline: params.baseline, effectiveGroupGap: params.effectiveGroupGap, metrics, seriesIndex: params.seriesIndex, squareFit: params.squareFit, squareGap: params.squareGap, squareSize: params.squareSize });
    if (placement !== undefined && metrics !== undefined) {
      appendSquaresForDatum({ columnTop: placement.columnTop, datum: metrics.datum, effectiveFill: params.effectiveFill, fill: params.fill, id: params.id, index: i, layout: placement.layout, nodes, opacity: params.opacity, points, rx: params.rx, squareSize: params.squareSize, x: placement.x, xValue: metrics.xValue, yValue: metrics.yValue });
    } else if (placement === undefined && degenerate) {
      appendDegenerateSquarePoint({ bandPos: params.bandPos, bandWidth: params.bandWidth, data: params.data, fill: params.fill, id: params.id, index: i, xValues: params.xValues, yScale: params.yScale, yValues: params.yValues }, points);
    } else {
      // Healthy geometry with a non-positive value paints nothing by design.
    }
  }
  return { nodes, points };
}

export {
  buildSquareScene,
};
export type { SquareSceneParams };
