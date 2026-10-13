// Hook groups of the cartesian shell, each a contiguous run of the former CartesianChartMounted body (hook order unchanged).
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { scaleLinear, scaleUtc } from "../scales";
import { motion } from "@tanstack/charts/motion";
import { propsFor } from "../read-children";
import { shortDateFmt } from "../format";
import { useChildTable } from "../stable-children";
import { BklitTooltipBody, bklitTooltipOptions } from "../tooltip/tooltip-body";
import type { ChartMargin } from "../theme";
import type { ChartMarker, ChartSelection } from "../types";
import type { ChartContextValue, TooltipData } from "./chart-context";
import { tooltipSetter, useFocusRow } from "./chart-context-focus";
import { useGateReady } from "../entrance/reveal-arm";
import type { ReadyStore } from "../entrance/reveal-arm";
import { useReferenceAreas, useStructural } from "./context-bridge";
import { strictRows } from "./domains";
import type { PlotStore } from "./plot-size";
import { usePlotSnapshot, ZERO_SIZE } from "./plot-size";
import { erase } from "../erased-types";
import type { AnyInteraction } from "../erased-types";
import { installMarkers, markerListsFor } from "./features";
import { DEFAULT_Y_AXIS_ID, resolveSeries, toDate } from "./series";
import type { ResolvedSeries, Row } from "./series";

export interface CartesianFocus {
  readonly row: Row;
  readonly index: number;
  readonly time: number;
}

interface SeriesTable {
  readonly table: ReturnType<typeof useChildTable>["table"];
  readonly hasMarkers: boolean;
  readonly series: ResolvedSeries[];
  readonly onPulseIteration: (event: { animationName: string }) => void;
  readonly custom: ReturnType<typeof useChildTable>["custom"];
  readonly childrenReady: boolean;
  readonly times: number[];
}

/** The stable child table and what is read from it: marker lists, series, loop-pulse callback, custom children, row times. */
export function useSeriesTable(children: ReactNode, data: readonly Row[], xDataKey: string, containerRef: RefObject<HTMLDivElement | null>, chartLoading: boolean): SeriesTable {
  const { table, custom, ready: childrenReady } = useChildTable(children);
  const hasMarkers = table.has("chartMarkers") || table.has("markerGroup");
  // Latest marker items for the delegated click handler (marker-springs.ts); no listener rebuild when the items change.
  const markerLists = useRef<readonly (readonly ChartMarker[])[]>([]);
  markerLists.current = hasMarkers ? markerListsFor(table) : [];
  useEffect(() => {
    const el = containerRef.current;
    return hasMarkers && el ? installMarkers(el, () => markerLists.current) : undefined;
  }, [containerRef, hasMarkers]);
  const series = useMemo(() => resolveSeries(table, chartLoading), [table, chartLoading]);
  // Loop-pulse cycles end as CSS iteration events bubbling to the host; only the animation name is read (bklit line.tsx onLoadingPulseCycleComplete).
  const pulseCycleRef = useRef<(() => void) | undefined>(undefined);
  pulseCycleRef.current = propsFor<{ onLoadingPulseCycleComplete?: () => void }>(table, "line").find((l) => l.onLoadingPulseCycleComplete)?.onLoadingPulseCycleComplete;
  const onPulseIteration = useCallback((event: { animationName: string }) => {
    if (event.animationName === "bkm-loading-pulse") {
      pulseCycleRef.current?.();
    }
  }, []);
  const times = useMemo(
    () => data.map((row) => toDate(row[xDataKey]).getTime()),
    [data, xDataKey],
  );
  return { table, hasMarkers, series, onPulseIteration, custom, childrenReady, times };
}

interface RendererTooltipInput {
  readonly animationDuration: number;
  readonly table: SeriesTable["table"];
  readonly data: readonly Row[];
  readonly series: readonly ResolvedSeries[];
}

interface RendererTooltip {
  readonly renderer: ReturnType<typeof motion>;
  readonly renderTooltipBody: ({ points }: { points: never }) => ReactNode;
}

