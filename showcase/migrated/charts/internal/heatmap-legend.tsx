import { useId, useMemo, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { HEATMAP_INACTIVE_OPACITY, HEATMAP_INACTIVE_TRANSITION_CSS, useHeatmapCoordinatorOptional } from "./heatmap-context";
import type { HeatmapHoverCoordinator, HeatmapHoverStyleParams } from "./heatmap-context";
import { focusHeatmapLevel } from "./heatmap-focus-bridge";
import { renderPatternPreset } from "./pattern-preset-render";
import {
  defaultHeatmapColorScale,
  heatmapLevelPatternId,
  heatmapLevelPatternRenderOptions,
  isHeatmapLevelPattern,
} from './heatmap-colors';
import type { HeatmapLevelStyle, HeatmapLevelStyles } from './heatmap-colors';
import {
  buildHeatmapLegendGradient,
  getHeatmapContributionLevel,
  isHeatmapHoverEffectEnabled,
  resolveHeatmapHoverStyle,
} from "./heatmap-utils";

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
  readonly lessLabel?: string;
  readonly moreLabel?: string;
  readonly cellSize?: number;
  readonly gap?: number;
  readonly cornerRadius?: number;
  readonly align?: "start" | "center" | "end";
  readonly variant?: HeatmapLegendVariant;
  readonly gradientSpan?: number;
  readonly fontSize?: number;
  readonly labelClassName?: string;
  readonly levelStyles?: HeatmapLevelStyles;
  readonly colorScale?: (count: number | null | undefined) => string;
  readonly inactiveOpacity?: number;
  readonly inactiveScale?: number;
  readonly activeScale?: number;
  readonly interactive?: boolean;
  readonly className?: string;
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
  readonly rootStyle: CSSProperties;
  readonly labelClass: string;
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
  readonly swatchesStyle: CSSProperties;
}

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

// Static svg fill style for the pattern branch; hoisted so it keeps identity.
const SWATCH_SVG_STYLE = { display: "block", height: "100%", width: "100%" } as const;

// The base level has no pattern to draw, so it renders as a hairline swatch.
const BASE_HEATMAP_LEVEL = 0;

// A pattern without an explicit opacity renders fully opaque.
const FULL_PATTERN_OPACITY = 1;

interface HeatmapLegendSwatchProps {
  readonly level: number;
  readonly style: HeatmapLevelStyle;
  readonly cellSize: number;
  readonly cornerRadius: number;
}

interface PatternSwatchArgs {
  readonly style: HeatmapLevelStyle;
  readonly level: number;
  readonly reactId: string;
  readonly cellSize: number;
  readonly cornerRadius: number;
}

// Pattern shell style; hoisted so the swatch passes no fresh object to JSX.
const buildPatternShellStyle = (swatch: Readonly<PatternSwatchArgs>): CSSProperties => ({
  borderRadius: swatch.cornerRadius,
  height: swatch.cellSize,
  opacity: swatch.style.patternOpacity ?? FULL_PATTERN_OPACITY,
  overflow: "hidden",
  width: swatch.cellSize,
});

// Pattern branch of the legend swatch; undefined when the level is solid. Hoisted so the swatch stays short.
const renderPatternSwatch = (swatch: Readonly<PatternSwatchArgs>): ReactElement | undefined => {
  if (!isHeatmapLevelPattern(swatch.style) || !swatch.style.pattern) {return undefined;}
  // Ids are useId-scoped so multiple charts/legends on one page don't collide.
  const patternId = `${swatch.reactId}-${heatmapLevelPatternId(swatch.level)}`;
  const patternNode = renderPatternPreset(
    swatch.style.pattern,
    `${patternId}-base`,
    heatmapLevelPatternRenderOptions(swatch.style),
  );

  return (
    <span
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-swatch ts-bkm-heatmap-legend-swatch--pattern"
      style={buildPatternShellStyle(swatch)}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${swatch.cellSize} ${swatch.cellSize}`} style={SWATCH_SVG_STYLE}>
        {patternNode !== undefined && patternNode !== null ? <defs>{patternNode}</defs> : undefined}
        <rect
          fill={patternNode !== undefined && patternNode !== null ? `url(#${patternId})` : swatch.style.color}
          height={swatch.cellSize}
          rx={swatch.cornerRadius}
          ry={swatch.cornerRadius}
          width={swatch.cellSize}
        />
      </svg>
    </span>
  );
};

interface SolidSwatchArgs {
  readonly style: HeatmapLevelStyle;
  readonly level: number;
  readonly cellSize: number;
  readonly cornerRadius: number;
}

// Solid swatch style; hoisted so the swatch stays short.
const buildSolidSwatchStyle = (swatch: Readonly<SolidSwatchArgs>): CSSProperties => {
  const solidStyle: CSSProperties = {
    backgroundColor: swatch.style.color,
    borderRadius: swatch.cornerRadius,
    boxSizing: "border-box",
    height: swatch.cellSize,
    width: swatch.cellSize,
  };
  if (swatch.level === BASE_HEATMAP_LEVEL) {
    solidStyle.border = `1px solid ${swatch.style.color}`;
  }
  return solidStyle;
};

const HeatmapLegendSwatch = ({ level, style, cellSize, cornerRadius }: Readonly<HeatmapLegendSwatchProps>): ReactElement => {
  // Unconditional (rules of hooks); consumed only by the pattern branch.
  const reactId = useId().replaceAll(':', "");
  const patternElement = renderPatternSwatch({ cellSize, cornerRadius, level, reactId, style });
  if (patternElement !== undefined) {return patternElement;}

  return (
    <span
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-swatch"
      style={buildSolidSwatchStyle({ cellSize, cornerRadius, level, style })}
    />
  );
};

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
    <div className="ts-bkm-heatmap-legend-swatches" style={content.swatchesStyle}>
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
  readonly onEnter: (level: number) => void;
  readonly onLeave: () => void;
}

interface LegendHandlersArgs {
  readonly coordinator: Readonly<HeatmapHoverCoordinator> | null;
  readonly isInteractive: boolean;
}

// Legend hover drives package focus (source programmatic) for cell dim.
// Legacy has no click toggle, so no aria-pressed here.
const buildLegendHandlers = (handlerArgs: Readonly<LegendHandlersArgs>): LegendHandlers => {
  const handleLegendEnter = (level: number): void => {
    if (!handlerArgs.isInteractive || !handlerArgs.coordinator) {return;}
    handlerArgs.coordinator.setHoveredLegendLevel(level);
    handlerArgs.coordinator.setHoveredCell(null);
    handlerArgs.coordinator.setTooltipData(null);
    focusHeatmapLevel(handlerArgs.coordinator, level);
  };
  const handleLegendLeave = (): void => {
    if (!handlerArgs.isInteractive || !handlerArgs.coordinator) {return;}
    handlerArgs.coordinator.setHoveredLegendLevel(null);
    focusHeatmapLevel(handlerArgs.coordinator, null);
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
  const swatchesStyle = useMemo((): CSSProperties => ({ gap }), [gap]);

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
        swatchesStyle,
        variant,
      })}
      <span className={labelClass}>{moreLabel}</span>
    </div>
  );
}


export type {
  HeatmapLegendVariant,
  HeatmapLegendProps,
  HeatmapLegendGradientProps,
  HeatmapLegendSwatchProps,
};
export {
  HEATMAP_LEGEND_LEVELS,
  HeatmapLegend,
  HeatmapLegendGradient,
  HeatmapLegendSwatch,
};
