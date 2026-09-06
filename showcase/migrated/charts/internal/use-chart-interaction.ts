"use client";

import type { scaleLinear, scaleTime } from "@visx/scale";
import type {
  CSSProperties,
  Dispatch,
  MouseEvent,
  SetStateAction,
  TouchEvent,
} from "react";
import { useChartHover } from "./chart-context";
import type { LineConfig, Margin, TooltipData } from "./chart-context";

type ScaleTime = ReturnType<typeof scaleTime<number>>;
type ScaleLinear = ReturnType<typeof scaleLinear<number>>;

interface ChartSelection {
  startX: number;
  endX: number;
  startIndex: number;
  endIndex: number;
  active: boolean;
}

interface UseChartInteractionParams {
  xScale: ScaleTime;
  yScale: ScaleLinear;
  yScales: Record<string, ScaleLinear>;
  data: Record<string, unknown>[];
  lines: LineConfig[];
  margin: Margin;
  xAccessor: (d: Record<string, unknown>) => Date;
  bisectDate: (
    data: Record<string, unknown>[],
    date: Date,
    lo: number,
  ) => number;
  canInteract: boolean;
}

interface ChartInteractionResult {
  tooltipData: TooltipData | null;
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
  selection: ChartSelection | null;
  clearSelection: () => void;
  interactionHandlers: {
    onMouseMove?: (event: MouseEvent<SVGGElement>) => void;
    onMouseLeave?: () => void;
    onMouseDown?: (event: MouseEvent<SVGGElement>) => void;
    onMouseUp?: () => void;
    onTouchStart?: (event: TouchEvent<SVGGElement>) => void;
    onTouchMove?: (event: TouchEvent<SVGGElement>) => void;
    onTouchEnd?: () => void;
  };
  interactionStyle: CSSProperties;
}

// The package owns the pointer, so handlers keep the shape as no-ops.
const noopHandler = (): void => undefined;

// Package-owned pointer: the default cursor, never a crosshair grab.
const defaultInteractionStyle: CSSProperties = {
  cursor: "default",
  touchAction: "none",
};

const activeInteractionStyle: CSSProperties = {
  cursor: "crosshair",
  touchAction: "none",
};

const interactionHandlers: ChartInteractionResult["interactionHandlers"] = {
  onMouseDown: noopHandler,
  onMouseLeave: noopHandler,
  onMouseMove: noopHandler,
  onMouseUp: noopHandler,
  onTouchEnd: noopHandler,
  onTouchMove: noopHandler,
  onTouchStart: noopHandler,
};

const clearSelectionFallback = (): void => undefined;

// Legacy signature contract: tooltip derives from package focus; selection stays controlled.
const useChartInteraction = ({
  canInteract,
}: UseChartInteractionParams): ChartInteractionResult => {
  const hover = useChartHover();
  return {
    clearSelection: hover.clearSelection ?? clearSelectionFallback,
    interactionHandlers: canInteract ? interactionHandlers : {},
    interactionStyle: canInteract
      ? activeInteractionStyle
      : defaultInteractionStyle,
    selection: hover.selection ?? null,
    setTooltipData: hover.setTooltipData,
    tooltipData: hover.tooltipData,
  };
};

export { useChartInteraction };
export type { ChartSelection, UseChartInteractionParams };
