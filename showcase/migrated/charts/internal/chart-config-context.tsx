// bklit chart-config-context.tsx ported verbatim (repos/bklit-ui/packages/
// ui/src/charts/chart-config-context.tsx). Spring token VALUES come from
// internal/design-tokens.ts — the same objects, one definition site, no
// re-inlined literals (research/phase-3/plans/02-sizing-contexts D1).

import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  HIGHLIGHT_SPRING,
  TOOLTIP_BOX_SPRING,
  TOOLTIP_SPRING,
} from "./design-tokens";

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export interface ChartConfigValue {
  /** Crosshair indicator, tooltip dot, date pill. */
  tooltipSpring: SpringConfig;
  /** Floating tooltip panel. */
  tooltipBoxSpring: SpringConfig;
  /** Line/area hover-highlight band (x + width). */
  highlightSpring: SpringConfig;
}

export const DEFAULT_CHART_CONFIG: ChartConfigValue = {
  tooltipSpring: TOOLTIP_SPRING,
  tooltipBoxSpring: TOOLTIP_BOX_SPRING,
  highlightSpring: HIGHLIGHT_SPRING,
};

const ChartConfigContext = createContext<ChartConfigValue | null>(null);

export interface ChartConfigProviderProps {
  value?: Partial<ChartConfigValue>;
  children: ReactNode;
}

export function ChartConfigProvider({
  value,
  children,
}: ChartConfigProviderProps) {
  const merged = useMemo<ChartConfigValue>(
    () => ({
      ...DEFAULT_CHART_CONFIG,
      ...value,
    }),
    [value]
  );

  return (
    <ChartConfigContext.Provider value={merged}>
      {children}
    </ChartConfigContext.Provider>
  );
}

export function useChartConfig(): ChartConfigValue {
  return useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;
}

const DEFAULT_TOOLTIP_BOX_DAMPING =
  DEFAULT_CHART_CONFIG.tooltipBoxSpring.damping;

/** Maps a damping slider to the floating tooltip panel follow spring. `0` = instant. */
export function resolveTooltipBoxMotion(damping?: number): {
  animate: boolean;
  springConfig: SpringConfig;
} {
  if (damping === 0) {
    return {
      animate: false,
      springConfig: DEFAULT_CHART_CONFIG.tooltipBoxSpring,
    };
  }

  const effectiveDamping = damping ?? DEFAULT_TOOLTIP_BOX_DAMPING;
  let stiffness = DEFAULT_CHART_CONFIG.tooltipBoxSpring.stiffness;

  if (effectiveDamping < DEFAULT_TOOLTIP_BOX_DAMPING) {
    const t =
      (DEFAULT_TOOLTIP_BOX_DAMPING - effectiveDamping) /
      DEFAULT_TOOLTIP_BOX_DAMPING;
    stiffness += t * 400;
  } else if (effectiveDamping > DEFAULT_TOOLTIP_BOX_DAMPING) {
    const t =
      (effectiveDamping - DEFAULT_TOOLTIP_BOX_DAMPING) /
      (100 - DEFAULT_TOOLTIP_BOX_DAMPING);
    stiffness -= t * 85;
  }

  return {
    animate: true,
    springConfig: {
      stiffness: Math.max(12, Math.round(stiffness)),
      damping: effectiveDamping,
    },
  };
}
