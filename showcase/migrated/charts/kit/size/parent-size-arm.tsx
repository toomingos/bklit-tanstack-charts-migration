// Remaining models of bklit's ParentSize chain (@visx/responsive 4.0.1-alpha.0 useParentSize.js:37-63: observer -> rAF -> debounce, `leading: true`) for heatmap and the sankey hold.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { clearAttribute, raiseAttribute } from "../host-write";

const FALLBACK_WIDTH_PX = 640;

// bklit heatmap mounts under `<ParentSize>` (default 300ms, same leading first call): heatmap/heatmap-chart.tsx:685.
/** First ResizeObserver delivery for `host`, then one frame, then `onSize(width)`. Returns the cleanup. */
const observeParentSize = (host: HTMLElement, onSize: (width: number) => void): (() => void) => {
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

/** Host ref + its width, measured in a layout effect so the chart mounts at the real width before first paint (bklit waits on ParentSize's frames first). */
export const useParentSizeWidth = <TElement extends HTMLElement>(): readonly [RefObject<TElement | null>, number | null] => {
  const ref = useRef<TElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measured = ref.current?.clientWidth ?? 0;
    setWidth(measured > 0 ? measured : FALLBACK_WIDTH_PX);
  }, []);
  return [ref, width];
};

// Scatter is the exception: react-use-measure (scatter-chart.tsx:154, observer -> trailing 10ms setTimeout), approximated with the same observer and one frame.
/** True from the commit where bklit's svg first mounts (first ResizeObserver delivery plus one frame). */
export const useParentSizeMounted = (hostRef: RefObject<HTMLElement | null>, active: boolean): boolean => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!active || !host) { return undefined; }
    return observeParentSize(host, () => { setMounted(true); });
  }, [hostRef, active]);
  return mounted;
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
 * `mountedAt` is stamped in the render that mounts the svg (`useParentSizeMounted`), where bklit's mount effect runs. */
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
