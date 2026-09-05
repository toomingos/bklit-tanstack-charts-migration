import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, InitializedMark } from "@tanstack/charts";
import { bandWidthForSquares } from "./bar-squares-layout";
import { renderBarColumnTrackScene } from "./bar-column-track-scene";
import type { ChartDatum } from "./types";

interface BarColumnTrackMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly states?: readonly ChartMarkState<ChartDatum>[];
  readonly seriesIndex: number;
  readonly seriesCount: number;
  readonly groupGap: number;
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
  readonly seriesCount: number;
  readonly groupGap: number;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly opacity: number;
  readonly squareGap: number;
  readonly squareRadius: number;
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
    render: ({ scales, chart }) => {
      // Band geometry resolves at scene build from the package scale (V1.2/G6).
      // Package band map returns centers; tracks place from band starts.
      const bandWidth = scales.x.bandwidth || 0;
      const bandPos = (categoryLabel: string): number => {
        const center = scales.x.map(categoryLabel);
        return Number.isFinite(center) ? center - bandWidth / 2 : 0;
      };
      const squareSize = bandWidthForSquares(bandWidth, options.seriesCount, options.groupGap);
      const effectiveGroupGap = options.seriesCount > 1 ? options.groupGap : 0;
      const rx = squareSize * options.squareRadius;
      return renderBarColumnTrackScene({
        bandPos,
        baseline: scales.y.map(0),
        data,
        effectiveGroupGap,
        fill: options.fill,
        id: options.id,
        mapY: (value: number): number => scales.y.map(value),
        opacity: options.opacity,
        rx,
        seriesIndex: options.seriesIndex,
        squareFit: options.squareFit,
        squareGap: options.squareGap,
        squareSize,
        topY: chart.y,
        xValues,
        yValues,
      });
    },
    states: options.states !== undefined && options.states.length > 0 ? { data, definitions: options.states } : undefined,
  };
}

const barColumnTrackMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarColumnTrackMarkOptions>): ChartMark<ChartDatum, string, number> => {
  const {
    id,
    seriesIndex,
    seriesCount,
    groupGap,
    categoryAccessor,
    yAccessor,
    fill,
    opacity,
    squareGap,
    squareRadius,
    squareFit,
    states,
  } = options;

  return createMark(() => buildBarColumnTrackMarkSpec(data, {
    categoryAccessor,
    fill,
    groupGap,
    id,
    opacity,
    seriesCount,
    seriesIndex,
    squareFit,
    squareGap,
    squareRadius,
    states,
    yAccessor,
  }));
}

export { barColumnTrackMark };
export type { BarColumnTrackMarkOptions };
