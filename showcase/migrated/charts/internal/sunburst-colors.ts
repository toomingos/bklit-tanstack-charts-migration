import { CHART_CATEGORY_PALETTE } from "./design-tokens";

const sunburstCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  ring: "var(--chart-background)",
};

const defaultSunburstColors: readonly string[] = CHART_CATEGORY_PALETTE;

const OPACITY_STEP = 0.15;
const OPACITY_FLOOR = 0.45;

const opacityForRelativeDepth = (relativeDepth: number): number => {
  if (relativeDepth <= 1) {
    return 1;
  }
  return Math.max(OPACITY_FLOOR, 1 - (relativeDepth - 1) * OPACITY_STEP);
}

export { sunburstCssVars, defaultSunburstColors, opacityForRelativeDepth };
