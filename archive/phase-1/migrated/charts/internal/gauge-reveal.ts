// Reveal/update WAAPI engine for GaugeChart's notch pop-in — self-contained
// duplicate of internal/ring-reveal.ts's generic `resolveEnterTransition`/
// `revealTiming`/`buildProgressKeyframes` machinery (per-family internal
// modules, docs/LOG.md D43 precedent — NOT imported from ring-reveal.ts, per
// this deliverable's own instruction), REUSING (importing, not duplicating)
// `estimateSpringSettleMs`/`sampleSpringProgress` from `./radar-spring`, the
// confirmed generic closed-form spring utilities every other chart family's
// reveal module already shares this way.
//
// --- Why there is no separate "mount reveal" vs. "update idiom" here ------
// Every other migrated chart family (radar/candlestick) needs an explicit
// epoch-scoped "replay the WHOLE reveal once per structural change" protocol
// because framer's `initial` prop only fires on a component's OWN first
// mount, and bklit's REST of those charts key elements by array position
// (a shrink/grow of `data` reassigns positions, not stable identities).
// Gauge (repos/bklit-ui/packages/ui/src/charts/gauge.tsx `GaugeNotchSvg`,
// lines 149-218) is different: each notch's React key IS its own permanent
// numeric identity (`bg-${index}` / `active-${index}`, `index` being that
// notch's fixed position along the track, never reassigned across renders
// for a fixed `totalNotches`), and geometry changes (`d` attribute,
// `transformOrigin`) are plain unanimated prop writes with no `initial`/
// `animate`/`transition` at all. Framer therefore ONLY ever plays a notch's
// `initial->animate` entrance the instant that notch's specific key is
// FIRST created — true at genuine component mount (every key is new) AND
// equally true later when `totalNotches` grows (new high-index `bg-i` keys
// appear) or `value` increases (new `active-i` keys appear, D28's "NEW"
// update idiom) — and never replays it for a key that was already mounted,
// no matter what other geometry inputs change around it. A key that
// disappears (`totalNotches` shrinks, or `value` decreases so a notch's
// `active-i` entry drops out of the `.filter(isActive)` array) unmounts
// instantly with no exit transition (bklit uses no `AnimatePresence`).
//
// This means ONE generic "diff the currently-rendered key set against what
// was already revealed; animate only brand-new keys; forget removed keys so
// a later re-appearance replays fresh" reconciler correctly reproduces BOTH
// bklit's initial two-wave mount reveal AND its value-increase pop-in/
// value-decrease vanish idiom, with no special-casing between them — mount
// is simply the case where every key is new. `reconcileGaugeReveal` below
// is that reconciler; callers (gauge.tsx's arc `handleRender` and the linear
// plain-SVG effect) invoke it once per render with the full current set of
// `{key, element, delayMs}` targets for the bg wave and, separately, the
// active wave (delay formulas differ, see each call site).
import { estimateSpringSettleMs, sampleSpringProgress } from "./radar-spring";

