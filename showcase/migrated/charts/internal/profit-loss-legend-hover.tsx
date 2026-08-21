"use client";

import { createContext, type ReactNode, useContext } from "react";
import { CHART_CHILD_PASSTHROUGH } from "../children";

interface ProfitLossLegendHoverContextValue {
  hoveredIndex: number | null;
}

const ProfitLossLegendHoverContext =
  createContext<ProfitLossLegendHoverContextValue | null>(null);

export function ProfitLossLegendHoverProvider({
  hoveredIndex,
  children,
}: {
  hoveredIndex: number | null;
  children: ReactNode;
}) {
  return (
    <ProfitLossLegendHoverContext.Provider value={{ hoveredIndex }}>
      {children}
    </ProfitLossLegendHoverContext.Provider>
  );
}
(ProfitLossLegendHoverProvider as unknown as Record<symbol, unknown>)[CHART_CHILD_PASSTHROUGH] = true;

export function useProfitLossLegendHover(): ProfitLossLegendHoverContextValue {
  const context = useContext(ProfitLossLegendHoverContext);
  return context ?? { hoveredIndex: null };
}
