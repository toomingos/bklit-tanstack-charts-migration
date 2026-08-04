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
import { getHeatmapContributionLevel, isHeatmapHoverEffectEnabled, resolveHeatmapHoverStyle } from "./heatmap-utils";

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
  let hoveredCell: HeatmapHoveredCell | null = null;
  let hoveredLegendLevel: number | null = null;
  let tooltipData: HeatmapTooltipData | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    getHoveredCell: () => hoveredCell,
    getHoveredLegendLevel: () => hoveredLegendLevel,
    getTooltipData: () => tooltipData,
    setHoveredCell(cell) {
      hoveredCell = cell;
      notify();
    },
    setHoveredLegendLevel(level) {
      hoveredLegendLevel = level;
      notify();
    },
    setTooltipData(data) {
      tooltipData = data;
      notify();
    },
    clearInteraction() {
      hoveredCell = null;
      hoveredLegendLevel = null;
      tooltipData = null;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
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

/** Imperatively paints a cell's `<g>` wrapper (scale transform) + data rect
    (opacity, composed with the resting reveal opacity already written by the
    reveal/lifecycle sync) for the given highlight/dim state. `restOpacity` is
    the cell's own resting (non-hover) data opacity (from the reveal
    lifecycle), matching bklit's `readyDataOpacity` composition. */
export function paintHeatmapCellHover(
  groupEl: SVGGElement,
  dataRectEl: SVGRectElement,
  isHighlighted: boolean,
  isDimmed: boolean,
  params: HeatmapHoverStyleParams,
  restOpacity: number,
): void {
  const style = resolveHeatmapHoverStyle(isHighlighted, isDimmed, params);
  groupEl.style.transition = `transform ${HEATMAP_INACTIVE_TRANSITION_CSS}`;
  groupEl.style.transform = `scale(${style.scale})`;
  dataRectEl.style.transition = `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}`;
  dataRectEl.style.opacity = String(restOpacity * style.opacity);
}

export function paintHeatmapLegendSwatchHover(
  el: HTMLElement | SVGElement,
  isHighlighted: boolean,
  isDimmed: boolean,
  params: HeatmapHoverStyleParams,
): void {
  const style = resolveHeatmapHoverStyle(isHighlighted, isDimmed, params);
  el.style.transition = `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}, transform ${HEATMAP_INACTIVE_TRANSITION_CSS}`;
  el.style.opacity = String(style.opacity);
  el.style.transform = `scale(${style.scale})`;
}

export { isHeatmapHoverEffectEnabled };
