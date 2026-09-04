import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useHeatmap } from "./heatmap-context";
import { flattenChartChildren, isHeatmapSeparatorChild } from "./heatmap-children";

// Split so heatmap-chart.tsx declares a single component (react/no-multi-comp).

interface HeatmapSeparatorChildren {
  readonly separators: readonly ReactElement[];
  readonly others: readonly ReactElement[];
}

const useSeparatorChildren = (children: Readonly<ReactNode>): HeatmapSeparatorChildren =>
  useMemo(() => {
    const flat = flattenChartChildren(children);
    const separators = flat.filter((child: Readonly<ReactElement>) => isHeatmapSeparatorChild(child));
    const others = flat.filter((child: Readonly<ReactElement>) => !isHeatmapSeparatorChild(child));
    return { others, separators };
  }, [children]);

interface HeatmapChartSurfaceProps {
  readonly children?: ReactNode;
  readonly onHtmlLayerMount: (el: HTMLDivElement | null) => void;
}

const SURFACE_ROOT_STYLE: CSSProperties = { position: "relative" };
const SEPARATOR_SVG_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };
const HTML_LAYER_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };
const LOADING_LABEL_STYLE: CSSProperties = {
  alignItems: "center",
  display: "flex",
  height: "100%",
  justifyContent: "center",
  left: 0,
  top: 0,
  width: "100%",
};

const HeatmapChartSurface = ({ children, onHtmlLayerMount }: Readonly<HeatmapChartSurfaceProps>): ReactElement => {
  const ctx = useHeatmap();
  const { separators, others } = useSeparatorChildren(children);

  return (
    <div style={SURFACE_ROOT_STYLE}>
      {others}
      <svg
        width={ctx.width}
        height={ctx.height}
        className="ts-bkm-heatmap-separator-svg"
        style={SEPARATOR_SVG_STYLE}
        aria-hidden="true"
      >
        <g transform={`translate(${ctx.margin.left}, ${ctx.margin.top})`}>
          {separators}
        </g>
      </svg>
      <div ref={onHtmlLayerMount} className="ts-bkm-heatmap-html-layer" style={HTML_LAYER_STYLE} />
      {ctx.showLoadingLabel && (
        <div
          className={`ts-bkm-heatmap-loading-label${ctx.chartPhase === "exitingReady" ? " ts-bkm-heatmap-loading-label--exiting" : ""}`}
          style={LOADING_LABEL_STYLE}
        >
          {ctx.loadingLabel}
        </div>
      )}
    </div>
  );
};

export {
  type HeatmapSeparatorChildren,
  HeatmapChartSurface,
  type HeatmapChartSurfaceProps,
};
