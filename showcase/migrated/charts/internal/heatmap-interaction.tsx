import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { createHeatmapHoverCoordinator } from './heatmap-hover-chrome';
import type { HeatmapHoverCoordinator, HeatmapHoveredCell, HeatmapTooltipData } from './heatmap-hover-chrome';

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
  hoveredCell: HeatmapHoveredCell | null;
  hoveredLegendLevel: number | null;
  tooltipData: HeatmapTooltipData | null;
  setHoveredCell: (cell: HeatmapHoveredCell | null) => void;
  setHoveredLegendLevel: (level: number | null) => void;
  setTooltipData: (data: HeatmapTooltipData | null | ((prev: HeatmapTooltipData | null) => HeatmapTooltipData | null)) => void;
  clearInteraction: () => void;
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
  children?: ReactNode;
  coordinator?: HeatmapHoverCoordinator;
}

const HeatmapInteractionProvider = ({ children, coordinator }: Readonly<HeatmapInteractionProviderProps>): ReactElement => {
  const ownRef = useRef<HeatmapHoverCoordinator | null>(null);
  if (ownRef.current === null) {ownRef.current = createHeatmapHoverCoordinator();}
  const resolved = coordinator ?? ownRef.current;
  return <HeatmapInteractionContext.Provider value={resolved}>{children}</HeatmapInteractionContext.Provider>;
};

interface HeatmapInteractionBoundaryProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
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
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  coordinator?: HeatmapHoverCoordinator;
}

const HeatmapInteractionRoot = ({ children, className, style, coordinator }: Readonly<HeatmapInteractionRootProps>): ReactElement => (
    <HeatmapInteractionProvider coordinator={coordinator}>
      <HeatmapInteractionBoundary className={className} style={style}>
        {children}
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
);

export { useHeatmapCoordinatorOptional, useHeatmapInteractionOptional, useHeatmapInteraction, HeatmapInteractionProvider, HeatmapInteractionBoundary, HeatmapInteractionRoot };
export type { HeatmapInteractionContextValue, HeatmapInteractionProviderProps, HeatmapInteractionBoundaryProps, HeatmapInteractionRootProps };
