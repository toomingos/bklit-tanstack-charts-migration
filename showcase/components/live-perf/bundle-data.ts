/** Minified + gzipped JS per chart (archive/bench/bundle.mjs: esbuild, tree-shaken, react/next and the page-shell packages external, same method both sides), re-measured 2026-10-12 on main 6c80903c.
 * KB gzip, [bklit, migrated]; migrated also ships a shared stylesheet (bundleCssKb). */
export const bundleSizes: { label: string; gzip: readonly [bklit: number, migrated: number] }[] = [
  { label: "Area Chart", gzip: [86.9, 92.3] },
  { label: "Bar Chart", gzip: [74.6, 78.4] },
  { label: "Bar Depth", gzip: [77, 80.8] },
  { label: "Bar Squares", gzip: [80, 83.9] },
  { label: "Chart Brush", gzip: [95.9, 114.2] },
  { label: "Candlestick Chart", gzip: [68, 74.9] },
  { label: "Choropleth Chart", gzip: [71.8, 70.3] },
  { label: "Composed Chart", gzip: [89, 89] },
  { label: "Composition", gzip: [91.3, 105.2] },
  { label: "Funnel Chart", gzip: [46.1, 52.1] },
  { label: "Gauge", gzip: [52.3, 59.8] },
  { label: "Heatmap Chart", gzip: [72.4, 70.3] },
  { label: "Line Chart", gzip: [90.5, 96.6] },
  { label: "Live Line Chart", gzip: [72.5, 75.6] },
  { label: "Chart Markers", gzip: [94, 101.9] },
  { label: "Pattern Area", gzip: [87.3, 92] },
  { label: "Pie Chart", gzip: [51.6, 55.7] },
  { label: "Projection Line", gzip: [88.3, 97.2] },
  { label: "Radar Chart", gzip: [61.1, 59.4] },
  { label: "Reference Area", gzip: [89.1, 96.3] },
  { label: "Ring Chart", gzip: [56.9, 51.9] },
  { label: "Sankey Chart", gzip: [53.1, 67.4] },
  { label: "Scatter Chart", gzip: [74.6, 70.5] },
  { label: "Segment", gzip: [88.5, 92.2] },
  { label: "Sunburst Chart", gzip: [48.5, 68.5] },
];

/** Mean over the charts above, KB gzip. */
export const bundleTotal: readonly [bklit: number, migrated: number] = [74.5, 79.9];

/** Migrated stylesheets as built by Next (minified, all charts), KB gzip; polar (1.3) and heatmap (1.0) rules load only with those charts. bklit ships Tailwind classes instead. */
export const bundleCssKb = 8.2;

/** Share of the minified all-charts bundle by dependency, KB. */
export const bundleBreakdown = {
  bklit: [["bklit-ui source", 289], ["motion", 134], ["d3 and geo", 91], ["utility libs", 77], ["visx", 48]],
  migrated: [["@tanstack/charts", 246], ["migrated charts", 269], ["kit", 157], ["d3 and geo", 134], ["utility libs", 46]],
} as const;
