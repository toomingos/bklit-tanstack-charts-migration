import type { ChartFocusMatch, ChartMarkState, ChartRectStateStyle } from "@tanstack/charts";
import type { CellDatum } from "./heatmap-cell-data";

// Base cell inset: native-`inset` equivalent of bklit's center-origin scale pop.
const HEATMAP_CELL_INSET = 1;

/*
 * Named easing only: the engine rejects raw `cubic-bezier()` strings, so legacy standard ease is approximated.
 */
const HEATMAP_HOVER_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  duration: 220,
  easing: "ease-in-out",
  type: "tween",
};

/*
 * Absolute `inset` target, not a delta: symmetric shrink about center reproduces a centered CSS scale.
 */
const heatmapHoverInset = (bandwidth: number, scale: number, baseInset: number): number => {
  if (scale === 1) {return baseInset;}
  const contentSize = Math.max(0, bandwidth - baseInset * 2);
  return Math.max(0, (bandwidth - contentSize * scale) / 2);
};

/*
 * No hovered gate needed: the engine skips `states` without active focus; pointer-only plus `!isGhost` preserve legacy parity.
 */
interface HeatmapHoverStatesParams {
  readonly bandwidth: number;
  readonly baseInset: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

const heatmapHoverStates = ({
  bandwidth,
  baseInset,
  inactiveOpacity,
  inactiveScale,
  activeScale,
}: Readonly<HeatmapHoverStatesParams>): ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] | undefined => {
  const states: ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] = [];
  if (activeScale !== 1) {
    states.push({
      style: { inset: heatmapHoverInset(bandwidth, activeScale, baseInset) },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<{ datum: Readonly<CellDatum>; focus: Readonly<{ source: string }>; matches: (match: ChartFocusMatch) => boolean }>) =>
        context.focus.source === "pointer" && !context.datum.isGhost && context.matches("primary"),
    });
  }
  if (inactiveOpacity !== 1 || inactiveScale !== 1) {
    const hoverInset = inactiveScale === 1 ? undefined : { inset: heatmapHoverInset(bandwidth, inactiveScale, baseInset) };
    states.push({
      style: {
        opacity: inactiveOpacity,
        ...hoverInset,
      },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<{ datum: Readonly<CellDatum>; focus: Readonly<{ source: string }>; matches: (match: ChartFocusMatch) => boolean }>) =>
        context.focus.source === "pointer" && !context.datum.isGhost && !context.matches("primary"),
    });
  }
  // Empty states become `undefined` so `sceneHasMarkStates` skips the mark entirely.
  return states.length > 0 ? states : undefined;
};

export { HEATMAP_CELL_INSET, HEATMAP_HOVER_TRANSITION, heatmapHoverInset, heatmapHoverStates };
export type { HeatmapHoverStatesParams };
