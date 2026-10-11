import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { resolveEntranceOrigins } from "../kit/entrance/entrance-origin";
import { writeVar } from "../kit/host-write";

const MAX_WAIT_FRAMES = 30;

/** Backdates every notch's CSS entrance to motion's frame clock (`resolveEntranceOrigins`) with one `--bkm-gn-lag` var, no per-animation restamp:
 * the lag is the real start of one notch animation minus the clock, so each delay lands where `alignEntranceStart` would have put it. */
export const EntranceLag = ({ hostRef, renderStart }: { readonly hostRef: RefObject<HTMLElement | null>; readonly renderStart: RefObject<number | null> }): null => {
  useLayoutEffect(() => {
    let id = 0;
    const cancelOrigins = resolveEntranceOrigins(renderStart.current ?? "frame", (clocks) => {
      let waited = 0;
      // An animation's startTime is null until the first frame after its style recalc, so it is polled by frame.
      const poll = (): void => {
        const host = hostRef.current;
        const start = host?.querySelector("path, rect")?.getAnimations()[0]?.startTime;
        if (host !== null && host !== undefined && typeof start === "number") {
          writeVar(host, "--bkm-gn-lag", `${start - clocks.frame}ms`);
        } else if (waited < MAX_WAIT_FRAMES) {
          waited += 1;
          id = requestAnimationFrame(poll);
        }
      };
      id = requestAnimationFrame(poll);
    });
    return () => { cancelOrigins(); cancelAnimationFrame(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostRef]);
  return null;
};
