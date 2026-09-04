// Line-chart focus chrome: date-pill labels, active-marker store, and focus handlers.
import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChartPoint } from "@tanstack/charts";
import { useDatePillOverlay } from "./hover-geometry";
import { useChartConfig } from "./use-chart-config";
import { createActiveMarkersStore } from "./active-markers-store";
import { toDate } from "./coerce-date";
import { shortDateFmt } from "./formatters";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import type { LabelFadeState } from "./line-x-scale";
import {
  gateFocusPrimary,
  isNumber,
  isString,
  resolveProfitLossSignIndex,
  stringifyDatumValue,
  syncDatePillChrome,
} from "./line-chart-support";
import type { FocusClearRef, FocusPoint } from "./line-chart-support";

interface LineFocusChromeParams {
  readonly chartPhase: ChartPhase;
  readonly interactionRef: FocusClearRef;
  readonly isDiscrete: boolean;
  readonly isLoaded: boolean;
  readonly profitLossLines: readonly Readonly<{ readonly dataKey: string }>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly setHoveredIndex: Dispatch<SetStateAction<number | null>>;
  readonly setLabelFade: Dispatch<SetStateAction<LabelFadeState | undefined>>;
  readonly setPlTooltipSignIndex: Dispatch<SetStateAction<number | null>>;
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
}

interface LineFocusChrome {
  readonly clearFocusChrome: () => void;
  readonly datePill: Readonly<ReturnType<typeof useDatePillOverlay>>;
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly handleFocusChange: (points: readonly Readonly<ChartPoint<ChartDatum, Readonly<Date>, number>>[]) => void;
  readonly markerActiveStore: Readonly<ReturnType<typeof createActiveMarkersStore>>;
  readonly wasVisibleRef: RefObject<boolean>;
}

const useLineFocusChrome = (params: Readonly<LineFocusChromeParams>): LineFocusChrome => {
  const { chartPhase, interactionRef, isDiscrete, isLoaded, profitLossLines, renderData, setHoveredIndex, setLabelFade, setPlTooltipSignIndex, tooltip, tooltipEnabled, xDataKey, xDomain } = params;
  // Drag selection suppresses hover chrome (bklit use-chart-interaction.ts parity).
  const dragSelectionActiveRef = useRef(false);
  // First pill/crosshair show jumps; later moves spring (mirrors legacy showing flag).
  const wasVisibleRef = useRef(false);
  const chartConfig = useChartConfig();
  const dateLabelsForPill = useMemo(
    () =>
      renderData.map((datum: Readonly<ChartDatum>) => {
        const rawX = datum[xDataKey] ?? "";
        if (rawX instanceof Date) {return shortDateFmt.format(rawX);}
        if (isString(rawX)) {return rawX;}
        if (isNumber(rawX)) {return String(rawX);}
        return stringifyDatumValue({ fallback: "", value: rawX });
      }),
    [renderData, xDataKey],
  );
  const datePill = useDatePillOverlay({
    dateLabels: dateLabelsForPill,
    enabled: tooltipEnabled && (tooltip?.showDatePill ?? true),
    tooltipSpring: chartConfig.tooltipSpring,
  });
  const markerActiveStore = useMemo(() => createActiveMarkersStore(), []);

  const clearFocusChrome = useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(null);
    if (profitLossLines.length > 0) {setPlTooltipSignIndex(null);}
    markerActiveStore.setActiveDate(null);
    wasVisibleRef.current = false;
    datePill.hide();
    setLabelFade(undefined);
  }, [profitLossLines, markerActiveStore, datePill, interactionRef, setHoveredIndex, setLabelFade, setPlTooltipSignIndex]);

  const handleFocusChange = useCallback(
    (points: readonly Readonly<ChartPoint<ChartDatum, Readonly<Date>, number>>[]) => {
      const rawPrimary: FocusPoint | undefined = points.at(0);
      const primary = gateFocusPrimary({ gate: { chartPhase, dragSelectionActive: dragSelectionActiveRef.current, isLoaded, xDataKey, xDomain }, interactionRef, points, rawPrimary });
      if (profitLossLines.length > 0) {
        const next = resolveProfitLossSignIndex(primary, profitLossLines);
        setPlTooltipSignIndex((prev) => (prev === next ? prev : next));
      }
      setHoveredIndex(primary ? primary.datumIndex : null);
      const activeDate = toDate(primary?.datum[xDataKey]);
      markerActiveStore.setActiveDate(activeDate && !Number.isNaN(activeDate.getTime()) ? activeDate : null);
      syncDatePillChrome(primary, { activeDate, datePill, discrete: isDiscrete, setLabelFade, tooltip, wasVisibleRef });
    },
    [xDomain, xDataKey, chartPhase, isLoaded, profitLossLines, markerActiveStore, tooltip, isDiscrete, datePill, interactionRef, setHoveredIndex, setLabelFade, setPlTooltipSignIndex],
  );
  return { clearFocusChrome, datePill, dragSelectionActiveRef, handleFocusChange, markerActiveStore, wasVisibleRef };
};

export { useLineFocusChrome };
export type { LineFocusChrome, LineFocusChromeParams };
