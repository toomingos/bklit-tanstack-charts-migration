import type { ReactElement } from "react";
import { useHeatmap } from "./heatmap-context";
import { useHeatmapCoordinatorOptional } from "./heatmap-interaction";
import { HEATMAP_INACTIVE_OPACITY } from "./heatmap-hover-chrome";
import {
  useHeatmapCellsData,
  useHeatmapCellsDefinition,
  useHeatmapCellsTooltip,
  useHeatmapCellsTooltipBody,
  useHeatmapPatternPrefix,
} from "./heatmap-cells-hooks";
import { useHeatmapPointerBridge } from "./heatmap-focus-bridge";
import { buildHeatmapCellsTree } from "./heatmap-cells-view";

interface HeatmapCellsProps {
  readonly cornerRadius?: number;
  readonly colorScale?: (count: number) => string;
  readonly inactiveOpacity?: number;
  readonly inactiveScale?: number;
  readonly activeScale?: number;
  readonly rowOpacity?: number | readonly number[];
  readonly interactive?: boolean;
  readonly hideGhostCells?: boolean;
}

const HeatmapCells = ({
  cornerRadius = 2,
  colorScale: _colorScaleProp,
  inactiveOpacity = HEATMAP_INACTIVE_OPACITY,
  inactiveScale = 1,
  activeScale = 1,
  rowOpacity,
  interactive = true,
  hideGhostCells = true,
}: Readonly<HeatmapCellsProps>): ReactElement => {
  const ctx = useHeatmap();
  const coordinator = useHeatmapCoordinatorOptional();
  const { tooltipConfig, tooltipPanelStyle } = useHeatmapCellsTooltip(coordinator);
  const { cellData, dayLabels } = useHeatmapCellsData({ ctx, hideGhostCells });
  const patternIdPrefix = useHeatmapPatternPrefix(ctx.levelStyles);
  const definition = useHeatmapCellsDefinition({
    activeScale,
    cellData,
    cornerRadius,
    ctx,
    dayLabels,
    inactiveOpacity,
    inactiveScale,
    patternIdPrefix,
    rowOpacity,
    tooltipEnabled: tooltipConfig !== null,
  });
  const { containerRef, handleRender } = useHeatmapPointerBridge({
    cellData,
    coordinator,
    ctx,
    interactive,
    tooltipConfig,
  });
  const renderTooltipBody = useHeatmapCellsTooltipBody({ tooltipConfig, tooltipPanelStyle });
  return (
    <>
      {buildHeatmapCellsTree({
        containerRef,
        ctx,
        definition,
        handleRender,
        patternIdPrefix,
        renderTooltipBody,
      })}
    </>
  );
};

export { HeatmapSeparator } from "./heatmap-separator";
export type { HeatmapSeparatorProps } from "./heatmap-separator";
export { HeatmapTooltip } from "./heatmap-tooltip-registry";
export type { HeatmapTooltipProps } from "./heatmap-tooltip-registry";
export { HeatmapXAxis } from "./heatmap-x-axis";
export type { HeatmapXAxisProps } from "./heatmap-x-axis";
export { HeatmapYAxis } from "./heatmap-y-axis";
export type { HeatmapYAxisProps } from "./heatmap-y-axis";
export { HeatmapCells };
export type { HeatmapCellsProps };
