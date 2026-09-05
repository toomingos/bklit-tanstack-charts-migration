"use client";

import { useLayoutEffect, useMemo } from "react";
import { OUTSIDE_CHART_MESSAGE, useChartChildRegistry } from "./chart-child-registry";
import type { AnyChildProps } from "./chart-child-carrier";

// Client-only registration; the prop scan stays the SSR first-render path.
const useChartChild = (role: string, props: AnyChildProps): void => {
  const registry = useChartChildRegistry();
  const entry = useMemo(() => ({ key: null, props, role }), [props, role]);
  useLayoutEffect(() => {
    if (registry === null) {
      return undefined;
    }
    return registry.register(entry);
  }, [entry, registry]);
  if (registry === null) {
    throw new Error(OUTSIDE_CHART_MESSAGE);
  }
};

export { useChartChild };
