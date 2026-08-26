// Grid highlight-row rendering (bklit grid.tsx `highlightRowValues`): solid
// full-width lines at the given y-domain values, drawn beneath the series
// marks. bklit renders these as plain unmasked `<line>`s inside the Grid
// group (no horizontal fade), gated on `horizontal`; defaults per bklit
// GridProps: stroke var(--chart-foreground-muted), opacity 1, width 1,
// dasharray "0" (solid). Config resolution lives in internal/grid.ts
// (`resolveGridHighlightRows`); rendering is TanStack's native `ruleY`
// mark (P3.5/T-D4), which maps each row value through the chart's own
// `scales.y` and spans the full plot width via the chart bounds — the
// same absolute geometry the previous hand-built translated polylines
// produced. The `yScale` callback stays purely as the non-finite-y guard
// oracle so row filtering is byte-identical to bklit's.
import { ruleY } from "@tanstack/charts";
import type { ChartMark } from "@tanstack/charts";
import type { ChartDatum, GridConfig } from "./types";
import { resolveGridGuide, resolveGridHighlightRows } from "./grid";

export const DEFAULT_HIGHLIGHT_ROW_STROKE = "var(--chart-foreground-muted)";

export interface GridHighlightRowMarkOptions {
  grid: GridConfig | null;
  /** Non-finite-y guard oracle (bklit grid.tsx highlightRowValues guard).
      Row VALUES feed native `ruleY`; geometry comes from the chart's own
      y scale, this callback only decides which rows survive. */
  yScale: (value: number) => number | undefined;
}

export function gridHighlightRowMarks(
  options: GridHighlightRowMarkOptions
): ChartMark<ChartDatum, Date, number>[] {
  const { grid, yScale } = options;
  if (!grid || !resolveGridGuide(grid).horizontal) return [];
  const rows = resolveGridHighlightRows(grid, yScale);
  if (rows.length === 0) return [];

  return [
    ruleY(
      rows.map((row) => row.value),
      {
        id: "grid-highlight-rows",
        stroke: grid.highlightRowStroke ?? DEFAULT_HIGHLIGHT_ROW_STROKE,
        strokeOpacity: grid.highlightRowStrokeOpacity ?? 1,
        strokeWidth: grid.highlightRowStrokeWidth ?? 1,
        strokeDasharray: grid.highlightRowStrokeDasharray ?? "0",
      },
    ) as unknown as ChartMark<ChartDatum, Date, number>,
  ];
}
