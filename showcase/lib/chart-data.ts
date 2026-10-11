// Static per-chart metadata for the showcase pages. Notes show only with NEXT_PUBLIC_SHOW_DEV_TOOLS=1.

/** Sidebar sections, as bklit's docs: Components (charts and chart variants) and Utility (composable pieces). */
/** Order follows bklit's content/docs/{components,utility}/meta.json; our variants sit after their parent chart. */
export const chartCategories = [
  {
    id: 'components',
    label: 'Components',
    order: ['area', 'patternarea', 'bar', 'bardepth', 'barsquares', 'candlestick', 'choropleth', 'composed', 'funnel', 'gauge', 'heatmap', 'line', 'liveline', 'pie', 'radar', 'ring', 'scatter', 'sankey', 'sunburst'],
  },
  { id: 'utility', label: 'Utility', order: ['reference-area', 'projection', 'brush', 'segment', 'markers'] },
] as const;

export interface ChartInfo {
  index: number;
  name: string;
  route: string;
  /** Accepted diffs vs bklit and implementation notes. */
  notes: string;
  /** Data size for chart demos. */
  defaultN: number;
}

export const allCharts: ChartInfo[] = [
  {
    index: 1,
    name: 'Scatter Chart',
    route: 'scatter',
    defaultN: 100,
    notes: '',
  },
  {
    index: 2,
    name: 'Bar Chart',
    route: 'bar',
    defaultN: 100,
    notes: 'stackGap is drawn as a background-colour stroke (1.0 stack() has no gap option). Hover p95 ~25ms vs bklit ~18ms; p50 at parity.',
  },
  {
    index: 3,
    name: 'Candlestick Chart',
    route: 'candlestick',
    defaultN: 100,
    notes: 'Accepted diff: solid crosshair.',
  },
  {
    index: 4,
    name: 'Area Chart',
    route: 'area',
    defaultN: 100,
    notes: 'Entrance grows from the baseline (no left-to-right wipe). Horizontal edge fade dropped (solid); gradients are objectBoundingBox-only.',
  },
  {
    index: 5,
    name: 'Line Chart',
    route: 'line',
    defaultN: 100,
    notes: 'Grow-from-baseline entrance over 1100ms instead of bklit\'s clip wipe. Highlight band rebuilds the definition on focus change: p95 interaction ~27ms vs bklit ~17ms (headless).',
  },
  {
    index: 6,
    name: 'Live Line Chart',
    route: 'liveline',
    defaultN: 30,
    notes: 'Accepted diffs: tip trails the newest sample by 2 rows (rolling needs path past the clip edge); linear curve under rolling.',
  },
  {
    index: 7,
    name: 'Composed Chart',
    route: 'composed',
    defaultN: 100,
    notes: 'WAAPI/MutationObserver bar entrance rejected; stacked and legend-dim handled natively.',
  },
  {
    index: 8,
    name: 'Radar Chart',
    route: 'radar',
    defaultN: 20,
    notes: 'Hover scale is a keyed-geometry spring (focused series rebuilt x1.05). Glow = translucent underlay stroke (no SVG filter in 1.0). Label hover also dims series.',
  },
  {
    index: 9,
    name: 'Pie Chart',
    route: 'pie',
    defaultN: 20,
    notes: 'PieCenter stays an overlay.',
  },
  {
    index: 10,
    name: 'Ring Chart',
    route: 'ring',
    defaultN: 20,
    notes: 'Ring hover scale and cursor handled natively.',
  },
  {
    index: 11,
    name: 'Gauge',
    route: 'gauge',
    defaultN: 72,
    notes: 'Notch enter is a fixed CSS scale + fade per notch about its own centre on the bklit enter spring. No native number-tween text, so NumberFlow stays.',
  },
  {
    index: 12,
    name: 'Funnel Chart',
    route: 'funnel',
    defaultN: 5,
    notes: 'Hover is a host attribute plus fixed CSS (0 definition builds per hover, timing within a frame of bklit). renderPattern supported (per-stage pattern ids, phase-matched).',
  },
  {
    index: 13,
    name: 'Heatmap Chart',
    route: 'heatmap',
    defaultN: 26,
    notes: 'Tooltip showDelay/hideDelay via host var plus fixed CSS and a hold-length exit; legend and cell activeScale pop at parity. Separator gradient uses a chart-local ResourceHost.',
  },
  {
    index: 14,
    name: 'Sunburst Chart',
    route: 'sunburst',
    defaultN: 10,
    notes: 'Entrance is a single group clip sweep (no per-arc stagger in 1.0); no descendant push on hover pop.',
  },
  {
    index: 15,
    name: 'Choropleth Chart',
    route: 'choropleth',
    defaultN: 177,
    notes: 'Pixel parity at rest, hover, zoom and drag; entrance and hover timing within a frame of bklit; un-dim snaps on leave like bklit.',
  },
  {
    index: 16,
    name: 'Sankey Chart',
    route: 'sankey',
    defaultN: 33,
    notes: 'Hover dim is native mark states (0 definition builds per hover, timing within a frame of bklit). getLinkPattern/patterns supported.',
  },
  {
    index: 17,
    name: 'Reference Area',
    route: 'reference-area',
    defaultN: 30,
    notes: 'Composes with Line, Area, Bar and Composed hosts.',
  },
  {
    index: 18,
    name: 'Segment',
    route: 'segment',
    defaultN: 30,
    notes: '',
  },
  {
    index: 19,
    name: 'Projection Line',
    route: 'projection',
    defaultN: 30,
    notes: '',
  },
  {
    index: 20,
    name: 'Chart Brush',
    route: 'brush',
    defaultN: 30,
    notes: '',
  },
  {
    index: 21,
    name: 'Chart Markers',
    route: 'markers',
    defaultN: 30,
    notes: '',
  },
  {
    index: 22,
    name: 'Pattern Area',
    route: 'patternarea',
    defaultN: 30,
    notes: '1.0 has no <pattern> resources, so the hatch is a CSS mask.',
  },
  {
    index: 23,
    name: 'Bar Squares',
    route: 'barsquares',
    defaultN: 6,
    notes: '',
  },
  {
    index: 24,
    name: 'Bar Depth',
    route: 'bardepth',
    defaultN: 6,
    notes: '',
  },
];
