import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { useHeatmap } from "./heatmap-context";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import { armHeatmapFocusTimer, clearFocusTimer, dispatchHeatmapPointerHit } from "./heatmap-pointer-hit";
import type { HeatmapRenderSnapshot } from "./heatmap-pointer-hit";
import type { CellDatum } from "./heatmap-cell-data";

interface UseHeatmapFocusSchedulerParams {
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

interface HeatmapFocusScheduler {
  readonly renderContextRef: RefObject<HeatmapRenderSnapshot | undefined>;
  readonly scheduleFocus: (point: ChartPoint<CellDatum, string, string> | null, key?: string) => void;
}

const useHeatmapFocusScheduler = ({
  tooltipConfig,
}: Readonly<UseHeatmapFocusSchedulerParams>): HeatmapFocusScheduler => {
  /*
   * Mirrors `./focus-injection.ts` capture; `source: 'pointer'` avoids C1 legend-dim states.
   */
  const renderContextRef = useRef<HeatmapRenderSnapshot | undefined>(undefined);
  const focusTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);
  const focusedKeyRef = useRef<string | undefined>(undefined);
  const tooltipConfigRef = useRef(tooltipConfig);
  // Latest config sync post-commit; the scheduler below reads it at event
  // Time, strictly after this effect, matching the old inputsRef freshness.
  useEffect(() => {
    tooltipConfigRef.current = tooltipConfig;
  });

  /*
   * Same-key calls are no-ops so focus timers re-arm only on enter/leave transitions.
   */
  const scheduleFocus = useCallback((point: ChartPoint<CellDatum, string, string> | null, key?: string) => {
    if (focusedKeyRef.current === key) {return;}
    focusedKeyRef.current = key;
    clearFocusTimer(focusTimerRef.current);
    focusTimerRef.current = undefined;
    const interaction = renderContextRef.current?.interaction;
    if (!interaction) {return;}
    focusTimerRef.current = armHeatmapFocusTimer({ interaction, point, tooltipConfig: tooltipConfigRef.current });
  }, []);

  useEffect(
    () => (): void => {
      if (focusTimerRef.current !== undefined) {
        globalThis.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = undefined;
      }
    },
    [],
  );

  return { renderContextRef, scheduleFocus };
};

interface HeatmapPointerInputs {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly cellsInteractive: boolean;
  readonly coordinator: HeatmapHoverCoordinator | null;
  readonly ctx: ReturnType<typeof useHeatmap>;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

interface CreateHeatmapPointerMoveHandlerParams {
  readonly coordinator: HeatmapHoverCoordinator;
  readonly handleCellLeaveEvent: () => void;
  readonly inputsRef: { readonly current: HeatmapPointerInputs };
  readonly renderContextRef: { readonly current: HeatmapRenderSnapshot | undefined };
  readonly scheduleFocus: (point: ChartPoint<CellDatum, string, string> | null, key?: string) => void;
}

const createHeatmapPointerMoveHandler = ({
  coordinator,
  handleCellLeaveEvent,
  inputsRef,
  renderContextRef,
  scheduleFocus,
}: Readonly<CreateHeatmapPointerMoveHandlerParams>): ((event: Readonly<{ clientX: number; clientY: number }>) => void) => (event: Readonly<{ clientX: number; clientY: number }>) => {
  const { ctx, cellData, cellsInteractive } = inputsRef.current;
  if (!cellsInteractive) {return;}
  const interaction = renderContextRef.current?.interaction;
  if (!interaction) {return;}
  dispatchHeatmapPointerHit({
    cellData,
    clientX: event.clientX,
    clientY: event.clientY,
    coordinator,
    ctx,
    interaction,
    onFocus: scheduleFocus,
    onLeave: handleCellLeaveEvent,
    renderContext: renderContextRef.current,
  });
};

interface UseHeatmapPointerListenersParams {
  readonly cellsInteractive: boolean;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly coordinator: HeatmapHoverCoordinator | null;
  readonly handleCellLeave: () => void;
  readonly inputsRef: { readonly current: HeatmapPointerInputs };
  readonly renderContextRef: { readonly current: HeatmapRenderSnapshot | undefined };
  readonly scheduleFocus: (point: ChartPoint<CellDatum, string, string> | null, key?: string) => void;
}

const useHeatmapPointerListeners = ({
  cellsInteractive,
  containerRef,
  coordinator,
  handleCellLeave,
  inputsRef,
  renderContextRef,
  scheduleFocus,
}: Readonly<UseHeatmapPointerListenersParams>): void => {
  /*
   * Effect event keeps the listener subscription stable across leave-callback changes.
   */
  const handleCellLeaveEvent = useEffectEvent((): void => {
    handleCellLeave();
  });
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !cellsInteractive || !coordinator) {return undefined;}

