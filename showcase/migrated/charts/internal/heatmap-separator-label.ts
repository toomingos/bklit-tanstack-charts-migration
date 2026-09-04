import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useHeatmap } from "./heatmap-context";
import type { HeatmapSeparatorGroup } from "./heatmap-utils";

interface SeparatorLabelPresentation {
  readonly labelGroups: readonly HeatmapSeparatorGroup[];
  readonly labelStyles: readonly Readonly<CSSProperties>[];
  readonly layerStyle: Readonly<CSSProperties>;
}

// Memoised label-layer geometry for the separator overlay.
// Hoisted out of HeatmapSeparator so that component stays under its size limits.
const useSeparatorLabelPresentation = (
  labelOffset: number,
  startOffset: number | undefined,
): SeparatorLabelPresentation => {
  const ctx = useHeatmap();
  const labelGroups = ctx.separatorLayout?.groups ?? [];
  const labelStyles: readonly CSSProperties[] = labelGroups.map((group) => ({
    left: ctx.xScale(group.startColumnIndex),
    position: "absolute",
  }));
  const layerStyle = useMemo<CSSProperties>(() => ({
    height: ctx.margin.top,
    left: ctx.margin.left,
    pointerEvents: "none",
    position: "absolute",
    top: (startOffset ?? ctx.margin.top) + labelOffset,
    width: ctx.innerWidth,
  }), [ctx.innerWidth, ctx.margin.left, ctx.margin.top, labelOffset, startOffset]);
  return { labelGroups, labelStyles, layerStyle };
};

export { useSeparatorLabelPresentation };
export type { SeparatorLabelPresentation };
