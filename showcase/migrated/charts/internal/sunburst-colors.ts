import { chartCssVars } from "./chart-context";
import { CHART_CATEGORY_PALETTE } from "./design-tokens";

const sunburstCssVars = {
  background: chartCssVars.background,
  foreground: chartCssVars.foreground,
  foregroundMuted: chartCssVars.foregroundMuted,
  label: chartCssVars.label,
  ring: chartCssVars.background,
  slice1: "var(--chart-1)",
  slice2: "var(--chart-2)",
  slice3: "var(--chart-3)",
  slice4: "var(--chart-4)",
  slice5: "var(--chart-5)",
};

const defaultSunburstColors: string[] = [...CHART_CATEGORY_PALETTE];

const OPACITY_STEP = 0.15;
const OPACITY_FLOOR = 0.45;

const opacityForRelativeDepth = (relativeDepth: number): number => {
  if (relativeDepth <= 1) {
    return 1;
  }
  return Math.max(OPACITY_FLOOR, 1 - (relativeDepth - 1) * OPACITY_STEP);
}

export { sunburstCssVars, defaultSunburstColors, opacityForRelativeDepth };
