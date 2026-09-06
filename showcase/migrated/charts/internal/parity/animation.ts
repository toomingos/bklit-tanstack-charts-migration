import { useEffect } from "react";
import type { RefObject } from "react";
import type { Transition } from "motion/react";
import type { ChartMotionContext, ChartMotionTransition } from "@tanstack/charts";

// Local mirror of the marker style shape in series-config-types.ts.
// Structural copy keeps this leaf free of upward imports.
interface SeriesPointMarkerStyle {
  readonly fill?: string;
  stroke?: string;
  strokeWidth?: number;
  readonly ringGap?: number;
  readonly outlineWidth?: number;
  readonly outlineColor?: string;
  readonly radius?: number;
  readonly fadeOnHover?: boolean;
  readonly inactiveOpacity?: number;
  readonly inactiveBlur?: number;
  readonly enterBlur?: number;
  readonly showActiveHighlight?: boolean;
}

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

// Parity home for the retired enter engine, mapping legacy Transitions.
const TWEEN_FALLBACK_EASING_CSS = `cubic-bezier(${[ENTER_EASE_0, ENTER_EASE_1, ENTER_EASE_2, ENTER_EASE_3].join(",")})`;

// Bounce-to-spring conversion bounds (verbatim bklit motion-utils formula below).
const MIN_SPRING_DAMPING = 8;
const BOUNCE_DAMPING_FACTOR = 0.25;
const MAX_SPRING_STIFFNESS = 400;
const MIN_SPRING_STIFFNESS = 80;
const BOUNCE_STIFFNESS_FACTOR = 0.35;

type EnterTransition = Transition;

type ResolvedTiming =
  | { readonly kind: "tween"; readonly durationMs: number; readonly easingCss: string }
  | { readonly kind: "spring"; readonly stiffness: number; readonly damping: number; readonly mass: number };

const TWEEN_FALLBACK: ResolvedTiming = {
  durationMs: DEFAULT_ANIMATION_DURATION_MS,
  easingCss: TWEEN_FALLBACK_EASING_CSS,
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

// Clip-path width reveal must be a tween (springs can't animate SVG width).
// Caller-supplied springs coerce to a tween of the same duration instead.
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
      (fallback.kind === "tween" ? fallback.durationMs / MS_PER_SECOND : DEFAULT_ANIMATION_DURATION_MS / MS_PER_SECOND)) *
    MS_PER_SECOND;
  const fallbackEasingCss = fallback.kind === "tween" ? fallback.easingCss : TWEEN_FALLBACK_EASING_CSS;
  const { ease } = transition;
  const easingCss = Array.isArray(ease) ? `cubic-bezier(${ease.join(",")})` : fallbackEasingCss;
  return { durationMs, easingCss, kind: "tween" };
}

// Mirrors bklit useMountProgress: absent transition falls back, explicit wins.
const resolveEnterTransition = (transition: Readonly<EnterTransition> | undefined, fallback: Readonly<ResolvedTiming> = TWEEN_FALLBACK): ResolvedTiming => {
  if (!transition) {return fallback;}
  const type = transition.type ?? fallback.kind;
  if (type === "spring") {return resolveSpringEnter(transition, fallback);}
  return resolveTweenEnter(transition, fallback);
}

interface RevealTiming {
  readonly durationMs: number;
  readonly easing: string;
  readonly sampledProgress: readonly number[];
}

// Uniform samples: chord-vs-arc deviation stays under 0.3px on path frames.
const TWEEN_SAMPLES = 64;
const UNIFORM_PROGRESS = Array.from(
  { length: TWEEN_SAMPLES },
  (_element, index) => index / (TWEEN_SAMPLES - 1),
);

// Compat timing for the radar re-export (springs coerce, no sampler here).
const revealTiming = (resolved: Readonly<ResolvedTiming>): RevealTiming => {
  if (resolved.kind === "tween") {
    return {
      durationMs: resolved.durationMs,
      easing: resolved.easingCss,
      sampledProgress: UNIFORM_PROGRESS,
    };
  }
  return { durationMs: TWEEN_FALLBACK.durationMs, easing: "linear", sampledProgress: UNIFORM_PROGRESS };
}

