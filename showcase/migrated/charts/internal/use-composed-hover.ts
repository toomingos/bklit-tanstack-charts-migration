import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ChartInteractionController, ChartPoint } from "@tanstack/charts";
import type { ScaleTime } from "d3-scale";
import { useEffectEvent } from "./use-effect-event";
import { buildCrosshairGradientDef, useDatePillOverlay } from "./hover-geometry";
import type { CrosshairGradientDef, DatePillController } from "./hover-geometry";
import { runComposedPointerMove } from "./composed-hover";
import { isStringValue, stringifyDatumField } from "./composed-datum-text";
import { shortDateFmt } from "./formatters";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import { NOTHING } from "./composed-series";
import { useChartConfig } from "./use-chart-config";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum, ChartTooltipConfig } from "./types";
import { useSanitizedId } from "./use-sanitized-id";

interface ComposedLabelFade {
  readonly hoveredLabel: string | null;
  readonly primaryX: number;
}

interface UseComposedPointerHandlersParams {
  readonly chartPhase: ChartPhase;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly interactionRef: RefObject<ChartInteractionController<ChartDatum, Date, number> | null>;
  readonly isLoaded: boolean;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly xDataKey: string;
  readonly xScaleRef: RefObject<ScaleTime<number, number> | null>;
}

interface UseComposedPointerHandlersResult {
  readonly clearFocusChrome: () => void;
  readonly crosshairGradientDef: CrosshairGradientDef | undefined;
  readonly crosshairGradientId: string;
  readonly datePill: DatePillController;
  readonly handleFocusGroupChange: (_points: readonly ChartPoint<ChartDatum, Date, number>[]) => void;
  readonly hoveredIndex: number | null;
  readonly isDiscrete: boolean;
  readonly labelFade: Readonly<ComposedLabelFade> | undefined;
  readonly tooltipEnabled: boolean;
}

const useComposedPointerHandlers = (
  params: Readonly<UseComposedPointerHandlersParams>,
): UseComposedPointerHandlersResult => {
  const {
    chartPhase, containerRef, data, dragSelectionActiveRef, interactionRef, isLoaded, renderData, tooltip, xDataKey, xScaleRef,
  } = params;
  const tooltipEnabled = tooltip?.enabled ?? false;
  // Dense data snaps instead of springing (same threshold as every other chart).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [labelFade, setLabelFade] = useState<Readonly<{ primaryX: number; hoveredLabel: string | null }> | undefined>();
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
    enabled: tooltipEnabled && (tooltip?.showDatePill ?? true),
    tooltipSpring: chartConfig.tooltipSpring,
  });

  const clearFocusChrome = useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(null);
    wasVisibleRef.current = false;
    datePill.hide();
    setLabelFade(NOTHING);
  }, [datePill, interactionRef, setHoveredIndex, setLabelFade]);

  const handleFocusGroupChange = useCallback(
    (_points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      // Required prop on the renderer; this chart's hover/tooltip state is driven by
      // The pointermove handler below, not by the renderer's own focus-group tracking.
    },
    [],
  );

  // Bisect twice per move: raw data for pill/rows, decimated renderData for the highlight band.
  const handlePointerMoveEvent = useEffectEvent((event: Readonly<PointerEvent>): void => {
    runComposedPointerMove(event, {
      chartPhase,
      dragActive: dragSelectionActiveRef.current,
      hoverInputs: {
        clearFocusChrome,
        data,
        datePill,
        isDiscrete,
        renderData,
        tooltip,
        xDataKey,
      },
      interaction: interactionRef.current,
      isLoaded,
      setHoveredIndex,
      setLabelFade,
      wasVisibleRef,
      xScale: xScaleRef.current,
    });
  });
  const handlePointerLeaveEvent = useEffectEvent((): void => {
    clearFocusChrome();
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !tooltipEnabled) {return NOTHING;}
    container.addEventListener("pointermove", handlePointerMoveEvent);
    container.addEventListener("pointerleave", handlePointerLeaveEvent);
    return (): void => {
      container.removeEventListener("pointermove", handlePointerMoveEvent);
      container.removeEventListener("pointerleave", handlePointerLeaveEvent);
    };
  }, [containerRef, tooltipEnabled]);

  return {
    clearFocusChrome,
    crosshairGradientDef,
    crosshairGradientId,
    datePill,
    handleFocusGroupChange,
    hoveredIndex,
    isDiscrete,
    labelFade,
    tooltipEnabled,
  };
};

export { useComposedPointerHandlers };
export type { ComposedLabelFade, UseComposedPointerHandlersParams, UseComposedPointerHandlersResult };
