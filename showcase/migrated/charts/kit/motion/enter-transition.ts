// The one bklit enter-transition (motion-library shape, durations in seconds) -> native tween / CSS easing conversion.
import type { ChartMotionTransition } from "@tanstack/charts";
import { isFunction, isString } from "../guards";
import { REVEAL_CSS_EASE, REVEAL_EASING, cubicBezier } from "./easing";
import type { EnterTransition } from "./phase";

export interface EnterSpring {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

export const DEFAULT_ENTER_SPRING: EnterSpring = { damping: 15, mass: 1, stiffness: 100 };
export const DEFAULT_ENTER_MS = 1100;

interface MotionTransitionOptions {
  /** Spring values for a `type: "spring"` transition that leaves some unset. */
  readonly spring?: EnterSpring;
  readonly durationMs?: number;
  /** Pass CSS keyword eases ("ease-in", ...) through to the tween instead of the reveal curve. */
  readonly keywordEases?: boolean;
}

type KeywordEase = Extract<Extract<ChartMotionTransition, { type: "tween" }>["easing"], string>;

const KEYWORD_EASES: ReadonlySet<string> = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out"]);

const isKeywordEase = (ease: unknown): ease is KeywordEase => isString(ease) && KEYWORD_EASES.has(ease);

const isEaseFn = (ease: EnterTransition["ease"]): ease is (progress: number) => number => isFunction(ease);

const isBezier = (ease: EnterTransition["ease"]): ease is readonly [number, number, number, number] => Array.isArray(ease) && ease.length === 4;

/** The tween easing function of an enter `ease` (a 4-number bezier or an easing function; anything else is the reveal curve). */
export const toEaseFn = (ease: EnterTransition["ease"]): ((t: number) => number) => {
  if (isEaseFn(ease)) {
    return ease;
  }
  return isBezier(ease) ? cubicBezier(...ease) : REVEAL_EASING;
};

/** The CSS easing of an enter `ease` (a 4-number bezier; anything else is `fallback`). */
export const toCssEase = (ease: EnterTransition["ease"], fallback: string = REVEAL_CSS_EASE): string =>
  isBezier(ease) ? `cubic-bezier(${ease.join(",")})` : fallback;

export const toMotionTransition = (transition: Readonly<EnterTransition> | undefined, options: Readonly<MotionTransitionOptions> = {}): ChartMotionTransition => {
  const { spring = DEFAULT_ENTER_SPRING, durationMs = DEFAULT_ENTER_MS, keywordEases = false } = options;
  if (transition?.type === "spring") {
    return { damping: transition.damping ?? spring.damping, mass: transition.mass ?? spring.mass, stiffness: transition.stiffness ?? spring.stiffness, type: "spring" };
  }
  const duration = transition?.duration === undefined ? durationMs : transition.duration * 1000;
  const ease = transition?.ease;
  if (keywordEases && isKeywordEase(ease)) {
    return { duration, easing: ease, type: "tween" };
  }
  return { duration, easing: toEaseFn(ease), type: "tween" };
};
