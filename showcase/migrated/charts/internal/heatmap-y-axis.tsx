import { createPortal } from "react-dom";
import { memo, useMemo } from "react";
import type { ReactElement } from "react";
import { useHeatmap } from "./heatmap-context";
import {
  formatHeatmapYAxisLabel,
  getHeatmapDayLabels,
  resolveHeatmapRowOpacity,
  shouldShowHeatmapYAxisTick,
} from "./heatmap-utils";
import type { HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter } from "./heatmap-utils";
import { HEATMAP_AXIS_LAYER_CLASS } from "./heatmap-separator";

interface HeatmapYAxisProps {
  className?: string;
  tickFilter?: HeatmapYAxisTickFilter;
  labelFormat?: HeatmapYAxisLabelFormat;
  rowOpacity?: number | readonly number[];
}

const HeatmapYAxis = memo(({
  className,
  tickFilter = "odd",
  labelFormat = "full",
  rowOpacity,
}: Readonly<HeatmapYAxisProps>): ReactElement | undefined => {
  const ctx = useHeatmap();
  const { binHeight, yScale } = ctx;
  const dayLabels = useMemo(() => getHeatmapDayLabels(ctx.weekStartDay), [ctx.weekStartDay]);
  // Per-row styles precomputed alongside the day labels so the `.map()`
  // Below passes stable identities instead of rebuilding an object per row.
  const rowTickStyles = useMemo(
    () => dayLabels.map((_label, row) => ({ opacity: resolveHeatmapRowOpacity(row, rowOpacity), position: "absolute" as const, right: 4, top: yScale(row) + binHeight / 2 })),
    [binHeight, dayLabels, rowOpacity, yScale],
  );
  const layerStyle = useMemo(
    () => ({
      height: ctx.innerHeight,
      left: 0,
      pointerEvents: "none" as const,
      position: "absolute" as const,
      top: ctx.margin.top,
      width: ctx.margin.left,
    }),
    [ctx.innerHeight, ctx.margin.left, ctx.margin.top],
  );
  if (!ctx.htmlLayerEl) {return undefined;}

  return createPortal(
    <div
      className={className !== undefined && className !== "" ? `${HEATMAP_AXIS_LAYER_CLASS} ${className}` : HEATMAP_AXIS_LAYER_CLASS}
      style={layerStyle}
    >
      {dayLabels.map((label, row) =>
        shouldShowHeatmapYAxisTick(row, tickFilter) ? (
          <span
            key={label}
            className="ts-bkm-heatmap-axis-label ts-bkm-heatmap-axis-label--y"
            style={rowTickStyles[row]}
          >
            {formatHeatmapYAxisLabel(label, labelFormat)}
          </span>
        ) : undefined,
      )}
    </div>,
    ctx.htmlLayerEl,
  );
});

HeatmapYAxis.displayName = "HeatmapYAxis";

export { HeatmapYAxis };
export type { HeatmapYAxisProps };
