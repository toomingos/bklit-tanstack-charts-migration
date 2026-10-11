// bklit's loading <-> ready sequences (use-chart-phase-orchestrator.ts:52-77, :112-152) over the one mounted chart.
// loading -> exiting -> swap -> tween -> ready; ready -> concealing -> tweenLoading -> loading (a ready flip mid-conceal goes to exiting, :52-66).
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { REVEAL_EASING } from "../motion/easing";
import { clearAttribute, raiseAttribute, writeVar } from "../host-write";
import type { ChartStatus } from "../types";

export type LoadingPhase = "loading" | "exiting" | "swap" | "tween" | "ready" | "concealing" | "tweenLoading";

/** bklit line-loading-timing.ts: 2.2s pulse cycle (the CSS loop adds the 280ms pause, styles.css `bkm-loading-pulse`). */
const PULSE_CYCLE_MS = 2200;
/** bklit line-loading-timing.ts LOADING_LABEL_EXIT_S: the sweep style fades out over 0.45s (loading-sweep.tsx:395-409) instead of finishing a cycle. */
const SWEEP_EXIT_MS = 450;
/** bklit chart-phase.ts DEFAULT_Y_DOMAIN_TWEEN_MS (use-animated-y-domains.ts:96-111). */
const Y_TWEEN_MS = 500;
/** bklit chart-phase.ts Y_DOMAIN_TWEEN_SKIP_THRESHOLD: a y domain that moves less than this share of its span snaps (y-domain-utils.ts shouldTweenYDomain). */
const Y_SKIP_THRESHOLD = 0.02;
/** bklit line-loading-pulse.tsx:90-93: a shrink never runs shorter than 10ms. */
const MIN_SHRINK_MS = 10;

const easeReveal = REVEAL_EASING;

type YDomains = Readonly<Record<string, readonly [number, number]>>;

/** bklit use-animated-y-domains.ts:50-79: the y domains tween only when some axis moves by at least the skip threshold (else onSettled fires at once). */
export const yDomainsTween = (from: YDomains, to: YDomains): boolean =>
  Object.entries(to).some(([id, b]) => {
    const a = Object.hasOwn(from, id) ? from[id] : b;
    const span = Math.max(Math.abs(b[1] - b[0]), Math.abs(a[1] - a[0]), 1);
    return Math.abs(b[0] - a[0]) / span >= Y_SKIP_THRESHOLD || Math.abs(b[1] - a[1]) / span >= Y_SKIP_THRESHOLD;
  });

interface LoadingPhaseOptions {
  /** Whether a series uses the sweep style (read when the exit starts). */
  readonly sweep: { readonly current: boolean };
  /** Whether the y domains of the latest build move enough to tween (`yDomainsTween`), read when a tween phase starts. */
  readonly yTween: { readonly current: boolean };
  readonly yDomainTween: boolean;
  readonly animationDuration: number;
  readonly host: RefObject<HTMLElement | null>;
}

interface AnimationEvent {
  readonly animationName: string;
  readonly timeStamp: number;
}

interface LoadingPhaseState {
  readonly phase: LoadingPhase;
  /** Host `animationstart` / `animationiteration` handler: tracks where the pulse loop is. */
  readonly onAnimationEvent: (event: AnimationEvent) => void;
}

interface Tracked {
  readonly status: ChartStatus;
  readonly phase: LoadingPhase;
}

/** The phase a status change lands on (orchestrator :52-77): to ready, a loading pulse exits (also from a half-made conceal); to loading, the series conceals first. */
const phaseAfterStatus = (status: ChartStatus, phase: LoadingPhase): LoadingPhase => {
  if (status === "loading") {
    return phase === "loading" ? phase : "concealing";
  }
  return phase === "loading" || phase === "concealing" || phase === "tweenLoading" ? "exiting" : phase;
};

/** The pulse exit that bklit's `LineLoadingPulseStroke` (line-loading-pulse.tsx:99-130) runs from the clip progress it finds. */
interface PulseExit {
  /** Progress the exit starts from, the progress the grow half ends on (equal when there is no grow), and the two durations. */
  readonly from: number;
  readonly mid: number;
  readonly growMs: number;
  readonly shrinkMs: number;
}

