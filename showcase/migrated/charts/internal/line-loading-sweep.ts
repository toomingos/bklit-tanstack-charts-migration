import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  LINE_LOADING_PULSE_CYCLE_S,
  LINE_LOADING_LOOP_PAUSE_MS,
} from "./design-tokens";
import type { LineLoadingPulseMode } from "./line-loading-pulse";

// Seconds-to-milliseconds factor for the rAF progress tween.
const MS_PER_SECOND = 1000;
// Mid-cycle progress: the pulse reveal peaks halfway, then exits.
const LINE_LOADING_PULSE_MIDPOINT = 0.5;

interface PulseTweenParams {
  readonly done?: () => void;
  readonly dur: number;
  readonly from: number;
  readonly to: number;
}

type PulseTween = (params: Readonly<PulseTweenParams>) => void;

interface PulseCompletionParams {
  readonly isCancelled: () => boolean;
  readonly onCycleComplete?: () => void;
}

interface ExitPulseSecondHalfParams extends PulseCompletionParams {
  readonly half: number;
  readonly run: PulseTween;
}

interface LoopPulseParams extends PulseCompletionParams {
  readonly notifyCycleComplete: () => void;
  readonly run: PulseTween;
}

interface EnterPulseParams extends PulseCompletionParams {
  readonly half: number;
  readonly notifyCycleComplete: () => void;
  readonly run: PulseTween;
}

interface ExitPulseParams extends PulseCompletionParams {
  readonly half: number;
  readonly notifyCycleComplete: () => void;
  readonly readProgress: () => number;
  readonly run: PulseTween;
}

interface StartPulseModeParams extends PulseCompletionParams {
  readonly half: number;
  readonly mode: LineLoadingPulseMode;
  readonly notifyCycleComplete: () => void;
  readonly readProgress: () => number;
  readonly run: PulseTween;
}

interface PulseTweenFactoryParams {
  readonly animRef: RefObject<Animation | null>;
  readonly isCancelled: () => boolean;
  readonly setProgress: Dispatch<SetStateAction<number>>;
}

// Guarded cycle completion; hoisted so the exit-mode chain stays shallow.
const completePulseCycle = ({ isCancelled, onCycleComplete }: Readonly<PulseCompletionParams>): void => {
  if (isCancelled()) {return;}
  onCycleComplete?.();
};

// Second half of the exit sweep; hoisted so the exit branch nests no deeper than the other modes.
const startExitPulseSecondHalf = ({ half, isCancelled, onCycleComplete, run }: Readonly<ExitPulseSecondHalfParams>): void => {
  if (isCancelled()) {return;}
  run({
    done: (): void => { completePulseCycle({ isCancelled, onCycleComplete }); },
    dur: half,
    from: LINE_LOADING_PULSE_MIDPOINT,
    to: 1,
  });
};

// Loop sweep: full reveal then pause before the completion callback fires.
const startLoopPulse = ({ isCancelled, notifyCycleComplete, run }: Readonly<LoopPulseParams>): void => {
  run({
    done: (): void => {
      if (!isCancelled()) {
        globalThis.setTimeout(() => { notifyCycleComplete(); }, LINE_LOADING_LOOP_PAUSE_MS);
      }
    },
    dur: LINE_LOADING_PULSE_CYCLE_S,
    from: 0,
    to: 1,
  });
};

// Enter sweep: partial reveal up to the midpoint, then hold for the exit.
const startEnterPulse = ({ half, isCancelled, notifyCycleComplete, run }: Readonly<EnterPulseParams>): void => {
  run({
    done: (): void => { if (!isCancelled()) {notifyCycleComplete();} },
    dur: half,
    from: 0,
    to: LINE_LOADING_PULSE_MIDPOINT,
  });
};

// Exit sweep: finish from the in-flight progress, scaling duration to the distance left.
const startExitPulse = ({ half, isCancelled, notifyCycleComplete, readProgress, run }: Readonly<ExitPulseParams>): void => {
  const current = readProgress();
  if (current < LINE_LOADING_PULSE_MIDPOINT) {
    run({
      done: (): void => { startExitPulseSecondHalf({ half, isCancelled, onCycleComplete: notifyCycleComplete, run }); },
      dur: half * ((LINE_LOADING_PULSE_MIDPOINT - current) / LINE_LOADING_PULSE_MIDPOINT),
      from: current,
      to: LINE_LOADING_PULSE_MIDPOINT,
    });
  } else {
    run({
      done: (): void => { completePulseCycle({ isCancelled, onCycleComplete: notifyCycleComplete }); },
      dur: half * ((1 - current) / LINE_LOADING_PULSE_MIDPOINT),
      from: current,
      to: 1,
    });
  }
};

// Mode dispatch; each mode starter owns its own tween so no branch nests deeper than the others.
const startPulseMode = ({ half, isCancelled, mode, notifyCycleComplete, readProgress, run }: Readonly<StartPulseModeParams>): void => {
  if (mode === "loop") {
    startLoopPulse({ isCancelled, notifyCycleComplete, run });
  } else if (mode === "enter") {
    startEnterPulse({ half, isCancelled, notifyCycleComplete, run });
  } else {
    // Only the exit mode remains — every LineLoadingPulseMode is handled above.
    startExitPulse({ half, isCancelled, notifyCycleComplete, readProgress, run });
  }
};

// One rAF progress tween; cancelling the previous animation keeps sweeps from overlapping.
const createPulseTween = ({ animRef, isCancelled, setProgress }: Readonly<PulseTweenFactoryParams>): PulseTween => {
  const run = ({ done, dur, from, to }: Readonly<PulseTweenParams>): void => {
    try { animRef.current?.cancel(); } catch {
      // Superseded pulse already settled — nothing to cancel.
    }
    let start: number | undefined = undefined;
    const step = (now: number): void => {
      if (isCancelled()) {return;}
      start ??= now;
      const ratio = Math.min(1, (now - start) / (dur * MS_PER_SECOND));
      const current = from + (to - from) * ratio;
      setProgress(current);
      if (ratio < 1) {requestAnimationFrame(step);}
      else {done?.();}
    };
    requestAnimationFrame(step);
  };
  return run;
};

export {
  LINE_LOADING_PULSE_MIDPOINT,
  MS_PER_SECOND,
  createPulseTween,
  startPulseMode,
};
export type {
  PulseCompletionParams,
  PulseTween,
  PulseTweenFactoryParams,
  PulseTweenParams,
  StartPulseModeParams,
};
