import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { HeatmapContextValue, HeatmapHoverCoordinator } from "./heatmap-context";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import type { CellDatum } from "./heatmap-cell-data";

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

// Package-owned pointer: last scene plus interaction per coordinator.
// Legend hover uses it to focus a representative cell.
const heatmapFocusEntries = new WeakMap<HeatmapHoverCoordinator, HeatmapRenderSnapshot>();

// Expected echo of a legend-driven setControlledFocus, consumed once.
// Stale entries self-heal on the next non-matching focus event.
const heatmapFocusExpectations = new WeakMap<HeatmapHoverCoordinator, string | null>();

// Legend hover focuses one cell with source programmatic (legend states dim).
// No-op without a rendered scene.
const focusHeatmapLevel = (coordinator: Readonly<HeatmapHoverCoordinator> | null, level: number | null): void => {
  if (!coordinator) {return;}
  const entry = heatmapFocusEntries.get(coordinator);
  if (!entry) {return;}
  if (level === null) {
    heatmapFocusExpectations.set(coordinator, null);
    entry.interaction.setControlledFocus(null, { source: "programmatic" });
    return;
  }
  const sample = entry.scene.points.find((point) => !point.datum.isGhost && point.datum.level === level) ?? null;
  heatmapFocusExpectations.set(coordinator, sample?.key ?? null);
  entry.interaction.setControlledFocus(sample, { source: "programmatic" });
};

interface UseHeatmapFocusRelayParams {
  readonly coordinator: HeatmapHoverCoordinator | null;
  readonly cellsInteractive: boolean;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

// Package focus reaches the coordinator here (V2.2).
// Tooltip payload keeps the legacy hover delay (`heatmap-tooltip.tsx:46-47`).
const useHeatmapFocusRelay = ({
  coordinator,
  cellsInteractive,
  tooltipConfig,
}: Readonly<UseHeatmapFocusRelayParams>): ((point: ChartPoint<CellDatum, string, string> | null) => void) => {
  const tooltipTimerRef = useRef<HeatmapFocusTimerId | undefined>(undefined);
  const isShowingRef = useRef(false);

  useEffect(() => (): void => {
    clearFocusTimer(tooltipTimerRef.current);
    tooltipTimerRef.current = undefined;
  }, []);

  return useCallback((point: ChartPoint<CellDatum, string, string> | null): void => {
    if (!coordinator || !cellsInteractive) {return;}
    if (heatmapFocusExpectations.has(coordinator)) {
      const expected = heatmapFocusExpectations.get(coordinator);
      heatmapFocusExpectations.delete(coordinator);
      if ((point?.key ?? null) === expected) {return;}
    }
    if (point && !point.datum.isGhost) {
      const { column, row, count, date } = point.datum;
      coordinator.setHoveredLegendLevel(null);
      coordinator.setHoveredCell({ column, row });
      clearFocusTimer(tooltipTimerRef.current);
      tooltipTimerRef.current = undefined;
      const tooltipData = { column, count, date, row, x: point.x, y: point.y };
      const showMs = tooltipConfig?.showDelayMs ?? 0;
      if (isShowingRef.current || showMs <= 0) {
        isShowingRef.current = true;
        coordinator.setTooltipData(tooltipData);
      } else {
        tooltipTimerRef.current = armFocusTimer(showMs, () => {
          isShowingRef.current = true;
          coordinator.setTooltipData(tooltipData);
        });
      }
      return;
    }
    coordinator.setHoveredCell(null);
    clearFocusTimer(tooltipTimerRef.current);
    tooltipTimerRef.current = undefined;
    const hideMs = tooltipConfig?.hideDelayMs ?? 0;
    if (hideMs <= 0) {
      isShowingRef.current = false;
      coordinator.setTooltipData(null);
    } else {
      tooltipTimerRef.current = armFocusTimer(hideMs, () => {
        isShowingRef.current = false;
        coordinator.setTooltipData(null);
      });
    }
  }, [cellsInteractive, coordinator, tooltipConfig]);
};

interface UseHeatmapPointerBridgeParams {
  readonly coordinator: HeatmapHoverCoordinator | null;
  readonly ctx: Pick<HeatmapContextValue, "chartStatus">;
  readonly interactive: boolean;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

interface HeatmapPointerBridge {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly handleFocusChange: (point: ChartPoint<CellDatum, string, string> | null) => void;
  readonly handleRender: (renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => void;
}

// V2.2: package owns the pointer; the bridge forwards focus to the coordinator.
// No container listeners and no arithmetic hit test remain here.
const useHeatmapPointerBridge = ({
  coordinator,
  ctx,
  interactive,
  tooltipConfig,
}: Readonly<UseHeatmapPointerBridgeParams>): HeatmapPointerBridge => {
  const cellsInteractive = interactive && ctx.chartStatus !== "loading";
  // Inert layout anchor; pointer handling lives in the package (see above).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleFocusChange = useHeatmapFocusRelay({ cellsInteractive, coordinator, tooltipConfig });

  const handleRender = useCallback((renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => {
    if (coordinator) {
      heatmapFocusEntries.set(coordinator, { interaction: renderCtx.interaction, scene: renderCtx.scene });
    }
  }, [coordinator]);

  return { containerRef, handleFocusChange, handleRender };
};

export {
  armFocusTimer,
  clearFocusTimer,
  focusHeatmapLevel,
  useHeatmapPointerBridge,
};
export type {
  HeatmapPointerBridge,
  HeatmapRenderSnapshot,
  UseHeatmapPointerBridgeParams,
};
