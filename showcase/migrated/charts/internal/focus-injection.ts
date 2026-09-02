"use client";

import type {
  ChartControlledFocusOptions,
  ChartInteractionController,
  ChartPoint,
  ChartRenderContext,
  ChartScene,
  ChartTooltipPosition,
  ChartValue,
} from "@tanstack/charts";
import type { RefObject } from "react";
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
   * Focus the first scene point matching an arbitrary predicate; null clears.
   * Raw-point injection defaults to source 'programmatic'
   * (docs/reference/dom-host.md:211-213); pass an explicit `source` (e.g.
   * 'pointer') to reproduce app-owned pointer-hover focus bridges instead.
   */
  focusPoint: (
    predicate: ((point: ChartPoint<TDatum, TXValue, TYValue>) => boolean) | null,
    source?: ChartFocusInjectionSource
  ) => void;
  /** Clear any injected focus. */
  clearFocus: (source?: ChartFocusInjectionSource) => void;
  /**
   * The captured scene/interaction refs, for callers that need to reach past
   * focusPoint's predicate-search shape (e.g. a plot-local
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
    focusPoint,
    clearFocus,
    sceneRef,
    interactionRef,
    clientToScene,
  };
}
