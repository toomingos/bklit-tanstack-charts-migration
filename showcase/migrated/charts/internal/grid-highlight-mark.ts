// HighlightRowValues as native ruleY marks (full-width, beneath series, no fade);
// The yScale callback is only the non-finite-y guard oracle for identical filtering.
import { ruleY } from "@tanstack/charts/rule";
import type { ChartMark } from "@tanstack/charts";
import type { ChartDatum, GridConfig } from "./types";
import { resolveGridGuide, resolveGridHighlightRows } from "./grid";
import type { ResolvedGridHighlightRow } from "./grid";

const DEFAULT_HIGHLIGHT_ROW_STROKE = "var(--chart-foreground-muted)";

interface GridHighlightRowMarkOptions {
  readonly grid: GridConfig | null;
/** Non-finite-y guard oracle: decides which rows survive. */
  readonly yScale: (value: number) => number | undefined;
}

const gridHighlightRowMarks = (options: Readonly<GridHighlightRowMarkOptions>): ChartMark<ChartDatum, Date, number>[] => {
  const { grid, yScale } = options;
  if (!grid || !resolveGridGuide(grid).horizontal) {return [];}
  const rows = resolveGridHighlightRows(grid, yScale);
  if (rows.length === 0) {return [];}

  return [
    ruleY(
      rows.map((row: Readonly<ResolvedGridHighlightRow>) => row.value),
      {
        id: "grid-highlight-rows",
        stroke: grid.highlightRowStroke ?? DEFAULT_HIGHLIGHT_ROW_STROKE,
        strokeDasharray: grid.highlightRowStrokeDasharray ?? "0",
        strokeOpacity: grid.highlightRowStrokeOpacity ?? 1,
        strokeWidth: grid.highlightRowStrokeWidth ?? 1,
      },
    ),
  ];
}

export { DEFAULT_HIGHLIGHT_ROW_STROKE, gridHighlightRowMarks };
export type { GridHighlightRowMarkOptions };
