import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, ChartPoint, MaterializedChannel, SceneNode } from "@tanstack/charts";
import { bandWidthForSquares, computeSquareColumn } from "./bar-squares-layout";
import type { ChartDatum, GradientStop } from "./types";
import type { PatternPresetId } from "./pattern-preset";

export interface BarSquaresMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly states?: readonly ChartMarkState<ChartDatum>[];
  readonly opacity?: number;
  readonly seriesIndex: number;
  readonly seriesCount: number;
  readonly groupGap: number;
  readonly bandWidth: number;
  readonly bandPos: (categoryLabel: string) => number;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly squareGap: number;
  readonly squareRadius: number;
  readonly squareFit: boolean;
  readonly useGradient: boolean;
  readonly gradientStops: readonly Readonly<GradientStop>[];
  readonly patternPreset?: PatternPresetId;
  readonly gradientId: string;
  readonly patternId: string;
}

interface SquaresFillParams {
  readonly fill: string;
  readonly useGradient: boolean;
  readonly patternPreset?: PatternPresetId;
  readonly patternId: string;
  readonly gradientId: string;
}

const resolveSquaresEffectiveFill = (params: Readonly<SquaresFillParams>): string => {
  const isPatternFill = params.fill.startsWith("url(");
  const hasNestedPattern = Boolean(params.useGradient && isPatternFill && params.patternPreset && params.patternPreset !== "none");
  const gradientTarget = hasNestedPattern ? params.patternId : params.gradientId;
  return params.useGradient ? `url(#${gradientTarget})` : params.fill;
}

interface SquaresGeometry {
  readonly squareSize: number;
  readonly effectiveGroupGap: number;
  readonly rx: number;
}

interface SquaresGeometryParams {
  readonly bandWidth: number;
  readonly seriesCount: number;
  readonly groupGap: number;
  readonly squareRadius: number;
}

const resolveSquaresGeometry = (params: Readonly<SquaresGeometryParams>): SquaresGeometry => {
  const squareSize = bandWidthForSquares(params.bandWidth, params.seriesCount, params.groupGap);
  const effectiveGroupGap = params.seriesCount > 1 ? params.groupGap : 0;
  return { effectiveGroupGap, rx: squareSize * params.squareRadius, squareSize };
}

interface SquareChannelValues {
  readonly xValues: string[];
  readonly yValues: number[];
}

const buildSquareChannelValues = (data: readonly Readonly<ChartDatum>[], categoryAccessor: (datum: Readonly<ChartDatum>) => string, yAccessor: (datum: Readonly<ChartDatum>) => number): SquareChannelValues => ({
  xValues: data.map((datum) => categoryAccessor(datum)),
  yValues: data.map((datum) => yAccessor(datum)),
})

// Typeof checks live only in the predicate below; call sites use the guard.
const isNumber = (value: unknown): value is number => typeof value === "number";

interface SquareMarkXChannel {
  readonly scale: string;
  readonly values: readonly string[];
}

interface SquareMarkYChannel {
  readonly includeZero: boolean;
  readonly scale: string;
  readonly values: number[];
}

interface SquareMarkChannels {
  readonly x: SquareMarkXChannel;
  readonly y: SquareMarkYChannel;
  readonly [channel: string]: MaterializedChannel;
}

const buildSquareMarkChannels = (xValues: readonly string[], yValues: readonly number[]): SquareMarkChannels => ({
  x: { scale: "x", values: xValues },
  y: {
    includeZero: true,
    scale: "y",
    values: yValues.filter((value): value is number => isNumber(value) && Number.isFinite(value)),
  },
})

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
  readonly squareFit: boolean;
  readonly squareGap: number;
  readonly rx: number;
  readonly effectiveFill: string;
  readonly fill: string;
  readonly opacity: number | undefined;
}

const wrapSquaresGroupNodes = (id: string, nodes: SceneNode[]): SceneNode[] => ([
  {
    ariaHidden: true,
    children: nodes,
    className: "ts-chart__bar-y ts-chart__bar-squares",
    key: id,
    kind: "group",
  },
])

interface SquareScene {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
}

const buildSquareScene = (params: Readonly<SquareSceneParams>): SquareScene => {
  const nodes: SceneNode[] = [];
  const points: ChartPoint<ChartDatum, string, number>[] = [];
  for (let i = 0; i < params.data.length; i += 1) {
    const metrics = resolveSquareDatumMetrics({ baseline: params.baseline, data: params.data, index: i, xValues: params.xValues, yScale: params.yScale, yValues: params.yValues });
    if (metrics !== undefined) {
      const placement = resolveSquareColumnPlacement({ bandPos: params.bandPos, baseline: params.baseline, effectiveGroupGap: params.effectiveGroupGap, metrics, seriesIndex: params.seriesIndex, squareFit: params.squareFit, squareGap: params.squareGap, squareSize: params.squareSize });
      if (placement !== undefined) {
        appendSquaresForDatum({ columnTop: placement.columnTop, datum: metrics.datum, effectiveFill: params.effectiveFill, fill: params.fill, id: params.id, index: i, layout: placement.layout, nodes, opacity: params.opacity, points, rx: params.rx, squareSize: params.squareSize, x: placement.x, xValue: metrics.xValue, yValue: metrics.yValue });
      }
    }
  }
  return { nodes, points };
}

export const barSquaresMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarSquaresMarkOptions>): ChartMark<ChartDatum, string, number> => {
  const {
    id,
    seriesIndex,
    seriesCount,
    groupGap,
    bandWidth,
    bandPos,
    categoryAccessor,
    yAccessor,
    fill,
    squareGap,
    squareRadius,
    squareFit,
    useGradient,
    patternPreset,
    gradientId,
    patternId,
    states,
    opacity,
  } = options;

  const effectiveFill = resolveSquaresEffectiveFill({ fill, gradientId, patternId, patternPreset, useGradient });

  const { squareSize, effectiveGroupGap, rx } = resolveSquaresGeometry({ bandWidth, groupGap, seriesCount, squareRadius });

  return createMark(() => {
    const { xValues, yValues } = buildSquareChannelValues(data, categoryAccessor, yAccessor);

    return {
      channels: buildSquareMarkChannels(xValues, yValues),
      id,
      render: ({ scales }) => {
        const baseline = scales.y.map(0);
        const scene = buildSquareScene({ bandPos, baseline, data, effectiveFill, effectiveGroupGap, fill, id, opacity, rx, seriesIndex, squareFit, squareGap, squareSize, xValues, yScale: scales.y, yValues });

        return {
          nodes: wrapSquaresGroupNodes(id, scene.nodes),
          points: scene.points,
        };
      },
      states: states !== undefined && states.length > 0 ? { data, definitions: states } : undefined,
    };
  });
}
