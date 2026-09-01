// C4 (native motion, Phase 6, D432): gauge's per-notch pop-in used to be a
// hand-rolled WAAPI key-diffing reconciler (`reconcileGaugeReveal`, deleted
// this pass) — every render, diff the current `{bg-i}`/`{active-i}` key set
// against what had already been animated, firing ONE spring `.animate()`
// (opacity 0->1 + transform scale(0)->scale(1)) for brand-new keys only, and
// forgetting removed keys so a later re-appearance replayed fresh. That
// exact "new key -> enter; removed key -> gone; existing key -> untouched"
// contract is now produced NATIVELY: gauge's notches are individually keyed
// scene nodes (`radialArc`'s own `key: (d) => String(d.notchIndex)` for the
// default tapered path, and this file's sibling custom marks' explicit
// `gauge-bg:{i}`/`gauge-active:{i}` keys for the `uniformWidth` arc quad
// mark and GaugeLinear's mark), so `@tanstack/charts`' own keyed scene diff
// (confirmed by reading `dist/motion.js`'s `reconcileMotionElement` this
// session: unmatched next-children get `addEnterMotionTrack`, unmatched
// current-children get `addExitMotionTrack`, matched children get an
// update track) reproduces the identical "new key pops in, removed key
// disappears, existing key is left alone" idiom with zero bookkeeping code
// in gauge.tsx — see gauge.tsx's `motion` callbacks on each mark for the
// per-phase authored delay/transition (bg/active stagger constants,
// instant-vanish exit).
//
// One disclosed, deliberate delta: native's per-datum "enter" for an
// arc-role element animates ONLY opacity (confirmed by reading
// `addEnterMotionTrack`'s fallback branch, `dist/motion.js` lines ~1675-
// 1693 — it fades `opacity` 0->target and never touches `transform`/`d`
// for a plain new arc/area path with no hierarchy relation). There is no
// native per-datum "scale from 0" primitive to hang the legacy
// `transform:scale(0)->scale(1)` half of the pop on, so that component is
// dropped; the opacity half (with the same authored delay/spring timing)
// survives unchanged. Small, mostly-static-sized notches read as
// "materializing" either way — this is a minor, disclosed simplification,
// not a functional regression (D-ledger).
//
// The generic `resolveEnterTransition` timing-resolution machinery still
// lives in `./enter-transition` (one implementation, one import path);
// this module re-exports it under gauge's family names and keeps ONLY the
// gauge-specific default fallback constant below.
import type { ChartMotionTransition } from "@tanstack/charts";
import type { EnterTransition, ResolvedTiming } from "./enter-transition";
import { motionEasingFromCss } from "./pie-hover-chrome";

export { resolveEnterTransition } from "./enter-transition";

export type GaugeEnterTransition = EnterTransition;
export type GaugeResolvedTiming = ResolvedTiming;

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

/** Converts a resolved gauge timing into the native `ChartMotionTransition`
    shape every gauge `motion` callback below hands back for its non-exit
    phases — one place instead of four (bg/active `radialArc`, the arc
    `uniformWidth` quad mark, GaugeLinear's quad mark) re-deriving the same
    spring/tween ternary. Mirrors pie-chart.tsx's inline enter-transition
    ternary (`resolved.kind === "spring" ? {...} : {...}`); `easingCss` is
    always a `cubic-bezier(...)` string (`resolveEnterTransition`'s
    contract), converted via `motionEasingFromCss` for the tween branch's
    `easing` field, same as pie/ring's own tween-branch handling. */
export function gaugeMotionTransition(resolved: GaugeResolvedTiming): ChartMotionTransition {
  return resolved.kind === "spring"
    ? { type: "spring", stiffness: resolved.stiffness, damping: resolved.damping, mass: resolved.mass }
    : { type: "tween", duration: resolved.durationMs, easing: motionEasingFromCss(resolved.easingCss) };
}
