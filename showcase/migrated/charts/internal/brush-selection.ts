"use client";

// bklit filter-data-by-x-domain.ts + chart-brush-layout.tsx:40-98 — state +
// layout pure-function + state-owner layer. Ported verbatim (adapt
// imports/types only) from repos/bklit-ui/packages/ui/src/charts/filter-data-by-x-domain.ts
// and repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:47-98.
// Comment citations refer to the bklit file:line of the original.

import * as React from "react";

export interface BrushSelection {
  start: Date;
  end: Date;
}

export interface BrushLayoutState {
  xDomain: [Date, Date] | undefined;
  xDomainSlotCount: number | undefined;
  brushSelection: BrushSelection | null;
  onBrushSelectionChange: (selection: BrushSelection | null) => void;
}

export interface UseBrushSelectionOptions {
  data: Record<string, unknown>[];
  xDataKey?: string;
  xExtentMax?: Date;
  enabled: boolean;
}

export interface UseBrushSelectionResult extends BrushLayoutState {
  fullExtent: [Date, Date] | null;
  handleBrushSelectionChange: (selection: BrushSelection | null) => void;
}

// repos/bklit-ui/packages/ui/src/charts/filter-data-by-x-domain.ts:1-15
export function filterDataByXDomain(
  data: Record<string, unknown>[],
  xDomain: [Date, Date],
  xAccessor: (d: Record<string, unknown>) => Date,
): Record<string, unknown>[] {
  const start = xDomain[0].getTime();
  const end = xDomain[1].getTime();
  const minTime = Math.min(start, end);
  const maxTime = Math.max(start, end);

  // repos/bklit-ui/packages/ui/src/charts/filter-data-by-x-domain.ts:11-14 — inclusive bounds
  return data.filter((d) => {
    const time = xAccessor(d).getTime();
    return time >= minTime && time <= maxTime;
  });
}

// repos/bklit-ui/packages/ui/src/charts/filter-data-by-x-domain.ts:17-43
export function resolveDataXExtent(
  data: Record<string, unknown>[],
  xAccessor: (d: Record<string, unknown>) => Date,
): [Date, Date] | null {
  if (data.length === 0) {
    return null;
  }

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

  if (minTime === Number.POSITIVE_INFINITY) {
    return null;
  }

  return [new Date(minTime), new Date(maxTime)];
}

// repos/bklit-ui/packages/ui/src/charts/filter-data-by-x-domain.ts:46-59
export function resolveBrushTrackXExtent(
  data: Record<string, unknown>[],
  xAccessor: (d: Record<string, unknown>) => Date,
  xExtentMax?: Date,
): [Date, Date] | null {
  const extent = resolveDataXExtent(data, xAccessor);
  if (!extent) {
    return null;
  }
  if (!xExtentMax || xExtentMax.getTime() <= extent[1].getTime()) {
    return extent;
  }
  return [extent[0], xExtentMax];
}

// repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:40-45
export function createXAccessor(xDataKey: string) {
  return (d: Record<string, unknown>): Date => {
    const value = d[xDataKey];
    return value instanceof Date ? value : new Date(value as string | number);
  };
}

// repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:47-98 —
// dataset swap resets the brush (useEffect, not initializer), clear (= null)
// means BACK TO FULL EXTENT never undefined, slot-count is ALWAYS the full
// dataset length (load-bearing: column widths stay constant while zooming).
export function useBrushSelection(
  options: UseBrushSelectionOptions,
): UseBrushSelectionResult {
  const { data, xDataKey = "date", xExtentMax, enabled } = options;

  // repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:58-62
  const xAccessor = React.useMemo(
    () => createXAccessor(xDataKey),
    [xDataKey],
  );
  const fullExtent = React.useMemo(
    () => resolveBrushTrackXExtent(data, xAccessor, xExtentMax),
    [data, xAccessor, xExtentMax],
  );

  const [brushSelection, setBrushSelection] =
    React.useState<BrushSelection | null>(null);

  // repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:66-72 — useEffect NOT initializer
  React.useEffect(() => {
    if (!fullExtent) {
      setBrushSelection(null);
      return;
    }
    setBrushSelection({ start: fullExtent[0], end: fullExtent[1] });
  }, [fullExtent]);

  // repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:74-85 — null (zero-width drag) resets to full extent
  const handleBrushSelectionChange = React.useCallback(
    (selection: BrushSelection | null) => {
      if (!selection) {
        if (fullExtent) {
          setBrushSelection({ start: fullExtent[0], end: fullExtent[1] });
        }
        return;
      }
      setBrushSelection(selection);
    },
    [fullExtent],
  );

  // repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:87-98 — xDomain gated by enabled && selection; slotCount = full data.length
  const layoutState = React.useMemo<BrushLayoutState>(
    () => ({
      xDomain:
        enabled && brushSelection
          ? ([brushSelection.start, brushSelection.end] as [Date, Date])
          : undefined,
      xDomainSlotCount: enabled ? data.length : undefined,
      brushSelection,
      onBrushSelectionChange: handleBrushSelectionChange,
    }),
    [brushSelection, data.length, enabled, handleBrushSelectionChange],
  );

  return React.useMemo<UseBrushSelectionResult>(
    () => ({
      ...layoutState,
      fullExtent,
      handleBrushSelectionChange,
      onBrushSelectionChange: handleBrushSelectionChange,
      brushSelection: layoutState.brushSelection,
    }),
    [layoutState, fullExtent, handleBrushSelectionChange],
  );
}
