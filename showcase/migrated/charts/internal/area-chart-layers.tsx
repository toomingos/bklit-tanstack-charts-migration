// Area chart layer components: body seats overlay chrome inside the host (V1.2/G6).
import { Fragment, useLayoutEffect, useMemo } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type { ScaleTime } from "d3-scale";
import type {
  ChartPoint,
  ChartRenderer,
  ChartRendererRenderContext,
  DomChartDefinition,
} from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { ChartHost, ChartRegistryBridge, HOST_INITIAL_WIDTH } from "./chart-host";
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
import { useChartStable } from "./chart-context";
import { useEffectEvent } from "./use-effect-event";
import type { CrosshairGradientDef } from "./focus-marks";
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
import type { MarkerGradientDef } from "./series-marker-mark";
import type { ActiveMarkersStore } from "./active-markers-store";
import type { ChartSelection, SegmentComponent } from "./chart-selection";
import type { BrushChildConfig, ChartDatum, ChartMarker, ExtractedChildren } from "./types";
import type { AreaPatternDef, ReadonlyResolvedArea } from "./area-chart-model";
import {
  HIDDEN_DEFS_SVG_STYLE,
  renderProjectionGradientDef,
} from "./line-chart-support";

// Hidden svg hosts for gradient/clip defs; zero-size and removed from layout.
const HIDDEN_DEF_SVG_STYLE: CSSProperties = { position: "absolute" };

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

