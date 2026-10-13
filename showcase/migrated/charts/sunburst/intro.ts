import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useRenderStart } from "../kit/entrance/entrance-align";
import type { EntranceOrigin } from "../kit/entrance/entrance-origin";
import { buildEnterDelays } from "./arcs";
import type { ArcDatum } from "./arcs";
import { LABEL_START_RATIO } from "./labels";

const SWEEP_MS = 1100;
const SECONDS_TO_MS = 1000;

// bklit's sector grow, sector path and label fade are all motion values (JS-driven), so the CSS ones take motion's `motion` origin.
export const SUNBURST_ENTRANCE_ORIGINS = { "bk-sb-grow": "motion", "bk-sb-label-in": "motion" } satisfies Readonly<Record<string, EntranceOrigin>>;

/** Only the sweep duration in seconds (bklit `Transition.duration`) is read. */
export const sweepMsOf = (duration: number | undefined): number => (duration === undefined ? SWEEP_MS : duration * SECONDS_TO_MS);

interface SunburstIntro {
  /** True once the entrance has played; the host drops its intro attribute and vars. */
  readonly settled: boolean;
  /** Read lazily by the motion callback so the end of the entrance does not rebuild the definition (a rebuild re-runs an 850ms no-op update tween). */
  readonly introRef: RefObject<boolean>;
  /** Clock (performance.now) where this play's render began; the sector layer and the entrance CSS run their schedules from it. */
  readonly introAtRef: RefObject<number | null>;
  /** Host CSS vars the label fade and the sector grow read (sunburst.css) while `data-bk-intro` gates them. */
  readonly hostVars: Readonly<Record<string, string>>;
}

export const useSunburstIntro = (arcs: readonly ArcDatum[], enterStaggerScale: number, sweepMs: number, playKey: number): SunburstIntro => {
  const [settledKey, setSettledKey] = useState<number | null>(null);
  const enterDelays = useMemo(() => buildEnterDelays(arcs, enterStaggerScale), [arcs, enterStaggerScale]);
  const labelDelayMs = enterDelays.maxDelay + sweepMs * LABEL_START_RATIO;
  const intro = settledKey !== playKey;
  const introRef = useRef(intro);
  introRef.current = intro;
  // bklit's mount clock starts in an effect after a light render; ours starts where this play's render began, so the renderer mount is not counted into the entrance.
  const renderStart = useRenderStart();
  const introMs = enterDelays.maxDelay + sweepMs + sweepMs * LABEL_START_RATIO;
  useEffect(() => {
    // No bklit timer: bklit flips each segment at delay+duration (useEnterComplete, use-enter-complete.ts:11-26); the labels end at maxDelay + 0.85*sweep + sweep (sunburst-labels.tsx:51-53).
    const settle = setTimeout(() => { setSettledKey(playKey); }, introMs);
    return (): void => {
      clearTimeout(settle);
    };
  }, [playKey, introMs]);
  const settled = settledKey === playKey;
  return {
    hostVars: settled ? {} : { "--bkm-sb-label-delay": `${labelDelayMs}ms`, "--bkm-sb-label-dur": `${sweepMs}ms` },
    introAtRef: renderStart,
    introRef,
    settled,
  };
};
