// Line-chart overlay state: data for host-child chrome; anchors/gradients resolve inside the host.
import { useCallback, useLayoutEffect, useMemo } from "react";
import type { ReactNode, RefObject } from "react";
import type { ScaleTime } from "d3-scale";
import { useEffectEvent } from "./use-effect-event";
import { buildCrosshairGradientDef } from "./hover-geometry";
import { LEGEND_DIM_OPACITY } from "./line-series-marks";
import { useSanitizedId } from "./use-sanitized-id";
import { useChartStable } from "./chart-context";
import { resolveFadeEdgesMask } from "./fade-mask";
import type { FadeEdgesMaskAttrs } from "./fade-mask";
import { extractReferenceAreaProps } from "./reference-area-config";
import { ReferenceAreaLayers } from "./reference-area-layer";
import { BackgroundLayer } from "./background-layer";
import { LoadingLabel } from "./loading-label";
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
import type { BrushRange } from "@tanstack/charts/interaction/brush";
import type { FocusInjection } from "./focus-injection";
import {
  buildProjectionGradientDefs,
  buildProfitLossGradientDefs,
} from "./line-gradient-defs";
import {
  buildProjectionEndAnchors,
  buildTerminalAnchors,
  useOverlayMappers,
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
  readonly brushClipId: string;
  readonly chartSelection: ChartSelection | null;
  readonly fadeEdgesMask: FadeEdgesMaskAttrs;
  readonly hostChildren: ReactNode;
  readonly loadingLabelNode: ReactNode;
  readonly needsBrushClip: boolean;
}

// Anchors and projection gradients resolve through host scales (V1.2/G6).
const LineProjectionChrome = (properties: Readonly<{
  readonly heightPx: number;
  readonly phasePort: RefObject<ProjectionPhaseHandle | null>;
  readonly chartPhase: ChartPhase;
  readonly projectionConfigs: readonly ProjectionLineConfig[];
  readonly projectionEndMarkers: ExtractedChildren["projectionEndMarkers"];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: ExtractedChildren["projectionLines"];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly terminalMarkers: ExtractedChildren["terminalMarkers"];
  readonly timeExtent: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly timeExtentRaw: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomainFinal: [number, number];
}>): ReactNode => {
  const { chartPhase, heightPx, phasePort, projectionConfigs, projectionEndMarkers, projectionGradientBaseId, projectionLines, renderData, terminalMarkers, timeExtent, timeExtentRaw, width, xDataKey, yDomainFinal } = properties;
  const mappers = useOverlayMappers({ extentMaxTime: timeExtent?.maxTime, rawMinTime: timeExtentRaw?.minTime, yDomainFinal });
  const terminalAnchors = useMemo(
    () => (mappers === undefined ? [] : buildTerminalAnchors({
      defaults: { fallbackStroke: "var(--chart-1)", markerRadius: DEFAULT_MARKER_RADIUS_PX, terminalStrokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH },
      mappers,
      renderData,
      terminalMarkers,
      xDataKey,
    })),
    [mappers, renderData, terminalMarkers, xDataKey],
  );
  const endAnchors = useMemo(
    () => (mappers === undefined ? [] : buildProjectionEndAnchors({
      fallbackStroke: PROJECTION_FALLBACK_STROKE,
      mappers,
      markerRadius: DEFAULT_MARKER_RADIUS_PX,
      projectionEndMarkers,
    })),
    [mappers, projectionEndMarkers],
  );
  const gradientDefs = useMemo(
    () => buildProjectionGradientDefs({
      defaultEndpointRadius: DEFAULT_PROJECTION_ENDPOINT_RADIUS_PX,
      fallbackStroke: PROJECTION_FALLBACK_STROKE,
      gradientBaseId: projectionGradientBaseId,
      mappers,
      projectionConfigs,
      projectionLines,
    }),
    [projectionConfigs, projectionLines, mappers, projectionGradientBaseId],
  );
  const overlayRendered = (terminalAnchors.length > 0 || endAnchors.length > 0) && width > 0 && heightPx > 0;
  const pushPhaseToProjectionPort = useEffectEvent((): void => {
    phasePort.current?.setPhase(chartPhase);
  });
  useLayoutEffect(() => {
    if (!overlayRendered) {return;}
    pushPhaseToProjectionPort();
  }, [overlayRendered]);
  return (
    <>
      {gradientDefs.length > 0 && (
        <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
          <defs>
            {gradientDefs.map((def: Parameters<typeof renderProjectionGradientDef>[0]) => renderProjectionGradientDef(def))}
          </defs>
        </svg>
      )}
      {overlayRendered && (
        <ProjectionMarkerOverlay
          terminalMarkers={terminalAnchors}
          projectionEndMarkers={endAnchors}
          phasePort={phasePort}
        />
      )}
    </>
  );
};

