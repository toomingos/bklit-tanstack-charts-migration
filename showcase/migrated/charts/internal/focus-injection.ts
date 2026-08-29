"use client";

import type {
  ChartFocusSource,
  ChartInteractionController,
  ChartMarkStateContext,
  ChartPoint,
  ChartRenderContext,
  ChartScene,
} from "@tanstack/charts";
import { useCallback, useRef } from "react";

/**
 * Sanctioned legend/app -> chart focus injection (phase 6, C1).
 *
 * Captures the interaction controller + compiled scene from the React
 * `<Chart onRender>` context and injects programmatic focus for a series
 * (legend hover) or clears it. Marks style themselves via `states`; there is
 * no DOM access here — the controller and scene are documented API surfaces
 * (dist/dom-types.d.ts:31-38,167-172).
 */
export interface FocusInjection {
  /** Compose into the chart's existing onRender handler (call first). */
  captureRenderContext: (
    context: Pick<ChartRenderContext, "scene" | "interaction">
  ) => void;
  /**
   * Focus the first scene point whose series group matches (String(point.group)
   * or groupLabel equality). Pass null to clear. Raw-point injection defaults
   * to source 'programmatic' (docs/reference/dom-host.md:211-213).
   */
  focusSeries: (series: string | null) => void;
  /** Focus the first scene point matching an arbitrary predicate; null clears. */
  focusPoint: (predicate: ((point: ChartPoint) => boolean) | null) => void;
  /** Clear any injected focus. */
  clearFocus: () => void;
}

export function useFocusInjection(): FocusInjection {
  const sceneRef = useRef<ChartScene | null>(null);
  const interactionRef = useRef<ChartInteractionController | null>(null);

  const captureRenderContext = useCallback(
    (context: Pick<ChartRenderContext, "scene" | "interaction">) => {
      sceneRef.current = context.scene;
      interactionRef.current =
        context.interaction as unknown as ChartInteractionController;
    },
    []
  );

  const focusPoint = useCallback(
    (predicate: ((point: ChartPoint) => boolean) | null) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (!predicate) {
        interaction.setControlledFocus(null);
        return;
      }
      const point = sceneRef.current?.points.find(predicate) ?? null;
      interaction.setControlledFocus(point, { source: "programmatic" });
    },
    []
  );

  const focusSeries = useCallback(
    (series: string | null) => {
      focusPoint(
        series == null
          ? null
          : (point) =>
              String(point.group ?? "") === series ||
              point.groupLabel === series
      );
    },
    [focusPoint]
  );

  const clearFocus = useCallback(() => focusPoint(null), [focusPoint]);

  return { captureRenderContext, focusSeries, focusPoint, clearFocus };
}

/**
 * Predicate for series-dim mark states.
 *
 * NOT the `{focus:'unmatched'}` selector: that selector is group-scoped
 * (dist/mark-state.js:104 — `!matches('group')`), and under group-x focus every
 * series owns a point in the focus group, so nothing would ever be unmatched.
 * `matches('series')` compares `point.group` to `focus.primary.group`
 * (dist/focus-layer.js:240-241), which is exactly bklit's legend-dim semantics.
 */
export function whenSeriesDimmed(
  sources: readonly ChartFocusSource[] = ["programmatic"]
): (context: ChartMarkStateContext<unknown>) => boolean {
  return (context) =>
    sources.includes(context.focus.source) &&
    context.focus.primary.group != null &&
    !context.matches("series");
}
