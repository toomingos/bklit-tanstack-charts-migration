// Shared enter-transition engine (framer Transition in, tween/spring out).
import type { Transition } from "motion/react";
import { estimateSpringSettleMs, sampleSpringProgress } from "./radar-spring";
import { REVEAL_DURATION_MS, REVEAL_EASE_CSS } from "./design-tokens";

const MS_PER_SECOND = 1000;
// Bounce-to-spring conversion bounds (verbatim bklit motion-utils formula below).
const MIN_SPRING_DAMPING = 8;
const BOUNCE_DAMPING_FACTOR = 0.25;
const MAX_SPRING_STIFFNESS = 400;
const MIN_SPRING_STIFFNESS = 80;
const BOUNCE_STIFFNESS_FACTOR = 0.35;
// Pre-sampled progress points for spring reveals (tweens reuse the 64 uniform samples).
const SPRING_REVEAL_SAMPLES = 40;

type EnterTransition = Transition;

type ResolvedTiming =
  | { readonly kind: "tween"; readonly durationMs: number; readonly easingCss: string }
  | { readonly kind: "spring"; readonly stiffness: number; readonly damping: number; readonly mass: number };

const TWEEN_FALLBACK: ResolvedTiming = {
  durationMs: REVEAL_DURATION_MS,
  easingCss: REVEAL_EASE_CSS,
  kind: "tween",
};

interface SpringConstants {
  readonly stiffness: number;
  readonly damping: number;
}

interface ClipReveal {
  readonly durationMs: number;
  readonly easingCss: string;
}

// Bklit motion-utils springOptionsFromTransition, verbatim formula.
const springFromBounce = (bounce: number, base: { readonly stiffness: number; readonly damping: number }): SpringConstants => (
  {
    damping: Math.max(MIN_SPRING_DAMPING, base.damping * (1 - bounce * BOUNCE_DAMPING_FACTOR)),
    stiffness: Math.min(MAX_SPRING_STIFFNESS, Math.max(MIN_SPRING_STIFFNESS, base.stiffness * (1 + bounce * BOUNCE_STIFFNESS_FACTOR))),
  }
);

// Clip-path width reveal must be a tween (springs can't animate SVG width reliably),
// So caller-supplied springs coerce to a tween of the same duration.
const clipRevealTiming = (transition: Readonly<EnterTransition> | undefined, fallbackDurationMs: number, fallbackEasingCss: string): ClipReveal => {
  if (!transition) {
    return { durationMs: fallbackDurationMs, easingCss: fallbackEasingCss };
  }
  const durationMs =
    transition.duration === undefined ? fallbackDurationMs : transition.duration * MS_PER_SECOND;
  const { ease } = transition;
  const easingCss =
    transition.type !== "spring" && Array.isArray(ease)
      ? `cubic-bezier(${ease.join(",")})`
      : fallbackEasingCss;
  return { durationMs, easingCss };
}

const SPRING_FALLBACK_DAMPING = 15;
const SPRING_FALLBACK_STIFFNESS = 100;
const SPRING_FALLBACK_MASS = 1;

const resolveSpringEnter = (transition: Readonly<EnterTransition>, fallback: Readonly<ResolvedTiming>): ResolvedTiming => {
  if (
    transition.stiffness !== undefined &&
    transition.damping !== undefined
  ) {
    return {
      damping: transition.damping,
      kind: "spring",
      mass: transition.mass ?? (fallback.kind === "spring" ? fallback.mass : SPRING_FALLBACK_MASS),
      stiffness: transition.stiffness,
    };
  }
  const base =
    fallback.kind === "spring"
      ? { damping: fallback.damping, stiffness: fallback.stiffness }
      : { damping: SPRING_FALLBACK_DAMPING, stiffness: SPRING_FALLBACK_STIFFNESS };
  const bounce = transition.bounce ?? 0;
  const { stiffness, damping } = springFromBounce(bounce, base);
  return {
    damping,
    kind: "spring",
    mass: transition.mass ?? (fallback.kind === "spring" ? fallback.mass : SPRING_FALLBACK_MASS),
    stiffness,
  };
}

