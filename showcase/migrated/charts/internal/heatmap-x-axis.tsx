import { createPortal } from "react-dom";
import { memo, useMemo } from "react";
import type { ReactElement } from "react";
import { useHeatmap } from "./heatmap-context";
import { formatHeatmapMonthShort, getHeatmapColumnMonthAnchor } from "./heatmap-utils";
import type { HeatmapColumn } from "./heatmap-utils";
import { HEATMAP_AXIS_LAYER_CLASS } from "./heatmap-separator";

interface HeatmapXAxisProps {
  className?: string;
}

// Build the x-axis month labels, one per month transition across columns.
const buildHeatmapXAxisLabels = (
  data: readonly HeatmapColumn[],
): { columnIndex: number; key: string; text: string }[] => {
  let lastMonthKey = "";
  const labels: { columnIndex: number; key: string; text: string }[] = [];
  for (const [columnIndex, column] of data.entries()) {
    const anchor = getHeatmapColumnMonthAnchor(column);
    if (anchor) {
      const monthKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;
      if (monthKey !== lastMonthKey) {
        lastMonthKey = monthKey;
        labels.push({ columnIndex, key: monthKey, text: formatHeatmapMonthShort(anchor) });
      }
    }
  }
  return labels;
};

const HeatmapXAxis = memo(({ className }: Readonly<HeatmapXAxisProps>): ReactElement | undefined => {
  const ctx = useHeatmap();
  const { xScale } = ctx;
  const layerStyle = useMemo(
    () => ({
      height: ctx.margin.top,
      left: ctx.margin.left,
      pointerEvents: "none" as const,
      position: "absolute" as const,
      top: 0,
      width: ctx.innerWidth,
    }),
    [ctx.innerWidth, ctx.margin.left, ctx.margin.top],
  );
  const labels = useMemo(() => buildHeatmapXAxisLabels(ctx.data), [ctx.data]);
  // Per-tick styles precomputed alongside the labels so the `.map()` below
  // Passes stable identities instead of rebuilding an object per tick.
  const tickStyles = useMemo(
    () => labels.map((label: Readonly<{ columnIndex: number; key: string; text: string }>) => ({ left: xScale(label.columnIndex), position: "absolute" as const, top: 0 })),
    [labels, xScale],
  );
  if (!ctx.htmlLayerEl) {return undefined;}

  return createPortal(
    <div
      className={className ? `${HEATMAP_AXIS_LAYER_CLASS} ${className}` : HEATMAP_AXIS_LAYER_CLASS}
      style={layerStyle}
    >
      {labels.map((label: Readonly<{ columnIndex: number; key: string; text: string }>, index) => (
        <span
          key={label.key}
          className="ts-bkm-heatmap-axis-label"
          style={tickStyles[index]}
        >
          {label.text}
        </span>
      ))}
    </div>,
    ctx.htmlLayerEl,
  );
});

HeatmapXAxis.displayName = "HeatmapXAxis";

export { HeatmapXAxis };
export type { HeatmapXAxisProps };
