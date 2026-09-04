// Bklit ComposedChart on TanStack Charts. SeriesBar (raw) + Area/Line (decimated); one entry per dataKey.
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import { useChartRenderer } from "./internal/motion-renderer";
import { useFocusInjection } from "./internal/focus-injection";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import {
  extractReferenceAreaProps,
} from "./internal/reference-area-config";
import {
  ChartSelectionContext,
  extractSegmentComponents,
  useChartSelection,
} from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import {
  DISCRETE_INTERACTION_THRESHOLD,
  TOOLTIP_BOX_SPRING,
} from "./internal/design-tokens";
import { buildNativeTooltipExtension } from "./internal/native-tooltip";
import { BackgroundLayer } from "./internal/background-layer";
import { ProjectionMarkerOverlay } from './internal/terminal-marker';
import { NOTHING, useComposedResolved, useComposedYDomains } from "./internal/composed-series";
import type {
  ChartDatum,
} from "./internal/types";
import { isChartInteractionPhase, DEFAULT_Y_DOMAIN_TWEEN_MS } from './internal/chart-phase';
import type { ChartPhase } from './internal/chart-phase';
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import type { EnterTransition } from './internal/enter-transition';
import type { ChartMargin } from './internal/use-chart-margin';
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useComposedChildren } from "./internal/composed-children";
import { useComposedPointerHandlers } from "./internal/use-composed-hover";
import {
  useComposedAreaGradients,
  buildComposedScaleOptions,
  useComposedChartMarks,
  useComposedTooltipBody,
} from "./internal/composed-definition";
import { useComposedOverlayAnchors } from "./internal/use-composed-overlays";
import {
  useComposedPhaseAndReveal,
  useComposedRenderCallback,
} from "./internal/use-composed-reveal";
import {
  renderCrosshairNode,
  renderProjectionGradientsNode,
} from "./internal/composed-gradient-nodes";
import "./styles.css";

const DEFAULT_BAR_GAP = 4;
// Overlay host positioning: fully static, shared across renders.
const DATE_PILL_HOST_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;

interface ComposedChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  readonly barSize?: number;
  readonly maxBarSize?: number;
  readonly barGap?: number;
  readonly stacked?: boolean;
  readonly stackGap?: number;
  /** Easing for the per-bar grow reveal. */
  readonly animationEasing?: string;
  /** Overrides the reveal timing; springs coerce to tweens. */
  readonly enterTransition?: EnterTransition;
  /** Replay epoch input: changing it replays the reveal. */
  readonly revealSignature?: string;
  readonly children?: ReactNode;
}

// Stacked y-max is the largest per-row bar-sum vs largest non-bar value (bklit parity);
// Implementations live in ./internal/composed-data-math.

