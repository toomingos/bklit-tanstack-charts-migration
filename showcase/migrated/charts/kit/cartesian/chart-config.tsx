// bklit's chart config + static-preview contexts: plain React contexts whose spring numbers composed children can read (bklit drove motion/react with them);
// the native charts animate with `motion()` tweens and do not consume the springs.
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { CROSSHAIR_SPRING, HIGHLIGHT_SPRING, TOOLTIP_BOX_SPRING } from "../motion/springs";
import type { SpringConfig } from "../types";

export interface ChartConfigValue {
  /** Crosshair indicator, tooltip dot, date pill. */
  tooltipSpring: SpringConfig;
  /** Floating tooltip panel. */
  tooltipBoxSpring: SpringConfig;
  /** Line/area hover-highlight band (x + width). */
  highlightSpring: SpringConfig;
}

export const DEFAULT_CHART_CONFIG: ChartConfigValue = {
  tooltipSpring: CROSSHAIR_SPRING,
  tooltipBoxSpring: TOOLTIP_BOX_SPRING,
  highlightSpring: HIGHLIGHT_SPRING,
};

const ChartConfigContext = createContext<ChartConfigValue | null>(null);

export interface ChartConfigProviderProps {
  value?: Partial<ChartConfigValue>;
  children: ReactNode;
}

export function ChartConfigProvider({ value, children }: Readonly<ChartConfigProviderProps>): ReactNode {
  const merged = useMemo<ChartConfigValue>(() => ({ ...DEFAULT_CHART_CONFIG, ...value }), [value]);
  return <ChartConfigContext.Provider value={merged}>{children}</ChartConfigContext.Provider>;
}

export function useChartConfig(): ChartConfigValue {
  return useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;
}

const StaticChartPreviewContext = createContext(false);

/** Disables the entrance animation for static docs previews. */
export function StaticChartPreviewProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return <StaticChartPreviewContext.Provider value>{children}</StaticChartPreviewContext.Provider>;
}

export function useStaticChartPreview(): boolean {
  return useContext(StaticChartPreviewContext);
}
