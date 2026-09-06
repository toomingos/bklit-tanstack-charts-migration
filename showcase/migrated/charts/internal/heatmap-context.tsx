import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createBroadcastStore } from "./broadcast-store";
import type { HeatmapEnterTransition, HeatmapRevealMode } from "./heatmap-lifecycle";
import type { ChartPhase } from "./chart-phase";
import type {
  HeatmapColumn,
  HeatmapWeekStartDay,
  HeatmapSeparatorLayout,
  HeatmapYAxisLabelFormat,
  HeatmapYAxisTickFilter,
} from "./heatmap-utils";
import type {
  HeatmapLevelStyles,
} from "./heatmap-colors";
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
  readonly width: number;
  readonly height: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly columnCount?: number;
  readonly rowCount?: number;
  readonly separatorLayout: HeatmapSeparatorLayout | null;
  readonly isReady: boolean;
  readonly levelStyles: HeatmapLevelStyles;
  readonly colorScale: (count: number | null | undefined) => string;
  readonly fillScale: (count: number | null | undefined) => string;
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
  readonly loadingLabel: string | undefined;
  readonly showLoadingLabel: boolean;
  readonly ariaDescription?: string | undefined;
  readonly ariaLabel?: string | undefined;
  readonly yTickFilter?: HeatmapYAxisTickFilter;
  readonly yLabelFormat?: HeatmapYAxisLabelFormat;
  readonly yRowOpacity?: number | readonly number[] | undefined;
  readonly reportWidth?: ((width: number) => void) | undefined;
}

const HeatmapContext = createContext<HeatmapContextValue | undefined>(undefined);

const useHeatmap = (): HeatmapContextValue => {
  const ctx = useContext(HeatmapContext);
  if (!ctx) {throw new Error("Heatmap.* components must be rendered inside <HeatmapChart>.");}
  return ctx;
}

// Hover state broadcasts imperatively to subscribers instead of living in React state, so a pointermove
// Repaints only the affected cell/swatch/tooltip rather than re-rendering the whole grid (up to 364 cells).
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

