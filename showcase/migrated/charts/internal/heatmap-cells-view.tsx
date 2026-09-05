import type { ReactElement, RefObject } from "react";
import { ChartHost, HOST_INITIAL_WIDTH } from "./chart-host";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import type { useHeatmap } from "./heatmap-context";
import { chartMotionRenderer } from "./motion-renderer";
import { formatHeatmapTooltipDate, formatHeatmapTooltipWeekday } from "./heatmap-utils";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import type { useHeatmapChartDefinition } from "./heatmap-definition";
import type { CellDatum } from "./heatmap-cell-data";
import { HeatmapPatternDefs } from "./heatmap-cell-pattern-defs";

// Static element styles hoisted so `HeatmapCells` passes stable identities
// Instead of per-render object literals (react-perf parity).
const HEATMAP_CELLS_CONTAINER_STYLE = { position: "relative", zIndex: 1 } as const;
const HEATMAP_CELLS_INNER_STYLE = { position: "relative" } as const;
const HEATMAP_HOVER_SVG_STYLE = { inset: 0, position: "absolute" } as const;
const HEATMAP_RENDERER_STYLE = { overflow: "visible" } as const;

const renderHeatmapTooltipContent = (datum: Readonly<CellDatum>, config: Readonly<HeatmapTooltipConfig>): ReactElement => (
  <div className="bkm-tooltip-content">
    <div className="ts-bkm-heatmap-tooltip-date">{formatHeatmapTooltipDate(datum.date)}</div>
    <div className="ts-bkm-heatmap-tooltip-weekday">{formatHeatmapTooltipWeekday(datum.date)}</div>
    <div className="ts-bkm-heatmap-tooltip-divider" />
    <div className="ts-bkm-heatmap-tooltip-value">{config.formatLabel(datum.count, datum.date)}</div>
  </div>
);

interface BuildHeatmapCellsTreeParams {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly ctx: ReturnType<typeof useHeatmap>;
  readonly definition: ReturnType<typeof useHeatmapChartDefinition>;
  readonly handleRender: (renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => void;
  readonly patternIdPrefix: string | undefined;
  readonly renderTooltipBody: (bodyCtx: Readonly<{ points: readonly { readonly datum: Readonly<CellDatum> }[] }>) => ReactElement | undefined;
}

const buildHeatmapCellsTree = ({
  ariaDescription,
  ariaLabel = "Heatmap chart",
  containerRef,
  ctx,
  definition,
  handleRender,
  patternIdPrefix,
  renderTooltipBody,
}: Readonly<BuildHeatmapCellsTreeParams>): ReactElement => (
  <div ref={containerRef} style={HEATMAP_CELLS_CONTAINER_STYLE}>
    <div style={HEATMAP_CELLS_INNER_STYLE}>
      <ChartHost
        renderer={chartMotionRenderer<CellDatum, string, string>()}
        className="ts-bkm-heatmap-svg"
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        definition={definition}
        initialWidth={HOST_INITIAL_WIDTH}
        height={ctx.height}
        style={HEATMAP_RENDERER_STYLE}
        onRender={handleRender}
        renderTooltipBody={renderTooltipBody}
      />
    </div>
    <svg
      width={ctx.width}
      height={ctx.height}
      aria-hidden="true"
      className="ts-bkm-heatmap-hover-svg"
      style={HEATMAP_HOVER_SVG_STYLE}
    >
      <HeatmapPatternDefs
        levelStyles={ctx.levelStyles}
        patternIdPrefix={patternIdPrefix}
        phaseX={ctx.margin.left}
        phaseY={ctx.margin.top}
      />
    </svg>
  </div>
);

export { buildHeatmapCellsTree, renderHeatmapTooltipContent };
export type { BuildHeatmapCellsTreeParams };
