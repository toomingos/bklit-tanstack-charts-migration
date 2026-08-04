// Enter-transition resolution for FunnelChart's per-segment scale reveal.
// Self-contained duplicate of internal/ring-reveal.ts's generic
// `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes` machinery
// (docs/LOG.md D43 precedent — per-family internal modules, NOT imported
// from ring-reveal.ts), REUSING (importing, not duplicating)
// `estimateSpringSettleMs`/`sampleSpringProgress` from `./radar-spring`, the
// confirmed generic closed-form spring utilities every other chart family's
// reveal module already shares this way.
//
// bklit's own `useMountProgress` (use-mount-progress.ts) falls back to the
// single shared `DEFAULT_CHART_ENTER_TRANSITION` (animation.ts) whenever a
// `FunnelChart` `enterTransition` prop isn't supplied — a plain tween,
// 1100ms, cubic-bezier(0.85,0,0.15,1) (docs/LOG.md D30's confirmed default,
// "no spring sampling needed"). A caller may still pass an explicit
// `{type:"spring",...}` `enterTransition` (`FunnelChartProps.enterTransition`
// is typed `Transition`, passed straight through to `useMountProgress` for
// every segment, same as ring/pie), so `resolveEnterTransition` keeps the
// same spring/tween generality as ring-reveal.ts's version for full API
// compat, even though the docs-demo default path (and every bench scenario)
// only ever exercises the tween branch.
//
// Unlike ring/pie (which animate a `d`/path attribute — CSS-`d` interpolates
// DISCRETELY between mismatched path structures, D51 — requiring dense
// uniform progress sampling even for a plain tween), funnel's reveal target
// is a `transform: scale(p)` — perfectly LINEAR in progress, so a tween can
// safely use a 2-keyframe animation with WAAPI's own top-level `easing`
// (verified-safe per ring-reveal.ts's own header comment: "Uniform sampling
// keeps transform keyframes exact too, scale is linear in progress"). The
// spring branch still needs dense non-uniform sampling (WAAPI can't
// integrate spring physics natively), so this module keeps both branches
// for a single shared reconciler shape, matching the sibling files.
import { estimateSpringSettleMs, sampleSpringProgress } from "./radar-spring";

export const FUNNEL_TWEEN_DURATION_MS = 1100;
export const FUNNEL_TWEEN_EASE_CSS = "cubic-bezier(0.85, 0, 0.15, 1)";

export interface FunnelEnterTransition {
  type?: "spring" | "tween";
  duration?: number;
  ease?: readonly [number, number, number, number];
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type FunnelResolvedTiming =
  | { kind: "tween"; durationMs: number; easingCss: string }
  | { kind: "spring"; stiffness: number; damping: number; mass: number };

export const FUNNEL_TWEEN_FALLBACK: FunnelResolvedTiming = {
  kind: "tween",
  durationMs: FUNNEL_TWEEN_DURATION_MS,
  easingCss: FUNNEL_TWEEN_EASE_CSS,
};

/** bklit motion-utils.ts `springOptionsFromTransition`, verbatim formula —
    duplicated here (also duplicated in ring/pie/radar-reveal.ts) to keep
    this module self-contained per the per-family precedent above. */
function springFromBounce(
  bounce: number,
  base: { stiffness: number; damping: number },
): { stiffness: number; damping: number } {
  return {
    stiffness: Math.min(400, Math.max(80, base.stiffness * (1 + bounce * 0.35))),
    damping: Math.max(8, base.damping * (1 - bounce * 0.25)),
  };
}

export function resolveEnterTransition(
  transition: FunnelEnterTransition | undefined,
  fallback: FunnelResolvedTiming = FUNNEL_TWEEN_FALLBACK,
): FunnelResolvedTiming {
  if (!transition) return fallback;
  const type = transition.type ?? fallback.kind;
  if (type === "spring") {
    if (typeof transition.stiffness === "number" && typeof transition.damping === "number") {
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
    (transition.duration ?? (fallback.kind === "tween" ? fallback.durationMs / 1000 : 1.1)) * 1000;
  const easingCss = transition.ease
    ? `cubic-bezier(${transition.ease.join(",")})`
    : fallback.kind === "tween"
      ? fallback.easingCss
      : FUNNEL_TWEEN_EASE_CSS;
  return { kind: "tween", durationMs, easingCss };
}

export interface FunnelRevealTiming {
  durationMs: number;
  easing: string;
  /** Tween: a plain 2-point [0,1] progress pair — safe because `scale(p)` is
      linear in progress (see file header). Spring: densely sampled 0->1
      progress values with `easing: "linear"`. */
  sampledProgress: number[];
}

const TWEEN_PROGRESS = [0, 1];

export function revealTiming(resolved: FunnelResolvedTiming): FunnelRevealTiming {
  if (resolved.kind === "tween") {
    return { durationMs: resolved.durationMs, easing: resolved.easingCss, sampledProgress: TWEEN_PROGRESS };
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

export function buildProgressKeyframes(
  timing: FunnelRevealTiming,
  toKeyframe: (progress: number) => Keyframe,
): Keyframe[] {
  return timing.sampledProgress.map(toKeyframe);
}
