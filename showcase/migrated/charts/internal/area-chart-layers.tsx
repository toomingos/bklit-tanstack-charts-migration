// Area chart layer components: body seats overlay chrome inside the host (V1.2/G6).
import { useLayoutEffect, useMemo } from "react";
import type { ReactNode, RefObject } from "react";
import type { ScaleTime } from "d3-scale";
import type {
  ChartPoint,
  ChartRenderer,
  ChartRendererRenderContext,
  DomChartDefinition,
} from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { ChartHost, ChartRegistryBridge, HOST_INITIAL_WIDTH } from "./chart-host";
import { buildTimeScale } from "./chart-host-store";
import type { ChartChildRegistration } from "./chart-child-registry";
import { ReferenceAreaLayers } from "./reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./reference-area-layer";
import { BackgroundLayer } from "./background-layer";
import { SegmentOverlay } from "./segment-visuals";
import { ProjectionMarkerOverlay } from "./terminal-marker";
import { DashTailOverlay } from "./dash-tail";
import { ChartMarkersOverlay } from "./chart-markers";
import { MarkerActiveTooltipProvider } from "./marker-active-tooltip-provider";
import { BrushChrome } from "./brush-chrome";
import type { BrushRange } from "@tanstack/charts/interaction/brush";
import { LoadingLabel } from "./loading-label";
import { parseAspectRatio } from "./parse-aspect-ratio";
import { useEffectEvent } from "./use-effect-event";
import type { ProjectionPhaseHandle } from "./terminal-marker";
import type { AreaOverlays, AreaProjectionChromeProps } from "./use-area-overlays";
import { buildAreaProjectionGradientDefs } from "./use-area-overlays";
import {
  buildProjectionEndAnchors,
  buildTerminalAnchors,
  useOverlayMappers,
} from "./line-marker-anchors";
import {
  DEFAULT_TERMINAL_MARKER_RADIUS_PX,
  DEFAULT_TERMINAL_MARKER_STROKE_WIDTH_PX,
  PROJECTION_FALLBACK_STROKE,
  withZeroFallback,
} from "./area-chart-model";
import type { AreaSelection } from "./use-area-selection";
import type { ActiveMarkersStore } from "./active-markers-store";
import type { ChartSelection, SegmentComponent } from "./chart-selection";
import type { BrushChildConfig, ChartDatum, ChartMarker, ExtractedChildren } from "./types";
import type { ReadonlyResolvedArea } from "./area-chart-model";

