"use client";

import { createContext, createElement, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import type { AnyChildProps } from "./chart-child-carrier";

// Legacy throw contract: standalone carriers throw like `useChartStable`.
const OUTSIDE_CHART_MESSAGE =
  "useChartStable must be used within a ChartProvider. " +
  "Make sure your component is wrapped in <LineChart>, <AreaChart>, <BarChart>, or <ComposedChart>.";

interface ChartChildRegistration {
  readonly role: string;
  readonly props: AnyChildProps;
  readonly key: string | null;
}

// Shallow prop equality for registry dedup (V1.2 regression fix).
const isPropsRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const shallowEqualChildProps = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {return true;}
  if (!isPropsRecord(left) || !isPropsRecord(right)) {return false;}
  const leftKeys = Object.keys(left).filter((key) => key !== "children");
  const rightKeys = Object.keys(right).filter((key) => key !== "children");
  if (leftKeys.length !== rightKeys.length) {return false;}
  return leftKeys.every((key) => Object.hasOwn(right, key) && Object.is(left[key], right[key]));
};

interface ChartChildRegistryValue {
  readonly version: number;
  readonly register: (entry: ChartChildRegistration) => number;
  readonly update: (id: number, entry: ChartChildRegistration) => void;
  readonly unregister: (id: number) => void;
  readonly snapshot: () => readonly ChartChildRegistration[];
}

const ChartChildRegistryContext = createContext<ChartChildRegistryValue | null>(null);

// Null above every chart; `useChartChild` throws the legacy message there.
const useChartChildRegistry = (): ChartChildRegistryValue | null =>
  useContext(ChartChildRegistryContext);

// Entries bump `version` only on real change; subscribers re-derive once per batch.
const ChartChildRegistryProvider = (properties: {
  readonly children: ReactNode;
}): ReactElement => {
  const { children } = properties;
  const entriesRef = useRef(new Map<number, ChartChildRegistration>());
  const nextIdRef = useRef(0);
  const [version, setVersion] = useState(0);
  const register = useCallback((entry: ChartChildRegistration): number => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    entriesRef.current.set(id, entry);
    setVersion((current) => current + 1);
    return id;
  }, []);
  // Fresh-but-equal props (every consumer render) store silently; the version
  // — and every downstream definition memo — stays put.
  const update = useCallback((id: number, entry: ChartChildRegistration): void => {
    const prev = entriesRef.current.get(id);
    if (prev !== undefined && prev.role === entry.role && shallowEqualChildProps(prev.props, entry.props)) {return;}
    entriesRef.current.set(id, entry);
    setVersion((current) => current + 1);
  }, []);
  const unregister = useCallback((id: number): void => {
    entriesRef.current.delete(id);
    setVersion((current) => current + 1);
  }, []);
  const value = useMemo(
    (): ChartChildRegistryValue => ({
      register,
      snapshot: (): readonly ChartChildRegistration[] => [...entriesRef.current.values()],
      unregister,
      update,
      version,
    }),
    [register, unregister, update, version],
  );
  return createElement(ChartChildRegistryContext.Provider, { value }, children);
};

// Entry adoption: `extractChildren(children, useChartChildEntries())`.
const useChartChildEntries = (): readonly ChartChildRegistration[] => {
  const registry = useContext(ChartChildRegistryContext);
  return useMemo(
    (): readonly ChartChildRegistration[] => registry?.snapshot() ?? [],
    [registry],
  );
};

export {
  ChartChildRegistryContext,
  ChartChildRegistryProvider,
  OUTSIDE_CHART_MESSAGE,
  shallowEqualChildProps,
  useChartChildEntries,
  useChartChildRegistry,
};
export type { ChartChildRegistration, ChartChildRegistryValue };
