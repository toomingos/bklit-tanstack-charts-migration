import { createContext, useContext, type RefObject } from "react";
import type { HeatmapChartPhase, HeatmapRevealMode } from "./heatmap-lifecycle";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import type {
  HeatmapColumn,
  HeatmapColumnSeparatorsConfig,
  HeatmapWeekStartDay,
  HeatmapSeparatorLayout,
} from "./heatmap-utils";
import type {
  HeatmapLevelStyle,
  HeatmapLevelStyles,
} from "./heatmap-colors";
import type { HeatmapEnterTransition } from "./heatmap-animation";
import type { ChartStatus } from "./types";

export interface HeatmapMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type HeatmapLayout = "fluid" | "fill";

export const DEFAULT_MARGIN: HeatmapMargin = { top: 28, right: 16, bottom: 0, left: 40 };

export interface HeatmapContextValue {
  data: HeatmapColumn[];
  binWidth: number;
  binHeight: number;
  gap: number;
  margin: HeatmapMargin;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  xScale: (columnIndex: number) => number;
  yScale: (rowIndex: number) => number;
  separatorLayout: HeatmapSeparatorLayout | null;
  timeXScale: (date: Date) => number;
  brushYScale: (value: number) => number;
  isReady: boolean;
  levelStyles: HeatmapLevelStyles;
  colorScale: (count: number) => string;
  fillScale: (count: number) => string;
  weekStartDay: HeatmapWeekStartDay;
  chartStatus: ChartStatus;
  chartPhase: HeatmapChartPhase;
  isLoaded: boolean;
  revealEpoch: number;
  animationDuration: number;
  enterTransition: HeatmapEnterTransition | undefined;
  enterStaggerScale: number;
  animateCells: boolean;
  loadingOpacity: number;
  showLoadingCells: boolean;
  loadingCellMaxOpacity: number;
  loadingCellRandomness: number;
  revealMode: HeatmapRevealMode;
  loadingLabel: string | undefined;
  showLoadingLabel: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  htmlLayerEl: HTMLDivElement | null;
}

export const HeatmapContext = createContext<HeatmapContextValue | null>(null);

export function useHeatmap(): HeatmapContextValue {
  const ctx = useContext(HeatmapContext);
  if (!ctx) throw new Error("Heatmap.* components must be rendered inside <HeatmapChart>.");
  return ctx;
}
