import type { ChartFocusMatch, ChartMarkState, ChartRectStateStyle } from "@tanstack/charts";
import type { CellDatum } from "./heatmap-cell-data";

// C3: base cell inset (bklit's hover pop scales the cell's wrapper `motion.g`
// From a `transform-box: fill-box` / center origin — see `heatmapHoverInset`
// Below for the native-`inset` equivalent of that CSS `transform: scale()`).
const HEATMAP_CELL_INSET = 1;

// C3: native mark-state transition for the hover highlight/dim. Duration
// Matches `HEATMAP_INACTIVE_TRANSITION_CSS`'s 220ms exactly; `easing` is an
// APPROXIMATION — `ChartMotionTweenTransition.easing` only accepts the named
// Keywords `'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out'` or a custom
// `(progress:number)=>number` function (dist/types.d.ts `ChartAnimationOptions`),
// Never a raw `cubic-bezier()` string — so the legacy
// `cubic-bezier(0.4, 0, 0.2, 1)` (Material "standard" ease) cannot be
// Reproduced byte-for-byte. `"ease-in-out"` is used for consistency with
// Every other migrated chart's `ChartMarkState` transitions (e.g.
// The bar-chart.tsx `BAR_DIM_TRANSITION`/`BAR_TRACK_DIM_TRANSITION` pair), which all
// Use named keywords rather than a custom bezier evaluator.
const HEATMAP_HOVER_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  duration: 220,
  easing: "ease-in-out",
  type: "tween",
};

// Native-`inset` emulation of bklit's `transform: scale(scale)` (center-
// Origin, `fill-box`) hover pop/dim. `dist/mark-state.js`'s rect branch
// Treats a state's `inset` as an ABSOLUTE target (not a delta): it shrinks/
// Grows the rect symmetrically about its existing center by
// `amount = nextInset - currentInset` on both x and y (no `insetAxis` is set
// For a plain `cell()`/`rect()` mark, so both axes move equally) — exactly
// Reproducing a centered CSS scale for the base inset's content box.
const heatmapHoverInset = (bandwidth: number, scale: number, baseInset: number): number => {
  if (scale === 1) {return baseInset;}
  const contentSize = Math.max(0, bandwidth - baseInset * 2);
  return Math.max(0, (bandwidth - contentSize * scale) / 2);
};

// Bklit `resolveHeatmapHoverStyle` parity, reimplemented as native mark
// `states` (dist/rect.d.ts: `states?: readonly ChartMarkState<TDatum,
// ChartRectStateStyle<TDatum>>[]`) instead of imperative DOM writes.
// `states` are entirely skipped by the engine when there is no active focus
// (dist/mark-state.js: `resolveMarkStateScene` -> `if (!focus ...) return
// {scene}`), so this needs no separate "is anything hovered" gate — it's a
// No-op exactly when nothing is focused, matching legacy's "no highlight
// Without a hovered cell" behavior for free. Each predicate also requires
// `focus.source === "pointer"` so this only reacts to the app's own
// `scheduleFocus` bridge (never keyboard/programmatic focus — legacy cell
// Styling was ONLY ever driven by pointer hover, never keyboard nav), and
// `!datum.isGhost` so ghost cells are never highlighted OR dimmed (bklit
// Parity — legacy `paintCellStyles` applied the same `!d.isGhost` guard to
// Both branches).
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
  // Empty array -> `undefined` so the mark carries no `states` at all when
  // Hover styling is fully disabled (every prop === 1), matching legacy's
  // "nothing to dim/highlight, cells stay visually untouched" exactly and
  // Letting `sceneHasMarkStates` skip the mark entirely (dist/mark-state.js).
  return states.length > 0 ? states : undefined;
};

export { HEATMAP_CELL_INSET, HEATMAP_HOVER_TRANSITION, heatmapHoverInset, heatmapHoverStates };
export type { HeatmapHoverStatesParams };
