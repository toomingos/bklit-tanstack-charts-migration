/** Minified + gzipped JS per chart (esbuild 0.28, tree-shaken, react external), measured 2026-10-11 in a scratch harness.
 * KB gzip, [bklit, migrated]; migrated also ships a shared stylesheet (bundleCssKb). */
export const bundleSizes: { label: string; gzip: readonly [bklit: number, migrated: number] }[] = [
  { label: "Line", gzip: [92.8, 125.1] },
  { label: "Area", gzip: [92.6, 125.1] },
  { label: "Bar", gzip: [80.8, 91.9] },
  { label: "Pie", gzip: [57.9, 55.5] },
  { label: "Ring", gzip: [63.2, 70.3] },
  { label: "Gauge", gzip: [59.9, 67.6] },
  { label: "Heatmap", gzip: [79.6, 81.6] },
  { label: "Sankey", gzip: [60.0, 70.1] },
  { label: "Choropleth", gzip: [79.1, 87.9] },
  { label: "Live line", gzip: [78.7, 86.5] },
  { label: "Scatter", gzip: [80.6, 81.2] },
  { label: "Candlestick", gzip: [80.4, 93.0] },
  { label: "Funnel", gzip: [52.4, 61.1] },
  { label: "Radar", gzip: [67.3, 66.8] },
  { label: "Sunburst", gzip: [47.6, 74.0] },
  { label: "Composed", gzip: [96.6, 119.0] },
];

/** Every chart bundled together, KB gzip. */
export const bundleTotal: readonly [bklit: number, migrated: number] = [216.3, 300.4];

/** Migrated stylesheet (all charts, not splittable), KB gzip; bklit ships Tailwind classes instead. */
export const bundleCssKb = 16.3;

/** Share of the minified all-charts bundle by dependency, KB. */
export const bundleBreakdown = {
  bklit: [["bklit-ui source", 289], ["motion", 134], ["d3 and geo", 89], ["utility libs", 81], ["visx", 58]],
  migrated: [["@tanstack/charts", 263], ["migrated charts", 262], ["kit", 146], ["d3 and geo", 143], ["utility libs", 45]],
} as const;

type Pair = readonly [bklit: number, migrated: number] | null;

/** Production build (next build --profile, port 5301, 2026-10-11, Chrome): load = median of 3 reloads, hover and move over 55 real pointer moves per side.
 * ms: render on load, React render on hover, main-thread work per move. Live line move work is not reported by the collector. */
export const prodPerf: { label: string; load: Pair; hover: Pair; move: Pair }[] = [
  { label: "Line", load: [11.5, 5.2], hover: [31, 2.2], move: [0.667, 1.524] },
  { label: "Area", load: [12.2, 8.8], hover: [26.6, 2.3], move: [0.551, 1.324] },
  { label: "Bar", load: [6.2, 2.9], hover: [5.5, 1.3], move: [0.173, 0.436] },
  { label: "Ring", load: [8.7, 1.1], hover: [12.9, 1.7], move: [0.204, 0.342] },
  { label: "Choropleth", load: [76.5, 41.4], hover: [7.8, 1.6], move: [0.211, 0.825] },
  { label: "Heatmap", load: [23.9, 3.2], hover: [176.4, 4], move: [3.187, 0.856] },
  { label: "Sankey", load: [13.1, 0.9], hover: [58.9, 2.7], move: [1.118, 0.76] },
  { label: "Live line", load: [18.9, 7.3], hover: [94.3, 8.7], move: null },
];
