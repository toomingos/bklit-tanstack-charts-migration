/** Minified + gzipped JS per chart (archive/bench/bundle.mjs: esbuild, tree-shaken, react/next and the page-shell packages external, same method both sides), re-measured 2026-10-13 on main 36240b49.
 * KB gzip, [bklit, migrated]; migrated also ships a shared stylesheet (bundleCssKb). */
export const bundleSizes: { label: string; gzip: readonly [bklit: number, migrated: number] }[] = [
  { label: "Area Chart", gzip: [86.9, 93.3] },
  { label: "Bar Chart", gzip: [74.6, 79.4] },
  { label: "Bar Depth", gzip: [77.0, 81.8] },
  { label: "Bar Squares", gzip: [80.0, 84.9] },
  { label: "Chart Brush", gzip: [95.9, 115.2] },
  { label: "Candlestick Chart", gzip: [68.0, 75.8] },
  { label: "Choropleth Chart", gzip: [71.8, 70.3] },
  { label: "Composed Chart", gzip: [89.0, 90.1] },
  { label: "Composition", gzip: [91.3, 106.2] },
  { label: "Funnel Chart", gzip: [46.1, 52.4] },
  { label: "Gauge", gzip: [52.3, 59.8] },
  { label: "Heatmap Chart", gzip: [72.4, 70.3] },
  { label: "Line Chart", gzip: [90.5, 97.1] },
  { label: "Live Line Chart", gzip: [72.5, 76.2] },
  { label: "Chart Markers", gzip: [94.0, 102.4] },
  { label: "Pattern Area", gzip: [87.3, 92.9] },
  { label: "Pie Chart", gzip: [51.6, 56.2] },
  { label: "Projection Line", gzip: [88.3, 97.7] },
  { label: "Radar Chart", gzip: [61.1, 59.7] },
  { label: "Reference Area", gzip: [89.1, 96.8] },
  { label: "Ring Chart", gzip: [56.9, 52.4] },
  { label: "Sankey Chart", gzip: [53.1, 67.4] },
  { label: "Scatter Chart", gzip: [74.6, 71.5] },
  { label: "Segment", gzip: [88.5, 93.2] },
  { label: "Sunburst Chart", gzip: [48.5, 68.5] },
];

/** Mean over the charts above, KB gzip. */
export const bundleTotal: readonly [bklit: number, migrated: number] = [74.5, 80.5];

/** Migrated stylesheets as built by Next (minified, all charts), KB gzip; polar (1.3) and heatmap (1.0) rules load only with those charts. bklit ships Tailwind classes instead. */
export const bundleCssKb = 8.2;

/** Share of the minified all-charts bundle by dependency, KB. */
export const bundleBreakdown = {
  bklit: [["bklit-ui source", 289], ["motion", 134], ["d3 and geo", 91], ["utility libs", 77], ["visx", 48]],
  migrated: [["@tanstack/charts", 246], ["migrated charts", 269], ["kit", 157], ["d3 and geo", 134], ["utility libs", 46]],
} as const;
