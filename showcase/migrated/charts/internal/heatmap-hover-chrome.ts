// Imperative, zero-React-state, zero-framer-motion hover chrome for
// HeatmapChart's cell grid + legend cross-highlight — ports repos/bklit-ui/
// packages/ui/src/charts/heatmap/heatmap-cells.tsx's per-cell
// `computeHeatmapCellFaded`/`resolveHeatmapHoverStyle` hover dim and
// heatmap-legend.tsx's mirrored legend-swatch dim (docs/LOG.md D10, D31).
//
// Unlike Pie/Funnel/Ring's hover pop (springs), bklit's OWN Heatmap hover dim
// is a plain CSS TWEEN — `HEATMAP_INACTIVE_TRANSITION = {duration:0.22,
// ease:[0.4,0,0.2,1]}` applied via `transition={HEATMAP_INACTIVE_TRANSITION}`
// on both the cell's `motion.g` (scale) and the legend swatch's `motion.span`
// (opacity+scale) — so this module writes plain CSS `transition` + direct
// style property writes rather than driving `./spring.ts`'s rAF integrator
// (matching funnel-hover-chrome.ts's own "graphic dim is a CSS tween, only
// the ring pop is a spring" split).
//
// Architecture: a single chart-level `HeatmapHoverCoordinator` (created once
// per `HeatmapInteractionProvider` instance via a ref) tracks THREE pieces of
// state that bklit spreads across plain `useState` in `HeatmapInteractionContext`
// (hoveredCell, hoveredLegendLevel, tooltipData) and broadcasts changes to
// subscribers. Each mounted cell / legend swatch computes its own
// isHighlighted/isDimmed from the broadcast state and repaints itself
// imperatively — avoiding a full grid-wide React re-render on every
// pointermove (the grid can be 52 columns x 7 rows = 364 cells). Only
// `HeatmapTooltip` bridges back to a local `useState` (isolated to its own
// small tree) to render its light-DOM text, matching the coordinator model
// established for Pie/Ring/Funnel (D10) extended here to a second broadcast
// axis (legend level) and a third payload (tooltip data) not present in
// those simpler single-hovered-index charts.
import { getHeatmapContributionLevel, isHeatmapHoverEffectEnabled } from "./heatmap-utils";
import { createBroadcastStore } from "./broadcast-store";

export const HEATMAP_INACTIVE_OPACITY = 0.3;
export const HEATMAP_INACTIVE_TRANSITION_CSS = "0.22s cubic-bezier(0.4, 0, 0.2, 1)";

export interface HeatmapHoveredCell {
  column: number;
  row: number;
}

export interface HeatmapTooltipData {
  column: number;
  row: number;
  count: number;
  date: Date;
  x: number;
  y: number;
}

export interface HeatmapHoverCoordinator {
  getHoveredCell(): HeatmapHoveredCell | null;
  getHoveredLegendLevel(): number | null;
  getTooltipData(): HeatmapTooltipData | null;
  setHoveredCell(cell: HeatmapHoveredCell | null): void;
  setHoveredLegendLevel(level: number | null): void;
  setTooltipData(data: HeatmapTooltipData | null): void;
  /** Clears all three pieces of state in one broadcast (bklit's
      `clearInteraction`, e.g. on pointer-leaving the whole chart surface). */
  clearInteraction(): void;
  /** Every mounted cell / legend swatch / tooltip subscribes on mount,
      unsubscribes on cleanup. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export function createHeatmapHoverCoordinator(): HeatmapHoverCoordinator {
  // Per-field stores with comparators replicating the exact pre-existing
  // dedup guards (identity OR field-equality). clearInteraction writes all
  // three silently then notifies ONCE, as before.
  const cells = createBroadcastStore<HeatmapHoveredCell | null>({
    initial: null,
    equals: (a, b) =>
      a === b ||
      (a !== null && b !== null && a.column === b.column && a.row === b.row),
  });
  const legend = createBroadcastStore<number | null>({ initial: null, equals: (a, b) => a === b });
  const tooltip = createBroadcastStore<HeatmapTooltipData | null>({
    initial: null,
    equals: (a, b) =>
      a === b ||
      (a !== null &&
        b !== null &&
        a.column === b.column &&
        a.row === b.row &&
        a.count === b.count),
  });
  return {
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
    clearInteraction() {
      if (cells.get() === null && legend.get() === null && tooltip.get() === null) return;
      cells.setSilent(null);
      legend.setSilent(null);
      tooltip.setSilent(null);
      cells.notify();
    },
    subscribe(listener) {
      const unsubs = [cells.subscribe(listener), legend.subscribe(listener), tooltip.subscribe(listener)];
      return () => {
        for (const unsub of unsubs) unsub();
      };
    },
  };
}

// --- per-cell hover-style resolution (heatmap-cells.tsx `computeHeatmapCellFaded`) --

export interface HeatmapCellHoverInputs {
  cellsInteractive: boolean;
  inactiveEnabled: boolean;
  hoveredCell: HeatmapHoveredCell | null;
  hoveredLegendLevel: number | null;
  column: number;
  row: number;
  count: number;
}

export function computeHeatmapCellFaded(inputs: HeatmapCellHoverInputs): { isHighlighted: boolean; isDimmed: boolean } {
  if (!inputs.cellsInteractive || !inputs.inactiveEnabled) return { isHighlighted: false, isDimmed: false };
  if (inputs.hoveredCell) {
    const isHighlighted = inputs.hoveredCell.column === inputs.column && inputs.hoveredCell.row === inputs.row;
    return { isHighlighted, isDimmed: !isHighlighted };
  }
  if (inputs.hoveredLegendLevel !== null) {
    const isHighlighted = getHeatmapContributionLevel(inputs.count) === inputs.hoveredLegendLevel;
    return { isHighlighted, isDimmed: !isHighlighted };
  }
  return { isHighlighted: false, isDimmed: false };
}

export interface HeatmapHoverStyleParams {
  inactiveOpacity: number;
  inactiveScale: number;
  activeScale: number;
}

export { isHeatmapHoverEffectEnabled };
