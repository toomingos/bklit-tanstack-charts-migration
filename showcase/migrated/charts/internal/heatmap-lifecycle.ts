import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Transition } from "motion/react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { getHeatmapContributionLevel } from "./heatmap-utils";
import type { ChartStatus } from "./types";

const HEATMAP_LOADING_CONCEAL_MS = 450;

type HeatmapChartPhase = "loading" | "revealing" | "ready" | "exitingReady";

type HeatmapRevealMode = "enter" | "fromLoading" | null;

const resolveRestingChartPhase = (status: ChartStatus): HeatmapChartPhase => status === "loading" ? "loading" : "ready";


interface HeatmapLifecycleState {
  readonly chartPhase: HeatmapChartPhase;
  readonly revealEpoch: number;
  readonly isLoaded: boolean;
  readonly revealMode: HeatmapRevealMode;
  readonly animateCells: boolean;
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
  readonly phaseRef: RefObject<HeatmapChartPhase>;
}

interface HeatmapRevealTimers {
  readonly concealTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | null>;
  readonly finishTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | null>;
}

interface StatusTransitionParams {
  readonly status: ChartStatus;
  readonly prevStatus: ChartStatus;
  readonly concealTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | null>;
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
  readonly finishTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | null>;
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
  // Layout-effect sync so the passive enter-reveal effect reads the committed phase.
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

const canEnterHeatmapReveal = (status: ChartStatus, phaseRef: RefObject<HeatmapChartPhase>): boolean =>
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
    if (!animation.animateEnter || phase.chartPhase !== "revealing") {return undefined;}
    armHeatmapFinishTimer({ finishTimerRef: timers.finishTimerRef, setChartPhase: phase.setChartPhase, setIsLoaded: phase.setIsLoaded, setRevealMode: phase.setRevealMode, timeoutMs: animationDurationMs });
    // Captured at arm time so cleanup clears exactly this timer.
    const armedTimerId = timers.finishTimerRef.current;
    return (): void => {
      if (armedTimerId !== null) {
        clearTimeout(armedTimerId);
      }
    };
  }, [animation.animateEnter, phase.chartPhase, animationDurationMs, timers.finishTimerRef, phase.setChartPhase, phase.setIsLoaded, phase.setRevealMode]);

  return { animateCells: animation.animateCells, chartPhase: phase.chartPhase, isLoaded: phase.isLoaded, revealEpoch: phase.revealEpoch, revealMode: phase.revealMode };
}

const HEATMAP_DEFAULT_ENTER_DURATION_MS = 1600;
// Cubic-bezier(0.85, 0, 0.916, 0.282): ported bklit reveal easing, x1/y1/x2/y2 in order.
const HEATMAP_ENTER_EASE_X1 = 0.85;
const HEATMAP_ENTER_EASE_X2 = 0.916;
const HEATMAP_ENTER_EASE_Y2 = 0.282;
const HEATMAP_DEFAULT_ENTER_EASE = [HEATMAP_ENTER_EASE_X1, 0, HEATMAP_ENTER_EASE_X2, HEATMAP_ENTER_EASE_Y2] as const;

type HeatmapEnterTransition = Transition;

const HEATMAP_DEFAULT_ENTER_TRANSITION: HeatmapEnterTransition = {
  duration: 1.6,
  ease: [HEATMAP_ENTER_EASE_X1, 0, HEATMAP_ENTER_EASE_X2, HEATMAP_ENTER_EASE_Y2],
  type: "tween",
};

/** Chart opacity while `status="loading"`. */
const HEATMAP_LOADING_CHART_OPACITY = 1;

/** Default max per-cell opacity during loading shimmer. */
const HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY = 0.85;

/** Default share of cells that participate in loading shimmer, 0-1. */
const HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS = 1;

const HEATMAP_ENTER_STAGGER_SPREAD = 0.6;

