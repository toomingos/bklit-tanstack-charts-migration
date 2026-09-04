// Area setup hook: top contiguous group from area-chart.tsx (margin through focus injection).
// Hook call order is unchanged; logic moved verbatim.
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useEffectEvent } from "./use-effect-event";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./use-chart-margin";
import { useMeasuredRect } from "./use-container-size";
import { useChartPhaseOrchestrator } from "./use-chart-phase-orchestrator";
import { clipRevealTiming } from "./enter-transition";
import type { EnterTransition } from "./enter-transition";
import { extractChildren } from "./children-extract";
import { useChartLegendHover } from "./chart-legend-hover-context";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useFocusInjection } from "./focus-injection";
import type { FocusInjection } from "./focus-injection";
import { extractProjectionLineConfigs } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import { useSanitizedId } from "./use-sanitized-id";
import type { ProjectionPhaseHandle } from "./terminal-marker";
import type { ChartMargin } from "./use-chart-margin";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum, ChartStatus, ExtractedChildren } from "./types";
import { resolveEffectiveYDomainTweenDuration, resolveHeightPx } from "./area-chart-model";

interface AreaChartSetupParams {
  readonly animationDuration: number;
  readonly animationEasing: string;
  readonly aspectRatio: string;
  readonly children: ReactNode;
  readonly data: ChartDatum[];
  readonly enterTransition: Readonly<EnterTransition> | undefined;
  readonly marginProp: Partial<ChartMargin> | undefined;
  readonly onPhaseChange: ((phase: ChartPhase) => void) | undefined;
  readonly revealSignature: string;
  readonly status: ChartStatus;
  readonly tweenYDomainOnXDomainChange: boolean;
  readonly xDomain: [Date, Date] | undefined;
  readonly yDomainTween: boolean;
}

type AreaFocusInjection = Pick<
  FocusInjection<ChartDatum, Date, number>,
  "captureRenderContext" | "clientToScene" | "interactionRef" | "sceneRef"
>;

interface AreaChartSetup extends AreaFocusInjection {
  readonly areas: ExtractedChildren["areas"];
  readonly background: ExtractedChildren["background"];
  readonly brushes: ExtractedChildren["brushes"];
  readonly chartMarkers: ExtractedChildren["chartMarkers"];
  readonly chartPhase: ChartPhase;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly effectiveYDomainTweenDuration: number;
  readonly grid: ExtractedChildren["grid"];
  readonly heightPx: number;
  readonly innerWidth: number;
  readonly isLoaded: boolean;
  readonly legendHoveredIndex: number | null;
  readonly margin: ChartMargin;
  readonly measuredHeight: number;
  readonly notifyYDomainTweenComplete: () => void;
  readonly patternAreas: ExtractedChildren["patternAreas"];
  readonly prefersReducedMotion: boolean;
  readonly projectionConfigs: ProjectionLineConfig[];
  readonly projectionEndMarkers: ExtractedChildren["projectionEndMarkers"];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: ExtractedChildren["projectionLines"];
  readonly projectionPhasePortRef: RefObject<ProjectionPhaseHandle | null>;
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealEpoch: number;
  readonly terminalMarkers: ExtractedChildren["terminalMarkers"];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly yAxis: ExtractedChildren["yAxis"];
}

const useAreaChartSetup = (params: Readonly<AreaChartSetupParams>): AreaChartSetup => {
  const margin = useChartMargin(params.marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height: measuredHeight } = useMeasuredRect(containerRef);
  const onPhaseChangeEvent = useEffectEvent((phase: ChartPhase): void => {
    params.onPhaseChange?.(phase);
  });
  const projectionPhasePortRef = useRef<ProjectionPhaseHandle | null>(null);

  // XDomain-driven tweening forces a nonzero duration even when yDomainTween is 0/false.
  const effectiveYDomainTweenDuration = useMemo(
    () => resolveEffectiveYDomainTweenDuration(params.yDomainTween, params.tweenYDomainOnXDomainChange, params.xDomain),
    [params.yDomainTween, params.tweenYDomainOnXDomainChange, params.xDomain],
  );
  const {
    chartPhase,
    isLoaded: orchIsLoaded,
    revealEpoch,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration: params.animationDuration,
    chartStatus: params.status,
    revealSignature: params.revealSignature,
    skeletonData: [],
    targetData: params.data,
    yDomainTweenDuration: effectiveYDomainTweenDuration,
  });

  // Primitive deps: enterTransition is usually an inline object literal.
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(params.enterTransition, params.animationDuration, params.animationEasing),
    [params.enterTransition, params.animationDuration, params.animationEasing],
  );

  const isLoaded = orchIsLoaded;

  useEffect(() => { onPhaseChangeEvent(chartPhase); }, [chartPhase]);

  useEffect(() => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  }, [chartPhase]);

  useEffect(() => {
    if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
      notifyYDomainTweenComplete();
    }
  }, [chartPhase, notifyYDomainTweenComplete]);

  const { areas, patternAreas, grid, xAxis, yAxis, background, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, chartMarkers, brushes } = useMemo(
    () => extractChildren(params.children),
    [params.children],
  );
  const tooltipEnabled = tooltip?.enabled ?? false;
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { captureRenderContext, sceneRef, interactionRef, clientToScene } =
    useFocusInjection<ChartDatum, Date, number>();
  const projectionConfigs = useMemo(() => extractProjectionLineConfigs(params.children), [params.children]);
  const projectionGradientBaseId = useSanitizedId();

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const heightPx = resolveHeightPx(width, measuredHeight, params.aspectRatio);

  return {
    areas,
    background,
    brushes,
    captureRenderContext,
    chartMarkers,
    chartPhase,
    clientToScene,
    containerRef,
    effectiveYDomainTweenDuration,
    grid,
    heightPx,
    innerWidth,
    interactionRef,
    isLoaded,
    legendHoveredIndex,
    margin,
    measuredHeight,
    notifyYDomainTweenComplete,
    patternAreas,
    prefersReducedMotion,
    projectionConfigs,
    projectionEndMarkers,
    projectionGradientBaseId,
    projectionLines,
    projectionPhasePortRef,
    revealDurationMs,
    revealEasingCss,
    revealEpoch,
    sceneRef,
    terminalMarkers,
    tooltip,
    tooltipEnabled,
    width,
    xAxis,
    yAxis,
  };
};

export { useAreaChartSetup };
export type { AreaChartSetup, AreaChartSetupParams };
