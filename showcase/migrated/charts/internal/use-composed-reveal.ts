import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import type { ScaleLinear, ScaleTime } from "d3-scale";
import { useEffectEvent } from "./use-effect-event";
import type { ChartDatum } from "./types";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import type { ProjectionPhaseHandle } from "./terminal-marker";
import type { ResolvedBar } from "./composed-model";
import { clipRevealTiming } from "./enter-transition";
import type { EnterTransition } from "./enter-transition";
import { runRevealWipe, snapRevealWipe } from "./reveal-wipe";
import { startBarReveal } from "./composed-reveal";
import { DEFAULT_CHART_MARGIN, useChartMargin } from "./use-chart-margin";
import type { ChartMargin } from "./use-chart-margin";
import { HOST_INITIAL_WIDTH, adoptHostWidth } from "./chart-host";
import { useChartPhaseOrchestrator } from "./use-chart-phase-orchestrator";

interface UseComposedPhaseAndRevealParams {
  readonly animationDuration: number;
  readonly animationEasing: string;
  readonly data: ChartDatum[];
  readonly enterTransition: EnterTransition | undefined;
  readonly marginProp: Partial<ChartMargin> | undefined;
  readonly onPhaseChange: ((phase: ChartPhase) => void) | undefined;
  readonly revealSignature: string;
}

interface UseComposedPhaseAndRevealResult {
  readonly adoptWidth: (sceneWidth: number | undefined) => void;
  readonly chartPhase: ChartPhase;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly isLoaded: boolean;
  readonly margin: ChartMargin;
  readonly mountedRef: RefObject<boolean>;
  readonly notifyYDomainTweenComplete: () => void;
  readonly onPhaseChangeRef: RefObject<((phase: ChartPhase) => void) | undefined>;
  readonly pendingBarsRevealRef: RefObject<boolean>;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly projectionPhasePortRef: RefObject<ProjectionPhaseHandle | null>;
  readonly revealAnimationsRef: RefObject<Animation[]>;
  readonly revealDeadlineRef: RefObject<number | null>;
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealEpoch: number;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly revealedEpochRef: RefObject<number | null>;
  readonly width: number;
  readonly xScaleD3Ref: RefObject<ScaleTime<number, number> | null>;
  readonly yScaleD3Ref: RefObject<ScaleLinear<number, number> | null>;
}

const useComposedPhaseAndReveal = (
  params: Readonly<UseComposedPhaseAndRevealParams>,
): UseComposedPhaseAndRevealResult => {
  const {
    animationDuration, animationEasing, data, enterTransition, marginProp, onPhaseChange, revealSignature,
  } = params;
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const adoptWidth = useCallback((sceneWidth: number | undefined): void => {
    adoptHostWidth(setLiveWidth, sceneWidth);
  }, []);
  const width = liveWidth;
  const onPhaseChangeRef = useRef(onPhaseChange);
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);
  const notifyPhaseChange = useEffectEvent((phase: ChartPhase): void => {
    onPhaseChange?.(phase);
  });

  const {
    chartPhase,
    isLoaded,
    revealEpoch,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus: "ready",
    revealSignature,
    skeletonData: [],
    targetData: data,
    yDomainTweenDuration: DEFAULT_Y_DOMAIN_TWEEN_MS,
  });

  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    [enterTransition, animationDuration, animationEasing],
  );

  const phaseRef = useRef<ChartPhase>(chartPhase);
  useEffect(() => {
    phaseRef.current = chartPhase;
  }, [chartPhase]);

  // Reported "ready" waits for the bar-stagger deadline, not just the orchestrator timer.
  const pendingBarsRevealRef = useRef(false);
  useEffect(() => {
    if (chartPhase === "ready" && pendingBarsRevealRef.current) {return;}
    notifyPhaseChange(chartPhase);
  }, [chartPhase]);

  useEffect(() => {
    if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
      notifyYDomainTweenComplete();
    }
  }, [chartPhase, notifyYDomainTweenComplete]);

  const revealAnimationsRef = useRef<Animation[]>([]);
  const revealedEpochRef = useRef<number | null>(null);
  const revealDeadlineRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const xScaleD3Ref = useRef<ScaleTime<number, number> | null>(null);
  const yScaleD3Ref = useRef<ScaleLinear<number, number> | null>(null);

  const projectionPhasePortRef = useRef<ProjectionPhaseHandle | null>(null);
  useEffect(() => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  }, [chartPhase]);

  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
      if (revealDeadlineRef.current !== null) {
        clearTimeout(revealDeadlineRef.current);
        revealDeadlineRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const anim of revealAnimationsRef.current) {
        try {
          anim.cancel();
        } catch {
          // Animation may already be finished/removed; cancel() throwing is not actionable here.
        }
      }
      revealAnimationsRef.current = [];
    };
  }, []);

  return {
    adoptWidth,
    chartPhase,
    containerRef,
    isLoaded,
    margin,
    mountedRef,
    notifyYDomainTweenComplete,
    onPhaseChangeRef,
    pendingBarsRevealRef,
    phaseRef,
    projectionPhasePortRef,
    revealAnimationsRef,
    revealDeadlineRef,
    revealDurationMs,
    revealEasingCss,
    revealEpoch,
    revealPostPaintCancelRef,
    revealedEpochRef,
    width,
    xScaleD3Ref,
    yScaleD3Ref,
  };
};