const ComposedChart = ({
  data,
  xDataKey = "date",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  barSize,
  maxBarSize,
  barGap = DEFAULT_BAR_GAP,
  stacked = false,
  stackGap = 0,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  children,
}: Readonly<ComposedChartProps>): ReactElement => {
  const phaseAndReveal = useComposedPhaseAndReveal({
    animationDuration,
    animationEasing,
    data,
    enterTransition,
    marginProp,
    onPhaseChange,
    revealSignature,
  });
  const {
    barConfigs, areaConfigs, lineConfigs, composedSeries, grid, xAxis, background, tooltip,
    projectionConfigs, composedProjectionLines, composedProjectionEndMarkers, composedTerminalMarkers,
    projectionGradientBaseId: projectionGradientBaseIdComposed,
  } = useComposedChildren(children);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { captureRenderContext, sceneRef, interactionRef, clientToScene } =
    useFocusInjection<ChartDatum, Date, number>();

  const { resolvedAreas, resolvedBars, resolvedLines } = useComposedResolved({
    areaConfigs,
    barConfigs,
    lineConfigs,
  });

  const innerWidth = Math.max(0, phaseAndReveal.width - phaseAndReveal.margin.left - phaseAndReveal.margin.right);
  // Decimation covers area/line only; bars stay raw, valueKeys still list every series (bklit quirk).
  const renderData = useMemo(() => {
    if (innerWidth <= 0) {return data;}
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      composedSeries.map((series) => series.dataKey),
    );
  }, [data, innerWidth, composedSeries]);

  const barDataKeys = useMemo(
    () => resolvedBars.map((bar) => bar.dataKey),
    [resolvedBars],
  );
  const { composedStackOffsets, nicedDomainsByAxis, projectValue, yDomainChanged, yDomainFinal } =
    useComposedYDomains({ barDataKeys, composedSeries, data, projectionConfigs, stacked });

  const { gradientIdBySeries, nativeComposedGradients } = useComposedAreaGradients(resolvedAreas);

  const heightPxComp = phaseAndReveal.width > 0 ? phaseAndReveal.width / parseAspectRatio(aspectRatio) : 0;
  const {
    composedEndAnchors, composedTerminalAnchors, projectionGradientDefs: projectionGradientDefsComposed,
    timeExtent: timeExtentComp, timeExtentRaw: timeExtentCompRaw,
  } = useComposedOverlayAnchors({
    composedProjectionEndMarkers,
    composedProjectionLines,
    composedTerminalMarkers,
    heightPx: heightPxComp,
    margin: phaseAndReveal.margin,
    projectionConfigs,
    projectionGradientBaseId: projectionGradientBaseIdComposed,
    renderData,
    width: phaseAndReveal.width,
    xDataKey,
    yDomain: yDomainFinal,
  });

  const dragSelectionActiveRef = useRef(false);
  const {
    clearFocusChrome, crosshairGradientDef, crosshairGradientId, datePill, handleFocusGroupChange,
    hoveredIndex, isDiscrete, labelFade, tooltipEnabled,
  } = useComposedPointerHandlers({
    chartPhase: phaseAndReveal.chartPhase,
    containerRef: phaseAndReveal.containerRef,
    data,
    dragSelectionActiveRef,
    interactionRef,
    isLoaded: phaseAndReveal.isLoaded,
    renderData,
    tooltip,
    xDataKey,
    xScaleRef: phaseAndReveal.xScaleD3Ref,
  });

  const { marks, scales } = useComposedChartMarks({
    barGap,
    barSize,
    composedSeries,
    composedStackOffsets,
    crosshairGradientId,
    data,
    gradientIdBySeries,
    grid,
    heightPx: heightPxComp,
    hoveredIndex,
    isDiscrete,
    margin: phaseAndReveal.margin,
    maxBarSize,
    projectValue,
    projectionConfigs,
    projectionGradientBaseId: projectionGradientBaseIdComposed,
    projectionLines: composedProjectionLines,
    renderData,
    resolvedAreas,
    resolvedBars,
    resolvedLines,
    stackGap,
    stacked,
    timeExtent: timeExtentComp,
    timeExtentRaw: timeExtentCompRaw,
    tooltip,
    tooltipEnabled,
    width: phaseAndReveal.width,
    xAxis,
    xDataKey,
    xScaleRef: phaseAndReveal.xScaleD3Ref,
    yDomain: yDomainFinal,
    yScaleRef: phaseAndReveal.yScaleD3Ref,
  });
  // Tween gate reads live phase/loaded state during render; the memo below rebuilds
  // Only when the gate flips, so phase transitions never rebuild marks mid-reveal.
  const yDomainTweenGateActive = isChartInteractionPhase(phaseAndReveal.chartPhase) && phaseAndReveal.isLoaded && yDomainChanged;
  const definition = useMemo(() => {
    if (phaseAndReveal.width <= 0 || !marks || !scales) {return NOTHING;}

    const { motion, xScaleOptions, yScaleOptions } = buildComposedScaleOptions({
      gateActive: yDomainTweenGateActive,
      grid,
      labelFade,
      marginBottom: phaseAndReveal.margin.bottom,
      scales,
      xAxis,
    });
    return defineChart({
      focus: "group-x",
      focusRing: false,
      gradients: nativeComposedGradients,
      margin: phaseAndReveal.margin,
      marks,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      motion,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: { x: xScaleOptions, y: yScaleOptions },
      svgAnimation: yDomainTweenGateActive
        ? { duration: DEFAULT_Y_DOMAIN_TWEEN_MS, easing: bezierEasing }
        : (false as const),
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: buildNativeTooltipExtension<ChartDatum, Date, number>({
        anchorX: "point",
        className: "bkm-native-tooltip",
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        enabled: tooltip?.enabled ?? false,
        spring: TOOLTIP_BOX_SPRING,
      }),
    });
  }, [
    marks,
    scales,
    phaseAndReveal.width,
    phaseAndReveal.margin,
    grid,
    labelFade,
    xAxis,
    yDomainTweenGateActive,
    nativeComposedGradients,
    renderData,
    tooltip,
  ]);

  const renderTooltipBody = useComposedTooltipBody({ composedSeries, tooltip, xDataKey });

  const handleRender = useComposedRenderCallback({
    animationDuration,
    captureRenderContext,
    chartPhase: phaseAndReveal.chartPhase,
    containerRef: phaseAndReveal.containerRef,
    data,
    mountedRef: phaseAndReveal.mountedRef,
    onPhaseChangeRef: phaseAndReveal.onPhaseChangeRef,
    pendingBarsRevealRef: phaseAndReveal.pendingBarsRevealRef,
    phaseRef: phaseAndReveal.phaseRef,
    prefersReducedMotion,
    resolvedBars,
    revealAnimationsRef: phaseAndReveal.revealAnimationsRef,
    revealDeadlineRef: phaseAndReveal.revealDeadlineRef,
    revealDurationMs: phaseAndReveal.revealDurationMs,
    revealEasingCss: phaseAndReveal.revealEasingCss,
    revealEpoch: phaseAndReveal.revealEpoch,
    revealPostPaintCancelRef: phaseAndReveal.revealPostPaintCancelRef,
    revealedEpochRef: phaseAndReveal.revealedEpochRef,
    yScaleD3Ref: phaseAndReveal.yScaleD3Ref,
  });

  // Reference areas track the merged final domain with projections, raw contract without.
  const yDomainComp = yDomainFinal;
  const innerWidthComp = Math.max(0, phaseAndReveal.width - phaseAndReveal.margin.left - phaseAndReveal.margin.right);
  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const resolveScenePosComp = clientToScene;
  const invertSceneXComp = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX),
    [sceneRef],
  );
  const { selection: compSelection } = useChartSelection({
    containerRef: phaseAndReveal.containerRef,
    data,
    enabled: true,
    innerWidth: innerWidthComp,
    invertSceneX: invertSceneXComp,
    marginLeft: phaseAndReveal.margin.left,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      clearFocusChrome();
    },
    resolveScenePos: resolveScenePosComp,
    xDataKey,
  });
  const refAreaChildrenComp = useMemo(() => extractReferenceAreaProps(children), [children]);
  const segChildrenComp = useMemo(() => extractSegmentComponents(children), [children]);

  const overlayRenderedComposed = (composedTerminalAnchors.length > 0 || composedEndAnchors.length > 0) && phaseAndReveal.width > 0 && heightPxComp > 0;
  useLayoutEffect(() => {
    if (!overlayRenderedComposed) {return;}
    phaseAndReveal.projectionPhasePortRef.current?.setPhase(phaseAndReveal.phaseRef.current);
  }, [overlayRenderedComposed, phaseAndReveal.projectionPhasePortRef, phaseAndReveal.phaseRef]);
  const composedChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  const containerStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%" }), [aspectRatio]);
  const refAreaGeom = useMemo((): ReferenceAreaLayersGeom => ({
    height: heightPxComp,
    isLoaded: phaseAndReveal.isLoaded,
    isTimeScale: true,
    margin: phaseAndReveal.margin,
    phase: phaseAndReveal.chartPhase,
    width: phaseAndReveal.width,
    xDomain: timeExtentComp ? [new Date(timeExtentComp.minTime), new Date(timeExtentComp.maxTime)] : NOTHING,
    yDomain: yDomainComp,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [heightPxComp, phaseAndReveal.isLoaded, phaseAndReveal.margin, phaseAndReveal.chartPhase, phaseAndReveal.width, timeExtentComp, yDomainComp, nicedDomainsByAxis]);
  const backgroundLayer = background ? (
    <BackgroundLayer
      config={background}
      innerWidth={innerWidth}
      innerHeight={Math.max(0, heightPxComp - phaseAndReveal.margin.top - phaseAndReveal.margin.bottom)}
      marginLeft={phaseAndReveal.margin.left}
      marginTop={phaseAndReveal.margin.top}
    />
  ) : NOTHING;
  const projectionGradientsNode = renderProjectionGradientsNode(projectionGradientDefsComposed);
  const markerOverlayNode = overlayRenderedComposed ? (
    <ProjectionMarkerOverlay
      width={phaseAndReveal.width}
      height={heightPxComp}
      margin={phaseAndReveal.margin}
      terminalMarkers={composedTerminalAnchors}
      projectionEndMarkers={composedEndAnchors}
      phasePort={phaseAndReveal.projectionPhasePortRef}
    />
  ) : NOTHING;
  const crosshairNode = renderCrosshairNode({
    def: crosshairGradientDef,
    heightPx: heightPxComp,
    margin: phaseAndReveal.margin,
  });
  const datePillNode = tooltipEnabled ? (
    <div
      ref={datePill.overlayHostRef}
      style={DATE_PILL_HOST_STYLE}
    />
  ) : NOTHING;

  // Inlined into the same element tree (a variable, not a component), so this
  // Changes nothing at runtime; it only flattens source nesting for jsx-max-depth.
  const definitionNode = definition ? (
    <>
      <RendererChart
        renderer={composedChartRenderer}
        ariaLabel="Composed chart"
        aspectRatio={parseAspectRatio(aspectRatio)}
        definition={definition}
        onFocusGroupChange={handleFocusGroupChange}
        onRender={handleRender}
        renderTooltipBody={tooltipEnabled ? renderTooltipBody : NOTHING}
      />
      {projectionGradientsNode}
      {heightPxComp > 0 && (
      <ReferenceAreaLayers
        configs={refAreaChildrenComp}
        geom={refAreaGeom}
      />
      )}
      <SegmentOverlay
        selection={compSelection}
        innerWidth={innerWidthComp}
        innerHeight={heightPxComp - phaseAndReveal.margin.top - phaseAndReveal.margin.bottom}
        marginLeft={phaseAndReveal.margin.left}
        marginTop={phaseAndReveal.margin.top}
        components={segChildrenComp}
      />
      {markerOverlayNode}
      {crosshairNode}
      {datePillNode}
    </>
  ) : NOTHING;

  return (
    <ChartSelectionContext.Provider value={compSelection}>
    <div
      ref={phaseAndReveal.containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="composed"
    >
      {backgroundLayer}
      {definitionNode}
    </div>
    </ChartSelectionContext.Provider>
  );
};

export { ComposedChart };
export type { ComposedChartProps };
