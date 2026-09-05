import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useEffectEvent } from "./use-effect-event";
import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { HeatmapHoverCoordinator, useHeatmap } from "./heatmap-context";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import type { HeatmapColumn } from "./heatmap-utils";
import type { CellDatum } from "./heatmap-cell-data";

// Fallback row count when no columns are present (one row per weekday).
const DEFAULT_WEEK_ROW_COUNT = 7;

type HeatmapFocusTimerId = ReturnType<typeof globalThis.setTimeout>;

const clearFocusTimer = (timerId: HeatmapFocusTimerId | undefined): void => {
  if (timerId !== undefined) {
    globalThis.clearTimeout(timerId);
  }
};

const armFocusTimer = (delayMs: number, apply: () => void): HeatmapFocusTimerId | undefined => {
  if (delayMs <= 0) {
    apply();
    return undefined;
  }
  return globalThis.setTimeout(apply, delayMs);
};

type HeatmapRenderSnapshot = Pick<ChartRendererRenderContext<CellDatum, string, string>, "interaction" | "scene">;

interface ArmHeatmapFocusTimerParams {
  readonly interaction: HeatmapRenderSnapshot["interaction"];
  readonly point: ChartPoint<CellDatum, string, string> | null;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

/*
 * Hide delay debounces the focus clear (cancelled on re-enter); show delay applies on hover.
 */
const armHeatmapFocusTimer = ({
  interaction,
  point,
  tooltipConfig,
}: Readonly<ArmHeatmapFocusTimerParams>): HeatmapFocusTimerId | undefined => {
  const delayMs = point ? (tooltipConfig?.showDelayMs ?? 0) : (tooltipConfig?.hideDelayMs ?? 0);
  return armFocusTimer(delayMs, () => { interaction.setControlledFocus(point, { source: "pointer" }); });
};

interface HeatmapPointerHitContext {
  readonly data: readonly HeatmapColumn[];
  readonly binWidth: number;
  readonly binHeight: number;
  readonly margin: Readonly<{ readonly top: number; readonly left: number }>;
  readonly separatorLayout: Readonly<{ readonly spacing: number; readonly atColumns: readonly number[] }> | null;
}

interface HeatmapCellHit {
  readonly column: number;
  readonly row: number;
  readonly datum: Readonly<CellDatum>;
  readonly bin: HeatmapColumn["bins"][number];
}

// Separator gutter offset before a column (no scale object; derived from layout).
const separatorOffsetBefore = (
  column: number,
  separator: HeatmapPointerHitContext["separatorLayout"],
): number => {
  if (!separator || separator.spacing <= 0 || column <= 0) {return 0;}
  let count = 0;
  for (const atColumn of separator.atColumns) {
    if (atColumn <= column) {count += 1;}
  }
  return count * separator.spacing;
};

const findHeatmapColumnForSceneX = (
  ctx: Readonly<HeatmapPointerHitContext>,
  posX: number,
): number => {
  for (let i = 0; i < ctx.data.length; i += 1) {
    const colX = i * ctx.binWidth + separatorOffsetBefore(i, ctx.separatorLayout);
    if (posX >= colX && posX < colX + ctx.binWidth) {
      return i;
    }
  }
  return -1;
};

interface HeatmapCellDatumLookupParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly ctx: Readonly<HeatmapPointerHitContext>;
  readonly column: number;
  readonly row: number;
}

const findHeatmapCellDatum = ({
  cellData,
  ctx,
  column,
  row,
}: Readonly<HeatmapCellDatumLookupParams>): HeatmapCellHit | undefined => {
  const datum = cellData.find((candidate) => candidate.column === column && candidate.row === row);
  if (!datum || datum.isGhost) {
    return undefined;
  }
  const bin = ctx.data.at(column)?.bins.at(row);
  if (bin === undefined) {
    return undefined;
  }
  return { bin, column, datum, row };
};

interface LocateHeatmapCellParams {
  readonly ctx: Readonly<HeatmapPointerHitContext>;
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly sceneX: number;
  readonly sceneY: number;
}

const locateHoveredHeatmapCell = ({
  ctx,
  cellData,
  sceneX,
  sceneY,
}: Readonly<LocateHeatmapCellParams>): HeatmapCellHit | undefined => {
  const posX = sceneX - ctx.margin.left;
  const posY = sceneY - ctx.margin.top;

  const foundCol = findHeatmapColumnForSceneX(ctx, posX);
  const foundRow = Math.floor(posY / ctx.binHeight);

  if (foundCol < 0 || foundRow < 0 || foundRow >= (ctx.data[0]?.bins.length ?? DEFAULT_WEEK_ROW_COUNT)) {
    return undefined;
  }

  return findHeatmapCellDatum({ cellData, column: foundCol, ctx, row: foundRow });
};

