"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import type { HeatmapLinearScale, HeatmapTimeScale } from "./scales";
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

/** Cell layout of the chart: `"fluid"` sizes square cells to the width, `"fill"` expands cells to the parent. */
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

/** Values the chart shares with its sub-components, as returned by `useHeatmap`. */
interface HeatmapContextValue {
  /** The week columns being drawn, after `xDomain` filtering and `weekStartDay` rotation. */
  readonly data: HeatmapColumn[];
  /** Cell width in pixels. */
  readonly binWidth: number;
  /** Cell height in pixels (cells are square, so equal to `binWidth`). */
  readonly binHeight: number;
  /** Gap between cells in pixels. */
  readonly gap: number;
  /** Resolved chart margins in pixels. */
  readonly margin: HeatmapMargin;
  /** Total chart width in pixels. */
  readonly width: number;
  /** Total chart height in pixels. */
  readonly height: number;
  /** Always `undefined`; kept for bklit compatibility. */
  readonly fixedWidth?: number | undefined;
  /** Plot width in pixels (the grid, separator gutters included). */
  readonly innerWidth: number;
  /** Plot height in pixels. */
  readonly innerHeight: number;
  /** Number of week columns drawn. */
  readonly columnCount?: number;
  /** Number of rows per column (7 for a week). */
  readonly rowCount?: number;
  /** Where column separators sit, or `null` when none are configured. */
  readonly separatorLayout: HeatmapSeparatorLayout | null;
  /** Left edge of a column in plot pixels, separator gutters included. */
  readonly xScale: (columnIndex: number) => number;
  /** Top edge of a row in plot pixels. */
  readonly yScale: (rowIndex: number) => number;
  /** Data extent (first column start to last column end) mapped onto the plot width. */
  readonly timeXScale: HeatmapTimeScale;
  /** Unit domain mapped onto the plot height, for overlays that need a vertical scale. */
  readonly brushYScale: HeatmapLinearScale;
  /** Ref to the chart container element. */
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** Whether the chart is large enough to draw. */
  readonly isReady: boolean;
  /** The resolved five level styles. */
  readonly levelStyles: HeatmapLevelStyles;
  /** Maps a count to the cell color for its level. */
  readonly colorScale: (count: number | null | undefined) => string;
  /** Maps a count to the cell fill, which is a `url(#...)` pattern reference for pattern levels and the color otherwise. */
  readonly fillScale: (count: number | null | undefined) => string;
  /** Whether a custom `colorScale` was passed to the chart. */
  readonly hasCustomColorScale?: boolean;
  /** Resolved first row of the grid (`0` Sunday to `6` Saturday). */
  readonly weekStartDay: HeatmapWeekStartDay;
  /** Current data status (`"loading"`, `"ready"` or `"error"`). */
  readonly chartStatus: ChartStatus;
  /** Coarse phase of the chart: `"loading"` while loading, `"ready"` otherwise. */
  readonly chartPhase: ChartPhase;
  /** `true` once the status is no longer `"loading"`. */
  readonly isLoaded: boolean;
  /** Number derived from `revealSignature`; changes when the entrance is replayed. */
  readonly revealEpoch: number;
  /** Enter animation duration in milliseconds. */
  readonly animationDuration: number;
  /** Enter transition in use. */
  readonly enterTransition?: HeatmapEnterTransition;
  /** Scale applied to the wave stagger between cells. */
  readonly enterStaggerScale: number;
  /** Whether cells animate in (`animate` is on and `animationDuration` is above `0`). */
  readonly animateCells: boolean;
  /** Chart opacity while loading. */
  readonly loadingOpacity: number;
  /** Whether skeleton cells show while loading. */
  readonly showLoadingCells: boolean;
  /** Highest opacity of the loading cells. */
  readonly loadingCellMaxOpacity: number;
  /** Share of cells that take part in the loading shimmer. */
  readonly loadingCellRandomness: number;
  /** Always `null`; kept for bklit compatibility. */
  readonly revealMode: HeatmapRevealMode;
  /** Centered label shown while loading. */
  readonly loadingLabel?: string;
  /** Whether the loading label is visible. */
  readonly showLoadingLabel: boolean;
  /** Accessible description of the chart. */
  readonly ariaDescription?: string | undefined;
  /** Accessible name of the chart. */
  readonly ariaLabel?: string | undefined;
  /** Which rows get a weekday label (from `HeatmapYAxis`). */
  readonly yTickFilter?: HeatmapYAxisTickFilter;
  /** Weekday label format (from `HeatmapYAxis`). */
  readonly yLabelFormat?: HeatmapYAxisLabelFormat;
  /** Per-row label opacity (from `HeatmapYAxis`). */
  readonly yRowOpacity?: number | readonly number[] | undefined;
  /** Resolved `HeatmapTooltip` settings, or `null` when no tooltip child is present. */
  readonly tooltip?: HeatmapTooltipConfig | null;
  /** Resolved `HeatmapSeparator` style, or `null` when no separator child is present. */
  readonly separator?: HeatmapSeparatorStyle | null;
}

const HeatmapContext = createContext<HeatmapContextValue | undefined>(undefined);

/** Reads the chart's layout, scales and settings. Must be called inside `HeatmapChart`; it throws otherwise. */
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

/**
 * Shares hover state between a `HeatmapChart` and a `HeatmapLegend` rendered outside it, so hovering a legend level dims the cells of that level.
 * `HeatmapChart` provides one on its own when none surrounds it; add this only to link a separate legend.
 */
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

/**
 * Wrapper element that clears the legend hover when the pointer leaves it. Place it inside `HeatmapInteractionProvider` around the chart and the legend.
 */
// The hovered cell and tooltip mirror the renderer's focus (`onFocusChange`), which drops a pointer-owned
// focus on leave and keeps a keyboard-held one until blur, so leave never clears them here.
// The legend swatches live outside the chart surface, hence the legend level is cleared here.
const HeatmapInteractionBoundary = ({ children, className, style }: Readonly<HeatmapInteractionBoundaryProps>): ReactElement => {
  const coordinator = useHeatmapCoordinator();
  const handlePointerLeave = useCallback((): void => { coordinator.setHoveredLegendLevel(null); }, [coordinator]);
  return (
    <div className={className} style={style} onPointerLeave={handlePointerLeave}>
      {children}
    </div>
  );
};

/** @internal */
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
