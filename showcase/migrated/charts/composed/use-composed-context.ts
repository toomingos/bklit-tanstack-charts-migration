import { useCallback, useMemo } from "react";
import type { RefObject } from "react";
import type { ChartContextValue, LineConfig } from "../kit/cartesian/chart-context";
import { useFocusRow } from "../kit/cartesian/chart-context-focus";
import type { Interaction } from "../kit/cartesian/chart-context-focus";
import { timeScale, useBridgedContext, useReferenceAreas, valueScale } from "../kit/cartesian/context-bridge";
import { usePlotSnapshot, ZERO_SIZE } from "../kit/cartesian/plot-size";
import type { PlotStore } from "../kit/cartesian/plot-size";
import type { ChildTable } from "../kit/read-children";
import type { FocusedRow } from "../kit/cartesian/context-bridge";
import type { ReadyStore } from "../kit/entrance/reveal-arm";
import { DEFAULT_Y_AXIS_ID } from "../kit/cartesian/series";
import type { resolveSeries, Row } from "../kit/cartesian/series";
import { shortDateFmt } from "../kit/format";
import type { ChartMargin } from "../kit/theme";
import type { SeriesBarSpec } from "./bars";
import { dateValue } from "./narrow";

interface ComposedContextInput {
  /** The size and domains TanStack's draw published; only the context hook (custom children) subscribes. */
  readonly store: PlotStore;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly ready: ReadyStore;
  readonly data: readonly Row[];
  readonly xDataKey: string;
  readonly margin: Readonly<ChartMargin>;
  readonly series: ReturnType<typeof resolveSeries>;
  readonly bars: readonly SeriesBarSpec[];
  readonly duration: number;
  readonly barSize?: number;
  readonly maxBarSize?: number;
  readonly barGap: number;
  readonly stacked: boolean;
  readonly stackGap: number;
  readonly table: ChildTable;
  readonly interaction: RefObject<Interaction | null>;
}

const NO_DOMAINS: { readonly x: readonly [Date, Date]; readonly y: Readonly<Record<string, readonly [number, number]>> } = { x: [new Date(0), new Date(1)], y: {} };

/** Public `useChart()` context, derived from the native focus + the domains and size the draw published. */
export function useComposedContext(input: Readonly<ComposedContextInput>): {
  readonly useContextValue: (focused: FocusedRow | null) => ChartContextValue;
  readonly rows: readonly Row[];
  readonly times: readonly number[];
} {
  const { store, containerRef, ready, data, xDataKey, margin, series, bars, duration, barSize, maxBarSize, barGap, stacked, stackGap, table, interaction } = input;
  const rows = data;
  const times = useMemo(() => rows.map((row) => dateValue(row[xDataKey]).getTime()), [rows, xDataKey]);
  const useContextValue = (focused: FocusedRow | null): ChartContextValue => {
    const snapshot = usePlotSnapshot(store);
    const size = snapshot?.size ?? ZERO_SIZE;
    const domains = snapshot?.built.domains ?? NO_DOMAINS;
    const innerHeight = Math.max(0, size.innerHeight);
    const xScale = useMemo(() => timeScale(domains.x, size.innerWidth), [domains.x, size.innerWidth]);
    const yScales = useMemo(
      () => Object.fromEntries(Object.entries(domains.y).map(([id, domain]) => [id, valueScale(domain, innerHeight)])),
      [domains.y, innerHeight],
    );
    const xAccessor = useCallback((d: Row): Date => dateValue(d[xDataKey]), [xDataKey]);
    const dateLabels = useMemo(() => rows.map((row) => shortDateFmt.format(xAccessor(row))), [rows, xAccessor]);
    const lines = useMemo<LineConfig[]>(
      () => [
        ...series.map((s) => ({ dataKey: s.dataKey, stroke: s.stroke, strokeWidth: s.strokeWidth, yAxisId: s.yAxisId })),
        ...bars.map((b) => ({ dataKey: b.dataKey, stroke: b.dotColor, strokeWidth: 0, yAxisId: DEFAULT_Y_AXIS_ID })),
      ],
      [series, bars],
    );
    const extras = useMemo(
      () => ({
        composedBarDataKeys: bars.map((b) => b.dataKey),
        composedBarSize: barSize,
        composedMaxBarSize: maxBarSize,
        composedBarGap: barGap,
        composedStacked: stacked,
        composedStackGap: stackGap,
      }),
      [bars, barSize, maxBarSize, barGap, stacked, stackGap],
    );
    const referenceAreas = useReferenceAreas(table);
    // Rows are focused at their data x on the plot's middle line; the group-x strategy snaps like a pointer move.
    const pixelOf = useCallback(
      (index: number) => (index >= 0 && index < rows.length ? { x: margin.left + xScale(xAccessor(rows[index])), y: margin.top + innerHeight / 2 } : null),
      [rows, margin, xScale, xAccessor, innerHeight],
    );
    const focusRow = useFocusRow(containerRef, interaction, pixelOf);
    const bridge = useMemo(
      () => ({ data: rows, margin, size, containerRef, ready, xScale, yScales, lines, animationDuration: duration, xAccessor, dateLabels, extras, focusRow, referenceAreas }),
      [rows, margin, size, containerRef, ready, xScale, yScales, lines, duration, xAccessor, dateLabels, extras, focusRow, referenceAreas],
    );
    const barExtras = useMemo(() => (bars.length > 0 ? { ...extras, setHoveredBarIndex: focusRow } : extras), [bars.length, extras, focusRow]);
    return useBridgedContext({ ...bridge, focused, extras: barExtras });
  };
  return { useContextValue, rows, times };
}
