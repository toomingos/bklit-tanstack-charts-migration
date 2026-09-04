import { useCallback, useMemo } from "react";
import type { ReactNode, RefObject } from "react";
import type { ChartMark, ChartPositionScaleOptions, ChartScale } from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import type { ScaleLinear, ScaleTime } from "d3-scale";
import type { CurveFactory } from "d3-shape";
import { buildPrecomputedXAxisOptions, hiddenAxisOptions } from "./axis-ticks";
import { resolveGridGuide } from "./grid";
import { buildComposedMarks } from "./composed-marks";
import { buildComposedMotion, buildComposedXScale, buildComposedYScale, buildXTickLabelOpacity } from "./composed-scales";
import type { ComposedMotion } from "./composed-scales";
import type {
  ComposedScalesContext,
  ComposedSeriesEntry,
  ResolvedArea,
  ResolvedBar,
  ResolvedLine,
} from "./composed-model";
import type { TimeBounds } from "./composed-data-math";
import { useChartLegendHover } from "./chart-legend-hover-context";
import type { ProjectionLineConfig } from "./projection-config";
import {
  DEFAULT_AREA_DIM_OPACITY,
  DEFAULT_LINE_DIM_OPACITY,
  NOTHING,
  PROJECTION_MARKER_FALLBACKS,
  PROJECTION_STROKE_FALLBACKS,
} from "./composed-series";
import type { ComposedGradientDef } from "./composed-series";
import { isNumberValue, stringifyDatumField } from "./composed-datum-text";
import { weekdayDateFmt } from "./formatters";
import { renderSeriesTooltipBody } from "./native-tooltip";
import type {
  ChartDatum,
  ChartTooltipConfig,
  GridConfig,
  TooltipRow,
  XAxisConfig,
} from "./types";
import { useSanitizedId } from "./use-sanitized-id";
import type { ChartMargin } from "./use-chart-margin";
import type { ComposedLabelFade } from "./use-composed-hover";

const DEFAULT_TICK_COUNT = 5;

interface NativeComposedGradientStop {
  color: string;
  offset: number;
  opacity: number;
}

interface NativeComposedGradient {
  id: string;
  stops: NativeComposedGradientStop[];
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface UseComposedAreaGradientsResult {
  readonly gradientDefs: ComposedGradientDef[];
  readonly gradientIdBySeries: Map<string, string>;
  readonly nativeComposedGradients: NativeComposedGradient[];
}

const useComposedAreaGradients = (
  resolvedAreas: readonly Readonly<ResolvedArea>[],
): UseComposedAreaGradientsResult => {
  const gradientBaseId = useSanitizedId();
  const gradientDefs = useMemo<ComposedGradientDef[]>(
    () =>
      resolvedAreas.map((area: Readonly<ResolvedArea>, areaIndex: number) => ({
        dataKey: area.dataKey,
        fill: area.fill,
        fillOpacity: area.fillOpacity,
        id: `${gradientBaseId}-area-grad-${areaIndex}`,
      })),
    [gradientBaseId, resolvedAreas],
  );
  const nativeComposedGradients = useMemo(
    () =>
      gradientDefs.map((grad: Readonly<ComposedGradientDef>) => ({
        id: grad.id,
        stops: [
          { color: grad.fill, offset: 0, opacity: grad.fillOpacity },
          { color: grad.fill, offset: 1, opacity: 0 },
        ],
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 1,
      })),
    [gradientDefs],
  );
  const gradientIdBySeries = useMemo(() => {
    const map = new Map<string, string>();
    for (const grad of gradientDefs) {map.set(grad.dataKey, grad.id);}
    return map;
  }, [gradientDefs]);
  return { gradientDefs, gradientIdBySeries, nativeComposedGradients };
};

interface UseComposedTooltipBodyParams {
  readonly composedSeries: readonly Readonly<ComposedSeriesEntry>[];
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly xDataKey: string;
}

const useComposedTooltipBody = (
  params: Readonly<UseComposedTooltipBodyParams>,
): ((ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode) => {
  const { composedSeries, tooltip, xDataKey } = params;
  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum, rowsCtx) => {
          const rows: TooltipRow[] = [];
          // Single lookup table: series count is small but the tooltip body
          // Rebuilds on every hover move, so avoid a linear scan per series.
          const colorByMarkId = new Map(rowsCtx.points.map((point) => [point.markId, point.color] as const));
          for (const series of composedSeries) {
            const value = datum[series.dataKey];
            const pointColor = colorByMarkId.get(series.dataKey);
            const { stroke } = series;
            const strokeColor = stroke === "" ? NOTHING : stroke;
            rows.push({
              color: strokeColor ?? (pointColor !== NOTHING && pointColor !== "" ? pointColor : "transparent"),
              label: series.dataKey,
              value: isNumberValue(value) ? value : stringifyDatumField({ absent: "0", value }),
            });
          }
          return rows;
        },
        resolveTitle: (datum) => {
          const date = datum[xDataKey];
          return date instanceof Date ? weekdayDateFmt.format(date) : NOTHING;
        },
        tooltip,
      }),
    [tooltip, xDataKey, composedSeries],
  );
  return renderTooltipBody;
};

