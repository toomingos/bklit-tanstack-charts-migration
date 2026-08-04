import { useSyncExternalStore, type CSSProperties } from "react";
import { useHeatmapCoordinatorOptional } from "./heatmap-interaction";
import {
  HEATMAP_INACTIVE_OPACITY,
  HEATMAP_INACTIVE_TRANSITION_CSS,
  type HeatmapHoverStyleParams,
} from "./heatmap-hover-chrome";
import {
  buildHeatmapLegendGradient,
  getHeatmapContributionLevel,
  isHeatmapHoverEffectEnabled,
  resolveHeatmapHoverStyle,
} from "./heatmap-utils";
import {
  defaultHeatmapColorScale,
  type HeatmapLevelStyle,
  type HeatmapLevelStyles,
} from "./heatmap-colors";

export const HEATMAP_LEGEND_LEVELS = [0, 1, 2, 3, 4] as const;

export type HeatmapLegendVariant = "swatches" | "gradient";

export interface HeatmapLegendSwatchProps {
  level: number;
  style: HeatmapLevelStyle;
  cellSize: number;
  cornerRadius: number;
}

export function HeatmapLegendSwatch({ level, style, cellSize, cornerRadius }: HeatmapLegendSwatchProps) {
  return (
    <span
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-swatch"
      style={{
        width: cellSize,
        height: cellSize,
        borderRadius: cornerRadius,
        backgroundColor: style.color,
        border: level === 0 ? `1px solid ${style.color}` : undefined,
        boxSizing: "border-box",
      }}
    />
  );
}

export interface HeatmapLegendProps {
  lessLabel?: string;
  moreLabel?: string;
  cellSize?: number;
  gap?: number;
  cornerRadius?: number;
  align?: "start" | "center" | "end";
  variant?: HeatmapLegendVariant;
  gradientSpan?: number;
  fontSize?: number;
  labelClassName?: string;
  levelStyles?: HeatmapLevelStyles;
  colorScale?: (count: number | null | undefined) => string;
  inactiveOpacity?: number;
  inactiveScale?: number;
  activeScale?: number;
  interactive?: boolean;
  className?: string;
}