    const handlePointerMove = createHeatmapPointerMoveHandler({
      coordinator,
      handleCellLeaveEvent,
      inputsRef,
      renderContextRef,
      scheduleFocus,
    });

    const handlePointerLeave = (): void => {
      handleCellLeaveEvent();
    };

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return (): void => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [cellsInteractive, containerRef, coordinator, inputsRef, renderContextRef, scheduleFocus]);
};

interface UseHeatmapCellLeaveParams {
  readonly coordinator: HeatmapHoverCoordinator | null;
  readonly scheduleFocus: (point: ChartPoint<CellDatum, string, string> | null, key?: string) => void;
}

const useHeatmapCellLeave = ({
  coordinator,
  scheduleFocus,
}: Readonly<UseHeatmapCellLeaveParams>): (() => void) => {
  const handleCellLeave = useCallback(() => {
    coordinator?.setHoveredCell(null);
    coordinator?.setTooltipData(null);
    scheduleFocus(null);
  }, [coordinator, scheduleFocus]);
  return handleCellLeave;
};

interface UseHeatmapPointerBridgeParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly coordinator: HeatmapHoverCoordinator | null;
  readonly ctx: ReturnType<typeof useHeatmap>;
  readonly interactive: boolean;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

interface HeatmapPointerBridge {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly handleRender: (renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => void;
}

const useHeatmapPointerBridge = ({
  cellData,
  coordinator,
  ctx,
  interactive,
  tooltipConfig,
}: Readonly<UseHeatmapPointerBridgeParams>): HeatmapPointerBridge => {
  const cellsInteractive = useMemo(
    () => interactive && ctx.chartStatus !== "loading",
    [ctx.chartStatus, interactive],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { renderContextRef, scheduleFocus } = useHeatmapFocusScheduler({ tooltipConfig });
  const inputsRef = useRef<HeatmapPointerInputs>({ cellData, cellsInteractive, coordinator, ctx, tooltipConfig });
  // Latest render inputs sync post-commit; every reader (pointer handlers, focus
  // Scheduler) runs at event time, strictly after this effect.
  useEffect(() => {
    inputsRef.current = { cellData, cellsInteractive, coordinator, ctx, tooltipConfig };
  });

  const handleCellLeave = useHeatmapCellLeave({ coordinator, scheduleFocus });

  useHeatmapPointerListeners({
    cellsInteractive,
    containerRef,
    coordinator,
    handleCellLeave,
    inputsRef,
    renderContextRef,
    scheduleFocus,
  });

  const handleRender = useCallback((renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => {
    renderContextRef.current = { interaction: renderCtx.interaction, scene: renderCtx.scene };
  }, [renderContextRef]);

  return { containerRef, handleRender };
};

export { createHeatmapPointerMoveHandler, useHeatmapPointerBridge };
export type { CreateHeatmapPointerMoveHandlerParams, HeatmapPointerBridge, HeatmapPointerInputs, UseHeatmapPointerBridgeParams };
