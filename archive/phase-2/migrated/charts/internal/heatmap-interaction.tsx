import { createContext, useContext, useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import {
  createHeatmapHoverCoordinator,
  type HeatmapHoverCoordinator,
  type HeatmapHoveredCell,
  type HeatmapTooltipData,
} from "./heatmap-hover-chrome";

const HeatmapInteractionContext = createContext<HeatmapHoverCoordinator | null>(null);

export function useHeatmapCoordinatorOptional(): HeatmapHoverCoordinator | null {
  return useContext(HeatmapInteractionContext);
}

function useHeatmapCoordinator(): HeatmapHoverCoordinator {
  const coordinator = useHeatmapCoordinatorOptional();
  if (!coordinator) {
    throw new Error("Heatmap interaction components must be rendered inside <HeatmapInteractionProvider> (HeatmapChart provides one automatically).");
  }
  return coordinator;
}

export interface HeatmapInteractionContextValue {
  hoveredCell: HeatmapHoveredCell | null;
  hoveredLegendLevel: number | null;
  tooltipData: HeatmapTooltipData | null;
  setHoveredCell: (cell: HeatmapHoveredCell | null) => void;
  setHoveredLegendLevel: (level: number | null) => void;
  setTooltipData: (data: HeatmapTooltipData | null | ((prev: HeatmapTooltipData | null) => HeatmapTooltipData | null)) => void;
  clearInteraction: () => void;
}

export function useHeatmapInteractionOptional(): HeatmapInteractionContextValue | null {
  const coordinator = useHeatmapCoordinatorOptional();
  const hoveredCell = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getHoveredCell() ?? null,
    () => null,
  );
  const hoveredLegendLevel = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getHoveredLegendLevel() ?? null,
    () => null,
  );
  const tooltipData = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getTooltipData() ?? null,
    () => null,
  );
  return useMemo<HeatmapInteractionContextValue | null>(() => {
    if (!coordinator) return null;
    return {
      hoveredCell,
      hoveredLegendLevel,
      tooltipData,
      setHoveredCell: (cell) => coordinator.setHoveredCell(cell),
      setHoveredLegendLevel: (level) => coordinator.setHoveredLegendLevel(level),
      setTooltipData: (data) => {
        const resolved = typeof data === "function" ? data(coordinator.getTooltipData()) : data;
        coordinator.setTooltipData(resolved);
      },
      clearInteraction: () => coordinator.clearInteraction(),
    };
  }, [coordinator, hoveredCell, hoveredLegendLevel, tooltipData]);
}

export function useHeatmapInteraction(): HeatmapInteractionContextValue {
  const value = useHeatmapInteractionOptional();
  if (!value) {
    throw new Error("useHeatmapInteraction must be used within a HeatmapInteractionProvider (HeatmapChart provides one automatically).");
  }
  return value;
}

export interface HeatmapInteractionProviderProps {
  children?: ReactNode;
  coordinator?: HeatmapHoverCoordinator;
}

export function HeatmapInteractionProvider({ children, coordinator }: HeatmapInteractionProviderProps) {
  const ownRef = useRef<HeatmapHoverCoordinator | null>(null);
  if (ownRef.current === null) ownRef.current = createHeatmapHoverCoordinator();
  const resolved = coordinator ?? ownRef.current;
  return <HeatmapInteractionContext.Provider value={resolved}>{children}</HeatmapInteractionContext.Provider>;
}

export interface HeatmapInteractionBoundaryProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function HeatmapInteractionBoundary({ children, className, style }: HeatmapInteractionBoundaryProps) {
  const coordinator = useHeatmapCoordinator();
  return (
    <div
      className={className}
      style={style}
      onPointerLeave={() => coordinator.clearInteraction()}
    >
      {children}
    </div>
  );
}

export interface HeatmapInteractionRootProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  coordinator?: HeatmapHoverCoordinator;
}

export function HeatmapInteractionRoot({ children, className, style, coordinator }: HeatmapInteractionRootProps) {
  return (
    <HeatmapInteractionProvider coordinator={coordinator}>
      <HeatmapInteractionBoundary className={className} style={style}>
        {children}
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
  );
}
