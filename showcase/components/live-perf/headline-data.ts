import type { Headline } from "./headline-cards";

/** Chrome sweep totals, single source for the overview cards. */
export const sweepHeadlines: Headline[] = [
  { label: "Render time on load", kind: "faster", bklit: 1356, migrated: 228 },
  { label: "React render on hover", kind: "less", bklit: 2667, migrated: 172 },
  { label: "Browser compute per pointer move", kind: "faster", bklit: 54.4, migrated: 22.6 },
];

type Pair = readonly [bklit: number, migrated: number] | null;

/** Per-chart Chrome sweep (2026-10-11, post perf fixes), ms: median load, React render on hover, compute per move. */
export const chartHeadlines: Record<string, { load: Pair; hover: Pair; move: Pair }> = {
  area: { load: [35.2, 9.1], hover: [149.5, 12.2], move: [2.94, 1.53] },
  bar: { load: [23.1, 5.3], hover: [35, 3.5], move: [0.7, 0.5] },
  bardepth: { load: [36.7, 5.95], hover: [76.7, 3.9], move: [1.44, 0.58] },
  barsquares: { load: [44.1, 6.9], hover: [84.4, 4.3], move: [1.71, 0.45] },
  brush: { load: [43.5, 15], hover: [132, 10.7], move: [2.59, 1.48] },
  candlestick: { load: [21.1, 8.9], hover: [37.8, 3.1], move: [0.77, 0.6] },
  choropleth: { load: [199.9, 61.8], hover: [82.6, 5.5], move: [1.55, 0.79] },
  composed: { load: [39.6, 7.95], hover: [186.9, 15.2], move: [3.59, 1.53] },
  funnel: { load: [21.7, 3.75], hover: [34.8, 0], move: [0.62, 0.38] },
  gauge: { load: [64.5, 7.05], hover: [0, 0], move: [0.09, 0.07] },
  heatmap: { load: [115.9, 5.85], hover: [402.4, 22.2], move: [7.8, 1.26] },
  line: { load: [55.7, 9.3], hover: [159.4, 12.9], move: [3.05, 1.43] },
  liveline: { load: [104.2, 12.9], hover: [405.6, 29.8], move: [2.6, 1.72] },
  markers: { load: [64.6, 9.2], hover: [161.5, 11.3], move: [3.11, 1.38] },
  patternarea: { load: [24.4, 8.25], hover: [135.6, 9.1], move: [2.66, 1.4] },
  pie: { load: [12.2, 1.45], hover: [56.2, 0], move: [1.11, 0.27] },
  projection: { load: [35.1, 7.5], hover: [137.7, 10], move: [2.67, 1.32] },
  radar: { load: [22.1, 2.75], hover: [40.6, 1.7], move: [0.79, 0.28] },
  "reference-area": { load: [28.9, 9.55], hover: [173.5, 10.5], move: [3.39, 1.38] },
  ring: { load: [21, 3.4], hover: [30.6, 4.5], move: [0.61, 0.35] },
  sankey: { load: [51.9, 2.45], hover: [267.3, 6.8], move: [5.06, 0.85] },
  scatter: { load: [43.7, 6.4], hover: [139.7, 13.1], move: [2.75, 1.61] },
  segment: { load: [24.8, 12.7], hover: [143, 11.1], move: [2.82, 1.4] },
  sunburst: { load: [222.3, 4.7], hover: null, move: null },
};
