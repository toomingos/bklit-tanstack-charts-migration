import { curveNatural } from "d3-shape";
import { lineY } from "@tanstack/charts/line";
import { d3Curve } from "@tanstack/charts/d3/shape";
import type {
  ChartMark,
  ChartMarkState,
  ChartValue,
} from "@tanstack/charts";
import { areaFill } from "./area-fill-mark";
import { toDate } from "./coerce-date";
import { appendProjectionMarks } from "./composed-overlay-geometry";
import {
  buildHighlightBandMarks,
  buildHoverDotMark,
  buildIndicatorMark,
  pointerRowDimState,
  pointerSeriesDimStates,
  resolveHoverDotFill,
} from "./hover-geometry";
import type { HighlightBandSeries } from "./hover-geometry";
import { seriesBarMark } from "./series-bar-mark";
import type { ChartDatum } from "./types";

import type {
  ComposedMarksContext,
  ComposedSeriesEntry,
  ResolvedBar,
} from "./composed-model";

// SeriesBarMark has no states option; states attach via a wrapped initialize() return.
const isNumber = (value: unknown): value is number => typeof value === "number";
const isString = (value: unknown): value is string => typeof value === "string";
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

const appendHoverDotMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  ctx: Readonly<ComposedMarksContext>,
): void => {
  for (const series of ctx.composedSeries) {
    marks.push(
      buildHoverDotMark(
        ctx.data,
        ctx.xDataKey,
        { color: series.stroke, dataKey: series.dataKey },
        resolveHoverDotFill(series.stroke, ctx.tooltip?.dotColor),
        { discrete: ctx.isDiscrete, size: ctx.tooltip?.dotSize, strokeWidth: ctx.tooltip?.dotStrokeWidth },
      ),
    );
  }
};

// Highlight-band inputs for the series with showHighlight; hoisted so appendHoverChromeMarks stays short.
const collectHighlightBandSeries = (ctx: Readonly<ComposedMarksContext>): HighlightBandSeries[] => {
  const highlightSeries: HighlightBandSeries[] = [];
  for (const series of ctx.composedSeries) {
    if (series.showHighlight) {
      highlightSeries.push({
        color: series.stroke,
        curve: d3Curve(ctx.highlightCurveByKey.get(series.dataKey) ?? curveNatural),
        dataKey: series.dataKey,
        showHighlight: series.showHighlight,
        strokeWidth: series.strokeWidth,
      });
    }
  }
  return highlightSeries;
};

const appendHoverChromeMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  ctx: Readonly<ComposedMarksContext>,
): void => {
  // Hover dots/bands read raw d[dataKey] with no per-axis projection (legacy limitation, kept).
  const indicatorColor = ctx.tooltip?.indicatorColor;
  if (ctx.tooltipEnabled && (ctx.tooltip?.showCrosshair ?? true)) {
    marks.push(
      buildIndicatorMark({
        color: isString(indicatorColor) ? indicatorColor : undefined,
        columnWidth: ctx.tooltip?.columnWidth,
        dasharray: ctx.tooltip?.indicatorDasharray,
        discrete: ctx.isDiscrete,
        gradientId: ctx.crosshairGradientId,
        span: ctx.tooltip?.indicatorSpan,
        width: ctx.tooltip?.indicatorWidth,
      }),
    );
  }
  if (ctx.tooltipEnabled && (ctx.tooltip?.showDots ?? true)) {
    appendHoverDotMarks(marks, ctx);
  }
  if (ctx.tooltipEnabled) {
    marks.push(
      ...buildHighlightBandMarks(
        ctx.renderData,
        ctx.xDataKey,
        ctx.hoveredIndex,
        collectHighlightBandSeries(ctx),
        { discrete: ctx.isDiscrete },
      ),
    );
  }
};

const buildComposedMarks = (ctx: Readonly<ComposedMarksContext>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  // Bklit layer order: bars under area under line.
  // Bklit parity: legend dim is per-mark opacity, not programmatic focus.
  const dimOpacityByKey = new Map(ctx.composedSeries.map((series: Readonly<ComposedSeriesEntry>) => [series.dataKey, series.dimOpacity] as const));
  appendBarMarks(marks, ctx);
  appendAreaMarks(marks, ctx, dimOpacityByKey);
  appendLineMarks(marks, ctx, dimOpacityByKey);
  appendHoverChromeMarks(marks, ctx);
  appendProjectionMarks(marks, {
    heightPx: ctx.heightPx,
    margin: ctx.margin,
    markerFallbacks: ctx.projectionMarkerFallbacks,
    projectionConfigs: ctx.projectionConfigs,
    projectionGradientBaseId: ctx.projectionGradientBaseId,
    projectionLines: ctx.projectionLines,
    strokeFallbacks: ctx.projectionStrokeFallbacks,
    timeExtent: ctx.timeExtent,
    timeExtentRaw: ctx.timeExtentRaw,
    width: ctx.width,
    yDomain: ctx.yDomain,
  });
  return marks;
};

export {
  buildComposedMarks,
};
export type { ComposedMarksContext };
