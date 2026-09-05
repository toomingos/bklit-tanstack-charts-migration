import type { Transition } from "motion/react";

const DEFAULT_ANIMATION_DURATION_MS = 1100;
const MS_PER_SECOND = 1000;
const ENTER_EASE_0 = 0.85;
const ENTER_EASE_1 = 0;
const ENTER_EASE_2 = 0.15;
const ENTER_EASE_3 = 1;

const DEFAULT_CHART_ENTER_TRANSITION: Transition = {
  duration: DEFAULT_ANIMATION_DURATION_MS / MS_PER_SECOND,
  ease: [ENTER_EASE_0, ENTER_EASE_1, ENTER_EASE_2, ENTER_EASE_3],
  type: "tween",
};

type ChartEnterTransition = Transition;

const clipRevealTransition = (
  enterTransition?: Transition,
): Transition => {
  if (enterTransition?.type === "tween") {
    return {
      duration: enterTransition.duration,
      ease: enterTransition.ease ?? DEFAULT_CHART_ENTER_TRANSITION.ease,
      type: enterTransition.type,
    };
  }
  const duration =
    enterTransition?.duration ?? DEFAULT_ANIMATION_DURATION_MS / MS_PER_SECOND;
  return {
    duration,
    ease: DEFAULT_CHART_ENTER_TRANSITION.ease,
    type: "tween",
  };
};

const transitionWithDelay = (
  transition: Transition | undefined,
  delaySeconds: number,
  fallback: Transition = DEFAULT_CHART_ENTER_TRANSITION,
): Transition => {
  const base = transition ?? fallback;
  return { ...base, delay: delaySeconds };
};

export {
  clipRevealTransition,
  DEFAULT_CHART_ENTER_TRANSITION,
  transitionWithDelay,
};
export type { ChartEnterTransition };
