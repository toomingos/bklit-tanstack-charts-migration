import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, InitializedMark } from "@tanstack/charts";
import { isFiniteNumber, renderSeriesBarScene } from "./series-bar-scene";
// Stock barY bandwidth diverges ~4.5% on time scales; this uses bklit bar-width math.
import type { ChartDatum } from "./types";

interface SeriesBarMarkOptions {
  readonly id: string;
  readonly xAccessor: (datum: Readonly<ChartDatum>) => Date;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly opacity?: number;
  readonly radius?: number;
  readonly groupDataKeys?: readonly string[];
  readonly seriesIndex?: number;
  readonly barGap?: number;
  readonly barSize?: number;
  readonly maxBarSize?: number;
  readonly stacked?: boolean;
  readonly stackGap?: number;
  readonly stackOffsets?: ReadonlyMap<number, ReadonlyMap<string, number>>;
  readonly states?: readonly ChartMarkState<ChartDatum>[];
}

interface SeriesBarMarkSpecOptions {
  readonly id: string;
  readonly xAccessor: (datum: Readonly<ChartDatum>) => Date;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
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
  readonly states: readonly ChartMarkState<ChartDatum>[] | undefined;
}

const buildSeriesBarMarkSpec = (data: readonly Readonly<ChartDatum>[], options: SeriesBarMarkSpecOptions): InitializedMark<ChartDatum, Date, number> => {
  const xValues = data.map((datum) => options.xAccessor(datum));
  const yValues = data.map((datum) => options.yAccessor(datum));
  return {
    channels: {
      x: { scale: "x", values: xValues },
      y: {
        includeZero: true,
        scale: "y",
        values: yValues.filter((value) => isFiniteNumber(value)),
      },
    },
    id: options.id,
    render: ({ scales, chart }) => renderSeriesBarScene({
      barSize: options.barSize,
      chartWidth: chart.width,
      data,
      fill: options.fill,
      gap: options.gap,
      id: options.id,
      mapX: (value: Date): number => scales.x.map(value),
      mapY: (value: number): number => scales.y.map(value),
      maxBarSize: options.maxBarSize,
      opacity: options.opacity,
      radius: options.radius,
      seriesCount: options.seriesCount,
      seriesIndex: options.seriesIndex,
      stackGap: options.stackGap,
      stackOffsets: options.stackOffsets,
      stacked: options.stacked,
      xValues,
      yValues,
    }),
    states: options.states !== undefined && options.states.length > 0 ? { data, definitions: options.states } : undefined,
  };
}


const seriesBarMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<SeriesBarMarkOptions>): ChartMark<ChartDatum, Date, number> => {
  const {
    id,
    xAccessor,
    yAccessor,
    fill,
    radius = 0,
    groupDataKeys = [id],
    seriesIndex = 0,
    barGap = 4,
    barSize,
    maxBarSize,
    stacked = false,
    stackGap = 0,
    stackOffsets,
    states,
    opacity,
  } = options;
  return createMark(() => buildSeriesBarMarkSpec(data, {
    barSize,
    fill,
    gap: barGap,
    id,
    maxBarSize,
    opacity,
    radius,
    seriesCount: groupDataKeys.length,
    seriesIndex,
    stackGap,
    stackOffsets,
    stacked,
    states,
    xAccessor,
    yAccessor,
  }));
};

export { seriesBarMark };
export type { SeriesBarMarkOptions };
