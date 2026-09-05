import { useCallback, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { ChartPoint } from "@tanstack/charts";
import type { ScaleTime } from "d3-scale";
import { buildCrosshairGradientDef, useDatePillOverlay } from "./hover-geometry";
import type { CrosshairGradientDef, DatePillController } from "./hover-geometry";
import { resolveNearestIndex } from "./bisect";
import { toDate } from "./coerce-date";
import { isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import { isStringValue, stringifyDatumField } from "./composed-datum-text";
import { shortDateFmt } from "./formatters";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import { NOTHING } from "./composed-series";
import { useChartConfig } from "./use-chart-config";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import { useSanitizedId } from "./use-sanitized-id";

interface UseComposedFocusChromeParams {
  readonly chartPhase: ChartPhase;
  readonly clearFocus: (source: "pointer") => void;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly isLoaded: boolean;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly xDataKey: string;
  readonly xScaleRef: RefObject<ScaleTime<number, number> | null>;
}

interface UseComposedFocusChromeResult {
  readonly clearFocusChrome: () => void;
  readonly crosshairGradientDef: CrosshairGradientDef | undefined;
  readonly crosshairGradientId: string;
  readonly datePill: DatePillController;
  readonly handleFocusChange: (point: ChartPoint<ChartDatum, Date, number> | null) => void;
  readonly isDiscrete: boolean;
  readonly tooltipEnabled: boolean;
}

// Hides the pill without touching package focus (plain helper: both callers are plain callbacks).
const hideComposedPill = (pill: DatePillController, wasVisibleRef: RefObject<boolean>): void => {
  wasVisibleRef.current = false;
  pill.hide();
};

// Package-owned pointer: the definition owns pointermove/leave, so focus lands here
// Through ChartHost onFocusChange. The pill mirrors the focused datum; dim rides mark states.
const useComposedFocusChrome = (
  params: Readonly<UseComposedFocusChromeParams>,
): UseComposedFocusChromeResult => {
  const {
    chartPhase, clearFocus, data, dragSelectionActiveRef, isLoaded, renderData, tooltip, xDataKey, xScaleRef,
  } = params;
  const tooltipEnabled = tooltip?.enabled ?? false;
  const showDatePill = tooltipEnabled && (tooltip?.showDatePill ?? true);
  // Dense data snaps instead of springing (same threshold as every other chart).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
  const crosshairGradientId = useSanitizedId();
  const crosshairGradientDef = useMemo(() => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) {return NOTHING;}
    const color = isStringValue(tooltip?.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  const chartConfig = useChartConfig();
  // First pill show jumps; later moves spring (mirrors legacy showing flag).
  const wasVisibleRef = useRef(false);
  const dateLabelsForPill = useMemo(() => renderData.map((row: Readonly<ChartDatum>) => {
    const value = row[xDataKey];
    if (value instanceof Date) {return shortDateFmt.format(value);}
    return stringifyDatumField({ absent: "", value });
  }), [renderData, xDataKey]);
  const datePill = useDatePillOverlay({
    dateLabels: dateLabelsForPill,
    enabled: showDatePill,
    tooltipSpring: chartConfig.tooltipSpring,
  });

  const clearFocusChrome = useCallback(() => {
    clearFocus("pointer");
    hideComposedPill(datePill, wasVisibleRef);
  }, [datePill, clearFocus]);

  // Plain callback for the host prop (rebuilt when its inputs change; the definition never depends on it).
  const handleFocusChange = useCallback((point: ChartPoint<ChartDatum, Date, number> | null): void => {
    // Pre-load, mid-reveal and mid-drag focus never paints chrome (legacy suppression, kept).
    if (dragSelectionActiveRef.current || !isLoaded || !isChartInteractionPhase(chartPhase)) {
      clearFocusChrome();
      return;
    }
    if (!showDatePill) {
      hideComposedPill(datePill, wasVisibleRef);
      return;
    }
    if (!point) {
      hideComposedPill(datePill, wasVisibleRef);
      return;
    }
    const parsed = toDate(point.datum[xDataKey]);
    if (!parsed) {
      hideComposedPill(datePill, wasVisibleRef);
      return;
    }
    const resolvedX = xScaleRef.current?.(parsed) ?? point.x;
    if (!Number.isFinite(resolvedX)) {
      hideComposedPill(datePill, wasVisibleRef);
      return;
    }
    const rawIndex = resolveNearestIndex(
      data,
      (row: Readonly<ChartDatum>) => toDate(row[xDataKey])?.getTime() ?? Number.NaN,
      parsed.getTime(),
    );
    if (rawIndex < 0) {
      hideComposedPill(datePill, wasVisibleRef);
      return;
    }
    const jump = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    datePill.show(resolvedX, { discrete: isDiscrete, index: rawIndex, jump, label: shortDateFmt.format(parsed) });
  }, [chartPhase, clearFocusChrome, data, datePill, dragSelectionActiveRef, isDiscrete, isLoaded, showDatePill, xDataKey, xScaleRef]);

  return {
    clearFocusChrome,
    crosshairGradientDef,
    crosshairGradientId,
    datePill,
    handleFocusChange,
    isDiscrete,
    tooltipEnabled,
  };
};

export { useComposedFocusChrome };
export type { UseComposedFocusChromeParams, UseComposedFocusChromeResult };