interface HeatmapCellHoverParams {
  readonly coordinator: HeatmapHoverCoordinator;
  readonly ctx: ReturnType<typeof useHeatmap>;
  readonly hit: Readonly<HeatmapCellHit>;
  readonly renderContext: HeatmapRenderSnapshot | undefined;
  readonly onFocus: (point: ChartPoint<CellDatum, string, string> | null, key: string) => void;
}

const handleHeatmapCellHover = ({
  coordinator,
  ctx,
  hit,
  renderContext,
  onFocus,
}: Readonly<HeatmapCellHoverParams>): void => {
  coordinator.setHoveredLegendLevel(null);
  coordinator.setHoveredCell({ column: hit.column, row: hit.row });
  const cellX = hit.column * ctx.binWidth + separatorOffsetBefore(hit.column, ctx.separatorLayout);
  coordinator.setTooltipData({
    column: hit.column,
    count: hit.bin.count,
    date: hit.bin.date,
    row: hit.row,
    x: ctx.margin.left + cellX + ctx.binWidth / 2,
    y: ctx.margin.top + hit.row * ctx.binHeight + ctx.binHeight / 2,
  });

  /*
   * C2: datum identity matches the input element, so equality locates the scene point.
   */
  const scenePoint = renderContext?.scene.points.find((candidate: Readonly<{ datum: Readonly<CellDatum> }>) => candidate.datum === hit.datum) ?? null;
  onFocus(scenePoint, `${hit.column}-${hit.row}`);
};

interface HeatmapSceneHitParams {
  readonly interaction: HeatmapRenderSnapshot["interaction"];
  readonly clientX: number;
  readonly clientY: number;
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly ctx: Readonly<HeatmapPointerHitContext>;
}

/*
 * ClientToScene returns margin-inclusive scene coordinates, so margin subtraction still applies.
 */
const resolveHeatmapSceneHit = ({
  interaction,
  clientX,
  clientY,
  cellData,
  ctx,
}: Readonly<HeatmapSceneHitParams>): HeatmapCellHit | undefined => {
  const scenePos = interaction.clientToScene(clientX, clientY);
  if (!scenePos) {return undefined;}
  return locateHoveredHeatmapCell({ cellData, ctx, sceneX: scenePos.x, sceneY: scenePos.y });
};

interface DispatchHeatmapPointerHitParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly clientX: number;
  readonly clientY: number;
  readonly coordinator: HeatmapHoverCoordinator;
  readonly ctx: ReturnType<typeof useHeatmap>;
  readonly interaction: HeatmapRenderSnapshot["interaction"];
  readonly onFocus: (point: ChartPoint<CellDatum, string, string> | null, key: string) => void;
  readonly onLeave: () => void;
  readonly renderContext: HeatmapRenderSnapshot | undefined;
}

const dispatchHeatmapPointerHit = ({
  cellData,
  clientX,
  clientY,
  coordinator,
  ctx,
  interaction,
  onFocus,
  onLeave,
  renderContext,
}: Readonly<DispatchHeatmapPointerHitParams>): void => {
  const hit = resolveHeatmapSceneHit({ cellData, clientX, clientY, ctx, interaction });
  if (!hit) {
    onLeave();
    return;
  }
  handleHeatmapCellHover({ coordinator, ctx, hit, onFocus, renderContext });
};

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

export {
  armFocusTimer,
  armHeatmapFocusTimer,
  clearFocusTimer,
  createHeatmapPointerMoveHandler,
  dispatchHeatmapPointerHit,
  findHeatmapCellDatum,
  findHeatmapColumnForSceneX,
  handleHeatmapCellHover,
  locateHoveredHeatmapCell,
  resolveHeatmapSceneHit,
  useHeatmapPointerBridge,
};
export type {
  ArmHeatmapFocusTimerParams,
  CreateHeatmapPointerMoveHandlerParams,
  DispatchHeatmapPointerHitParams,
  HeatmapCellDatumLookupParams,
  HeatmapCellHit,
  HeatmapCellHoverParams,
  HeatmapPointerBridge,
  HeatmapPointerHitContext,
  HeatmapRenderSnapshot,
  HeatmapSceneHitParams,
  LocateHeatmapCellParams,
  UseHeatmapPointerBridgeParams,
};
