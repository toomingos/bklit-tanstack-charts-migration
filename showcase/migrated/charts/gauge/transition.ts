import { REVEAL_CSS_EASE } from "../kit/motion/easing";
import { toCssEase } from "../kit/motion/enter-transition";
import type { EnterTransition } from "../kit/motion/phase";
import { REST_GRANULAR, springCurve } from "../kit/motion/spring-curve";
import { GAUGE_NOTCH_ENTER_SPRING } from "../kit/motion/springs";

/** Structural twin of bklit's gauge enter transition (motion-library shape, seconds). */
export type GaugeEnterTransition = EnterTransition;

/** A notch's enter as a CSS animation timing: bklit scales and fades each notch 0 -> 1 about its own centre. */
export interface NotchEnter {
  readonly durationMs: number;
  readonly easing: string;
}

// bklit springs a notch's scale and opacity 0 -> 1 (motion's granular rest thresholds for a unit span).
const SETTLE_STEP_MS = 8;
const NOTCH_SAMPLES = 36;
const SETTLE_LIMIT_MS = 4000;
const DEFAULT_TWEEN_S = 0.3;
const SECONDS_TO_MS = 1000;
// motion's default tween ease (easeOut) and its named eases.
const EASE_OUT = "cubic-bezier(0,0,0.58,1)";
const EASES: ReadonlyMap<unknown, string> = new Map<unknown, string>([
  ["circIn", "cubic-bezier(0.55,0,1,0.45)"], ["circInOut", REVEAL_CSS_EASE], ["circOut", "cubic-bezier(0,0.55,0.45,1)"],
  ["easeIn", "cubic-bezier(0.42,0,1,1)"], ["easeInOut", "cubic-bezier(0.42,0,0.58,1)"], ["easeOut", EASE_OUT], ["linear", "linear"],
]);

const springEnter = (stiffness: number, damping: number, mass: number): NotchEnter => {
  const { durationMs, ease } = springCurve({ damping, mass, stiffness }, { decimals: 3, limitMs: SETTLE_LIMIT_MS, rest: REST_GRANULAR, samples: NOTCH_SAMPLES, stepMs: SETTLE_STEP_MS });
  return { durationMs, easing: ease };
};

const DEFAULT_NOTCH_ENTER: NotchEnter = springEnter(GAUGE_NOTCH_ENTER_SPRING.stiffness, GAUGE_NOTCH_ENTER_SPRING.damping, GAUGE_NOTCH_ENTER_SPRING.mass);

export const toNotchEnter = (t?: GaugeEnterTransition): NotchEnter => {
  if (!t) { return DEFAULT_NOTCH_ENTER; }
  if (t.type === "tween" || (t.type === undefined && t.duration !== undefined)) {
    const named = EASES.get(t.ease);
    return { durationMs: (t.duration ?? DEFAULT_TWEEN_S) * SECONDS_TO_MS, easing: toCssEase(t.ease, named ?? EASE_OUT) };
  }
  return springEnter(t.stiffness ?? GAUGE_NOTCH_ENTER_SPRING.stiffness, t.damping ?? GAUGE_NOTCH_ENTER_SPRING.damping, t.mass ?? GAUGE_NOTCH_ENTER_SPRING.mass);
};