/** line-loading-pulse.tsx:99-111,112-130: one eased progress 0 -> 1 over 2.2s (<= 0.5 grows the clip, above shrinks it). Exit below 0.5 grows to 0.5 over `half * (0.5 - p) / 0.5`
 * then shrinks over a full half; at or above 0.5 it shrinks over `half * (1 - p) / 0.5` (10ms min). `elapsedMs` is the time into the cycle, undefined when no pulse runs. */
const pulseExitFrom = (elapsedMs: number | undefined): PulseExit => {
  const half = PULSE_CYCLE_MS / 2;
  const progress = elapsedMs === undefined ? 0 : easeReveal(Math.min(1, elapsedMs / PULSE_CYCLE_MS));
  if (progress < 0.5) {
    return { from: progress, mid: 0.5, growMs: Math.max(MIN_SHRINK_MS, (half * (0.5 - progress)) / 0.5), shrinkMs: half };
  }
  return { from: progress, mid: progress, growMs: 0, shrinkMs: Math.max(MIN_SHRINK_MS, (half * (1 - progress)) / 0.5) };
};

const EXIT_ATTR = "data-bkm-exit";

/** The exit as host vars + attribute for loading-css.ts (`--bkm-x-*`); returns the undo. Host attributes and vars are allowed. */
const writeExit = (host: HTMLElement, exit: PulseExit): (() => void) => {
  writeVar(host, "--bkm-x-from", String(exit.from));
  writeVar(host, "--bkm-x-mid", String(exit.mid));
  writeVar(host, "--bkm-x-grow", `${exit.growMs}ms`);
  writeVar(host, "--bkm-x-shrink", `${exit.shrinkMs}ms`);
  raiseAttribute(host, EXIT_ATTR);
  return (): void => { clearAttribute(host, EXIT_ATTR); };
};

interface Pending {
  readonly delay: number;
  readonly next: LoadingPhase;
  /** Advance on the next animation frame, not a timer: the wipe's instant snap is applied by the renderer's frame tick. */
  readonly onFrame?: boolean;
  /** Pulse exit to play on the host while waiting. */
  readonly exit?: PulseExit;
}

interface StepInput {
  readonly sweep: boolean;
  readonly yTweens: boolean;
  readonly animationDuration: number;
  readonly elapsed: number | undefined;
}

/** The timed advance out of a phase, or null for the phases that wait on a status change. */
const nextStep = (phase: LoadingPhase, { sweep, yTweens, animationDuration, elapsed }: StepInput): Pending | null => {
  const yMs = yTweens ? Y_TWEEN_MS : 0;
  if (phase === "swap") {
    // The swap commit changes the series / chrome (a plain rebuild); the next commit lands the data so it is a data step.
    return { delay: 0, next: "tween", onFrame: true };
  }
  if (phase === "exiting") {
    if (sweep) {
      return { delay: SWEEP_EXIT_MS, next: "swap" };
    }
    const exit = pulseExitFrom(elapsed);
    return { delay: exit.growMs + exit.shrinkMs, next: "swap", exit };
  }
  if (phase === "tween") {
    return { delay: yMs, next: "ready" };
  }
  if (phase === "concealing") {
    // bklit chart-reveal-clip.tsx:67-78: the conceal clip runs `animationDuration`, then onComplete advances (orchestrator :136-142).
    return { delay: Math.max(0, animationDuration), next: "tweenLoading" };
  }
  return phase === "tweenLoading" ? { delay: yMs, next: "loading" } : null;
};

export interface LoadingFlags {
  readonly chartLoading: boolean;
  readonly skeletonRows: boolean;
  readonly gridLoading: boolean;
}

/** The series / skeleton / grid flags of a phase (orchestrator isLoadingGridChromePhase): skeleton rows stay through swap and land after the conceal. */
export const loadingFlags = (phase: LoadingPhase): LoadingFlags => {
  const chartLoading = phase === "loading" || phase === "exiting";
  return { chartLoading, skeletonRows: chartLoading || phase === "swap" || phase === "tweenLoading", gridLoading: chartLoading || phase === "tweenLoading" };
};

