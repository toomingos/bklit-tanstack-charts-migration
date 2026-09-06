// Per-notch pop-in via native keyed diff; per-datum enter animates opacity only,
// So legacy's scale(0)->scale(1) half is dropped. Timing resolution: ./parity/animation.
import type { ChartMotionTransition } from "@tanstack/charts";
import type { EnterTransition, ResolvedTiming } from "./parity/animation";
import { motionEasingFromCss } from "./hover-motion";

type GaugeEnterTransition = EnterTransition;
type GaugeResolvedTiming = ResolvedTiming;

// Gauge's default fallback is a spring, unlike every other family's tween.
const GAUGE_SPRING_FALLBACK: GaugeResolvedTiming = {
  damping: 20,
  kind: "spring",
  mass: 1,
  stiffness: 300,
};

const gaugeMotionTransition = (resolved: GaugeResolvedTiming): ChartMotionTransition => resolved.kind === "spring"
    ? { damping: resolved.damping, mass: resolved.mass, stiffness: resolved.stiffness, type: "spring" }
    : { duration: resolved.durationMs, easing: motionEasingFromCss(resolved.easingCss), type: "tween" };

export type { GaugeEnterTransition, GaugeResolvedTiming };
export { GAUGE_SPRING_FALLBACK, gaugeMotionTransition };

