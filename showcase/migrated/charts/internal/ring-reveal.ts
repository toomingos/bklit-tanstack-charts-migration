// Reveal-timing helpers for RingChart's two-phase per-ring enter animation
// (expand track scale-pop, then progress angular sweep). The generic
// `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes` machinery
// now lives in `./enter-transition` (one implementation, one import path —
// initiative 1 consolidation); this module re-exports it under ring's family
// names so chart files don't churn.
//
// bklit's own `useMountProgress` (use-mount-progress.ts) falls back to the
// single shared `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts) whenever a
// `RingChart` `enterTransition` prop isn't supplied — a plain tween, 1100ms,
// cubic-bezier(0.85,0,0.15,1) — identical fallback to pie's. A caller may
// still pass an explicit `{type:"spring",...}` `enterTransition` (ring.tsx
// passes it straight through from `useRingStable().enterTransition`, same
// as pie), so `resolveEnterTransition` keeps the same spring/tween
// generality as pie's version.
import {
  TWEEN_FALLBACK,
  type EnterTransition,
  type ResolvedTiming,
  type RevealTiming,
} from "./enter-transition";

export {
  buildProgressKeyframes,
  resolveEnterTransition,
  revealTiming,
} from "./enter-transition";

export type RingEnterTransition = EnterTransition;
export type RingResolvedTiming = ResolvedTiming;
export type RingRevealTiming = RevealTiming;

export const RING_TWEEN_FALLBACK: RingResolvedTiming = TWEEN_FALLBACK;