interface UseComposedChartMarksParams {
  readonly barGap: number;
  readonly barSize: number | undefined;
  readonly composedSeries: readonly Readonly<ComposedSeriesEntry>[];
  readonly composedStackOffsets: Map<number, Map<string, number>> | undefined;
  readonly crosshairGradientId: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly gradientIdBySeries: ReadonlyMap<string, string>;
  readonly grid: GridConfig | null;
  readonly heightPx: number;
  readonly hoveredIndex: number | null;
  readonly isDiscrete: boolean;
  readonly margin: Readonly<ChartMargin>;
  readonly maxBarSize: number | undefined;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ChartDatum>[];
  readonly renderData: readonly Readonly<ChartDatum>[];  readonly resolvedAreas: readonly Readonly<ResolvedArea>[];
  readonly resolvedBars: readonly Readonly<ResolvedBar>[];
  readonly resolvedLines: readonly Readonly<ResolvedLine>[];
  readonly stackGap: number;
  readonly stacked: boolean;
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xAxis: XAxisConfig | undefined;
  readonly xDataKey: string;
  readonly xScaleRef: RefObject<ScaleTime<number, number> | null>;
  readonly yDomain: [number, number];
  readonly yScaleRef: RefObject<ScaleLinear<number, number> | null>;
}

interface UseComposedChartMarksResult {
  readonly marks: ChartMark<ChartDatum, Date, number>[] | undefined;
  readonly scales: { xScale: ChartScale; yScale: ChartScale } | undefined;
}

