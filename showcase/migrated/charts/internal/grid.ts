// Resolved grid-guide config + highlight-row surface for the cartesian charts.

/*
 * Read-view of the grid config: GridConfig carries mutable arrays, so resolvers take this narrower view.
 * every caller passes a GridConfig, which remains assignable here.
 */
interface GridGuideSource {
  readonly horizontal?: boolean;
  readonly vertical?: boolean;
  readonly numTicks?: number;
  readonly numTicksRows?: number;
  readonly numTicksColumns?: number;
  readonly highlightRowValues?: readonly number[];
}

interface ResolvedGridGuide {
  /** TanStack y-axis `grid` option (bklit `horizontal`). */
  readonly horizontal: boolean;
  /** TanStack x-axis `grid` option (bklit `vertical`). */
  readonly vertical: boolean;
  /** Horizontal tick count (bklit `numTicksRows`). */
  readonly ticks: number;
  /** Vertical tick count (bklit `numTicksColumns`). */
  readonly columnTicks: number;
}

// Bklit grid defaults when the config omits tick counts.
const DEFAULT_GRID_COLUMN_TICKS = 10;
const DEFAULT_GRID_ROW_TICKS = 5;

// Single source for per-chart grid triples; accepts numTicksRows and pilot numTicks.
const resolveGridGuide = (grid: GridGuideSource | null): ResolvedGridGuide => (
  {
    columnTicks: grid?.numTicksColumns ?? DEFAULT_GRID_COLUMN_TICKS,
    horizontal: grid?.horizontal ?? true,
    ticks: grid?.numTicksRows ?? grid?.numTicks ?? DEFAULT_GRID_ROW_TICKS,
    vertical: grid?.vertical ?? false,
  }
);

interface ResolvedGridHighlightRow {
  readonly value: number;
  readonly y: number;
}

// Non-finite-y values dropped (bklit highlightRowValues guard).
const resolveGridHighlightRows = (grid: GridGuideSource | null, yMap: (value: number) => number | undefined): ResolvedGridHighlightRow[] => {
  const values = grid?.highlightRowValues;
  if (!values || values.length === 0) {return [];}
  const out: ResolvedGridHighlightRow[] = [];
  for (const value of values) {
    const y = yMap(value);
    if (y !== undefined && Number.isFinite(y)) {out.push({ value, y });}
  }
  return out;
}

export type { ResolvedGridGuide, ResolvedGridHighlightRow };
export { resolveGridGuide, resolveGridHighlightRows };
