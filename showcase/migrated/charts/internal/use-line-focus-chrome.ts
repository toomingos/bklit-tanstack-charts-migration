// Line-chart focus chrome: label fade, active-marker store, and focus handlers.
import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChartPoint } from "@tanstack/charts";
import { createActiveMarkersStore } from "./active-markers-store";
import { toDate } from "./coerce-date";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import type { LabelFadeState } from "./line-x-scale";
import {
  gateFocusPrimary,
  resolveProfitLossSignIndex,
  syncDateLabelFade,
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
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly handleFocusChange: (points: readonly Readonly<ChartPoint<ChartDatum, Readonly<Date>, number>>[]) => void;
  readonly markerActiveStore: Readonly<ReturnType<typeof createActiveMarkersStore>>;
}

const useLineFocusChrome = (params: Readonly<LineFocusChromeParams>): LineFocusChrome => {
  const { chartPhase, interactionRef, isLoaded, profitLossLines, setHoveredIndex, setLabelFade, setPlTooltipSignIndex, tooltip, xDataKey, xDomain } = params;
  // Drag selection suppresses hover chrome (bklit use-chart-interaction.ts parity).
  const dragSelectionActiveRef = useRef(false);
  const markerActiveStore = useMemo(() => createActiveMarkersStore(), []);

  const clearFocusChrome = useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(null);
    if (profitLossLines.length > 0) {setPlTooltipSignIndex(null);}
    markerActiveStore.setActiveDate(null);
    setLabelFade(undefined);
  }, [profitLossLines, markerActiveStore, interactionRef, setHoveredIndex, setLabelFade, setPlTooltipSignIndex]);

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
      syncDateLabelFade(primary, { activeDate, setLabelFade, tooltip });
    },
    [xDomain, xDataKey, chartPhase, isLoaded, profitLossLines, markerActiveStore, tooltip, interactionRef, setHoveredIndex, setLabelFade, setPlTooltipSignIndex],
  );
  return { clearFocusChrome, dragSelectionActiveRef, handleFocusChange, markerActiveStore };
};

export { useLineFocusChrome };
export type { LineFocusChrome, LineFocusChromeParams };