export interface GaugeEnterTransition {
  type?: "spring" | "tween";
  /** Tween duration, seconds. */
  duration?: number;
  /** Tween cubic-bezier control points (framer's `ease` array form). */
  ease?: readonly [number, number, number, number];
  /** Spring bounce shorthand — converted via the same
      `springOptionsFromTransition`-derived formula every other family's
      reveal module uses when `stiffness`/`damping` aren't both given. */
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type GaugeResolvedTiming =
  | { kind: "tween"; durationMs: number; easingCss: string }
  | { kind: "spring"; stiffness: number; damping: number; mass: number };

// gauge.tsx `DEFAULT_NOTCH_ENTER_TRANSITION` (lines 31-35): unlike every
// other migrated family (whose default enter transition is a TWEEN), Gauge's
// own fallback is ALREADY a spring — {stiffness:300, damping:20, mass:1
// (framer default)}.
export const GAUGE_SPRING_FALLBACK: GaugeResolvedTiming = {
  kind: "spring",
  stiffness: 300,
  damping: 20,
  mass: 1,
};

/**
 * bklit motion-utils.ts `springOptionsFromTransition`, verbatim formula —
 * duplicated here (also duplicated in ring-reveal.ts/pie-reveal.ts/
 * radar-reveal.ts) per the per-family self-contained-module precedent.
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
 * Resolves a caller-supplied `enterTransition` against the spring fallback —
 * mirrors bklit's own dispatch: `notchTransition = enterTransition ??
 * DEFAULT_NOTCH_ENTER_TRANSITION` (gauge.tsx lines 296-298/482-484), an
 * explicit caller transition always wins outright, reduced-motion is
 * handled by the caller BEFORE reaching here (bklit swaps in
 * `{duration:0}` for `prefersReducedMotion`, reproduced by the caller
 * skipping `reconcileGaugeReveal` entirely — see gauge.tsx).
 */
export function resolveEnterTransition(
  transition: GaugeEnterTransition | undefined,
  fallback: GaugeResolvedTiming = GAUGE_SPRING_FALLBACK,
): GaugeResolvedTiming {
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
        : { stiffness: 300, damping: 20 };
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
      : "cubic-bezier(0.85, 0, 0.15, 1)";
  return { kind: "tween", durationMs, easingCss };
}

export interface GaugeRevealTiming {
  durationMs: number;
  easing: string;
  /** ALWAYS non-null pre-sampled 0->1 progress values — same "why uniform/
      sampled progress instead of a 2-keyframe tween" rationale as
      ring-reveal.ts (CSS `d`/transform interpolation pitfalls, docs/LOG.md
      D51); Gauge's own keyframes are opacity+scale only (never `d`), so the
      risk that motivated ring's fix doesn't strictly apply here, but reusing
      the identical sampled-spring representation keeps this module
      structurally consistent with every other family's reveal engine. */
  sampledProgress: number[];
}

const TWEEN_SAMPLES = 64;
const UNIFORM_PROGRESS = Array.from(
  { length: TWEEN_SAMPLES },
  (_, i) => i / (TWEEN_SAMPLES - 1),
);

export function revealTiming(resolved: GaugeResolvedTiming): GaugeRevealTiming {
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

/** Builds the `progress -> Keyframe` array for one `.animate()` call. */
export function buildProgressKeyframes(
  timing: GaugeRevealTiming,
  toKeyframe: (progress: number) => Keyframe,
): Keyframe[] {
  return timing.sampledProgress.map(toKeyframe);
}

export interface GaugeRevealTarget {
  key: string;
  el: Element;
  delayMs: number;
}

/**
 * Diffs `targets` (the FULL current set of bg-wave OR active-wave elements
 * for this render) against `seen` (mutated in place — the set of keys this
 * engine has already animated once), firing a spring/tween pop-in
 * (`opacity 0->1` + `transform scale(0)->scale(1)`, ONE combined `.animate()`
 * call exactly like bklit's single `motion.path` transition covering both
 * `opacity`/`scale`) for any key that's newly present, and forgetting any
 * key that's no longer present (so a later re-appearance — e.g. `value`
 * drops then rises again — replays the entrance fresh, matching a true
 * unmount+remount in bklit's own keyed-`motion.path` model). Callers are
 * responsible for setting `el.style.transformOrigin` themselves before
 * invoking this (arc: uniform "0px 0px" since geometry is pre-centered
 * relative to the polar group's own translated origin; linear: each notch's
 * own `xCenter,yCenter` in absolute SVG px — see gauge.tsx call sites).
 */
export function reconcileGaugeReveal(
  targets: readonly GaugeRevealTarget[],
  seen: Set<string>,
  timing: GaugeRevealTiming,
  trackAnimation: (anim: Animation) => void,
): void {
  const currentKeys = new Set(targets.map((t) => t.key));
  for (const key of seen) {
    if (!currentKeys.has(key)) seen.delete(key);
  }
  for (const target of targets) {
    if (seen.has(target.key)) continue;
    seen.add(target.key);
    const keyframes = buildProgressKeyframes(timing, (p) => ({
      opacity: String(Math.max(0, Math.min(1, p))),
      transform: `scale(${p})`,
    }));
    const anim = target.el.animate(keyframes, {
      duration: timing.durationMs,
      delay: target.delayMs,
      easing: timing.easing,
      fill: "backwards",
    });
    trackAnimation(anim);
  }
}
