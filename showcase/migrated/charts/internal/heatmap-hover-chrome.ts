// Hover state broadcasts imperatively to subscribers instead of living in React state, so a pointermove
// Repaints only the affected cell/swatch/tooltip rather than re-rendering the whole grid (up to 364 cells).
import { createBroadcastStore } from "./broadcast-store";

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

export { isHeatmapHoverEffectEnabled } from "./heatmap-utils";
export { HEATMAP_INACTIVE_OPACITY, HEATMAP_INACTIVE_TRANSITION_CSS, createHeatmapHoverCoordinator };
export type { HeatmapHoveredCell, HeatmapTooltipData, HeatmapHoverCoordinator, HeatmapHoverStyleParams };
