// P6.2 / T-E1b — port of bklit `use-animated-y-domains.ts` (public API, barrel
// `index.ts:605`). Drives the per-axis y-domain the GRID is drawn against while
// a chart moves between its loading skeleton and its real data: on a phase
// change the domains either snap or tween, and on a target change inside a live
// phase they snap (or tween, when `tweenOnTargetChange` is set — brush zoom).
//
// Two forced divergences from legacy, both mechanical:
//
//   1. **No `motion/react`.** bklit tweens with `animate(0, 1, {...})` and reads
//      reduced motion from `useReducedMotion()`. The migrated charts have no
//      motion dependency at all (every reveal is hand-rolled WAAPI/rAF — see
//      `enter-transition.ts`), so the tween is a plain rAF loop and reduced
//      motion comes from `./use-prefers-reduced-motion`. The easing is the same
//      curve: legacy's `LINE_LOADING_PULSE_EASE = [0.85, 0, 0.15, 1]`
//      (`line-loading-timing.ts:13`) is exactly the curve `./bezier-easing`
//      solves, so `bezierEasing(t)` IS legacy's `ease`.
//   2. **`domainsEqual` / `shouldTweenYDomain` / `isYDomainTweenPhase` /
//      `resolveAnimatedYDestinationDomains` are imported from `./y-domain`**
//      rather than re-declared, so this hook and P6.1's scale layer cannot
//      drift apart. Legacy keeps them in `y-domain-utils.ts` for the same
//      reason.
//
// NOTE (stated plainly, per the P6.2 brief): as of this commit the hook is
// EXPORTED BUT UNCONSUMED inside `showcase/migrated/`. The migrated charts hand
// TanStack a `yDomainTweenDuration` and let the renderer tween the single spec
// scale; they never hold an animated per-axis record themselves. It exists here
// for legacy component-API parity — a downstream consumer that imported
// `useAnimatedYDomains` from `@bklitui/ui/charts` must still find it — and it is
// gated by construction rather than by a QA screenshot, because no migrated
// chart renders through it.
import * as React from "react";

import { bezierEasing } from "./bezier-easing";
import type { ChartPhase } from "./chart-phase";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import {
  domainsEqual,
  isYDomainTweenPhase,
  resolveAnimatedYDestinationDomains,
  shouldTweenYDomain,
  type YDomain,
} from "./y-domain";

const FALLBACK_DOMAIN: YDomain = [0, 100];

function lerpDomain(from: YDomain, to: YDomain, progress: number): YDomain {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ];
}

/** Tween control surface — `stop()` mirrors motion's `AnimationPlaybackControls`. */
interface TweenControl {
  stop: () => void;
}

function snapDomains(
  domains: Record<string, YDomain>,
  setAnimatedByAxis: (next: Record<string, YDomain>) => void,
  animatedRef: React.MutableRefObject<Record<string, YDomain>>,
): void {
  if (domainsEqual(animatedRef.current, domains)) return;
  setAnimatedByAxis(domains);
  animatedRef.current = domains;
}

