// Reveal/update WAAPI engine for GaugeChart's notch pop-in. The generic
// `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes` machinery
// now lives in `./enter-transition` (one implementation, one import path —
// initiative 1 consolidation); this module re-exports it under gauge's family
// names and keeps ONLY the gauge-specific key-diffing reconciler below.
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
import {
  buildProgressKeyframes,
  type EnterTransition,
  type ResolvedTiming,
  type RevealTiming,
} from "./enter-transition";

export { resolveEnterTransition, revealTiming } from "./enter-transition";

export type GaugeEnterTransition = EnterTransition;
export type GaugeResolvedTiming = ResolvedTiming;
export type GaugeRevealTiming = RevealTiming;

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