interface HeatmapHoverCoordinator {
  readonly getHoveredCell: () => HeatmapHoveredCell | null
  readonly getHoveredLegendLevel: () => number | null
  readonly getTooltipData: () => HeatmapTooltipData | null
  readonly setHoveredCell: (cell: HeatmapHoveredCell | null) => void
  readonly setHoveredLegendLevel: (level: number | null) => void
  readonly setTooltipData: (data: HeatmapTooltipData | null) => void
  /** Clears all state in a single broadcast, e.g. on pointer-leaving the chart surface. */
  readonly clearInteraction: () => void
  /** Subscribes a listener; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void
}

// Cell equality: same reference, or same grid position in a later broadcast.
const areHeatmapCellsEqual = (prev: HeatmapHoveredCell | null, next: HeatmapHoveredCell | null): boolean => {
  if (prev === next) {return true;}
  if (prev === null || next === null) {return false;}
  return prev.column === next.column && prev.row === next.row;
}

// Tooltip equality: same reference, or same cell and count (position is render-only).
const areTooltipDataEqual = (prev: HeatmapTooltipData | null, next: HeatmapTooltipData | null): boolean => {
  if (prev === next) {return true;}
  if (prev === null || next === null) {return false;}
  return prev.column === next.column && prev.row === next.row && prev.count === next.count;
}

const createHeatmapHoverCoordinator = (): HeatmapHoverCoordinator => {
  // Separate stores per field; clearInteraction writes all three silently then notifies once.
  const cells = createBroadcastStore<HeatmapHoveredCell | null>({
    equals: areHeatmapCellsEqual,
    initial: null,
  });
  const legend = createBroadcastStore<number | null>({ equals: (prev, next) => prev === next, initial: null });
  const tooltip = createBroadcastStore<HeatmapTooltipData | null>({
    equals: areTooltipDataEqual,
    initial: null,
  });
  return {
    clearInteraction() {
      if (cells.get() === null && legend.get() === null && tooltip.get() === null) {return;}
      cells.setSilent(null);
      legend.setSilent(null);
      tooltip.setSilent(null);
      cells.notify();
    },
    getHoveredCell: () => cells.get(),
    getHoveredLegendLevel: () => legend.get(),
    getTooltipData: () => tooltip.get(),
    setHoveredCell(cell) {
      cells.set(cell);
    },
    setHoveredLegendLevel(level) {
      legend.set(level);
    },
    setTooltipData(data) {
      tooltip.set(data);
    },
    subscribe(listener) {
      const unsubs = [cells.subscribe(listener), legend.subscribe(listener), tooltip.subscribe(listener)];
      return () => {
        for (const unsub of unsubs) {unsub();}
      };
    },
  };
}

interface HeatmapHoverStyleParams {
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

const HeatmapInteractionContext = createContext<HeatmapHoverCoordinator | null>(null);

type HeatmapTooltipDataUpdater = (prev: HeatmapTooltipData | null) => HeatmapTooltipData | null;

type HeatmapTooltipDataValue = HeatmapTooltipData | null | HeatmapTooltipDataUpdater;

const isTooltipDataUpdater = (value: HeatmapTooltipDataValue): value is HeatmapTooltipDataUpdater => typeof value === "function";

const useHeatmapCoordinatorOptional = (): HeatmapHoverCoordinator | null => useContext(HeatmapInteractionContext);

const useHeatmapCoordinator = (): HeatmapHoverCoordinator => {
  const coordinator = useHeatmapCoordinatorOptional();
  if (!coordinator) {
    throw new Error("Heatmap interaction components must be rendered inside <HeatmapInteractionProvider> (HeatmapChart provides one automatically).");
  }
  return coordinator;
}

interface HeatmapInteractionContextValue {
  readonly hoveredCell: HeatmapHoveredCell | null;
  readonly hoveredLegendLevel: number | null;
  readonly tooltipData: HeatmapTooltipData | null;
  readonly setHoveredCell: (cell: HeatmapHoveredCell | null) => void;
  readonly setHoveredLegendLevel: (level: number | null) => void;
  readonly setTooltipData: (data: HeatmapTooltipData | null | ((prev: HeatmapTooltipData | null) => HeatmapTooltipData | null)) => void;
  readonly clearInteraction: () => void;
}

const useHeatmapInteractionOptional = (): HeatmapInteractionContextValue | null => {
  const coordinator = useHeatmapCoordinatorOptional();
  const hoveredCell = useSyncExternalStore(
    coordinator ? coordinator.subscribe : (): () => void => (): void => {
      // No coordinator: nothing to unsubscribe.
    },
    () => coordinator?.getHoveredCell() ?? null,
    () => null,
  );
  const hoveredLegendLevel = useSyncExternalStore(
    coordinator ? coordinator.subscribe : (): () => void => (): void => {
      // No coordinator: nothing to unsubscribe.
    },
    () => coordinator?.getHoveredLegendLevel() ?? null,
    () => null,
  );
  const tooltipData = useSyncExternalStore(
    coordinator ? coordinator.subscribe : (): () => void => (): void => {
      // No coordinator: nothing to unsubscribe.
    },
    () => coordinator?.getTooltipData() ?? null,
    () => null,
  );
  return useMemo<HeatmapInteractionContextValue | null>(() => {
    if (!coordinator) {return null;}
    return {
      clearInteraction: () =>{  coordinator.clearInteraction(); },
      hoveredCell,
      hoveredLegendLevel,
      setHoveredCell: (cell) =>{  coordinator.setHoveredCell(cell); },
      setHoveredLegendLevel: (level) =>{  coordinator.setHoveredLegendLevel(level); },
      setTooltipData: (data) => {
        const resolved = isTooltipDataUpdater(data) ? data(coordinator.getTooltipData()) : data;
        coordinator.setTooltipData(resolved);
      },
      tooltipData,
    };
  }, [coordinator, hoveredCell, hoveredLegendLevel, tooltipData]);
}

const useHeatmapInteraction = (): HeatmapInteractionContextValue => {
  const value = useHeatmapInteractionOptional();
  if (!value) {
    throw new Error("useHeatmapInteraction must be used within a HeatmapInteractionProvider (HeatmapChart provides one automatically).");
  }
  return value;
}

interface HeatmapInteractionProviderProps {
  readonly children: ReactNode;
  readonly coordinator?: HeatmapHoverCoordinator;
}

const HeatmapInteractionProvider = ({ children, coordinator }: Readonly<HeatmapInteractionProviderProps>): ReactElement => {
  // Owned coordinator is memoized, never a ref, because its identity is read during render.
  const ownCoordinator = useMemo(() => createHeatmapHoverCoordinator(), []);
  const resolved = coordinator ?? ownCoordinator;
  return <HeatmapInteractionContext.Provider value={resolved}>{children}</HeatmapInteractionContext.Provider>;
};

interface HeatmapInteractionBoundaryProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

const HeatmapInteractionBoundary = ({ children, className, style }: Readonly<HeatmapInteractionBoundaryProps>): ReactElement => {
  const coordinator = useHeatmapCoordinator();
  const handlePointerLeave = useCallback((): void => { coordinator.clearInteraction(); }, [coordinator]);
  return (
    <div
      className={className}
      style={style}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  );
};

interface HeatmapInteractionRootProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly coordinator?: HeatmapHoverCoordinator;
}

const HeatmapInteractionRoot = ({ children, className, style, coordinator }: Readonly<HeatmapInteractionRootProps>): ReactElement => (
    <HeatmapInteractionProvider coordinator={coordinator}>
      <HeatmapInteractionBoundary className={className} style={style}>
        {children}
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
);

const HeatmapProvider = ({ children, value }: { readonly children: ReactNode; readonly value: HeatmapContextValue }): ReactElement => (
  <HeatmapContext.Provider value={value}>{children}</HeatmapContext.Provider>
);

export {
  DEFAULT_MARGIN,
  HEATMAP_INACTIVE_OPACITY,
  HEATMAP_INACTIVE_TRANSITION_CSS,
  HeatmapContext,
  HeatmapInteractionBoundary,
  HeatmapInteractionContext,
  HeatmapInteractionProvider,
  HeatmapInteractionRoot,
  HeatmapProvider,
  createHeatmapHoverCoordinator,
  useHeatmap,
  useHeatmapCoordinator,
  useHeatmapCoordinatorOptional,
  useHeatmapInteraction,
  useHeatmapInteractionOptional,
};
export type {
  HeatmapContextValue,
  HeatmapHoveredCell,
  HeatmapHoverCoordinator,
  HeatmapHoverStyleParams,
  HeatmapInteractionBoundaryProps,
  HeatmapInteractionContextValue,
  HeatmapInteractionProviderProps,
  HeatmapInteractionRootProps,
  HeatmapLayout,
  HeatmapMargin,
  HeatmapTooltipData,
};
