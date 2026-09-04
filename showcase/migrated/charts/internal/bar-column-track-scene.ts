import type { ChartPoint, SceneNode } from "@tanstack/charts";
import { computeSquareColumn } from "./bar-squares-layout";
import type { ChartDatum } from "./types";

// Sparse input arrays can hold holes at an in-bounds index; the nullable return
// Keeps the absence guard below a genuine check instead of a dead comparison.
const valueAt = <Value>(values: readonly Value[], index: number): Value | undefined => values[index];

const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

interface BarColumnTrackRenderContext {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly id: string;
  readonly seriesIndex: number;
  readonly squareSize: number;
  readonly effectiveGroupGap: number;
  readonly bandPos: (categoryLabel: string) => number;
  readonly fill: string;
  readonly opacity: number;
  readonly rx: number;
  readonly squareFit: boolean;
  readonly squareGap: number;
  readonly baseline: number;
  readonly topY: number;
  readonly mapY: (value: number) => number;
}

interface BarColumnTrackSceneParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly id: string;
  readonly seriesIndex: number;
  readonly squareSize: number;
  readonly effectiveGroupGap: number;
  readonly bandPos: (categoryLabel: string) => number;
  readonly fill: string;
  readonly opacity: number;
  readonly rx: number;
  readonly squareFit: boolean;
  readonly squareGap: number;
  readonly baseline: number;
  readonly topY: number;
  readonly mapY: (value: number) => number;
}

interface BarColumnTrackRowResult {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, string, number>;
}

interface BarColumnTrackSceneResult {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
}

interface TrackDatum {
  readonly datum: Readonly<ChartDatum>;
  readonly xValue: string;
  readonly yValue: number;
}

interface TrackGeometry {
  readonly columnHeight: number;
}

const resolveTrackDatum = (context: BarColumnTrackRenderContext, datumIndex: number): TrackDatum | undefined => {
  const datum = valueAt(context.data, datumIndex);
  const xValue = valueAt(context.xValues, datumIndex);
  if (datum === undefined || xValue === undefined) {return undefined;}
  const yValue = context.yValues[datumIndex];
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue <= 0) {return undefined;}
  return { datum, xValue, yValue };
}

const resolveTrackGeometry = (context: BarColumnTrackRenderContext, yValue: number): TrackGeometry | undefined => {
  const valuePos = context.mapY(yValue);
  if (!Number.isFinite(valuePos)) {return undefined;}
  const barLengthPx = context.baseline - valuePos;
  if (barLengthPx <= 0) {return undefined;}
  const layout = computeSquareColumn({ barLengthPx, fit: context.squareFit, gap: context.squareGap, squareSize: context.squareSize });
  if (layout.count === 0) {return undefined;}
  return { columnHeight: layout.columnHeight };
}

const resolveTrackHeight = (context: BarColumnTrackRenderContext, columnHeight: number): number | undefined => {
  const trackHeight = Math.max(0, context.baseline - columnHeight - context.topY);
  if (trackHeight <= 0) {return undefined;}
  return trackHeight;
}

interface TrackRow {
  readonly datum: Readonly<ChartDatum>;
  readonly xValue: string;
  readonly yValue: number;
  readonly trackHeight: number;
}

const resolveTrackRow = (context: BarColumnTrackRenderContext, datumIndex: number): TrackRow | undefined => {
  const resolved = resolveTrackDatum(context, datumIndex);
  if (!resolved) {return undefined;}
  const geometry = resolveTrackGeometry(context, resolved.yValue);
  if (!geometry) {return undefined;}
  const trackHeight = resolveTrackHeight(context, geometry.columnHeight);
  if (trackHeight === undefined) {return undefined;}
  return { datum: resolved.datum, trackHeight, xValue: resolved.xValue, yValue: resolved.yValue };
}

const renderBarColumnTrackRow = (context: BarColumnTrackRenderContext, datumIndex: number): BarColumnTrackRowResult | undefined => {
  const row = resolveTrackRow(context, datumIndex);
  if (!row) {return undefined;}
  const x = context.bandPos(row.xValue) + context.seriesIndex * (context.squareSize + context.effectiveGroupGap);
  const key = `${context.id}:track:${datumIndex}`;
  return {
    node: {
      height: row.trackHeight,
      key,
      kind: "rect",
      radius: context.rx || undefined,
      style: { fill: context.fill, opacity: context.opacity },
      width: context.squareSize,
      x,
      y: context.topY,
    },
    point: {
      color: context.fill,
      datum: row.datum,
      datumIndex,
      group: context.id,
      groupLabel: context.id,
      key,
      markId: context.id,
      x: x + context.squareSize / 2,
      xValue: row.xValue,
      y: context.topY,
      yValue: row.yValue,
    },
  };
}

const renderBarColumnTrackRows = (context: BarColumnTrackRenderContext): BarColumnTrackSceneResult => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, string, number>[] = [];
  for (let datumIndex = 0; datumIndex < context.data.length; datumIndex += 1) {
    const result = renderBarColumnTrackRow(context, datumIndex);
    if (result !== undefined) {
      nodes.push(result.node);
      points.push(result.point);
    }
  }
  return { nodes, points };
}

const renderBarColumnTrackScene = (params: BarColumnTrackSceneParams): BarColumnTrackSceneResult => {
  const context: BarColumnTrackRenderContext = {
    bandPos: params.bandPos,
    baseline: params.baseline,
    data: params.data,
    effectiveGroupGap: params.effectiveGroupGap,
    fill: params.fill,
    id: params.id,
    mapY: params.mapY,
    opacity: params.opacity,
    rx: params.rx,
    seriesIndex: params.seriesIndex,
    squareFit: params.squareFit,
    squareGap: params.squareGap,
    squareSize: params.squareSize,
    topY: params.topY,
    xValues: params.xValues,
    yValues: params.yValues,
  };
  return renderBarColumnTrackRows(context);
}

export { renderBarColumnTrackScene };
export type { BarColumnTrackSceneParams, BarColumnTrackSceneResult };
