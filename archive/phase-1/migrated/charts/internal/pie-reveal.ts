// Reveal-timing helpers for PieChart's per-slice angular-sweep enter
// animation. Self-contained duplicate of radar-reveal.ts's generic
// `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes` machinery
// (pie and radar are independent chart families — docs/LOG.md D43 precedent
// is per-family internal modules, not cross-family coupling), but REUSING
// (importing, not duplicating) `estimateSpringSettleMs`/`sampleSpringProgress`
// from `./radar-spring`, which are confirmed generic closed-form spring
// utilities with no radar-specific logic.
//
// Unlike radar (whose grid/axis/area sub-components each fall back to a
// DIFFERENT transition kind — tween for the area path, spring for the grid
// rings), pie has exactly ONE reveal fallback kind: bklit's own
// `useMountProgress` (use-mount-progress.ts) falls back to the single shared
// `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts) whenever a `PieChart`
// `enterTransition` prop isn't supplied — a plain tween, 1100ms,
// cubic-bezier(0.85,0,0.15,1). A caller MAY still pass an explicit
// `{type:"spring",...}` `enterTransition`, though, so `resolveEnterTransition`
// keeps the same spring/tween generality as radar's version.
import { estimateSpringSettleMs, sampleSpringProgress } from "./radar-spring";

export const PIE_TWEEN_DURATION_MS = 1100;
export const PIE_TWEEN_EASE_CSS = "cubic-bezier(0.85, 0, 0.15, 1)";

export interface PieEnterTransition {
  type?: "spring" | "tween";
  /** Tween duration, seconds. */
  duration?: number;
  /** Tween cubic-bezier control points (framer's `ease` array form). */
  ease?: readonly [number, number, number, number];
  /** Spring bounce shorthand (0..1-ish) — converted via the
      `springOptionsFromTransition` formula below when `stiffness`/`damping`
      aren't both given directly. */
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type PieResolvedTiming =
  | { kind: "tween"; durationMs: number; easingCss: string }
  | { kind: "spring"; stiffness: number; damping: number; mass: number };

export const PIE_TWEEN_FALLBACK: PieResolvedTiming = {
  kind: "tween",
  durationMs: PIE_TWEEN_DURATION_MS,
  easingCss: PIE_TWEEN_EASE_CSS,
};

/**
 * bklit motion-utils.ts `springOptionsFromTransition`, verbatim formula:
 * `stiffness = clamp(base*(1+bounce*0.35), 80, 400)`,
 * `damping = max(8, base*(1-bounce*0.25))` — same formula radar-reveal.ts
 * ports, duplicated here to keep this module self-contained.
 */
function springFromBounce(
  bounce: number,
  base: { stiffness: number; damping: number },
): { stiffness: number; damping: number } {
  return {
    stiffness: Math.min(400, Math.max(80, base.stiffness * (1 + bounce * 0.35))),
    damping: Math.max(8, base.damping * (1 - bounce * 0.25)),
  };
}

/**
 * Resolves a caller-supplied `PieEnterTransition` against the tween
 * fallback — mirrors bklit's own `useMountProgress` dispatch (falls back to
 * `DEFAULT_CHART_ENTER_TRANSITION` only when `enterTransition` is entirely
 * absent; an explicit caller transition always wins outright).
 */
export function resolveEnterTransition(
  transition: PieEnterTransition | undefined,
  fallback: PieResolvedTiming = PIE_TWEEN_FALLBACK,
): PieResolvedTiming {
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
      (fallback.kind === "tween" ? fallback.durationMs / 1000 : 1.1)) * 1000;
  const easingCss = transition.ease
    ? `cubic-bezier(${transition.ease.join(",")})`
    : fallback.kind === "tween"
      ? fallback.easingCss
      : PIE_TWEEN_EASE_CSS;
  return { kind: "tween", durationMs, easingCss };
}

export interface PieRevealTiming {
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
      animation flips at eased-50% with no sweep at all — PieSlice's
      original reveal had exactly this latent bug, found during the Ring
      review; docs/LOG.md D51). Uniform sampling keeps transform keyframes
      exact too (scale is linear in progress, so piecewise-linear sampling
      introduces zero error). */
  sampledProgress: number[];
}

// 64 uniform samples across the sweep: adjacent same-structure path
// keyframes interpolate linearly (chord-vs-arc deviation < 0.3px at pie
// radii for <=2pi/63 per interval); the rare structure-mismatched pairs near
// zero angle (d3-arc's merged-corner branch, or the `d:"none"` suppression
// below the 0.01rad threshold) flip discretely across a sub-pixel sliver —
// invisible.
const TWEEN_SAMPLES = 64;
const UNIFORM_PROGRESS = Array.from(
  { length: TWEEN_SAMPLES },
  (_, i) => i / (TWEEN_SAMPLES - 1),
);

export function revealTiming(resolved: PieResolvedTiming): PieRevealTiming {
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
  timing: PieRevealTiming,
  toKeyframe: (progress: number) => Keyframe,
): Keyframe[] {
  return timing.sampledProgress.map(toKeyframe);
}