// Profit-loss fade gradients need only the plot width, from the host (V1.2/G6).
const LineProfitLossGradients = (properties: Readonly<{
  readonly gradientBaseId: string;
  readonly profitLossLines: ExtractedChildren["profitLossLines"];
}>): ReactNode => {
  const { chart } = useChartStable();
  const defs = useMemo(
    () => buildProfitLossGradientDefs({ gradientBaseId: properties.gradientBaseId, innerWidth: chart?.width ?? 0, profitLossLines: properties.profitLossLines }),
    [properties.gradientBaseId, properties.profitLossLines, chart],
  );
  if (defs.length === 0) {return undefined;}
  return (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {defs.map((def: Parameters<typeof renderProfitLossGradientDef>[0]) => renderProfitLossGradientDef(def))}
      </defs>
    </svg>
  );
};

// Crosshair gradient geometry follows the host plot rect (V1.2/G6).
const LineCrosshairDef = (properties: Readonly<{
  readonly crosshairGradientId: string;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
}>): ReactNode => {
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const color = isString(properties.tooltip?.indicatorColor) ? properties.tooltip.indicatorColor : "var(--chart-crosshair)";
  const def = properties.tooltipEnabled && (properties.tooltip?.showCrosshair ?? true)
    ? buildCrosshairGradientDef(properties.crosshairGradientId, color)
    : undefined;
  if (!def) {return undefined;}
  return (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {renderCrosshairGradient({
          bottom: margin.top + plot.height,
          color: def.color,
          id: def.id,
          stops: def.stops,
          top: margin.top,
        })}
      </defs>
    </svg>
  );
};

// Brush clip defs follow the host plot rect (V1.2/G6).
const LineBrushClip = (properties: Readonly<{
  readonly brushClipId: string;
  readonly xDomain: [Date, Date] | undefined;
}>): ReactNode => {
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  if (!properties.xDomain || plot.width <= 0 || plot.height <= 0) {return undefined;}
  return (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      {renderBrushClipDefs({ clipId: properties.brushClipId, height: plot.height, left: margin.left, top: margin.top, width: plot.width })}
    </svg>
  );
};

