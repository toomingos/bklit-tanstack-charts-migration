// Enter-transition resolution for FunnelChart's per-segment scale reveal.
// The generic `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes`
// machinery now lives in `./enter-transition` (one implementation, one import
// path — initiative 1 consolidation); this module re-exports it under
// funnel's family names so chart files don't churn.
//
// bklit's own `useMountProgress` (use-mount-progress.ts) falls back to the
// single shared `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts) whenever a
// `FunnelChart` `enterTransition` prop isn't supplied — a plain tween,
// 1100ms, cubic-bezier(0.85,0,0.15,1) (docs/LOG.md D30's confirmed default,
// "no spring sampling needed"). A caller may still pass an explicit
// `{type:"spring",...}` `enterTransition` (`FunnelChartProps.enterTransition`
// is typed `Transition`, passed straight through to `useMountProgress` for
// every segment, same as ring/pie), so `resolveEnterTransition` keeps the
// same spring/tween generality for full API compat, even though the
// docs-demo default path (and every bench scenario) only ever exercises the
// tween branch.
//
// Note: funnel's reveal target is a `transform: scale(p)` — perfectly LINEAR
// in progress — so the shared `revealTiming`'s dense uniform progress
// sampling (which exists for CSS-`d`/path keyframes, D51) is visually
// identical here ("Uniform sampling keeps transform keyframes exact too,
// scale is linear in progress", docs/LOG.md D54) with zero pixel drift.
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

export type FunnelEnterTransition = EnterTransition;
export type FunnelResolvedTiming = ResolvedTiming;
export type FunnelRevealTiming = RevealTiming;

export const FUNNEL_TWEEN_FALLBACK: FunnelResolvedTiming = TWEEN_FALLBACK;
