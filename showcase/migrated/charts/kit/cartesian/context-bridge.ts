// Shared plumbing publishing the public chart context (`useChart()`) from the non-cartesian charts (Bar / Candlestick / Scatter / Composed): derived from the host size,
// the resolved domains and the native `onFocusChange` point, reading only the host's own box (ResizeObserver), like CartesianChart.
import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleLinear, ScaleTime } from "d3-scale";
import type { ChartContextValue, LineConfig, Margin, ReferenceAreaConfig, TooltipData } from "./chart-context";
import { tooltipSetter } from "./chart-context-focus";
import { useGateReady } from "../entrance/reveal-arm";
import type { ReadyStore } from "../entrance/reveal-arm";
import { propsFor } from "../read-children";
import type { ChildTable } from "../read-children";
import { DEFAULT_Y_AXIS_ID } from "./series";
import type { Row } from "./series";

export const timeScale = (domain: readonly [Date, Date], innerWidth: number): ScaleTime<number, number> =>
  scaleUtc().domain([...domain]).range([0, innerWidth]);

export const valueScale = (domain: readonly [number, number], innerHeight: number, nice = false): ScaleLinear<number, number> => {
  const scale = scaleLinear().domain([...domain]).range([innerHeight, 0]);
  return nice ? scale.nice() : scale;
};

/** `ReferenceArea` bands of a chart's child table (bklit `extractReferenceAreaConfigs`), stable per content. */
export function useReferenceAreas(table: ChildTable): ReferenceAreaConfig[] {
  const rows = propsFor<{ yAxisId?: string | number; y1?: number; y2?: number; axisLabelColor?: string }>(table, "referenceArea");
  const key = JSON.stringify(rows.map((r) => [r.yAxisId, r.y1, r.y2, r.axisLabelColor]));
  return useMemo(
    () =>
      // SAFETY: key is JSON.stringify of the tuples mapped from `rows` above.
      (JSON.parse(key) as [string | number | undefined, number | undefined, number | undefined, string | undefined][]).map(
        ([yAxisId, y1, y2, axisLabelColor]): ReferenceAreaConfig => ({ yAxisId: String(yAxisId ?? DEFAULT_Y_AXIS_ID), y1, y2, axisLabelColor }),
      ),
    [key],
  );
}

/** Keeps the first value seen for a structural `key`, so identity only changes when content does. */
export function useStructural<T>(value: T, key: string): T {
  const ref = useRef<{ key: string; value: T } | null>(null);
  if (ref.current === null || ref.current.key !== key) {
    ref.current = { key, value };
  }
  return ref.current.value;
}

const scaleKey = (scale: ScaleLinear<number, number> | ScaleTime<number, number>): string =>
  `${scale.domain().map(Number).join(",")}|${scale.range().join(",")}`;

export interface FocusedRow {
  readonly row: Row;
  readonly index: number;
}

interface BridgeInput {
  readonly data: readonly Row[];
  readonly margin: Margin;
  readonly size: { readonly width: number; readonly height: number };
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** The chart's `useReadyGate` store: `isLoaded` follows it. */
  readonly ready: ReadyStore;
  readonly xScale: ScaleTime<number, number>;
  readonly yScales: Record<string, ScaleLinear<number, number>>;
  readonly lines: LineConfig[];
  readonly animationDuration: number;
  readonly xAccessor: (d: Row) => Date;
  readonly dateLabels: string[];
  readonly focused: FocusedRow | null;
  /** Pixel x (inner plot coordinates) of the focused row; defaults to `xScale(xAccessor(row))`. */
  readonly xAt?: (focused: FocusedRow) => number;
  /** Chart-specific fields (hovered indices, band geometry, ...). Memoise array / map values. */
  readonly extras?: Partial<ChartContextValue>;
  /** Focuses data row `index` (null clears); backs `setTooltipData`. Absent: the setter is a no-op. */
  readonly focusRow?: (index: number | null) => void;
  /** `ReferenceArea` bands in tree order (memoised). */
  readonly referenceAreas?: ReferenceAreaConfig[];
}

const NO_BANDS: ReferenceAreaConfig[] = [];
const noFocus = (): void => undefined;

/** The public context value for a non-cartesian chart; the hover slice follows `focused`. */
export function useBridgedContext(input: BridgeInput): ChartContextValue {
  const { data, size, containerRef, ready, animationDuration, xAccessor, focused, xAt, extras, focusRow = noFocus, referenceAreas = NO_BANDS } = input;
  const isLoaded = useGateReady(ready);
  const setTooltipData = useMemo(() => tooltipSetter(focusRow), [focusRow]);
  // Hosts rebuild these from fresh children each render; the published context must stay
  // referentially stable (user effects key on it), so reuse the first object per content.
  const margin = useStructural(input.margin, JSON.stringify(input.margin));
  const xScale = useStructural(input.xScale, scaleKey(input.xScale));
  const yScales = useStructural(input.yScales, Object.entries(input.yScales).map(([id, sc]) => `${id}:${scaleKey(sc)}`).join(";"));
  const lines = useStructural(input.lines, JSON.stringify(input.lines));
  const dateLabels = useStructural(input.dateLabels, input.dateLabels.join("|"));
  const innerWidth = Math.max(0, size.width - margin.left - margin.right);
  const innerHeight = Math.max(0, size.height - margin.top - margin.bottom);
  const yScale = new Map(Object.entries(yScales)).get(DEFAULT_Y_AXIS_ID) ?? Object.values(yScales).at(0) ?? scaleLinear().domain([0, 100]).range([innerHeight, 0]);
  const yDomainTargetByAxis = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(yScales).map(([id, sc]): [string, [number, number]] => {
          const [min = 0, max = 0] = sc.domain();
          return [id, [min, max]];
        }),
      ),
    [yScales],
  );
  const tooltipData = useMemo((): TooltipData | null => {
    if (!focused) {
      return null;
    }
    const yPositions: Record<string, number> = {};
    for (const line of lines) {
      const value = focused.row[line.dataKey];
      if (typeof value === "number") {
        yPositions[line.dataKey] = (yScales[String(line.yAxisId ?? DEFAULT_Y_AXIS_ID)] ?? yScale)(value);
      }
    }
    return { point: focused.row, index: focused.index, x: xAt ? xAt(focused) : xScale(xAccessor(focused.row)), yPositions };
  }, [focused, lines, yScales, yScale, xAt, xScale, xAccessor]);
  return useMemo(
    (): ChartContextValue => ({
      // SAFETY: `data` is only read; the context types rows as a mutable array.
      data: data as Row[],
      // SAFETY: `data` is only read; the context types rows as a mutable array.
      renderData: data as Row[],
      xScale,
      yScale,
      yScales,
      width: size.width,
      height: size.height,
      innerWidth,
      innerHeight,
      margin,
      containerRef,
      lines,
      animationDuration,
      isLoaded,
      chartPhase: isLoaded ? "ready" : "revealing",
      chartStatus: "ready",
      yDomainTargetByAxis,
      referenceAreas,
      xAccessor,
      dateLabels,
      ...extras,
      tooltipData,
      setTooltipData,
    }),
    [isLoaded, yDomainTargetByAxis, referenceAreas, setTooltipData, data, xScale, yScale, yScales, size.width, size.height, innerWidth, innerHeight, margin, containerRef, lines, animationDuration, xAccessor, dateLabels, extras, tooltipData],
  );
}
