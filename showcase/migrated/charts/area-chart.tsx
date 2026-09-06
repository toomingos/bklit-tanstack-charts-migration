// Bklit AreaChart on TanStack Charts. Two marks per series (areaFill + lineY); hover dim 0.6.
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { ScaleTime } from "d3-scale";
import type { ChartControl, ChartRendererRenderContext } from "@tanstack/charts";
import { useRegistryEntriesState } from "./internal/chart-host";
import { ChartSelectionContext } from "./internal/chart-selection";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import type { ChartDatum, ChartStatus } from "./internal/types";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./internal/chart-phase";
import type { ChartPhase } from "./internal/chart-phase";
import type { ChartMargin } from "./internal/use-chart-margin";
import type { EnterTransition } from "./internal/enter-transition";
import { useAreaChartSetup } from "./internal/use-area-chart-setup";
import { useAreaSeries } from "./internal/use-area-series";
import { useAreaYDomain } from "./internal/use-area-y-domain";
import { useAreaFills } from "./internal/use-area-fills";
import { findRevealRoot } from "./internal/reveal-root";
import { runRevealWipe, snapRevealWipe } from "./internal/reveal-wipe";
import type { RevealWipeEpochRef } from "./internal/reveal-wipe";
import { useAreaOverlays } from "./internal/use-area-overlays";
import { buildAreaChartDefinition } from "./internal/area-chart-definition";
import { resolveColumnWidth } from "./internal/column-width";
import { useAreaFocus } from "./internal/use-area-focus";
import { useAreaSelection } from "./internal/use-area-selection";
import { useAreaLayerProps } from "./internal/use-area-layer-props";
import {
  AreaChartBackdrop,
  AreaChartBody,
  AreaChartDefSvgs,
  AreaChartOverlays,
} from "./internal/area-chart-layers";
import "./styles.css";

// Shared empty brush controls: keeps the definition memo identical with no brush.
const NO_BRUSH_CONTROLS: readonly ChartControl<Date, number>[] = [];

// Reveal-root resolution for the wipe, owned by reveal-root.ts.
// Package renders the marks group; nothing here queries renderer DOM.
const resolveWipeMarks = (container: HTMLDivElement | null): SVGGElement | null => {
  const root = container ? findRevealRoot(container) : null;
  return root instanceof SVGGElement ? root : null;
};

