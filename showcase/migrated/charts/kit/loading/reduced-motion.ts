import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** The current preference; read it once per frame or render, not per node. */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") { return false; }
  return window.matchMedia(QUERY).matches;
};

const subscribe = (notify: () => void): (() => void) => {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", notify);
  return () => {
    list.removeEventListener("change", notify);
  };
};

export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribe,
    prefersReducedMotion,
    () => false,
  );
