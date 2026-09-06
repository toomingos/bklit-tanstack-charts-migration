// Brush layer (V1.4): native brushX control, range state and track extent.
// Host-mounted only with a brush child; full-data extent equals rendered.
"use client";

import { useCallback, useMemo } from "react";
import type { ChartControl } from "@tanstack/charts";
import { brushX } from "@tanstack/charts/interaction/brush";
import type { BrushRange, BrushXChange } from "@tanstack/charts/interaction/brush";
import { controlledSignal } from "@tanstack/charts/interaction/signal";
import { useChartChild } from "./use-chart-child";
import { createXAccessor, snapBrushRangeToValues } from "./brush-selection";
import { shortDateFmt } from "./formatters";
import { BRUSH_NATIVE_HIDDEN_STYLE, EMPTY_BRUSH_CONTROLS, maxProjectionTailTime, normalizeProjectionLineConfigs, scanRenderTimeExtent } from "./line-chart-support";
import { useLineBrushRange } from "./use-line-brush-range";
import type { ChartDatum, ExtractedChildren } from "./types";

interface BrushLayerInputs {
  readonly data: readonly ChartDatum[] | undefined;
  readonly xDataKey?: string;
  readonly xDomain?: readonly [Date, Date];
}

interface BrushLayerProps {
  readonly brushes: ExtractedChildren["brushes"];
  readonly projectionLines: ExtractedChildren["projectionLines"];
  readonly inputs: BrushLayerInputs;
}

const BrushLayer = (properties: Readonly<BrushLayerProps>): null => {
  const { brushes, projectionLines, inputs } = properties;
  const { data, xDataKey = "date", xDomain } = inputs;
  // Dispatcher presence-gates this; destructuring keeps carrier props valid.
  const [brushConfig] = brushes;
  const xAccessorForBrush = useMemo(() => createXAccessor(xDataKey), [xDataKey]);
  const timeExtentRaw = useMemo(() => {
    if (data === undefined) {return undefined;}
    if (xDomain) {return { maxTime: xDomain[1].getTime(), minTime: xDomain[0].getTime() } as const;}
    return scanRenderTimeExtent(data, xDataKey);
  }, [data, xDataKey, xDomain]);
  // Rendered x-domain extends the data extent by the projection tail; xDomain skips the merge.
  // Tail merges over normalized configs (two-point minimum), like the entry.
  const projectionConfigs = useMemo(() => normalizeProjectionLineConfigs(projectionLines), [projectionLines]);
  const timeExtent = useMemo((): { maxTime: number; minTime: number } | undefined => {
    if (!timeExtentRaw) {return undefined;}
    if (xDomain) {return timeExtentRaw;}
    if (projectionConfigs.length === 0) {return timeExtentRaw;}
    const maxTime = maxProjectionTailTime(projectionConfigs, timeExtentRaw.maxTime);
    if (maxTime === timeExtentRaw.maxTime) {return timeExtentRaw;}
    return { maxTime, minTime: timeExtentRaw.minTime } as const;
  }, [timeExtentRaw, projectionConfigs, xDomain]);
  const brushTrackExtent = useMemo((): [Date, Date] | undefined => {
    if (!timeExtent) {return undefined;}
    return [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)];
  }, [timeExtent]);
  const brushFallbackRange = useMemo((): BrushRange<Date> | undefined => {
    if (!brushTrackExtent) {return undefined;}
    return { end: brushTrackExtent[1], start: brushTrackExtent[0] };
  }, [brushTrackExtent]);
  const brushRangeValue = useLineBrushRange({ fallbackRange: brushFallbackRange, initialSelection: brushConfig.initialSelection });
  const brushOnSelectionChange = brushConfig.onSelectionChange;
  // Brush fires on every preview tick and commit (legacy tracked live), not commit-only.
  const handleBrushChange = useCallback((next: BrushRange<Date>, context: Readonly<{ reason: BrushXChange<Date> }>) => {
    const { reason } = context;
    if (reason.type === "cancel") {return;}
    const startMs = next.start.getTime();
    const endMs = next.end.getTime();
    if (startMs === endMs) {
      // Zero-width clears only on commit; transient mid-drag previews must not null xDomain.
      if (reason.type === "commit") {brushOnSelectionChange?.(null);}
      return;
    }
    brushOnSelectionChange?.({ end: next.end, start: next.start });
  }, [brushOnSelectionChange]);
  // Brush values use full (non-decimated) x data for snap points and keyboard stepping.
  const brushValues = useMemo((): Date[] | undefined => {
    if (data === undefined) {return undefined;}
    const out: Date[] = [];
    for (const datum of data) {
      const value = xAccessorForBrush(datum);
      if (value instanceof Date) {out.push(value);}
    }
    return out;
  }, [data, xAccessorForBrush]);
  const brushControls = useMemo<readonly ChartControl<Date, number>[]>(() => {
    if (!brushRangeValue || !brushValues || brushValues.length === 0) {return EMPTY_BRUSH_CONTROLS;}
    // Brush endpoints must be members of values (snap first).
    const snappedRange = snapBrushRangeToValues(brushRangeValue, brushValues) ?? brushRangeValue;
    return [
      brushX<Date>({
        ariaLabel: "Brush selection",
        endAriaLabel: "Selection end",
        format: (date: Date) => shortDateFmt.format(date),
        handleStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(snappedRange, handleBrushChange),
        selectionStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        startAriaLabel: "Selection start",
        values: brushValues,
      }),
    ];
  }, [brushRangeValue, brushValues, handleBrushChange]);
  const contribution = useMemo(() => {
    if (data === undefined) {return undefined;}
    return {
      brush: {
        config: brushConfig,
        controls: brushControls,
        hasBrush: true,
        range: brushRangeValue,
        trackExtent: brushTrackExtent,
      },
    } as const;
  }, [data, brushConfig, brushControls, brushRangeValue, brushTrackExtent]);
  useChartChild("layer:brush", brushConfig, contribution);
  return null;
};

export { BrushLayer };
