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

// Fallback level when the swatch level has no dedicated style entry.
const FIRST_LEVEL_INDEX = 0;

// Enter-handler factory; module scope so the render path passes no inline closures.
const createSwatchEnterHandler = (swatch: Readonly<LegendSwatchArgs>): (() => void) => (): void => {
  swatch.onEnter(swatch.level);
};

// Swatch wrapper style; module-scope factory so no object literal lives in the render path.
const buildSwatchWrapStyle = (swatch: Readonly<LegendSwatchArgs>): CSSProperties => {
  const isHighlighted = swatch.highlightedLevel === swatch.level;
  const isDimmed = swatch.isDimming && !isHighlighted;
  const hoverStyle = resolveHeatmapHoverStyle(isHighlighted, isDimmed, swatch.hoverParams);
  const swatchWrapStyle: CSSProperties = {
    opacity: hoverStyle.opacity,
    transform: `scale(${hoverStyle.scale})`,
    transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}, transform ${HEATMAP_INACTIVE_TRANSITION_CSS}`,
  };
  if (swatch.isInteractive) {
    swatchWrapStyle.cursor = "pointer";
  }
  return swatchWrapStyle;
};

// One swatch with its hover wrapper; plain function (not a component) so the element tree is unchanged.
const renderLegendSwatch = (swatch: Readonly<LegendSwatchArgs>): ReactElement => {
  const swatchWrapStyle = buildSwatchWrapStyle(swatch);
  const style = swatch.levelStyles[swatch.level] ?? swatch.levelStyles[FIRST_LEVEL_INDEX];
  const { onLeave: handleLeave } = swatch;
  const handleEnter = createSwatchEnterHandler(swatch);
  const swatchNode = (<HeatmapLegendSwatch level={swatch.level} style={style} cellSize={swatch.cellSize} cornerRadius={swatch.cornerRadius} />);
  return (
    <span
      key={swatch.level}
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-swatch-wrap"
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      style={swatchWrapStyle}
    >
      {swatchNode}
    </span>
  );
};

export { renderLegendSwatch };
