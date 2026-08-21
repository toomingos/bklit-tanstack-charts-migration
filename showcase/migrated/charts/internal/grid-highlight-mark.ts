// Grid highlight-row rendering (bklit grid.tsx `highlightRowValues`): solid
// full-width lines at the given y-domain values, drawn beneath the series
// marks. bklit renders these as plain unmasked `<line>`s inside the Grid
// group (no horizontal fade), gated on `horizontal`; defaults per bklit
// GridProps: stroke var(--chart-foreground-muted), opacity 1, width 1,
// dasharray "0" (solid). Config resolution lives in internal/grid.ts
// (`resolveGridHighlightRows`); this module builds the ChartMark.
import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import type { ChartDatum, GridConfig } from "./types";
import { resolveGridHighlightRows } from "./grid";

export const DEFAULT_HIGHLIGHT_ROW_STROKE = "var(--chart-foreground-muted)";

export interface GridHighlightRowMarkOptions {
  grid: GridConfig | null;
  yScale: (value: number) => number | undefined;
  innerWidth: number;
  translateX: number;
  translateY: number;
}

export function gridHighlightRowMarks(
  options: GridHighlightRowMarkOptions
): ChartMark<ChartDatum, Date, number>[] {
  const { grid, yScale, innerWidth, translateX, translateY } = options;
  if (!grid?.horizontal) return [];
  const rows = resolveGridHighlightRows(grid, yScale);
  if (rows.length === 0) return [];

  const stroke = grid.highlightRowStroke ?? DEFAULT_HIGHLIGHT_ROW_STROKE;
  const strokeOpacity = grid.highlightRowStrokeOpacity ?? 1;
  const strokeWidth = grid.highlightRowStrokeWidth ?? 1;
  const strokeDasharray = grid.highlightRowStrokeDasharray ?? "0";

  return [
    createMark(() => ({
      id: "grid-highlight-rows",
      channels: {
        x: { scale: "x", values: [] },
        y: { scale: "y", values: [] },
      },
      render: () => ({
        nodes: [
          {
            kind: "group",
            key: "grid-highlight-rows",
            translateX,
            translateY,
            children: rows.map(
              (row) =>
                ({
                  kind: "polyline",
                  key: `grid-highlight-row-${row.value}`,
                  points: [],
                  path: `M0,${row.y}L${innerWidth},${row.y}`,
                  style: {
                    fill: "none",
                    stroke,
                    strokeOpacity,
                    strokeWidth,
                    strokeDasharray,
                  },
                }) as SceneNode
            ),
          },
        ],
      }),
    })),
  ];
}
