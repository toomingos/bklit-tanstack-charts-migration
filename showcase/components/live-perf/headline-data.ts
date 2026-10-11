import type { Headline } from "./headline-cards";

/** Chrome sweep totals, single source for the overview cards. */
export const sweepHeadlines: Headline[] = [
  { label: "Render time on load", kind: "faster", bklit: 975, migrated: 278 },
  { label: "React render on hover", kind: "less", bklit: 2101, migrated: 133 },
  { label: "Browser compute per pointer move", kind: "faster", bklit: 41.4, migrated: 26.7 },
];

type Pair = readonly [bklit: number, migrated: number] | null;

/** Per-chart Chrome sweep (2026-10-11), ms: render on load, React render on hover, compute per move. */
export const chartHeadlines: Record<string, { load: Pair; hover: Pair; move: Pair }> = {
  area: { load: [29.2, 15.8], hover: [187.4, 10.9], move: [3.38, 1.50] },
  bar: { load: [14.6, 7.9], hover: [21.8, 4.5], move: [0.48, 0.42] },
  bardepth: { load: [26.6, 9.6], hover: [34.7, 5.8], move: [0.67, 0.56] },
  barsquares: { load: [21.7, 6.0], hover: [61.4, 5.7], move: [1.14, 0.53] },
  brush: { load: [32.8, 20.3], hover: [106.1, 11.5], move: [1.99, 1.51] },
  candlestick: { load: [12.8, 8.6], hover: [26.4, 4.3], move: [0.56, 0.58] },
  choropleth: { load: [194, 72], hover: [36.2, 4.6], move: [0.70, 1.24] },
  composed: { load: [26.4, 7.5], hover: [131.8, 10.6], move: [2.40, 1.27] },
  funnel: { load: [12.8, 4.3], hover: [17.7, 0], move: [0.32, 0.36] },
  gauge: { load: [43, 6.7], hover: [0, 0], move: [0.08, 0.20] },
  heatmap: { load: [56.4, 5.6], hover: [606.1, 11.1], move: [10.70, 0.92] },
  line: { load: [25.6, 9.0], hover: [95.8, 10.0], move: [1.76, 1.26] },
  liveline: { load: [53.4, 12.8], hover: [2407.6, 92.2], move: [1.79, 1.53] },
  markers: { load: [60.4, 18.8], hover: [110.2, 6.7], move: [2.12, 1.61] },
  patternarea: { load: [22.4, 12.5], hover: [84.4, 4.2], move: [1.68, 1.39] },
  pie: { load: [9.0, 1.7], hover: [12.0, 0], move: [0.30, 0.27] },
  projection: { load: [17.4, 6.0], hover: [74.3, 4.1], move: [1.48, 1.22] },
  radar: { load: [11.3, 3.2], hover: [20.6, 5.4], move: [0.49, 0.66] },
  "reference-area": { load: [18.9, 10.4], hover: [72.5, 4.3], move: [1.45, 1.21] },
  ring: { load: [14.4, 2.7], hover: [42.6, 9.0], move: [0.86, 4.82] },
  sankey: { load: [26.0, 2.0], hover: [213, 6.8], move: [4.12, 0.82] },
  scatter: { load: [35.5, 7.7], hover: [65.5, 6.0], move: [1.35, 1.26] },
  segment: { load: [19.9, 13.6], hover: [80.6, 7.1], move: [1.57, 1.55] },
  sunburst: { load: [163, 4.9], hover: null, move: null },
};
