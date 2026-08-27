import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

// T3/D13: the ~12 ad-hoc `matchMedia` sites were folded into this hook in an
// earlier phase; what remained was that every mounted consumer built its OWN
// MediaQueryList and attached its OWN "change" listener (up to 15 at once).
// One module-level MediaQueryList now backs a single "change" listener that
// fans out to the subscribed React callbacks.
//
// Created LAZILY, never at module scope: this module is imported by 14 chart
// files that Next prerenders on the server, where `window` does not exist.
// Touching `window` only inside subscribe/getSnapshot is what keeps the import
// side-effect-free, and that property must be preserved.
let mediaQuery: MediaQueryList | null = null;

function getMediaQuery(): MediaQueryList {
  if (mediaQuery === null) mediaQuery = window.matchMedia(QUERY);
  return mediaQuery;
}

const subscribers = new Set<() => void>();

function handleChange() {
  for (const cb of subscribers) cb();
}

function subscribeReducedMotion(cb: () => void) {
  // Attach on the first subscriber, detach on the last — so the listener count
  // is 1 while anything is mounted and 0 when nothing is.
  if (subscribers.size === 0) getMediaQuery().addEventListener("change", handleChange);
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0) getMediaQuery().removeEventListener("change", handleChange);
  };
}

function getReducedMotionSnapshot() {
  return getMediaQuery().matches;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot);
}
