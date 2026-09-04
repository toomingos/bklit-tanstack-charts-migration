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
  readonly renderContextRef: { current: HeatmapRenderSnapshot | undefined };
  readonly scheduleFocus: (point: ChartPoint<CellDatum, string, string> | null, key?: string) => void;
}

const useHeatmapFocusScheduler = ({
  tooltipConfig,
}: Readonly<UseHeatmapFocusSchedulerParams>): HeatmapFocusScheduler => {
  // C2: captured from the public `onRender` boundary (composed below into
  // `handleRender`) — the app-owned pointer-hover detection below uses this
  // To drive the native tooltip via `setControlledFocus`, mirroring the
  // Sanctioned capture pattern in `./focus-injection.ts` but with
  // `source: 'pointer'` (never 'programmatic', which would trigger C1's
  // Legend-dim mark states).
  const renderContextRef = useRef<HeatmapRenderSnapshot | undefined>(undefined);
  const focusTimerRef = useRef<number | undefined>(undefined);
  const focusedKeyRef = useRef<string | undefined>(undefined);
  const tooltipConfigRef = useRef(tooltipConfig);
  // Latest config sync post-commit; the scheduler below reads it at event
  // Time, strictly after this effect, matching the old inputsRef freshness.
  useEffect(() => {
    tooltipConfigRef.current = tooltipConfig;
  });

  // Debounced app -> chart focus bridge. `key` is `${column}-${row}` for a
  // Hovered cell or null for "no cell hovered"; repeated calls with the same
  // Key (e.g. every pointermove within one cell) are no-ops so the timers
  // Below are only (re)armed on an actual enter/leave transition.
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
    () => () => {
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
  const { ctx: c, cellData: cd, cellsInteractive: ci } = inputsRef.current;
  if (!ci) {return;}
  const interaction = renderContextRef.current?.interaction;
  if (!interaction) {return;}
  dispatchHeatmapPointerHit({
    cellData: cd,
    clientX: event.clientX,
    clientY: event.clientY,
    coordinator,
    ctx: c,
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
  // Pointer listeners below only invoke the latest leave — reading it through
  // An effect event keeps the listener subscription stable across
  // Leave-callback identity changes (latest coordinator still observed).
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

    const handlePointerLeave = () => {
      handleCellLeaveEvent();
    };

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
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

  // D5: the reveal is now driven entirely by native `motion` on the cell
  // Marks (`cellMotion` above) — `handleRender` only needs to capture the
  // Scene/interaction controller for the pointer-hover -> native-tooltip
  // Bridge (C2). The old imperative WAAPI reveal driver (deferred-reveal.ts's
  // `runDeferredReveal`, the manual `rect[data-ts-key]` query + `.animate()`
  // Loop, and the double-rAF "wait for rects to land" fallback effect below
  // It) is deleted — native motion needs no post-paint retry mechanism.
  const handleRender = useCallback((renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => {
    renderContextRef.current = { interaction: renderCtx.interaction, scene: renderCtx.scene };
  }, [renderContextRef]);

  return { containerRef, handleRender };
};

export { createHeatmapPointerMoveHandler, useHeatmapPointerBridge };
export type { CreateHeatmapPointerMoveHandlerParams, HeatmapPointerBridge, HeatmapPointerInputs, UseHeatmapPointerBridgeParams };
