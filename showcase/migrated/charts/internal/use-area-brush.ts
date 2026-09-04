// Area brush hook: owns the brush range/controls group.
// Hook call order matches area-chart.tsx lines 1022-1077 exactly; logic moved verbatim.
import { useCallback, useMemo, useState } from "react";
import { brushX } from "@tanstack/charts/interaction/brush";
import type { BrushRange, BrushXChange } from "@tanstack/charts/interaction/brush";
import { controlledSignal } from "@tanstack/charts/interaction/signal";
import type { ChartControl, SceneStyle } from "@tanstack/charts";
import { snapBrushRangeToValues } from "./brush-selection";
import { shortDateFmt } from "./formatters";
import { isSameBrushRange } from "./area-chart-model";
import type { TimeExtentMs } from "./area-chart-model";
import type { BrushChildConfig, ChartDatum, ExtractedChildren } from "./types";

// Native brushX painting hidden; the BrushChrome portal reproduces bklit visuals.
const BRUSH_NATIVE_HIDDEN_STYLE: SceneStyle = {
  fill: "transparent",
  fillOpacity: 0,
  stroke: "transparent",
  strokeOpacity: 0,
};
const EMPTY_BRUSH_CONTROLS: readonly ChartControl<Date, number>[] = [];

interface AreaBrushParams {
  readonly brushes: ExtractedChildren["brushes"];
  readonly data: ChartDatum[];
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly xAccessorForBrush: (datum: Readonly<ChartDatum>) => Date;
}

interface AreaBrush {
  readonly brushConfig: BrushChildConfig | undefined;
  readonly brushControls: readonly ChartControl<Date, number>[];
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly brushTrackExtent: [Date, Date] | undefined;
  readonly hasBrush: boolean;
}

const useAreaBrush = (params: Readonly<AreaBrushParams>): AreaBrush => {
  const { brushes, data, timeExtent, xAccessorForBrush } = params;
  const brushConfig: BrushChildConfig | undefined = brushes.at(0);
  const hasBrush = Boolean(brushConfig);
  const brushTrackExtent = useMemo<[Date, Date] | undefined>(
    () => timeExtent === undefined ? undefined : [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)],
    [timeExtent],
  );
  const brushFallbackRange = useMemo((): BrushRange<Date> | undefined => {
    if (!brushTrackExtent) {return undefined;}
    return { end: brushTrackExtent[1], start: brushTrackExtent[0] };
  }, [brushTrackExtent]);
  const brushInitialSelection = brushConfig?.initialSelection;
  const nextBrushRangeValue: BrushRange<Date> | undefined = brushInitialSelection
    ? { end: brushInitialSelection.end, start: brushInitialSelection.start }
    : brushFallbackRange;
  const [brushRangeValue, setBrushRangeValue] = useState<BrushRange<Date> | undefined>(nextBrushRangeValue);
  if (!isSameBrushRange(brushRangeValue, nextBrushRangeValue)) {
    setBrushRangeValue(nextBrushRangeValue);
  }
  const brushOnSelectionChange = brushConfig?.onSelectionChange;
  const handleBrushChange = useCallback((next: BrushRange<Date>, context: Readonly<{ reason: BrushXChange<Date> }>) => {
    const { reason } = context;
    if (reason.type === "cancel") {return;}
    const startMs = next.start.getTime();
    const endMs = next.end.getTime();
    if (startMs === endMs) {
      if (reason.type === "commit") {brushOnSelectionChange?.(null);}
      return;
    }
    brushOnSelectionChange?.({ end: next.end, start: next.start });
  }, [brushOnSelectionChange]);
  const brushValues = useMemo((): Date[] | undefined => {
    if (!hasBrush) {return undefined;}
    const out: Date[] = [];
    for (const datum of data) {
      const xValue = xAccessorForBrush(datum);
      if (xValue instanceof Date) {out.push(xValue);}
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
        format: (date: Date) => shortDateFmt.format(date),
        handleStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(snappedRange, handleBrushChange),
        selectionStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        startAriaLabel: "Selection start",
        values: brushValues,
      }),
    ];
  }, [hasBrush, brushRangeValue, brushValues, handleBrushChange]);

  return {
    brushConfig,
    brushControls,
    brushRangeValue,
    brushTrackExtent,
    hasBrush,
  };
};

export { useAreaBrush };
export type { AreaBrush, AreaBrushParams };
