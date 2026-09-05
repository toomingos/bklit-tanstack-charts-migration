"use client";

import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { ChartDatum } from "./types";

interface DashTailSeries {
  readonly dataKey: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly dashFromIndex?: number;
  readonly dashArray?: string;
  // Bklit SeriesHoverDim gate (line.tsx `enabled`): false skips hover dim entirely.
  readonly dimEnabled?: boolean;
}

// Retry ceiling for the mount-timing loop: a persistent miss is a wiring defect, not a race.
const DASH_TAIL_MAX_MEASURE_ATTEMPTS = 120;

/*
 * Rows arrive as untyped user data, so the generic subject keeps the I/O boundary honest for runtime-typeof.
 */
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

interface Measured {
  readonly pathD: string;
  readonly pathLength: number;
  readonly dashStartX: number;
  readonly dashStartLength: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly dashArray: string;
}

const isMeasuredPathEqual = (left: Readonly<Measured>, right: Readonly<Measured>): boolean => {
  if (left.pathD !== right.pathD) {return false;}
  if (left.pathLength !== right.pathLength) {return false;}
  return left.dashStartX === right.dashStartX;
}

const isMeasuredStyleEqual = (left: Readonly<Measured>, right: Readonly<Measured>): boolean => {
  if (left.stroke !== right.stroke) {return false;}
  if (left.strokeWidth !== right.strokeWidth) {return false;}
  return left.dashArray === right.dashArray;
}

const isMeasuredEntryEqual = (left: Readonly<Measured>, right: Readonly<Measured>): boolean =>
  isMeasuredPathEqual(left, right) && isMeasuredStyleEqual(left, right);

const findSeriesPath = (container: HTMLElement | null, dataKey: string): SVGPathElement | undefined => {
  if (!container) {return undefined;}
  const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
  if (!marksGroup) {return undefined;}
  const escaped = dataKey.replaceAll('"', String.raw`\"`);
  const group = marksGroup.querySelector<SVGGElement>(`.ts-chart__line[data-ts-key^="${escaped}:"]`);
  return group?.querySelector<SVGPathElement>("path") ?? undefined;
}

interface ResolveDashStartXOptions {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly dashFromIndex: number;
  readonly xScale: (value: Readonly<Date> | number) => number | undefined;
  readonly xAccessor: (datum: Readonly<ChartDatum>) => Date | number;
}

const resolveDashStartX = (options: Readonly<ResolveDashStartXOptions>): number => {
  const dashFromPoint = options.data.at(options.dashFromIndex);
  if (!dashFromPoint) {
    return 0;
  }
  return options.xScale(options.xAccessor(dashFromPoint)) ?? 0;
}

interface DashTimeDomain {
  readonly minTime: number;
  readonly maxTime: number;
  readonly hasTimeDomain: boolean;
}

interface DashTimeBounds {
  minTime: number;
  maxTime: number;
}

const readDashTimeValue = (datum: Readonly<ChartDatum>, xDataKey: string): number | undefined => {
  const rawValue = datum[xDataKey];
  if (rawValue instanceof Date) {return rawValue.getTime();}
  if (isNumber(rawValue) && Number.isFinite(rawValue)) {return rawValue;}
  return undefined;
}

const trackDashTimeValue = (bounds: DashTimeBounds, datum: Readonly<ChartDatum>, xDataKey: string): void => {
  const time = readDashTimeValue(datum, xDataKey);
  if (time === undefined) {return;}
  if (time < bounds.minTime) {bounds.minTime = time;}
  if (time > bounds.maxTime) {bounds.maxTime = time;}
}

const computeDashTimeDomain = (renderData: readonly Readonly<ChartDatum>[], xDataKey: string): DashTimeDomain => {
  const bounds: DashTimeBounds = { maxTime: -Infinity, minTime: Infinity };
  for (const datum of renderData) {
    trackDashTimeValue(bounds, datum, xDataKey);
  }
  // Host bakes margins into scale ranges, so dashStartX is margin.left-inclusive absolute space.
  const hasTimeDomain = Number.isFinite(bounds.minTime) && Number.isFinite(bounds.maxTime);
  return { hasTimeDomain, maxTime: bounds.maxTime, minTime: bounds.minTime };
}

interface DashXScaleOptions {
  readonly domain: Readonly<DashTimeDomain>;
  readonly innerWidth: number;
  readonly marginLeft: number;
}

const createDashXScale = (options: Readonly<DashXScaleOptions>): ((value: Readonly<Date> | number) => number | undefined) => {
  const { domain, innerWidth, marginLeft } = options;
  return (value: Readonly<Date> | number): number | undefined => {
    if (!domain.hasTimeDomain) {return marginLeft;}
    const range = domain.maxTime - domain.minTime;
    if (range <= 0) {return marginLeft;}
    let millis = 0;
    if (value instanceof Date) {
      millis = value.getTime();
    } else if (isNumber(value)) {
      millis = value;
    } else {
      // Non-date values leave millis at zero, mapping to the domain start.
    }
    return marginLeft + ((millis - domain.minTime) / range) * innerWidth;
  };
}

const createDashXAccessor = (xDataKey: string): ((datum: Readonly<ChartDatum>) => Date | number) =>
  (datum: Readonly<ChartDatum>): Date | number => {
    const rawValue = datum[xDataKey];
    if (rawValue instanceof Date) {return rawValue;}
    if (isNumber(rawValue)) {return rawValue;}
    return 0;
  };

const readSeriesPathLength = (pathEl: SVGPathElement): { readonly pathData: string; readonly length: number } | undefined => {
  const pathData = pathEl.getAttribute("d");
  if (pathData === null || pathData === "") {return undefined;}
  const length = pathEl.getTotalLength();
  return length <= 0 ? undefined : { length, pathData };
}

