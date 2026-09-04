import { curveNatural } from "d3-shape";
import { d3Curve } from "@tanstack/charts/d3/shape";
import type {
  ChartMark,
} from "@tanstack/charts";
import { appendProjectionMarks } from "./composed-overlay-geometry";
import { appendAreaMarks, appendBarMarks, appendLineMarks } from "./composed-series-marks";
import {
  buildHoverDotMark,
  buildIndicatorMark,
  resolveHoverDotFill,
} from "./hover-geometry";
import { buildHighlightBandMarks } from "./highlight-band";
import type { HighlightBandSeries } from "./highlight-band";
import type { ChartDatum } from "./types";
import type {
  ComposedMarksContext,
  ComposedSeriesEntry,
} from "./composed-model";

const isString = <Value>(value: Value): value is Value & string => typeof value === "string";

const appendHoverDotMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  ctx: Readonly<ComposedMarksContext>,
): void => {
  for (const series of ctx.composedSeries) {
    marks.push(
      buildHoverDotMark(
        {
          fill: resolveHoverDotFill(series.stroke, ctx.tooltip?.dotColor),
          options: { discrete: ctx.isDiscrete, size: ctx.tooltip?.dotSize, strokeWidth: ctx.tooltip?.dotStrokeWidth },
          renderData: ctx.data,
          series: { color: series.stroke, dataKey: series.dataKey },
          xDataKey: ctx.xDataKey,
        },
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
        {
          hoveredIndex: ctx.hoveredIndex,
          options: { discrete: ctx.isDiscrete },
          renderData: ctx.renderData,
          series: collectHighlightBandSeries(ctx),
          xDataKey: ctx.xDataKey,
        },
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
export type { ComposedMarksContext } from "./composed-model";
