import type { CSSProperties, ReactElement } from "react";
import { HEATMAP_INACTIVE_TRANSITION_CSS } from "./heatmap-hover-chrome";
import type { HeatmapHoverStyleParams } from "./heatmap-hover-chrome";
import type { HeatmapLevelStyles } from "./heatmap-colors";
import { resolveHeatmapHoverStyle } from "./heatmap-utils";
import { HeatmapLegendSwatch } from "./heatmap-legend-swatch";

interface LegendSwatchArgs {
  readonly level: number;
  readonly highlightedLevel: number | null;
  readonly isDimming: boolean;
  readonly hoverParams: Readonly<HeatmapHoverStyleParams>;
  readonly levelStyles: HeatmapLevelStyles;
  readonly isInteractive: boolean;
  readonly cellSize: number;
  readonly cornerRadius: number;
  readonly onEnter: (level: number) => void;
  readonly onLeave: () => void;
}

// One swatch with its hover wrapper; plain function (not a component) so the element tree is unchanged.
const renderLegendSwatch = (swatch: Readonly<LegendSwatchArgs>): ReactElement => {
  const isHighlighted = swatch.highlightedLevel === swatch.level;
  const isDimmed = swatch.isDimming && !isHighlighted;
  const hoverStyle = resolveHeatmapHoverStyle(isHighlighted, isDimmed, swatch.hoverParams);
  const style = swatch.levelStyles[swatch.level] ?? swatch.levelStyles[0];
  const swatchWrapStyle: CSSProperties = {
    opacity: hoverStyle.opacity,
    transform: `scale(${hoverStyle.scale})`,
    transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}, transform ${HEATMAP_INACTIVE_TRANSITION_CSS}`,
  };
  if (swatch.isInteractive) {
    swatchWrapStyle.cursor = "pointer";
  }
  const { onLeave: handleLeave } = swatch;
  const swatchNode = (<HeatmapLegendSwatch level={swatch.level} style={style} cellSize={swatch.cellSize} cornerRadius={swatch.cornerRadius} />);
  return (
    <span
      key={swatch.level}
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-swatch-wrap"
      onPointerEnter={() =>{  swatch.onEnter(swatch.level); }}
      onPointerLeave={handleLeave}
      style={swatchWrapStyle}
    >
      {swatchNode}
    </span>
  );
};

export { renderLegendSwatch };
