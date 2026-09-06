// Choropleth reveal keys: features enter through the renderer.
// Hook below keeps the pending/seen tracking for replays.
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { isRevealed, markRevealed } from "./reveal-root";
import { clipRevealTiming } from "./parity/animation";
import type { EnterTransition } from "./parity/animation";

const FEATURE_ENTER_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// Selector for the TanStack-rendered svg element within a chart container.
const TS_CHART_SVG_SELECTOR = "svg.ts-chart";

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
  const { animationDuration, revealSignature } = options;
  const { revealKey, seenRevealedRef } = useRevealKeyState(options.enterTransition, animationDuration, revealSignature);
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | undefined>(undefined);
  const revealPostPaintCancelRef = useRef<(() => void) | undefined>(undefined);

  const maybeStartReveal = useCallback((chartContainer: HTMLElement, svg: SVGSVGElement | null | undefined): void => {
    if (animationDuration <= 0) {return;}
    const pendingKey = readPendingRevealKey(seenRevealedRef.current, revealKey);
    if (!pendingKey || !svg || isRevealed(svg)) {return;}
    seenRevealedRef.current = pendingKey;
    markRevealed(svg);
    void chartContainer;
  }, [animationDuration, revealKey, seenRevealedRef]);

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
