import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, MaterializedChannel, SceneNode } from "@tanstack/charts";
import { bandWidthForSquares } from "./bar-squares-layout";
import { buildSquareScene } from "./bar-squares-scene";
import type { ChartDatum, GradientStop } from "./types";
import type { PatternPresetId } from "./pattern-preset";

interface BarSquaresMarkOptions {
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
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

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

const wrapSquaresGroupNodes = (id: string, nodes: SceneNode[]): SceneNode[] => ([
  {
    ariaHidden: true,
    children: nodes,
    className: "ts-chart__bar-y ts-chart__bar-squares",
    key: id,
    kind: "group",
  },
])

const barSquaresMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarSquaresMarkOptions>): ChartMark<ChartDatum, string, number> => {
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

export { barSquaresMark };
export type { BarSquaresMarkOptions };