interface AreaChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly status?: ChartStatus;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  readonly loadingLabel?: string;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
  readonly animationEasing?: string;
  readonly yDomainTween?: boolean;
  readonly yDomainTweenDuration?: number;
  readonly xDomain?: [Date, Date];
  readonly xDomainSlotCount?: number;
  readonly tweenYDomainOnXDomainChange?: boolean;
  /** Overrides the clip-reveal timing; springs coerce to tweens. */
  readonly enterTransition?: EnterTransition;
  /** Replay epoch input: changing it replays the mount reveal without a data change. */
  readonly revealSignature?: string;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const AreaChart = ({
  data,
  xDataKey = "date",
  status = "ready",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  loadingLabel,
  children,
  style,
  animationEasing = DEFAULT_ANIMATION_EASING,
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  enterTransition,
  revealSignature = "",
  ariaLabel,
  ariaDescription,
}: Readonly<AreaChartProps>): ReactElement => {
  // Registry union (V1.3 carriers): entries report up from inside the host.
  const [registryEntries, handleRegistryEntries] = useRegistryEntriesState();
  const xScaleD3Ref = useRef<ScaleTime<number, number> | null>(null);
  const setup = useAreaChartSetup({
    animationDuration,
    animationEasing,
    aspectRatio,
    children,
    data,
    enterTransition,
    marginProp,
    onPhaseChange,
    registryEntries,
    revealSignature,
    status,
    tweenYDomainOnXDomainChange,
    xDomain,
    yDomainTween,
  });
  const series = useAreaSeries({
    areas: setup.areas,
    data,
    innerWidth: setup.innerWidth,
    patternAreas: setup.patternAreas,
  });
  const yDomain = useAreaYDomain({
    data,
    projectionConfigs: setup.projectionConfigs,
    resolvedAreas: series.resolvedAreas,
    status,
    xDataKey,
    xDomain,
  });
  const fills = useAreaFills({
    projectionConfigs: setup.projectionConfigs,
    renderData: series.renderData,
    resolvedAreas: series.resolvedAreas,
    xDataKey,
    xDomain,
  });
  // Indicator slot width follows the shell formula; brush selections keep full-dataset slots.
  const columnWidth = resolveColumnWidth({ dataLength: yDomain.visibleData.length, plotWidth: setup.innerWidth, xDomain, xDomainSlotCount });
  const tooltipWithColumnWidth = useMemo(() => (setup.tooltip ? { ...setup.tooltip, columnWidth } : setup.tooltip), [setup.tooltip, columnWidth]);
  const brushContribution = registryEntries.find((entry) => entry.role === "layer:brush")?.contribution?.brush;
  const brushConfig = brushContribution?.config;
  const brushControls = brushContribution?.controls ?? NO_BRUSH_CONTROLS;
  const brushRangeValue = brushContribution?.range;
  const brushTrackExtent = brushContribution?.trackExtent;
  const hasBrush = brushContribution !== undefined;
  const brush = { brushConfig, brushControls, brushRangeValue, brushTrackExtent, hasBrush };
  const isLoading = status === "loading";
  const overlays = useAreaOverlays({
    chartPhase: setup.chartPhase,
    crosshairGradientId: series.crosshairGradientId,
    heightPx: setup.heightPx,
    projectionConfigs: setup.projectionConfigs,
    projectionEndMarkers: setup.projectionEndMarkers,
    projectionGradientBaseId: setup.projectionGradientBaseId,
    projectionLines: setup.projectionLines,
    projectionPhasePortRef: setup.projectionPhasePortRef,
    renderData: series.renderData,
    resolvedAreas: series.resolvedAreas,
    terminalMarkers: setup.terminalMarkers,
    timeExtent: fills.timeExtent,
    timeExtentRaw: fills.timeExtentRaw,
    tooltip: setup.tooltip,
    tooltipEnabled: setup.tooltipEnabled,
    width: setup.width,
    xDataKey,
    yDomainFinal: yDomain.yDomainFinal,
  });
  const definition = useMemo(() => buildAreaChartDefinition({
    areaMarkerConfigs: series.areaMarkerConfigs,
    areaMarkerGradientIdByKey: series.areaMarkerGradientIdByKey,
    areas: setup.areas,
    brushControls: brush.brushControls,
    chartPhase: setup.chartPhase,
    crosshairGradientId: series.crosshairGradientId,
    effectiveYDomainTweenDuration: setup.effectiveYDomainTweenDuration,
    gradientIdBySeries: fills.gradientIdBySeries,
    grid: setup.grid,
    heightPx: setup.heightPx,
    hoveredIndex: series.hoveredIndex,
    isDiscrete: series.isDiscrete,
    isLoaded: setup.isLoaded,
    isLoading,
    labelFade: series.labelFade,
    legendHoveredIndex: setup.legendHoveredIndex,
    margin: setup.margin,
    nativeAreaGradients: fills.nativeAreaGradients,
    patternIdByKey: series.patternIdByKey,
    projectionConfigs: setup.projectionConfigs,
    projectionGradientBaseId: setup.projectionGradientBaseId,
    projectionLines: setup.projectionLines,
    projectorFor: yDomain.projectorFor,
    renderData: series.renderData,
    resolvedAreas: series.resolvedAreas,
    resolvedPatternAreas: series.resolvedPatternAreas,
    timeExtent: fills.timeExtent,
    timeExtentRaw: fills.timeExtentRaw,
    tooltip: tooltipWithColumnWidth,
    tooltipEnabled: setup.tooltipEnabled,
    visibleData: yDomain.visibleData,
    width: setup.width,
    xAccessor: yDomain.xAccessorForBrush,
    xAxis: setup.xAxis,
    xDataKey,
    xDomain,
    xScaleD3Ref,
    yAxis: setup.yAxis,
    yDomainChanged: yDomain.yDomainChanged,
    yDomainFinal: yDomain.yDomainFinal,
  }), [series.renderData, xDataKey, yDomain.xAccessorForBrush, series.resolvedAreas, series.resolvedPatternAreas, series.patternIdByKey, fills.gradientIdBySeries, setup.grid, setup.width, yDomain.yDomainFinal, yDomain.yDomainChanged, yDomain.projectorFor, setup.margin, isLoading, setup.chartPhase, setup.isLoaded, setup.projectionConfigs, setup.projectionLines, setup.projectionGradientBaseId, setup.heightPx, fills.timeExtent, fills.timeExtentRaw, setup.effectiveYDomainTweenDuration, series.areaMarkerConfigs, series.areaMarkerGradientIdByKey, fills.nativeAreaGradients, setup.legendHoveredIndex, setup.areas, tooltipWithColumnWidth, setup.tooltipEnabled, series.crosshairGradientId, series.isDiscrete, series.hoveredIndex, setup.xAxis, setup.yAxis, yDomain.visibleData, xDomain, series.labelFade, brush.brushControls, xScaleD3Ref]);
  const focus = useAreaFocus({
    chartPhase: setup.chartPhase,
    interactionRef: setup.interactionRef,
    isDiscrete: series.isDiscrete,
    isLoaded: setup.isLoaded,
    renderData: series.renderData,
    resolvedAreas: series.resolvedAreas,
    setHoveredIndex: series.setHoveredIndex,
    setLabelFade: series.setLabelFade,
    tooltip: setup.tooltip,
    tooltipEnabled: setup.tooltipEnabled,
    xDataKey,
    xDomain,
  });
  // Reveal wipe runs every render as core mount behavior.
  // Marker stagger left with the marker layer; package motion owns enters.
  const {
    captureRenderContext,
    chartPhase: revealPhase,
    containerRef: revealContainerRef,
    prefersReducedMotion: revealPrefersReducedMotion,
    revealDurationMs,
    revealEasingCss,
    revealEpoch,
  } = setup;
  const revealedEpochRef = useRef<RevealWipeEpochRef["current"]>(null);
  const revealHandleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
    const marks = resolveWipeMarks(revealContainerRef.current);
    runRevealWipe({
      active: revealPhase === "revealing",
      animationDuration,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      marks,
      prefersReducedMotion: revealPrefersReducedMotion,
    });
  }, [animationDuration, captureRenderContext, revealPhase, revealContainerRef, revealPrefersReducedMotion, revealDurationMs, revealEasingCss, revealEpoch]);

  useEffect(() => {
    if (revealPhase !== "revealing") {return;}
    snapRevealWipe({
      active: true,
      animationDuration,
      marks: resolveWipeMarks(revealContainerRef.current),
      prefersReducedMotion: revealPrefersReducedMotion,
    });
  }, [revealPhase, animationDuration, revealPrefersReducedMotion, revealContainerRef]);

  // Host-owned sizing: the host adopts the measured width through this render callback.
  const { adoptWidth: adoptAreaWidth } = setup;
  const handleHostRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>): void => {
    revealHandleRender(context);
    adoptAreaWidth(context.scene.width);
  }, [revealHandleRender, adoptAreaWidth]);

  const selection = useAreaSelection({
    children,
    clientToScene: setup.clientToScene,
    containerRef: setup.containerRef,
    data,
    innerWidth: setup.innerWidth,
    marginLeft: setup.margin.left,
    onDragEnd: focus.handleSelectionDragEnd,
    onDragStart: focus.handleSelectionDragStart,
    sceneRef: setup.sceneRef,
    xDataKey,
  });
  const layerProps = useAreaLayerProps({
    aspectRatio,
    chartPhase: setup.chartPhase,
    clearFocusChrome: focus.clearFocusChrome,
    heightPx: setup.heightPx,
    isLoaded: setup.isLoaded,
    margin: setup.margin,
    nicedDomainsByAxis: yDomain.nicedDomainsByAxis,
    renderDataLength: series.renderData.length,
    style,
    timeExtent: fills.timeExtent,
    width: setup.width,
    xDomain,
    yDomainFinal: yDomain.yDomainFinal,
  });

  return (
    <ChartSelectionContext.Provider value={selection.chartSelection}>
    <div
      ref={setup.containerRef}
      className={className}
      // Touch-action none: vertical page scroll must not hijack touch drag-selection.
      style={layerProps.containerStyle}
      data-bkm-chart="area"
      data-bkm-fade-edges={overlays.fadeEdgesMask["data-bkm-fade-edges"]}
      data-bkm-fade-edges-left={overlays.fadeEdgesMask["data-bkm-fade-edges-left"]}
      data-bkm-fade-edges-right={overlays.fadeEdgesMask["data-bkm-fade-edges-right"]}
    >
      <AreaChartBody
        areaChartRenderer={layerProps.areaChartRenderer}
        ariaDescription={ariaDescription}
        ariaLabel={ariaLabel}
        aspectRatio={aspectRatio}
        chartBodyClipStyle={layerProps.chartBodyClipStyle}
        chartData={data}
        chartXDataKey={xDataKey}
        chartXDomain={xDomain}
        definition={definition}
        onFocusChange={focus.handleFocusChange}
        onRender={handleHostRender}
        heightPx={setup.heightPx}
        renderTooltipBody={focus.renderTooltipBody}
        tooltipEnabled={setup.tooltipEnabled}
        handleRegistryEntries={handleRegistryEntries}
        hostChildren={
          <>
            <AreaChartBackdrop
              background={setup.background}
              isLoaded={setup.isLoaded}
              isLoading={isLoading}
              loadingLabel={loadingLabel}
            />
            <AreaChartOverlays
              animationDuration={animationDuration}
              chartMarkers={setup.chartMarkers}
              chartSelection={selection.chartSelection}
              containerRef={setup.containerRef}
              definition={definition}
              onMarkerHoverChange={layerProps.handleMarkerHoverChange}
              heightPx={setup.heightPx}
              markerActiveStore={focus.markerActiveStore}
              projectionChromeProps={overlays.projectionChromeProps}
              projectionPhasePortRef={setup.projectionPhasePortRef}
              refAreaChildren={selection.refAreaChildren}
              referenceAreaGeom={layerProps.referenceAreaGeom}
              renderData={series.renderData}
              resolvedAreas={series.resolvedAreas}
              segmentComponents={selection.segmentComponents}
              tooltipEnabled={setup.tooltipEnabled}
              width={setup.width}
              xDataKey={xDataKey}
              xScaleD3Ref={xScaleD3Ref}
            />
            <AreaChartDefSvgs
              areaBrushClipId={layerProps.areaBrushClipId}
              areaMarkerGradientDefs={series.areaMarkerGradientDefs}
              brushConfig={brush.brushConfig}
              brushRangeValue={brush.brushRangeValue}
              brushTrackExtent={brush.brushTrackExtent}
              containerRef={setup.containerRef}
              crosshairGradientDef={overlays.crosshairGradientDef}
              hasBrush={brush.hasBrush}
              margin={setup.margin}
              needsAreaBrushClip={layerProps.needsAreaBrushClip}
              patternDefs={series.patternDefs}
            />
          </>
        }
      >
        {children}
      </AreaChartBody>
    </div>
    </ChartSelectionContext.Provider>
  );
};

export { AreaChart };
export type { AreaChartProps };
