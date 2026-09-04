// Line-chart marks, scale options, and chart definition.
import { useMemo } from "react";
import type { RefObject } from "react";
import type { ScaleTime } from "d3-scale";
import { defineChart } from "@tanstack/charts/scene";
import type { ChartControl, ChartMark, DomChartDefinition } from "@tanstack/charts";
import { resolveGridGuide } from "./grid";
import { bezierEasing } from "./bezier-easing";
import { DISCRETE_INTERACTION_THRESHOLD, TOOLTIP_BOX_SPRING } from "./design-tokens";
import { buildNativeTooltipExtension } from "./native-tooltip";
import { isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import {
  LEGEND_DIM_OPACITY,
  buildBaseSeriesMarks,
  buildMarkerDotMarks,
  buildTooltipChromeMarks,
} from "./line-series-marks";
import {
  buildGridHighlightRowMarks,
} from "./line-marker-anchors";
import {
  buildProfitLossMarks,
  buildProjectionLineMarks,
} from "./line-overlay-marks";
import {
  buildLineXScaleOptions,
  buildLineYScaleOptions,
  createLineXScale,
  resolveLineMotions,
  resolveXTickLabelOpacity,
} from "./line-x-scale";
import type { LabelFadeState } from "./line-x-scale";
import type { MarkerRevealSeriesConfig } from "./line-marker-reveal";
import type { ChartMargin } from "./use-chart-margin";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { ProjectionLineConfig } from "./projection-config";
import { DEFAULT_LINE_STROKE, DEFAULT_LINE_STROKE_WIDTH, DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX, DEFAULT_PROJECTION_LINE_CLASS_NAME, PROJECTION_FALLBACK_STROKE } from "./line-chart-support";

interface LineChartSpecParams {
  readonly brushControls: readonly ChartControl<Date, number>[];
  readonly chartPhase: ChartPhase;
  readonly crosshairGradientId: string;
  readonly effectiveYDomainTweenDuration: number;
  readonly grid: ExtractedChildren["grid"];
  readonly heightPx: number;
  readonly hoveredIndex: number | null;
  readonly hoveredIndexForPL: number | null;
  readonly isDiscrete: boolean;
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
  readonly labelFade: Readonly<LabelFadeState> | undefined;
  readonly legendHoveredIndex: number | null;
  readonly lines: ExtractedChildren["lines"];
  readonly margin: Readonly<ChartMargin>;
  readonly markerGradientIdByKey: Readonly<Map<string, string>>;
  readonly markerSeriesConfigs: readonly Readonly<MarkerRevealSeriesConfig>[];
  readonly plTooltipSignIndex: number | null;
  readonly profitLossLines: ExtractedChildren["profitLossLines"];
  readonly projectionConfigs: readonly ProjectionLineConfig[];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: ExtractedChildren["projectionLines"];
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly timeExtent: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly timeExtentRaw: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly visibleData: readonly Readonly<ChartDatum>[];
  readonly width: number;
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
  readonly xScaleD3Ref: RefObject<ScaleTime<number, number> | null>;
  readonly yAxis: ExtractedChildren["yAxis"];
  readonly yDomainChangedForTween: boolean;
  readonly yDomainFinal: [number, number];
}

interface LineChartSpec {
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
}

const useLineChartSpec = (params: Readonly<LineChartSpecParams>): LineChartSpec => {
  const { brushControls, chartPhase, crosshairGradientId, effectiveYDomainTweenDuration, grid, heightPx, hoveredIndex, hoveredIndexForPL, isDiscrete, isLoading, isLoaded, labelFade, legendHoveredIndex, lines, margin, markerGradientIdByKey, markerSeriesConfigs, plTooltipSignIndex, profitLossLines, projectionConfigs, projectionGradientBaseId, projectionLines, projectorFor, renderData, timeExtent, timeExtentRaw, tooltip, tooltipEnabled, visibleData, width, xAxis, xDataKey, xDomain, xScaleD3Ref, yAxis, yDomainChangedForTween, yDomainFinal } = params;
  const marks = useMemo<ChartMark<ChartDatum, Date, number>[]>(
    () => {
      if (isLoading) {return [];}
      // Bklit parity: legend dim is plain strokeOpacity 0.3, not a focus state (single-owner slot).
      const legendHoveredKey = legendHoveredIndex === null ? undefined : lines[legendHoveredIndex]?.dataKey;
      const base = buildBaseSeriesMarks({ defaultStroke: DEFAULT_LINE_STROKE, defaultStrokeWidth: DEFAULT_LINE_STROKE_WIDTH, legendDimOpacity: LEGEND_DIM_OPACITY, legendHoveredKey, lines, projectorFor, renderData, xDataKey });
      base.push(
        ...buildMarkerDotMarks({ hasHover: hoveredIndex !== null, legendHoveredKey, markerGradientIdByKey, markerSeriesConfigs, renderData, xDataKey }),
        ...buildTooltipChromeMarks({ crosshairGradientId, defaultStroke: DEFAULT_LINE_STROKE, defaultStrokeWidth: DEFAULT_LINE_STROKE_WIDTH, hoveredIndex, isDiscrete, lines, renderData, tooltip, tooltipEnabled, xDataKey }),
      );
      base.unshift(...buildGridHighlightRowMarks({ grid, heightPx, marginBottom: margin.bottom, marginLeft: margin.left, marginRight: margin.right, marginTop: margin.top, width, yDomainFinal }));
      base.push(
        ...buildProfitLossMarks({ focusedIndex: hoveredIndexForPL ?? plTooltipSignIndex, gradientBaseId: projectionGradientBaseId, heightPx, isLoading, marginBottom: margin.bottom, marginLeft: margin.left, marginRight: margin.right, marginTop: margin.top, profitLossLines, renderData, timeExtent, timeExtentRaw, width, xDataKey, yDomainFinal }),
        ...buildProjectionLineMarks({ fallbackStroke: PROJECTION_FALLBACK_STROKE, gradientBaseId: projectionGradientBaseId, heightPx, isLoading, marginBottom: margin.bottom, marginLeft: margin.left, marginRight: margin.right, marginTop: margin.top, projectionConfigs, projectionDefaultClassName: DEFAULT_PROJECTION_LINE_CLASS_NAME, projectionDefaultEndpointRadius: DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX, projectionLines, timeExtent, timeExtentRaw, width, yDomainFinal }),
      );
      return base;
    },
    [renderData, xDataKey, lines, isLoading, width, heightPx, yDomainFinal, projectorFor, projectionConfigs, projectionLines, projectionGradientBaseId, margin, profitLossLines, hoveredIndexForPL, plTooltipSignIndex, grid, markerSeriesConfigs, markerGradientIdByKey, timeExtent, timeExtentRaw, tooltipEnabled, tooltip, crosshairGradientId, isDiscrete, hoveredIndex, legendHoveredIndex],
  );

  const spec = useMemo(() => {
    if (width <= 0) {return undefined;}
    const xScale = createLineXScale({ renderData, scaleRef: xScaleD3Ref, timeExtent, visibleData, xAxis, xDataKey, xDomain });
    const gridGuide = resolveGridGuide(grid);
    const xTickLabelOpacity = resolveXTickLabelOpacity(labelFade, xAxis);
    // Enter is false (RevealWipe owns it); update tweens only on y-domain change, else snaps.
    const yDomainTweenGateActive = isChartInteractionPhase(chartPhase) && isLoaded && yDomainChangedForTween;
    const { motion, tickLabelMotion } = resolveLineMotions(yDomainTweenGateActive, effectiveYDomainTweenDuration);
    const xScaleOptions = buildLineXScaleOptions({ gridGuide, marginBottom: margin.bottom, tickLabelMotion, xAxis, xScale, xTickLabelOpacity });
    const yScaleOptions = buildLineYScaleOptions({ gridGuide, niced: yDomainFinal, tickLabelMotion, yAxis });
    return {
      controls: brushControls,
      focus: "group-x" as const,
      // Bklit has no focus ring; the hover dot is the indicator.
      focusRing: false,
      margin,
      marks,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      motion,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: {
        x: xScaleOptions,
        y: yScaleOptions,
      },
      svgAnimation: yDomainTweenGateActive
        ? { duration: effectiveYDomainTweenDuration, easing: bezierEasing }
        : (false as const),
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: buildNativeTooltipExtension<ChartDatum, Date, number>({
        anchorX: "point",
        className: "bkm-native-tooltip",
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        enabled: tooltip?.enabled ?? false,
        spring: TOOLTIP_BOX_SPRING,
      }),
    };
  }, [marks, renderData, xDataKey, grid, width, yDomainFinal, yDomainChangedForTween, margin, chartPhase, isLoaded, effectiveYDomainTweenDuration, xDomain, timeExtent, tooltip, xAxis, yAxis, visibleData, labelFade, brushControls, xScaleD3Ref]);

  const definition = useMemo((): DomChartDefinition<ChartDatum, Date, number> | undefined => {
    if (spec === undefined) {return undefined;}
    return defineChart(spec);
  }, [spec]);
  return { definition };
};

export { useLineChartSpec };
export type { LineChartSpec, LineChartSpecParams };
