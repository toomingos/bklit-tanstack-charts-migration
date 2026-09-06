// FillMode "pattern" levels resolve to `url(#heatmap-level-N)`, rendered by the shared pattern-preset renderer.
import { getHeatmapContributionLevel } from "./heatmap-utils";
import type { PatternPresetId, PatternPresetOptions } from "./pattern-preset";

const HEATMAP_LEVEL_CSS_VARS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
] as const;

type HeatmapLevelColors = readonly [string, string, string, string, string];

const HEATMAP_DEFAULT_LEVEL_COLORS = HEATMAP_LEVEL_CSS_VARS;

type HeatmapLevelFillMode = "solid" | "pattern";

interface HeatmapLevelStyle {
  readonly color: string;
  readonly fillMode?: HeatmapLevelFillMode;
  readonly pattern?: PatternPresetId;
  readonly patternColor?: string;
  readonly patternScale?: number;
  readonly patternStrokeWidth?: number;
  readonly patternRadius?: number;
  readonly patternComplement?: boolean;
  readonly patternFill?: string;
  readonly patternTileBackground?: string;
  readonly patternOpacity?: number;
  readonly patternDotsFill?: boolean;
}

type HeatmapLevelStyles = readonly [
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
];

const HEATMAP_DEFAULT_LEVEL_STYLES = [
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[0], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[1], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[2], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[3], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[4], fillMode: "solid", pattern: "none" },
] as const satisfies HeatmapLevelStyles;

const heatmapLevelPatternId = (level: number): string => `heatmap-level-${level}`;

// Default pattern tile scale for the "cross" preset, whose two-axis weave reads too dense at scale 1.
const CROSS_PATTERN_DEFAULT_SCALE = 1.33;


const isHeatmapLevelPattern = (style: Readonly<HeatmapLevelStyle>): boolean => style.fillMode === "pattern" && style.pattern !== undefined && style.pattern !== "none";


const heatmapPatternStrokeFallback = (color: string): string => `color-mix(in oklch, ${color} 45%, white)`;


const heatmapLevelPatternRenderOptions = (style: Readonly<HeatmapLevelStyle>): PatternPresetOptions => {
  const preset = style.pattern ?? "diagonal";
  let defaultScale = 1;
  if (preset === "cross") {
    defaultScale = CROSS_PATTERN_DEFAULT_SCALE;
  }
  const patternColorTrimmed = style.patternColor?.trim() ?? "";
  const patternFillTrimmed = style.patternFill?.trim() ?? "";
  const patternTileBackgroundTrimmed = style.patternTileBackground?.trim() ?? "";
  const fallbackColor = preset === "accent" ? "#e879f9" : heatmapPatternStrokeFallback(style.color);

  return {
    color: patternColorTrimmed === "" ? fallbackColor : patternColorTrimmed,
    complement: style.patternComplement,
    dotFill: style.patternDotsFill,
    fill: patternFillTrimmed === "" ? undefined : patternFillTrimmed,
    radius: style.patternRadius,
    scale: style.patternScale ?? defaultScale,
    strokeWidth: style.patternStrokeWidth,
    tileBackground: patternTileBackgroundTrimmed === "" ? style.color : patternTileBackgroundTrimmed,
  };
}

const heatmapLevelCellFillOpacity = (style: Readonly<HeatmapLevelStyle>): number => {
  if (!isHeatmapLevelPattern(style)) {
    return 1;
  }
  return style.patternOpacity ?? 1;
}

const levelStylesFromColors = (levelColors: HeatmapLevelColors): HeatmapLevelStyles => [
    { color: levelColors[0], fillMode: "solid", pattern: "none" },
    { color: levelColors[1], fillMode: "solid", pattern: "none" },
    { color: levelColors[2], fillMode: "solid", pattern: "none" },
    { color: levelColors[3], fillMode: "solid", pattern: "none" },
    { color: levelColors[4], fillMode: "solid", pattern: "none" },
  ];


const resolveHeatmapLevelStyles = (levelColors: HeatmapLevelColors | undefined, levelStyles: HeatmapLevelStyles | undefined): HeatmapLevelStyles => {
  if (levelStyles) {return levelStyles;}
  if (levelColors) {return levelStylesFromColors(levelColors);}
  return HEATMAP_DEFAULT_LEVEL_STYLES;
}

const buildHeatmapColorScaleFromStyles = (levelStyles: HeatmapLevelStyles): (count: number | null | undefined) => string => (count: number | null | undefined) => {
    const level = getHeatmapContributionLevel(count ?? 0);
    return levelStyles[level]?.color ?? levelStyles[0].color;
  };


const buildHeatmapColorScale = (levelColors: HeatmapLevelColors): (count: number | null | undefined) => string => buildHeatmapColorScaleFromStyles(levelStylesFromColors(levelColors));


const buildHeatmapFillScale = (levelStyles: HeatmapLevelStyles): (count: number | null | undefined) => string =>
  // The matching <pattern> defs are rendered by HeatmapPatternDefs, so this url() reference is always backed.
  (count: number | null | undefined) => {
    const level = getHeatmapContributionLevel(count ?? 0);
    const style = levelStyles[level] ?? levelStyles[0];
    if (isHeatmapLevelPattern(style)) {
      return `url(#${heatmapLevelPatternId(level)})`;
    }
    return style.color;
  };


const defaultHeatmapColorScale = buildHeatmapColorScaleFromStyles(HEATMAP_DEFAULT_LEVEL_STYLES);
const defaultHeatmapFillScale = buildHeatmapFillScale(HEATMAP_DEFAULT_LEVEL_STYLES);

export type {
  HeatmapLevelColors,
  HeatmapLevelFillMode,
  HeatmapLevelStyle,
  HeatmapLevelStyles,
};
export {
  buildHeatmapColorScale,
  buildHeatmapColorScaleFromStyles,
  buildHeatmapFillScale,
  defaultHeatmapColorScale,
  defaultHeatmapFillScale,
  HEATMAP_DEFAULT_LEVEL_COLORS,
  HEATMAP_DEFAULT_LEVEL_STYLES,
  heatmapLevelCellFillOpacity,
  heatmapLevelPatternId,
  heatmapLevelPatternRenderOptions,
  heatmapPatternStrokeFallback,
  isHeatmapLevelPattern,
  levelStylesFromColors,
  resolveHeatmapLevelStyles,
};
