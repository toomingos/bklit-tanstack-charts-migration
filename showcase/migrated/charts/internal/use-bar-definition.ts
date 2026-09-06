// Bar definition hook: gradient ids, axis section, hover marks and chart definition.
// Split from bar-chart.tsx without behaviour change.
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ScaleBand } from "d3-scale";
import type { ChartFocusStrategy, ChartMotionDefinition, ChartMotionPhase, ChartMotionTiming, DomChartDefinition } from "@tanstack/charts";
import { BAR_ENTER_STAGGER_SPREAD_FRACTION, buildBarAxisSection, buildBarHoverMarks, buildNativeDepthGradients } from "./bar-chart-overlays";
import { buildBarDefinition, buildSquareGradientDef } from "./bar-chart-series-marks";
import { GROUP_GAP } from "./use-bar-scales";
import type { ResolvedBarColumnTrack, ResolvedBarSquare, ResolvedSeries, ResolvedSquareDef, SquareGradientDef } from "./bar-chart-series-marks";
import { buildNegBarStops, buildPosBarStops, BAR_FADED_OPACITY, DEFAULT_GROUND_SHADOW as DEFAULT_BAR_DEPTH_GROUND_SHADOW } from "./bar-depth-marks";
import type { BarDepthGradientIds } from "./bar-depth-marks";
import { buildPulseWaveStops } from "./bar-pulse-mark";
import { useChartConfig } from "./use-chart-config";
import { useSanitizedId } from "./use-sanitized-id";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import { resolveGridGuide } from "./grid";
import { resolveMotionEasing } from "./reveal-easing";
import { clipRevealTiming } from "./enter-transition";
import type { EnterTransition } from "./enter-transition";
import type { BarDepthBackConfig, BarDepthFrontConfig, BarDepthProviderConfig, BarPulseConfig, ChartDatum, ExtractedChildren } from "./types";
import type { ChartMargin } from "./use-chart-margin";
import type { createNicedYScale } from "./y-domain";

interface UseBarDefinitionOptions {
  readonly allSeriesKeys: readonly string[];
  readonly animationDuration: number;
  readonly animationEasing: string;
  readonly barDepthBacksRaw: readonly Readonly<BarDepthBackConfig>[];
  readonly barDepthFrontsRaw: readonly Readonly<BarDepthFrontConfig>[];
  readonly barDepthProvider: BarDepthProviderConfig | null;
  readonly barFocusStrategy: ChartFocusStrategy<ChartDatum, string, number>;
  readonly barPulsesRaw: readonly Readonly<BarPulseConfig>[];
  readonly barXAxis: ExtractedChildren["barXAxis"];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly categoryOrder: readonly string[];
  readonly dotSeriesList: readonly { readonly color: string; readonly dataKey: string }[];
  readonly enterTransition: Readonly<EnterTransition> | undefined;
  readonly grid: ExtractedChildren["grid"];
  readonly groupBandwidth: number;
  readonly groupScale: ScaleBand<string>;
  readonly hasBarColumnTrack: boolean;
  readonly hasBarSquares: boolean;
  readonly idPrefix?: string;
  readonly legendHoveredIndex: number | null;
  readonly margin: ChartMargin;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedBarColumnTracks: readonly ResolvedBarColumnTrack[];
  readonly resolvedBarSquares: readonly ResolvedBarSquare[];
  readonly resolvedSeries: readonly ResolvedSeries[];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly totalSeriesCount: number;
  readonly width: number;
  readonly xScaleFactory: () => ScaleBand<string>;
  readonly yScale: ReturnType<typeof createNicedYScale>;
}

interface UseBarDefinitionResult {
  readonly chartConfig: ReturnType<typeof useChartConfig>;
  readonly definition: DomChartDefinition<ChartDatum, string, number> | undefined;
  readonly hasBarDepth: boolean;
  readonly hasBarSquares: boolean;
  readonly revealDurationMs: number;
  readonly setLabelFade: Dispatch<SetStateAction<Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined>>;
  readonly squaresDefs: readonly ResolvedSquareDef[];
}

