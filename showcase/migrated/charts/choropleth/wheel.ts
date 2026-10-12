import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { FEATURES_ID } from "./projection";
import type { ChoroplethFeature, HoverStore } from "./types";

type RenderedChart = Pick<ChartRendererRenderContext<ChoroplethFeature, number, number>, "scene" | "interaction">;

interface WheelClearDeps {
  readonly hoverStore: HoverStore;
  readonly renderRef: RefObject<RenderedChart | null>;
}

interface WheelFocusClear {
  readonly onWheelZoom: (clientX: number, clientY: number) => void;
  readonly bind: (deps: WheelClearDeps) => void;
}

/** Wheel zoom moves the map under a resting pointer: bklit's mouseenter/leave hover stays while the path is still under it and clears once it slid away; the new path gets none.
 * After the transform paints, the pointer is hit-tested via the renderer's focus strategy: same feature keeps focus, else clears. */
export const useWheelFocusClear = (): WheelFocusClear => {
  const clearRef = useRef<(clientX: number, clientY: number) => void>(() => undefined);
  const frameRef = useRef(0);
  const onWheelZoom = useCallback((clientX: number, clientY: number): void => { clearRef.current(clientX, clientY); }, []);
  const bind = useCallback(({ hoverStore, renderRef }: WheelClearDeps): void => {
    clearRef.current = (clientX, clientY): void => {
      if (hoverStore.hovered === null) {return;}
      cancelAnimationFrame(frameRef.current);
      // One frame, so the transform has painted: bklit has no timer here, its path's onMouseLeave (choropleth-feature.tsx:90-91, :114-115,
      // :201-202) fires from the browser's own post-layout hit test once the zoom (choropleth-chart.tsx:435-447) slid the path from under the pointer.
      frameRef.current = requestAnimationFrame(() => {
        const interaction = renderRef.current?.interaction;
        if (interaction === undefined || hoverStore.hovered === null) {return;}
        const under = interaction.resolvePointer(clientX, clientY);
        if (under?.point.markId === FEATURES_ID && under.point.datumIndex === hoverStore.hovered) {return;}
        interaction.setControlledFocus(null, { source: "pointer" });
      });
    };
  }, []);
  useEffect(() => (): void => { cancelAnimationFrame(frameRef.current); }, []);
  return { bind, onWheelZoom };
};

export type { RenderedChart };
