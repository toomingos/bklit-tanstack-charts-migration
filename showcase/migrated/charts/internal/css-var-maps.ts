import { chartCssVars } from "./chart-context";
import { HEATMAP_DEFAULT_LEVEL_COLORS } from "./heatmap-colors";

/** Sequential scale CSS variables (01 = lowest, 05 = highest). */
const CHART_SCALE_VARS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
] as const;

type ChartScaleVars = typeof CHART_SCALE_VARS;

// Series palette slots have no root entry in chartCssVars, so they stay literals here.
const CHART_SERIES_1_VAR = "var(--chart-1)";
const CHART_SERIES_2_VAR = "var(--chart-2)";
const CHART_SERIES_3_VAR = "var(--chart-3)";
const CHART_SERIES_4_VAR = "var(--chart-4)";
const CHART_SERIES_5_VAR = "var(--chart-5)";

const chartScaleCssVars = {
  patternColor: "var(--chart-scale-pattern-color)",
  scale01: CHART_SCALE_VARS[0],
  scale02: CHART_SCALE_VARS[1],
  scale03: CHART_SCALE_VARS[2],
  scale04: CHART_SCALE_VARS[3],
  scale05: CHART_SCALE_VARS[4],
} as const;

const pieCssVars = {
  background: chartCssVars.background,
  foreground: chartCssVars.foreground,
  foregroundMuted: chartCssVars.foregroundMuted,
  label: chartCssVars.label,
  slice1: CHART_SERIES_1_VAR,
  slice2: CHART_SERIES_2_VAR,
  slice3: CHART_SERIES_3_VAR,
  slice4: CHART_SERIES_4_VAR,
  slice5: CHART_SERIES_5_VAR,
};

const ringCssVars = {
  background: chartCssVars.background,
  foreground: chartCssVars.foreground,
  foregroundMuted: chartCssVars.foregroundMuted,
  label: chartCssVars.label,
  ring1: CHART_SERIES_1_VAR,
  ring2: CHART_SERIES_2_VAR,
  ring3: CHART_SERIES_3_VAR,
  ring4: CHART_SERIES_4_VAR,
  ring5: CHART_SERIES_5_VAR,
  ringBackground: "var(--border)",
};

const radarCssVars = {
  area1: CHART_SERIES_1_VAR,
  area2: CHART_SERIES_2_VAR,
  area3: CHART_SERIES_3_VAR,
  area4: CHART_SERIES_4_VAR,
  area5: CHART_SERIES_5_VAR,
  background: chartCssVars.background,
  border: "var(--border)",
  foreground: chartCssVars.foreground,
  foregroundMuted: chartCssVars.foregroundMuted,
  grid: chartCssVars.grid,
  label: "var(--chart-label, oklch(0.65 0.01 260))",
};

const sankeyCssVars = {
  background: chartCssVars.background,
  foreground: chartCssVars.foreground,
  linkColor: "var(--chart-foreground-muted, hsl(0, 0%, 50%))",
  nodePrimary: chartCssVars.linePrimary,
  nodeSecondary: chartCssVars.lineSecondary,
};

const choroplethCssVars = {
  background: "var(--background)",
  patternColor: chartScaleCssVars.patternColor,
  scale01: chartScaleCssVars.scale01,
  scale02: chartScaleCssVars.scale02,
  scale03: chartScaleCssVars.scale03,
  scale04: chartScaleCssVars.scale04,
  scale05: chartScaleCssVars.scale05,
  stroke: chartCssVars.grid,
};

/** @deprecated Use HEATMAP_DEFAULT_LEVEL_COLORS */
const heatmapCssVars = {
  empty: HEATMAP_DEFAULT_LEVEL_COLORS[0],
  level1: HEATMAP_DEFAULT_LEVEL_COLORS[1],
  level2: HEATMAP_DEFAULT_LEVEL_COLORS[2],
  level3: HEATMAP_DEFAULT_LEVEL_COLORS[3],
  level4: HEATMAP_DEFAULT_LEVEL_COLORS[4],
} as const;

const defaultChoroplethColors = [...CHART_SCALE_VARS];

export { CHART_SCALE_VARS, chartScaleCssVars, pieCssVars, ringCssVars, radarCssVars, sankeyCssVars, choroplethCssVars, heatmapCssVars, defaultChoroplethColors };
export type { ChartScaleVars };
