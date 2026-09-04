import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, ChartPoint, MaterializedChannel, SceneNode } from "@tanstack/charts";
import type { ScaleBand } from "d3-scale";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

export interface BarTrimmedMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly states?: readonly ChartMarkState<ChartDatum>[];
  readonly opacity?: number;
  readonly groupBandwidth: number;
  readonly groupScale: ScaleBand<string>;
  readonly fill: string;
  readonly radius: number;
  readonly bandWidth: number;
  readonly bandScale?: { readonly step?: () => number };
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly innerWidth: number;
  readonly chartX: number;
  readonly centerX: number;
  readonly maxDepth: number;
}

interface TrimmedChannelValues {
  readonly xValues: string[];
  readonly rawY: number[];
}

const buildTrimmedChannelValues = (data: readonly Readonly<ChartDatum>[], categoryAccessor: (datum: Readonly<ChartDatum>) => string, yAccessor: (datum: Readonly<ChartDatum>) => number): TrimmedChannelValues => ({
  rawY: data.map((datum) => yAccessor(datum)),
  xValues: data.map((datum) => categoryAccessor(datum)),
})

// Typeof checks live only in the predicate below; call sites use the guard.
const isNumber = (value: unknown): value is number => typeof value === "number";

interface TrimmedMarkXChannel {
  readonly scale: string;
  readonly values: readonly string[];
}

interface TrimmedMarkYChannel {
  readonly includeZero: boolean;
  readonly scale: string;
  readonly values: number[];
}

interface TrimmedMarkChannels {
  readonly x: TrimmedMarkXChannel;
  readonly y: TrimmedMarkYChannel;
  readonly [channel: string]: MaterializedChannel;
}

const buildTrimmedMarkChannels = (xValues: readonly string[], rawY: readonly number[]): TrimmedMarkChannels => ({
  x: { scale: "x", values: xValues },
  y: {
    includeZero: true,
    scale: "y",
    values: rawY.filter((value): value is number => isNumber(value) && Number.isFinite(value)),
  },
})

interface TrimmedYScale {
  readonly map: (value: number) => number;
}

interface TrimmedBarLengthParams {
  readonly yScale: TrimmedYScale;
  readonly baseline: number;
  readonly yValue: number;
}

const resolveTrimmedBarLength = (params: Readonly<TrimmedBarLengthParams>): { valuePos: number; naturalHeight: number } | undefined => {
  const valuePos = params.yScale.map(params.yValue);
  if (!Number.isFinite(valuePos)) {return undefined;}
  const naturalHeight = params.baseline - valuePos;
  if (naturalHeight <= 0) {return undefined;}
  return { naturalHeight, valuePos };
}

interface TrimmedDatumMetrics {
  readonly datum: Readonly<ChartDatum>;
  readonly xValue: string;
  readonly yValue: number;
  readonly valuePos: number;
  readonly naturalHeight: number;
}

interface TrimmedDatumMetricsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly rawY: readonly number[];
  readonly index: number;
  readonly baseline: number;
  readonly yScale: TrimmedYScale;
}

const resolveTrimmedDatumMetrics = (params: Readonly<TrimmedDatumMetricsParams>): TrimmedDatumMetrics | undefined => {
  const datum = params.data[params.index];
  const xValue = params.xValues[params.index];
  const yValue = params.rawY[params.index];
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue <= 0) {return undefined;}
  const barLength = resolveTrimmedBarLength({ baseline: params.baseline, yScale: params.yScale, yValue });
  if (barLength === undefined) {return undefined;}
  return { datum, naturalHeight: barLength.naturalHeight, valuePos: barLength.valuePos, xValue, yValue };
}

interface TrimmedRenderGeometry {
  readonly innerW: number;
  readonly cx0: number;
  readonly maxD: number;
  readonly totalBandwidth: number;
  readonly gs: ScaleBand<string>;
  readonly width: number;
}

interface TrimmedRenderGeometryParams {
  readonly chartWidth: number;
  readonly chartX: number;
  readonly bandScale?: { readonly step?: () => number };
  readonly bandWidth: number;
  readonly groupScale: ScaleBand<string>;
  readonly totalBandwidth: number;
}

const resolveTrimmedRenderGeometry = (params: Readonly<TrimmedRenderGeometryParams>): TrimmedRenderGeometry => {
  const innerW = params.chartWidth;
  const cx0 = params.chartX + innerW / 2;
  const step = params.bandScale?.step?.() ?? params.bandWidth;
  const maxD = barDepthMaxDepth(step, params.bandWidth);
  // Range the shared group scale to the category band on a copy (no mutation).
  const gs = params.groupScale.copy().range([0, params.totalBandwidth]);
  const width = gs.bandwidth();
  return { cx0, gs, innerW, maxD, totalBandwidth: params.totalBandwidth, width };
}

interface TrimmedBarPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface TrimmedBarPlacementParams {
  readonly metrics: Readonly<TrimmedDatumMetrics>;
  readonly mapX: (value: string) => number;
  readonly geometry: Readonly<TrimmedRenderGeometry>;
  readonly id: string;
}

interface TrimmedBarXParams {
  readonly mapX: (value: string) => number;
  readonly xValue: string;
  readonly totalBandwidth: number;
  readonly groupOffset: number;
}

const resolveTrimmedBarX = (params: Readonly<TrimmedBarXParams>): number => {
  const center = params.mapX(params.xValue);
  return center - params.totalBandwidth / 2 + params.groupOffset;
}

interface TrimmedCenterOffsetParams {
  readonly innerW: number;
  readonly cx0: number;
  readonly bandCenter: number;
}

