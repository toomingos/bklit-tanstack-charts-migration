"use client";

import { createContext, useContext } from "react";

interface ProfitLossLegendHoverContextValue {
  hoveredIndex: number | null;
}

const ProfitLossLegendHoverContext = createContext<ProfitLossLegendHoverContextValue | undefined>(undefined);

// Shared with the provider in ./profit-loss-legend-hover. Split out so that
// That file exports only its component (react/only-export-components).
const useProfitLossLegendHover = (): ProfitLossLegendHoverContextValue => {
  const context = useContext(ProfitLossLegendHoverContext);
  return context ?? { hoveredIndex: null };
};

export { ProfitLossLegendHoverContext, useProfitLossLegendHover };
export type { ProfitLossLegendHoverContextValue };
