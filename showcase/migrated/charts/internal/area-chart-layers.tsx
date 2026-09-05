// Area chart layer components: pure module-scope pieces for body, overlays, hidden defs.
// Element identity stays stable; logic moved verbatim from area-chart.tsx.
import { Fragment } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type {
  ChartPoint,
  ChartRenderer,
  ChartRendererRenderContext,
  DomChartDefinition,
} from "@tanstack/charts";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { ReferenceAreaLayers } from "./reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./reference-area-layer";
import { BackgroundLayer } from "./background-layer";
import { SegmentOverlay } from "./segment-visuals";
import { ProjectionMarkerOverlay } from "./terminal-marker";
import { DashTailOverlay } from "./dash-tail";
import { ChartMarkersOverlay } from "./chart-markers";
import { MarkerActiveTooltipProvider } from "./marker-active-tooltip-provider";
import { BrushChrome } from "./brush-chrome";
import type { BrushHost } from "./brush-chrome";
import { LoadingLabel } from "./loading-label";
import { parseAspectRatio } from "./parse-aspect-ratio";
import type { CrosshairGradientDef, DatePillController } from "./hover-geometry";
import type { ProjectionPhaseHandle } from "./terminal-marker";
import type { AreaOverlays } from "./use-area-overlays";
import type { AreaSelection } from "./use-area-selection";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { MarkerGradientDef } from "./series-marker-mark";
import type { ActiveMarkersStore } from "./active-markers-store";
import type { ChartSelection, SegmentComponent } from "./chart-selection";
import type { ChartMargin } from "./use-chart-margin";
import type { BrushChildConfig, ChartDatum, ChartMarker, ExtractedChildren } from "./types";
import type { AreaPatternDef, ReadonlyResolvedArea } from "./area-chart-model";

// Hidden svg hosts for gradient/clip defs; zero-size and removed from layout.
const HIDDEN_DEF_SVG_STYLE: CSSProperties = { position: "absolute" };
// Date pill overlay host; fills the plot and ignores pointer events.
const DATE_PILL_HOST_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };

interface CrosshairGradientStop {
  readonly offset: string;
  readonly opacity: number;
}

interface CrosshairGradientSource {
  readonly color: string;
  readonly id: string;
  readonly stops: readonly CrosshairGradientStop[];
}

