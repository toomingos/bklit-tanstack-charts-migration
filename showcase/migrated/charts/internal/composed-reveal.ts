import type { RefObject } from "react";
import type { ChartPhase } from "./chart-phase";

// Bar reveal stagger spends this fraction of the reveal window spreading bar starts.
const BAR_STAGGER_SPREAD_FRACTION = 0.4;

interface RevealBarSpec {
  readonly animate: boolean;
  readonly dataKey: string;
}

interface StartBarRevealParams {
  readonly animationsRef: RefObject<Animation[]>;
  readonly baselineRange: readonly number[] | undefined;
  readonly dataLength: number;
  readonly deadlineRef: RefObject<number | null>;
  readonly easingCss: string;
  readonly mountedRef: RefObject<boolean>;
  readonly onPhaseChangeRef: RefObject<((phase: ChartPhase) => void) | undefined>;
  readonly pendingRef: RefObject<boolean>;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly postPaintCancelRef: RefObject<(() => void) | null>;
  readonly resolvedBars: readonly Readonly<RevealBarSpec>[];
  readonly revealDurationMs: number;
}

// Neutralized: bars grow through the renderer; only the phase deadline stays.
const startBarReveal = (params: Readonly<StartBarRevealParams>, marks: SVGGElement): void => {
  void marks;
  const spreadMs = params.dataLength > 1 ? params.revealDurationMs * BAR_STAGGER_SPREAD_FRACTION : 0;
  const deadlineMs = params.revealDurationMs + spreadMs;
  params.pendingRef.current = true;
  if (params.deadlineRef.current !== null) {
    clearTimeout(params.deadlineRef.current);
  }
  params.deadlineRef.current = window.setTimeout(() => {
    params.deadlineRef.current = null;
    if (params.pendingRef.current) {
      params.pendingRef.current = false;
      if (params.mountedRef.current && params.phaseRef.current === "ready") {
        params.onPhaseChangeRef.current?.("ready");
      }
    }
  }, deadlineMs);
};

export { startBarReveal };
export type { RevealBarSpec, StartBarRevealParams };
