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

interface ChartChildRegistryValue {
  readonly version: number;
  readonly register: (entry: ChartChildRegistration) => () => void;
  readonly snapshot: () => readonly ChartChildRegistration[];
}

const ChartChildRegistryContext = createContext<ChartChildRegistryValue | null>(null);

// Null above every chart; `useChartChild` throws the legacy message there.
const useChartChildRegistry = (): ChartChildRegistryValue | null =>
  useContext(ChartChildRegistryContext);

// Entries bump `version`; subscribers re-derive once per batch.
const ChartChildRegistryProvider = (properties: {
  readonly children: ReactNode;
}): ReactElement => {
  const { children } = properties;
  const entriesRef = useRef(new Map<number, ChartChildRegistration>());
  const nextIdRef = useRef(0);
  const [version, setVersion] = useState(0);
  const unregister = useCallback((id: number): void => {
    entriesRef.current.delete(id);
    setVersion((current) => current + 1);
  }, []);
  const register = useCallback(
    (entry: ChartChildRegistration): (() => void) => {
      nextIdRef.current += 1;
      const id = nextIdRef.current;
      entriesRef.current.set(id, entry);
      setVersion((current) => current + 1);
      return (): void => {
        unregister(id);
      };
    },
    [unregister],
  );
  const value = useMemo(
    (): ChartChildRegistryValue => ({
      register,
      snapshot: (): readonly ChartChildRegistration[] => [...entriesRef.current.values()],
      version,
    }),
    [register, version],
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
  useChartChildEntries,
  useChartChildRegistry,
};
export type { ChartChildRegistration, ChartChildRegistryValue };
