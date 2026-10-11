/** Minified + gzipped JS per chart (esbuild 0.28, tree-shaken, react external), re-measured 2026-10-11 after opt-in overlays and Background (same esbuild method both sides).
 * KB gzip, [bklit, migrated]; migrated also ships a shared stylesheet (bundleCssKb). */
export const bundleSizes: { label: string; gzip: readonly [bklit: number, migrated: number] }[] = [
  { label: "Line", gzip: [93.2, 104.8] },
  { label: "Area", gzip: [93.0, 104.8] },
  { label: "Bar", gzip: [81.2, 93.0] },
  { label: "Pie", gzip: [58.1, 55.6] },
  { label: "Ring", gzip: [63.4, 65.0] },
  { label: "Gauge", gzip: [58.8, 60.5] },
  { label: "Heatmap", gzip: [78.7, 82.3] },
  { label: "Sankey", gzip: [59.6, 70.6] },
  { label: "Choropleth", gzip: [78.3, 70.9] },
  { label: "Live line", gzip: [79.0, 86.9] },
  { label: "Scatter", gzip: [81.8, 82.9] },
  { label: "Candlestick", gzip: [80.8, 87.6] },
  { label: "Funnel", gzip: [52.4, 61.2] },
  { label: "Radar", gzip: [67.5, 59.9] },
  { label: "Sunburst", gzip: [47.6, 68.6] },
  { label: "Composed", gzip: [96.9, 101.7] },
];

/** Every chart bundled together, KB gzip. */
export const bundleTotal: readonly [bklit: number, migrated: number] = [212.4, 293.6];

/** Migrated stylesheets as built by Next (minified, all charts, not splittable), KB gzip; bklit ships Tailwind classes instead. */
export const bundleCssKb = 8.2;

/** Share of the minified all-charts bundle by dependency, KB. */
export const bundleBreakdown = {
  bklit: [["bklit-ui source", 289], ["motion", 134], ["d3 and geo", 91], ["utility libs", 77], ["visx", 48]],
  migrated: [["@tanstack/charts", 246], ["migrated charts", 269], ["kit", 157], ["d3 and geo", 134], ["utility libs", 46]],
} as const;