/** The entrance renderer and the tooltip body callback. */
export function useRendererTooltip({ animationDuration, table, data, series }: RendererTooltipInput): RendererTooltip {
  const renderer = useMemo(
    // `initial: "always"` replays the entrance on hydrated (server-rendered) SVG too.
    () => motion(erase({ initial: "always", transition: { type: "tween", duration: animationDuration } })),
    [animationDuration],
  );
  const tooltipOptions = bklitTooltipOptions(propsFor<Parameters<typeof bklitTooltipOptions>[0] & object>(table, "tooltip")[0], data, {
    order: series.map((s) => s.dataKey),
    colors: Object.fromEntries(series.map((s) => [s.dataKey, s.stroke])),
  });
  // Stable callback (the RendererChart element never changes on hover); reads the latest options at tooltip time.
  const tooltipOptionsRef = useRef(tooltipOptions);
  tooltipOptionsRef.current = tooltipOptions;
  const renderTooltipBody = useCallback(
    ({ points }: { points: never }) => <BklitTooltipBody points={points} options={tooltipOptionsRef.current} />,
    [],
  );
  return { renderer, renderTooltipBody };
}

interface ChartBaseInput {
  readonly store: PlotStore;
  readonly series: readonly ResolvedSeries[];
  readonly data: readonly Row[];
  readonly xDataKey: string;
  readonly table: SeriesTable["table"];
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly ready: ReadyStore;
  readonly dragInteraction: RefObject<AnyInteraction | null>;
  readonly resolvedMargin: ChartMargin;
  readonly animationDuration: number;
  readonly xDomain: [Date, Date] | undefined;
  readonly xDomainSlotCount: number | undefined;
}

const NO_X: readonly [Date, Date] = [new Date(0), new Date(0)];
const NO_Y: Readonly<Record<string, readonly [number, number]>> = {};

type StableContext = Omit<ChartContextValue, "tooltipData" | "setTooltipData" | "selection" | "clearSelection">;

interface ChartBase {
  readonly stable: StableContext;
  readonly xScale: ReturnType<typeof scaleUtc>;
  readonly xAccessor: (d: Row) => Date;
  readonly setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
}

/** The referentially stable part of the published chart context, and the scales it is built from. Only custom children mount it: it follows the size the draw published. */
function useChartBase(input: ChartBaseInput): ChartBase {
  const { store, series, data, xDataKey, table, containerRef, ready, dragInteraction, resolvedMargin, animationDuration, xDomain, xDomainSlotCount } = input;
  const snapshot = usePlotSnapshot(store);
  const size = snapshot?.size ?? ZERO_SIZE;
  const plotWidth = size.width;
  const plotHeight = size.height;
  const innerWidth = size.innerWidth;
  const innerHeight = Math.max(0, size.innerHeight);
  const xAccessor = useCallback((d: Row): Date => toDate(d[xDataKey]), [xDataKey]);
  // The children (and so `table` / `built`) are new objects on every parent render; key every
  // context field on its primitive content so the published context stays referentially stable.
  const xd = snapshot?.built.domains.x ?? NO_X;
  const xStart = new Date(xd[0]).getTime();
  const xEnd = new Date(xd[1]).getTime();
  const yRaw = snapshot?.built.domains.y ?? NO_Y;
  const yDomains = useStructural(yRaw, JSON.stringify(yRaw));
  const xScale = useMemo(() => scaleUtc().domain([new Date(xStart), new Date(xEnd)]).range([0, innerWidth]), [xStart, xEnd, innerWidth]);
  const yScales = useMemo(
    () => Object.fromEntries(Object.entries(yDomains).map(([id, domain]) => [id, scaleLinear().domain(domain).range([innerHeight, 0])])),
    [yDomains, innerHeight],
  );
  const lineRows = series.map(({ dataKey, stroke, strokeWidth, yAxisId }) => ({ dataKey, stroke, strokeWidth, yAxisId }));
  const lines = useStructural(lineRows, JSON.stringify(lineRows));
  const dateLabels = useMemo(() => data.map((row) => shortDateFmt.format(xAccessor(row))), [data, xAccessor]);
  const isLoaded = useGateReady(ready);
  const yDomainTargetByAxis = useMemo(
    () => Object.fromEntries(Object.entries(yDomains).map(([id, [min, max]]): [string, [number, number]] => [id, [min, max]])),
    [yDomains],
  );
  const referenceAreas = useReferenceAreas(table);
  // bklit time-series-chart-shell.tsx:323-332: spacing between neighbouring rows of the visible window (0 under two slots).
  const columnWidth = useMemo(() => {
    const slots = xDomain && xDomainSlotCount !== undefined ? xDomainSlotCount : (xDomain ? strictRows(data, xDataKey, xDomain) : data).length;
    return slots < 2 ? 0 : innerWidth / (slots - 1);
  }, [data, xDataKey, xDomain, xDomainSlotCount, innerWidth]);
  // Rows are focused at their data x on the plot's vertical middle: `resolvePointer` snaps to the nearest datum like a pointer move.
  const pixelOf = useCallback(
    (index: number) => {
      const row = index < 0 ? undefined : data.at(index);
      return row ? { x: resolvedMargin.left + xScale(xAccessor(row)), y: resolvedMargin.top + innerHeight / 2 } : null;
    },
    [data, resolvedMargin, xScale, xAccessor, innerHeight],
  );
  const focusRow = useFocusRow(containerRef, dragInteraction, pixelOf);
  const setTooltipData = useMemo(() => tooltipSetter(focusRow), [focusRow]);
  const stable = useMemo(() => {
    const yScale = yScales[DEFAULT_Y_AXIS_ID] ?? scaleLinear().domain([0, 100]).range([innerHeight, 0]);
    const base = {
      // SAFETY: `data` is only read; the context types rows as a mutable array.
      data: data as Row[],
      // SAFETY: `data` is only read; the context types rows as a mutable array.
      renderData: data as Row[],
      xScale,
      yScale,
      yScales,
      isLoaded,
      chartPhase: isLoaded ? ("ready" as const) : ("revealing" as const),
      chartStatus: "ready" as const,
      yDomainTargetByAxis,
      referenceAreas,
      width: plotWidth,
      height: plotHeight,
      innerWidth,
      innerHeight,
      margin: resolvedMargin,
      containerRef,
      lines,
      animationDuration,
      xAccessor,
      dateLabels,
      columnWidth,
    };
    return xDomain ? { ...base, xDomain, xDomainSlotCount } : base;
  }, [containerRef, xScale, yScales, innerWidth, innerHeight, data, plotWidth, plotHeight, resolvedMargin, lines, animationDuration, xAccessor, dateLabels, xDomain, xDomainSlotCount, columnWidth, isLoaded, yDomainTargetByAxis, referenceAreas]);
  return { stable, xScale, xAccessor, setTooltipData };
}

