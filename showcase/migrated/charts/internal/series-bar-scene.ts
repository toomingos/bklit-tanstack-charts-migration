import type { ChartPoint, SceneNode } from "@tanstack/charts";
import { computeSeriesBarWidth } from "./series-bar-layout";
// Stock barY bandwidth diverges ~4.5% on time scales; this uses bklit bar-width math.
import type { ChartDatum } from "./types";

interface SeriesBarRenderContext {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly Readonly<Date>[];
  readonly yValues: readonly number[];
  readonly id: string;
  readonly fill: string;
  readonly opacity: number | undefined;
  readonly radius: number;
  readonly seriesIndex: number;
  readonly seriesCount: number;
  readonly gap: number;
  readonly stacked: boolean;
  readonly stackGap: number;
  readonly stackOffsets: ReadonlyMap<number, ReadonlyMap<string, number>> | undefined;
  readonly barWidth: number;
  readonly groupWidth: number;
  readonly baseline: number;
  readonly isLastSeries: boolean;
  readonly mapX: (value: Readonly<Date>) => number;
  readonly mapY: (value: number) => number;
}

interface SeriesBarSceneParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly Readonly<Date>[];
  readonly yValues: readonly number[];
  readonly id: string;
  readonly fill: string;
  readonly opacity: number | undefined;
  readonly radius: number;
  readonly seriesIndex: number;
  readonly seriesCount: number;
  readonly gap: number;
  readonly barSize: number | undefined;
  readonly maxBarSize: number | undefined;
  readonly stacked: boolean;
  readonly stackGap: number;
  readonly stackOffsets: ReadonlyMap<number, ReadonlyMap<string, number>> | undefined;
  readonly chartWidth: number;
  readonly mapX: (value: Readonly<Date>) => number;
  readonly mapY: (value: number) => number;
}