const resolveTweenEnter = (transition: Readonly<EnterTransition>, fallback: Readonly<ResolvedTiming>): ResolvedTiming => {
  const durationMs =
    (transition.duration ??
      (fallback.kind === "tween" ? fallback.durationMs / MS_PER_SECOND : REVEAL_DURATION_MS / MS_PER_SECOND)) *
    MS_PER_SECOND;
  const fallbackEasingCss = fallback.kind === "tween" ? fallback.easingCss : REVEAL_EASE_CSS;
  const { ease } = transition;
  const easingCss = Array.isArray(ease) ? `cubic-bezier(${ease.join(",")})` : fallbackEasingCss;
  return { durationMs, easingCss, kind: "tween" };
}

// Mirrors bklit useMountProgress: absent transition falls back, explicit always wins.
const resolveEnterTransition = (transition: Readonly<EnterTransition> | undefined, fallback: Readonly<ResolvedTiming> = TWEEN_FALLBACK): ResolvedTiming => {
  if (!transition) {return fallback;}
  const type = transition.type ?? fallback.kind;
  if (type === "spring") {return resolveSpringEnter(transition, fallback);}
  return resolveTweenEnter(transition, fallback);
}

interface RevealTiming {
  readonly durationMs: number;
  readonly easing: string;
/** Pre-sampled 0->1 progress: springs sample the curve (WAAPI easing linear);
tweens use uniform samples under the bezier easing (path d-frames need >2 keyframes). */
  readonly sampledProgress: readonly number[];
}

// 64 uniform samples: chord-vs-arc deviation < 0.3px; mismatched pairs flip invisibly.
const TWEEN_SAMPLES = 64;
const UNIFORM_PROGRESS = Array.from(
  { length: TWEEN_SAMPLES },
  (_element, i) => i / (TWEEN_SAMPLES - 1),
);

const revealTiming = (resolved: Readonly<ResolvedTiming>): RevealTiming => {
  if (resolved.kind === "tween") {
    return {
      durationMs: resolved.durationMs,
      easing: resolved.easingCss,
      sampledProgress: UNIFORM_PROGRESS,
    };
  }
  const durationMs = estimateSpringSettleMs(resolved.stiffness, resolved.damping, resolved.mass);
  const sampledProgress = sampleSpringProgress({
    damping: resolved.damping,
    durationMs,
    mass: resolved.mass,
    samples: SPRING_REVEAL_SAMPLES,
    stiffness: resolved.stiffness,
  });
  return { durationMs, easing: "linear", sampledProgress };
}

const buildProgressKeyframes = (timing: Readonly<RevealTiming>, toKeyframe: (progress: number) => Keyframe): Keyframe[] => timing.sampledProgress.map(toKeyframe);


// Former per-family reveal shims collapsed here; gauge-reveal keeps its own reconciler.
type PieEnterTransition = Transition;
type RingEnterTransition = Transition;
type RadarEnterTransition = Transition;
type GaugeEnterTransition = Transition;
// Candlestick aliased too so the tween branch stays reachable.
type CandlestickEnterTransition = Transition;

const RING_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;
const RADAR_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;

export type {
  CandlestickEnterTransition,
  EnterTransition,
  GaugeEnterTransition,
  PieEnterTransition,
  RadarEnterTransition,
  ResolvedTiming,
  RevealTiming,
  RingEnterTransition,
};
export {
  buildProgressKeyframes,
  clipRevealTiming,
  RADAR_TWEEN_FALLBACK,
  resolveEnterTransition,
  revealTiming,
  RING_TWEEN_FALLBACK,
  springFromBounce,
  TWEEN_FALLBACK,
};
