import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { HeatmapChartPhase, HeatmapRevealMode } from "./heatmap-lifecycle";
import type {
  HeatmapColumn,
  HeatmapWeekStartDay,
  HeatmapSeparatorLayout,
} from "./heatmap-utils";
import type {
  HeatmapLevelStyles,
} from "./heatmap-colors";
import type { HeatmapEnterTransition } from "./heatmap-animation";
import type { ChartStatus } from "./types";

interface HeatmapMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type HeatmapLayout = "fluid" | "fill";

const DEFAULT_MARGIN: HeatmapMargin = { bottom: 0, left: 40, right: 16, top: 28 };

interface HeatmapContextValue {
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
  timeXScale: (date: Readonly<Date>) => number;
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

const HeatmapContext = createContext<HeatmapContextValue | undefined>(undefined);

const useHeatmap = (): HeatmapContextValue => {
  const ctx = useContext(HeatmapContext);
  if (!ctx) {throw new Error("Heatmap.* components must be rendered inside <HeatmapChart>.");}
  return ctx;
}

export { DEFAULT_MARGIN, HeatmapContext, useHeatmap };
export type { HeatmapMargin, HeatmapLayout, HeatmapContextValue };