// Crosshair svg in one place. Stops render one level deep, so the svg tree
// Stays within jsx-max-depth (svg > defs > linearGradient).
const renderCrosshairNode = (
  crosshairGradientDef: CrosshairGradientSource | undefined,
  marginTop: number,
  plotHeight: number,
): ReactNode => {
  if (!crosshairGradientDef) {return undefined;}
  const { color, id, stops: gradientStops } = crosshairGradientDef;
  const stops = gradientStops.map((stop: Readonly<{ offset: string; opacity: number }>) => (
    <stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
  ));
  return (
    <svg width={0} height={0} style={HIDDEN_DEF_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={marginTop} y2={marginTop + plotHeight}>
          {stops}
        </linearGradient>
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
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
  readonly onFocusChange: (points: readonly ChartPoint<ChartDatum, Date, number>[]) => void;
  readonly onRender: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly heightPx: number;
  readonly renderTooltipBody: (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode;
  readonly tooltipEnabled: boolean;
}

const AreaChartBody = (props: Readonly<AreaChartBodyProps>): ReactNode => {
  const chartBodyNode = props.definition ? (
    <div style={props.chartBodyClipStyle}>
      <RendererChart
        renderer={props.areaChartRenderer}
        ariaLabel={props.ariaLabel ?? "Area chart"}
        ariaDescription={props.ariaDescription}
        aspectRatio={parseAspectRatio(props.aspectRatio)}
        height={props.heightPx > 0 ? props.heightPx : undefined}
        definition={props.definition}
        onFocusGroupChange={props.onFocusChange}
        onRender={props.onRender}
        renderTooltipBody={props.tooltipEnabled ? props.renderTooltipBody : undefined}
      />
    </div>
  ) : undefined;
  return chartBodyNode ?? null;
};

interface AreaChartOverlaysProps {
  readonly animationDuration: number;
  readonly areaEndAnchors: AreaOverlays["areaEndAnchors"];
  readonly areaTerminalAnchors: AreaOverlays["areaTerminalAnchors"];
  readonly chartMarkers: ExtractedChildren["chartMarkers"];
  readonly chartSelection: ChartSelection | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly datePillOverlayHostRef: DatePillController["overlayHostRef"];
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
  readonly onMarkerHoverChange: (markers: readonly Readonly<ChartMarker>[] | null) => void;
  readonly heightPx: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly innerWidthArea: number;
  readonly margin: Readonly<ChartMargin>;
  readonly markerActiveStore: ActiveMarkersStore;
  readonly projectionPhasePortRef: RefObject<ProjectionPhaseHandle | null>;
  readonly refAreaChildren: AreaSelection["refAreaChildren"];
  readonly referenceAreaGeom: ReferenceAreaLayersGeom;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly resolveAreaX: (date: Readonly<Date>) => number | undefined;
  readonly segmentComponents: readonly SegmentComponent[];
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xDataKey: string;
}

const AreaChartOverlays = (props: Readonly<AreaChartOverlaysProps>): ReactNode => {
  const overlayRenderedArea = (props.areaTerminalAnchors.length > 0 || props.areaEndAnchors.length > 0) && props.width > 0 && props.heightPx > 0;
  const referenceAreaLayer = props.heightPx > 0 ? (
    <ReferenceAreaLayers
      configs={props.refAreaChildren}
      geom={props.referenceAreaGeom}
    />
  ) : undefined;
  const projectionMarkerLayer = overlayRenderedArea ? (
    <ProjectionMarkerOverlay
      width={props.width}
      height={props.heightPx}
      margin={props.margin}
      terminalMarkers={props.areaTerminalAnchors}
      projectionEndMarkers={props.areaEndAnchors}
      phasePort={props.projectionPhasePortRef}
    />
  ) : undefined;
  const datePillLayer = props.tooltipEnabled ? (
    <div
      ref={props.datePillOverlayHostRef}
      style={DATE_PILL_HOST_STYLE}
    />
  ) : undefined;
  const chartMarkerLayer = props.chartMarkers ? (
    <MarkerActiveTooltipProvider store={props.markerActiveStore}>
    <ChartMarkersOverlay
      items={props.chartMarkers.items}
      size={props.chartMarkers.size}
      showLines={props.chartMarkers.showLines}
      animate={props.chartMarkers.animate}
      maxFanned={props.chartMarkers.maxFanned}
      xScale={props.resolveAreaX}
      marginLeft={props.margin.left}
      marginTop={props.margin.top}
      innerHeight={Math.max(0, props.heightPx - props.margin.top - props.margin.bottom)}
      containerRef={props.containerRef}
      animationDuration={props.animationDuration}
      onMarkerHoverChange={props.onMarkerHoverChange}
    />
    </MarkerActiveTooltipProvider>
  ) : undefined;
  if (!props.definition) {return null;}
  return (
    <>
      {referenceAreaLayer}
      <SegmentOverlay
        selection={props.chartSelection}
        innerWidth={props.innerWidthArea}
        innerHeight={props.heightPx - props.margin.top - props.margin.bottom}
        marginLeft={props.margin.left}
        marginTop={props.margin.top}
        components={props.segmentComponents}
      />
      {projectionMarkerLayer}
      {datePillLayer}
      <DashTailOverlay
        containerRef={props.containerRef}
        width={props.width}
        height={props.heightPx}
        margin={props.margin}
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
        innerWidth={props.innerWidth}
        innerHeight={props.innerHeight}
      />
      {chartMarkerLayer}
    </>
  );
};

interface AreaChartDefSvgsProps {
  readonly areaBrushClipId: string;
  readonly areaMarkerGradientDefs: readonly Readonly<MarkerGradientDef>[];
  readonly brushConfig: BrushChildConfig | undefined;
  readonly brushHost: BrushHost | undefined;
  readonly brushPixelExtent: { readonly x0: number; readonly x1: number } | undefined;
  readonly crosshairGradientDef: CrosshairGradientDef | undefined;
  readonly hasBrush: boolean;
  readonly margin: Readonly<ChartMargin>;
  readonly needsAreaBrushClip: boolean;
  readonly innerHeightForBrush: number;
  readonly innerWidthForBrush: number;
  readonly patternDefs: readonly Readonly<AreaPatternDef>[];
  readonly plotHeight: number;
  readonly projectionGradientDefsArea: readonly Readonly<ProjectionGradientDef>[];
}

const AreaChartDefSvgs = (props: Readonly<AreaChartDefSvgsProps>): ReactNode => {
  // Brush clip rect sits one level deep so the svg > defs tree stays within jsx-max-depth.
  // Conditional-held (like the other layer nodes) so the depth rule counts each tree on its own.
  const brushClipContent = props.needsAreaBrushClip ? (
    <clipPath id={props.areaBrushClipId}>
      <rect x={props.margin.left} y={props.margin.top} width={props.innerWidthForBrush} height={props.innerHeightForBrush} />
    </clipPath>
  ) : undefined;
  const brushClipNode = props.needsAreaBrushClip ? (
    <svg width={0} height={0} style={HIDDEN_DEF_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        {brushClipContent}
      </defs>
    </svg>
  ) : undefined;
  const brushChromeNode = props.hasBrush && props.brushHost && props.brushPixelExtent ? (
    <BrushChrome
      host={props.brushHost}
      x0={props.brushPixelExtent.x0}
      x1={props.brushPixelExtent.x1}
      innerWidth={props.innerWidthForBrush}
      innerHeight={props.innerHeightForBrush}
      blurPx={props.brushConfig?.blurPx}
      fadeOuterEdges={props.brushConfig?.fadeOuterEdges}
      selectionPattern={props.brushConfig?.selectionPattern}
      selectedBoxStyle={props.brushConfig?.selectedBoxStyle}
    />
  ) : undefined;
  const crosshairNode = renderCrosshairNode(props.crosshairGradientDef, props.margin.top, props.plotHeight);
  const projectionGradientNodes = props.projectionGradientDefsArea.map((grad: Readonly<ProjectionGradientDef>) => (
    <linearGradient key={grad.id} id={grad.id} gradientUnits="userSpaceOnUse" x1={grad.startX} y1={grad.startY} x2={grad.endX} y2={grad.endY}>
      <stop offset="0%" stopColor={grad.gradientStart} />
      <stop offset="100%" stopColor={grad.gradientEnd} />
    </linearGradient>
  ));
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
  const markerGradientDefsNode = (props.projectionGradientDefsArea.length > 0 || props.areaMarkerGradientDefs.length > 0) && (
    <svg
      width={0}
      height={0}
      style={HIDDEN_DEF_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {projectionGradientNodes}
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
  const patternDefsNode = props.patternDefs.length > 0 && (
    <svg
      width={0}
      height={0}
      style={HIDDEN_DEF_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>{patternDefNodes}</defs>
    </svg>
  );
  return (
    <>
      {brushClipNode}
      {brushChromeNode}
      {crosshairNode}
      {markerGradientDefsNode}
      {patternDefsNode}
    </>
  );
};

interface AreaChartBackdropProps {
  readonly background: ExtractedChildren["background"];
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
  readonly loadingLabel: string | undefined;
  readonly margin: Readonly<ChartMargin>;
}

const AreaChartBackdrop = (props: Readonly<AreaChartBackdropProps>): ReactNode => {
  const loadingLabelNode = props.isLoading && (props.loadingLabel?.length ?? 0) > 0 ? <LoadingLabel text={props.loadingLabel ?? ""} /> : undefined;
  const backgroundNode = props.background ? (
    <BackgroundLayer
      config={props.background}
      innerWidth={props.innerWidth}
      innerHeight={props.innerHeight}
      marginLeft={props.margin.left}
      marginTop={props.margin.top}
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

export { AreaChartBackdrop, AreaChartBody, AreaChartDefSvgs, AreaChartOverlays };
export type { AreaChartBackdropProps, AreaChartBodyProps, AreaChartDefSvgsProps, AreaChartOverlaysProps };