function tweenDomains({
  destination,
  durationMs,
  enabled,
  reducedMotion,
  animatedRef,
  setAnimatedByAxis,
  onSettled,
}: {
  destination: Record<string, YDomain>;
  durationMs: number;
  enabled: boolean;
  reducedMotion: boolean;
  animatedRef: React.MutableRefObject<Record<string, YDomain>>;
  setAnimatedByAxis: (next: Record<string, YDomain>) => void;
  onSettled?: () => void;
}): TweenControl | undefined {
  if (domainsEqual(animatedRef.current, destination)) {
    onSettled?.();
    return;
  }
  if (!enabled || reducedMotion) {
    snapDomains(destination, setAnimatedByAxis, animatedRef);
    onSettled?.();
    return;
  }

  const axisIds = Object.keys(destination);
  const fromSnapshot = animatedRef.current;

  // Legacy's early-out: if EVERY axis's move is below the skip threshold the
  // whole tween is pointless, so snap and settle immediately.
  let needsTween = false;
  for (const axisId of axisIds) {
    const from = fromSnapshot[axisId] ?? destination[axisId] ?? FALLBACK_DOMAIN;
    const to = destination[axisId] ?? from;
    if (shouldTweenYDomain(from, to)) {
      needsTween = true;
      break;
    }
  }
  if (!needsTween) {
    snapDomains(destination, setAnimatedByAxis, animatedRef);
    onSettled?.();
    return;
  }

  const fromByAxis: Record<string, YDomain> = {};
  for (const axisId of axisIds) {
    fromByAxis[axisId] = fromSnapshot[axisId] ?? destination[axisId] ?? FALLBACK_DOMAIN;
  }

  // Per-axis re-test inside the loop, exactly as legacy does: an axis under the
  // threshold jumps to its target on the FIRST frame while the others animate.
  const frameFor = (progress: number): Record<string, YDomain> => {
    const next: Record<string, YDomain> = {};
    for (const axisId of axisIds) {
      const from = fromByAxis[axisId] ?? destination[axisId] ?? FALLBACK_DOMAIN;
      const to = destination[axisId] ?? from;
      next[axisId] = shouldTweenYDomain(from, to) ? lerpDomain(from, to, progress) : to;
    }
    return next;
  };

  let raf = 0;
  let stopped = false;
  const start = performance.now();
  const total = Math.max(1, durationMs);

  const tick = (now: number) => {
    if (stopped) return;
    const linear = Math.min(1, (now - start) / total);
    if (linear >= 1) {
      snapDomains(destination, setAnimatedByAxis, animatedRef);
      onSettled?.();
      return;
    }
    const next = frameFor(bezierEasing(linear));
    animatedRef.current = next;
    setAnimatedByAxis(next);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}

export interface UseAnimatedYDomainsOptions {
  enabled: boolean;
  durationMs: number;
  chartPhase: ChartPhase;
  skeletonByAxis: Record<string, YDomain>;
  targetByAxis: Record<string, YDomain>;
  onSettled?: () => void;
  /** When true, tweens y-domains on target changes while the chart is in the ready phase (e.g. brush zoom). */
  tweenOnTargetChange?: boolean;
}

/** bklit `useAnimatedYDomains` — see the module header for the two divergences. */
export function useAnimatedYDomains({
  enabled,
  durationMs,
  chartPhase,
  skeletonByAxis,
  targetByAxis,
  onSettled,
  tweenOnTargetChange = false,
}: UseAnimatedYDomainsOptions): Record<string, YDomain> {
  const reducedMotion = usePrefersReducedMotion();
  const destinationByAxis = resolveAnimatedYDestinationDomains(
    chartPhase,
    skeletonByAxis,
    targetByAxis,
  );

  // Legacy writes these refs during render so the phase effect below reads the
  // CURRENT records without listing them as dependencies (they are fresh object
  // identities every render and would restart the tween on any re-render).
  const destinationRef = React.useRef(destinationByAxis);
  destinationRef.current = destinationByAxis;
  const skeletonRef = React.useRef(skeletonByAxis);
  skeletonRef.current = skeletonByAxis;
  const targetRef = React.useRef(targetByAxis);
  targetRef.current = targetByAxis;

  const [animatedByAxis, setAnimatedByAxis] = React.useState(destinationByAxis);
  const animatedRef = React.useRef(animatedByAxis);
  const prevPhaseRef = React.useRef(chartPhase);
  const onSettledRef = React.useRef(onSettled);
  onSettledRef.current = onSettled;

  React.useEffect(() => {
    animatedRef.current = animatedByAxis;
  }, [animatedByAxis]);

  React.useEffect(() => {
    if (prevPhaseRef.current === chartPhase) return;
    prevPhaseRef.current = chartPhase;

    // Keep grid spacing frozen while the series exits the viewport.
    if (chartPhase === "exiting" || chartPhase === "loading") {
      snapDomains(skeletonRef.current, setAnimatedByAxis, animatedRef);
      return;
    }
    if (chartPhase === "exitingReady" || chartPhase === "revealing" || chartPhase === "ready") {
      snapDomains(targetRef.current, setAnimatedByAxis, animatedRef);
      return;
    }
    if (!isYDomainTweenPhase(chartPhase)) return;

    const control = tweenDomains({
      destination: destinationRef.current,
      durationMs,
      enabled,
      reducedMotion,
      animatedRef,
      setAnimatedByAxis,
      onSettled: () => onSettledRef.current?.(),
    });
    return () => control?.stop();
  }, [chartPhase, durationMs, enabled, reducedMotion]);

  // Target changes inside a LIVE phase. Legacy compares a JSON signature
  // because `targetByAxis` is a fresh object every render; kept verbatim so the
  // effect fires on exactly the same edges.
  const targetSignature = JSON.stringify(targetByAxis);
  const prevTargetSignatureRef = React.useRef(targetSignature);

  React.useEffect(() => {
    const inLivePhase = chartPhase === "ready" || chartPhase === "revealing";
    if (!inLivePhase) {
      prevTargetSignatureRef.current = targetSignature;
      return;
    }
    if (prevTargetSignatureRef.current === targetSignature) return;
    prevTargetSignatureRef.current = targetSignature;

    if (tweenOnTargetChange && chartPhase === "ready") {
      const control = tweenDomains({
        destination: targetRef.current,
        durationMs,
        enabled,
        reducedMotion,
        animatedRef,
        setAnimatedByAxis,
        onSettled: () => onSettledRef.current?.(),
      });
      return () => control?.stop();
    }

    snapDomains(targetRef.current, setAnimatedByAxis, animatedRef);
  }, [chartPhase, durationMs, enabled, reducedMotion, targetSignature, tweenOnTargetChange]);

  return animatedByAxis;
}