interface SeriesBarRowResult {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

interface SeriesBarSceneResult {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, Date, number>[];
}

const isFiniteNumber = <Candidate>(candidate: Candidate): candidate is Candidate & number => typeof candidate === "number" && Number.isFinite(candidate);

const resolveStackedOffsetY = (mapY: (value: number) => number, offset: number, baseline: number): number => {
  const mappedOffset = mapY(offset);
  if (Number.isFinite(mappedOffset)) {return mappedOffset;}
  return baseline;
}

const adjustStackedSegmentHeight = (segHeight: number, stackGap: number, isLastSeries: boolean): number => {
  if (!isLastSeries && stackGap > 0) {return Math.max(0, segHeight - stackGap);}
  return segHeight;
}

const buildStackedBarDatum = (context: Readonly<SeriesBarRenderContext>, datumIndex: number, xCenter: number): SeriesBarRowResult | undefined => {
  const offset = context.stackOffsets?.get(datumIndex)?.get(context.id) ?? 0;
  const valuePos = context.mapY(context.yValues[datumIndex]);
  if (!Number.isFinite(valuePos)) {return undefined;}
  const rawHeight = context.baseline - valuePos;
  const offsetY = resolveStackedOffsetY(context.mapY, offset, context.baseline);
  const segY = offsetY - rawHeight - context.seriesIndex * context.stackGap;
  const segHeight = adjustStackedSegmentHeight(rawHeight, context.stackGap, context.isLastSeries);
  const key = `${context.id}:rect:${datumIndex}`;
  return {
    node: {
      height: segHeight,
      key,
      kind: "rect",
      radius: context.stackGap > 0 || context.isLastSeries ? context.radius || undefined : undefined,
      style: { fill: context.fill, opacity: context.opacity },
      width: context.barWidth,
      x: xCenter - context.barWidth / 2,
      y: segY,
    },
    point: {
      color: context.fill,
      datum: context.data[datumIndex],
      datumIndex,
      group: context.id,
      groupLabel: context.id,
      key,
      markId: context.id,
      x: xCenter,
      xValue: context.xValues[datumIndex],
      y: segY,
      yValue: context.yValues[datumIndex],
    },
  };
}

const buildGroupedBarDatum = (context: Readonly<SeriesBarRenderContext>, datumIndex: number, xCenter: number): SeriesBarRowResult | undefined => {
  const yTop = context.mapY(context.yValues[datumIndex]);
  if (!Number.isFinite(yTop)) {return undefined;}
  const barLeft = xCenter - context.groupWidth / 2 + context.seriesIndex * (context.barWidth + context.gap);
  const barY = Math.min(yTop, context.baseline);
  const barHeight = Math.abs(context.baseline - yTop);
  const key = `${context.id}:rect:${datumIndex}`;
  return {
    node: {
      height: barHeight,
      key,
      kind: "rect",
      radius: context.radius || undefined,
      style: { fill: context.fill, opacity: context.opacity },
      width: context.barWidth,
      x: barLeft,
      y: barY,
    },
    point: {
      color: context.fill,
      datum: context.data[datumIndex],
      datumIndex,
      group: context.id,
      groupLabel: context.id,
      key,
      markId: context.id,
      x: xCenter,
      xValue: context.xValues[datumIndex],
      y: yTop,
      yValue: context.yValues[datumIndex],
    },
  };
}

const renderSeriesBarRow = (context: Readonly<SeriesBarRenderContext>, datumIndex: number): SeriesBarRowResult | undefined => {
  const yValue = context.yValues[datumIndex];
  if (!isFiniteNumber(yValue)) {return undefined;}
  const xCenter = context.mapX(context.xValues[datumIndex]);
  if (!Number.isFinite(xCenter)) {return undefined;}
  if (context.stacked && context.stackOffsets) {
    return buildStackedBarDatum(context, datumIndex, xCenter);
  }
  return buildGroupedBarDatum(context, datumIndex, xCenter);
}

const renderSeriesBarRows = (context: Readonly<SeriesBarRenderContext>): SeriesBarSceneResult => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, Date, number>[] = [];
  for (let datumIndex = 0; datumIndex < context.data.length; datumIndex += 1) {
    const result = renderSeriesBarRow(context, datumIndex);
    if (result) {
      nodes.push(result.node);
      points.push(result.point);
    }
  }
  return { nodes, points };
}

const renderSeriesBarScene = (params: Readonly<SeriesBarSceneParams>): SeriesBarSceneResult => {
  const slotWidth = params.data.length < 2 ? params.chartWidth : params.chartWidth / (params.data.length - 1);
  const barWidth = computeSeriesBarWidth({
    columnWidth: slotWidth,
    composedBarGap: params.gap,
    composedBarSize: params.barSize,
    composedMaxBarSize: params.maxBarSize,
    dataLength: params.data.length,
    innerWidth: params.chartWidth,
    seriesCount: params.seriesCount,
    stacked: params.stacked,
  });
  const groupWidth = params.seriesCount > 1 ? params.seriesCount * barWidth + (params.seriesCount - 1) * params.gap : barWidth;
  const context: SeriesBarRenderContext = {
    barWidth,
    baseline: params.mapY(0),
    data: params.data,
    fill: params.fill,
    gap: params.gap,
    groupWidth,
    id: params.id,
    isLastSeries: params.seriesIndex === params.seriesCount - 1,
    mapX: params.mapX,
    mapY: params.mapY,
    opacity: params.opacity,
    radius: params.radius,
    seriesCount: params.seriesCount,
    seriesIndex: params.seriesIndex,
    stackGap: params.stackGap,
    stackOffsets: params.stackOffsets,
    stacked: params.stacked,
    xValues: params.xValues,
    yValues: params.yValues,
  };
  return renderSeriesBarRows(context);
}

export { isFiniteNumber, renderSeriesBarScene };
export type { SeriesBarSceneParams, SeriesBarSceneResult };
