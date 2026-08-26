/**
 * P6.3 / CH17 Bucket 2 — the `*CssVars` maps, restored.
 *
 * P5.3's ledger flagged these seven as "ACCEPTED under a doctrine not yet
 * written down", describing them as an architectural swap of DOC-4's shape:
 * "legacy generated CSS custom properties from TS constants; migrated declares
 * them in styles.css". **That premise does not survive inspection and the lead
 * ruling is RESTORE, not ACCEPT** — see the D355 log row.
 *
 * Both halves of the premise are wrong. Legacy generates no custom property:
 * `ringCssVars` et al are plain TS objects whose VALUES are `var(--…)`
 * reference *strings*, consumed as `fill={ringCssVars.ringBackground}`
 * (bklit `ring.tsx:189`, `ring-chart.tsx:364`). And migrated's `styles.css`
 * does not declare the underlying `--chart-*` properties either — the host
 * app's theme does, in BOTH implementations. So nothing was swapped: migrated
 * simply inlined the literal strings at their use sites (`ring-chart.tsx:71`
 * `const RING_BACKGROUND = "var(--border)"`) and dropped the public maps.
 *
 * That makes this a plain public-API gap under MAIN GOAL (c) — a consumer
 * doing `import { ringCssVars } from "@bklit/ui/charts"` breaks — and these
 * are pure data with zero behaviour, so restoring them is the cheapest
 * possible parity repair. The chart internals are deliberately NOT rewired to
 * read from here: that would be a behaviour-bearing refactor of nine charts to
 * serve an export, and the inlined literals are already correct.
 */

import { HEATMAP_DEFAULT_LEVEL_COLORS } from "./heatmap-colors";

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

// CSS variable references for pie chart theming
export const pieCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  // Default slice colors from chart palette
  slice1: "var(--chart-1)",
  slice2: "var(--chart-2)",
  slice3: "var(--chart-3)",
  slice4: "var(--chart-4)",
  slice5: "var(--chart-5)",
};

// CSS variable references for ring chart theming
export const ringCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  ringBackground: "var(--border)",
  // Default ring colors from chart palette
  ring1: "var(--chart-1)",
  ring2: "var(--chart-2)",
  ring3: "var(--chart-3)",
  ring4: "var(--chart-4)",
  ring5: "var(--chart-5)",
};

// CSS variable references for radar chart theming
export const radarCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label, oklch(0.65 0.01 260))",
  grid: "var(--chart-grid)",
  border: "var(--border)",
  // Default radar colors from chart palette
  area1: "var(--chart-1)",
  area2: "var(--chart-2)",
  area3: "var(--chart-3)",
  area4: "var(--chart-4)",
  area5: "var(--chart-5)",
};

// CSS variables for sankey theming
export const sankeyCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  nodePrimary: "var(--chart-line-primary)",
  nodeSecondary: "var(--chart-line-secondary)",
  linkColor: "var(--chart-foreground-muted, hsl(0, 0%, 50%))",
};

// CSS variables for choropleth theming
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

/**
 * `@deprecated` verbatim from bklit `heatmap-context.tsx` — the deprecation
 * notice is part of the public surface and is carried over unchanged.
 *
 * @deprecated Use {@link HEATMAP_DEFAULT_LEVEL_COLORS}
 */
export const heatmapCssVars = {
  empty: HEATMAP_DEFAULT_LEVEL_COLORS[0],
  level1: HEATMAP_DEFAULT_LEVEL_COLORS[1],
  level2: HEATMAP_DEFAULT_LEVEL_COLORS[2],
  level3: HEATMAP_DEFAULT_LEVEL_COLORS[3],
  level4: HEATMAP_DEFAULT_LEVEL_COLORS[4],
} as const;

/**
 * bklit `choropleth-context.tsx`: `defaultChoroplethColors = [...CHART_SCALE_VARS]`.
 * Value-identical to the private `DEFAULT_CHOROPLETH_COLORS` at
 * `choropleth-chart.tsx:212`, which stays where it is — see the header note on
 * not rewiring internals to serve an export.
 */
export const defaultChoroplethColors: string[] = [...CHART_SCALE_VARS];
