import { useCallback, useId, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { useHeatmap } from "./heatmap-context";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import { getHeatmapTooltipConfig, subscribeHeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import { getHeatmapDayLabels, resolveHeatmapDisplayRange } from "./heatmap-utils";
import { hasPatternLevelStyles, useHeatmapChartDefinition } from "./heatmap-definition";
import type { HeatmapLevelStyles } from "./heatmap-colors";
import type { HeatmapRowOpacity } from "./heatmap-cell-marks";
import { buildCellData } from "./heatmap-cell-data";
import type { CellDatum } from "./heatmap-cell-data";
import { renderHeatmapTooltipContent } from "./heatmap-cells-view";

interface HeatmapCellsTooltip {
  readonly tooltipConfig: HeatmapTooltipConfig | null;
  readonly tooltipPanelStyle: CSSProperties | undefined;
}

const useHeatmapCellsTooltip = (
  coordinator: Readonly<HeatmapHoverCoordinator> | null,
): HeatmapCellsTooltip => {
  /* C2: sibling <HeatmapTooltip/> publishes via the registry; drives enablement and delays. */
  const subscribeTooltipConfig = useCallback(
    (listener: () => void) => subscribeHeatmapTooltipConfig(coordinator, listener),
    [coordinator],
  );
  const tooltipConfig = useSyncExternalStore(
    subscribeTooltipConfig,
    () => getHeatmapTooltipConfig(coordinator),
    () => null,
  );
  // Panel style memoized per config so the tooltip body passes a stable
  // Identity instead of rebuilding the object on every tooltip render.
  const tooltipPanelStyle = useMemo(
    () => ({ backgroundColor: tooltipConfig?.backgroundColor, ...tooltipConfig?.panelStyle }),
    [tooltipConfig],
  );
  return { tooltipConfig, tooltipPanelStyle };
};

interface UseHeatmapCellsDataParams {
  readonly ctx: Readonly<ReturnType<typeof useHeatmap>>;
  readonly hideGhostCells: boolean;
}

interface HeatmapCellsData {
  readonly cellData: readonly CellDatum[];
  readonly dayLabels: readonly string[];
}

const useHeatmapCellsData = ({
  ctx,
  hideGhostCells,
}: Readonly<UseHeatmapCellsDataParams>): HeatmapCellsData => {
  const dayLabels = useMemo(() => getHeatmapDayLabels(ctx.weekStartDay), [ctx.weekStartDay]);
  const displayRange = useMemo(
    () => (hideGhostCells ? resolveHeatmapDisplayRange(ctx.data) : undefined),
    [ctx.data, hideGhostCells],
  );
  const cellData = useMemo(
    () => buildCellData({ columns: ctx.data, dayLabels, displayRange, hideGhost: hideGhostCells }),
    [ctx.data, dayLabels, displayRange, hideGhostCells],
  );
  return { cellData, dayLabels };
};

const useHeatmapPatternPrefix = (
  levelStyles: HeatmapLevelStyles,
): string | undefined => {
  // Pattern defs live in the overlay svg; ids are useId-scoped so two chart
  // Instances (or a legend swatch) on one page never collide (HM14/HM7).
  const patternIdRaw = useId().replaceAll(":", "");
  return useMemo(
    () => (hasPatternLevelStyles(levelStyles) ? `hm-${patternIdRaw}` : undefined),
    [patternIdRaw, levelStyles],
  );
};

interface UseHeatmapCellsDefinitionParams {
  readonly activeScale: number;
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly cornerRadius: number;
  readonly ctx: Readonly<ReturnType<typeof useHeatmap>>;
  readonly dayLabels: readonly string[];
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly patternIdPrefix: string | undefined;
  readonly rowOpacity: HeatmapRowOpacity;
  readonly tooltipEnabled: boolean;
}

const useHeatmapCellsDefinition = ({
  activeScale,
  cellData,
  cornerRadius,
  ctx,
  dayLabels,
  inactiveOpacity,
  inactiveScale,
  patternIdPrefix,
  rowOpacity,
  tooltipEnabled,
}: Readonly<UseHeatmapCellsDefinitionParams>): ReturnType<typeof useHeatmapChartDefinition> =>
  useHeatmapChartDefinition({
    activeScale,
    animateCells: ctx.animateCells,
    animationDuration: ctx.animationDuration,
    cellData,
    columnCount: ctx.data.length,
    cornerRadius,
    dayLabels,
    enterStaggerScale: ctx.enterStaggerScale,
    enterTransition: ctx.enterTransition,
    inactiveOpacity,
    inactiveScale,
    innerHeight: ctx.innerHeight,
    innerWidth: ctx.innerWidth,
    margin: { bottom: ctx.margin.bottom, left: ctx.margin.left, right: ctx.margin.right, top: ctx.margin.top },
    patternIdPrefix,
    resolvedLevelStyles: ctx.levelStyles,
    revealEpoch: ctx.revealEpoch,
    rowOpacity,
    tooltipEnabled,
  });

interface UseHeatmapCellsTooltipBodyParams {
  readonly tooltipConfig: HeatmapTooltipConfig | null;
  readonly tooltipPanelStyle: CSSProperties | undefined;
}

type HeatmapTooltipBodyFn = (bodyCtx: Readonly<{ points: readonly { readonly datum: Readonly<CellDatum> }[] }>) => ReactElement | undefined;

const useHeatmapCellsTooltipBody = ({
  tooltipConfig,
  tooltipPanelStyle,
}: Readonly<UseHeatmapCellsTooltipBodyParams>): HeatmapTooltipBodyFn => {
  const renderTooltipBody = useCallback((bodyCtx: Readonly<{ points: readonly { readonly datum: Readonly<CellDatum> }[] }>): ReactElement | undefined => {
    const point = bodyCtx.points.at(0);
    const cfg = tooltipConfig;
    if (point === undefined || !cfg) {return undefined;}
    const { datum } = point;
    return (
      <div
        className={cfg.className ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel"}
        style={tooltipPanelStyle}
      >
        {renderHeatmapTooltipContent(datum, cfg)}
      </div>
    );
  }, [tooltipConfig, tooltipPanelStyle]);
  return renderTooltipBody;
};

export {
  useHeatmapCellsData,
  useHeatmapCellsDefinition,
  useHeatmapCellsTooltip,
  useHeatmapCellsTooltipBody,
  useHeatmapPatternPrefix,
};
export type { HeatmapCellsData, HeatmapCellsTooltip, HeatmapTooltipBodyFn, UseHeatmapCellsDataParams, UseHeatmapCellsDefinitionParams, UseHeatmapCellsTooltipBodyParams };
