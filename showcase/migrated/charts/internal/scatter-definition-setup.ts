import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ChartMark, ChartScale, DomChartDefinition } from "@tanstack/charts";
import { useChartConfig } from "./use-chart-config";
import type { SpringConfig } from "./chart-config-context";
import type { createScatterFocusStrategy } from "./scatter-focus-strategy";
import { resolveMotionEasing } from "./reveal-easing";
import { buildAllSeriesMarks } from "./scatter-series-marks";
import { buildTooltipMarks } from "./scatter-tooltip-marks";
import { assembleScatterDefinition } from "./scatter-definition-assemble";
import type { ScatterLabelFade } from "./scatter-pill-chrome";
import type { ResolvedSeries } from "./scatter-marks";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { ChartMargin } from "./use-chart-margin";
import { DEFAULT_CHART_MARGIN, useChartMargin } from "./use-chart-margin";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import type { ScatterDomains } from "./scatter-domains-setup";
import type { ScatterScales } from "./scatter-scale-setup";
import type { ScatterSeriesSetup } from "./scatter-series-setup";
import type { ScatterTimingModel } from "./scatter-reveal-setup";

// Seconds<->milliseconds conversion for enter-motion delay math.
const MS_PER_SECOND = 1000;

interface BuildScatterAllMarksParams {
  readonly crosshairGradientId: string;
  readonly data: readonly ChartDatum[];
  readonly gradientIdBySeries: Readonly<Map<string, string>>;
  readonly innerWidth: number;
  readonly pointerFocusActive: boolean;
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
  readonly xDataKey: string;
}

interface ScatterAllMarks {
  readonly discrete: boolean;
  readonly seriesMarks: ChartMark<ChartDatum, Date, number>[];
  readonly tooltipMarks: ChartMark<ChartDatum, Date, number>[];
}

const buildScatterAllMarks = ({
  crosshairGradientId,
  data,
  gradientIdBySeries,
  innerWidth,
  pointerFocusActive,
  projectorFor,
  resolvedSeries,
  revealDurationMs,
  revealEasingCss,
  tooltip,
  tooltipSpring,
  xDataKey,
}: Readonly<BuildScatterAllMarksParams>): ScatterAllMarks => {
  const durationSec = revealDurationMs / MS_PER_SECOND;
  const easing = resolveMotionEasing(revealEasingCss);
  // Dense data snaps instead of springing (bklit DISCRETE_INTERACTION_THRESHOLD).
  const discrete = data.length > DISCRETE_INTERACTION_THRESHOLD;
  const seriesMarks = buildAllSeriesMarks({
    durationSec,
    easing,
    gradientIdBySeries,
    innerWidth,
    pointerFocusActive,
    projectorFor,
    renderData: data,
    resolvedSeries,
    xDataKey,
  });
  const tooltipMarks = buildTooltipMarks({
    crosshairGradientId,
    discrete,
    projectorFor,
    renderData: data,
    resolvedSeries,
    tooltip,
    tooltipSpring,
    xDataKey,
  });
  return { discrete, seriesMarks, tooltipMarks };
};

interface BuildScatterDefinitionStateParams {
  readonly config: { readonly tooltipBoxSpring: Readonly<SpringConfig>; readonly tooltipSpring: Readonly<SpringConfig> };
  readonly crosshairGradientId: string;
  readonly data: readonly ChartDatum[];
  readonly gradientIdBySeries: Readonly<Map<string, string>>;
  readonly grid: ExtractedChildren["grid"];
  readonly labelFade: ScatterLabelFade | null;
  readonly margin: ChartMargin;
  readonly pointerFocusActive: boolean;
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly scatterFocusStrategy: ReturnType<typeof createScatterFocusStrategy>;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly width: number;
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xScale: ChartScale;
  readonly yScale: ChartScale;
}

