// Hook groups of the cartesian shell, each a contiguous run of the former CartesianChartMounted body (hook order unchanged).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { motion } from "@tanstack/charts/motion";
import { installMarkerSprings } from "../motion/marker-springs";
import { propsFor } from "../read-children";
import { shortDateFmt } from "../format";
import { useResizeBox } from "../size/use-resize-box";
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
import type { CartesianBuild } from "./definition";
import { erase } from "./erased-types";
import type { AnyInteraction } from "./erased-types";
import { chartMarkerProps } from "./overlays";
import { DEFAULT_Y_AXIS_ID, resolveSeries, toDate } from "./series";
import type { ResolvedSeries, Row } from "./series";

export interface CartesianFocus {
  readonly row: Row;
  readonly index: number;
  readonly time: number;
}

interface PlotMeasure {
  readonly fitHeight: number | undefined;
  readonly plotWidth: number;
  readonly measuredHeight: number;
  /** A fill-height host has a measured height; other hosts derive theirs from the width. */
  readonly sized: boolean;
}

/** Host size from one ResizeObserver: the fill-height box, and the plot width / height seeded from the first measure.
 * A fill-height host is also read in a layout effect, so the first draw already has its height (a later change would be a resize, which snaps the wipe tween). */
export function usePlotMeasure(containerRef: RefObject<HTMLDivElement | null>, fillHeight: boolean, initial: { readonly width: number; readonly height: number }): PlotMeasure {
  const box = useResizeBox(containerRef, initial);
  const [laidOut, setLaidOut] = useState(0);
  useLayoutEffect(() => {
    if (fillHeight) { setLaidOut(Math.round(containerRef.current?.clientHeight ?? 0)); }
  }, [containerRef, fillHeight]);
  const height = box.observed ? box.height : laidOut || box.height;
  const fitHeight = fillHeight && height > 0 && (box.observed || laidOut > 0) ? height : undefined;
  return { fitHeight, plotWidth: box.width, measuredHeight: height, sized: !fillHeight || fitHeight !== undefined };
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
  markerLists.current = hasMarkers ? chartMarkerProps(table).map((m) => m.items) : [];
  useEffect(() => {
    const el = containerRef.current;
    return hasMarkers && el ? installMarkerSprings(el, () => markerLists.current) : undefined;
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
  readonly built: CartesianBuild;
  readonly settle: (built: CartesianBuild) => void;
  readonly animationDuration: number;
  readonly table: SeriesTable["table"];
  readonly data: readonly Row[];
  readonly series: readonly ResolvedSeries[];
}

interface RendererTooltip {
  readonly renderer: ReturnType<typeof motion>;
  readonly renderTooltipBody: ({ points }: { points: never }) => ReactNode;
}

/** The entrance renderer and the tooltip body callback; also reports each built definition to the data-update step. */
export function useRendererTooltip({ built, settle, animationDuration, table, data, series }: RendererTooltipInput): RendererTooltip {
  useEffect(() => { settle(built); }, [built, settle]);
  const renderer = useMemo(
    () => motion(erase({ transition: { type: "tween", duration: animationDuration } })),
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
  readonly built: CartesianBuild;
  readonly series: readonly ResolvedSeries[];
  readonly data: readonly Row[];
  readonly xDataKey: string;
  readonly table: SeriesTable["table"];
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly ready: ReadyStore;
  readonly dragInteraction: RefObject<AnyInteraction | null>;
  readonly plotWidth: number;
  readonly plotHeight: number;
  readonly resolvedMargin: ChartMargin;
  readonly animationDuration: number;
  readonly xDomain: [Date, Date] | undefined;
  readonly xDomainSlotCount: number | undefined;
}

type StableContext = Omit<ChartContextValue, "tooltipData" | "setTooltipData" | "selection" | "clearSelection">;

interface ChartBase {
  readonly stable: StableContext;
  readonly xScale: ReturnType<typeof scaleUtc>;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly xAccessor: (d: Row) => Date;
  readonly xStart: number;
  readonly xEnd: number;
  readonly setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
}

/** The referentially stable part of the published chart context, and the scales it is built from. */
export function useChartBase(input: ChartBaseInput): ChartBase {
  const { built, series, data, xDataKey, table, containerRef, ready, dragInteraction, plotWidth, plotHeight, resolvedMargin, animationDuration, xDomain, xDomainSlotCount } = input;
  const innerWidth = Math.max(0, plotWidth - resolvedMargin.left - resolvedMargin.right);
  const innerHeight = Math.max(0, plotHeight - resolvedMargin.top - resolvedMargin.bottom);
  const xAccessor = useCallback((d: Row): Date => toDate(d[xDataKey]), [xDataKey]);
  // The children (and so `table` / `built`) are new objects on every parent render; key every
  // context field on its primitive content so the published context stays referentially stable.
  const xd = built.domains.x;
  const xStart = new Date(xd[0]).getTime();
  const xEnd = new Date(xd[1]).getTime();
  const yDomains = useStructural(built.domains.y, JSON.stringify(built.domains.y));
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
  return { stable, xScale, innerWidth, innerHeight, xAccessor, xStart, xEnd, setTooltipData };
}

/** bklit's `ChartSelection` (px x in the inner plot + data indices) for the Segment drag. */
export function useChartSelection(selection: { startX: number; endX: number } | null, xScale: ChartBase["xScale"], times: readonly number[]): ChartSelection | null {
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

interface ContextValueInput {
  readonly stable: StableContext;
  readonly xAccessor: (d: Row) => Date;
  readonly setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
  readonly chartSelection: ChartSelection | null;
  readonly clearSelection: () => void;
}

/** The hook FocusLayer calls with the focused row: the stable context plus the tooltip data and selection. */
export function contextValueHook({ stable, xAccessor, setTooltipData, chartSelection, clearSelection }: ContextValueInput): (focused: CartesianFocus | null) => ChartContextValue {
  return function useContextValue(focused: CartesianFocus | null): ChartContextValue {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable and xAccessor are the factory's closure; this function is the hook, so they are its real inputs.
    }, [focused, stable, xAccessor]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above: the factory's values are this hook's real inputs.
    return useMemo(() => ({ ...stable, tooltipData, setTooltipData, selection: chartSelection, clearSelection }), [stable, tooltipData, setTooltipData, chartSelection, clearSelection]);
  };
}
