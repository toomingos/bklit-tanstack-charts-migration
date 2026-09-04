// Center-stat hooks: hover coordination plus the mount-entrance flow value.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Pub/sub contract any chart hover coordinator satisfies; keeps this hook chart-agnostic. */
interface CenterStatHoverSource {
  getHovered: () => number | null
  subscribe: (listener: () => void) => () => void
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
const useIntroFlowValue = (value: number, intro: boolean): number => {
  const introStartedRef = useRef(false);
  const [flowValue, setFlowValue] = useState(() => (intro ? 0 : value));

  useEffect((): (() => void) | undefined => {
    if (!intro) {
      setFlowValue(value);
      return undefined;
    }
    if (introStartedRef.current) {
      setFlowValue(value);
      return undefined;
    }
    introStartedRef.current = true;
    setFlowValue(0);
    const cancelFrames = scheduleDoubleRaf(() => { setFlowValue(value); });
    return (): void => {
      cancelFrames();
      introStartedRef.current = false;
    };
  }, [intro, value]);

  return flowValue;
}

export {
  useCenterStatHover,
  useIntroFlowValue,
};
export type {
  CenterStatHoverSource,
};
