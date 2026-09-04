"use client";

// Brush state + layout (bklit filter-data-by-x-domain + brush-layout port).

import { useCallback, useMemo, useState } from "react";
import type { ChartDatum } from "./types";
import { toDate } from "./coerce-date";

interface BrushSelection {
  readonly start: Date;
  readonly end: Date;
}

interface BrushLayoutState {
  readonly xDomain: [Date, Date] | undefined;
  readonly xDomainSlotCount: number | undefined;
  readonly brushSelection: BrushSelection | null;
  readonly onBrushSelectionChange: (selection: BrushSelection | null) => void;
}

interface UseBrushSelectionOptions {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xDataKey?: string;
  readonly xExtentMax?: Date;
  readonly enabled: boolean;
}

interface UseBrushSelectionResult extends BrushLayoutState {
  readonly fullExtent: [Date, Date] | null;
  readonly handleBrushSelectionChange: (selection: BrushSelection | null) => void;
}

// Repos/bklit-ui/packages/ui/src/charts/filter-data-by-x-domain.ts:1-15
const filterDataByXDomain = (data: readonly Readonly<ChartDatum>[], xDomain: readonly [Date, Date], xAccessor: (row: Readonly<ChartDatum>) => Date): ChartDatum[] => {
  const start = xDomain[0].getTime();
  const end = xDomain[1].getTime();
  const minTime = Math.min(start, end);
  const maxTime = Math.max(start, end);

  return data.filter((row) => {
    const time = xAccessor(row).getTime();
    return time >= minTime && time <= maxTime;
  });
}

const toTimeBoundsOrNull = (minTime: number, maxTime: number): { minTime: number; maxTime: number } | null => {
  if (minTime === Number.POSITIVE_INFINITY) {
    return null;
  }
  return { maxTime, minTime };
}

const findDataTimeBounds = (data: readonly Readonly<ChartDatum>[], xAccessor: (row: Readonly<ChartDatum>) => Date): { minTime: number; maxTime: number } | null => {
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  for (const point of data) {
    const time = xAccessor(point).getTime();
    if (time < minTime) {
      minTime = time;
    }
    if (time > maxTime) {
      maxTime = time;
    }
  }
  return toTimeBoundsOrNull(minTime, maxTime);
}

const resolveDataXExtent = (data: readonly Readonly<ChartDatum>[], xAccessor: (row: Readonly<ChartDatum>) => Date): [Date, Date] | null => {
  const bounds = findDataTimeBounds(data, xAccessor);
  if (!bounds) {
    return null;
  }
  return [new Date(bounds.minTime), new Date(bounds.maxTime)];
}

const resolveBrushTrackXExtent = (data: readonly Readonly<ChartDatum>[], xAccessor: (row: Readonly<ChartDatum>) => Date, xExtentMax?: Date): [Date, Date] | null => {
  const extent = resolveDataXExtent(data, xAccessor);
  if (!extent) {
    return null;
  }
  if (!xExtentMax || xExtentMax.getTime() <= extent[1].getTime()) {
    return extent;
  }
  return [extent[0], xExtentMax];
}

const createXAccessor = (xDataKey: string) => (row: Readonly<ChartDatum>): Date => {
    const value = row[xDataKey];
    if (value instanceof Date) {return value;}
    return toDate(value) ?? new Date(String(value));
  };

// Dataset swap resets both the latched extent and the selection back to full extent.
const syncBrushToFullExtent = (fullExtent: [Date, Date] | null, setPrevFullExtent: (extent: [Date, Date] | null) => void, setBrushSelection: (selection: BrushSelection | null) => void): void => {
  setPrevFullExtent(fullExtent);
  setBrushSelection(
    fullExtent ? { end: fullExtent[1], start: fullExtent[0] } : null,
  );
}

// Null (zero-width drag) resets to full extent.
const applyBrushSelectionChange = (selection: BrushSelection | null, fullExtent: [Date, Date] | null, setBrushSelection: (selection: BrushSelection | null) => void): void => {
  if (!selection) {
    if (fullExtent) {
      setBrushSelection({ end: fullExtent[1], start: fullExtent[0] });
    }
    return;
  }
  setBrushSelection(selection);
}

interface BrushLayoutStateParams {
  readonly brushSelection: BrushSelection | null;
  readonly dataLength: number;
  readonly enabled: boolean;
  readonly handleBrushSelectionChange: (selection: BrushSelection | null) => void;
}

const buildBrushLayoutState = ({ brushSelection, dataLength, enabled, handleBrushSelectionChange }: BrushLayoutStateParams): BrushLayoutState => ({
  brushSelection,
  onBrushSelectionChange: handleBrushSelectionChange,
  xDomain:
    enabled && brushSelection
      ? [brushSelection.start, brushSelection.end]
      : undefined,
  xDomainSlotCount: enabled ? dataLength : undefined,
});

