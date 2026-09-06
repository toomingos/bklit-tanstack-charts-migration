// Bklit ComposedChart on TanStack Charts. SeriesBar (raw) + Area/Line (decimated); one entry per dataKey.
import { useCallback, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ChartHost, ChartRegistryBridge, HOST_INITIAL_WIDTH, useRegistryEntriesState } from "./internal/chart-host";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip as packageTooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import type { ChartTooltipInput } from "@tanstack/charts";
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
  BOX_OFFSET,
  DISCRETE_INTERACTION_THRESHOLD,
  TOOLTIP_BOX_SPRING,
} from "./internal/design-tokens";
import { CARTESIAN_MAX_FOCUS_DISTANCE_PX } from "./internal/cartesian-focus-distance";
import { BackgroundLayer } from "./internal/background-layer";
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
import { useComposedFocusChrome } from "./internal/use-composed-focus";
import {
  useComposedAreaGradients,
  buildComposedScaleOptions,
  useComposedChartMarks,
  useComposedTooltipBody,
} from "./internal/composed-definition";
import { useComposedOverlayAnchors } from "./internal/use-composed-overlays";
import { ComposedProjectionChrome } from "./internal/composed-overlay-chrome";
import { toSpecCrosshairGradient } from "./internal/fade-mask";
import {
  useComposedPhaseAndReveal,
  useComposedRenderCallback,
} from "./internal/use-composed-reveal";
import "./styles.css";

const DEFAULT_BAR_GAP = 4;

interface ComposedTooltipOptionParams {
  readonly discrete: boolean;
  readonly enabled: boolean;
}

