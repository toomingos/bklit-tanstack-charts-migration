/** Sequential scale CSS variables for heatmaps, choropleths, and binned data (01 = lowest, 05 = highest). */
export const CHART_SCALE_VARS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
] as const;

export type ChartScaleVars = typeof CHART_SCALE_VARS;

export const chartScaleCssVars = {
  scale01: CHART_SCALE_VARS[0],
  scale02: CHART_SCALE_VARS[1],
  scale03: CHART_SCALE_VARS[2],
  scale04: CHART_SCALE_VARS[3],
  scale05: CHART_SCALE_VARS[4],
  patternColor: "var(--chart-scale-pattern-color)",
} as const;

const BACKGROUND = "var(--chart-background)";
const FOREGROUND = "var(--chart-foreground)";

export const pieCssVars = {
  background: BACKGROUND,
  foreground: FOREGROUND,
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  slice1: "var(--chart-1)",
  slice2: "var(--chart-2)",
  slice3: "var(--chart-3)",
  slice4: "var(--chart-4)",
  slice5: "var(--chart-5)",
};

export const ringCssVars = {
  background: BACKGROUND,
  foreground: FOREGROUND,
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  ringBackground: "var(--border)",
  ring1: "var(--chart-1)",
  ring2: "var(--chart-2)",
  ring3: "var(--chart-3)",
  ring4: "var(--chart-4)",
  ring5: "var(--chart-5)",
};

export const sankeyCssVars = {
  background: BACKGROUND,
  foreground: FOREGROUND,
  nodePrimary: "var(--chart-line-primary)",
  nodeSecondary: "var(--chart-line-secondary)",
  linkColor: "var(--chart-foreground-muted, hsl(0, 0%, 50%))",
};

export const choroplethCssVars = {
  scale01: chartScaleCssVars.scale01,
  scale02: chartScaleCssVars.scale02,
  scale03: chartScaleCssVars.scale03,
  scale04: chartScaleCssVars.scale04,
  scale05: chartScaleCssVars.scale05,
  patternColor: chartScaleCssVars.patternColor,
  stroke: "var(--chart-grid)",
  background: "var(--background)",
};

export const defaultChoroplethColors = [...CHART_SCALE_VARS];