interface UseComposedRenderCallbackParams {
  readonly adoptWidth: (sceneWidth: number | undefined) => void;
  readonly animationDuration: number;
  readonly captureRenderContext: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly chartPhase: ChartPhase;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly mountedRef: RefObject<boolean>;
  readonly onPhaseChangeRef: RefObject<((phase: ChartPhase) => void) | undefined>;
  readonly pendingBarsRevealRef: RefObject<boolean>;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly prefersReducedMotion: boolean;
  readonly resolvedBars: readonly Readonly<ResolvedBar>[];
  readonly revealAnimationsRef: RefObject<Animation[]>;
  readonly revealDeadlineRef: RefObject<number | null>;
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealEpoch: number;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly revealedEpochRef: RefObject<number | null>;
  readonly yScaleD3Ref: RefObject<ScaleLinear<number, number> | null>;
}

const useComposedRenderCallback = (
  params: Readonly<UseComposedRenderCallbackParams>,
): ((context: ChartRendererRenderContext<ChartDatum, Date, number>) => void) => {
  const {
    animationDuration, adoptWidth, captureRenderContext, chartPhase, containerRef, data, mountedRef,
    onPhaseChangeRef, pendingBarsRevealRef, phaseRef, prefersReducedMotion, resolvedBars,
    revealAnimationsRef, revealDeadlineRef, revealDurationMs, revealEasingCss, revealEpoch,
    revealPostPaintCancelRef, revealedEpochRef, yScaleD3Ref,
  } = params;
  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
    adoptWidth(context.scene.width);
    const marksRoot = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksRoot) {return;}
    // Gate reveal on phase "revealing": onRender fires every commit, not just on content change.
    if (!runRevealWipe({
      active: chartPhase === "revealing",
      animationDuration,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      marks: marksRoot,
      prefersReducedMotion,
    })) {return;}

    if (resolvedBars.length === 0) {return;}

    startBarReveal({
      animationsRef: revealAnimationsRef,
      baselineRange: yScaleD3Ref.current?.range(),
      dataLength: data.length,
      deadlineRef: revealDeadlineRef,
      easingCss: revealEasingCss,
      mountedRef,
      onPhaseChangeRef,
      pendingRef: pendingBarsRevealRef,
      phaseRef,
      postPaintCancelRef: revealPostPaintCancelRef,
      resolvedBars,
      revealDurationMs,
    }, marksRoot);
  }, [animationDuration, adoptWidth, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, resolvedBars, data.length, captureRenderContext, prefersReducedMotion, yScaleD3Ref, containerRef, mountedRef, onPhaseChangeRef, pendingBarsRevealRef, phaseRef, revealAnimationsRef, revealDeadlineRef, revealPostPaintCancelRef, revealedEpochRef]);

  useEffect(() => {
    if (chartPhase !== "revealing") {return;}
    snapRevealWipe({
      active: true,
      animationDuration,
      marks: containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks"),
      prefersReducedMotion,
    });
  }, [containerRef, chartPhase, animationDuration, prefersReducedMotion]);

  return handleRender;
};

export { useComposedPhaseAndReveal, useComposedRenderCallback };
export type {
  UseComposedPhaseAndRevealParams,
  UseComposedPhaseAndRevealResult,
  UseComposedRenderCallbackParams,
};
