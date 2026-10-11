import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { alignEntranceStart } from "./entrance-origin";
import type { EntranceOrigin } from "./entrance-origin";

/** `performance.now()` at the start of the chart component's latest render; the commit that mounts the entrance is the render after it,
 * so by its layout effect this holds that commit's start (see `EntranceAlign`). */
export const useRenderStart = (): RefObject<number> => {
  const start = useRef(0);
  start.current = performance.now();
  return start;
};

/** Runs `alignEntranceStart` for `hostRef` in its layout effect, with motion's `createdAt` taken at the start of the mounting commit (`renderStart`); sampling after the renderer's DOM build would delay the origin.
 * Render it before the renderer. Without `renderStart` the first rAF's timestamp stands in (sankey: bklit's commit precedes the migrated one by more than the stale limit). */
export const EntranceAlign = ({ hostRef, origins, renderStart, resolveOnFrame }: { readonly hostRef: RefObject<HTMLElement | null>; readonly origins: Readonly<Record<string, EntranceOrigin>>; readonly renderStart?: RefObject<number | null>; readonly resolveOnFrame?: boolean }): null => {
  useLayoutEffect(
    // The host is read at the second frame: its ref is not attached yet when this leaf mounts in the same commit as the host itself.
    () => alignEntranceStart(() => hostRef.current, origins, renderStart?.current ?? "frame", resolveOnFrame),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hostRef],
  );
  return null;
};
