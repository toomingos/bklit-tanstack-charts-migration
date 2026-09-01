"use client";

import type {
  ChartControlledFocusOptions,
  ChartFocusSource,
  ChartInteractionController,
  ChartMarkStateContext,
  ChartPoint,
  ChartRenderContext,
  ChartScene,
  ChartTooltipPosition,
  ChartValue,
} from "@tanstack/charts";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

/**
 * Sanctioned legend/app -> chart focus injection (phase 6, C1).
 *
 * Captures the interaction controller + compiled scene from the React
 * `<Chart onRender>` context and injects programmatic focus for a series
 * (legend hover) or clears it. Marks style themselves via `states`; there is
 * no DOM access here — the controller and scene are documented API surfaces
 * (dist/dom-types.d.ts:31-38,167-172).
 */

/**
 * `ChartInteractionController.setControlledFocus`'s `source` option
 * (dist/dom-types.d.ts's `ChartControlledFocusOptions`) — narrower than the
 * library's general `ChartFocusSource` union (which also has 'keyboard' and
 * 'restored', neither of which `setControlledFocus` accepts).
 */
export type ChartFocusInjectionSource = NonNullable<ChartControlledFocusOptions["source"]>;

export interface FocusInjection<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> {
  /** Compose into the chart's existing onRender handler (call first). */
  captureRenderContext: (
    context: Pick<ChartRenderContext<TDatum, TXValue, TYValue>, "scene" | "interaction">
  ) => void;
  /**
   * Focus the first scene point whose series group matches (String(point.group)
   * or groupLabel equality). Pass null to clear. Raw-point injection defaults
   * to source 'programmatic' (docs/reference/dom-host.md:211-213); pass an
   * explicit `source` (e.g. 'pointer') to reproduce app-owned pointer-hover
   * focus bridges instead.
   */
  focusSeries: (series: string | null, source?: ChartFocusInjectionSource) => void;
  /** Focus the first scene point matching an arbitrary predicate; null clears. */
  focusPoint: (
    predicate: ((point: ChartPoint<TDatum, TXValue, TYValue>) => boolean) | null,
    source?: ChartFocusInjectionSource
  ) => void;
  /** Clear any injected focus. */
  clearFocus: (source?: ChartFocusInjectionSource) => void;
  /**
   * The captured scene/interaction refs, for callers that need to reach past
   * focusPoint/focusSeries's predicate-search shape (e.g. a plot-local
   * `clientToScene`/`invertSceneX` pair built on top of `interactionRef`/
   * `sceneRef` directly).
   */
  sceneRef: RefObject<ChartScene<TDatum, TXValue, TYValue> | null>;
  interactionRef: RefObject<ChartInteractionController<TDatum, TXValue, TYValue> | null>;
  /** Converts browser client coordinates into scene coordinates via the captured interaction controller. */
  clientToScene: (clientX: number, clientY: number) => ChartTooltipPosition | null;
}

export function useFocusInjection<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(): FocusInjection<TDatum, TXValue, TYValue> {
  const sceneRef = useRef<ChartScene<TDatum, TXValue, TYValue> | null>(null);
  const interactionRef = useRef<ChartInteractionController<TDatum, TXValue, TYValue> | null>(null);

  const captureRenderContext = useCallback(
    (context: Pick<ChartRenderContext<TDatum, TXValue, TYValue>, "scene" | "interaction">) => {
      sceneRef.current = context.scene;
      interactionRef.current = context.interaction;
    },
    []
  );

  const focusPoint = useCallback(
    (
      predicate: ((point: ChartPoint<TDatum, TXValue, TYValue>) => boolean) | null,
      source: ChartFocusInjectionSource = "programmatic"
    ) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (!predicate) {
        interaction.setControlledFocus(null, { source });
        return;
      }
      const point = sceneRef.current?.points.find(predicate) ?? null;
      interaction.setControlledFocus(point, { source });
    },
    []
  );

  const focusSeries = useCallback(
    (series: string | null, source?: ChartFocusInjectionSource) => {
      focusPoint(
        series == null
          ? null
          : (point) =>
              String(point.group ?? "") === series ||
              point.groupLabel === series,
        source
      );
    },
    [focusPoint]
  );

  const clearFocus = useCallback(
    (source?: ChartFocusInjectionSource) => focusPoint(null, source),
    [focusPoint]
  );

  const clientToScene = useCallback(
    (clientX: number, clientY: number) => interactionRef.current?.clientToScene(clientX, clientY) ?? null,
    []
  );

  return {
    captureRenderContext,
    focusSeries,
    focusPoint,
    clearFocus,
    sceneRef,
    interactionRef,
    clientToScene,
  };
}

/**
 * Shared "legend hover -> series focus" broadcast effect (phase 6, H5).
 *
 * Reproduces the identical effect duplicated across line-chart.tsx,
 * area-chart.tsx, composed-chart.tsx, bar-chart.tsx and candlestick-chart.tsx:
 * resolve the legend's hovered index to a series key via `resolveKey`, then
 * `focusSeries(key)` when found or `clearFocus()` otherwise. `resolveKey`
 * carries the per-chart index->key mapping (an array lookup for
 * line/area/composed/bar, a hardcoded index ternary for candlestick) — the
 * caller is responsible for memoizing it (`useCallback`) against whatever
 * inputs its own lookup depends on, so the effect's re-run timing matches
 * the original inline `useEffect`'s dependency array exactly.
 */
export function useLegendFocusBroadcast(
  hoveredIndex: number | null,
  resolveKey: (index: number) => string | null,
  focusSeries: (series: string | null) => void,
  clearFocus: () => void
): void {
  useEffect(() => {
    const key = hoveredIndex != null ? resolveKey(hoveredIndex) : null;
    if (key != null) focusSeries(key);
    else clearFocus();
  }, [hoveredIndex, resolveKey, focusSeries, clearFocus]);
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
