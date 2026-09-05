// Line-chart overlay state: anchors, gradient defs, selection, brush chrome, and overlay nodes.
import { useCallback, useLayoutEffect, useMemo } from "react";
import type { ReactNode, RefObject } from "react";
import type { ScaleTime } from "d3-scale";
import { useEffectEvent } from "./use-effect-event";
import { buildCrosshairGradientDef } from "./hover-geometry";
import { LEGEND_DIM_OPACITY } from "./line-series-marks";
import { useSanitizedId } from "./use-sanitized-id";
import { resolveFadeEdgesMask } from "./fade-mask";
import type { FadeEdgesMaskAttrs } from "./fade-mask";
import { extractReferenceAreaProps } from "./reference-area-config";
import { ReferenceAreaLayers } from "./reference-area-layer";
import { BackgroundLayer } from "./background-layer";
import { LoadingLabel } from "./loading-label";
import { resolveLineLoadingPulseMode } from "./loading-chrome";
import { extractSegmentComponents, useChartSelection } from "./chart-selection";
import type { ChartSelection } from "./chart-selection";
import { SegmentOverlay } from "./segment-visuals";
import type { ProjectionLineConfig } from "./projection-config";
import { ProjectionMarkerOverlay } from "./terminal-marker";
import type { ProjectionPhaseHandle } from "./terminal-marker";
import { MarkerActiveTooltipProvider } from "./marker-active-tooltip-provider";
import { ChartMarkersOverlay } from "./chart-markers";
import { DashTailOverlay } from "./dash-tail";
import { BrushChrome } from "./brush-chrome";
import type { BrushHost } from "./brush-chrome";
import { selectionToPixelExtent } from "./brush-chrome-helpers";
import type { BrushRange } from "@tanstack/charts/interaction/brush";
import type { FocusInjection } from "./focus-injection";
import {
  buildProjectionGradientDefs,
  buildProfitLossGradientDefs,
} from "./line-gradient-defs";
import {
  buildProjectionEndAnchors,
  buildTerminalAnchors,
} from "./line-marker-anchors";
import { DEFAULT_MARKER_RADIUS_PX } from "./line-marker-reveal";
import type { MarkerGradientDef } from "./series-marker-mark";
import type { BrushChildConfig, ChartDatum, ChartMarker, ExtractedChildren } from "./types";
import type { ChartPhase } from "./chart-phase";
import type { ChartMargin } from "./use-chart-margin";
import type { LineFocusChrome } from "./use-line-focus-chrome";
import type { LineChartSpec } from "./use-line-chart-spec";
import {
  DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX,
  DEFAULT_PROJECTION_LINE_CLASS_NAME,
  DEFAULT_TERMINAL_MARKER_STROKE_WIDTH,
  HIDDEN_DEFS_SVG_STYLE,
  OVERLAY_HOST_STYLE,
  PROJECTION_FALLBACK_STROKE,
  isString,
  referenceXDomainForExtent,
  renderBrushClipDefs,
  renderCrosshairGradient,
  renderMarkerGradientDef,
  renderProfitLossGradientDef,
  renderProjectionGradientDef,
} from "./line-chart-support";

interface LineOverlaysParams {
  readonly animationDuration: number;
  readonly background: ExtractedChildren["background"];
  readonly brushConfig: BrushChildConfig | undefined;
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly brushTrackExtent: [Date, Date] | undefined;
  readonly chartMarkers: ExtractedChildren["chartMarkers"];
  readonly chartPhase: ChartPhase;
  readonly children: ReactNode;
  readonly clearFocusChrome: LineFocusChrome["clearFocusChrome"];
  readonly clientToScene: FocusInjection<ChartDatum, Date, number>["clientToScene"];
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly crosshairGradientId: string;
  readonly data: ChartDatum[];
  readonly datePill: LineFocusChrome["datePill"];
  readonly defaultLineStroke: string;
  readonly defaultLineStrokeWidth: number;
  readonly definition: LineChartSpec["definition"];
  readonly dragSelectionActiveRef: LineFocusChrome["dragSelectionActiveRef"];
  readonly hasBrush: boolean;
  readonly hasHover: boolean;
  readonly heightPx: number;
  readonly innerWidth: number;
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
  readonly legendHoveredIndex: number | null;
  readonly lines: ExtractedChildren["lines"];
  readonly loadingLabel: string | undefined;
  readonly margin: Readonly<ChartMargin>;
  readonly markerActiveStore: LineFocusChrome["markerActiveStore"];
  readonly markerGradientDefs: readonly MarkerGradientDef[];
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly projectionConfigs: readonly ProjectionLineConfig[];
  readonly projectionEndMarkers: ExtractedChildren["projectionEndMarkers"];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: ExtractedChildren["projectionLines"];
  readonly projectionPhasePortRef: RefObject<ProjectionPhaseHandle | null>;
  readonly profitLossLines: ExtractedChildren["profitLossLines"];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly sceneRef: FocusInjection<ChartDatum, Date, number>["sceneRef"];
  readonly terminalMarkers: ExtractedChildren["terminalMarkers"];
  readonly timeExtent: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly timeExtentRaw: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
  readonly xScaleD3Ref: RefObject<ScaleTime<number, number> | null>;
  readonly yDomainFinal: [number, number];
}

