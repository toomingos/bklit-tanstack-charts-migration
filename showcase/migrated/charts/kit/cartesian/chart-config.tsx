"use client";
// bklit's chart config + static-preview contexts: plain React contexts whose spring numbers composed children can read (bklit drove motion/react with them);
// the native charts animate with `motion()` tweens and do not consume the springs.
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { CROSSHAIR_SPRING, HIGHLIGHT_SPRING, TOOLTIP_BOX_SPRING } from "../motion/springs";
import type { SpringConfig } from "../types";

/**
 * Spring settings shared through `ChartConfigProvider` and read with `useChartConfig()`. Charts in this package animate with fixed tweens and do not read them; they are for your own custom children.
 */
export interface ChartConfigValue {
  /**
   * Spring for the crosshair, tooltip dots and date pill.
   * @default { stiffness: 300, damping: 30 }
   */
  tooltipSpring: SpringConfig;
  /**
   * Spring for the floating tooltip panel.
   * @default { stiffness: 100, damping: 20 }
   */
  tooltipBoxSpring: SpringConfig;
  /**
   * Spring for the hover highlight band on line and area charts.
   * @default { stiffness: 180, damping: 28 }
   */
  highlightSpring: SpringConfig;
}

/** The default `ChartConfigValue`. */
export const DEFAULT_CHART_CONFIG: ChartConfigValue = {
  tooltipSpring: CROSSHAIR_SPRING,
  tooltipBoxSpring: TOOLTIP_BOX_SPRING,
  highlightSpring: HIGHLIGHT_SPRING,
};

const ChartConfigContext = createContext<ChartConfigValue | null>(null);

/** Props of `ChartConfigProvider`. */
export interface ChartConfigProviderProps {
  /** Springs to override. Anything omitted keeps its default. */
  value?: Partial<ChartConfigValue>;
  /** The charts that use these settings. */
  children: ReactNode;
}

/** Provides spring settings to the charts below it. Values you leave out keep their defaults. */
export function ChartConfigProvider({ value, children }: Readonly<ChartConfigProviderProps>): ReactNode {
  const merged = useMemo<ChartConfigValue>(() => ({ ...DEFAULT_CHART_CONFIG, ...value }), [value]);
  return <ChartConfigContext.Provider value={merged}>{children}</ChartConfigContext.Provider>;
}

/** Returns the spring settings from the nearest `ChartConfigProvider`, or the defaults when there is none. */
export function useChartConfig(): ChartConfigValue {
  return useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;
}

const StaticChartPreviewContext = createContext(false);

/**
 * Disables the entrance animation for static docs previews.
 * @internal
 */
export function StaticChartPreviewProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return <StaticChartPreviewContext.Provider value>{children}</StaticChartPreviewContext.Provider>;
}

/** @internal */
export function useStaticChartPreview(): boolean {
  return useContext(StaticChartPreviewContext);
}
