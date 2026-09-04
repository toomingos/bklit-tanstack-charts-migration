"use client";

import { createContext, useContext } from "react";

const legendCssVars = {
  background: "var(--legend)",
  foreground: "var(--legend-foreground)",
  muted: "var(--legend-muted)",
  mutedForeground: "var(--legend-muted-foreground)",
  track: "var(--legend-track)",
};

interface LegendItemData {
  readonly label: string;
  readonly value: number;
  readonly maxValue?: number;
  readonly color: string;
}

interface LegendContextValue {
  readonly items: readonly LegendItemData[];
  readonly hoveredIndex: number | null;
  readonly setHoveredIndex: (index: number | null) => void;
}

interface LegendItemContextValue {
  readonly item: LegendItemData;
  readonly index: number;
  readonly isHovered: boolean;
  readonly isFaded: boolean;
  readonly percentage: number;
}

const LegendContext = createContext<LegendContextValue | undefined>(undefined);
const LegendItemContext = createContext<LegendItemContextValue | undefined>(undefined);

const useLegend = (): LegendContextValue => {
  const context = useContext(LegendContext);
  if (!context) {
    throw new Error("useLegend must be used within a <Legend> component.");
  }
  return context;
}

const useLegendItem = (): LegendItemContextValue => {
  const context = useContext(LegendItemContext);
  if (!context) {
    throw new Error(
      "useLegendItem must be used within a <LegendItem> component."
    );
  }
  return context;
}

export { legendCssVars, LegendContext, LegendItemContext, useLegend, useLegendItem };
export type { LegendItemData, LegendContextValue, LegendItemContextValue };