export function useLoadingPhase(status: ChartStatus, { sweep, yTween, yDomainTween, animationDuration, host }: LoadingPhaseOptions): LoadingPhaseState {
  const [tracked, setTracked] = useState<Tracked>({ status, phase: status === "loading" ? "loading" : "ready" });
  // A status change adjusts the phase while rendering (react.dev "adjusting state on a prop change"), so no stale phase is committed.
  let { phase } = tracked;
  if (tracked.status !== status) {
    phase = phaseAfterStatus(status, tracked.phase);
    setTracked({ status, phase });
  }
  const cycleStart = useRef<number | undefined>(undefined);
  const onAnimationEvent = useCallback((event: AnimationEvent): void => {
    if (event.animationName === "bkm-loading-pulse") {
      cycleStart.current = event.timeStamp;
    }
  }, []);
  useEffect(() => {
    if (phase === "concealing" || phase === "tweenLoading" || phase === "swap") {
      // No pulse runs: a later exit finds a fresh stroke (progress 0), as bklit mounts it in the exiting phase.
      cycleStart.current = undefined;
    }
    const elapsed = cycleStart.current === undefined ? undefined : performance.now() - cycleStart.current;
    const step = nextStep(phase, { sweep: sweep.current, yTweens: yDomainTween && yTween.current, animationDuration, elapsed });
    if (step === null) {
      return undefined;
    }
    const { delay, next, exit } = step;
    const onFrame = step.onFrame === true;
    const hostEl = host.current;
    const undoExit = exit && hostEl ? writeExit(hostEl, exit) : undefined;
    // bklit use-chart-phase-orchestrator.ts:128-152 (pulse-exit / conceal / y-tween completion advance the phase).
    const advance = (): void => { setTracked((current) => (current.phase === phase ? { ...current, phase: next } : current)); };
    // A swap waits one frame: motion applies the 0 ms wipe snap in its rAF tick, and a commit before it cancels the snap (tween then starts from p=1).
    // bklit advances out of its y tween from motion's completion callback, i.e. a frame (use-chart-phase-orchestrator.ts:145-152).
    const timer = onFrame ? window.requestAnimationFrame(advance) : window.setTimeout(advance, delay);
    return (): void => {
      if (onFrame) {
        window.cancelAnimationFrame(timer);
      } else {
        window.clearTimeout(timer);
      }
      undoExit?.();
    };
  }, [phase, sweep, yTween, yDomainTween, animationDuration, host]);
  return { phase, onAnimationEvent };
}

interface Wipe {
  readonly p: number;
  readonly ms: number;
}

/** Wipe progress and duration per phase: loading / exiting show the pulse under an open wipe; swap / tween hold it closed until the ready reveal; concealing runs the wipe
 * past open to `concealP` (bklit's conceal clip, chart-reveal-clip.tsx:67-78), where tweenLoading holds it. */
export const loadingWipe = (phase: LoadingPhase, readyProgress: number, animationDuration: number, concealP: number): Wipe => {
  if (phase === "loading" || phase === "exiting") {
    return { p: 1, ms: 0 };
  }
  if (phase === "swap") {
    return { p: 0, ms: 0 };
  }
  if (phase === "tween") {
    return { p: 0, ms: animationDuration };
  }
  if (phase === "concealing") {
    return { p: concealP, ms: animationDuration };
  }
  return phase === "tweenLoading" ? { p: concealP, ms: 0 } : { p: readyProgress, ms: animationDuration };
};

/** Calls `onRevealed` once when the chart reaches ready from a concealed (swap / tween) phase (bklit isLoaded, use-chart-phase-orchestrator.ts:164-169). */
export function useRevealedFromConcealed(phase: LoadingPhase, onRevealed: () => void): void {
  const wasConcealed = useRef(false);
  useEffect(() => {
    if (phase === "ready" && wasConcealed.current) {
      onRevealed();
    }
    wasConcealed.current = phase === "swap" || phase === "tween";
  }, [phase, onRevealed]);
}
