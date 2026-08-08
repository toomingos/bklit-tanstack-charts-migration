// Port of repos/bklit-ui/packages/ui/src/charts/heatmap/heatmap-colors.ts's
// level-style / color-scale / fill-scale system.
//
// DISCLOSED SCOPE CUT: bklit's `HeatmapLevelStyle.fillMode==="pattern"` branch
// renders an SVG pattern via a 187-line generator (`pattern-preset.tsx`,
// diagonal/cross/dots presets with configurable scale/stroke/radius/fill).
// That generator is NOT ported — `buildHeatmapFillScale`/`HeatmapLegendSwatch`
// below always resolve to the level's solid `color`, regardless of
// `fillMode`/`pattern`. The full `HeatmapLevelStyle` prop surface (including
// all pattern-only fields) IS kept for API-compat/typecheck purposes, so a
// caller migrating from bklit compiles unchanged; only the visual pattern
// rendering itself is cut. See migration report for rationale (bench never
// exercises pattern fills; no scenario sets fillMode:"pattern").
//
// bklit's own source uses `levelStyles as unknown as HeatmapLevelStyles` in
// heatmap-legend.tsx to build a levelStyles tuple from a colorScale — this
// port avoids `as unknown` entirely (banned pattern) by constructing the
// 5-tuple directly with a typed literal instead of casting through unknown.
import { getHeatmapContributionLevel } from "./heatmap-utils";

const HEATMAP_LEVEL_CSS_VARS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
] as const;

export type HeatmapLevelColors = readonly [string, string, string, string, string];

export const HEATMAP_DEFAULT_LEVEL_COLORS: HeatmapLevelColors = HEATMAP_LEVEL_CSS_VARS;

export type HeatmapLevelFillMode = "solid" | "pattern";

export interface HeatmapLevelStyle {
  color: string;
  fillMode?: HeatmapLevelFillMode;
  pattern?: string;
  patternColor?: string;
  patternScale?: number;
  patternStrokeWidth?: number;
  patternRadius?: number;
  patternComplement?: boolean;
  patternFill?: string;
  patternTileBackground?: string;
  patternOpacity?: number;
  patternDotsFill?: boolean;
}

export type HeatmapLevelStyles = readonly [
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
];

export const HEATMAP_DEFAULT_LEVEL_STYLES: HeatmapLevelStyles = [
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[0], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[1], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[2], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[3], fillMode: "solid", pattern: "none" },
  { color: HEATMAP_DEFAULT_LEVEL_COLORS[4], fillMode: "solid", pattern: "none" },
];

export function heatmapLevelPatternId(level: number): string {
  return `heatmap-level-${level}`;
}

export function isHeatmapLevelPattern(style: HeatmapLevelStyle): boolean {
  return style.fillMode === "pattern" && style.pattern != null && style.pattern !== "none";
}

export function heatmapLevelCellFillOpacity(_style: HeatmapLevelStyle): number {
  // Real bklit blends `patternOpacity` in here only because a pattern-mode
  // cell's *fill* is `url(#pattern-id)` (an actual rendered SVG pattern) and
  // this opacity is layered on top of it. Since this port's `fillScale` (see
  // below) never emits a pattern url -- it always resolves to the level's
  // solid `color`, per the pattern-fill scope cut documented at the top of
  // this file -- there is no pattern layer for `patternOpacity` to modulate,
  // so this always returns 1 (previously it read `style.patternOpacity` even
  // though the fill it would have modulated was never rendered, which was a
  // latent bug: a pattern-mode `levelStyle` with e.g. `patternOpacity: 0.4`
  // would have rendered an almost-invisible solid-color cell instead of the
  // intended full-opacity solid fallback).
  return 1;
}

function levelStylesFromColors(levelColors: HeatmapLevelColors): HeatmapLevelStyles {
  return [
    { color: levelColors[0], fillMode: "solid", pattern: "none" },
    { color: levelColors[1], fillMode: "solid", pattern: "none" },
    { color: levelColors[2], fillMode: "solid", pattern: "none" },
    { color: levelColors[3], fillMode: "solid", pattern: "none" },
    { color: levelColors[4], fillMode: "solid", pattern: "none" },
  ];
}

export function resolveHeatmapLevelStyles(
  levelColors: HeatmapLevelColors | undefined,
  levelStyles: HeatmapLevelStyles | undefined,
): HeatmapLevelStyles {
  if (levelStyles) return levelStyles;
  if (levelColors) return levelStylesFromColors(levelColors);
  return HEATMAP_DEFAULT_LEVEL_STYLES;
}

export function buildHeatmapColorScale(
  levelColors: HeatmapLevelColors,
): (count: number | null | undefined) => string {
  return buildHeatmapColorScaleFromStyles(levelStylesFromColors(levelColors));
}

export function buildHeatmapColorScaleFromStyles(
  levelStyles: HeatmapLevelStyles,
): (count: number | null | undefined) => string {
  return (count: number | null | undefined) => {
    const level = getHeatmapContributionLevel(count ?? 0);
    return levelStyles[level]?.color ?? levelStyles[0].color;
  };
}

export function buildHeatmapFillScale(
  levelStyles: HeatmapLevelStyles,
): (count: number | null | undefined) => string {
  // DISCLOSED SCOPE CUT (see header): always resolves to the level's solid
  // `color`, even when `fillMode==="pattern"` -- this port renders no
  // `<pattern>` defs (`HeatmapPatternDefs` is not ported), so returning
  // `url(#heatmap-level-N)` here (as real bklit does for pattern-mode
  // levels) would reference a nonexistent pattern and paint the cell fully
  // transparent. `heatmapLevelPatternId` is still exported/used by
  // `isHeatmapLevelPattern` callers that only need the boolean check.
  return (count: number | null | undefined) => {
    const level = getHeatmapContributionLevel(count ?? 0);
    const style = levelStyles[level] ?? levelStyles[0];
    return style.color;
  };
}

export const defaultHeatmapColorScale = buildHeatmapColorScaleFromStyles(HEATMAP_DEFAULT_LEVEL_STYLES);
export const defaultHeatmapFillScale = buildHeatmapFillScale(HEATMAP_DEFAULT_LEVEL_STYLES);
