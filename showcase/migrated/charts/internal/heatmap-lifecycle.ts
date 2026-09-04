import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { HEATMAP_LOADING_CONCEAL_MS } from "./heatmap-animation";
import type { ChartStatus } from "./types";

type HeatmapChartPhase = "loading" | "revealing" | "ready" | "exitingReady";

type HeatmapRevealMode = "enter" | "fromLoading" | null;

const resolveRestingChartPhase = (status: ChartStatus): HeatmapChartPhase => status === "loading" ? "loading" : "ready";


interface HeatmapLifecycleState {
  chartPhase: HeatmapChartPhase;
  revealEpoch: number;
  isLoaded: boolean;
  revealMode: HeatmapRevealMode;
  animateCells: boolean;
}

interface HeatmapLifecycleParams {
  readonly status: ChartStatus;
  readonly revealSignature: string | number | undefined;
  readonly animationDurationMs: number;
  readonly animate: boolean;
}

type PhaseSetter<Phase> = (value: Phase | ((prev: Phase) => Phase)) => void;

interface HeatmapEnterAnimation {
  readonly animateCells: boolean;
  readonly animateEnter: boolean;
}

interface HeatmapPhaseStateBag {
  readonly chartPhase: HeatmapChartPhase;
  readonly setChartPhase: PhaseSetter<HeatmapChartPhase>;
  readonly isLoaded: boolean;
  readonly setIsLoaded: PhaseSetter<boolean>;
  readonly revealEpoch: number;
  readonly setRevealEpoch: PhaseSetter<number>;
  readonly revealMode: HeatmapRevealMode;
  readonly setRevealMode: PhaseSetter<HeatmapRevealMode>;
  readonly phaseRef: { current: HeatmapChartPhase };
}

interface HeatmapRevealTimers {
  readonly concealTimerRef: { current: ReturnType<typeof globalThis.setTimeout> | null };
  readonly finishTimerRef: { current: ReturnType<typeof globalThis.setTimeout> | null };
}

interface StatusTransitionParams {
  readonly status: ChartStatus;
  readonly prevStatus: ChartStatus;
  readonly concealTimerRef: { current: ReturnType<typeof globalThis.setTimeout> | null };
  readonly setRevealMode: PhaseSetter<HeatmapRevealMode>;
  readonly setIsLoaded: PhaseSetter<boolean>;
  readonly setChartPhase: PhaseSetter<HeatmapChartPhase>;
  readonly setRevealEpoch: PhaseSetter<number>;
}

interface EnterRevealParams {
  readonly animateEnter: boolean;
  readonly status: ChartStatus;
  readonly phaseRef: { readonly current: HeatmapChartPhase };
  readonly setIsLoaded: PhaseSetter<boolean>;
  readonly setChartPhase: PhaseSetter<HeatmapChartPhase>;
  readonly setRevealMode: PhaseSetter<HeatmapRevealMode>;
  readonly setRevealEpoch: PhaseSetter<number>;
}

interface ArmFinishTimerParams {
  readonly finishTimerRef: { current: ReturnType<typeof globalThis.setTimeout> | null };
  readonly timeoutMs: number;
  readonly setIsLoaded: PhaseSetter<boolean>;
  readonly setChartPhase: PhaseSetter<HeatmapChartPhase>;
  readonly setRevealMode: PhaseSetter<HeatmapRevealMode>;
}

const useHeatmapEnterAnimation = (animate: boolean, animationDurationMs: number): HeatmapEnterAnimation => {
  const reducedMotion = usePrefersReducedMotion();
  const animateCells = animate && !reducedMotion;
  const animateEnter = animateCells && animationDurationMs > 0;
  return { animateCells, animateEnter };
}

const useHeatmapPhaseState = (status: ChartStatus, animate: boolean, animationDurationMs: number): HeatmapPhaseStateBag => {
  const [chartPhase, setChartPhase] = useState<HeatmapChartPhase>(() => resolveRestingChartPhase(status));
  const [isLoaded, setIsLoaded] = useState(() => status === "ready" && (!animate || animationDurationMs <= 0));
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [revealMode, setRevealMode] = useState<HeatmapRevealMode>(null);
  const phaseRef = useRef(chartPhase);
  // Latest-phase mirror for the enter-reveal effect below.
  // Sync runs in a layout effect, not during render.
  // The passive effect therefore always reads the committed phase.
  useLayoutEffect(() => {
    phaseRef.current = chartPhase;
  }, [chartPhase]);
  return { chartPhase, isLoaded, phaseRef, revealEpoch, revealMode, setChartPhase, setIsLoaded, setRevealEpoch, setRevealMode };
}

const useHeatmapRevealTimers = (): HeatmapRevealTimers => {
  const concealTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  useEffect((): (() => void) => () => {
      if (concealTimerRef.current !== null) {clearTimeout(concealTimerRef.current);}
      if (finishTimerRef.current !== null) {clearTimeout(finishTimerRef.current);}
    }
  , []);
  return { concealTimerRef, finishTimerRef };
}

