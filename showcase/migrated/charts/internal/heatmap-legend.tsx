import { useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { useHeatmapCoordinatorOptional } from "./heatmap-interaction";
import { HEATMAP_INACTIVE_OPACITY } from './heatmap-hover-chrome';
import type { HeatmapHoverCoordinator, HeatmapHoverStyleParams } from './heatmap-hover-chrome';
import {
  getHeatmapContributionLevel,
  isHeatmapHoverEffectEnabled,
} from "./heatmap-utils";
import { defaultHeatmapColorScale } from './heatmap-colors';
import type { HeatmapLevelStyles } from './heatmap-colors';
import { HeatmapLegendGradient } from "./heatmap-legend-gradient";
import { renderLegendSwatch } from "./heatmap-legend-swatch-entry";

const HEATMAP_LEGEND_HIGH_LEVEL = 3;
const HEATMAP_LEGEND_MAX_LEVEL = 4;
const HEATMAP_LEGEND_LEVELS = [0, 1, 2, HEATMAP_LEGEND_HIGH_LEVEL, HEATMAP_LEGEND_MAX_LEVEL] as const;

type HeatmapLegendVariant = "swatches" | "gradient";

type LegendAlign = "start" | "center" | "end";

const resolveLegendJustifyContent = (align: LegendAlign): string => {
  if (align === "start") {
    return "flex-start";
  }
  if (align === "center") {
    return "center";
  }
  return "flex-end";
};

interface HeatmapLegendProps {
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

// Default level styles from the color scale; hoisted so HeatmapLegend stays short.
const resolveLegendLevelStyles = (levelStylesProp: HeatmapLevelStyles | undefined, colorScale: (count: number | null | undefined) => string): HeatmapLevelStyles =>
  levelStylesProp ?? [
    { color: colorScale(0), fillMode: "solid", pattern: "none" },
    { color: colorScale(1), fillMode: "solid", pattern: "none" },
    { color: colorScale(2), fillMode: "solid", pattern: "none" },
    { color: colorScale(HEATMAP_LEGEND_HIGH_LEVEL), fillMode: "solid", pattern: "none" },
    { color: colorScale(HEATMAP_LEGEND_MAX_LEVEL), fillMode: "solid", pattern: "none" },
  ];

interface LegendHighlight {
  readonly highlightedLevel: number | null;
  readonly isDimming: boolean;
}

interface LegendHighlightArgs {
  readonly coordinator: Readonly<HeatmapHoverCoordinator> | null;
  readonly hoverParams: Readonly<HeatmapHoverStyleParams>;
  readonly isInteractive: boolean;
}

// Legend hover state from the coordinator; separate hook so HeatmapLegend stays short.
const useLegendHighlight = (highlight: Readonly<LegendHighlightArgs>): LegendHighlight => {
  const { coordinator } = highlight;
  const hoveredLegendLevel = useSyncExternalStore(
    coordinator ? coordinator.subscribe : (): () => void => (): void => {
      // No coordinator exists, so there is nothing to unsubscribe.
    },
    () => coordinator?.getHoveredLegendLevel() ?? null,
    () => null,
  );
  const tooltipCount = useSyncExternalStore(
    coordinator ? coordinator.subscribe : (): () => void => (): void => {
      // No coordinator exists, so there is nothing to unsubscribe.
    },
    () => coordinator?.getTooltipData()?.count ?? null,
    () => null,
  );

  const highlightedLevel = hoveredLegendLevel ?? (tooltipCount === null ? null : getHeatmapContributionLevel(tooltipCount));
  const inactiveEnabled = isHeatmapHoverEffectEnabled(highlight.hoverParams);
  const isDimming = highlight.isInteractive && highlightedLevel !== null && inactiveEnabled;
  return { highlightedLevel, isDimming };
};

interface LegendChromeArgs {
  readonly fontSize: number | undefined;
  readonly align: "start" | "center" | "end";
  readonly labelClassName: string | undefined;
}

interface LegendChrome {
  rootStyle: CSSProperties;
  labelClass: string;
}

// Root style + label class; hoisted so HeatmapLegend stays short.
const resolveLegendChrome = (chrome: Readonly<LegendChromeArgs>): LegendChrome => {
  const rootStyle: CSSProperties = { justifyContent: resolveLegendJustifyContent(chrome.align) };
  if (chrome.fontSize !== undefined) {
    rootStyle.fontSize = chrome.fontSize;
  }
  const labelClass = chrome.labelClassName !== undefined && chrome.labelClassName !== "" ? `ts-bkm-heatmap-legend-label ${chrome.labelClassName}` : "ts-bkm-heatmap-legend-label";
  return { labelClass, rootStyle };
};

interface LegendContentArgs {
  readonly variant: HeatmapLegendVariant;
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
  readonly hoverParams: Readonly<HeatmapHoverStyleParams>;
  readonly onEnter: (level: number) => void;
  readonly onLeave: () => void;
}

// Gradient-vs-swatches branch; plain function (not a component) so the element tree is unchanged.
const renderLegendContent = (content: Readonly<LegendContentArgs>): ReactElement => {
  const { onEnter: handleEnter, onLeave: handleLeave } = content;
  if (content.variant === "gradient") {
    return (
      <HeatmapLegendGradient
        levels={HEATMAP_LEGEND_LEVELS}
        levelStyles={content.levelStyles}
        cellSize={content.cellSize}
        gap={content.gap}
        cornerRadius={content.cornerRadius}
        gradientSpan={content.gradientSpan}
        highlightedLevel={content.highlightedLevel}
        isDimming={content.isDimming}
        inactiveOpacity={content.inactiveOpacity}
        inactiveScale={content.inactiveScale}
        activeScale={content.activeScale}
        isInteractive={content.isInteractive}
        onEnter={handleEnter}
        onLeave={handleLeave}
      />
    );
  }
  return (
    <div className="ts-bkm-heatmap-legend-swatches" style={{ gap: content.gap }}>
      {HEATMAP_LEGEND_LEVELS.map((level) => renderLegendSwatch({
        cellSize: content.cellSize,
        cornerRadius: content.cornerRadius,
        highlightedLevel: content.highlightedLevel,
        hoverParams: content.hoverParams,
        isDimming: content.isDimming,
        isInteractive: content.isInteractive,
        level,
        levelStyles: content.levelStyles,
        onEnter: handleEnter,
        onLeave: handleLeave,
      }))}
    </div>
  );
};

interface LegendHandlers {
  onEnter: (level: number) => void;
  onLeave: () => void;
}

interface LegendHandlersArgs {
  readonly coordinator: Readonly<HeatmapHoverCoordinator> | null;
  readonly isInteractive: boolean;
}

// Legend pointer handlers; hoisted so the legend model stays short.
const buildLegendHandlers = (handlerArgs: Readonly<LegendHandlersArgs>): LegendHandlers => {
  const handleLegendEnter = (level: number): void => {
    if (!handlerArgs.isInteractive || !handlerArgs.coordinator) {return;}
    handlerArgs.coordinator.setHoveredLegendLevel(level);
    handlerArgs.coordinator.setHoveredCell(null);
    handlerArgs.coordinator.setTooltipData(null);
  };
  const handleLegendLeave = (): void => {
    if (!handlerArgs.isInteractive || !handlerArgs.coordinator) {return;}
    handlerArgs.coordinator.setHoveredLegendLevel(null);
  };
  return { onEnter: handleLegendEnter, onLeave: handleLegendLeave };
};

interface LegendModelArgs {
  readonly interactive: boolean | undefined;
  readonly levelStylesProp: HeatmapLevelStyles | undefined;
  readonly colorScale: (count: number | null | undefined) => string;
  readonly activeScale: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
}

interface LegendModel {
  readonly isInteractive: boolean;
  readonly levelStyles: HeatmapLevelStyles;
  readonly hoverParams: HeatmapHoverStyleParams;
  readonly highlightedLevel: number | null;
  readonly isDimming: boolean;
  readonly onEnter: (level: number) => void;
  readonly onLeave: () => void;
}

// Derived legend state; one hook so HeatmapLegend stays short.
const useLegendModel = (model: Readonly<LegendModelArgs>): LegendModel => {
  const coordinator = useHeatmapCoordinatorOptional();
  const isInteractive = model.interactive ?? Boolean(coordinator);
  const levelStyles = resolveLegendLevelStyles(model.levelStylesProp, model.colorScale);
  const hoverParams: HeatmapHoverStyleParams = { activeScale: model.activeScale, inactiveOpacity: model.inactiveOpacity, inactiveScale: model.inactiveScale };
  const { highlightedLevel, isDimming } = useLegendHighlight({ coordinator, hoverParams, isInteractive });
  const { onEnter, onLeave } = buildLegendHandlers({ coordinator, isInteractive });
  return { highlightedLevel, hoverParams, isDimming, isInteractive, levelStyles, onEnter, onLeave };
};

const HeatmapLegend = ({
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
}: Readonly<HeatmapLegendProps>): ReactElement => {
  const model = useLegendModel({ activeScale, colorScale, inactiveOpacity, inactiveScale, interactive, levelStylesProp });
  const { labelClass, rootStyle } = resolveLegendChrome({ align, fontSize, labelClassName });

  return (
    <div className={className !== undefined && className !== "" ? `ts-bkm-heatmap-legend ${className}` : "ts-bkm-heatmap-legend"} style={rootStyle}>
      <span className={labelClass}>{lessLabel}</span>
      {renderLegendContent({
        activeScale,
        cellSize,
        cornerRadius,
        gap,
        gradientSpan,
        highlightedLevel: model.highlightedLevel,
        hoverParams: model.hoverParams,
        inactiveOpacity,
        inactiveScale,
        isDimming: model.isDimming,
        isInteractive: model.isInteractive,
        levelStyles: model.levelStyles,
        onEnter: model.onEnter,
        onLeave: model.onLeave,
        variant,
      })}
      <span className={labelClass}>{moreLabel}</span>
    </div>
  );
}

export type {
  HeatmapLegendVariant,
  HeatmapLegendProps,
};
export type { HeatmapLegendGradientProps } from "./heatmap-legend-gradient";
export type { HeatmapLegendSwatchProps } from "./heatmap-legend-swatch";
export {
  HEATMAP_LEGEND_LEVELS,
  HeatmapLegend,
};
export { HeatmapLegendGradient } from "./heatmap-legend-gradient";
export { HeatmapLegendSwatch } from "./heatmap-legend-swatch";

// Default export kept for parity with the legacy chart.
export default HeatmapLegend;
