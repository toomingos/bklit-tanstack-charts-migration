import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, InitializedMark } from "@tanstack/charts";
import { bandWidthForSquares } from "./bar-squares-layout";
import { renderBarColumnTrackScene } from "./bar-column-track-scene";
import type { ChartDatum } from "./types";

export interface BarColumnTrackMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly states?: readonly ChartMarkState<ChartDatum>[];
  readonly seriesIndex: number;
  readonly seriesCount: number;
  readonly groupGap: number;
  readonly bandWidth: number;
  readonly bandPos: (categoryLabel: string) => number;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly opacity: number;
  readonly squareGap: number;
  readonly squareRadius: number;
  readonly squareFit: boolean;
}

interface BarColumnTrackMarkSpecOptions {
  readonly id: string;
  readonly states: readonly ChartMarkState<ChartDatum>[] | undefined;
  readonly seriesIndex: number;
  readonly squareSize: number;
  readonly effectiveGroupGap: number;
  readonly rx: number;
  readonly bandPos: (categoryLabel: string) => number;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly opacity: number;
  readonly squareGap: number;
  readonly squareFit: boolean;
}

const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

const buildBarColumnTrackMarkSpec = (data: readonly Readonly<ChartDatum>[], options: BarColumnTrackMarkSpecOptions): InitializedMark<ChartDatum, string, number> => {
  const xValues = data.map((datum) => options.categoryAccessor(datum));
  const yValues = data.map((datum) => options.yAccessor(datum));
  return {
    channels: {
      x: { scale: "x", values: xValues },
      y: {
        includeZero: true,
        scale: "y",
        values: yValues.filter((value): value is number => isNumber(value) && Number.isFinite(value)),
      },
    },
    id: options.id,
    render: ({ scales, chart }) => renderBarColumnTrackScene({
      bandPos: options.bandPos,
      baseline: scales.y.map(0),
      data,
      effectiveGroupGap: options.effectiveGroupGap,
      fill: options.fill,
      id: options.id,
      mapY: (value: number): number => scales.y.map(value),
      opacity: options.opacity,
      rx: options.rx,
      seriesIndex: options.seriesIndex,
      squareFit: options.squareFit,
      squareGap: options.squareGap,
      squareSize: options.squareSize,
      topY: chart.y,
      xValues,
      yValues,
    }),
    states: options.states !== undefined && options.states.length > 0 ? { data, definitions: options.states } : undefined,
  };
}

export const barColumnTrackMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarColumnTrackMarkOptions>): ChartMark<ChartDatum, string, number> => {
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
    opacity,
    squareGap,
    squareRadius,
    squareFit,
    states,
  } = options;

  const squareSize = bandWidthForSquares(bandWidth, seriesCount, groupGap);
  const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
  const rx = squareSize * squareRadius;

  return createMark(() => buildBarColumnTrackMarkSpec(data, {
    bandPos,
    categoryAccessor,
    effectiveGroupGap,
    fill,
    id,
    opacity,
    rx,
    seriesIndex,
    squareFit,
    squareGap,
    squareSize,
    states,
    yAccessor,
  }));
}
