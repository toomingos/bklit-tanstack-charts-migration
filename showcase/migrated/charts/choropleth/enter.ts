import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ChartMotionTiming } from "@tanstack/charts";
import { toMotionTransition } from "../kit/motion/enter-transition";
import type { EnterTransition } from "../kit/motion/phase";
import { useReadyGate } from "../kit/entrance/reveal-arm";
import { useParentSizeMounted } from "../kit/size/parent-size-arm";

const ENTER_FADE_MS = 1100;
const UPDATE_MORPH_MS = 180;

type EnterMotion = ReturnType<typeof toMotionTransition>;

interface EnterReveal {
  readonly parentSized: boolean;
  readonly shown: boolean;
  readonly loaded: boolean;
  readonly epoch: number;
  readonly enterMotion: EnterMotion;
  readonly fadeAtRef: RefObject<number | null>;
}

/** Reveal lifecycle: ParentSize commit, layer `shown` flip, `loaded` cut and the fade clock's zero. */
export const useEnterReveal = (
  hostRef: RefObject<HTMLElement | null>,
  options: { readonly animationDuration: number; readonly revealSignature: string; readonly enterTransition: EnterTransition | undefined },
): EnterReveal => {
  const { animationDuration, revealSignature, enterTransition } = options;
  // geoShape has no entrance reveal, so fade the layer in (mount at 0, then flip to 1 until the isLoaded cut); bklit's 0.85 rest opacity
  // is on the features group (styles.css), so the hover dim stays one group opacity change.
  const [shown, setShown] = useState(false);
  const fadeAtRef = useRef<number | null>(null);

  // bklit's chain: choropleth-chart.tsx:482 mounts under `<ParentSize debounceTime={10}>` (@visx/responsive useParentSize.js:37-63); its mount effect (:390-397) starts
  // isLoaded and the fade clock (choropleth-feature.tsx:162-166, use-mount-progress.ts:19-26). `parentSized` (parent-size-arm.tsx) is that commit; `shown` stamps it.
  const parentSized = useParentSizeMounted(hostRef, true);
  const [revealState, setRevealState] = useState({ epoch: 1, key: `${animationDuration}|${revealSignature}` });
  const revealKey = `${animationDuration}|${revealSignature}`;
  if (revealState.key !== revealKey) {setRevealState({ epoch: revealState.epoch + 1, key: revealKey });}
  // bklit's entering layer ignores the hover (no dim, no highlight) until `isLoaded`; the CSS gates the dim and the guide layer on this.
  const { arm: armReady, ready: loaded } = useReadyGate(hostRef, animationDuration, { resetKey: revealSignature, viaState: true });
  useEffect(() => {
    if (parentSized) {armReady();}
  }, [parentSized, armReady]);

  useEffect(() => {
    if (!parentSized) {return;}
    fadeAtRef.current = null;
    // oxlint-disable-next-line react/set-state-in-effect, react-doctor/no-adjust-state-on-prop-change -- bklit's mount effect flips the layer on (choropleth-chart.tsx:390-397), see above
    setShown(true);
  }, [animationDuration, parentSized]);
  // The fade clock's zero is stamped once in the render that shows the layer, so RendererChart's layout update is inside the fade (use-mount-progress.ts:19-26).
  // oxlint-disable-next-line react/purity, react/immutability -- the stamp must land in the mounting render (cleared after the cut, so later updates morph)
  if (shown && !loaded && fadeAtRef.current === null) {fadeAtRef.current = performance.now();}
  useEffect(() => {
    if (loaded) {fadeAtRef.current = null;}
  }, [loaded]);

  // Entrance: a tween (or spring) from enterTransition; other updates (data, resize) morph briefly.
  // Pan/zoom never reach the definition: the zoom layer writes the transform to the host and CSS moves the marks.
  const enterMotion = useMemo(() => toMotionTransition(enterTransition, { durationMs: ENTER_FADE_MS, keywordEases: true }), [enterTransition]);

  return { enterMotion, epoch: revealState.epoch, fadeAtRef, loaded, parentSized, shown };
};

/** Per-layer `motion` option shared by the features and graticule geoShape layers. */
export const createLayerMotion = (options: {
  readonly enterMotion: EnterMotion;
  readonly fadeAtRef: RefObject<number | null>;
  readonly fading: boolean;
  readonly animationDuration: number;
}) => (context: { phase: string }): false | ChartMotionTiming => {
  const { enterMotion, fadeAtRef, fading, animationDuration } = options;
  if (context.phase === "enter") {return { transition: enterMotion };}
  // bklit cuts the fade at isLoaded: its static layer replaces the enter layer at the final opacity (choropleth-feature.tsx:381-385).
  // The cut is the `loaded` update; it snaps the running fade (fadeAtRef is still set until that commit's effect).
  if (!fading && fadeAtRef.current !== null) {return false;}
  if (!fading) {return { transition: { duration: UPDATE_MORPH_MS, easing: "ease-out", type: "tween" } as const };}
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- `easing` is the library union `string | function`, discriminated at its only boundary
  if (enterMotion.type !== "tween" || typeof enterMotion.easing !== "function" || enterMotion.duration === undefined || enterMotion.duration === 0) {return { transition: enterMotion };}
  // UPSTREAM-GAPS #33. bklit's fade clock is motion's performance.now() (use-mount-progress.ts:19-26, motion-dom AsyncMotionValueAnimation.mjs:34,:81-86); TanStack 1.0 starts at the first
  // frame's rAF timestamp (charts-core motion.ts:3988-3990), back-dated by Chrome, so this samples bklit's curve since fadeAtRef and rebases on a mid-fade update.
  const { duration, easing: curve } = enterMotion;
  const sample = (): number => {
    const at = fadeAtRef.current;
    const t = at === null ? 0 : (performance.now() - at) / duration;
    if (t <= 0) {
      return 0;
    }
    return t >= 1 ? 1 : curve(t);
  };
  const from = sample();
  const easing = (progress: number): number => (progress >= 1 || from >= 1 ? 1 : (sample() - from) / (1 - from));
  return { transition: { duration: animationDuration + duration, easing, type: "tween" } as const };
};
