"use client";

import type {
  CSSProperties,
  Dispatch,
  MouseEvent,
  SetStateAction,
  TouchEvent,
} from "react";
import { useChartHover } from "./chart-context";
import type { TooltipData } from "./chart-context";

interface ChartSelection {
  active: boolean;
  endIndex: number;
  endX: number;
  startIndex: number;
  startX: number;
}

interface ChartInteractionResult {
  clearSelection: () => void;
  interactionHandlers: {
    onMouseDown?: (event: MouseEvent<SVGGElement>) => void;
    onMouseLeave?: () => void;
    onMouseMove?: (event: MouseEvent<SVGGElement>) => void;
    onMouseUp?: () => void;
    onTouchEnd?: () => void;
    onTouchMove?: (event: TouchEvent<SVGGElement>) => void;
    onTouchStart?: (event: TouchEvent<SVGGElement>) => void;
  };
  interactionStyle: CSSProperties;
  selection: ChartSelection | null;
  setTooltipData: Dispatch<SetStateAction<TooltipData | null>>;
  tooltipData: TooltipData | null;
}

// The package owns the pointer, so handlers keep the shape as no-ops.
const noopHandler = (): void => undefined;

// Package-owned pointer: the default cursor, never a crosshair grab.
const interactionStyle: CSSProperties = {
  cursor: "default",
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

// Legacy result contract: tooltip derives from package focus; selection stays controlled.
const useChartInteraction = (): ChartInteractionResult => {
  const hover = useChartHover();
  return {
    clearSelection: hover.clearSelection ?? clearSelectionFallback,
    interactionHandlers,
    interactionStyle,
    selection: hover.selection ?? null,
    setTooltipData: hover.setTooltipData,
    tooltipData: hover.tooltipData,
  };
};

export { useChartInteraction };
export type { ChartSelection };
