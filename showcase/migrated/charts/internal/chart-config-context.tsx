import { createContext } from 'react';
import type { ReactNode } from 'react';
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

export { ChartConfigContext, DEFAULT_CHART_CONFIG };
export type { SpringConfig, ChartConfigValue, ChartConfigProviderProps };
