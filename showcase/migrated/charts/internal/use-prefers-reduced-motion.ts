import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

interface MediaQueryHolder {
  current?: MediaQueryList;
}

const mediaQueryHolder: MediaQueryHolder = {};

const getMediaQuery = (): MediaQueryList => {
  mediaQueryHolder.current ??= globalThis.matchMedia(QUERY);
  // Lazily created: module scope runs during SSR where window is absent.
  return mediaQueryHolder.current;
}

const notifyListeners = new Set<() => void>();

const handleChange = (): void => {
  for (const notify of notifyListeners) {notify();}
};

const subscribeReducedMotion = (notify: () => void): (() => void) => {
  if (notifyListeners.size === 0) {getMediaQuery().addEventListener("change", handleChange);}
  notifyListeners.add(notify);
  return (): void => {
    notifyListeners.delete(notify);
    if (notifyListeners.size === 0) {getMediaQuery().removeEventListener("change", handleChange);}
  };
};

const getReducedMotionSnapshot = (): boolean => getMediaQuery().matches;


export const usePrefersReducedMotion = (): boolean => useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);

