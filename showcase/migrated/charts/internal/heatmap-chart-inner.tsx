import { useMemo, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { HeatmapContext } from "./heatmap-context";
import type { HeatmapContextValue, HeatmapMargin } from "./heatmap-context";
import { useHeatmapChartLifecycle } from "./heatmap-lifecycle";
import type { HeatmapLifecycleState } from "./heatmap-lifecycle";
import { MIN_RENDERABLE_DIMENSION_PX, useHeatmapMargin, useHeatmapLayoutDimensions, useHeatmapColorScales } from "./heatmap-chart-inner-layout";
import type { HeatmapColumnLayout, HeatmapDimensionsResult, HeatmapColorScalesResult } from "./heatmap-chart-inner-layout";
import type { HeatmapColumn, HeatmapColumnSeparatorsConfig, HeatmapWeekStartDay } from "./heatmap-utils";
import type { HeatmapLevelColors, HeatmapLevelStyles } from "./heatmap-colors";
import type { HeatmapEnterTransition } from "./heatmap-animation";
import { HeatmapChartSurface } from "./heatmap-chart-surface";
import type { ChartStatus } from "./types";

/*
 * Extracted from heatmap-chart.tsx; memoisation shape and deps are unchanged from the single-file version.
 */

interface HeatmapChartInnerProps {
  data: HeatmapColumn[];
  containerRef: RefObject<HTMLDivElement | null>;
  containerWidth: number;
  containerHeight: number;
  layout: "fluid" | "fill";
  binSize: number;
  sizingColumnCount: number | undefined;
  gap: number;
  colorScale: ((count: number) => string) | undefined;
  margin: Partial<HeatmapMargin> | undefined;
  weekStartDay: HeatmapWeekStartDay;
  xDomain: [Date, Date] | undefined;
  separatorConfig: HeatmapColumnSeparatorsConfig | undefined;
  levelColors: HeatmapLevelColors | undefined;
  levelStyles: HeatmapLevelStyles | undefined;
  status: ChartStatus;
  animationDuration: number;
  enterTransition: HeatmapEnterTransition | undefined;
  enterStaggerScale: number;
  revealSignature: string;
  loadingCellMaxOpacity: number;
  loadingCellRandomness: number;
  loadingLabel: string | undefined;
  animate: boolean;
  loadingOpacity: number;
  showLoadingCells: boolean;
  children?: ReactNode;
}

interface HeatmapContextValueInputs {
  margin: HeatmapMargin;
  columnLayout: HeatmapColumnLayout;
  dims: HeatmapDimensionsResult;
  colorScales: HeatmapColorScalesResult;
  lifecycle: HeatmapLifecycleState;
  htmlLayerEl: HTMLDivElement | null;
  containerRef: RefObject<HTMLDivElement | null>;
  gap: number;
  status: ChartStatus;
  animationDuration: number;
  enterTransition: HeatmapEnterTransition | undefined;
  enterStaggerScale: number;
  loadingOpacity: number;
  showLoadingCells: boolean;
  loadingCellMaxOpacity: number;
  loadingCellRandomness: number;
  loadingLabel: string | undefined;
  weekStartDay: HeatmapWeekStartDay;
}

/*
 * Extracted only to shorten HeatmapChartInner; memoisation behaviour is unchanged.
 */
const buildHeatmapContextValue = (inputs: Readonly<HeatmapContextValueInputs>): HeatmapContextValue => {
  const showLoadingLabel = (inputs.loadingLabel ?? "").trim().length > 0 &&
    inputs.status === "loading" &&
    (inputs.lifecycle.chartPhase === "loading" || inputs.lifecycle.chartPhase === "exitingReady");

  return {
    animateCells: inputs.lifecycle.animateCells,
    animationDuration: inputs.animationDuration,
    binHeight: inputs.dims.dimensions.binHeight,
    binWidth: inputs.dims.dimensions.binWidth,
    brushYScale: inputs.dims.brushYScale,
    chartPhase: inputs.lifecycle.chartPhase,
    chartStatus: inputs.status,
    colorScale: inputs.colorScales.colorScale,
    containerRef: inputs.containerRef,
    data: inputs.columnLayout.columns,
    enterStaggerScale: inputs.enterStaggerScale,
    enterTransition: inputs.enterTransition,
    fillScale: inputs.colorScales.fillScale,
    gap: inputs.gap,
    height: inputs.dims.dimensions.height,
    htmlLayerEl: inputs.htmlLayerEl,
    innerHeight: inputs.dims.dimensions.innerHeight,
    innerWidth: inputs.dims.dimensions.innerWidth,
    isLoaded: inputs.lifecycle.isLoaded,
    isReady: inputs.dims.isReady,
    levelStyles: inputs.colorScales.resolvedLevelStyles,
    loadingCellMaxOpacity: inputs.loadingCellMaxOpacity,
    loadingCellRandomness: inputs.loadingCellRandomness,
    loadingLabel: inputs.loadingLabel,
    loadingOpacity: inputs.loadingOpacity,
    margin: inputs.margin,
    revealEpoch: inputs.lifecycle.revealEpoch,
    revealMode: inputs.lifecycle.revealMode,
    separatorLayout: inputs.columnLayout.separatorLayout,
    showLoadingCells: inputs.showLoadingCells,
    showLoadingLabel,
    timeXScale: inputs.dims.timeXScale,
    weekStartDay: inputs.weekStartDay,
    width: inputs.dims.dimensions.width,
    xScale: inputs.dims.xScale,
    yScale: inputs.dims.yScale,
  };
};

interface HeatmapContextValueDerived {
  margin: HeatmapMargin;
  columnLayout: HeatmapColumnLayout;
  dims: HeatmapDimensionsResult;
  colorScales: HeatmapColorScalesResult;
  lifecycle: HeatmapLifecycleState;
  htmlLayerEl: HTMLDivElement | null;
}

/*
 * Deps list exactly the fields read below via member access, never the bare props or derived objects.
 */
const useHeatmapChartContextValue = (
  props: Readonly<HeatmapChartInnerProps>,
  derived: Readonly<HeatmapContextValueDerived>,
): HeatmapContextValue =>
  useMemo<HeatmapContextValue>(
    () =>
      buildHeatmapContextValue({
        animationDuration: props.animationDuration,
        colorScales: derived.colorScales,
        columnLayout: derived.columnLayout,
        containerRef: props.containerRef,
        dims: derived.dims,
        enterStaggerScale: props.enterStaggerScale,
        enterTransition: props.enterTransition,
        gap: props.gap,
        htmlLayerEl: derived.htmlLayerEl,
        lifecycle: derived.lifecycle,
        loadingCellMaxOpacity: props.loadingCellMaxOpacity,
        loadingCellRandomness: props.loadingCellRandomness,
        loadingLabel: props.loadingLabel,
        loadingOpacity: props.loadingOpacity,
        margin: derived.margin,
        showLoadingCells: props.showLoadingCells,
        status: props.status,
        weekStartDay: props.weekStartDay,
      }),
    [
      derived.columnLayout,
      derived.dims,
      props.gap,
      derived.margin,
      derived.colorScales,
      props.weekStartDay,
      props.status,
      derived.lifecycle,
      props.animationDuration,
      props.enterTransition,
      props.enterStaggerScale,
      props.loadingOpacity,
      props.showLoadingCells,
      props.loadingCellMaxOpacity,
      props.loadingCellRandomness,
      props.loadingLabel,
      props.containerRef,
      derived.htmlLayerEl,
    ],
  );

const HeatmapChartInner = (props: Readonly<HeatmapChartInnerProps>): ReactElement | undefined => {
  const margin = useHeatmapMargin(props.margin);
  const { columnLayout, dims } = useHeatmapLayoutDimensions(props, margin);
  const colorScales = useHeatmapColorScales(props.levelColors, props.levelStyles, props.colorScale);
  const lifecycle = useHeatmapChartLifecycle({ animate: props.animate, animationDurationMs: props.animationDuration, revealSignature: props.revealSignature, status: props.status });
  const [htmlLayerEl, setHtmlLayerEl] = useState<HTMLDivElement | null>(null);
  const contextValue = useHeatmapChartContextValue(props, { colorScales, columnLayout, dims, htmlLayerEl, lifecycle, margin });

  const isRenderable = dims.dimensions.width >= MIN_RENDERABLE_DIMENSION_PX && dims.dimensions.height >= MIN_RENDERABLE_DIMENSION_PX;
  const renderedChart = isRenderable
    ? [
        <HeatmapContext.Provider key="heatmap-chart" value={contextValue}>
          <HeatmapChartSurface onHtmlLayerMount={setHtmlLayerEl}>{props.children}</HeatmapChartSurface>
        </HeatmapContext.Provider>,
      ]
    : [];

  // This returns the built element, or undefined via Array#at's own out-of-range behaviour when the chart is not yet renderable.
  // No path here writes the literal token undefined or void.
  return renderedChart.at(0);
};

export { HeatmapChartInner, type HeatmapChartInnerProps };
