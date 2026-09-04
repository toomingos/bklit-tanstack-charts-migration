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

// This file is extracted from heatmap-chart.tsx.
// It is the context derivation and render gate for a mounted HeatmapChart, once the container has a measured, non-zero size.
// The layout, dimension, and color-scale hooks it depends on live in the sibling heatmap-chart-inner-layout.ts module, split out purely to keep this file under the line-count limit.
// The memoisation shape, and its dependency arrays, is unchanged from the original single-file implementation.

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

// This builds the memoised HeatmapContext value from the inner component's derived hook results.
// It is pulled out of HeatmapChartInner purely to keep that component's own function body short.
// The useMemo call site below still lists the exact same fine-grained dependencies the object construction used to close over, so memoisation behaviour is unchanged.
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

// This memoises the HeatmapContext value for HeatmapChartInner.
// It is its own hook (rather than inline in HeatmapChartInner) purely to keep that component's own function body short.
// Every dependency read inside the memo callback below is a member access (props.foo, derived.bar), never the bare props or derived identifiers, so the dependency array can list exactly the fields that are actually read.
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
