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

// Legend/app -> chart focus injection; marks style via states, no DOM access.

// Source subset accepted by setControlledFocus (no keyboard/restored).
type ChartFocusInjectionSource = NonNullable<ChartControlledFocusOptions["source"]>;

interface FocusInjection<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> {
  captureRenderContext: (
    context: Pick<ChartRenderContext<TDatum, TXValue, TYValue>, "scene" | "interaction">
  ) => void;
// Null clears; default source programmatic, pointer for hover bridges.
  focusPoint: (
    predicate: ((point: ChartPoint<TDatum, TXValue, TYValue>) => boolean) | null,
    source?: ChartFocusInjectionSource
  ) => void;
  clearFocus: (source?: ChartFocusInjectionSource) => void;
// Escape hatch for callers needing scene/interaction directly.
  sceneRef: RefObject<ChartScene<TDatum, TXValue, TYValue> | null>;
  interactionRef: RefObject<ChartInteractionController<TDatum, TXValue, TYValue> | null>;
  clientToScene: (clientX: number, clientY: number) => ChartTooltipPosition | null;
}

const useFocusInjection = <TDatum = unknown, TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(): FocusInjection<TDatum, TXValue, TYValue> => {
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
      if (!interaction) {return;}
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
    (source?: ChartFocusInjectionSource) =>{  focusPoint(null, source); },
    [focusPoint]
  );

  const clientToScene = useCallback(
    (clientX: number, clientY: number) => interactionRef.current?.clientToScene(clientX, clientY) ?? null,
    []
  );

  return {
    captureRenderContext,
    clearFocus,
    clientToScene,
    focusPoint,
    interactionRef,
    sceneRef,
  };
}

export { useFocusInjection };
export type { ChartFocusInjectionSource, FocusInjection };
