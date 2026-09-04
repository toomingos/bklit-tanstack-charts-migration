import { useContext, useMemo, useSyncExternalStore } from 'react';
import type { HeatmapHoverCoordinator, HeatmapHoveredCell, HeatmapTooltipData } from './heatmap-hover-chrome';
import { HeatmapInteractionContext } from './heatmap-interaction-context';

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

export { HeatmapInteractionContext } from './heatmap-interaction-context';
export { useHeatmapCoordinator, useHeatmapCoordinatorOptional, useHeatmapInteractionOptional, useHeatmapInteraction };
export type { HeatmapInteractionContextValue };
