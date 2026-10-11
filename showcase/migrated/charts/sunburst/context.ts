"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ArcDatum, Focus, SunburstNode } from "./arcs";

export interface SunburstHoverContextValue {
  hoveredArcIndex: number | null;
  setHoveredArcIndex: (index: number | null) => void;
  hoveredArc: ArcDatum | null;
  setHoveredArc: (arc: ArcDatum | null) => void;
}

/** Hover lives outside React state, so the root never re-renders on hover: leaves subscribe through `useSunburstHover`,
 * the root mirrors it onto the DOM imperatively (label visibility). */
export interface SunburstHoverStore {
  readonly getIndex: () => number | null;
  /** Commits a new hovered index and notifies subscribers (no-op if unchanged). */
  readonly commit: (index: number | null) => void;
  readonly subscribe: (listener: () => void) => () => void;
  /** Latest arcs, written by the root. */
  readonly arcs: { current: readonly ArcDatum[] };
  /** Latest hover request handler (controlled: parent callback; uncontrolled: commit), written by the root. */
  readonly request: { current: (index: number | null) => void };
}

export const createSunburstHoverStore = (): SunburstHoverStore => {
  let index: number | null = null;
  const listeners = new Set<() => void>();
  return {
    arcs: { current: [] },
    commit: (next) => {
      if (next === index) {
        return;
      }
      index = next;
      for (const listener of listeners) {
        listener();
      }
    },
    getIndex: () => index,
    request: { current: () => undefined },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export interface SunburstStableContextValue {
  data: SunburstNode;
  arcs: ArcDatum[];
  focusById: Map<string, Focus>;
  rootId: string;
  maxDepth: number;
  size: number;
  focus: Focus;
  focusId: string;
  zoomTo: (nextId: string) => void;
}

const SunburstStableContext = createContext<SunburstStableContextValue | null>(null);
const SunburstHoverContext = createContext<SunburstHoverStore | null>(null);

export const SunburstStableProvider = SunburstStableContext.Provider;
export const SunburstHoverProvider = SunburstHoverContext.Provider;

export const useSunburstStable = (): SunburstStableContextValue => {
  const ctx = useContext(SunburstStableContext);
  if (ctx === null) {
    throw new Error("useSunburstStable must be used within SunburstChart");
  }
  return ctx;
};

export const useSunburstHover = (): SunburstHoverContextValue => {
  const store = useContext(SunburstHoverContext);
  if (store === null) {
    throw new Error("useSunburstHover must be used within SunburstChart");
  }
  const hoveredArcIndex = useSyncExternalStore(store.subscribe, store.getIndex, store.getIndex);
  return useMemo((): SunburstHoverContextValue => {
    const hoveredArc = hoveredArcIndex === null ? null : (store.arcs.current[hoveredArcIndex] ?? null);
    return {
      hoveredArc,
      hoveredArcIndex,
      setHoveredArc: (arc) => { store.request.current(arc === null ? null : arc.arcIndex); },
      setHoveredArcIndex: (index) => { store.request.current(index); },
    };
  }, [hoveredArcIndex, store]);
};