// Lehmer / Park-Miller PRNG (modulus 2^31-1, multiplier 7^5).
const PARK_MILLER_MODULUS = 2_147_483_647;
const PARK_MILLER_MODULUS_MINUS_ONE = 2_147_483_646;
const PARK_MILLER_MULTIPLIER = 16_807;
const seededRandom = (seed: number): () => number => {
  let state = seed % PARK_MILLER_MODULUS;
  if (state <= 0) {state += PARK_MILLER_MODULUS_MINUS_ONE;}
  return () => {
    state = (state * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS;
    return (state - 1) / PARK_MILLER_MODULUS_MINUS_ONE;
  };
}

const HEATMAP_SEED_COLUMN_FACTOR = 1009;
const HEATMAP_SEED_ROW_FACTOR = 9176;
const heatmapCellSeed = (column: number, row: number): number => column * HEATMAP_SEED_COLUMN_FACTOR + row * HEATMAP_SEED_ROW_FACTOR;


interface ComputeHeatmapEnterFadeDelayParams {
  readonly column: number;
  readonly row: number;
  readonly revealEpoch: number;
  readonly animationDurationMs: number;
  readonly enterStaggerScale: number;
  readonly fadeDurationSec: number;
}

const MS_PER_SECOND = 1000;
// Salt separating reveal epochs in the cell-seed hash (2^19 - 1).
const HEATMAP_REVEAL_EPOCH_SALT = 524_287;
// Floor on the stagger scale so cells still spread when animation is nearly instant.
const HEATMAP_MIN_ENTER_STAGGER_SCALE = 0.25;
const computeHeatmapEnterFadeDelayMs = (params: Readonly<ComputeHeatmapEnterFadeDelayParams>): number => {
  const seed = heatmapCellSeed(params.column, params.row) + params.revealEpoch * HEATMAP_REVEAL_EPOCH_SALT;
  const random = seededRandom(seed);
  const fadeMs = params.fadeDurationSec * MS_PER_SECOND;
  const maxDelayMs = Math.max(0, params.animationDurationMs - fadeMs);
  const spreadMs = maxDelayMs * HEATMAP_ENTER_STAGGER_SPREAD * Math.max(params.enterStaggerScale, HEATMAP_MIN_ENTER_STAGGER_SCALE);
  return random() * spreadMs;
}

// Cap on the per-cell fade plus the share of the total duration it may take.
const HEATMAP_MAX_ENTER_FADE_SEC = 0.45;
const HEATMAP_FADE_DURATION_FRACTION = 0.3;
const resolveHeatmapEnterFadeDurationSec = (enterTransition: Readonly<HeatmapEnterTransition> | undefined, animationDurationMs: number): number => {
  if (enterTransition?.duration !== undefined) {return enterTransition.duration;}
  return Math.min(HEATMAP_MAX_ENTER_FADE_SEC, (animationDurationMs / MS_PER_SECOND) * HEATMAP_FADE_DURATION_FRACTION);
}

/** Min/max contribution levels present in the dataset. */
interface HeatmapLevelRange {
  min: number;
  max: number;
}

// Top of the contribution-level scale (matches getHeatmapContributionLevel's 0-4 range).
const HEATMAP_EMPTY_LEVEL_RANGE_MAX = 4;

interface HeatmapColumnBins {
  readonly bins: readonly { readonly count: number }[];
}

const columnContributionRange = (column: Readonly<HeatmapColumnBins>): HeatmapLevelRange => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const bin of column.bins) {
    const level = getHeatmapContributionLevel(bin.count);
    if (level < min) {min = level;}
    if (level > max) {max = level;}
  }
  return { max, min };
}

const mergeContributionRange = (accumulated: Readonly<HeatmapLevelRange>, range: Readonly<HeatmapLevelRange>): HeatmapLevelRange => ({
  max: Math.max(accumulated.max, range.max),
  min: Math.min(accumulated.min, range.min),
});

const finalizeContributionRange = (accumulated: Readonly<HeatmapLevelRange>): HeatmapLevelRange => {
  // Empty-data fallback is intentionally {min:0, max:4}, not {min:0, max:0}.
  if (!(Number.isFinite(accumulated.min) && Number.isFinite(accumulated.max))) {return { max: HEATMAP_EMPTY_LEVEL_RANGE_MAX, min: 0 };}
  return { max: accumulated.max, min: accumulated.min };
}

const computeHeatmapLevelRange = (data: readonly HeatmapColumnBins[]): HeatmapLevelRange => {
  let accumulated: HeatmapLevelRange = { max: Number.NEGATIVE_INFINITY, min: Number.POSITIVE_INFINITY };
  for (const column of data) {
    accumulated = mergeContributionRange(accumulated, columnContributionRange(column));
  }
  return finalizeContributionRange(accumulated);
}

export {
  HEATMAP_DEFAULT_ENTER_DURATION_MS,
  HEATMAP_DEFAULT_ENTER_EASE,
  HEATMAP_DEFAULT_ENTER_TRANSITION,
  HEATMAP_LOADING_CHART_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
  HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
  HEATMAP_LOADING_CONCEAL_MS,
  HEATMAP_ENTER_STAGGER_SPREAD,
  computeHeatmapEnterFadeDelayMs,
  computeHeatmapLevelRange,
  heatmapCellSeed,
  resolveHeatmapEnterFadeDurationSec,
  seededRandom,
  useHeatmapChartLifecycle,
};
export type {
  ComputeHeatmapEnterFadeDelayParams,
  HeatmapChartPhase,
  HeatmapEnterTransition,
  HeatmapLevelRange,
  HeatmapLifecycleState,
  HeatmapRevealMode,
};