/** bklit's `ChartSelection` (px x in the inner plot + data indices) for the Segment drag. */
function useChartSelection(selection: { startX: number; endX: number } | null, xScale: ChartBase["xScale"], times: readonly number[]): ChartSelection | null {
  return useMemo((): ChartSelection | null => {
    if (!selection) {
      return null;
    }
    // bklit resolveIndexFromX: the nearest data point to the raw pixel.
    const nearest = (x: number): number => {
      const t = xScale.invert(x).getTime();
      let lo = 0;
      let hi = times.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (times[mid] < t) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      const i1 = Math.max(1, lo);
      const d0 = times.at(i1 - 1);
      const d1 = times.at(i1);
      if (d0 === undefined) {
        return 0;
      }
      return d1 !== undefined && t - d0 > d1 - t ? i1 : i1 - 1;
    };
    return { startX: selection.startX, endX: selection.endX, startIndex: nearest(selection.startX), endIndex: nearest(selection.endX), active: true };
  }, [selection, xScale, times]);
}

interface ContextValueInput extends ChartBaseInput {
  readonly selection: { startX: number; endX: number } | null;
  readonly times: readonly number[];
  readonly clearSelection: () => void;
}

/** The hook FocusLayer calls with the focused row: the stable context plus the tooltip data and selection. */
export function contextValueHook({ selection, times, clearSelection, ...base }: ContextValueInput): (focused: CartesianFocus | null) => ChartContextValue {
  return function useContextValue(focused: CartesianFocus | null): ChartContextValue {
    const { stable, xScale, xAccessor, setTooltipData } = useChartBase(base);
    const chartSelection = useChartSelection(selection, xScale, times);
    const tooltipData = useMemo((): TooltipData | null => {
      if (!focused) {
        return null;
      }
      const yPositions: Record<string, number> = {};
      for (const line of stable.lines) {
        const value = focused.row[line.dataKey];
        if (typeof value === "number") {
          yPositions[line.dataKey] = (stable.yScales[String(line.yAxisId)] ?? stable.yScale)(value);
        }
      }
      return { point: focused.row, index: focused.index, x: stable.xScale(xAccessor(focused.row)), yPositions };
    }, [focused, stable, xAccessor]);
    return useMemo(() => ({ ...stable, tooltipData, setTooltipData, selection: chartSelection, clearSelection }), [stable, tooltipData, setTooltipData, chartSelection, clearSelection]);
  };
}