const enterRevealingFromLoading = (params: Readonly<StatusTransitionParams>): void => {
  if (params.concealTimerRef.current !== null) {
    clearTimeout(params.concealTimerRef.current);
    params.concealTimerRef.current = null;
  }
  params.setRevealMode("fromLoading");
  params.setIsLoaded(false);
  params.setChartPhase("revealing");
  params.setRevealEpoch((epoch) => epoch + 1);
}

const exitReadyToLoading = (params: Readonly<StatusTransitionParams>): void => {
  params.setRevealMode(null);
  params.setIsLoaded(false);
  params.setChartPhase("exitingReady");
  params.concealTimerRef.current = globalThis.setTimeout(() => {
    params.setChartPhase("loading");
    params.concealTimerRef.current = null;
  }, HEATMAP_LOADING_CONCEAL_MS);
}

const handleHeatmapStatusTransition = (params: Readonly<StatusTransitionParams>): void => {
  if (params.prevStatus === params.status) {return;}
  if (params.status === "ready" && params.prevStatus === "loading") {
    enterRevealingFromLoading(params);
    return;
  }
  if (params.status === "loading" && params.prevStatus === "ready") {
    exitReadyToLoading(params);
  }
}

const settleHeatmapRestingPhase = (status: ChartStatus, setIsLoaded: PhaseSetter<boolean>, setChartPhase: PhaseSetter<HeatmapChartPhase>): void => {
  setIsLoaded(true);
  setChartPhase(resolveRestingChartPhase(status));
}

const canEnterHeatmapReveal = (status: ChartStatus, phaseRef: Readonly<{ current: HeatmapChartPhase }>): boolean =>
  status === "ready" && phaseRef.current === "ready";

const handleHeatmapEnterReveal = (params: Readonly<EnterRevealParams>): void => {
  if (!params.animateEnter) {
    settleHeatmapRestingPhase(params.status, params.setIsLoaded, params.setChartPhase);
    return;
  }
  if (!canEnterHeatmapReveal(params.status, params.phaseRef)) {return;}
  params.setRevealMode("enter");
  params.setRevealEpoch((epoch) => epoch + 1);
  params.setIsLoaded(false);
  params.setChartPhase("revealing");
}

const armHeatmapFinishTimer = (params: Readonly<ArmFinishTimerParams>): void => {
  params.finishTimerRef.current = globalThis.setTimeout(() => {
    params.setIsLoaded(true);
    params.setChartPhase("ready");
    params.setRevealMode(null);
    params.finishTimerRef.current = null;
  }, params.timeoutMs);
}

const useHeatmapChartLifecycle = (params: HeatmapLifecycleParams): HeatmapLifecycleState => {
  const { status, revealSignature, animationDurationMs, animate } = params;
  const animation = useHeatmapEnterAnimation(animate, animationDurationMs);
  const phase = useHeatmapPhaseState(status, animate, animationDurationMs);
  const timers = useHeatmapRevealTimers();
  const prevStatusRef = useRef(status);

  useLayoutEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;
    handleHeatmapStatusTransition({ concealTimerRef: timers.concealTimerRef, prevStatus, setChartPhase: phase.setChartPhase, setIsLoaded: phase.setIsLoaded, setRevealEpoch: phase.setRevealEpoch, setRevealMode: phase.setRevealMode, status });
  }, [status, timers.concealTimerRef, phase.setChartPhase, phase.setIsLoaded, phase.setRevealEpoch, phase.setRevealMode]);

  useEffect(() => {
    handleHeatmapEnterReveal({ animateEnter: animation.animateEnter, phaseRef: phase.phaseRef, setChartPhase: phase.setChartPhase, setIsLoaded: phase.setIsLoaded, setRevealEpoch: phase.setRevealEpoch, setRevealMode: phase.setRevealMode, status });
  }, [animation.animateEnter, animationDurationMs, status, revealSignature, phase.phaseRef, phase.setChartPhase, phase.setIsLoaded, phase.setRevealEpoch, phase.setRevealMode]);

  useEffect(() => {
    if (!animation.animateEnter || phase.chartPhase !== "revealing") {return;}
    armHeatmapFinishTimer({ finishTimerRef: timers.finishTimerRef, setChartPhase: phase.setChartPhase, setIsLoaded: phase.setIsLoaded, setRevealMode: phase.setRevealMode, timeoutMs: animationDurationMs });
    // Capture the armed timer id for cleanup instead of reading the ref there.
    // Nothing else writes this ref between arming and cleanup.
    // The captured id is exactly the timer the cleanup must clear.
    const armedTimerId = timers.finishTimerRef.current;
    return (): void => {
      if (armedTimerId !== null) {
        clearTimeout(armedTimerId);
      }
    };
  }, [animation.animateEnter, phase.chartPhase, animationDurationMs, timers.finishTimerRef, phase.setChartPhase, phase.setIsLoaded, phase.setRevealMode]);

  return { animateCells: animation.animateCells, chartPhase: phase.chartPhase, isLoaded: phase.isLoaded, revealEpoch: phase.revealEpoch, revealMode: phase.revealMode };
}

export { useHeatmapChartLifecycle };
export type { HeatmapChartPhase, HeatmapRevealMode, HeatmapLifecycleState };