// Crosshair gradient geometry follows the host plot rect (V1.2/G6).
const AreaCrosshairDef = (properties: Readonly<{
  readonly crosshairGradientDef: CrosshairGradientDef | undefined;
}>): ReactNode => {
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const { crosshairGradientDef } = properties;
  if (!crosshairGradientDef) {return undefined;}
  const { color, id, stops: gradientStops } = crosshairGradientDef;
  const stops = gradientStops.map((stop: Readonly<{ offset: string; opacity: number }>) => (
    <stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
  ));
  return (
    <svg width={0} height={0} style={HIDDEN_DEF_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={margin.top} y2={margin.top + plot.height}>
          {stops}
        </linearGradient>
      </defs>
    </svg>
  );
};

// Brush clip defs follow the host plot rect (V1.2/G6).
const AreaBrushClipDef = (properties: Readonly<{
  readonly brushClipId: string;
  readonly needsClip: boolean;
}>): ReactNode => {
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  if (!properties.needsClip || plot.width <= 0 || plot.height <= 0) {return undefined;}
  return (
    <svg width={0} height={0} style={HIDDEN_DEF_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={properties.brushClipId}>
          <rect x={margin.left} y={margin.top} width={plot.width} height={plot.height} />
        </clipPath>
      </defs>
    </svg>
  );
};

interface AreaChartBodyProps {
  readonly areaChartRenderer: ChartRenderer<ChartDatum, Date, number>;
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly aspectRatio: string;
  readonly chartBodyClipStyle: CSSProperties | undefined;
  readonly chartData: ChartDatum[];
  readonly chartXDataKey: string;
  readonly chartXDomain: [Date, Date] | undefined;
  readonly children: ReactNode;
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
  readonly hostChildren: ReactNode;
  readonly onFocusChange: (points: readonly ChartPoint<ChartDatum, Date, number>[]) => void;
  readonly onRender: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly heightPx: number;
  readonly renderTooltipBody: (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode;
  readonly handleRegistryEntries: (entries: readonly ChartChildRegistration[]) => void;
  readonly tooltipEnabled: boolean;
}

const AreaChartBody = (props: Readonly<AreaChartBodyProps>): ReactNode => {
  const chartBodyNode = props.definition ? (
    <div style={props.chartBodyClipStyle}>
      <ChartHost
        renderer={props.areaChartRenderer}
        ariaLabel={props.ariaLabel ?? "Area chart"}
        ariaDescription={props.ariaDescription}
        aspectRatio={parseAspectRatio(props.aspectRatio)}
        chartData={props.chartData}
        chartXDataKey={props.chartXDataKey}
        chartXDomain={props.chartXDomain}
        height={props.heightPx > 0 ? props.heightPx : undefined}
        initialWidth={HOST_INITIAL_WIDTH}
        definition={props.definition}
        onFocusGroupChange={props.onFocusChange}
        onRender={props.onRender}
        renderTooltipBody={props.tooltipEnabled ? props.renderTooltipBody : undefined}
      >
        {props.children}
        <ChartRegistryBridge onEntries={props.handleRegistryEntries} />
        {props.hostChildren}
      </ChartHost>
    </div>
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
      />
      {props.projectionChromeProps && <AreaProjectionChrome chrome={props.projectionChromeProps} />}
      <DashTailOverlay
        containerRef={props.containerRef}
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
  readonly areaBrushClipId: string;
  readonly areaMarkerGradientDefs: readonly Readonly<MarkerGradientDef>[];
  readonly brushConfig: BrushChildConfig | undefined;
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly brushTrackExtent: [Date, Date] | undefined;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly crosshairGradientDef: CrosshairGradientDef | undefined;
  readonly hasBrush: boolean;
  readonly margin: Readonly<{ readonly left: number; readonly top: number }>;
  readonly needsAreaBrushClip: boolean;
  readonly patternDefs: readonly Readonly<AreaPatternDef>[];
}

const AreaChartDefSvgs = (props: Readonly<AreaChartDefSvgsProps>): ReactNode => {
  // Brush clip rect sits one level deep so the svg > defs tree stays within jsx-max-depth.
  // Conditional-held (like the other layer nodes) so the depth rule counts each tree on its own.
  const brushChromeNode = props.hasBrush && (
    <BrushChrome
      containerRef={props.containerRef}
      trackExtent={props.brushTrackExtent}
      brushRangeValue={props.brushRangeValue}
      blurPx={props.brushConfig?.blurPx}
      fadeOuterEdges={props.brushConfig?.fadeOuterEdges}
      selectionPattern={props.brushConfig?.selectionPattern}
      selectedBoxStyle={props.brushConfig?.selectedBoxStyle}
    />
  );
  const crosshairNode = <AreaCrosshairDef crosshairGradientDef={props.crosshairGradientDef} />;
  const areaMarkerGradientNodes = props.areaMarkerGradientDefs.map((grad: Readonly<MarkerGradientDef>) => (
    <radialGradient key={grad.id} id={grad.id}>
      <stop offset="0%" stopColor={grad.fill} stopOpacity={1} />
      <stop offset={`${grad.fillFadeStart}%`} stopColor={grad.fill} stopOpacity={1} />
      <stop offset={`${grad.fillFadeEnd}%`} stopColor={grad.fill} stopOpacity={0} />
      <stop offset={`${grad.gapFadeStart}%`} stopColor={grad.stroke} stopOpacity={0} />
      <stop offset={`${grad.gapFadeEnd}%`} stopColor={grad.stroke} stopOpacity={1} />
      <stop offset="100%" stopColor={grad.stroke} stopOpacity={1} />
    </radialGradient>
  ));
  const markerGradientDefsNode = props.areaMarkerGradientDefs.length > 0 && (
    <svg
      width={0}
      height={0}
      style={HIDDEN_DEF_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {areaMarkerGradientNodes}
      </defs>
    </svg>
  );
  const patternDefNodes = props.patternDefs.map((patternDef: Readonly<AreaPatternDef>) => (
    <Fragment key={patternDef.id}>
      {patternDef.node}
      {/* Tile grid shifts by margin: bklit anchors tiles at (margin.left, margin.top). */}
      <pattern
        id={patternDef.id}
        href={`#${patternDef.id}-base`}
        xlinkHref={`#${patternDef.id}-base`}
        patternTransform={`translate(${props.margin.left} ${props.margin.top})`}
      />
    </Fragment>
  ));
  return (
    <>
      <AreaBrushClipDef
        brushClipId={props.areaBrushClipId}
        needsClip={props.needsAreaBrushClip}
      />
      {brushChromeNode}
      {crosshairNode}
      {markerGradientDefsNode}
      {props.patternDefs.length > 0 && (
        <svg
          width={0}
          height={0}
          style={HIDDEN_DEF_SVG_STYLE}
          aria-hidden="true"
          focusable="false"
        >
          <defs>{patternDefNodes}</defs>
        </svg>
      )}
    </>
  );
};

interface AreaChartBackdropProps {
  readonly background: ExtractedChildren["background"];
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
  readonly loadingLabel: string | undefined;
}

const AreaChartBackdrop = (props: Readonly<AreaChartBackdropProps>): ReactNode => {
  const loadingLabelNode = props.isLoading && (props.loadingLabel?.length ?? 0) > 0 ? <LoadingLabel text={props.loadingLabel ?? ""} /> : undefined;
  const backgroundNode = props.background ? (
    <BackgroundLayer
      config={props.background}
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

export { AreaBrushClipDef, AreaChartBackdrop, AreaChartBody, AreaChartDefSvgs, AreaChartOverlays, AreaCrosshairDef, AreaProjectionChrome };
export type { AreaChartBackdropProps, AreaChartBodyProps, AreaChartDefSvgsProps, AreaChartOverlaysProps };
