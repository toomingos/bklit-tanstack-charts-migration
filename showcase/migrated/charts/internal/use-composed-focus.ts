import { useCallback, useMemo } from "react";
import type { RefObject } from "react";
import type { ChartPoint } from "@tanstack/charts";
import type { ScaleTime } from "d3-scale";
import { buildCrosshairGradientDef } from "./focus-marks";
import type { CrosshairGradientDef } from "./focus-marks";
import { isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import { isStringValue } from "./composed-datum-text";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import { NOTHING } from "./composed-series";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import { useSanitizedId } from "./use-sanitized-id";

interface UseComposedFocusChromeParams {
  readonly chartPhase: ChartPhase;
  readonly clearFocus: (source: "pointer") => void;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly idPrefix?: string;
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
  readonly handleFocusChange: (point: ChartPoint<ChartDatum, Date, number> | null) => void;
  readonly isDiscrete: boolean;
  readonly tooltipEnabled: boolean;
}

// Package-owned pointer: the definition owns pointermove/leave, so focus lands here
// Through ChartHost onFocusChange. Dim rides mark states; the crosshair x label shows the date.
const useComposedFocusChrome = (
  params: Readonly<UseComposedFocusChromeParams>,
): UseComposedFocusChromeResult => {
  const {
    chartPhase, clearFocus, dragSelectionActiveRef, idPrefix, isLoaded, renderData, tooltip,
  } = params;
  const tooltipEnabled = tooltip?.enabled ?? false;
  // Dense data snaps instead of springing (same threshold as every other chart).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
  // Scoped to the mount prefix so two ComposedCharts never share a gradient id.
  const crosshairFallbackId = useSanitizedId();
  const crosshairGradientId = idPrefix === undefined ? crosshairFallbackId : `${idPrefix}-crosshair`;
  const crosshairGradientDef = useMemo(() => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) {return NOTHING;}
    const color = isStringValue(tooltip?.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  const clearFocusChrome = useCallback(() => {
    clearFocus("pointer");
  }, [clearFocus]);

  // Plain callback for the host prop (rebuilt when its inputs change; the definition never depends on it).
  const handleFocusChange = useCallback((_point: ChartPoint<ChartDatum, Date, number> | null): void => {
    // Pre-load, mid-reveal and mid-drag focus never paints chrome (legacy suppression, kept).
    if (dragSelectionActiveRef.current || !isLoaded || !isChartInteractionPhase(chartPhase)) {
      clearFocusChrome();
    }
  }, [chartPhase, clearFocusChrome, dragSelectionActiveRef, isLoaded]);

  return {
    clearFocusChrome,
    crosshairGradientDef,
    crosshairGradientId,
    handleFocusChange,
    isDiscrete,
    tooltipEnabled,
  };
};

export { useComposedFocusChrome };
export type { UseComposedFocusChromeParams, UseComposedFocusChromeResult };
