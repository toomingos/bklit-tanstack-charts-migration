// Single enter-transition / reveal-timing engine shared by every migrated
// chart family (initiative 1 consolidation — plan
// research/phase-3/plans/01-internals/plan-loop-1.md D2). Generalizes the
// per-family `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes`
// clone sets that previously lived in pie/ring/funnel/gauge/radar-reveal.ts
// (structurally identical modulo family naming). Spring physics reuse
// `estimateSpringSettleMs`/`sampleSpringProgress` from `./radar-spring`
// (confirmed generic closed-form spring utilities); the reveal tween's
// duration + easing come from `./design-tokens`.
//
// bklit's own `useMountProgress` (use-mount-progress.ts) falls back to the
// single shared `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts) whenever a
// chart's `enterTransition` prop isn't supplied — a plain tween, 1100ms,
// cubic-bezier(0.85,0,.15,1). A caller MAY still pass an explicit
// `{type:"spring",...}` `enterTransition`, so `resolveEnterTransition` keeps
// the same spring/tween generality the per-family versions had. Families
// whose default fallback differs (e.g. Gauge's spring fallback) express that
// through the `fallback` argument — there is no per-family fork of these
// functions.
//
// Easing-mapping map (OQ parity 10 — one place): every easing value in the
// migrated charts ultimately reaches the renderer as a WAAPI
// `AnimationEffectTiming.easing` string via ONE of two channels:
//   1. Public bklit prop `animationEasing?: string` (LineChart/AreaChart) —
//      already a CSS easing string, passed verbatim into the reveal
//      `marks.animate(..., { easing })` calls (line-chart.tsx /
//      area-chart.tsx handleRender). No conversion.
//   2. This module's internal `EnterTransition` object (framer-style
//      `{ease:[..]} | {bounce|stiffness,damping}`) — resolved by
//      `resolveEnterTransition` into `ResolvedTiming.easingCss`
//      (`cubic-bezier(...)` for tweens, `"linear"` + pre-sampled progress
//      keyframes for springs), which callers feed straight to `.animate()`.
// Parts that currently accept-and-ignore easing stubs (bar/composed/
// scatter/…, P5.5 T-E3) forward their prop into channel 1's call sites once
// wired; P3.2's motion() default replacement must keep producing
// `ResolvedTiming.easingCss` strings so both channels stay WAAPI-native.
import { estimateSpringSettleMs, sampleSpringProgress } from "./radar-spring";
import { REVEAL_DURATION_MS, REVEAL_EASE_CSS } from "./design-tokens";

