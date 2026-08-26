// Color constants and opacity helpers originally from
// repos/bklit-ui/packages/ui/src/charts/sunburst-context.tsx.
// Copied here so migrated/charts has zero imports from repos/.

import { CHART_CATEGORY_PALETTE } from "./design-tokens";

export const sunburstCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  ring: "var(--chart-background)",
};

// T-D15 (P3.1): sourced from the shared 5-entry categorical palette rather
// than a local slice1..5 literal set — see design-tokens.ts.
export const defaultSunburstColors: readonly string[] = CHART_CATEGORY_PALETTE;

const OPACITY_STEP = 0.15;
const OPACITY_FLOOR = 0.45;

/** Relative depth within the current focus view (1 = innermost visible ring). */
export function opacityForRelativeDepth(relativeDepth: number): number {
  if (relativeDepth <= 1) {
    return 1;
  }
  return Math.max(OPACITY_FLOOR, 1 - (relativeDepth - 1) * OPACITY_STEP);
}