const buildScatterDefinitionState = ({
  config,
  crosshairGradientId,
  data,
  gradientIdBySeries,
  grid,
  labelFade,
  margin,
  pointerFocusActive,
  projectorFor,
  resolvedSeries,
  revealDurationMs,
  revealEasingCss,
  scatterFocusStrategy,
  tooltip,
  width,
  xAxis,
  xDataKey,
  xScale,
  yScale,
}: Readonly<BuildScatterDefinitionStateParams>): DomChartDefinition<ChartDatum, Date, number> | undefined => {
  const marks = buildScatterAllMarks({
    crosshairGradientId,
    data,
    gradientIdBySeries,
    innerWidth: Math.max(0, width - margin.left - margin.right),
    pointerFocusActive,
    projectorFor,
    resolvedSeries,
    revealDurationMs,
    revealEasingCss,
    tooltip,
    tooltipSpring: config.tooltipSpring,
    xDataKey,
  });
  return assembleScatterDefinition({
    discrete: marks.discrete,
    grid,
    labelFade,
    margin,
    scatterFocusStrategy,
    seriesMarks: marks.seriesMarks,
    tooltip,
    tooltipBoxSpring: config.tooltipBoxSpring,
    tooltipMarks: marks.tooltipMarks,
    xAxis,
    xScale,
    yScale,
  });
};

interface UseScatterDefinitionModelParams {
  readonly data: readonly ChartDatum[];
  readonly domains: ScatterDomains;
  readonly marginProp: Partial<ChartMargin> | undefined;
  readonly scales: ScatterScales;
  readonly scatterFocusStrategy: ReturnType<typeof createScatterFocusStrategy>;
  readonly series: ScatterSeriesSetup;
  readonly timing: ScatterTimingModel;
  readonly xDataKey: string;
}

interface ScatterDefinitionModel {
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
  readonly margin: ChartMargin;
  readonly setLabelFade: Dispatch<SetStateAction<ScatterLabelFade | null>>;
  readonly setPointerFocusActive: Dispatch<SetStateAction<boolean>>;
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const useScatterDefinitionModel = ({
  data,
  domains,
  marginProp,
  scales,
  scatterFocusStrategy,
  series,
  timing,
  xDataKey,
}: Readonly<UseScatterDefinitionModelParams>): ScatterDefinitionModel => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const { tooltipBoxSpring, tooltipSpring } = useChartConfig();

  const [labelFade, setLabelFade] = useState<ScatterLabelFade | null>(null);
  // PointerFocusActive drives the base layer's dim+blur class at mark-build time (no blur in states).
  const [pointerFocusActive, setPointerFocusActive] = useState(false);

  const definition = useMemo((): DomChartDefinition<ChartDatum, Date, number> | undefined => {
    if (series.width <= 0) {return undefined;}
    return buildScatterDefinitionState({
      config: { tooltipBoxSpring, tooltipSpring },
      crosshairGradientId: series.crosshairGradientId,
      data,
      gradientIdBySeries: series.gradientIdBySeries,
      grid: series.grid,
      labelFade,
      margin,
      pointerFocusActive,
      projectorFor: domains.projectorFor,
      resolvedSeries: series.resolvedSeries,
      revealDurationMs: timing.revealDurationMs,
      revealEasingCss: timing.revealEasingCss,
      scatterFocusStrategy,
      tooltip: series.tooltip,
      width: series.width,
      xAxis: series.xAxis,
      xDataKey,
      xScale: scales.xScale,
      yScale: scales.yScale,
    });
  }, [series.crosshairGradientId, data, series.gradientIdBySeries, series.grid, labelFade, margin, pointerFocusActive, domains.projectorFor, series.resolvedSeries, timing.revealDurationMs, timing.revealEasingCss, scatterFocusStrategy, series.tooltip, tooltipBoxSpring, tooltipSpring, series.width, series.xAxis, xDataKey, scales.xScale, scales.yScale]);

  return { definition, margin, setLabelFade, setPointerFocusActive, tooltipSpring };
};

export { buildScatterAllMarks, buildScatterDefinitionState, useScatterDefinitionModel };
export type { BuildScatterAllMarksParams, BuildScatterDefinitionStateParams, ScatterAllMarks, ScatterDefinitionModel, UseScatterDefinitionModelParams };
