// Reveal-timing helpers for RingChart's two-phase per-ring enter animation
// (expand track scale-pop, then progress angular sweep). Self-contained
// duplicate of internal/pie-reveal.ts's generic `resolveEnterTransition`/
// `revealTiming`/`buildProgressKeyframes` machinery (ring and pie are
// independent chart families — docs/LOG.md D43 precedent is per-family
// internal modules, not cross-family coupling), REUSING (importing, not
// duplicating) `estimateSpringSettleMs`/`sampleSpringProgress` from
// `./radar-spring`, the confirmed generic closed-form spring utilities.
//
// bklit's own `useMountProgress` (use-mount-progress.ts) falls back to the
// single shared `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts) whenever a
// `RingChart` `enterTransition` prop isn't supplied — a plain tween, 1100ms,
// cubic-bezier(0.85,0,0.15,1) — identical fallback to pie's. A caller may
// still pass an explicit `{type:"spring",...}` `enterTransition` (ring.tsx
// passes it straight through from `useRingStable().enterTransition`, same
// as pie), so `resolveEnterTransition` keeps the same spring/tween
// generality as pie-reveal.ts's version.
import { estimateSpringSettleMs, sampleSpringProgress } from "./radar-spring";

export const RING_TWEEN_DURATION_MS = 1100;
export const RING_TWEEN_EASE_CSS = "cubic-bezier(0.85, 0, 0.15, 1)";

export interface RingEnterTransition {
  type?: "spring" | "tween";
  /** Tween duration, seconds. */
  duration?: number;
  /** Tween cubic-bezier control points (framer's `ease` array form). */
  ease?: readonly [number, number, number, number];
  /** Spring bounce shorthand (0..1-ish) — converted via
      `springOptionsFromTransition`'s formula when `stiffness`/`damping`
      aren't both given directly. */
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type RingResolvedTiming =
  | { kind: "tween"; durationMs: number; easingCss: string }
  | { kind: "spring"; stiffness: number; damping: number; mass: number };

export const RING_TWEEN_FALLBACK: RingResolvedTiming = {
  kind: "tween",
  durationMs: RING_TWEEN_DURATION_MS,
  easingCss: RING_TWEEN_EASE_CSS,
};

/**
 * bklit motion-utils.ts `springOptionsFromTransition`, verbatim formula —
 * duplicated here (also duplicated in pie-reveal.ts/radar-reveal.ts) to keep
 * this module self-contained per the per-family precedent above.
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
 * Resolves a caller-supplied `RingEnterTransition` against the tween
 * fallback — mirrors bklit's own `useMountProgress` dispatch (falls back to
 * `DEFAULT_CHART_ENTER_TRANSITION` only when `enterTransition` is entirely
 * absent; an explicit caller transition always wins outright).
 */
export function resolveEnterTransition(
  transition: RingEnterTransition | undefined,
  fallback: RingResolvedTiming = RING_TWEEN_FALLBACK,
): RingResolvedTiming {
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
      : RING_TWEEN_EASE_CSS;
  return { kind: "tween", durationMs, easingCss };
}

export interface RingRevealTiming {
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
      animation flips at eased-50% with no sweep at all — the bug this
      sampling fixes, docs/LOG.md D51). Uniform sampling keeps transform
      keyframes exact too (scale is linear in progress, so piecewise-linear
      sampling introduces zero error). */
  sampledProgress: number[];
}

// 64 uniform samples across the sweep: adjacent same-structure path
// keyframes interpolate linearly (chord-vs-arc deviation < 0.3px at ring
// radii for <=2pi/63 per interval); the rare structure-mismatched pairs near
// zero angle (d3-arc's merged-corner branch, or the `d:"none"` suppression
// below bklit's own 0.01rad threshold) flip discretely across a sub-pixel
// sliver — invisible.
const TWEEN_SAMPLES = 64;
const UNIFORM_PROGRESS = Array.from(
  { length: TWEEN_SAMPLES },
  (_, i) => i / (TWEEN_SAMPLES - 1),
);

export function revealTiming(resolved: RingResolvedTiming): RingRevealTiming {
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
  timing: RingRevealTiming,
  toKeyframe: (progress: number) => Keyframe,
): Keyframe[] {
  return timing.sampledProgress.map(toKeyframe);
}