interface MeasureDashEntryOptions {
  readonly entry: Readonly<DashTailSeries>;
  readonly container: HTMLElement | null;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xScale: (value: Readonly<Date> | number) => number | undefined;
  readonly xAccessor: (datum: Readonly<ChartDatum>) => Date | number;
}

interface MeasuredPathReading {
  readonly pathData: string;
  readonly length: number;
}

const readMeasuredSeriesPath = (container: HTMLElement | null, dataKey: string): MeasuredPathReading | undefined => {
  const pathElement = findSeriesPath(container, dataKey);
  if (!pathElement) {return undefined;}
  return readSeriesPathLength(pathElement);
}

const measureDashEntry = (options: Readonly<MeasureDashEntryOptions>): Measured | undefined => {
  const reading = readMeasuredSeriesPath(options.container, options.entry.dataKey);
  if (!reading) {return undefined;}
  const { dashFromIndex } = options.entry;
  if (dashFromIndex === undefined) {return undefined;}
  const dashStartX = resolveDashStartX({ dashFromIndex, data: options.renderData, xAccessor: options.xAccessor, xScale: options.xScale });
  return {
    dashArray: options.entry.dashArray ?? "6,4",
    dashStartLength: (dashFromIndex / Math.max(1, options.renderData.length - 1)) * reading.length,
    dashStartX,
    pathD: reading.pathData,
    pathLength: reading.length,
    stroke: options.entry.stroke,
    strokeWidth: options.entry.strokeWidth,
  };
}

interface DashCollectState {
  missing: boolean;
}

const collectSingleDashEntry = (next: Map<string, Measured>, state: DashCollectState, options: Readonly<MeasureDashEntryOptions>): void => {
  const entry = measureDashEntry(options);
  if (entry === undefined) {state.missing = true; return;}
  if (entry.dashStartLength >= entry.pathLength) {return;}
  next.set(options.entry.dataKey, entry);
}

interface DashMeasureReading {
  readonly next: Map<string, Measured>;
  readonly anyMissing: boolean;
  readonly measured: boolean;
}

interface CollectDashMeasurementsOptions {
  readonly activeSeries: readonly DashTailSeries[];
  readonly container: HTMLElement | null;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xScale: (value: Readonly<Date> | number) => number | undefined;
  readonly xAccessor: (datum: Readonly<ChartDatum>) => Date | number;
}

const collectDashMeasurements = (options: Readonly<CollectDashMeasurementsOptions>): DashMeasureReading => {
  const marksGroup = options.container?.querySelector<SVGGElement>(".ts-chart__marks");
  if (!marksGroup) {return { anyMissing: true, measured: false, next: new Map() };}
  const next = new Map<string, Measured>();
  const state: DashCollectState = { missing: false };
  for (const activeEntry of options.activeSeries) {
    collectSingleDashEntry(next, state, { container: options.container, entry: activeEntry, renderData: options.renderData, xAccessor: options.xAccessor, xScale: options.xScale });
  }
  return { anyMissing: state.missing, measured: true, next };
}

const resolveNextMeasured = (prev: Map<string, Measured>, next: Map<string, Measured>): Map<string, Measured> => {
  if (prev.size === next.size) {
    let same = true;
    for (const [entryKey, measuredEntry] of next) {
      const prevEntry = prev.get(entryKey);
      if (!prevEntry || !isMeasuredEntryEqual(prevEntry, measuredEntry)) {
        same = false;
        break;
      }
    }
    // Skip the write when unchanged: a fresh Map identity would re-render every frame.
    if (same) {return prev;}
  }
  return next;
}

interface DashTailMeasurementOptions {
  readonly activeSeries: readonly DashTailSeries[];
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly xDataKey: string;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly marginLeft: number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly onMeasured: (updater: (prev: Map<string, Measured>) => Map<string, Measured>) => void;
}

const useDashTailMeasurement = (options: Readonly<DashTailMeasurementOptions>): void => {
  const { activeSeries, containerRef, innerHeight, innerWidth, marginLeft, onMeasured, renderData, xDataKey } = options;
  useLayoutEffect((): (() => void) | undefined => {
    // No setState on the empty path: render already returns null, and setState here livelocks under the loading pulse.
    if (activeSeries.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
      return undefined;
    }
    let cancelled = false;
    let raf = 0;
    // Bounded mount-timing retry: a persistent miss is a wiring defect, not a race.
    let attempts = 0;

    const doMeasure = (): void => {
      const domain = computeDashTimeDomain(renderData, xDataKey);
      const xScale = createDashXScale({ domain, innerWidth, marginLeft });
      const xAccessor = createDashXAccessor(xDataKey);
      const reading = collectDashMeasurements({ activeSeries, container: containerRef.current, renderData, xAccessor, xScale });
      if (!cancelled && reading.measured) {onMeasured((prev) => resolveNextMeasured(prev, reading.next));}
      if (reading.anyMissing && !cancelled && attempts < DASH_TAIL_MAX_MEASURE_ATTEMPTS) {
        attempts += 1;
        raf = requestAnimationFrame(doMeasure);
      }
    };

    doMeasure();
    return (): void => {
      cancelled = true;
      if (raf) {cancelAnimationFrame(raf);}
    };
  }, [activeSeries, containerRef, innerHeight, innerWidth, marginLeft, onMeasured, renderData, xDataKey]);
}

export type { DashTailMeasurementOptions, DashTailSeries, Measured };
export { resolveDashStartX, useDashTailMeasurement };
