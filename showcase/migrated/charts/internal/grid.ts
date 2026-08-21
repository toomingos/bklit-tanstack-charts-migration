// Single grid module (initiative 3 D1): one import path for the cartesian
// charts' guides config. TanStack's native `grid`/`ticks` axis-guide options
// render the ordinary grid lines (`.ts-chart__grid`); this module owns the
// config resolution that was previously duplicated across the six cartesian
// chart files (`grid?.horizontal ?? false`, `grid?.numTicks ?? 5`,
// `grid?.vertical ?? false`) plus the bklit grid.tsx parity surface
// (highlight rows, shimmer tokens). Highlight-row RENDERING lives in
// `internal/grid-chrome.tsx` (the `GridHighlightRows` component); this module
// stays pure TS so it can be consumed by the plain `defineChart` spec paths.

import type { GridConfig } from "./types";
import { DEFAULT_SHIMMER_LENGTH_PX, DEFAULT_SHIMMER_SPEED, DEFAULT_SHIMMER_STROKE } from "./design-tokens";

/** bklit grid.tsx default stroke dash array (dashed grid lines). */
export const DEFAULT_GRID_STROKE_DASHARRAY = "4,4";

export interface ResolvedGridGuide {
  /** TanStack y-axis `grid` option (bklit `horizontal`). */
  horizontal: boolean;
  /** TanStack x-axis `grid` option (bklit `vertical`). */
  vertical: boolean;
  /** TanStack y-axis `ticks` count (bklit `numTicksRows`). */
  ticks: number;
}

/**
 * Resolves the shared axis-guide options for a `<Grid>` child. Replaces the
 * per-chart `grid?.horizontal ?? false` / `grid?.numTicks ?? 5` /
 * `grid?.vertical ?? false` triples (single source, one impl, no forks).
 */
export function resolveGridGuide(grid: GridConfig | null): ResolvedGridGuide {
  return {
    horizontal: grid?.horizontal ?? false,
    vertical: grid?.vertical ?? false,
    ticks: grid?.numTicks ?? 5,
  };
}

export interface ResolvedGridHighlightRow {
  value: number;
  y: number;
}

/**
 * Resolves the highlight-row line positions for a `<Grid>` child. `yMap` maps
 * a domain value to its plot-area y pixel (the chart's own y scale). Values
 * with a non-finite y are dropped (bklit grid.tsx highlightRowValues guard).
 */
export function resolveGridHighlightRows(
  grid: GridConfig | null,
  yMap: (value: number) => number | undefined,
): ResolvedGridHighlightRow[] {
  const values = grid?.highlightRowValues;
  if (!values || values.length === 0) return [];
  const out: ResolvedGridHighlightRow[] = [];
  for (const value of values) {
    const y = yMap(value);
    if (y == null || !Number.isFinite(y)) continue;
    out.push({ value, y });
  }
  return out;
}

/** Resolved shimmer options (bklit grid.tsx `useGridShimmer` inputs) with the
 *  design-token defaults applied. */
export function resolveGridShimmer(grid: GridConfig | null): {
  enabled: boolean;
  length: number;
  speed: number;
  stroke: string;
} {
  return {
    enabled: grid?.shimmer ?? false,
    length: grid?.shimmerLength ?? DEFAULT_SHIMMER_LENGTH_PX,
    speed: grid?.shimmerSpeed ?? DEFAULT_SHIMMER_SPEED,
    stroke: grid?.shimmerStroke ?? DEFAULT_SHIMMER_STROKE,
  };
}
