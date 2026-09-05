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
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

type HeatmapLayout = "fluid" | "fill";

const DEFAULT_MARGIN: HeatmapMargin = { bottom: 0, left: 40, right: 16, top: 28 };

interface HeatmapContextValue {
  readonly data: HeatmapColumn[];
  readonly binWidth: number;
  readonly binHeight: number;
  readonly gap: number;
  readonly margin: HeatmapMargin;
  width: number;
  height: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly xScale: (columnIndex: number) => number;
  readonly yScale: (rowIndex: number) => number;
  readonly separatorLayout: HeatmapSeparatorLayout | null;
  readonly timeXScale: (date: Readonly<Date>) => number;
  readonly brushYScale: (value: number) => number;
  readonly isReady: boolean;
  readonly levelStyles: HeatmapLevelStyles;
  readonly colorScale: (count: number) => string;
  readonly fillScale: (count: number) => string;
  readonly weekStartDay: HeatmapWeekStartDay;
  readonly chartStatus: ChartStatus;
  readonly chartPhase: HeatmapChartPhase;
  readonly isLoaded: boolean;
  readonly revealEpoch: number;
  readonly animationDuration: number;
  readonly enterTransition: HeatmapEnterTransition | undefined;
  readonly enterStaggerScale: number;
  readonly animateCells: boolean;
  readonly loadingOpacity: number;
  readonly showLoadingCells: boolean;
  readonly loadingCellMaxOpacity: number;
  readonly loadingCellRandomness: number;
  readonly revealMode: HeatmapRevealMode;
  readonly loadingLabel: string | undefined;
  readonly showLoadingLabel: boolean;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly htmlLayerEl: HTMLDivElement | null;
  readonly ariaDescription: string | undefined;
  readonly ariaLabel: string | undefined;
}

const HeatmapContext = createContext<HeatmapContextValue | undefined>(undefined);

const useHeatmap = (): HeatmapContextValue => {
  const ctx = useContext(HeatmapContext);
  if (!ctx) {throw new Error("Heatmap.* components must be rendered inside <HeatmapChart>.");}
  return ctx;
}

export { DEFAULT_MARGIN, HeatmapContext, useHeatmap };
export type { HeatmapMargin, HeatmapLayout, HeatmapContextValue };
