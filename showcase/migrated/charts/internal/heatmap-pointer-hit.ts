import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { HeatmapMargin, useHeatmap } from "./heatmap-context";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import type { HeatmapColumn } from "./heatmap-utils";
import { buildHoverCellGeometry } from "./heatmap-cell-data";
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
  readonly xScale: (columnIndex: number) => number;
  readonly binWidth: number;
  readonly binHeight: number;
  readonly margin: Readonly<HeatmapMargin>;
}

interface HeatmapCellHit {
  readonly column: number;
  readonly row: number;
  readonly datum: Readonly<CellDatum>;
  readonly bin: HeatmapColumn["bins"][number];
}

interface LocateHeatmapCellParams {
  readonly ctx: Readonly<HeatmapPointerHitContext>;
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly sceneX: number;
  readonly sceneY: number;
}

type HeatmapRenderSnapshot = Pick<ChartRendererRenderContext<CellDatum, string, string>, "interaction" | "scene">;

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
  const geo = buildHoverCellGeometry(hit.column, hit.row, ctx);
  coordinator.setTooltipData({
    column: hit.column,
    count: hit.bin.count,
    date: hit.bin.date,
    row: hit.row,
    x: ctx.margin.left + geo.x + geo.width / 2,
    y: ctx.margin.top + geo.y + geo.height / 2,
  });

  /*
   * C2: datum identity matches the input element, so equality locates the scene point.
   */
  const scenePoint = renderContext?.scene.points.find((candidate: Readonly<{ datum: Readonly<CellDatum> }>) => candidate.datum === hit.datum) ?? null;
  onFocus(scenePoint, `${hit.column}-${hit.row}`);
};

const findHeatmapColumnForSceneX = (
  ctx: Readonly<HeatmapPointerHitContext>,
  posX: number,
): number => {
  for (let i = 0; i < ctx.data.length; i += 1) {
    const colX = ctx.xScale(i);
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

export {
  armFocusTimer,
  armHeatmapFocusTimer,
  clearFocusTimer,
  dispatchHeatmapPointerHit,
  findHeatmapCellDatum,
  findHeatmapColumnForSceneX,
  handleHeatmapCellHover,
  locateHoveredHeatmapCell,
  resolveHeatmapSceneHit,
};
export type {
  ArmHeatmapFocusTimerParams,
  DispatchHeatmapPointerHitParams,
  HeatmapCellDatumLookupParams,
  HeatmapCellHit,
  HeatmapCellHoverParams,
  HeatmapPointerHitContext,
  HeatmapRenderSnapshot,
  HeatmapSceneHitParams,
  LocateHeatmapCellParams,
};
