import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { ChartMotionTiming } from "@tanstack/charts";
import { toEaseFn, toMotionTransition } from "../kit/motion/enter-transition";
import type { EnterTransition } from "../kit/motion/phase";
import { useReadyGate } from "../kit/entrance/reveal-arm";
import type { ReadyStore } from "../kit/entrance/reveal-arm";

const ENTER_FADE_MS = 1100;
const UPDATE_MORPH_MS = 180;
const FADE_SAMPLES = 32;

type EnterMotion = ReturnType<typeof toMotionTransition>;

interface EnterReveal {
  readonly ready: ReadyStore;
  readonly epoch: number;
  readonly enterMotion: EnterMotion;
  /** Host custom properties of the layers' CSS fade (styles.css, `bkm-choro-fade`). */
  readonly fadeVars: Readonly<Record<string, string>>;
}

/** The fade as CSS values: bklit's curve over its first `animationDuration` ms (the isLoaded cut, choropleth-feature.tsx:381-385, snaps it to 1 when the animation ends), as a `linear()` easing. */
const computeFadeVars = (animationDuration: number, enterTransition: EnterTransition | undefined): Record<string, string> => {
  if (animationDuration <= 0) {return { "--bkm-choro-fade-ms": "0ms" };}
  const curve = toEaseFn(enterTransition?.ease);
  const total = enterTransition?.duration === undefined ? ENTER_FADE_MS : enterTransition.duration * 1000;
  const span = total > 0 ? Math.min(1, animationDuration / total) : 1;
  const end = curve(span);
  const stops: string[] = [];
  for (let i = 0; i <= FADE_SAMPLES; i += 1) {
    stops.push((end === 0 ? 0 : curve((i / FADE_SAMPLES) * span) / end).toFixed(4));
  }
  return { "--bkm-choro-fade-end": String(end), "--bkm-choro-fade-ease": `linear(${stops.join(",")})`, "--bkm-choro-fade-ms": `${animationDuration}ms` };
};

/** Reveal lifecycle: the isLoaded gate (bklit's mount effect, choropleth-chart.tsx:390-397, arms it) and the CSS fade values. */
export const useEnterReveal = (
  hostRef: RefObject<HTMLElement | null>,
  options: { readonly animationDuration: number; readonly revealSignature: string; readonly enterTransition: EnterTransition | undefined },
): EnterReveal => {
  const { animationDuration, revealSignature, enterTransition } = options;
  const [revealState, setRevealState] = useState({ epoch: 1, key: `${animationDuration}|${revealSignature}` });
  const revealKey = `${animationDuration}|${revealSignature}`;
  if (revealState.key !== revealKey) {setRevealState({ epoch: revealState.epoch + 1, key: revealKey });}
  // bklit's entering layer ignores the hover (no dim, no highlight) until `isLoaded`; the CSS gates the dim and the guide layer on this.
  const { arm, store } = useReadyGate(hostRef, animationDuration, { resetKey: revealSignature });
  useEffect(() => { arm(); }, [arm]);

  // geoShape has no first-paint motion (UPSTREAM-GAPS #12), so the first paint's fade is CSS; a joining feature fades via this tween, other updates morph briefly.
  // Pan/zoom never reach the definition: the zoom layer writes the transform to the host and CSS moves the marks.
  const enterMotion = useMemo(() => toMotionTransition(enterTransition, { durationMs: ENTER_FADE_MS, keywordEases: true }), [enterTransition]);
  const fadeVars = useMemo(() => computeFadeVars(animationDuration, enterTransition), [animationDuration, enterTransition]);
  return { enterMotion, epoch: revealState.epoch, fadeVars, ready: store };
};

/** Per-layer `motion` option shared by the features and graticule geoShape layers. */
export const createLayerMotion = (enterMotion: EnterMotion) => (context: { phase: string }): ChartMotionTiming =>
  context.phase === "enter" ? { transition: enterMotion } : { transition: { duration: UPDATE_MORPH_MS, easing: "ease-out", type: "tween" } as const };
