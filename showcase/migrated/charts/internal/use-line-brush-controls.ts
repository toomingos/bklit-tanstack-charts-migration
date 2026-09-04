// Line-chart brush state: x accessor, visible data, time extent, and native brush controls.
import { useCallback, useMemo } from "react";
import type { ChartControl } from "@tanstack/charts";
import { brushX } from "@tanstack/charts/interaction/brush";
import type { BrushRange, BrushXChange } from "@tanstack/charts/interaction/brush";
import { controlledSignal } from "@tanstack/charts/interaction/signal";
import { createXAccessor, filterDataByXDomain, snapBrushRangeToValues } from "./brush-selection";
import type { BrushChildConfig, ChartDatum } from "./types";
import { mergeProjectionXDomainMax } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import { useLineBrushRange } from "./use-line-brush-range";
import { shortDateFmt } from "./formatters";
import { BRUSH_NATIVE_HIDDEN_STYLE, EMPTY_BRUSH_CONTROLS, scanRenderTimeExtent } from "./line-chart-support";

interface LineBrushControlsParams {
  readonly brushes: readonly BrushChildConfig[];
  readonly data: readonly Readonly<ChartDatum>[];
  readonly projectionConfigs: readonly ProjectionLineConfig[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
}

interface LineBrushControls {
  readonly brushConfig: BrushChildConfig | undefined;
  readonly brushControls: readonly ChartControl<Date, number>[];
  readonly brushFallbackRange: BrushRange<Date> | undefined;
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly brushTrackExtent: [Date, Date] | undefined;
  readonly brushValues: Date[] | undefined;
  readonly hasBrush: boolean;
  readonly timeExtent: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly timeExtentRaw: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly visibleData: readonly Readonly<ChartDatum>[];
  readonly xAccessorForBrush: (row: Readonly<ChartDatum>) => Date;
}

const useLineBrushControls = (params: Readonly<LineBrushControlsParams>): LineBrushControls => {
  const { brushes, data, projectionConfigs, renderData, xDataKey, xDomain } = params;
  // YDomain scans visibleData when brushing; marks stay on full data (domain-clamp).
  const xAccessorForBrush = useMemo(() => createXAccessor(xDataKey), [xDataKey]);
  const visibleData = useMemo(() => {
    if (!xDomain) {return data;}
    return filterDataByXDomain(data, xDomain, xAccessorForBrush);
  }, [data, xDomain, xAccessorForBrush]);

  const timeExtentRaw = useMemo(() => {
    if (xDomain) {return { maxTime: xDomain[1].getTime(), minTime: xDomain[0].getTime() } as const;}
    return scanRenderTimeExtent(renderData, xDataKey);
  }, [renderData, xDataKey, xDomain]);
  // Rendered x-domain extends the data extent by the projection tail; xDomain skips the merge.
  const timeExtent = useMemo((): { maxTime: number; minTime: number } | undefined => {
    if (!timeExtentRaw) {return undefined;}
    if (xDomain) {return timeExtentRaw;}
    if (projectionConfigs.length === 0) {return timeExtentRaw;}
    return { maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs), minTime: timeExtentRaw.minTime } as const;
  }, [timeExtentRaw, projectionConfigs, xDomain]);

  const brushConfig = brushes.at(0);
  const hasBrush = Boolean(brushConfig);
  const brushTrackExtent = useMemo((): [Date, Date] | undefined => {
    if (!timeExtent) {return undefined;}
    return [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)];
  }, [timeExtent]);
  const brushFallbackRange = useMemo((): BrushRange<Date> | undefined => {
    if (!brushTrackExtent) {return undefined;}
    return { end: brushTrackExtent[1], start: brushTrackExtent[0] };
  }, [brushTrackExtent]);
  const brushRangeValue = useLineBrushRange({ fallbackRange: brushFallbackRange, initialSelection: brushConfig?.initialSelection });
  const brushOnSelectionChange = brushConfig?.onSelectionChange;
  // Brush fires on every preview tick and commit (legacy tracked live), not commit-only.
  const handleBrushChange = useCallback((next: BrushRange<Readonly<Date>>, context: Readonly<{ reason: BrushXChange<Readonly<Date>> }>) => {
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
    if (!hasBrush) {return undefined;}
    const out: Date[] = [];
    for (const datum of data) {
      const value = xAccessorForBrush(datum);
      if (value instanceof Date) {out.push(value);}
    }
    return out;
  }, [hasBrush, data, xAccessorForBrush]);
  const brushControls = useMemo<readonly ChartControl<Date, number>[]>(() => {
    if (!hasBrush || !brushRangeValue || !brushValues || brushValues.length === 0) {return EMPTY_BRUSH_CONTROLS;}
    // Brush endpoints must be members of values (snap first).
    const snappedRange = snapBrushRangeToValues(brushRangeValue, brushValues) ?? brushRangeValue;
    return [
      brushX<Date>({
        ariaLabel: "Brush selection",
        endAriaLabel: "Selection end",
        format: (date: Readonly<Date>) => shortDateFmt.format(date),
        handleStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(snappedRange, handleBrushChange),
        selectionStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        startAriaLabel: "Selection start",
        values: brushValues,
      }),
    ];
  }, [hasBrush, brushRangeValue, brushValues, handleBrushChange]);
  return { brushConfig, brushControls, brushFallbackRange, brushRangeValue, brushTrackExtent, brushValues, hasBrush, timeExtent, timeExtentRaw, visibleData, xAccessorForBrush };
};

export { useLineBrushControls };
export type { LineBrushControls, LineBrushControlsParams };
