// Context setters (`setTooltipData`, `setHoveredBarIndex`, ...) drive the native focus through the public interaction controller:
// the row's plot position is resolved like a pointer (`resolvePointer`) and painted with `setControlledFocus`.
import { useCallback } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { AnyInteraction } from "../erased-types";
import type { TooltipData } from "./chart-context";

export type Interaction = AnyInteraction;

/** Host-relative pixel (scene coordinates) of data row `index`, or null when the row has no position. */
export type RowPixel = (index: number) => { readonly x: number; readonly y: number } | null;

/** Focuses data row `index` (null clears). */
export function useFocusRow(
  hostRef: RefObject<HTMLElement | null>,
  interaction: RefObject<Interaction | null> | undefined,
  pixelOf: RowPixel,
): (index: number | null) => void {
  return useCallback(
    (index) => {
      const controller = interaction?.current;
      if (!controller) {
        return;
      }
      if (index === null) {
        controller.setControlledFocus(null, { source: "pointer" });
        return;
      }
      const at = pixelOf(index);
      const rect = hostRef.current?.getBoundingClientRect();
      if (at && rect) {
        controller.setControlledFocus(controller.resolvePointer(rect.left + at.x, rect.top + at.y), { source: "pointer" });
      }
    },
    [hostRef, interaction, pixelOf],
  );
}

/** bklit's `setTooltipData` over a row focus; an updater function sees `null` (the focus lives in the renderer, not React state). */
export const tooltipSetter =
  (focusRow: (index: number | null) => void): Dispatch<SetStateAction<TooltipData | null>> =>
  (next) => {
    const value = typeof next === "function" ? next(null) : next;
    focusRow(value ? value.index : null);
  };