const useLineOverlays = (params: Readonly<LineOverlaysParams>): LineOverlays => {
  const { animationDuration, background, brushConfig, brushRangeValue, brushTrackExtent, chartMarkers, chartPhase, children, clearFocusChrome, clientToScene, containerRef, crosshairGradientId, data, datePill, defaultLineStroke, defaultLineStrokeWidth, definition, dragSelectionActiveRef, hasBrush, hasHover, heightPx, innerWidth, isLoaded, isLoading, legendHoveredIndex, lines, loadingLabel, margin, markerActiveStore, markerGradientDefs, nicedDomainsByAxis, projectionConfigs, projectionEndMarkers, projectionGradientBaseId, projectionLines, projectionPhasePortRef, profitLossLines, renderData, sceneRef, terminalMarkers, timeExtent, timeExtentRaw, tooltip, tooltipEnabled, width, xDataKey, xDomain, xScaleD3Ref, yDomainFinal } = params;
  const fadeEdgesMask = resolveFadeEdgesMask(lines.map((line) => line.fadeEdges ?? true));

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

  // Reference-area geometry reads bounds from the host; only data domains travel by prop.
  const referenceAreaGeom = useMemo(() => ({
    isLoaded,
    isTimeScale: true,
    phase: chartPhase,
    xDomain: referenceXDomainForExtent(timeExtent),
    yDomain: yDomainFinal,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [isLoaded, chartPhase, timeExtent, yDomainFinal, nicedDomainsByAxis]);
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
  const handleMarkerHoverChange = useCallback((markers: readonly Readonly<ChartMarker>[] | null): void => {
    // Hovering markers hides crosshair/tooltip and drops isActive until next chart hover (legacy).
    if (markers) {
      clearFocusChrome();
    }
  }, [clearFocusChrome]);

  // Overlay subtrees mount inside the host so bounds come from the store (V1.2/G6).
  // Split so no single expression stacks conditionals.
  const referenceAreaLayersNode = heightPx > 0 && (
    <ReferenceAreaLayers
      configs={refAreaChildren}
      geom={referenceAreaGeom}
    />
  );
  const projectionChromeNode = (
    <LineProjectionChrome
      chartPhase={chartPhase}
      heightPx={heightPx}
      phasePort={projectionPhasePortRef}
      projectionConfigs={projectionConfigs}
      projectionEndMarkers={projectionEndMarkers}
      projectionGradientBaseId={projectionGradientBaseId}
      projectionLines={projectionLines}
      renderData={renderData}
      terminalMarkers={terminalMarkers}
      timeExtent={timeExtent}
      timeExtentRaw={timeExtentRaw}
      width={width}
      xDataKey={xDataKey}
      yDomainFinal={yDomainFinal}
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
  const chartMarkersOverlayNode = chartMarkers && (
    <MarkerActiveTooltipProvider store={markerActiveStore}>
      <ChartMarkersOverlay
        items={chartMarkers.items}
        size={chartMarkers.size}
        showLines={chartMarkers.showLines}
        animate={chartMarkers.animate}
        maxFanned={chartMarkers.maxFanned}
        xScaleD3Ref={xScaleD3Ref}
        containerRef={containerRef}
        animationDuration={animationDuration}
        onMarkerHoverChange={handleMarkerHoverChange}
      />
    </MarkerActiveTooltipProvider>
  );
  const brushChromeNode = hasBrush && (
    <BrushChrome
      containerRef={containerRef}
      trackExtent={brushTrackExtent}
      brushRangeValue={brushRangeValue}
      blurPx={brushConfig?.blurPx}
      fadeOuterEdges={brushConfig?.fadeOuterEdges}
      selectionPattern={brushConfig?.selectionPattern}
      selectedBoxStyle={brushConfig?.selectedBoxStyle}
    />
  );
  const backgroundNode = background && (
    <BackgroundLayer
      config={background}
      isLoaded={isLoaded}
    />
  );
  const hostChildren = definition && (
    <>
      {referenceAreaLayersNode}
      <SegmentOverlay
        selection={chartSelection}
        components={segmentComponents}
      />
      {projectionChromeNode}
      <LineProfitLossGradients
        gradientBaseId={projectionGradientBaseId}
        profitLossLines={profitLossLines}
      />
      <LineCrosshairDef
        crosshairGradientId={crosshairGradientId}
        tooltip={tooltip}
        tooltipEnabled={tooltipEnabled}
      />
      {datePillHostNode}
      {markerGradientDefsNode}
      <DashTailOverlay
        containerRef={containerRef}
        renderData={renderData}
        xDataKey={xDataKey}
        series={dashTailSeries}
        dimOpacity={LEGEND_DIM_OPACITY}
        hasHover={hasHover}
        legendHoveredKey={legendHoveredKey}
      />
      {chartMarkersOverlayNode}
      {brushChromeNode}
      <LineBrushClip
        brushClipId={brushClipId}
        xDomain={xDomain}
      />
      {backgroundNode}
    </>
  );
  const loadingLabelNode = isLoading && loadingLabel !== undefined && loadingLabel !== "" && (
    <LoadingLabel text={loadingLabel} />
  );
  return { brushClipId, chartSelection, fadeEdgesMask, hostChildren, loadingLabelNode, needsBrushClip };
};

export { useLineOverlays };
export type { LineOverlays, LineOverlaysParams };