const resolveTrimmedCenterOffset = (params: Readonly<TrimmedCenterOffsetParams>): number => {
  const offsetFromCenter = params.innerW > 0 ? (params.bandCenter - params.cx0) / (params.innerW / 2) : 0;
  return Math.min(1, Math.abs(offsetFromCenter));
}

interface TrimmedTrimParams {
  readonly naturalHeight: number;
  readonly absOffset: number;
  readonly maxD: number;
}

const resolveTrimmedTrim = (params: Readonly<TrimmedTrimParams>): number => {
  const { perspectiveRise } = barDepthAndRise(params.absOffset, params.naturalHeight, params.maxD);
  return Math.min(perspectiveRise, Math.max(0, params.naturalHeight - 1));
}

const resolveTrimmedBarPlacement = (params: Readonly<TrimmedBarPlacementParams>): TrimmedBarPlacement | undefined => {
  const groupOffset = params.geometry.gs(params.id) ?? 0;
  const x = resolveTrimmedBarX({ groupOffset, mapX: params.mapX, totalBandwidth: params.geometry.totalBandwidth, xValue: params.metrics.xValue });
  const bandCenter = x + params.geometry.width / 2;
  const absOffset = resolveTrimmedCenterOffset({ bandCenter, cx0: params.geometry.cx0, innerW: params.geometry.innerW });
  const trim = resolveTrimmedTrim({ absOffset, maxD: params.geometry.maxD, naturalHeight: params.metrics.naturalHeight });
  const y = params.metrics.valuePos + trim;
  const height = params.metrics.naturalHeight - trim;
  if (height <= 0) {return undefined;}
  return { height, width: params.geometry.width, x, y };
}

interface AppendTrimmedBarParams {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
  readonly metrics: Readonly<TrimmedDatumMetrics>;
  readonly placement: Readonly<TrimmedBarPlacement>;
  readonly id: string;
  readonly index: number;
  readonly fill: string;
  readonly radius: number;
  readonly opacity: number | undefined;
}

const appendTrimmedBarDatum = (params: Readonly<AppendTrimmedBarParams>): void => {
  // Point key duplicates the rect key for prefix-based point ownership.
  const key = `${params.id}:${params.metrics.xValue}:${params.index}`;
  params.nodes.push({
    height: params.placement.height,
    key,
    kind: "rect",
    radius: params.radius || undefined,
    style: { fill: params.fill, opacity: params.opacity },
    width: params.placement.width,
    x: params.placement.x,
    y: params.placement.y,
  });
  params.points.push({
    color: params.fill,
    datum: params.metrics.datum,
    datumIndex: params.index,
    group: params.id,
    groupLabel: params.id,
    key,
    markId: params.id,
    x: params.placement.x + params.placement.width / 2,
    xValue: params.metrics.xValue,
    y: params.metrics.valuePos,
    yValue: params.metrics.yValue,
  });
}

interface TrimmedSceneParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly rawY: readonly number[];
  readonly baseline: number;
  readonly yScale: TrimmedYScale;
  readonly mapX: (value: string) => number;
  readonly geometry: Readonly<TrimmedRenderGeometry>;
  readonly id: string;
  readonly fill: string;
  readonly radius: number;
  readonly opacity: number | undefined;
}

interface TrimmedScene {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
}

const buildTrimmedScene = (params: Readonly<TrimmedSceneParams>): TrimmedScene => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, string, number>[] = [];
  for (let i = 0; i < params.data.length; i += 1) {
    const metrics = resolveTrimmedDatumMetrics({ baseline: params.baseline, data: params.data, index: i, rawY: params.rawY, xValues: params.xValues, yScale: params.yScale });
    if (metrics !== undefined) {
      const placement = resolveTrimmedBarPlacement({ geometry: params.geometry, id: params.id, mapX: params.mapX, metrics });
      if (placement !== undefined) {
        appendTrimmedBarDatum({ fill: params.fill, id: params.id, index: i, metrics, nodes, opacity: params.opacity, placement, points, radius: params.radius });
      }
    }
  }
  return { nodes, points };
}

const wrapTrimmedGroupNodes = (id: string, nodes: SceneNode[]): SceneNode[] => ([
  {
    ariaHidden: true,
    children: nodes,
    className: "ts-chart__bar-y",
    key: id,
    kind: "group",
  },
])

export const barTrimmedMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarTrimmedMarkOptions>): ChartMark<ChartDatum, string, number> => {
  const { id, groupScale, fill, radius, bandWidth, bandScale, categoryAccessor, yAccessor, states, opacity } = options;
  return createMark(() => {
    const { xValues, rawY } = buildTrimmedChannelValues(data, categoryAccessor, yAccessor);
    return {
      channels: buildTrimmedMarkChannels(xValues, rawY),
      id,
      render: ({ scales, chart }) => {
        const baseline = scales.y.map(0);
        const geometry = resolveTrimmedRenderGeometry({ bandScale, bandWidth, chartWidth: chart.width, chartX: chart.x, groupScale, totalBandwidth: scales.x.bandwidth || bandWidth });
        const scene = buildTrimmedScene({ baseline, data, fill, geometry, id, mapX: (value: string) => scales.x.map(value), opacity, radius, rawY, xValues, yScale: scales.y });
        return {
          nodes: wrapTrimmedGroupNodes(id, scene.nodes),
          points: scene.points,
        };
      },
      states: states !== undefined && states.length > 0 ? { data, definitions: states } : undefined,
    };
  });
}