export interface EnterTransition {
  type?: "spring" | "tween";
  /** Tween duration, seconds. */
  duration?: number;
  /** Tween cubic-bezier control points (framer's `ease` array form). */
  ease?: readonly [number, number, number, number];
  /** Spring bounce shorthand (0..1-ish) — converted via `springFromBounce`
      below when `stiffness`/`damping` aren't both given directly. */
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type ResolvedTiming =
  | { kind: "tween"; durationMs: number; easingCss: string }
  | { kind: "spring"; stiffness: number; damping: number; mass: number };

/** Shared tween fallback: the 1100ms reveal tween + its cubic-bezier easing,
    from `./design-tokens`. */
export const TWEEN_FALLBACK: ResolvedTiming = {
  kind: "tween",
  durationMs: REVEAL_DURATION_MS,
  easingCss: REVEAL_EASE_CSS,
};

/**
 * bklit motion-utils.ts `springOptionsFromTransition`, verbatim formula:
 * `stiffness = clamp(base*(1+bounce*0.35), 80, 400)`,
 * `damping = max(8, base*(1-bounce*0.25))`.
 */
export function springFromBounce(
  bounce: number,
  base: { stiffness: number; damping: number },
): { stiffness: number; damping: number } {
  return {
    stiffness: Math.min(400, Math.max(80, base.stiffness * (1 + bounce * 0.35))),
    damping: Math.max(8, base.damping * (1 - bounce * 0.25)),
  };
}

/**
 * bklit `animation.ts:18` `clipRevealTransition`, ported.
 *
 * The cartesian clip-path width reveal must be a TWEEN — bklit's own comment:
 * "spring does not reliably animate SVG width" — so a caller-supplied SPRING is
 * COERCED to a tween of the same nominal duration here rather than sampled
 * through `revealTiming()`. That is why this is not just
 * `resolveEnterTransition()` with a different fallback.
 *
 * `fallback*` mirror the shell's substitution (`time-series-chart-shell.tsx:607-612`):
 * with no `enterTransition` at all the clip runs for the host's
 * `animationDuration` at its `animationEasing`. (bklit hardcodes the default
 * bezier there instead of forwarding `animationEasing`, but `animationEasing`
 * is read by nothing in bklit — it only ever lands in the stable context — so
 * routing it here is a strict superset that is byte-identical at the default.)
 */
export function clipRevealTiming(
  transition: EnterTransition | undefined,
  fallbackDurationMs: number,
  fallbackEasingCss: string,
): { durationMs: number; easingCss: string } {
  if (!transition) {
    return { durationMs: fallbackDurationMs, easingCss: fallbackEasingCss };
  }
  const durationMs =
    typeof transition.duration === "number" ? transition.duration * 1000 : fallbackDurationMs;
  // bklit's spring branch discards `ease` outright; only the tween branch honours it.
  const easingCss =
    transition.type !== "spring" && transition.ease
      ? `cubic-bezier(${transition.ease.join(",")})`
      : fallbackEasingCss;
  return { durationMs, easingCss };
}

/**
 * Resolves a caller-supplied `EnterTransition` against the tween fallback —
 * mirrors bklit's own `useMountProgress` dispatch (falls back to
 * `DEFAULT_CHART_ENTER_TRANSITION` only when `enterTransition` is entirely
 * absent; an explicit caller transition always wins outright).
 */
export function resolveEnterTransition(
  transition: EnterTransition | undefined,
  fallback: ResolvedTiming = TWEEN_FALLBACK,
): ResolvedTiming {
  if (!transition) return fallback;
  const type = transition.type ?? fallback.kind;
  if (type === "spring") {
    if (
      typeof transition.stiffness === "number" &&
      typeof transition.damping === "number"
    ) {
      return {
        kind: "spring",
        stiffness: transition.stiffness,
        damping: transition.damping,
        mass: transition.mass ?? (fallback.kind === "spring" ? fallback.mass : 1),
      };
    }
    const base =
      fallback.kind === "spring"
        ? { stiffness: fallback.stiffness, damping: fallback.damping }
        : { stiffness: 100, damping: 15 };
    const bounce = transition.bounce ?? 0;
    const { stiffness, damping } = springFromBounce(bounce, base);
    return {
      kind: "spring",
      stiffness,
      damping,
      mass: transition.mass ?? (fallback.kind === "spring" ? fallback.mass : 1),
    };
  }
  const durationMs =
    (transition.duration ??
      (fallback.kind === "tween" ? fallback.durationMs / 1000 : REVEAL_DURATION_MS / 1000)) *
    1000;
  const easingCss = transition.ease
    ? `cubic-bezier(${transition.ease.join(",")})`
    : fallback.kind === "tween"
      ? fallback.easingCss
      : REVEAL_EASE_CSS;
  return { kind: "tween", durationMs, easingCss };
}

export interface RevealTiming {
  durationMs: number;
  easing: string;
  /** ALWAYS non-null — pre-sampled 0->1 progress values fed to the
      per-progress keyframe builder. Spring: the sampled spring curve itself,
      with `easing: "linear"` (WAAPI can't integrate spring physics
      natively). Tween: UNIFORM linear samples with the tween's own
      cubic-bezier as the animation-level easing — WAAPI timing-level
      `easing` transforms the WHOLE iteration progress before it's mapped
      across the (uniform) keyframe offsets (verified empirically in
      Chromium: 5 uniform opacity keyframes + bezier easing sample to the
      exact bezier curve), so the rendered keyframe at time `t` is
      `toKeyframe(eased(t))` at sample resolution — exactly bklit's own
      per-frame `arc(eased(progress))` useTransform evaluation.
      A plain 2-keyframe `[toKeyframe(0), toKeyframe(1)]` tween is NOT
      usable for `d`/path keyframes: CSS `d` interpolation is DISCRETE
      between `none` and a path, and between paths with mismatched command
      structure (verified empirically: a `[d:none -> d:path()]` 2-keyframe
      animation flips at eased-50% with no sweep at all — docs/LOG.md D51).
      Uniform sampling keeps transform keyframes exact too (scale is linear
      in progress, so piecewise-linear sampling introduces zero error). */
  sampledProgress: number[];
}

// 64 uniform samples across the sweep: adjacent same-structure path
// keyframes interpolate linearly (chord-vs-arc deviation < 0.3px at pie/ring
// radii for <=2pi/63 per interval); the rare structure-mismatched pairs near
// zero angle (d3-arc's merged-corner branch, or the `d:"none"` suppression
// below the 0.01rad threshold) flip discretely across a sub-pixel sliver —
// invisible.
const TWEEN_SAMPLES = 64;
const UNIFORM_PROGRESS = Array.from(
  { length: TWEEN_SAMPLES },
  (_, i) => i / (TWEEN_SAMPLES - 1),
);

export function revealTiming(resolved: ResolvedTiming): RevealTiming {
  if (resolved.kind === "tween") {
    return {
      durationMs: resolved.durationMs,
      easing: resolved.easingCss,
      sampledProgress: UNIFORM_PROGRESS,
    };
  }
  const durationMs = estimateSpringSettleMs(resolved.stiffness, resolved.damping, resolved.mass);
  const sampledProgress = sampleSpringProgress(
    resolved.stiffness,
    resolved.damping,
    resolved.mass,
    durationMs,
    40,
  );
  return { durationMs, easing: "linear", sampledProgress };
}

/** Builds the `progress -> Keyframe` array for one `.animate()` call from a
    resolved timing + a per-progress keyframe builder. */
export function buildProgressKeyframes(
  timing: RevealTiming,
  toKeyframe: (progress: number) => Keyframe,
): Keyframe[] {
  return timing.sampledProgress.map(toKeyframe);
}

// --- Family aliases (T-C3 reveal-shim collapse) -----------------------------
// The former {pie,ring,funnel,radar,gauge}-reveal.ts shim modules were pure
// re-export aliases of this engine (initiative-1 consolidation already moved
// every implementation here in Phase 3); hosts now import these names
// directly. Public barrel names are unchanged (centralize.md OQ 4).
// radar keeps aliased import NAMES (buildRadarProgressKeyframes etc.) at its
// call sites; gauge-reveal remains as the module holding gauge's unique
// key-diffing reconciler (reconcileGaugeReveal) + GAUGE_SPRING_FALLBACK.
export type PieEnterTransition = EnterTransition;
export type RingEnterTransition = EnterTransition;
export type FunnelEnterTransition = EnterTransition;
export type RadarEnterTransition = EnterTransition;
export type GaugeEnterTransition = EnterTransition;
/** P5.5 K4 — candlestick was the last part still declaring its OWN
    enter-transition type (a spring-only `{ duration?, bounce? }`), which
    structurally could not express the tween bklit's `Transition` always
    allowed there (`repos/bklit-ui/.../candlestick-chart.tsx:54,84`). Aliased
    here like the other five so the tween branch is reachable. */
export type CandlestickEnterTransition = EnterTransition;
export type GaugeRevealTiming = RevealTiming;

export const PIE_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;
export const RING_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;
export const FUNNEL_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;
export const RADAR_TWEEN_FALLBACK: ResolvedTiming = TWEEN_FALLBACK;