const buildProgressKeyframes = (timing: Readonly<RevealTiming>, toKeyframe: (progress: number) => Keyframe): Keyframe[] => timing.sampledProgress.map(toKeyframe);


// Former per-family reveal shims collapsed here; gauge keeps its reconciler.
type PieEnterTransition = Transition;
type RingEnterTransition = Transition;
type RadarEnterTransition = Transition;
type GaugeEnterTransition = Transition;
// Candlestick aliased too so the tween branch stays reachable.
type CandlestickEnterTransition = Transition;

const RING_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;
const RADAR_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;

// Cubic Bernstein basis coefficient for the easing solver below.
const CUBIC_BERNSTEIN_COEFFICIENT = 3;
// Middle coefficient of the cubic bezier derivative (verbatim easing math).
const CUBIC_DERIVATIVE_MIDDLE_COEFFICIENT = 6;
// Newton-solve iteration cap and convergence tolerance for bezier easing.
const NEWTON_MAX_ITERATIONS = 6;
const NEWTON_CONVERGENCE_TOLERANCE = 1e-5;
// Reveal-ease fallback control points (the TWEEN_FALLBACK easing above).
const FALLBACK_EASE_X1 = 0.85;
const FALLBACK_EASE_X2 = 0.15;

const CUBIC_BEZIER_RE = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/iu;

