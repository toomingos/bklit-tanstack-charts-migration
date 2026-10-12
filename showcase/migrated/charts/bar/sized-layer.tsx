// The size-dependent half of the bar chart: the public `useChart()` context for custom children and bklit's loading skeleton.
// Mounted only when one of them exists, so a plain bar never measures its host or re-renders on resize.
import { useCallback, useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { scaleBand, scaleLinear, scaleUtc } from "d3-scale";
import type { LineConfig } from "../kit/cartesian/chart-context";
import { useFocusRow } from "../kit/cartesian/chart-context-focus";
import { useBridgedContext, useReferenceAreas, valueScale } from "../kit/cartesian/context-bridge";
import type { FocusedRow } from "../kit/cartesian/context-bridge";
import { FocusLayer } from "../kit/cartesian/focus-layer";
import type { useFocusStore } from "../kit/cartesian/focus-layer";
import { shortDateFmt } from "../kit/format";
import { BarLoadingSkeleton } from "../kit/loading/bar-skeleton";
import { useResizeBox } from "../kit/size/use-resize-box";
import type { AnyInteraction } from "../kit/erased-types";
import type { ChartMargin } from "../kit/theme";
import { BarDepthConfigProvider } from "./depth-entries";
import type { BarDepthConfig } from "./depth-entries";
import { numberOrZero } from "./model";
import type { BarSeries, Row } from "./model";
import type { ChildTable } from "../kit/read-children";
import type { ReadyStore } from "../kit/entrance/reveal-arm";

// bklit bar-chart.tsx:54-55: skeleton bars when `data` is empty.
const FALLBACK_LOADING_BARS = 12;

interface BarSizedLayerProps {
  readonly host: RefObject<HTMLDivElement | null>;
  readonly data: Row[];
  readonly xDataKey: string;
  readonly orientation: "vertical" | "horizontal";
  readonly stacked: boolean;
  readonly barGap: number;
  readonly series: readonly BarSeries[];
  readonly valueDomain: readonly [number, number];
  readonly resolvedMargin: ChartMargin;
  readonly animationDuration: number;
  readonly table: ChildTable;
  readonly barInteraction: RefObject<AnyInteraction | null>;
  readonly readyStore: ReadyStore;
  readonly focusStore: ReturnType<typeof useFocusStore<FocusedRow>>;
  readonly depthConfig: BarDepthConfig;
  readonly custom: ReactNode;
  readonly loading: boolean;
}

export const BarSizedLayer = ({
  host, data, xDataKey, orientation, stacked, barGap, series, valueDomain, resolvedMargin, animationDuration, table, barInteraction, readyStore, focusStore, depthConfig, custom, loading,
}: BarSizedLayerProps): ReactElement => {
  const skeletonStyle = useMemo(
    (): CSSProperties => ({ position: "absolute", left: resolvedMargin.left, top: resolvedMargin.top, overflow: "visible", pointerEvents: "none" }),
    [resolvedMargin],
  );
  // Public `useChart()` context, derived from the native focus + resolved domains.
  const horizontal = orientation === "horizontal";
  const size = useResizeBox(host, undefined, true);
  const innerWidth = Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right);
  const innerHeight = Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom);
  const categoryOf = useCallback((d: Row): string => String(d[xDataKey]), [xDataKey]);
  const categories = useMemo(() => data.map(categoryOf), [data, categoryOf]);
  const bandLength = horizontal ? innerHeight : innerWidth;
  const barScale = useMemo(() => scaleBand().domain(categories).range([0, bandLength]).padding(barGap), [categories, bandLength, barGap]);
  const valueAxis = useMemo(() => {
    const [lo, hi] = valueDomain;
    return horizontal ? scaleLinear().domain([lo, hi]).range([0, innerWidth]) : valueScale([lo, hi], innerHeight);
  }, [valueDomain, horizontal, innerWidth, innerHeight]);
  const rowIndex = useMemo(() => new Map(data.map((row, i) => [row, i] as const)), [data]);
  // bklit exposes a Date-typed x scale for bar charts: row i maps to the centre of band i.
  const xScale = useMemo(() => {
    const centre = (i: number): number => (barScale(categories[i] ?? "") ?? 0) + barScale.bandwidth() / 2;
    return scaleUtc()
      .domain([new Date(0), new Date(Math.max(1, data.length - 1))])
      .range(horizontal || data.length === 0 ? [0, innerWidth] : [centre(0), centre(Math.max(1, data.length - 1))]);
  }, [barScale, categories, data.length, horizontal, innerWidth]);
  const xAccessor = useCallback((d: Row): Date => new Date(rowIndex.get(d) ?? 0), [rowIndex]);
  const dateLabels = useMemo(() => data.map((row) => (row[xDataKey] instanceof Date ? shortDateFmt.format(row[xDataKey]) : String(row[xDataKey]))), [data, xDataKey]);
  const lines = useMemo<LineConfig[]>(() => series.map((sr) => ({ dataKey: sr.key, stroke: sr.fill, strokeWidth: 2 })), [series]);
  const yScales = useMemo(() => ({ left: valueAxis }), [valueAxis]);
  const stackOffsets = useMemo(() => {
    if (!stacked) {
      return undefined;
    }
    const offsets = new Map<number, Map<string, number>>();
    for (const [i, row] of data.entries()) {
      const point = new Map<string, number>();
      let cumulative = 0;
      for (const line of lines) {
        point.set(line.dataKey, cumulative);
        cumulative += numberOrZero(row[line.dataKey]);
      }
      offsets.set(i, point);
    }
    return offsets;
  }, [data, lines, stacked]);
  const extras = useMemo(
    () => ({
      barScale,
      barXAccessor: categoryOf,
      orientation,
      stacked,
      stackOffsets,
      bandWidth: barScale.bandwidth(),
      columnWidth: data.length > 0 ? bandLength / data.length : 0,
    }),
    [barScale, categoryOf, orientation, stacked, stackOffsets, data.length, bandLength],
  );
  const referenceAreas = useReferenceAreas(table);
  // Rows are focused at their band centre on the plot's middle line; the category strategy snaps like a pointer move.
  const pixelOf = useCallback(
    (index: number) => {
      if (index < 0 || index >= categories.length) {
        return null;
      }
      const centre = (barScale(categories[index]) ?? 0) + barScale.bandwidth() / 2;
      return horizontal
        ? { x: resolvedMargin.left + innerWidth / 2, y: resolvedMargin.top + centre }
        : { x: resolvedMargin.left + centre, y: resolvedMargin.top + innerHeight / 2 };
    },
    [barScale, categories, horizontal, resolvedMargin, innerWidth, innerHeight],
  );
  const focusRow = useFocusRow(host, barInteraction, pixelOf);
  const xAt = useCallback((f: FocusedRow): number => (barScale(categoryOf(f.row)) ?? 0) + barScale.bandwidth() / 2, [barScale, categoryOf]);
  const bridge = useMemo(
    () => ({ data, margin: resolvedMargin, size, containerRef: host, ready: readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, xAt, extras, focusRow, referenceAreas }),
    [data, resolvedMargin, size, readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, xAt, extras, focusRow, referenceAreas],
  );
  const useContextValue = (focused: FocusedRow | null): ReturnType<typeof useBridgedContext> => {
    const hoverExtras = useMemo(() => ({ ...extras, hoveredBarIndex: focused?.index ?? null, setHoveredBarIndex: focusRow }), [extras, focused]);
    return useBridgedContext({ ...bridge, focused, extras: hoverExtras });
  };
  return (
    <>
      {loading ? (
        // bklit renders the skeleton inside the margin-translated group, in place of the bars (bar-chart.tsx:654-660; barCount = data.length || 12, :54-55).
        // No native mark paints a masked shimmer, so the skeleton is bklit's own svg laid over the plot rect.
        <svg aria-hidden="true" height={innerHeight} style={skeletonStyle} width={innerWidth}>
          <BarLoadingSkeleton barCount={data.length > 0 ? data.length : FALLBACK_LOADING_BARS} innerHeight={innerHeight} innerWidth={innerWidth} />
        </svg>
      ) : null}
      <FocusLayer store={focusStore} useContextValue={useContextValue}>
        <BarDepthConfigProvider value={depthConfig}>{custom}</BarDepthConfigProvider>
      </FocusLayer>
    </>
  );
};
