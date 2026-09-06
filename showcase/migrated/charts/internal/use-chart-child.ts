"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { OUTSIDE_CHART_MESSAGE, useChartChildRegistry } from "./chart-child-registry";
import type { AnyChildProps } from "./chart-child-carrier";
import type { ChartLayerContribution } from "./chart-child-registry";

// Client-only registration; the prop scan stays the SSR first-render path.
// Register once per mount, then update stored props in place below.
const useChartChild = (role: string, props: AnyChildProps, contribution?: ChartLayerContribution): void => {
  const registry = useChartChildRegistry();
  const entry = useMemo(() => ({ contribution, key: null, props, role }), [props, role, contribution]);
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const idRef = useRef<number | null>(null);
  const register = registry?.register;
  const unregister = registry?.unregister;
  const update = registry?.update;
  useLayoutEffect(() => {
    if (register === undefined || unregister === undefined) { return undefined; }
    const id = register(entryRef.current);
    idRef.current = id;
    return (): void => {
      idRef.current = null;
      unregister(id);
    };
  }, [register, unregister]);
  useLayoutEffect(() => {
    if (update === undefined || idRef.current === null) {return;}
    update(idRef.current, entryRef.current);
  });
  if (registry === null) {
    throw new Error(OUTSIDE_CHART_MESSAGE);
  }
};

export { useChartChild };