const useComposedChartMarks = (params: Readonly<UseComposedChartMarksParams>): UseComposedChartMarksResult => {
  const {
    barGap, barSize, composedSeries, composedStackOffsets, crosshairGradientId, data,
    gradientIdBySeries, grid, heightPx, hoveredIndex, isDiscrete, margin, maxBarSize,
    projectValue, projectionConfigs, projectionGradientBaseId, projectionLines, renderData,
    resolvedAreas, resolvedBars, resolvedLines, stackGap, stacked, timeExtent, timeExtentRaw,
    tooltip, tooltipEnabled, width, xAxis, xDataKey, xScaleRef, yDomain, yScaleRef,
  } = params;
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  // Highlight band sources the deduped series list: shared dataKeys must not double-push a mark.
  const highlightCurveByKey = useMemo(() => {
    const byKey = new Map<string, CurveFactory>();
    for (const area of resolvedAreas) {byKey.set(area.dataKey, area.curve);}
    for (const lineCfg of resolvedLines) {byKey.set(lineCfg.dataKey, lineCfg.curve);}
    return byKey;
  }, [resolvedAreas, resolvedLines]);

  const marks = useMemo(() => {
    if (width <= 0) {return NOTHING;}
    // Bklit parity: legend dim is per-mark opacity, not programmatic focus.
    const legendHoveredKey =
      legendHoveredIndex === null ? NOTHING : (composedSeries[legendHoveredIndex]?.dataKey ?? NOTHING);
    return buildComposedMarks({
      areaDimFallback: DEFAULT_AREA_DIM_OPACITY,
      barGap,
      barSize,
      composedSeries,
      composedStackOffsets,
      crosshairGradientId,
      data,
      gradientIdBySeries,
      heightPx,
      highlightCurveByKey,
      hoveredIndex,
      isDiscrete,
      legendHoveredKey,
      lineDimFallback: DEFAULT_LINE_DIM_OPACITY,
      margin,
      maxBarSize,
      projectValue,
      projectionConfigs,
      projectionGradientBaseId,
      projectionLines,
      projectionMarkerFallbacks: PROJECTION_MARKER_FALLBACKS,
      projectionStrokeFallbacks: PROJECTION_STROKE_FALLBACKS,
      renderData,
      resolvedAreas,
      resolvedBars,
      resolvedLines,
      stackGap,
      stacked,
      timeExtent,
      timeExtentRaw,
      tooltip,
      tooltipEnabled,
      width,
      xDataKey,
      yDomain,
    });
  }, [
    width,
    legendHoveredIndex,
    composedSeries,
    barGap,
    barSize,
    composedStackOffsets,
    crosshairGradientId,
    data,
    gradientIdBySeries,
    heightPx,
    highlightCurveByKey,
    hoveredIndex,
    isDiscrete,
    margin,
    maxBarSize,
    projectionConfigs,
    projectionLines,
    projectionGradientBaseId,
    projectValue,
    renderData,
    resolvedAreas,
    resolvedBars,
    resolvedLines,
    stackGap,
    stacked,
    timeExtent,
    timeExtentRaw,
    tooltip,
    tooltipEnabled,
    xDataKey,
    yDomain,
  ]);
  const scales = useMemo(() => {
    if (width <= 0) {return NOTHING;}
    const ctx: ComposedScalesContext = {
      data,
      grid,
      projectionConfigs,
      renderData,
      tickCountFallback: DEFAULT_TICK_COUNT,
      timeExtent,
      xAxis,
      xDataKey,
      xScaleRef,
      yDomain,
      yScaleRef,
    };
    return {
      xScale: buildComposedXScale(ctx),
      yScale: buildComposedYScale(ctx),
    };
  }, [
    width,
    data,
    grid,
    projectionConfigs,
    renderData,
    timeExtent,
    xAxis,
    xDataKey,
    yDomain,
    xScaleRef,
    yScaleRef,
  ]);
  return { marks, scales };
};

interface BuildComposedScaleOptionsParams {
  readonly gateActive: boolean;
  readonly grid: GridConfig | null;
  readonly labelFade: Readonly<ComposedLabelFade> | undefined;
  readonly marginBottom: number;
  readonly scales: { xScale: ChartScale; yScale: ChartScale };
  readonly xAxis: XAxisConfig | undefined;
}

interface BuildComposedScaleOptionsResult {
  readonly motion: ComposedMotion["motion"];
  readonly tickLabelMotion: ComposedMotion["tickLabelMotion"];
  readonly xScaleOptions: ChartPositionScaleOptions<Date>;
  readonly yScaleOptions: ChartPositionScaleOptions<number>;
}

const buildComposedScaleOptions = (
  params: Readonly<BuildComposedScaleOptionsParams>,
): BuildComposedScaleOptionsResult => {
  const gridGuide = resolveGridGuide(params.grid);
  const xTickLabelOpacity = buildXTickLabelOpacity({ labelFade: params.labelFade, xAxis: params.xAxis });
  const { motion, tickLabelMotion } = buildComposedMotion(params.gateActive);
  const xScaleOptions: ChartPositionScaleOptions<Date> = {
    axis: buildPrecomputedXAxisOptions({
      columnTicks: gridGuide.columnTicks,
      marginBottom: params.marginBottom,
      tickLabelMotion,
      xAxis: params.xAxis,
      xTickLabelOpacity,
    }),
    grid: gridGuide.vertical,
    scale: params.scales.xScale,
  };
  const yScaleOptions: ChartPositionScaleOptions<number> = {
    axis: hiddenAxisOptions(gridGuide.ticks),
    grid: gridGuide.horizontal,
    scale: params.scales.yScale,
  };
  return { motion, tickLabelMotion, xScaleOptions, yScaleOptions };
};

export { buildComposedScaleOptions, useComposedAreaGradients, useComposedChartMarks, useComposedTooltipBody };
export type {
  BuildComposedScaleOptionsParams,
  BuildComposedScaleOptionsResult,
  NativeComposedGradient,
  UseComposedAreaGradientsResult,
  UseComposedChartMarksParams,
  UseComposedChartMarksResult,
  UseComposedTooltipBodyParams,
};
