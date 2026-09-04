import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import { HEATMAP_INACTIVE_TRANSITION_CSS } from "./heatmap-hover-chrome";
import { buildHeatmapLegendGradient, resolveHeatmapHoverStyle } from "./heatmap-utils";
import type { HeatmapLevelStyles } from "./heatmap-colors";

// Gradient variant of the heatmap legend, split out so heatmap-legend.tsx stays
// Under the size limits.

interface HeatmapLegendGradientProps {
  readonly levels: readonly number[];
  readonly levelStyles: HeatmapLevelStyles;
  readonly cellSize: number;
  readonly gap: number;
  readonly cornerRadius: number;
  readonly gradientSpan: number;
  readonly highlightedLevel: number | null;
  readonly isDimming: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
  readonly isInteractive: boolean;
  readonly onEnter: (level: number) => void;
  readonly onLeave: () => void;
}

interface GradientSegmentVisualArgs {
  readonly barHeight: number;
  readonly index: number;
  readonly segmentWidth: number;
  readonly isHighlighted: boolean;
  readonly isDimming: boolean;
  readonly activeScale: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly isInteractive: boolean;
}

const buildGradientSegmentVisual = (segment: Readonly<GradientSegmentVisualArgs>): CSSProperties => {
  const isDimmed = segment.isDimming && !segment.isHighlighted;
  const hoverStyle = resolveHeatmapHoverStyle(segment.isHighlighted, isDimmed, { activeScale: segment.activeScale, inactiveOpacity: segment.inactiveOpacity, inactiveScale: segment.inactiveScale });
  const segmentStyle: CSSProperties = {
    height: segment.barHeight,
    left: segment.index * segment.segmentWidth,
    opacity: hoverStyle.opacity,
    transform: `scale(${hoverStyle.scale})`,
    transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}, transform ${HEATMAP_INACTIVE_TRANSITION_CSS}`,
    width: segment.segmentWidth,
  };
  if (segment.isInteractive) {
    segmentStyle.cursor = "pointer";
  }
  return segmentStyle;
};

interface GradientSegmentArgs {
  readonly level: number;
  readonly index: number;
  readonly barHeight: number;
  readonly segmentWidth: number;
  readonly highlightedLevel: number | null;
  readonly isDimming: boolean;
  readonly activeScale: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly isInteractive: boolean;
  readonly onEnter: (level: number) => void;
  readonly onLeave: () => void;
}

// Enter-handler factory; module scope so the render path passes no inline closures.
const createGradientEnterHandler = (segment: Readonly<GradientSegmentArgs>): (() => void) => (): void => {
  segment.onEnter(segment.level);
};

// One gradient segment; plain function (not a component) so the element tree is unchanged.
const renderGradientSegment = (segment: Readonly<GradientSegmentArgs>): ReactElement => {
  const isHighlighted = segment.highlightedLevel === segment.level;
  const { onLeave: handleLeave } = segment;
  const handleEnter = createGradientEnterHandler(segment);
  const segmentStyle = buildGradientSegmentVisual({
    activeScale: segment.activeScale,
    barHeight: segment.barHeight,
    inactiveOpacity: segment.inactiveOpacity,
    inactiveScale: segment.inactiveScale,
    index: segment.index,
    isDimming: segment.isDimming,
    isHighlighted,
    isInteractive: segment.isInteractive,
    segmentWidth: segment.segmentWidth,
  });
  return (
    <span
      key={segment.level}
      className="ts-bkm-heatmap-legend-gradient-segment"
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      style={segmentStyle}
    />
  );
};

interface GradientBarArgs {
  readonly barWidth: number;
  readonly barHeight: number;
  readonly gradient: string;
  readonly pillRadius: number;
  readonly barOpacity: number;
}

// Gradient bar style; module-scope factory matching buildGradientSegmentVisual above.
const buildGradientBarStyle = (bar: Readonly<GradientBarArgs>): CSSProperties => ({
  background: bar.gradient,
  borderRadius: bar.pillRadius,
  opacity: bar.barOpacity,
  transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}`,
});

// Gradient bar panel; plain function (not a component) so the element tree is unchanged.
const renderGradientBar = (bar: Readonly<GradientBarArgs>): ReactElement => {
  const barStyle = buildGradientBarStyle(bar);
  return (
    <div
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-gradient-bar"
      style={barStyle}
    />
  );
};

const HeatmapLegendGradient = ({
  levels,
  levelStyles,
  cellSize,
  gap,
  cornerRadius,
  gradientSpan,
  highlightedLevel,
  isDimming,
  inactiveOpacity,
  inactiveScale,
  activeScale,
  isInteractive,
  onEnter,
  onLeave,
}: Readonly<HeatmapLegendGradientProps>): ReactElement => {
  const barWidth = gradientSpan * cellSize + (gradientSpan - 1) * gap;
  const barHeight = cellSize;
  const pillRadius = Math.min(cornerRadius, barHeight / 2);
  const segmentWidth = barWidth / levels.length;
  const gradient = buildHeatmapLegendGradient(levelStyles);
  const barOpacity = isDimming && highlightedLevel === null ? inactiveOpacity : 1;
  const containerStyle = useMemo((): CSSProperties => ({ height: barHeight, width: barWidth }), [barHeight, barWidth]);

  return (
    <div className="ts-bkm-heatmap-legend-gradient" style={containerStyle}>
      {renderGradientBar({ barHeight, barOpacity, barWidth, gradient, pillRadius })}
      {levels.map((level, index) => renderGradientSegment({
        activeScale,
        barHeight,
        highlightedLevel,
        inactiveOpacity,
        inactiveScale,
        index,
        isDimming,
        isInteractive,
        level,
        onEnter,
        onLeave,
        segmentWidth,
      }))}
    </div>
  );
}

export type { HeatmapLegendGradientProps };
export { HeatmapLegendGradient };
