// Choropleth reveal lifecycle: WAAPI group fade plus the pending/seen reveal-key tracking.
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { isRevealed, markRevealed, onPostPaint, setRevealDeadline } from "./deferred-reveal";
import { clipRevealTiming } from "./enter-transition";
import type { EnterTransition } from "./enter-transition";

const FEATURE_ENTER_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// Selector for the TanStack-rendered svg element within a chart container.
const TS_CHART_SVG_SELECTOR = "svg.ts-chart";

interface RevealPlaybackOptions {
  readonly chartContainer: HTMLElement;
  readonly durationMs: number;
  readonly easingCss: string;
  readonly animationsRef: RefObject<Animation[]>;
}

// Settle a reveal tween: drop the backwards fill once finished or cancelled.
const settleGeoReveal = (anim: Animation): void => {
  anim.onfinish = (): void => { try { anim.cancel(); } catch {
    // Cancelling a finished tween throws: the reveal is already settled.
  } };
  anim.addEventListener("cancel", (): void => { try { anim.cancel(); } catch {
    // Cancelling a cancelled tween throws: the settle is already done.
  } });
};

const playGeoReveal = (options: Readonly<RevealPlaybackOptions>): void => {
  const { chartContainer, durationMs, easingCss, animationsRef } = options;
  const liveSvg = chartContainer.querySelector<SVGElement>(TS_CHART_SVG_SELECTOR);
  const liveGeo = chartContainer.querySelector<SVGGElement>(".ts-chart__geo");
  if (!liveSvg || !liveGeo) {return;}
  liveGeo.classList.remove("ts-chart__marks--revealing");
  // SVGGElement carries style via ElementCSSInlineStyle, so no HTMLElement cast is needed.
  liveGeo.style.opacity = "";
  const anim = liveGeo.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: durationMs, easing: easingCss, fill: "backwards" },
  );
  animationsRef.current.push(anim);
  settleGeoReveal(anim);
};

interface ArmRevealOptions {
  readonly chartContainer: HTMLElement;
  readonly durationMs: number;
  readonly easingCss: string;
  readonly animationsRef: RefObject<Animation[]>;
  readonly deadlineRef: RefObject<number | undefined>;
  readonly cancelRef: RefObject<(() => void) | undefined>;
}

const armRevealAnimation = (options: Readonly<ArmRevealOptions>): void => {
  const { chartContainer, durationMs, easingCss, animationsRef, deadlineRef, cancelRef } = options;
  const geoGroup = chartContainer.querySelector<SVGGElement>(".ts-chart__geo");
  if (!geoGroup) {return;}
  geoGroup.classList.add("ts-chart__marks--revealing");
  deadlineRef.current = setRevealDeadline(durationMs, {
    animationsRef,
    onDeadline: () => {
      // No deadline fallback: the animation finish handlers settle the reveal.
    },
  });
  cancelRef.current = onPostPaint(() => {
    playGeoReveal({ animationsRef, chartContainer, durationMs, easingCss });
  });
};

interface RevealKey {
  readonly signature: string;
  readonly duration: number;
}

const readPendingRevealKey = (
  seenKey: Readonly<RevealKey> | undefined,
  revealKey: Readonly<RevealKey>,
): RevealKey | undefined => {
  const revealKeyChanged =
    !seenKey ||
    seenKey.signature !== revealKey.signature ||
    seenKey.duration !== revealKey.duration;
  if (!revealKeyChanged) {return undefined;}
  return { ...revealKey };
};

interface ChoroplethRevealOptions {
  readonly animationDuration: number;
  readonly revealSignature: string;
  readonly enterTransition: EnterTransition | undefined;
}

interface RevealKeyState {
  readonly revealDurationMs: number;
  readonly revealEasingCss: string;
  readonly revealKey: RevealKey;
  readonly seenRevealedRef: RefObject<RevealKey | undefined>;
}

// Reveal timing plus the pending/seen key refs the reveal decision reads.
const useRevealKeyState = (
  enterTransition: EnterTransition | undefined,
  animationDuration: number,
  revealSignature: string,
): RevealKeyState => {
  // Reveal key carries sankey's shape; null means never revealed (boolean snapped forever).
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, FEATURE_ENTER_MS, REVEAL_EASING),
    [enterTransition],
  );
  // Derived render value (stable unless its inputs change); the reveal callback closes over it.
  const revealKey = useMemo(
    () => ({ duration: animationDuration, signature: revealSignature }),
    [animationDuration, revealSignature],
  );
  const seenRevealedRef = useRef<RevealKey | undefined>(undefined);
  return { revealDurationMs, revealEasingCss, revealKey, seenRevealedRef };
};

interface ChoroplethRevealApi {
  readonly maybeStartReveal: (chartContainer: HTMLElement, svg: SVGSVGElement | null | undefined) => void;
  readonly cancelReveal: () => void;
  readonly hasRevealed: () => boolean;
}

const useChoroplethReveal = (options: Readonly<ChoroplethRevealOptions>): ChoroplethRevealApi => {
  const { animationDuration, revealSignature, enterTransition } = options;
  const { revealDurationMs, revealEasingCss, revealKey, seenRevealedRef } = useRevealKeyState(enterTransition, animationDuration, revealSignature);
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | undefined>(undefined);
  const revealPostPaintCancelRef = useRef<(() => void) | undefined>(undefined);

  const maybeStartReveal = useCallback((chartContainer: HTMLElement, svg: SVGSVGElement | null | undefined): void => {
    if (animationDuration <= 0) {return;}
    const pendingKey = readPendingRevealKey(seenRevealedRef.current, revealKey);
    if (!pendingKey || !svg || isRevealed(svg)) {return;}
    seenRevealedRef.current = pendingKey;
    markRevealed(svg);
    armRevealAnimation({
      animationsRef: revealAnimsRef,
      cancelRef: revealPostPaintCancelRef,
      chartContainer,
      deadlineRef: revealDeadlineTimerRef,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
    });
  }, [animationDuration, revealDurationMs, revealEasingCss, revealKey, seenRevealedRef]);

  const cancelReveal = useCallback((): void => {
    if ((revealDeadlineTimerRef.current ?? 0) !== 0) {
      globalThis.clearTimeout(revealDeadlineTimerRef.current);
      revealDeadlineTimerRef.current = undefined;
    }
    revealPostPaintCancelRef.current?.();
    revealPostPaintCancelRef.current = undefined;
    for (const revealAnim of revealAnimsRef.current) {try { revealAnim.cancel(); } catch {
      // Cancelling a finished animation throws: the cancel already settled it.
    }}
    revealAnimsRef.current = [];
  }, []);

  useEffect(() => (): void => { cancelReveal(); }, [cancelReveal]);

  const hasRevealed = useCallback((): boolean => seenRevealedRef.current !== undefined, [seenRevealedRef]);

  return { cancelReveal, hasRevealed, maybeStartReveal };
};

export {
  TS_CHART_SVG_SELECTOR,
  useChoroplethReveal,
};
