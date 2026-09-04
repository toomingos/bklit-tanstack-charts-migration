import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFocusInjection } from "./focus-injection";
import type { FocusInjection } from "./focus-injection";
import { clipRevealTiming } from "./enter-transition";
import type { EnterTransition } from "./enter-transition";
import { DEFAULT_ANIMATION_DURATION_MS, DEFAULT_ANIMATION_EASING } from "./animation-defaults";
import { handleScatterRender } from "./scatter-reveal";
import { createScatterFocusStrategy } from "./scatter-focus-strategy";
import type { ChartDatum, ChartPhase } from "./types";
import type { ChartRendererRenderContext } from "@tanstack/charts";

interface UseScatterPhaseModelParams {
  readonly onPhaseChange: ((phase: ChartPhase) => void) | undefined;
}

interface ScatterPhaseModel {
  readonly phaseRef: RefObject<ChartPhase>;
  readonly revealDeadlineTimerRef: { current: number | null };
  readonly scatterFocusStrategy: ReturnType<typeof createScatterFocusStrategy>;
  readonly seenRevealKeyRef: { current: { signature: string; duration: number } | null };
  readonly setPhase: (phase: ChartPhase) => void;
}

const useScatterPhaseModel = ({
  onPhaseChange,
}: Readonly<UseScatterPhaseModelParams>): ScatterPhaseModel => {
  // Bklit ScatterChartInner starts unloaded with no status prop: first phase is always "revealing".
  const phaseRef = useRef<ChartPhase>("revealing");
  const revealDeadlineTimerRef = useRef<number | null>(null);
  // Reveal runs once per lifetime; later data swaps snap (bklit StaticSeriesPointMarker).
  // Replay key (sankey shape): a signature bump re-opens a reveal window a boolean would snap shut.
  const seenRevealKeyRef = useRef<{ signature: string; duration: number } | null>(null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  // Latest-callback sync runs post-commit so the render body stays pure.
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  });
  const setPhase = useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) {return;}
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  // Band-category focus reproduces bklit bisect semantics over ChartPoints (strict > tie-break).
  // Memoized once: the strategy closes over the stable phase ref, so recreating it would
  // Resubscribe focus handling for no new information.
  const scatterFocusStrategy = useMemo(
    () => createScatterFocusStrategy(phaseRef),
    [phaseRef],
  );

  // Mount fires the initial phase; teardown cancels the reveal deadline (native motion needs no imperative cancel).
  useEffect(() => {
    onPhaseChangeRef.current?.("revealing");
    return (): void => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, []);

  return { phaseRef, revealDeadlineTimerRef, scatterFocusStrategy, seenRevealKeyRef, setPhase };
};

interface UseScatterTimingModelParams {
  readonly animationDuration: number | undefined;
  readonly animationEasing: string | undefined;
  readonly enterTransition: Readonly<EnterTransition> | undefined;
  readonly phase: ScatterPhaseModel;
  readonly revealSignature: string;
}

interface ScatterTimingModel {
  readonly animationDuration: number;
  readonly captureRenderContext: FocusInjection<ChartDatum, Date, number>["captureRenderContext"];
  readonly clientToScene: FocusInjection<ChartDatum, Date, number>["clientToScene"];
  readonly handleRender: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealKey: { readonly duration: number; readonly signature: string };
  readonly sceneRef: FocusInjection<ChartDatum, Date, number>["sceneRef"];
}

const useScatterTimingModel = ({
  animationDuration,
  animationEasing,
  enterTransition,
  phase: { revealDeadlineTimerRef, seenRevealKeyRef, setPhase },
  revealSignature,
}: Readonly<UseScatterTimingModelParams>): ScatterTimingModel => {
  const { captureRenderContext, sceneRef, clientToScene } = useFocusInjection<ChartDatum, Date, number>();
  // Reveal span coerces springs to tweens (bklit animation.ts:18).
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, animationDuration ?? DEFAULT_ANIMATION_DURATION_MS, animationEasing ?? DEFAULT_ANIMATION_EASING),
    [enterTransition, animationDuration, animationEasing],
  );
  // Derived render value (stable unless its inputs change); the render callback closes over it.
  const revealKey = useMemo(
    () => ({ duration: animationDuration ?? DEFAULT_ANIMATION_DURATION_MS, signature: revealSignature }),
    [animationDuration, revealSignature],
  );
  // Mount reveal is native per-element enter fade (same delay formula); handleRender tracks phase only.
  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    handleScatterRender({
      animationDuration: animationDuration ?? DEFAULT_ANIMATION_DURATION_MS,
      captureRenderContext,
      context,
      deadlineMs: revealDurationMs,
      revealKey,
      seenRef: seenRevealKeyRef,
      setPhase,
      timerRef: revealDeadlineTimerRef,
    });
  }, [animationDuration, captureRenderContext, revealDeadlineTimerRef, revealDurationMs, revealKey, seenRevealKeyRef, setPhase]);
  return {
    animationDuration: animationDuration ?? DEFAULT_ANIMATION_DURATION_MS,
    captureRenderContext,
    clientToScene,
    handleRender,
    revealDurationMs,
    revealEasingCss,
    revealKey,
    sceneRef,
  };
};

export { useScatterPhaseModel, useScatterTimingModel };
export type { ScatterPhaseModel, ScatterTimingModel, UseScatterPhaseModelParams, UseScatterTimingModelParams };
