import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { HeatmapMargin, useHeatmap } from "./heatmap-context";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import type { HeatmapColumn } from "./heatmap-utils";
import { buildHoverCellGeometry } from "./heatmap-cell-data";
import type { CellDatum } from "./heatmap-cell-data";

const clearFocusTimer = (timerId: number | undefined): void => {
  if (timerId !== undefined) {
    globalThis.clearTimeout(timerId);
  }
};

const armFocusTimer = (delayMs: number, apply: () => void): number | undefined => {
  if (delayMs <= 0) {
    apply();
    return undefined;
  }
  return window.setTimeout(apply, delayMs);
};

interface ArmHeatmapFocusTimerParams {
  readonly interaction: HeatmapRenderSnapshot["interaction"];
  readonly point: ChartPoint<CellDatum, string, string> | null;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

// Bklit spec: 120ms hide delay, debouncing the focus clear (not the
// Tooltip) — cancelled in `scheduleFocus` if the pointer re-enters a
// Cell first. `showDelayMs` applies when a cell is hovered.
const armHeatmapFocusTimer = ({
  interaction,
  point,
  tooltipConfig,
}: Readonly<ArmHeatmapFocusTimerParams>): number | undefined => {
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

  // C2: bridge the app-detected hover to the native tooltip/focus
  // Engine. `cell()`/`rect()` builds each ChartPoint's `datum` as the
  // Exact input array element (dist/rect.js), so reference equality
  // Against the hit datum reliably locates the matching scene point.
  const scenePoint = renderContext?.scene.points.find((p: Readonly<{ datum: Readonly<CellDatum> }>) => p.datum === hit.datum) ?? null;
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
  const bin = ctx.data[column]?.bins[row];
  if (!bin) {
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

  if (foundCol < 0 || foundRow < 0 || foundRow >= (ctx.data[0]?.bins.length ?? 7)) {
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

// C3: `clientToScene` (dist/dom-types.d.ts:33) is the documented
// Controller API for client->chart coordinate conversion, replacing a
// DOM `querySelector` + `getBoundingClientRect` reach-in into the
// Renderer's own SVG. It returns MARGIN-INCLUSIVE "scene" coordinates —
// The same space `xScale`/`yScale` operate in inside `defineChart`
// (dist/svg-coordinates.js's `svgClientToScene`, verified against
// `heatmap-context.ts`/`heatmap-chart.tsx`'s plot-local `xScale`/
// `yScale`, which are `column*binWidth + offset` from 0) — so the
// Existing plot-local column/row math in `locateHoveredHeatmapCell`
// Still needs the same `- margin.left` / `- margin.top` subtraction.
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

// Pointer position -> hover/leave dispatch for the overlay svg listeners.
// Extracted from `handlePointerMove` so the handler stays under the
// Statement limit; the call graph is unchanged.
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
