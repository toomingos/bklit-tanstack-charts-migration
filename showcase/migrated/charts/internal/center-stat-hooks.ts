// Center-stat hooks: hover coordination plus the mount-entrance flow value.
import { useEffect, useState, useSyncExternalStore } from "react";

/** Pub/sub contract any chart hover coordinator satisfies; keeps this hook chart-agnostic. */
interface CenterStatHoverSource {
  readonly getHovered: () => number | null
  readonly subscribe: (listener: () => void) => () => void
}

const useCenterStatHover = (source: Readonly<CenterStatHoverSource>): number | null => useSyncExternalStore(
    source.subscribe,
    source.getHovered,
    source.getHovered,
  );

/**
 * Double-rAF scheduler for the mount entrance; keeps the effect body under the statement limit.
 * @param {() => void} onFrames - Callback invoked after two animation frames elapse.
 * @returns {() => void} Cleanup cancelling both pending frames.
 */
const scheduleDoubleRaf = (onFrames: () => void): (() => void) => {
  let innerRaf = 0;
  const outerRaf = requestAnimationFrame(() => {
    innerRaf = requestAnimationFrame(onFrames);
  });
  return (): void => {
    cancelAnimationFrame(outerRaf);
    cancelAnimationFrame(innerRaf);
  };
}

/** 0 → double-rAF → value mount entrance; `intro=false` passes through untouched.
 * @param {number} value - Target display value the flow animates toward after mount.
 * @param {boolean} intro - Whether to start at 0 and ramp up on the next frames.
 * @returns {number} Value to bind to the flow; 0 until the entrance frames elapse when intro runs.
 */
interface IntroFlowInputs {
  readonly intro: boolean;
  readonly value: number;
}

const useIntroFlowValue = (value: number, intro: boolean): number => {
  const [prevInputs, setPrevInputs] = useState<IntroFlowInputs>({ intro, value });
  const [entered, setEntered] = useState(() => !intro);

  // Render-time adjustment: a new target restarts the entrance from 0.
  if (prevInputs.intro !== intro || prevInputs.value !== value) {
    setPrevInputs({ intro, value });
    setEntered(false);
  }

  useEffect((): (() => void) | undefined => {
    if (!intro || entered) {
      return undefined;
    }
    const cancelFrames = scheduleDoubleRaf(() => { setEntered(true); });
    return cancelFrames;
  }, [entered, intro]);

  if (!intro || entered) {
    return value;
  }
  return 0;
}

export {
  useCenterStatHover,
  useIntroFlowValue,
};
export type {
  CenterStatHoverSource,
};
