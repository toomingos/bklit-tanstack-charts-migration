// Reveal-timing helpers for PieChart's per-slice angular-sweep enter
// animation. The generic `resolveEnterTransition`/`revealTiming`/
// `buildProgressKeyframes` machinery now lives in `./enter-transition` (one
// implementation, one import path — initiative 1 consolidation); this module
// re-exports it under pie's family names so chart files don't churn.
//
// Unlike radar (whose grid/axis/area sub-components each fall back to a
// DIFFERENT transition kind — tween for the area path, spring for the grid
// rings), pie has exactly ONE reveal fallback kind: bklit's own
// `useMountProgress` (use-mount-progress.ts) falls back to the single shared
// `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts) whenever a `PieChart`
// `enterTransition` prop isn't supplied — a plain tween, 1100ms,
// cubic-bezier(0.85,0,0.15,1). A caller MAY still pass an explicit
// `{type:"spring",...}` `enterTransition`, so `resolveEnterTransition` keeps
// the same spring/tween generality as radar's version.
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

export type PieEnterTransition = EnterTransition;
export type PieResolvedTiming = ResolvedTiming;
export type PieRevealTiming = RevealTiming;

export const PIE_TWEEN_FALLBACK: PieResolvedTiming = TWEEN_FALLBACK;
