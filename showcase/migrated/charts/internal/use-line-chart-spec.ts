// Line-chart marks, scale options, and chart definition.
import { useMemo } from "react";
import type { RefObject } from "react";
import type { ScaleTime } from "d3-scale";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip as packageTooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import type { ChartControl, ChartMark, ChartTooltipInput, DomChartDefinition } from "@tanstack/charts";
import { resolveGridGuide } from "./grid";
import { toSpecCrosshairGradient } from "./fade-mask";
import { buildCrosshairGradientDef } from "./focus-marks";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, TOOLTIP_BOX_SPRING } from "./design-tokens";
import { CARTESIAN_MAX_FOCUS_DISTANCE_PX } from "./cartesian-focus-distance";
import type { ChartPhase } from "./chart-phase";
import {
  LEGEND_DIM_OPACITY,
  buildBaseSeriesMarks,
  buildMarkerDotMarks,
  buildTooltipChromeMarks,
} from "./line-series-marks";
import {
  gridHighlightRowMarks,
} from "./grid-highlight-mark";
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
import type { MarkerRevealSeriesConfig } from "./parity/animation";
import type { ChartMargin } from "./use-chart-margin";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { ProjectionLineConfig } from "./projection-config";
import { DEFAULT_LINE_STROKE, DEFAULT_LINE_STROKE_WIDTH, DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX, DEFAULT_PROJECTION_LINE_CLASS_NAME, PROJECTION_FALLBACK_STROKE, isString } from "./line-chart-support";

interface LineChartSpecParams {
  readonly brushControls: readonly ChartControl<Date, number>[];
  readonly chartPhase: ChartPhase;
  readonly crosshairGradientId: string;
  readonly effectiveYDomainTweenDuration: number;
  readonly grid: ExtractedChildren["grid"];
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

interface LineTooltipOptionParams {
  readonly discrete: boolean;
  readonly enabled: boolean;
}

// Panel top pins to the plot top; the x follows the primary focused point.
const buildLineTooltipOption = ({ discrete, enabled }: Readonly<LineTooltipOptionParams>): ChartTooltipInput<ChartDatum, Date, number, "dom"> | false => {
  if (!enabled) {return false;}
  return {
    anchor: (_points, context) => ({
      x: context.focus.primary.x,
      y: context.plot.y - BOX_OFFSET,
    }),
    className: "bkm-native-tooltip",
    motion: discrete
      ? (false as const)
      : { damping: TOOLTIP_BOX_SPRING.damping, stiffness: TOOLTIP_BOX_SPRING.stiffness, type: "spring" as const },
    offset: BOX_OFFSET,
    placement: ["bottom-right", "bottom-left"] as const,
    portal,
    sticky: false,
    use: packageTooltip,
  };
};

const useLineChartSpec = (params: Readonly<LineChartSpecParams>): LineChartSpec => {
  const { brushControls, crosshairGradientId, effectiveYDomainTweenDuration, grid, hoveredIndex, hoveredIndexForPL, isDiscrete, isLoading, labelFade, legendHoveredIndex, lines, margin, markerGradientIdByKey, markerSeriesConfigs, plTooltipSignIndex, profitLossLines, projectionConfigs, projectionGradientBaseId, projectionLines, projectorFor, renderData, timeExtent, timeExtentRaw, tooltip, tooltipEnabled, visibleData, width, xAxis, xDataKey, xDomain, xScaleD3Ref, yAxis, yDomainFinal } = params;
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
      // Highlight rows are native ruleY marks; identity preserves filtering.
      base.unshift(...gridHighlightRowMarks({ grid, yScale: (value: number): number => value }));
      base.push(
        ...buildProfitLossMarks({ focusedIndex: hoveredIndexForPL ?? plTooltipSignIndex, gradientBaseId: projectionGradientBaseId, isLoading, profitLossLines, renderData, timeExtent, timeExtentRaw, width, xDataKey }),
        ...buildProjectionLineMarks({ fallbackStroke: PROJECTION_FALLBACK_STROKE, gradientBaseId: projectionGradientBaseId, isLoading, projectionConfigs, projectionDefaultClassName: DEFAULT_PROJECTION_LINE_CLASS_NAME, projectionDefaultEndpointRadius: DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX, projectionLines, timeExtent, timeExtentRaw, width }),
      );
      return base;
    },
    [renderData, xDataKey, lines, isLoading, width, projectorFor, projectionConfigs, projectionLines, projectionGradientBaseId, profitLossLines, hoveredIndexForPL, plTooltipSignIndex, grid, markerSeriesConfigs, markerGradientIdByKey, timeExtent, timeExtentRaw, tooltipEnabled, tooltip, crosshairGradientId, isDiscrete, hoveredIndex, legendHoveredIndex],
  );

  const spec = useMemo(() => {
    // Width never drops below the host initialWidth (V1.7): no width guard.
    const xScale = createLineXScale({ renderData, scaleRef: xScaleD3Ref, timeExtent, visibleData, xAxis, xDataKey, xDomain });
    const gridGuide = resolveGridGuide(grid);
    const xTickLabelOpacity = resolveXTickLabelOpacity(labelFade, xAxis);
    // Enter and y-domain updates ride package motion; the renderer owns the paint.
    const { motion, tickLabelMotion } = resolveLineMotions(effectiveYDomainTweenDuration);
    const xScaleOptions = buildLineXScaleOptions({ gridGuide, marginBottom: margin.bottom, tickLabelMotion, xAxis, xScale, xTickLabelOpacity });
    const yScaleOptions = buildLineYScaleOptions({ gridGuide, niced: yDomainFinal, tickLabelMotion, yAxis });
    // Crosshair fade spans the plot vertically, so the bbox spec form paints identically.
    const crosshairColor = isString(tooltip?.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    const crosshairDef = tooltipEnabled && (tooltip?.showCrosshair ?? true)
      ? buildCrosshairGradientDef(crosshairGradientId, crosshairColor)
      : undefined;
    return {
      // Brushed x-domains clip marks to the plot; overlays stay unclipped (G21).
      clip: xDomain !== undefined,
      controls: brushControls,
      focus: "group-x" as const,
      // Bklit has no focus ring; the hover dot is the indicator.
      focusRing: false,
      gradients: crosshairDef === undefined ? [] : [toSpecCrosshairGradient(crosshairDef)],
      margin,
      marks,
      maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX,
      motion,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: {
        x: xScaleOptions,
        y: yScaleOptions,
      },
      svgAnimation: false as const,
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: buildLineTooltipOption({
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        enabled: tooltip?.enabled ?? false,
      }),
    };
  }, [marks, renderData, xDataKey, grid, yDomainFinal, margin, effectiveYDomainTweenDuration, xDomain, timeExtent, tooltip, tooltipEnabled, crosshairGradientId, xAxis, yAxis, visibleData, labelFade, brushControls, xScaleD3Ref]);

  const definition = useMemo((): DomChartDefinition<ChartDatum, Date, number> => defineChart(spec), [spec]);
  return { definition };
};

export { useLineChartSpec };
export type { LineChartSpec, LineChartSpecParams };
