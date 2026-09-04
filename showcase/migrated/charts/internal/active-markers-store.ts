import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ChartMarker } from "./types";

/*
 * Split from marker-active-tooltip-provider.tsx so that module only exports its provider component.
 */

interface ActiveMarkersStore {
  subscribe: (listener: () => void) => () => void;
  getActiveDate: () => Date | null;
  setActiveDate: (date: Readonly<Date> | null) => void;
}

const createActiveMarkersStore = (): ActiveMarkersStore => {
  let activeDate: Date | null = null;
  const listeners: (() => void)[] = [];
  return {
    getActiveDate() {
      return activeDate;
    },
    setActiveDate(date: Readonly<Date> | null) {
      if (date === activeDate) {return;}
      activeDate = date;
      for (const listener of listeners) {listener();}
    },
    subscribe(listener) {
      listeners.push(listener);
      let done = false;
      return () => {
        if (done) {return;}
        done = true;
        const index = listeners.indexOf(listener);
        if (index !== -1) {listeners.splice(index, 1);}
      };
    },
  };
};

const MarkerActiveContext = createContext<ActiveMarkersStore | undefined>(undefined);

/* Default subscription when no marker store is provided. */
const noopUnsubscribe = (): void => {
  /* No-op */
};

const subscribeNoop = (): (() => void) => noopUnsubscribe;

const getNullSnapshot = (): null => null;

// Tracks the imperative hover chrome for isActive guide-line hiding.
const useActiveMarkerDate = (): Date | null => {
  const store = useContext(MarkerActiveContext);
  return useSyncExternalStore(
    store ? store.subscribe : subscribeNoop,
    store ? store.getActiveDate : getNullSnapshot,
    getNullSnapshot,
  );
};

const useActiveMarkers = (items: readonly Readonly<ChartMarker>[]): ChartMarker[] => {
  const store = useContext(MarkerActiveContext);
  const activeDate = useSyncExternalStore(
    store ? store.subscribe : subscribeNoop,
    store ? store.getActiveDate : getNullSnapshot,
    getNullSnapshot,
  );
  return useMemo(() => {
    if (!activeDate) {
      return [];
    }
    const dateKey = activeDate.toDateString();
    return items.filter((marker) => marker.date.toDateString() === dateKey);
  }, [items, activeDate]);
};

export { createActiveMarkersStore, MarkerActiveContext, useActiveMarkerDate, useActiveMarkers };
export type { ActiveMarkersStore };