// Anchors and projection gradients resolve through host scales (V1.2/G6).
const AreaProjectionChrome = (properties: Readonly<{ readonly chrome: Readonly<AreaProjectionChromeProps> }>): ReactNode => {
  const { chartPhase, heightPx, phasePort, projectionConfigs, projectionEndMarkers, projectionGradientBaseId, projectionLines, renderData, terminalMarkers, timeExtent, timeExtentRaw, width, xDataKey, yDomainFinal } = properties.chrome;
  const baseMappers = useOverlayMappers({ extentMaxTime: timeExtent?.maxTime, rawMinTime: timeExtentRaw?.minTime, yDomainFinal });
  // Area projection values map through the legacy zero fallback, like the hand scale did.
  const mappers = useMemo(
    () => (baseMappers === undefined
      ? undefined
      : {
        innerWidth: baseMappers.innerWidth,
        rightEdge: baseMappers.rightEdge,
        xMap: baseMappers.xMap,
        yMap: (value: number): number => withZeroFallback(baseMappers.yMap(value)),
      }),
    [baseMappers],
  );
  const terminalAnchors = useMemo(
    () => (mappers === undefined ? [] : buildTerminalAnchors({
      defaults: {
        fallbackStroke: "var(--chart-1)",
        markerRadius: DEFAULT_TERMINAL_MARKER_RADIUS_PX,
        terminalStrokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH_PX,
      },
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
      markerRadius: DEFAULT_TERMINAL_MARKER_RADIUS_PX,
      projectionEndMarkers,
    })),
    [mappers, projectionEndMarkers],
  );
  const gradientDefs = useMemo(
    () => buildAreaProjectionGradientDefs({
      baseId: projectionGradientBaseId,
      configs: projectionConfigs,
      lines: projectionLines,
      mappers,
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
  // Gradient defs ride the visible marker overlay; no hidden island remains.
  if (!overlayRendered && gradientDefs.length === 0) {return undefined;}
  return (
    <ProjectionMarkerOverlay
      projectionDefs={gradientDefs}
      terminalMarkers={terminalAnchors}
      projectionEndMarkers={endAnchors}
      phasePort={phasePort}
    />
  );
};

interface AreaChartBodyProps {
  readonly areaChartRenderer: ChartRenderer<ChartDatum, Date, number>;
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly aspectRatio: string;
  readonly chartData: ChartDatum[];
  readonly chartXDataKey: string;
  readonly chartXDomain: [Date, Date] | undefined;
  readonly children: ReactNode;
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
  readonly hostChildren: ReactNode;
  readonly idPrefix: string;
  readonly onFocusChange: (points: readonly ChartPoint<ChartDatum, Date, number>[]) => void;
  readonly onRender: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly heightPx: number;
  readonly renderTooltipBody: (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode;
  readonly resources?: ReactNode;
  readonly handleRegistryEntries: (entries: readonly ChartChildRegistration[]) => void;
  readonly tooltipEnabled: boolean;
}

const AreaChartBody = (props: Readonly<AreaChartBodyProps>): ReactNode => {
  const chartBodyNode = props.definition ? (
    <ChartHost
      buildXScale={buildTimeScale}
      renderer={props.areaChartRenderer}
      ariaLabel={props.ariaLabel ?? "Area chart"}
      ariaDescription={props.ariaDescription}
      aspectRatio={parseAspectRatio(props.aspectRatio)}
      chartData={props.chartData}
      chartXDataKey={props.chartXDataKey}
      chartXDomain={props.chartXDomain}
      height={props.heightPx > 0 ? props.heightPx : undefined}
      idPrefix={props.idPrefix}
      initialWidth={HOST_INITIAL_WIDTH}
      definition={props.definition}
      resources={props.resources}
      onFocusGroupChange={props.onFocusChange}
      onRender={props.onRender}
      renderTooltipBody={props.tooltipEnabled ? props.renderTooltipBody : undefined}
    >
      {props.children}
      <ChartRegistryBridge onEntries={props.handleRegistryEntries} />
      {props.hostChildren}
    </ChartHost>
  ) : undefined;
  return chartBodyNode ?? null;
};

interface AreaChartOverlaysProps {
  readonly animationDuration: number;
  readonly chartMarkers: ExtractedChildren["chartMarkers"];
  readonly chartSelection: ChartSelection | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
  readonly onMarkerHoverChange: (markers: readonly Readonly<ChartMarker>[] | null) => void;
  readonly heightPx: number;
  readonly idPrefix: string;
  readonly markerActiveStore: ActiveMarkersStore;
  readonly projectionChromeProps: AreaOverlays["projectionChromeProps"];
  readonly projectionPhasePortRef: RefObject<ProjectionPhaseHandle | null>;
  readonly refAreaChildren: AreaSelection["refAreaChildren"];
  readonly referenceAreaGeom: ReferenceAreaLayersGeom;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly segmentComponents: readonly SegmentComponent[];
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xDataKey: string;
  readonly xScaleD3Ref: RefObject<ScaleTime<number, number> | null>;
}

const AreaChartOverlays = (props: Readonly<AreaChartOverlaysProps>): ReactNode => {
  const chartMarkerLayer = props.chartMarkers ? (
    <MarkerActiveTooltipProvider store={props.markerActiveStore}>
      <ChartMarkersOverlay
        items={props.chartMarkers.items}
        size={props.chartMarkers.size}
        showLines={props.chartMarkers.showLines}
        animate={props.chartMarkers.animate}
        maxFanned={props.chartMarkers.maxFanned}
        xScaleD3Ref={props.xScaleD3Ref}
        containerRef={props.containerRef}
        animationDuration={props.animationDuration}
        onMarkerHoverChange={props.onMarkerHoverChange}
      />
    </MarkerActiveTooltipProvider>
  ) : undefined;
  if (!props.definition) {return null;}
  return (
    <>
      {props.heightPx > 0 && (
        <ReferenceAreaLayers
          configs={props.refAreaChildren}
          geom={props.referenceAreaGeom}
        />
      )}
      <SegmentOverlay
        selection={props.chartSelection}
        components={props.segmentComponents}
        idPrefix={props.idPrefix}
      />
      {props.projectionChromeProps && <AreaProjectionChrome chrome={props.projectionChromeProps} />}
      <DashTailOverlay
        containerRef={props.containerRef}
        idPrefix={props.idPrefix}
        renderData={props.renderData}
        xDataKey={props.xDataKey}
        series={props.resolvedAreas.flatMap((area: ReadonlyResolvedArea) =>
          area.showLine
            ? [{
              dashArray: area.dashArray,
              dashFromIndex: area.dashFromIndex,
              dataKey: area.dataKey,
              stroke: area.stroke,
              strokeWidth: area.strokeWidth,
            }]
            : [],
        )}
      />
      {chartMarkerLayer}
    </>
  );
};

interface AreaChartDefSvgsProps {
  readonly brushConfig: BrushChildConfig | undefined;
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly brushTrackExtent: [Date, Date] | undefined;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly hasBrush: boolean;
  readonly idPrefix: string;
}

const AreaChartDefSvgs = (props: Readonly<AreaChartDefSvgsProps>): ReactNode => {
  // Brush chrome mounts here so its pattern id stays mount-scoped; defs ride the seam.
  if (!props.hasBrush) {return undefined;}
  return (
    <BrushChrome
      containerRef={props.containerRef}
      trackExtent={props.brushTrackExtent}
      brushRangeValue={props.brushRangeValue}
      blurPx={props.brushConfig?.blurPx}
      fadeOuterEdges={props.brushConfig?.fadeOuterEdges}
      selectionPattern={props.brushConfig?.selectionPattern}
      selectionPatternId={`${props.idPrefix}-brush-selection-pattern`}
      selectedBoxStyle={props.brushConfig?.selectedBoxStyle}
    />
  );
};

interface AreaChartBackdropProps {
  readonly background: ExtractedChildren["background"];
  readonly idPrefix?: string;
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
  readonly loadingLabel: string | undefined;
}

const AreaChartBackdrop = (props: Readonly<AreaChartBackdropProps>): ReactNode => {
  const loadingLabelNode = props.isLoading && (props.loadingLabel?.length ?? 0) > 0 ? <LoadingLabel text={props.loadingLabel ?? ""} /> : undefined;
  const backgroundNode = props.background ? (
    <BackgroundLayer
      config={props.background}
      idPrefix={props.idPrefix}
      isLoaded={props.isLoaded}
    />
  ) : undefined;
  return (
    <>
      {loadingLabelNode}
      {backgroundNode}
    </>
  );
};

export { AreaChartBackdrop, AreaChartBody, AreaChartDefSvgs, AreaChartOverlays, AreaProjectionChrome };
export type { AreaChartBackdropProps, AreaChartBodyProps, AreaChartDefSvgsProps, AreaChartOverlaysProps };
