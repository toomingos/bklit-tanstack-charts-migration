import { createContext, useContext, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  HIGHLIGHT_SPRING,
  TOOLTIP_BOX_SPRING,
  TOOLTIP_SPRING,
} from "./design-tokens";

interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
}

interface ChartConfigValue {
  readonly tooltipSpring: SpringConfig;
  readonly tooltipBoxSpring: SpringConfig;
  readonly highlightSpring: SpringConfig;
}

const DEFAULT_CHART_CONFIG: ChartConfigValue = {
  highlightSpring: HIGHLIGHT_SPRING,
  tooltipBoxSpring: TOOLTIP_BOX_SPRING,
  tooltipSpring: TOOLTIP_SPRING,
};

const ChartConfigContext = createContext<ChartConfigValue | undefined>(undefined);

interface ChartConfigProviderProps {
  readonly value?: Partial<ChartConfigValue>;
  readonly children: ReactNode;
}

const ChartConfigProvider = ({
  value,
  children,
}: Readonly<ChartConfigProviderProps>): ReactElement => {
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
};

const useChartConfig = (): ChartConfigValue => useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;


const DEFAULT_TOOLTIP_BOX_DAMPING =
  DEFAULT_CHART_CONFIG.tooltipBoxSpring.damping;

// Stiffness added when the damping slider goes fully instant (0).
const TOOLTIP_BOX_STIFFEN_RANGE = 400;
// Damping slider is a 0-100 percent scale; values above default soften the spring.
const DAMPING_PERCENT_MAX = 100;
// Stiffness removed when the damping slider goes fully loose (100).
const TOOLTIP_BOX_SOFTEN_RANGE = 85;
// Floor for the resolved tooltip-box stiffness (avoids a floppy/NaN spring).
const TOOLTIP_BOX_MIN_STIFFNESS = 12;

interface TooltipBoxMotion {
  readonly animate: boolean;
  readonly springConfig: SpringConfig;
}

/** Maps a damping slider to the floating tooltip panel follow spring. `0` = instant. */
const resolveTooltipBoxMotion = (damping?: number): TooltipBoxMotion => {
  if (damping === 0) {
    return {
      animate: false,
      springConfig: DEFAULT_CHART_CONFIG.tooltipBoxSpring,
    };
  }

  const effectiveDamping = damping ?? DEFAULT_TOOLTIP_BOX_DAMPING;
  let {stiffness} = DEFAULT_CHART_CONFIG.tooltipBoxSpring;

  if (effectiveDamping < DEFAULT_TOOLTIP_BOX_DAMPING) {
    const stiffenRatio =
      (DEFAULT_TOOLTIP_BOX_DAMPING - effectiveDamping) /
      DEFAULT_TOOLTIP_BOX_DAMPING;
    stiffness += stiffenRatio * TOOLTIP_BOX_STIFFEN_RANGE;
  } else if (effectiveDamping > DEFAULT_TOOLTIP_BOX_DAMPING) {
    const softenRatio =
      (effectiveDamping - DEFAULT_TOOLTIP_BOX_DAMPING) /
      (DAMPING_PERCENT_MAX - DEFAULT_TOOLTIP_BOX_DAMPING);
    stiffness -= softenRatio * TOOLTIP_BOX_SOFTEN_RANGE;
  } else {
    // At the default damping no stiffness adjustment is needed.
  }

  const springConfig: SpringConfig = {
    damping: effectiveDamping,
    stiffness: Math.max(TOOLTIP_BOX_MIN_STIFFNESS, Math.round(stiffness)),
  };
  return { animate: true, springConfig };
}

export { DEFAULT_CHART_CONFIG, ChartConfigProvider, useChartConfig, resolveTooltipBoxMotion };
export type { SpringConfig, ChartConfigValue, ChartConfigProviderProps, TooltipBoxMotion };
