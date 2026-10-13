/** @internal */
export const sunburstCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  ring: "var(--chart-background)",
  slice1: "var(--chart-1)",
  slice2: "var(--chart-2)",
  slice3: "var(--chart-3)",
  slice4: "var(--chart-4)",
  slice5: "var(--chart-5)",
};

/** Default category colors: the `--chart-1` to `--chart-5` variables. */
export const defaultSunburstColors = [
  sunburstCssVars.slice1,
  sunburstCssVars.slice2,
  sunburstCssVars.slice3,
  sunburstCssVars.slice4,
  sunburstCssVars.slice5,
];

const OPACITY_STEP = 0.15;
const OPACITY_FLOOR = 0.45;

/**
 * Relative depth within the current focus view (1 = innermost visible ring).
 * @internal
 */
export const opacityForRelativeDepth = (relativeDepth: number): number => {
  if (relativeDepth <= 1) {
    return 1;
  }
  return Math.max(OPACITY_FLOOR, 1 - (relativeDepth - 1) * OPACITY_STEP);
};

const PERCENT = 100;

/** Fill alpha rides color-mix because the native sunburst mark takes one numeric fillOpacity per mark. */
export const withAlpha = (color: string, alpha: number): string => {
  if (alpha >= 1 || color.startsWith("url(")) {
    return color;
  }
  return `color-mix(in srgb, ${color} ${Math.round(alpha * PERCENT)}%, transparent)`;
};