interface BrushSelectionResultParams {
  readonly layoutState: BrushLayoutState;
  readonly fullExtent: [Date, Date] | null;
  readonly handleBrushSelectionChange: (selection: BrushSelection | null) => void;
}

const buildBrushSelectionResult = ({ layoutState, fullExtent, handleBrushSelectionChange }: BrushSelectionResultParams): UseBrushSelectionResult => ({
  ...layoutState,
  brushSelection: layoutState.brushSelection,
  fullExtent,
  handleBrushSelectionChange,
  onBrushSelectionChange: handleBrushSelectionChange,
});


// Dataset swap resets the brush via effect; null clears back to full extent; slot count stays full length.
const useBrushSelection = (options: Readonly<UseBrushSelectionOptions>): UseBrushSelectionResult => {
  const { data, xDataKey = "date", xExtentMax, enabled } = options;

  const xAccessor = useMemo(
    () => createXAccessor(xDataKey),
    [xDataKey],
  );
  const fullExtent = useMemo(
    () => resolveBrushTrackXExtent(data, xAccessor, xExtentMax),
    [data, xAccessor, xExtentMax],
  );

  const [brushSelection, setBrushSelection] =
    useState<BrushSelection | null>(null);
  const [prevFullExtent, setPrevFullExtent] =
    useState<[Date, Date] | null>(null);

  // Dataset swap resets the brush (adjust state during render, not in an effect).
  if (fullExtent !== prevFullExtent) {
    syncBrushToFullExtent(fullExtent, setPrevFullExtent, setBrushSelection);
  }

  const handleBrushSelectionChange = useCallback(
    (selection: BrushSelection | null): void => {
      applyBrushSelectionChange(selection, fullExtent, setBrushSelection);
    },
    [fullExtent],
  );

  const layoutState = useMemo<BrushLayoutState>(
    () => buildBrushLayoutState({ brushSelection, dataLength: data.length, enabled, handleBrushSelectionChange }),
    [brushSelection, data.length, enabled, handleBrushSelectionChange],
  );

  return useMemo<UseBrushSelectionResult>(
    () => buildBrushSelectionResult({ fullExtent, handleBrushSelectionChange, layoutState }),
    [layoutState, fullExtent, handleBrushSelectionChange],
  );
}

const isCloserValue = (candidate: Date | undefined, bestDist: number, targetTime: number): candidate is Date => candidate !== undefined && Math.abs(candidate.getTime() - targetTime) < bestDist;

interface NearestValueSearchParams {
  readonly values: readonly Date[];
  readonly targetTime: number;
  readonly best: Date;
  readonly bestDist: number;
}

const searchNearestValue = ({ values, targetTime, best, bestDist }: NearestValueSearchParams): Date => {
  let current = best;
  let currentDist = bestDist;
  for (let valueIndex = 1; valueIndex < values.length; valueIndex += 1) {
    const candidate = values.at(valueIndex);
    if (isCloserValue(candidate, currentDist, targetTime)) {
      current = candidate;
      currentDist = Math.abs(candidate.getTime() - targetTime);
    }
  }
  return current;
};

const findNearestValue = (values: readonly Date[], target: Date): Date => {
  const targetTime = target.getTime();
  const firstValue = values.at(0);
  if (firstValue === undefined) {return target;}
  return searchNearestValue({ best: firstValue, bestDist: Math.abs(firstValue.getTime() - targetTime), targetTime, values });
};

/** Snaps a controlled brush range onto native `values` members (brushX requires endpoints in `values`).
 * @param {{ readonly start: Date; readonly end: Date } | null} range - Controlled range to snap; absent or empty-value inputs pass through untouched.
 * @param {readonly Date[] | null} values - Native domain members eligible as snap targets.
 * @returns {{ start: Date; end: Date } | null} Range with both endpoints snapped to members, or the original reference when already snapped or unsnappable.
 */
const snapBrushRangeToValues = (range: { readonly start: Date; readonly end: Date } | null, values: readonly Date[] | null): { start: Date; end: Date } | null => {
  if (!range || !values || values.length === 0) {return range;}
  const start = findNearestValue(values, range.start);
  const end = findNearestValue(values, range.end);
  if (start === range.start && end === range.end) {return range;}
  return { end, start };
}

export type { BrushSelection, BrushLayoutState, UseBrushSelectionOptions, UseBrushSelectionResult };
export {
  filterDataByXDomain,
  resolveDataXExtent,
  resolveBrushTrackXExtent,
  createXAccessor,
  useBrushSelection,
  snapBrushRangeToValues,
};