// Panel top pins to the plot top; the x follows the primary focused point.
const buildComposedTooltipOption = ({ discrete, enabled }: Readonly<ComposedTooltipOptionParams>): ChartTooltipInput<ChartDatum, Date, number, "dom"> | false => {
  if (!enabled) {return false;}
  return {
    anchor: (_points, context) => ({
      x: context.focus.primary.x,
      y: context.plot.y - BOX_OFFSET,
    }),
    className: "bkm-native-tooltip",
    motion: discrete
      ? (false as const)
      : { damping: TOOLTIP_BOX_SPRING.damping, stiffness: TOOLTIP_BOX_SPRING.stiffness, type: "spring" as const },
    offset: BOX_OFFSET,
    placement: ["bottom-right", "bottom-left"] as const,
    portal,
    sticky: false,
    use: packageTooltip,
  };
};

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
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
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
  ariaLabel = "Composed chart",
  ariaDescription,
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
  // Registry union (V1.3 carriers): entries report up from inside the host.
  const [registryEntries, handleRegistryEntries] = useRegistryEntriesState();
  // One prefix per mount scopes renderer ids and seam ids alike.
  const idPrefix = useSanitizedId();
  const {
    barConfigs, areaConfigs, lineConfigs, composedSeries, grid, xAxis, background, tooltip,
    projectionConfigs, composedProjectionLines, composedProjectionEndMarkers, composedTerminalMarkers,
    projectionGradientBaseId: projectionGradientBaseIdComposed,
  } = useComposedChildren(children, registryEntries, idPrefix);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { captureRenderContext, clearFocus, clientToScene, sceneRef } =
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

  const heightPxComp = phaseAndReveal.width / parseAspectRatio(aspectRatio);
  const {
    timeExtent: timeExtentComp, timeExtentRaw: timeExtentCompRaw,
  } = useComposedOverlayAnchors({
    projectionConfigs,
    renderData,
    xDataKey,
  });

  const dragSelectionActiveRef = useRef(false);
  // Package-owned pointer: focus lands through onFocusChange below; the crosshair
  // X label shows the focused date while dim rides mark states, never a definition rebuild.
  const {
    clearFocusChrome, crosshairGradientDef, crosshairGradientId, handleFocusChange,
    isDiscrete, tooltipEnabled,
  } = useComposedFocusChrome({
    chartPhase: phaseAndReveal.chartPhase,
    clearFocus,
    data,
    dragSelectionActiveRef,
    idPrefix,
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
    // Width always arrives positive from host-owned sizing.
    if (!marks || !scales) {return NOTHING;}

    const { motion, xScaleOptions, yScaleOptions } = buildComposedScaleOptions({
      gateActive: yDomainTweenGateActive,
      grid,
      marginBottom: phaseAndReveal.margin.bottom,
      scales,
      xAxis,
    });
    return defineChart({
      focus: "group-x",
      focusRing: false,
      // Crosshair fade spans the plot, so the bbox spec form paints identically.
      gradients: crosshairGradientDef === undefined
        ? nativeComposedGradients
        : [...nativeComposedGradients, toSpecCrosshairGradient(crosshairGradientDef)],
      margin: phaseAndReveal.margin,
      marks,
      maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX,
      motion,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: { x: xScaleOptions, y: yScaleOptions },
      svgAnimation: yDomainTweenGateActive
        ? { duration: DEFAULT_Y_DOMAIN_TWEEN_MS, easing: bezierEasing }
        : (false as const),
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: buildComposedTooltipOption({
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        enabled: tooltip?.enabled ?? false,
      }),
    });
  }, [
    marks,
    scales,
    phaseAndReveal.margin,
    crosshairGradientDef,
    grid,
    xAxis,
    yDomainTweenGateActive,
    nativeComposedGradients,
    renderData,
    tooltip,
  ]);

  const renderTooltipBody = useComposedTooltipBody({ composedSeries, tooltip, xDataKey });

  const handleRender = useComposedRenderCallback({
    adoptWidth: phaseAndReveal.adoptWidth,
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

  const containerStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%" }), [aspectRatio]);
  const refAreaGeom = useMemo((): ReferenceAreaLayersGeom => ({
    isLoaded: phaseAndReveal.isLoaded,
    phase: phaseAndReveal.chartPhase,
    xDomain: timeExtentComp ? [new Date(timeExtentComp.minTime), new Date(timeExtentComp.maxTime)] : NOTHING,
    yDomain: yDomainComp,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [phaseAndReveal.isLoaded, phaseAndReveal.chartPhase, timeExtentComp, yDomainComp, nicedDomainsByAxis]);
  const backgroundLayer = background ? (
    <BackgroundLayer
      config={background}
      idPrefix={idPrefix}
    />
  ) : NOTHING;
  const projectionChromeNode = (
    <ComposedProjectionChrome
      composedProjectionEndMarkers={composedProjectionEndMarkers}
      composedProjectionLines={composedProjectionLines}
      composedTerminalMarkers={composedTerminalMarkers}
      heightPx={heightPxComp}
      phasePort={phaseAndReveal.projectionPhasePortRef}
      phaseRef={phaseAndReveal.phaseRef}
      projectionConfigs={projectionConfigs}
      projectionGradientBaseId={projectionGradientBaseIdComposed}
      renderData={renderData}
      timeExtent={timeExtentComp}
      timeExtentRaw={timeExtentCompRaw}
      width={phaseAndReveal.width}
      xDataKey={xDataKey}
      yDomain={yDomainFinal}
    />
  );
  const composedChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  // Inlined into the same element tree (a variable, not a component), so this
  // Changes nothing at runtime; it only flattens source nesting for jsx-max-depth.
  const definitionNode = definition ? (
      <ChartHost
        renderer={composedChartRenderer}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        aspectRatio={parseAspectRatio(aspectRatio)}
        height={heightPxComp}
        idPrefix={idPrefix}
        initialWidth={HOST_INITIAL_WIDTH}
        definition={definition}
        onFocusChange={handleFocusChange}
        onRender={handleRender}
        renderTooltipBody={tooltipEnabled ? renderTooltipBody : NOTHING}
      >
        {children}
        <ChartRegistryBridge onEntries={handleRegistryEntries} />
        {backgroundLayer}
        {heightPxComp > 0 && (
        <ReferenceAreaLayers
          configs={refAreaChildrenComp}
          geom={refAreaGeom}
        />
        )}
        <SegmentOverlay
          selection={compSelection}
          components={segChildrenComp}
          idPrefix={idPrefix}
        />
        {projectionChromeNode}
      </ChartHost>
  ) : NOTHING;

  return (
    <ChartSelectionContext.Provider value={compSelection}>
    <div
      ref={phaseAndReveal.containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="composed"
    >
      {definitionNode}
    </div>
    </ChartSelectionContext.Provider>
  );
};

ComposedChart.displayName = "ComposedChart";
export { ComposedChart };
export type { ComposedChartProps };
