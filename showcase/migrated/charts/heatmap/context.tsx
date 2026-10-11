import { createContext, useCallback, useContext, useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import type { ScaleLinear, ScaleTime } from "d3-scale";
import type { ChartPhase } from "../kit/motion/phase";
import type { HeatmapEnterTransition, HeatmapRevealMode } from "./motion";
import type { HeatmapLevelStyles } from "./colors";
import type { HeatmapColumn } from "./columns";
import type { HeatmapWeekStartDay, HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter } from "./day-labels";
import type { HeatmapSeparatorLayout, HeatmapSeparatorGradient, HeatmapSeparatorStrokeStyle } from "./separators";

type ChartStatus = "loading" | "ready" | "error";

interface HeatmapMargin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

type HeatmapLayout = "fluid" | "fill";

const DEFAULT_MARGIN: HeatmapMargin = { bottom: 0, left: 40, right: 16, top: 28 };

/** Config published by a `<HeatmapTooltip>` child (read by scanning the chart's children). */
interface HeatmapTooltipConfig {
  readonly formatLabel: (count: number, date: Readonly<Date>) => string;
  readonly className: string;
  readonly panelStyle?: Readonly<CSSProperties>;
  readonly backgroundColor?: string;
  /** Maps to native `tooltip.motion: false` (no entry/move/exit motion). */
  readonly instant: boolean;
  /** bklit useDelayedTooltipData showDelay (ms, default 0): first-hover delay, applied by fixed CSS off a host var. */
  readonly showDelay: number;
  /** bklit hideDelay (ms, default 120): hold after leaving a cell. */
  readonly hideDelay: number;
}

/** Config published by a `<HeatmapSeparator>` child. */
interface HeatmapSeparatorStyle {
  readonly strokeStyle?: HeatmapSeparatorStrokeStyle;
  readonly strokeDasharray?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeOpacity?: number;
  readonly gradient?: Readonly<HeatmapSeparatorGradient>;
  readonly paddingY?: number;
  readonly startOffset?: number;
  readonly showLabels?: boolean;
  readonly labelOffset?: number;
  readonly labelFormat?: (quarter: number, startDate: Readonly<Date>) => string;
  readonly labelClassName?: string;
}

interface HeatmapYAxisConfig {
  readonly tickFilter: HeatmapYAxisTickFilter;
  readonly labelFormat: HeatmapYAxisLabelFormat;
  readonly rowOpacity: number | readonly number[] | undefined;
}

interface HeatmapContextValue {
  readonly data: HeatmapColumn[];
  readonly binWidth: number;
  readonly binHeight: number;
  readonly gap: number;
  readonly margin: HeatmapMargin;
  readonly width: number;
  readonly height: number;
  readonly fixedWidth?: number | undefined;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly columnCount?: number;
  readonly rowCount?: number;
  readonly separatorLayout: HeatmapSeparatorLayout | null;
  /** Left edge of a column in plot pixels, separator gutters included. */
  readonly xScale: (columnIndex: number) => number;
  /** Top edge of a row in plot pixels. */
  readonly yScale: (rowIndex: number) => number;
  /** Data extent (first column start to last column end) mapped onto the plot width. */
  readonly timeXScale: ScaleTime<number, number>;
  /** Unit domain mapped onto the plot height, for overlays that need a vertical scale. */
  readonly brushYScale: ScaleLinear<number, number>;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly isReady: boolean;
  readonly levelStyles: HeatmapLevelStyles;
  readonly colorScale: (count: number | null | undefined) => string;
  readonly fillScale: (count: number | null | undefined) => string;
  readonly hasCustomColorScale?: boolean;
  readonly weekStartDay: HeatmapWeekStartDay;
  readonly chartStatus: ChartStatus;
  readonly chartPhase: ChartPhase;
  readonly isLoaded: boolean;
  readonly revealEpoch: number;
  readonly animationDuration: number;
  readonly enterTransition?: HeatmapEnterTransition;
  readonly enterStaggerScale: number;
  readonly animateCells: boolean;
  readonly loadingOpacity: number;
  readonly showLoadingCells: boolean;
  readonly loadingCellMaxOpacity: number;
  readonly loadingCellRandomness: number;
  readonly revealMode: HeatmapRevealMode;
  readonly loadingLabel?: string;
  readonly showLoadingLabel: boolean;
  readonly ariaDescription?: string | undefined;
  readonly ariaLabel?: string | undefined;
  readonly yTickFilter?: HeatmapYAxisTickFilter;
  readonly yLabelFormat?: HeatmapYAxisLabelFormat;
  readonly yRowOpacity?: number | readonly number[] | undefined;
  readonly tooltip?: HeatmapTooltipConfig | null;
  readonly separator?: HeatmapSeparatorStyle | null;
}

const HeatmapContext = createContext<HeatmapContextValue | undefined>(undefined);

const useHeatmap = (): HeatmapContextValue => {
  const ctx = useContext(HeatmapContext);
  if (!ctx) {throw new Error("Heatmap.* components must be rendered inside <HeatmapChart>.");}
  return ctx;
};

const HEATMAP_INACTIVE_OPACITY = 0.3;
const HEATMAP_INACTIVE_TRANSITION_CSS = "0.22s cubic-bezier(0.4, 0, 0.2, 1)";

interface HeatmapHoveredCell {
  readonly column: number;
  readonly row: number;
}

interface HeatmapTooltipData {
  readonly column: number;
  readonly row: number;
  readonly count: number;
  readonly date: Readonly<Date>;
  readonly x: number;
  readonly y: number;
}

interface HeatmapInteractionState {
  readonly hoveredCell: HeatmapHoveredCell | null;
  readonly hoveredLegendLevel: number | null;
  readonly tooltipData: HeatmapTooltipData | null;
}

const EMPTY_INTERACTION: HeatmapInteractionState = { hoveredCell: null, hoveredLegendLevel: null, tooltipData: null };

/* Shared, React-agnostic interaction store: bklit's hovered-cell / hovered-legend-level / tooltip-data state between the chart (cell focus via `onFocusChange`) and the legend (level).
 * No DOM or timer work; the chart reads the level through `useHeatmapLegendLevel` and paints it with ordinary mark props. */
interface HeatmapHoverCoordinator {
  readonly getSnapshot: () => HeatmapInteractionState;
  readonly getHoveredCell: () => HeatmapHoveredCell | null;
  readonly getHoveredLegendLevel: () => number | null;
  readonly getTooltipData: () => HeatmapTooltipData | null;
  readonly setHoveredCell: (cell: HeatmapHoveredCell | null) => void;
  readonly setHoveredLegendLevel: (level: number | null) => void;
  readonly setTooltipData: (data: HeatmapTooltipData | null) => void;
  /** Clears all state in a single broadcast, e.g. on pointer-leaving the chart surface. */
  readonly clearInteraction: () => void;
  /** Subscribes a listener; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

const sameGridPosition = (prev: HeatmapHoveredCell, next: HeatmapHoveredCell): boolean => prev.column === next.column && prev.row === next.row;

const sameCell = (prev: HeatmapHoveredCell | null, next: HeatmapHoveredCell | null): boolean =>
  prev === next || (prev !== null && next !== null && sameGridPosition(prev, next));

const sameTooltipData = (prev: HeatmapTooltipData, next: HeatmapTooltipData): boolean => sameGridPosition(prev, next) && prev.count === next.count;

const sameTooltip = (prev: HeatmapTooltipData | null, next: HeatmapTooltipData | null): boolean =>
  prev === next || (prev !== null && next !== null && sameTooltipData(prev, next));

const isBlank = (state: HeatmapInteractionState): boolean => state.hoveredCell === null && state.hoveredLegendLevel === null && state.tooltipData === null;

const createHeatmapHoverCoordinator = (): HeatmapHoverCoordinator => {
  let state = EMPTY_INTERACTION;
  const listeners = new Set<() => void>();
  const commit = (next: HeatmapInteractionState): void => {
    if (next === state) {return;}
    state = next;
    for (const listener of listeners) {listener();}
  };
  return {
    clearInteraction: () => { commit(state === EMPTY_INTERACTION || isBlank(state) ? state : EMPTY_INTERACTION); },
    getHoveredCell: () => state.hoveredCell,
    getHoveredLegendLevel: () => state.hoveredLegendLevel,
    getSnapshot: () => state,
    getTooltipData: () => state.tooltipData,
    setHoveredCell: (cell) => { commit(sameCell(state.hoveredCell, cell) ? state : { ...state, hoveredCell: cell }); },
    setHoveredLegendLevel: (level) => { commit(state.hoveredLegendLevel === level ? state : { ...state, hoveredLegendLevel: level }); },
    setTooltipData: (data) => { commit(sameTooltip(state.tooltipData, data) ? state : { ...state, tooltipData: data }); },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
};

interface HeatmapHoverStyleParams {
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

const HeatmapInteractionContext = createContext<HeatmapHoverCoordinator | null>(null);

const useHeatmapCoordinatorOptional = (): HeatmapHoverCoordinator | null => useContext(HeatmapInteractionContext);

const useHeatmapCoordinator = (): HeatmapHoverCoordinator => {
  const coordinator = useHeatmapCoordinatorOptional();
  if (!coordinator) {
    throw new Error("Heatmap interaction components must be rendered inside <HeatmapInteractionProvider> (HeatmapChart provides one automatically).");
  }
  return coordinator;
};

interface HeatmapInteractionProviderProps {
  readonly children: ReactNode;
  readonly coordinator?: HeatmapHoverCoordinator;
}

const HeatmapInteractionProvider = ({ children, coordinator }: Readonly<HeatmapInteractionProviderProps>): ReactElement => {
  const ownCoordinator = useMemo(() => createHeatmapHoverCoordinator(), []);
  const resolved = coordinator ?? ownCoordinator;
  return <HeatmapInteractionContext.Provider value={resolved}>{children}</HeatmapInteractionContext.Provider>;
};

interface HeatmapInteractionBoundaryProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** Pointer-leave clears the legend hover (swatches live outside the chart surface). The hovered cell and tooltip mirror the renderer's focus (`onFocusChange`), which drops a pointer-owned
 * focus on leave and keeps a keyboard-held one until blur, so leave never clears them here. */
const HeatmapInteractionBoundary = ({ children, className, style }: Readonly<HeatmapInteractionBoundaryProps>): ReactElement => {
  const coordinator = useHeatmapCoordinator();
  const handlePointerLeave = useCallback((): void => { coordinator.setHoveredLegendLevel(null); }, [coordinator]);
  return (
    <div className={className} style={style} onPointerLeave={handlePointerLeave}>
      {children}
    </div>
  );
};

const HeatmapProvider = ({ children, value }: { readonly children: ReactNode; readonly value: HeatmapContextValue }): ReactElement => (
  <HeatmapContext.Provider value={value}>{children}</HeatmapContext.Provider>
);

export {
  DEFAULT_MARGIN,
  HEATMAP_INACTIVE_OPACITY,
  HEATMAP_INACTIVE_TRANSITION_CSS,
  HeatmapContext,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapProvider,
  createHeatmapHoverCoordinator,
  useHeatmap,
  useHeatmapCoordinatorOptional,
};
export type {
  ChartStatus,
  HeatmapContextValue,
  HeatmapHoverCoordinator,
  HeatmapHoverStyleParams,
  HeatmapLayout,
  HeatmapMargin,
  HeatmapSeparatorStyle,
  HeatmapTooltipConfig,
  HeatmapYAxisConfig,
};