const useBarDefinition = (options: Readonly<UseBarDefinitionOptions>): UseBarDefinitionResult => {
  const {
    allSeriesKeys,
    animationDuration,
    animationEasing,
    barDepthBacksRaw,
    barDepthFrontsRaw,
    barDepthProvider,
    barFocusStrategy,
    barPulsesRaw,
    barXAxis,
    categoryAccessor,
    categoryOrder,
    dotSeriesList,
    enterTransition,
    grid,
    groupBandwidth,
    groupScale,
    hasBarColumnTrack,
    hasBarSquares,
    idPrefix,
    legendHoveredIndex,
    margin,
    projectValue,
    renderData,
    resolvedBarColumnTracks,
    resolvedBarSquares,
    resolvedSeries,
    tooltip,
    tooltipEnabled,
    totalSeriesCount,
    width,
    xScaleFactory,
    yScale,
  } = options;

  // Reveal replays on data change or revealSignature/animationDuration change (bklit epoch).
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    [enterTransition, animationDuration, animationEasing],
  );

  // Explicit per-mark enter motion: native auto-stagger is fixed at 1100ms, not prop-derived.
  // Update/exit stay false — legacy never animated those.
  const barEnterMotion = useMemo<ChartMotionDefinition<ChartDatum>>(() => {
    const easing = resolveMotionEasing(revealEasingCss);
    return (context: Readonly<{ phase: ChartMotionPhase; datumCount: number; datumIndex: number }>): false | ChartMotionTiming | undefined => {
      if (context.phase !== "enter") {return false;}
      const count = Math.max(1, context.datumCount);
      return {
        delay: (revealDurationMs * BAR_ENTER_STAGGER_SPREAD_FRACTION * context.datumIndex) / count,
        transition: { duration: revealDurationMs, easing, type: "tween" },
      };
    };
  }, [revealDurationMs, revealEasingCss]);

  const isHorizontalOrStacked = false;
  const barSquaresEnabled = hasBarSquares && totalSeriesCount > 0;
  const barColumnTrackEnabled = hasBarColumnTrack && totalSeriesCount > 0;
  const hasBarDepth = barDepthBacksRaw.length > 0 || barDepthFrontsRaw.length > 0 || barPulsesRaw.length > 0;
  const barDepthEnabled = hasBarDepth && !isHorizontalOrStacked;

  // Squares paint through a fixed 100px userSpace slice; ids stay mount-scoped.
  // Mount-scoped bases keep two BarCharts from sharing one gradient or pattern id.
  const indicatorFallbackId = useSanitizedId();
  const squaresFallbackId = useSanitizedId();
  const depthFallbackId = useSanitizedId();
  const indicatorGradientId = idPrefix === undefined ? indicatorFallbackId : `${idPrefix}-crosshair`;
  const squaresBaseId = idPrefix === undefined ? squaresFallbackId : `${idPrefix}-squares`;
  const squaresDefs = useMemo<readonly ResolvedSquareDef[]>(() => {
    if (!barSquaresEnabled) {return [];}
    const out: SquareGradientDef[] = [];
    for (let squareIndex = 0; squareIndex < resolvedBarSquares.length; squareIndex += 1) {
      const def = buildSquareGradientDef({ baseId: squaresBaseId, index: squareIndex, square: resolvedBarSquares[squareIndex] });
      if (def) {
        out.push(def);
      }
    }
    return out;
  }, [barSquaresEnabled, resolvedBarSquares, squaresBaseId]);
  const squaresDefsByKey = useMemo(() => {
    const defsByKey = new Map<string, typeof squaresDefs[number]>();
    for (const def of squaresDefs) {defsByKey.set(def.dataKey, def);}
    return defsByKey;
  }, [squaresDefs]);

  // One shared def: objectBoundingBox makes a single gradient correct for every bar height.
  const depthBaseId = idPrefix === undefined ? depthFallbackId : `${idPrefix}-depth`;
  const depthGroundShadow = barDepthProvider?.groundShadow ?? DEFAULT_BAR_DEPTH_GROUND_SHADOW;
  const depthGradientIds = useMemo<BarDepthGradientIds>(
    () => ({
      glassNegId: `${depthBaseId}-bar-depth-glass-neg`,
      glassPosId: `${depthBaseId}-bar-depth-glass-pos`,
      sideShadeLtrId: `${depthBaseId}-bar-depth-side-ltr`,
      sideShadeRtlId: `${depthBaseId}-bar-depth-side-rtl`,
      topShadeId: `${depthBaseId}-bar-depth-top-shade`,
    }),
    [depthBaseId],
  );
  const depthGlassPosStops = useMemo(() => buildPosBarStops(depthGroundShadow), [depthGroundShadow]);
  const depthGlassNegStops = useMemo(() => buildNegBarStops(depthGroundShadow), [depthGroundShadow]);
  const pulseWaveGradientId = `${depthBaseId}-bar-pulse-wave-grad`;
  const pulseWaveStops = useMemo(() => buildPulseWaveStops(), []);

  const nativeDepthGradients = useMemo(
    () => buildNativeDepthGradients({ depthGlassNegStops, depthGlassPosStops, depthGradientIds, pulseWaveGradientId, pulseWaveStops }),
    [depthGradientIds, depthGlassPosStops, depthGlassNegStops, pulseWaveStops, pulseWaveGradientId],
  );

  const chartConfig = useChartConfig();

  const [labelFade, setLabelFade] = useState<Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined>();

  const gridGuide = useMemo(() => resolveGridGuide(grid), [grid]);

  const axisSection = useMemo(
    () => buildBarAxisSection({ barXAxis, categoryOrder, gridGuide, labelFade, marginBottom: margin.bottom }),
    [barXAxis, categoryOrder, gridGuide, labelFade, margin.bottom],
  );

  const hoverMarks = useMemo(
    () =>
      buildBarHoverMarks({
        categoryAccessor,
        // Dense data snaps instead of springing (bklit threshold, strict >).
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        dotSeriesList,
        groupBandwidth,
        groupGap: dotSeriesList.length > 1 ? GROUP_GAP : 0,
        indicatorGradientId,
        projectValue,
        renderData,
        tooltip,
        tooltipEnabled,
        tooltipSpring: chartConfig.tooltipSpring,
      }),
    [categoryAccessor, chartConfig, dotSeriesList, groupBandwidth, indicatorGradientId, projectValue, renderData, tooltip, tooltipEnabled],
  );

  const definition = useMemo((): DomChartDefinition<ChartDatum, string, number> | undefined => {
    if (resolvedSeries.length === 0 && resolvedBarSquares.length === 0) {return undefined;}
    const hasSquares = barSquaresEnabled;
    const hasTrack = barColumnTrackEnabled;
    const hasDepth = barDepthEnabled;

    const { xAxisOptions, yAxisOptions } = axisSection;
    // Bklit parity: legend dim is per-mark opacity, not programmatic focus (single-owner slot).
    const legendHoveredKey = legendHoveredIndex === null ? undefined : (allSeriesKeys[legendHoveredIndex] ?? undefined);
    const depthLegendOpacity = legendHoveredIndex === null ? undefined : BAR_FADED_OPACITY;
    return buildBarDefinition({
      allSeriesKeys,
        barDepthBacksRaw,
      barDepthFrontsRaw,
      barEnterMotion,
      barFocusStrategy,
      barPulsesRaw,
      categoryAccessor,
        depthGradientIds,
      depthLegendOpacity,
      gridGuide,
      groupBandwidth,
      groupScale,
      hasDepth,
      hasSquares,
      hasTrack,
      hoverMarks,
      legendHoveredKey,
      margin,
      nativeDepthGradients,
      projectValue,
      pulseWaveGradientId,
      renderData,
      resolvedBarColumnTracks,
      resolvedBarSquares,
      resolvedSeries,
      squaresBaseId,
      squaresDefsByKey,
      tooltipEnabled,
      totalSeriesCount,
      width,
      xAxisOptions,
      xScaleFactory,
      yAxisOptions,
      yScale,
    });
  }, [
    width,
    resolvedSeries,
    resolvedBarSquares,
    barSquaresEnabled,
    barColumnTrackEnabled,
    barDepthEnabled,
    allSeriesKeys,
    legendHoveredIndex,
    axisSection,
    hoverMarks,
    gridGuide,
    groupScale,
    groupBandwidth,
    xScaleFactory,
    yScale,
    projectValue,
    categoryAccessor,
    margin,
    barFocusStrategy,
    totalSeriesCount,
    resolvedBarColumnTracks,
    squaresDefsByKey,
    squaresBaseId,
    depthGradientIds,
    nativeDepthGradients,
    pulseWaveGradientId,
    tooltipEnabled,
    renderData,
    barEnterMotion,
    barDepthBacksRaw,
    barDepthFrontsRaw,
    barPulsesRaw,
  ]);

  return {
    chartConfig,
    definition,
    hasBarDepth,
    hasBarSquares,
    revealDurationMs,
    setLabelFade,
    squaresDefs,
  };
};

export type { UseBarDefinitionOptions, UseBarDefinitionResult };
export { useBarDefinition };