interface CubicBezierControlPoints {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const parseBezierControlPoints = (css: string): CubicBezierControlPoints => {
  const match = CUBIC_BEZIER_RE.exec(css.trim());
  // Numbered groups, not named: named captures are ES2018 and this project targets ES2017.
  if (!match) {
    // TWEEN_FALLBACK_EASING_CSS control points above.
    return { x1: FALLBACK_EASE_X1, x2: FALLBACK_EASE_X2, y1: 0, y2: 1 };
  }
  return { x1: Number(match[1]), x2: Number(match[3]), y1: Number(match[2]), y2: Number(match[4]) };
}

const cubicBernstein = (bezierT: number, weight1: number, weight2: number): number => CUBIC_BERNSTEIN_COEFFICIENT * bezierT * (1 - bezierT) * (1 - bezierT) * weight1 + CUBIC_BERNSTEIN_COEFFICIENT * bezierT * bezierT * (1 - bezierT) * weight2 + bezierT * bezierT * bezierT;

const solveBezierT = (progress: number, x1: number, x2: number): number => {
  let solverT = progress;
  for (let newtonIter = 0; newtonIter < NEWTON_MAX_ITERATIONS; newtonIter += 1) {
    const err = cubicBernstein(solverT, x1, x2) - progress;
    const dx = CUBIC_BERNSTEIN_COEFFICIENT * (1 - solverT) * (1 - solverT) * x1 + CUBIC_DERIVATIVE_MIDDLE_COEFFICIENT * solverT * (1 - solverT) * (x2 - x1) + CUBIC_BERNSTEIN_COEFFICIENT * solverT * solverT * (1 - x2);
    if (Math.abs(err) < NEWTON_CONVERGENCE_TOLERANCE || dx === 0) {break;}
    solverT -= err / dx;
  }
  return solverT;
}

// Easing adapter: mark motion takes a progress fn, not a CSS string.
const motionEasingFromCss = (css: string): ((progress: number) => number) => {
  const { x1, y1, x2, y2 } = parseBezierControlPoints(css);
  return (progress: number) => {
    if (progress <= 0) {return 0;}
    if (progress >= 1) {return 1;}
    return cubicBernstein(solveBezierT(progress, x1, x2), y1, y2);
  };
}

// Maps a legacy framer Transition onto the renderer transition it selects
// (cubic-bezier arrays solve above, springs carry over 1:1).
const enterTransitionToMotion = (transition: Readonly<EnterTransition> | undefined): ChartMotionTransition => {
  const resolved = resolveEnterTransition(transition);
  if (resolved.kind === "spring") {
    return { damping: resolved.damping, mass: resolved.mass, stiffness: resolved.stiffness, type: "spring" };
  }
  return { duration: resolved.durationMs, easing: motionEasingFromCss(resolved.easingCss), type: "tween" };
}

// Parity home for the retired animated-domains hook (snaps to destination).
type YDomain = [number, number];

type ChartPhase =
  | "loading"
  | "exiting"
  | "gridTweenReady"
  | "revealing"
  | "ready"
  | "exitingReady"
  | "gridTweenLoading"
  | "revealingLoading";

const SKELETON_PHASES: ReadonlySet<ChartPhase> = new Set<ChartPhase>(["loading", "exiting", "gridTweenLoading"]);

const resolveAnimatedYDestinationDomains = (chartPhase: ChartPhase, skeletonByAxis: Record<string, YDomain>, targetByAxis: Record<string, YDomain>): Record<string, YDomain> => {
  if (SKELETON_PHASES.has(chartPhase)) {
    return skeletonByAxis;
  }
  return targetByAxis;
}

interface UseAnimatedYDomainsOptions {
  readonly enabled: boolean;
  readonly durationMs: number;
  readonly chartPhase: ChartPhase;
  readonly skeletonByAxis: Record<string, YDomain>;
  readonly targetByAxis: Record<string, YDomain>;
  readonly onSettled?: () => void;
  readonly tweenOnTargetChange?: boolean;
}

const useAnimatedYDomains = (options: Readonly<UseAnimatedYDomainsOptions>): Record<string, YDomain> => {
  const destination = resolveAnimatedYDestinationDomains(options.chartPhase, options.skeletonByAxis, options.targetByAxis);
  useEffect(() => {
    options.onSettled?.();
  }, [destination, options]);
  return destination;
}

// Parity home for the retired marker-reveal contract (stagger is motion).
const DEFAULT_MARKER_RADIUS_PX = 5;

interface MarkerRevealSeriesConfig {
  readonly dataKey: string;
  readonly markers: Readonly<SeriesPointMarkerStyle> | undefined;
  readonly showMarkers: boolean | undefined;
  readonly stroke: string;
}

const hasVisibleMarkerSeries = (series: readonly Readonly<MarkerRevealSeriesConfig>[]): boolean =>
  series.some((entry) => entry.showMarkers ?? false);

interface SeriesMarkerRevealParams {
  readonly animationEasing: string;
  readonly durationSec: number;
  readonly innerWidth: number;
  readonly marksGroup: SVGGElement;
  readonly markerSeriesConfigs: readonly Readonly<MarkerRevealSeriesConfig>[];
}

// Neutralized WAAPI scheduler (package motion owns the entrance).
const collectMarkerRevealAnimations = (_params: Readonly<SeriesMarkerRevealParams>): Animation[] => [];

const cancelPendingMarkerReveal = (_animationsRef: RefObject<Animation[]>, _cancelRef: RefObject<(() => void) | null>): void => {
  void _animationsRef;
  void _cancelRef;
}

const scheduleMarkerReveal = (_doReveal: () => void, _cancelRef: RefObject<(() => void) | null>): void => {
  void _doReveal;
  void _cancelRef;
}

// Package-motion marker stagger: the index fraction of the enter span.
const markerEnterDelay = (
  context: Readonly<Pick<ChartMotionContext, "datumCount" | "datumIndex">>,
  spanMs: number,
): number => {
  if (spanMs <= 0 || context.datumCount <= 1) {return 0;}
  return (spanMs * context.datumIndex) / (context.datumCount - 1);
};

export {
  buildProgressKeyframes,
  cancelPendingMarkerReveal,
  clipRevealTiming,
  clipRevealTransition,
  collectMarkerRevealAnimations,
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_CHART_ENTER_TRANSITION,
  DEFAULT_MARKER_RADIUS_PX,
  enterTransitionToMotion,
  hasVisibleMarkerSeries,
  markerEnterDelay,
  motionEasingFromCss,
  RADAR_TWEEN_FALLBACK,
  resolveEnterTransition,
  revealTiming,
  RING_TWEEN_FALLBACK,
  scheduleMarkerReveal,
  springFromBounce,
  transitionWithDelay,
  TWEEN_FALLBACK,
  useAnimatedYDomains,
};
export type {
  CandlestickEnterTransition,
  ChartEnterTransition,
  ClipReveal,
  EnterTransition,
  GaugeEnterTransition,
  MarkerRevealSeriesConfig,
  PieEnterTransition,
  RadarEnterTransition,
  ResolvedTiming,
  RevealTiming,
  RingEnterTransition,
  UseAnimatedYDomainsOptions,
};
