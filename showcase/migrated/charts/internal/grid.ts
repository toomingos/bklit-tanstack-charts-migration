// Single grid module (initiative 3 D1): one import path for the cartesian
// charts' guides config. TanStack's native `grid`/`ticks` axis-guide options
// render the ordinary grid lines (`.ts-chart__grid`); this module owns the
// config resolution that was previously duplicated across the six cartesian
// chart files (`grid?.horizontal ?? false`, `grid?.numTicks ?? 5`,
// `grid?.vertical ?? false`) plus the bklit grid.tsx parity surface
// (highlight rows, shimmer tokens). Highlight-row RENDERING is built by
// `internal/grid-highlight-mark.ts` (`gridHighlightRowMarks()`, a ChartMark
// builder); this module stays pure TS so it can be consumed by the plain
// `defineChart` spec paths.

import type { GridConfig } from "./types";

/** bklit grid.tsx default stroke dash array (dashed grid lines). */
export const DEFAULT_GRID_STROKE_DASHARRAY = "4,4";

export interface ResolvedGridGuide {
  /** TanStack y-axis `grid` option (bklit `horizontal`). */
  horizontal: boolean;
  /** TanStack x-axis `grid` option (bklit `vertical`). */
  vertical: boolean;
  /** Horizontal tick count (bklit `numTicksRows`). */
  ticks: number;
  /** Vertical tick count (bklit `numTicksColumns`). */
  columnTicks: number;
}

/**
 * Resolves the shared axis-guide options for a `<Grid>` child. Replaces the
 * per-chart `grid?.horizontal ?? …` / `grid?.numTicks ?? 5` /
 * `grid?.vertical ?? false` triples (single source, one impl, no forks).
 * Defaults match bklit grid.tsx GridProps: `horizontal` true, `vertical`
 * false, `numTicksRows` 5, `numTicksColumns` 10. CH3: both the legacy
 * `numTicksRows` and the pilot-rename `numTicks` are accepted for the
 * horizontal density.
 */
export function resolveGridGuide(grid: GridConfig | null): ResolvedGridGuide {
  return {
    horizontal: grid?.horizontal ?? true,
    vertical: grid?.vertical ?? false,
    ticks: grid?.numTicksRows ?? grid?.numTicks ?? 5,
    columnTicks: grid?.numTicksColumns ?? 10,
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
