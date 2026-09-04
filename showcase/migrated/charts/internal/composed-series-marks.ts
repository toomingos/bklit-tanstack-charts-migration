import { lineY } from "@tanstack/charts/line";
import { d3Curve } from "@tanstack/charts/d3/shape";
import type {
  ChartMark,
  ChartMarkState,
  ChartValue,
} from "@tanstack/charts";
import { areaFill } from "./area-fill-mark";
import { toDate } from "./coerce-date";
import {
  pointerRowDimState,
  pointerSeriesDimStates,
} from "./hover-geometry";
import { seriesBarMark } from "./series-bar-mark";
import type { ChartDatum } from "./types";
import type {
  ComposedMarksContext,
  ResolvedBar,
} from "./composed-model";

// SeriesBarMark has no states option; states attach via a wrapped initialize() return.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";
const withMarkStates = <
  TDatum,
  TXPointValue extends ChartValue,
  TYPointValue extends ChartValue,
>(
  mark: ChartMark<TDatum, TXPointValue, TYPointValue>,
  states: readonly ChartMarkState<TDatum>[],
): ChartMark<TDatum, TXPointValue, TYPointValue> => ({
  ...mark,
  initialize: (context) => ({
    ...mark.initialize(context),
    states: { data: [], definitions: states },
  }),
});

const appendBarMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  ctx: Readonly<ComposedMarksContext>,
): void => {
  const groupDataKeys = ctx.resolvedBars.map((entry: Readonly<ResolvedBar>) => entry.dataKey);
  for (const [barIndex, bar] of ctx.resolvedBars.entries()) {
    marks.push(
      withMarkStates(
        seriesBarMark(ctx.data, {
          barGap: ctx.barGap,
          barSize: ctx.barSize,
          fill: bar.fill,
          groupDataKeys,
          id: bar.dataKey,
          maxBarSize: ctx.maxBarSize,
          opacity: ctx.legendHoveredKey !== undefined && ctx.legendHoveredKey !== bar.dataKey ? bar.fadedOpacity : undefined,
          radius: bar.radius || undefined,
          seriesIndex: barIndex,
          stackGap: ctx.stackGap,
          stackOffsets: ctx.composedStackOffsets,
          stacked: ctx.stacked,
          // Row values are unknown by the ChartDatum contract; toDate proves the x
          // Value (identity for Date inputs) and y falls back to NaN when absent.
          xAccessor: (row: Readonly<ChartDatum>) => toDate(row[ctx.xDataKey]) ?? new Date(Number.NaN),
          // SeriesBar always reads the primary scale (bklit useYScale() with no argument).
          yAccessor: (row: Readonly<ChartDatum>): number => {
            const raw: unknown = row[bar.dataKey];
            return isNumber(raw) ? raw : Number.NaN;
          },
        }),
        [
          pointerRowDimState<ChartDatum>(bar.fadedOpacity),
        ],
      ),
    );
  }
};

const appendAreaMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  ctx: Readonly<ComposedMarksContext>,
  dimOpacityByKey: ReadonlyMap<string, number | undefined>,
): void => {
  for (const area of ctx.resolvedAreas) {
    const gradientId = ctx.gradientIdBySeries.get(area.dataKey);
    const curve = d3Curve(area.curve);
    const areaDimOpacity = dimOpacityByKey.get(area.dataKey) ?? ctx.areaDimFallback;
    const isLegendDimmed = ctx.legendHoveredKey !== undefined && ctx.legendHoveredKey !== area.dataKey;
    marks.push(
      areaFill(ctx.renderData, {
        curve,
        fill: (gradientId ?? "") === "" ? area.fill : `url(#${gradientId})`,
        fillOpacity:
          (ctx.tooltipEnabled && ctx.hoveredIndex !== null) || isLegendDimmed
            ? areaDimOpacity
            : 1,
        id: `${area.dataKey}__fill`,
        x: (row: Readonly<ChartDatum>) => toDate(row[ctx.xDataKey]) ?? new Date(Number.NaN),
        y: (row: Readonly<ChartDatum>): number => {
          const raw: unknown = row[area.dataKey];
          return ctx.projectValue(area.dataKey, isNumber(raw) ? raw : Number.NaN);
        },
      }),
      // Shared mark ids with <Line> keep tooltip/hover-dot lookups branch-free.
      lineY(ctx.renderData, {
        curve,
        id: area.dataKey,
        states: pointerSeriesDimStates<ChartDatum>(areaDimOpacity),
        stroke: area.stroke,
        strokeOpacity: ctx.legendHoveredKey !== undefined && ctx.legendHoveredKey !== area.dataKey ? areaDimOpacity : undefined,
        strokeWidth: area.strokeWidth,
        x: (row: Readonly<ChartDatum>) => toDate(row[ctx.xDataKey]) ?? new Date(Number.NaN),
        y: (row: Readonly<ChartDatum>): number => {
          const raw: unknown = row[area.dataKey];
          return ctx.projectValue(area.dataKey, isNumber(raw) ? raw : Number.NaN);
        },
        z: () => area.dataKey,
      }),
    );
  }
};

const appendLineMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  ctx: Readonly<ComposedMarksContext>,
  dimOpacityByKey: ReadonlyMap<string, number | undefined>,
): void => {
  for (const line of ctx.resolvedLines) {
    const lineDimOpacity = dimOpacityByKey.get(line.dataKey) ?? ctx.lineDimFallback;
    marks.push(
      lineY(ctx.renderData, {
        curve: d3Curve(line.curve),
        id: line.dataKey,
        states: pointerSeriesDimStates<ChartDatum>(lineDimOpacity),
        stroke: line.stroke,
        strokeOpacity: ctx.legendHoveredKey !== undefined && ctx.legendHoveredKey !== line.dataKey ? lineDimOpacity : undefined,
        strokeWidth: line.strokeWidth,
        x: (row: Readonly<ChartDatum>) => toDate(row[ctx.xDataKey]) ?? new Date(Number.NaN),
        y: (row: Readonly<ChartDatum>): number => {
          const raw: unknown = row[line.dataKey];
          return ctx.projectValue(line.dataKey, isNumber(raw) ? raw : Number.NaN);
        },
        z: () => line.dataKey,
      }),
    );
  }
};

export {
  appendAreaMarks,
  appendBarMarks,
  appendLineMarks,
};
