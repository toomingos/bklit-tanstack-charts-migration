"use client";

import { createContext, useContext } from "react";

interface ChartLegendHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

const ChartLegendHoverContext =
  createContext<ChartLegendHoverContextValue | null>(null);

// Shared with the provider in ./chart-legend-hover. Split out so that
// That file exports only its component (react/only-export-components).
const useChartLegendHover = (): ChartLegendHoverContextValue => {
  const context = useContext(ChartLegendHoverContext);
  return (
    context ?? {
      hoveredIndex: null,
      setHoveredIndex: () => {
        /* Noop outside ChartLegendHoverProvider */
      },
    }
  );
};

export { ChartLegendHoverContext, useChartLegendHover };
export type { ChartLegendHoverContextValue };