export function HeatmapLegend({
  lessLabel = "Less",
  moreLabel = "More",
  cellSize = 11,
  gap = 2,
  cornerRadius = 2,
  align = "end",
  variant = "swatches",
  gradientSpan = 5,
  fontSize,
  labelClassName,
  levelStyles: levelStylesProp,
  colorScale = defaultHeatmapColorScale,
  inactiveOpacity = HEATMAP_INACTIVE_OPACITY,
  inactiveScale = 1,
  activeScale = 1,
  interactive,
  className,
}: HeatmapLegendProps) {
  const coordinator = useHeatmapCoordinatorOptional();
  const isInteractive = interactive ?? coordinator != null;
  const levelStyles: HeatmapLevelStyles =
    levelStylesProp ?? [
      { color: colorScale(0), fillMode: "solid", pattern: "none" },
      { color: colorScale(1), fillMode: "solid", pattern: "none" },
      { color: colorScale(2), fillMode: "solid", pattern: "none" },
      { color: colorScale(3), fillMode: "solid", pattern: "none" },
      { color: colorScale(4), fillMode: "solid", pattern: "none" },
    ];

  const hoveredLegendLevel = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getHoveredLegendLevel() ?? null,
    () => null,
  );
  const tooltipCount = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getTooltipData()?.count ?? null,
    () => null,
  );

  const highlightedLevel = hoveredLegendLevel ?? (tooltipCount != null ? getHeatmapContributionLevel(tooltipCount) : null);
  const hoverParams: HeatmapHoverStyleParams = { inactiveOpacity, inactiveScale, activeScale };
  const inactiveEnabled = isHeatmapHoverEffectEnabled(hoverParams);
  const isDimming = isInteractive && highlightedLevel !== null && inactiveEnabled;

  const handleLegendEnter = (level: number) => {
    if (!isInteractive || !coordinator) return;
    coordinator.setHoveredLegendLevel(level);
    coordinator.setHoveredCell(null);
    coordinator.setTooltipData(null);
  };
  const handleLegendLeave = () => {
    if (!isInteractive || !coordinator) return;
    coordinator.setHoveredLegendLevel(null);
  };

  const justifyContent = align === "start" ? "flex-start" : align === "center" ? "center" : "flex-end";
  const rootStyle: CSSProperties = { justifyContent, ...(fontSize == null ? null : { fontSize }) };
  const labelClass = labelClassName ? `ts-bkm-heatmap-legend-label ${labelClassName}` : "ts-bkm-heatmap-legend-label";

  return (
    <div className={className ? `ts-bkm-heatmap-legend ${className}` : "ts-bkm-heatmap-legend"} style={rootStyle}>
      <span className={labelClass}>{lessLabel}</span>
      {variant === "gradient" ? (
        <HeatmapLegendGradient
          levels={HEATMAP_LEGEND_LEVELS}
          levelStyles={levelStyles}
          cellSize={cellSize}
          gap={gap}
          cornerRadius={cornerRadius}
          gradientSpan={gradientSpan}
          highlightedLevel={highlightedLevel}
          isDimming={isDimming}
          inactiveOpacity={inactiveOpacity}
          inactiveScale={inactiveScale}
          activeScale={activeScale}
          isInteractive={isInteractive}
          onEnter={handleLegendEnter}
          onLeave={handleLegendLeave}
        />
      ) : (
        <div className="ts-bkm-heatmap-legend-swatches" style={{ gap }}>
          {HEATMAP_LEGEND_LEVELS.map((level) => {
            const isHighlighted = highlightedLevel === level;
            const isDimmed = isDimming && !isHighlighted;
            const hoverStyle = resolveHeatmapHoverStyle(isHighlighted, isDimmed, hoverParams);
            const style = levelStyles[level] ?? levelStyles[0];
            return (
              <span
                key={level}
                aria-hidden="true"
                className="ts-bkm-heatmap-legend-swatch-wrap"
                onPointerEnter={() => handleLegendEnter(level)}
                onPointerLeave={handleLegendLeave}
                style={{
                  opacity: hoverStyle.opacity,
                  transform: `scale(${hoverStyle.scale})`,
                  transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}, transform ${HEATMAP_INACTIVE_TRANSITION_CSS}`,
                  cursor: isInteractive ? "pointer" : undefined,
                }}
              >
                <HeatmapLegendSwatch level={level} style={style} cellSize={cellSize} cornerRadius={cornerRadius} />
              </span>
            );
          })}
        </div>
      )}
      <span className={labelClass}>{moreLabel}</span>
    </div>
  );
}

export interface HeatmapLegendGradientProps {
  levels: readonly number[];
  levelStyles: HeatmapLevelStyles;
  cellSize: number;
  gap: number;
  cornerRadius: number;
  gradientSpan: number;
  highlightedLevel: number | null;
  isDimming: boolean;
  inactiveOpacity: number;
  inactiveScale: number;
  activeScale: number;
  isInteractive: boolean;
  onEnter: (level: number) => void;
  onLeave: () => void;
}

export function HeatmapLegendGradient({
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
}: HeatmapLegendGradientProps) {
  const barWidth = gradientSpan * cellSize + (gradientSpan - 1) * gap;
  const barHeight = cellSize;
  const pillRadius = Math.min(cornerRadius, barHeight / 2);
  const segmentWidth = barWidth / levels.length;
  const gradient = buildHeatmapLegendGradient(levelStyles);
  const barOpacity = isDimming && highlightedLevel === null ? inactiveOpacity : 1;

  return (
    <div className="ts-bkm-heatmap-legend-gradient" style={{ width: barWidth, height: barHeight }}>
      <div
        aria-hidden="true"
        className="ts-bkm-heatmap-legend-gradient-bar"
        style={{
          borderRadius: pillRadius,
          background: gradient,
          opacity: barOpacity,
          transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}`,
        }}
      />
      {levels.map((level, index) => {
        const isHighlighted = highlightedLevel === level;
        const isDimmed = isDimming && !isHighlighted;
        const hoverStyle = resolveHeatmapHoverStyle(isHighlighted, isDimmed, { inactiveOpacity, inactiveScale, activeScale });
        return (
          <span
            key={level}
            className="ts-bkm-heatmap-legend-gradient-segment"
            onPointerEnter={() => onEnter(level)}
            onPointerLeave={onLeave}
            style={{
              left: index * segmentWidth,
              width: segmentWidth,
              height: barHeight,
              cursor: isInteractive ? "pointer" : undefined,
              opacity: hoverStyle.opacity,
              transform: `scale(${hoverStyle.scale})`,
              transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}, transform ${HEATMAP_INACTIVE_TRANSITION_CSS}`,
            }}
          />
        );
      })}
    </div>
  );
}
