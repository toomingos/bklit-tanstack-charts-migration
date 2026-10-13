"use client";
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { ChoroplethContextValue, ChoroplethFeatureProperties, HoverStore } from "./types";

const EMPTY_COLLECTION: FeatureCollection<Geometry, ChoroplethFeatureProperties> = { features: [], type: "FeatureCollection" };

const CONTEXT_DEFAULT: ChoroplethContextValue = {
  animationDuration: 0,
  containerRef: { current: null },
  featureCollection: EMPTY_COLLECTION,
  featurePaths: [],
  features: [],
  height: 0,
  hoveredFeatureIndex: null,
  innerHeight: 0,
  innerWidth: 0,
  isLoaded: false,
  margin: { bottom: 0, left: 0, right: 0, top: 0 },
  pathGenerator: (): string | undefined => undefined,
  projectPoint: () => null,
  rawPathGenerator: () => null,
  revealEpoch: 0,
  setHoveredFeatureIndex: (): void => undefined,
  setTooltipData: (): void => undefined,
  tooltipData: null,
  unprojectPoint: () => null,
  width: 0,
};

const ChoroplethContext = createContext<ChoroplethContextValue>(CONTEXT_DEFAULT);

const ChoroplethProvider = ({ children, value }: { readonly children: ReactNode; readonly value: ChoroplethContextValue }): ReactElement => (
  <ChoroplethContext.Provider value={value}>{children}</ChoroplethContext.Provider>
);

const createHoverStore = (): HoverStore => {
  const store: HoverStore = {
    hovered: null,
    listeners: new Set(),
    set: (hovered, tooltip) => {
      if (store.hovered === hovered && store.tooltip === tooltip) {return;}
      store.hovered = hovered;
      store.tooltip = tooltip;
      store.version += 1;
      for (const listener of store.listeners) {listener();}
    },
    subscribe: (listener) => {
      store.listeners.add(listener);
      return (): void => { store.listeners.delete(listener); };
    },
    tooltip: null,
    version: 0,
  };
  return store;
};
/** The context's `setTooltipData`: a React setState-style updater applied to the hover store's tooltip. */
const tooltipSetter = (store: HoverStore): ChoroplethContextValue["setTooltipData"] =>
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- React SetStateAction union, discriminated at its only boundary
  (next): void => { store.set(store.hovered, typeof next === "function" ? next(store.tooltip) : next); };

const noopSubscribe = (): (() => void) => () => undefined;

const useChoropleth = (): ChoroplethContextValue => {
  const ctx = useContext(ChoroplethContext);
  const store = ctx.hoverStore;
  const version = useSyncExternalStore(store ? store.subscribe : noopSubscribe, () => store?.version ?? 0, () => 0);
  const loaded = useSyncExternalStore(ctx.readyStore ? ctx.readyStore.subscribe : noopSubscribe, () => ctx.readyStore?.get() ?? false, () => false);
  return useMemo((): ChoroplethContextValue => {
    if (!store) {return ctx;}
    return {
      ...ctx,
      hoveredFeatureIndex: store.hovered,
      isLoaded: loaded,
      setTooltipData: tooltipSetter(store),
      tooltipData: store.tooltip,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, store, version, loaded]);
};

export { ChoroplethContext, ChoroplethProvider, createHoverStore, tooltipSetter, useChoropleth };
