import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFocusInjection } from "./focus-injection";
import type { FocusInjection } from "./focus-injection";
import { clipRevealTiming } from "./parity/animation";
import type { EnterTransition } from "./parity/animation";
import { DEFAULT_ANIMATION_DURATION_MS, DEFAULT_ANIMATION_EASING } from "./animation-defaults";
import { createScatterFocusStrategy } from "./scatter-focus-strategy";
import type { ChartDatum, ChartPhase } from "./types";
import type { ChartRendererRenderContext } from "@tanstack/charts";

interface UseScatterPhaseModelParams {
  readonly onPhaseChange: ((phase: ChartPhase) => void) | undefined;
}

interface ScatterPhaseModel {
  readonly phaseRef: RefObject<ChartPhase>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
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

  /*
   * Band-category focus reproduces bklit bisect semantics over ChartPoints (strict > tie-break),
   * memoized once over the stable phase ref to avoid pointless focus resubscription.
   */
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
  // Resolved span for the reveal-deadline timer below (bklit animation.ts:18).
  const resolvedAnimationDuration = animationDuration ?? DEFAULT_ANIMATION_DURATION_MS;
  // Derived render value (stable unless its inputs change); the render callback closes over it.
  const revealKey = useMemo(
    () => ({ duration: resolvedAnimationDuration, signature: revealSignature }),
    [resolvedAnimationDuration, revealSignature],
  );
  // Reveal end is timer-approximated (bar-chart-overlays): native motion has no per-mark hook.
  // HandleRender arms the deadline the mount teardown cancels.
  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    // Dots enter through the renderer, so every render settles ready; the key tracks replays.
    captureRenderContext(context);
    const marksGroup = context.surface.element.querySelector<SVGGElement>(".ts-chart__marks");
    if (marksGroup === null) {
      setPhase("ready");
      return;
    }
    const seen = seenRevealKeyRef.current;
    const revealKeyChanged =
      seen === null || seen.signature !== revealKey.signature || seen.duration !== revealKey.duration;
    // Already revealed for this key: later data swaps snap (bklit StaticSeriesPointMarker).
    if (!revealKeyChanged) {
      return;
    }
    if (revealDeadlineTimerRef.current !== null) {
      globalThis.clearTimeout(revealDeadlineTimerRef.current);
      revealDeadlineTimerRef.current = null;
    }
    seenRevealKeyRef.current = { ...revealKey };
    // No-op on mount (phase starts revealing); a genuine signature bump re-opens one reveal window.
    setPhase("revealing");
    if (resolvedAnimationDuration <= 0) {
      setPhase("ready");
      return;
    }
    revealDeadlineTimerRef.current = window.setTimeout(() => {
      revealDeadlineTimerRef.current = null;
      setPhase("ready");
    }, revealDurationMs);
  }, [captureRenderContext, revealDeadlineTimerRef, revealDurationMs, revealKey, resolvedAnimationDuration, seenRevealKeyRef, setPhase]);
  return {
    animationDuration: resolvedAnimationDuration,
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
