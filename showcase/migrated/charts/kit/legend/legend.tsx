// Kit-owned legend hover bridge: ChartLegend rows write the hovered index, native charts read it to dim
// the other series. One context for all native charts; provider and hook keep their bklit names.
"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

interface ChartLegendHoverContextValue {
  hoveredIndex: number | null;
  readonly setHoveredIndex: (index: number | null) => void;
}

const ChartLegendHoverContext = createContext<ChartLegendHoverContextValue | null>(null);

const OUTSIDE_PROVIDER: ChartLegendHoverContextValue = {
  hoveredIndex: null,
  setHoveredIndex: () => {
    /* No-op outside ChartLegendHoverProvider */
  },
};

export const useChartLegendHover = (): ChartLegendHoverContextValue =>
  useContext(ChartLegendHoverContext) ?? OUTSIDE_PROVIDER;

export const ChartLegendHoverProvider = ({
  hoveredIndex,
  onHoverChange,
  children,
}: {
  hoveredIndex: number | null;
  onHoverChange: (index: number | null) => void;
  children: ReactNode;
}): ReactElement => {
  const value = useMemo(() => ({ hoveredIndex, setHoveredIndex: onHoverChange }), [hoveredIndex, onHoverChange]);
  return <ChartLegendHoverContext.Provider value={value}>{children}</ChartLegendHoverContext.Provider>;
};

// Profit/loss legend hover (bklit profit-loss-legend-hover): 0 = Profit, 1 = Loss. Separate from the
// series-index context above because ProfitLossLine dims by sign, not by series.
interface ProfitLossLegendHoverContextValue {
  hoveredIndex: number | null;
}

const ProfitLossLegendHoverContext = createContext<ProfitLossLegendHoverContextValue | null>(null);
const PROFIT_LOSS_NO_HOVER: ProfitLossLegendHoverContextValue = { hoveredIndex: null };

export const ProfitLossLegendHoverProvider = ({
  hoveredIndex,
  children,
}: {
  hoveredIndex: number | null;
  children: ReactNode;
}): ReactElement => {
  const value = useMemo(() => ({ hoveredIndex }), [hoveredIndex]);
  return <ProfitLossLegendHoverContext.Provider value={value}>{children}</ProfitLossLegendHoverContext.Provider>;
};

export const useProfitLossLegendHover = (): ProfitLossLegendHoverContextValue =>
  useContext(ProfitLossLegendHoverContext) ?? PROFIT_LOSS_NO_HOVER;
