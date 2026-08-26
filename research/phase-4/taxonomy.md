# Phase 4 Taxonomy — Migrated Parts

Migrated codebase: `showcase/migrated/charts/` (16 charts + 3 add-ons + `index.ts` + `styles.css` + ~125 `internal/` modules). Legacy source: `repos/bklit-ui/packages/ui/src/charts/`. Internal modules are grouped: chart-specific internals belong to their chart's part; cross-chart internals form 6 shared groups. SHARED vs UNIQUE is decided by the usage-matrix (4.1.4.2), not here.

## Charts (16)

| Part | Migrated file(s) | Chart-specific internals | Report batch |
|---|---|---|---|
| line | `line-chart.tsx` | `profit-loss-config`, `profit-loss-legend` (orphan — no importers), `profit-loss-legend-hover` (orphan — no importers), `profit-loss-line-mark/segments`, `grid-highlight-mark` | 1 |
| area | `area-chart.tsx` | `pattern-area-mark` | 1 |
| bar | `bar-chart.tsx` | `bar-column-track-mark`, `bar-depth-geometry`, `bar-depth-marks`, `bar-focus-strategy`, `bar-hover-chrome`, `bar-pulse-mark`, `bar-pulse-overlay` (orphan — no importers), `bar-squares-layout`, `bar-squares-mark`, `bar-trimmed-mark`, `bar-x-axis-overlay` | 1 |
| composed | `composed-chart.tsx` | `series-bar-layout`, `series-bar-mark` | 1 |
| scatter | `scatter-chart.tsx` | `scatter-focus-strategy`, `scatter-hover-chrome` | 1 |
| candlestick | `candlestick-chart.tsx` | `candlestick-focus-strategy`, `candlestick-hover-chrome` | 2 |
| live-line | `live-line-chart.tsx` | `live-hover-chrome`, `live-line-mark` | 2 |
| pie | `pie-chart.tsx` | `pie-center`, `pie-reveal` | 2 |
| ring | `ring-chart.tsx` | `ring-center` (orphan — no importers), `ring-hover-chrome`, `ring-reveal` | 2 |
| gauge | `gauge.tsx` | `gauge-center`, `gauge-notch`, `gauge-reveal`, `focus-disabled` | 2 |
| radar | `radar-chart.tsx` | `radar-reveal` | 3 |
| sankey | `sankey-chart.tsx` | `sankey-animation`, `sankey-hover-chrome`, `sankey-layout`, `sankey-mark` | 3 |
| sunburst | `sunburst-chart.tsx` | `sunburst-center`, `sunburst-colors`, `sunburst-geometry`, `sunburst-hint`, `sunburst-labels`, `sunburst-reveal`, `sunburst-types` | 3 |
| heatmap | `heatmap-chart.tsx` | `heatmap-animation`, `heatmap-colors`, `heatmap-components`, `heatmap-context`, `heatmap-hover-chrome`, `heatmap-interaction`, `heatmap-legend`, `heatmap-lifecycle`, `heatmap-utils` | 3 |
| funnel | `funnel-chart.tsx` | `funnel-geometry`, `funnel-hover-chrome`, `funnel-reveal` | 3 |
| choropleth | `choropleth-chart.tsx` | `choropleth-graticule`, `choropleth-hover-chrome` | 4 |

## Add-ons (3)

| Part | Migrated file(s) | Notes | Report batch |
|---|---|---|---|
| children | `children.tsx` | Config-carrier compositional API (CHART_ROLE markers) compiled into TanStack `defineChart` specs | 4 |
| segment | `segment.tsx` | Segment highlight add-on (visuals moved to internal-interaction: consumed by 4 charts) | 4 |
| reference-area | `reference-area.tsx` | Reference-area add-on (internals moved to internal-axes-grid: consumed by 6–8 charts) | 4 |

## Shared internal groups (6)

| Part | `internal/` modules | Report batch |
|---|---|---|
| internal-interaction | `hover-chrome`, `use-hover-chrome`, `tooltip-chrome`, `tooltip-scheduler`, `hover-reanchor`, `bisect`, `chart-selection`, `pie-hover-chrome`, `segment-visuals` | 4 |
| internal-animation | `spring`, `bezier-easing`, `enter-transition`, `deferred-reveal`, `dash-tail`, `fade-mask`, `chart-phase`, `use-chart-phase-orchestrator`, `decimate`, `candle-spring`, `radar-spring`, `projection-config`, `projection-line-mark`, `projection-utils`, `terminal-marker` | 5 |
| internal-axes-grid | `grid`, `x-ticks`, `x-axis-overlay`, `y-axis-overlay`, `y-axis-ticks`, `y-domain`, `use-chart-margin`, `background` (orphan — no importers), `reference-area-config`, `reference-area-geometry`, `reference-area-layer` | 5 |
| internal-legend-markers | `legend` (orphan — no importers), `legend-context` (orphan — no importers), `chart-legend` (orphan — no importers), `chart-legend-hover`, `chart-markers`, `series-marker-mark` | 5 |
| internal-brush | `chart-brush` (orphan — no importers), `brush-chrome` (orphan — no importers), `brush-drag`, `brush-layout` (orphan — no importers), `brush-selection` | 5 |
| internal-foundation | `chart-config-context`, `design-tokens`, `types`, `formatters`, `coerce-date`, `parse-aspect-ratio`, `use-container-size`, `use-prefers-reduced-motion`, `loading-chrome`, `center-stat`, `area-fill-mark`, `pattern-preset`, `visx-pattern-bridge`, `pie-geometry`, `internal/index.ts`, `charts/index.ts`, `styles.css` | 5 |

25 parts → 5 report batches of 5 (4.1.4.1).

Verification (2026-08-21): assignments checked against the real import graph — every relative import under `showcase/migrated/charts/` parsed and resolved (including named bindings through the `internal/index.ts` / `charts/index.ts` barrels, which are treated as facades, not consumers), then transitive reachability computed per module from the 19 entrypoints. 17 corrections, 104 assignments confirmed; 11 orphans flagged; no module missing or duplicated.
