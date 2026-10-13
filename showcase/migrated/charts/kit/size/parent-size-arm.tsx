// bklit's ParentSize chain (@visx/responsive 4.0.1-alpha.0 useParentSize.js:37-63: observer -> rAF -> debounce, `leading: true`) for pie, ring, heatmap and live-line; the sankey entrance hold; the reveal clock.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { clearAttribute, raiseAttribute } from "../host-write";

const FALLBACK_WIDTH_PX = 640;

// bklit mounts pie, ring, heatmap and live-line under `<ParentSize>` (leading first call, no debounce on it): e.g. heatmap/heatmap-chart.tsx:685.
/** First ResizeObserver delivery for `host`, then one frame, then `onSize(width)`. Returns the cleanup. */
export const observeParentSize = (host: HTMLElement, onSize: (width: number) => void): (() => void) => {
  let frame = 0;
  const observer = new ResizeObserver((entries) => {
    const width = entries.at(-1)?.contentRect.width ?? 0;
    observer.disconnect();
    // The frame hop of visx ParentSize: its ResizeObserver callback commits through rAF (useParentSize.js:44-58).
    frame = requestAnimationFrame(() => { onSize(width); });
  });
  observer.observe(host);
  return () => { cancelAnimationFrame(frame); observer.disconnect(); };
};

/** Host ref + its width on bklit's ParentSize chain (live-line: first ResizeObserver delivery, then one frame; null until then). Later widths come from the renderer's scene. */
export const useParentSizeWidth = <TElement extends HTMLElement>(): readonly [RefObject<TElement | null>, number | null] => {
  const ref = useRef<TElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const host = ref.current;
    if (host === null) { return undefined; }
    return observeParentSize(host, (measured) => { setWidth(measured > 0 ? measured : FALLBACK_WIDTH_PX); });
  }, []);
  return [ref, width];
};

const afterFrames = (frames: number, run: () => void): (() => void) => {
  let id = 0;
  // One rAF per hop of the mount chain bklit's ParentSize makes (useParentSize.js:44-58); no tuned ms value.
  const step = (left: number): void => { id = requestAnimationFrame(() => { if (left > 1) { step(left - 1); } else { run(); } }); };
  step(frames);
  return () => { cancelAnimationFrame(id); };
};

/** Removes a hold attribute two frames after mount (default), releasing CSS animations paused at their first keyframe (one inserted mid-frame would start partway through its spring).
 * The host renders the attribute as a constant prop, re-asserted before paint so a remounted arm holds again. */
export const HoldArm = ({ hostRef, attribute, frames = 2 }: { readonly hostRef: RefObject<HTMLElement | null>; readonly attribute: string; readonly frames?: number }): null => {
  useLayoutEffect(() => { if (hostRef.current) { raiseAttribute(hostRef.current, attribute); } }, [hostRef, attribute]);
  useEffect(() => afterFrames(frames, () => { clearAttribute(hostRef.current, attribute); }), [hostRef, attribute, frames]);
  return null;
};

/** Clock of bklit's reveal timer: its `setTimeout(animationDuration)` starts in the mount effect, before the svg mounts, so the swap lands at `mountedAt + duration` on the page clock.
 * `mountedAt` is stamped in the render that mounts the svg (heatmap: the ready render of `useFluidWidth`), where bklit's mount effect runs. */
export interface RevealClock { mountedAt: number | null }

export const useRevealClock = (active: boolean): RevealClock => {
  const [clock] = useState<RevealClock>(() => ({ mountedAt: null }));
  // Stamped in the mounting render: the native enter resolves in that commit, before any effect could stamp it.
  // oxlint-disable-next-line react/purity, react/immutability -- the stamp must land in the mounting render, see above
  if (active && clock.mountedAt === null) { clock.mountedAt = performance.now(); }
  return clock;
};

/** Where the reveal-end swap falls on an enter's own clock (ms after `enterAt`): `duration` minus how late the enter began after the timer. */
export const revealEndFromEnter = (clock: RevealClock, enterAt: number | null, duration: number): number =>
  clock.mountedAt === null || enterAt === null ? duration : duration - (enterAt - clock.mountedAt);