interface LineOverlays {
  readonly backgroundNode: ReactNode;
  readonly brushChromeNode: ReactNode;
  readonly brushClipId: string;
  readonly brushClipNode: ReactNode;
  readonly chartSelection: ChartSelection | null;
  readonly definitionOverlayNode: ReactNode;
  readonly fadeEdgesMask: FadeEdgesMaskAttrs;
  readonly innerHeightForBrush: number;
  readonly innerWidthForBrush: number;
  readonly loadingLabelNode: ReactNode;
  readonly needsBrushClip: boolean;
  readonly pulseMode: ReturnType<typeof resolveLineLoadingPulseMode>;
}

const useLineOverlays = (params: Readonly<LineOverlaysParams>): LineOverlays => {
  const { animationDuration, background, brushConfig, brushRangeValue, brushTrackExtent, chartMarkers, chartPhase, children, clearFocusChrome, clientToScene, containerRef, crosshairGradientId, data, datePill, defaultLineStroke, defaultLineStrokeWidth, definition, dragSelectionActiveRef, hasBrush, hasHover, heightPx, innerWidth, isLoaded, isLoading, legendHoveredIndex, lines, loadingLabel, margin, markerActiveStore, markerGradientDefs, nicedDomainsByAxis, projectionConfigs, projectionEndMarkers, projectionGradientBaseId, projectionLines, projectionPhasePortRef, profitLossLines, renderData, sceneRef, terminalMarkers, timeExtent, timeExtentRaw, tooltip, tooltipEnabled, width, xDataKey, xDomain, xScaleD3Ref, yDomainFinal } = params;
  const fadeEdgesMask = resolveFadeEdgesMask(lines.map((line) => line.fadeEdges ?? true));
  // Pulse mode follows lifecycle phase (loading loops, exiting finishes, revealing grows in).
  const pulseMode = resolveLineLoadingPulseMode(chartPhase);

  const lineTerminalAnchors = useMemo(() => buildTerminalAnchors({
    defaults: { fallbackStroke: "var(--chart-1)", markerRadius: DEFAULT_MARKER_RADIUS_PX, terminalStrokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH },
    heightPx,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    renderData,
    terminalMarkers,
    timeExtent,
    timeExtentRaw,
    width,
    xDataKey,
    yDomainFinal,
  }), [terminalMarkers, renderData, width, heightPx, margin, xDataKey, yDomainFinal, timeExtent, timeExtentRaw]);
  const lineEndAnchors = useMemo(() => buildProjectionEndAnchors({
    fallbackStroke: PROJECTION_FALLBACK_STROKE,
    heightPx,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    markerRadius: DEFAULT_MARKER_RADIUS_PX,
    projectionEndMarkers,
    timeExtent,
    timeExtentRaw,
    width,
    yDomainFinal,
  }), [projectionEndMarkers, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw]);
  const projectionGradientDefs = useMemo(() => buildProjectionGradientDefs({
    defaultClassName: DEFAULT_PROJECTION_LINE_CLASS_NAME,
    defaultEndpointRadius: DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX,
    fallbackStroke: PROJECTION_FALLBACK_STROKE,
    gradientBaseId: projectionGradientBaseId,
    heightPx,
    isLoading,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    projectionConfigs,
    projectionLines,
    timeExtent,
    timeExtentRaw,
    width,
    yDomainFinal,
  }), [projectionConfigs, projectionLines, width, margin, heightPx, yDomainFinal, timeExtent, timeExtentRaw, projectionGradientBaseId, isLoading]);

  const profitLossGradientDefs = useMemo(() => buildProfitLossGradientDefs({
    gradientBaseId: projectionGradientBaseId,
    marginLeft: margin.left,
    marginRight: margin.right,
    profitLossLines,
    width,
  }), [profitLossLines, width, margin, projectionGradientBaseId]);

  const crosshairGradientDef = useMemo(() => {
    const color = isString(tooltip?.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return tooltipEnabled && (tooltip?.showCrosshair ?? true) ? buildCrosshairGradientDef(crosshairGradientId, color) : undefined;
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  const overlayRendered = (lineTerminalAnchors.length > 0 || lineEndAnchors.length > 0) && width > 0 && heightPx > 0;
  const pushPhaseToProjectionPort = useEffectEvent((): void => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  });
  useLayoutEffect(() => {
    if (!overlayRendered) {return;}
    pushPhaseToProjectionPort();
  }, [overlayRendered]);

  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const resolveScenePos = clientToScene;
  const invertSceneX = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX),
    [sceneRef],
  );

  const { selection: chartSelection } = useChartSelection({
    containerRef,
    data,
    enabled: true,
    innerWidth,
    invertSceneX,
    marginLeft: margin.left,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      clearFocusChrome();
    },
    resolveScenePos,
    xDataKey,
  });

  const segmentComponents = useMemo(() => extractSegmentComponents(children), [children]);
  const refAreaChildren = useMemo(() => extractReferenceAreaProps(children), [children]);

  // With narrowed xDomain, full-data paths map outside the plot; clip them to the plot rect.
  const innerWidthForBrush = Math.max(0, width - margin.left - margin.right);
  const innerHeightForBrush = Math.max(0, heightPx - margin.top - margin.bottom);
  const brushClipId = useSanitizedId();
  const needsBrushClip = Boolean(xDomain) && innerWidthForBrush > 0 && innerHeightForBrush > 0;
  const brushHost = useMemo((): BrushHost | undefined => {
    if (!brushTrackExtent || innerWidthForBrush <= 0) {return undefined;}
    return { containerRef, margin, trackExtent: brushTrackExtent };
  }, [brushTrackExtent, innerWidthForBrush, margin, containerRef]);
  const brushPixelExtent = useMemo(() => {
    const hasBrushPixelExtent = brushTrackExtent !== undefined && brushRangeValue !== undefined && innerWidthForBrush > 0;
    if (!hasBrushPixelExtent) {return undefined;}
    return selectionToPixelExtent(brushRangeValue, brushTrackExtent, innerWidthForBrush) ?? undefined;
  }, [brushTrackExtent, brushRangeValue, innerWidthForBrush]);

  // Overlay subtrees live outside the definition fragment so no single
  // Expression stacks more than a few conditional operators.
  const referenceAreaGeom = useMemo(() => ({
    height: heightPx,
    isLoaded,
    isTimeScale: true,
    margin,
    phase: chartPhase,
    width,
    xDomain: referenceXDomainForExtent(timeExtent),
    yDomain: yDomainFinal,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [heightPx, isLoaded, margin, chartPhase, width, timeExtent, yDomainFinal, nicedDomainsByAxis]);
  const referenceAreaLayersNode = heightPx > 0 && (
    <ReferenceAreaLayers
      configs={refAreaChildren}
      geom={referenceAreaGeom}
    />
  );
  const projectionGradientDefsNode = projectionGradientDefs.length > 0 && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {projectionGradientDefs.map((def: Parameters<typeof renderProjectionGradientDef>[0]) => renderProjectionGradientDef(def))}
      </defs>
    </svg>
  );
  const profitLossGradientDefsNode = profitLossGradientDefs.length > 0 && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {profitLossGradientDefs.map((def: Parameters<typeof renderProfitLossGradientDef>[0]) => renderProfitLossGradientDef(def))}
      </defs>
    </svg>
  );
  const crosshairGradientDefNode = crosshairGradientDef && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {renderCrosshairGradient({
          bottom: margin.top + Math.max(0, heightPx - margin.top - margin.bottom),
          color: crosshairGradientDef.color,
          id: crosshairGradientDef.id,
          stops: crosshairGradientDef.stops,
          top: margin.top,
        })}
      </defs>
    </svg>
  );
  const projectionMarkerOverlayNode = overlayRendered && (
    <ProjectionMarkerOverlay
      width={width}
      height={heightPx}
      margin={margin}
      terminalMarkers={lineTerminalAnchors}
      projectionEndMarkers={lineEndAnchors}
      phasePort={projectionPhasePortRef}
    />
  );
  const datePillHostNode = tooltipEnabled && (
    <div
      ref={datePill.overlayHostRef}
      style={OVERLAY_HOST_STYLE}
    />
  );
  const markerGradientDefsNode = markerGradientDefs.length > 0 && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {markerGradientDefs.map((def: Parameters<typeof renderMarkerGradientDef>[0]) => renderMarkerGradientDef(def))}
      </defs>
    </svg>
  );
  const projectMarkerX = useCallback((date: Readonly<Date>): number | undefined => {
    // Subtract margin.left: the scale is margin-inclusive and the overlay adds margin itself.
    const timeScale = xScaleD3Ref.current;
    if (!timeScale) {return undefined;}
    return timeScale(date) - margin.left;
  }, [margin.left, xScaleD3Ref]);
  const handleMarkerHoverChange = useCallback((markers: readonly Readonly<ChartMarker>[] | null): void => {
    // Hovering markers hides crosshair/tooltip and drops isActive until next chart hover (legacy).
    if (markers) {
      clearFocusChrome();
    }
  }, [clearFocusChrome]);
  const chartMarkersOverlayNode = chartMarkers && (
    <MarkerActiveTooltipProvider store={markerActiveStore}>
    <ChartMarkersOverlay
      items={chartMarkers.items}
      size={chartMarkers.size}
      showLines={chartMarkers.showLines}
      animate={chartMarkers.animate}
      maxFanned={chartMarkers.maxFanned}
      xScale={projectMarkerX}
      marginLeft={margin.left}
      marginTop={margin.top}
      innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
      containerRef={containerRef}
      animationDuration={animationDuration}
      onMarkerHoverChange={handleMarkerHoverChange}
    />
    </MarkerActiveTooltipProvider>
  );
  const dashTailSeries = useMemo(() => lines.map((line) => ({
    dashArray: line.dashArray,
    dashFromIndex: line.dashFromIndex,
    dataKey: line.dataKey,
    // Bklit Line `enabled` gate (line.tsx:266+336): showHighlight && !loading pulse.
    dimEnabled: (line.showHighlight ?? true) && !isLoading,
    stroke: line.stroke ?? defaultLineStroke,
    strokeWidth: line.strokeWidth ?? defaultLineStrokeWidth,
  })), [isLoading, lines, defaultLineStroke, defaultLineStrokeWidth]);
  // Same key derivation as use-line-chart-spec (single-owner legend-dim slot).
  const legendHoveredKey = legendHoveredIndex === null ? undefined : lines[legendHoveredIndex]?.dataKey;
  const definitionOverlayNode = definition && (
    <>
      {referenceAreaLayersNode}
      <SegmentOverlay
        selection={chartSelection}
        innerWidth={innerWidth}
        innerHeight={heightPx - margin.top - margin.bottom}
        marginLeft={margin.left}
        marginTop={margin.top}
        components={segmentComponents}
      />
      {projectionGradientDefsNode}
      {profitLossGradientDefsNode}
      {crosshairGradientDefNode}
      {projectionMarkerOverlayNode}
      {datePillHostNode}
      {markerGradientDefsNode}
      <DashTailOverlay
        containerRef={containerRef}
        width={width}
        height={heightPx}
        margin={margin}
        renderData={renderData}
        xDataKey={xDataKey}
        series={dashTailSeries}
        innerWidth={innerWidth}
        innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
        dimOpacity={LEGEND_DIM_OPACITY}
        hasHover={hasHover}
        legendHoveredKey={legendHoveredKey}
      />
      {chartMarkersOverlayNode}
    </>
  );
  const brushClipNode = needsBrushClip && (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      {renderBrushClipDefs({ clipId: brushClipId, height: innerHeightForBrush, left: margin.left, top: margin.top, width: innerWidthForBrush })}
    </svg>
  );
  const brushChromeNode = hasBrush && brushHost && brushPixelExtent && (
    <BrushChrome
      host={brushHost}
      x0={brushPixelExtent.x0}
      x1={brushPixelExtent.x1}
      innerWidth={innerWidthForBrush}
      innerHeight={innerHeightForBrush}
      blurPx={brushConfig?.blurPx}
      fadeOuterEdges={brushConfig?.fadeOuterEdges}
      selectionPattern={brushConfig?.selectionPattern}
      selectedBoxStyle={brushConfig?.selectedBoxStyle}
    />
  );
  const backgroundNode = background && (
    <BackgroundLayer
      config={background}
      innerWidth={innerWidth}
      innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
      marginLeft={margin.left}
      marginTop={margin.top}
      isLoaded={isLoaded}
    />
  );
  const loadingLabelNode = isLoading && loadingLabel !== undefined && loadingLabel !== "" && (
    <LoadingLabel text={loadingLabel} />
  );
  return { backgroundNode, brushChromeNode, brushClipId, brushClipNode, chartSelection, definitionOverlayNode, fadeEdgesMask, innerHeightForBrush, innerWidthForBrush, loadingLabelNode, needsBrushClip, pulseMode };
};

export { useLineOverlays };
export type { LineOverlays, LineOverlaysParams };
