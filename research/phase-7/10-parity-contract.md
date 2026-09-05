# Phase 7 — Parity contract (claim 2)

The contract a consumer relies on when swapping `@bklit/ui` charts for the migrated package.
V1.6, V3.7 and V4.2 implement it; V4.6 and the V4.1 probes prove it. Legacy source:
`repos/bklit-ui/packages/ui/src/charts/` (barrel `index.ts`, 638 lines). Gap ids P-1..P-26 are
`09` §3.

## 1. Scope of the promise

Parity is a contract of **names, tree and slots**. It is never a contract of generated DOM
(upstream `migrating.md`, "Know what not to migrate"; `09` §1).

| Level | Promise | Proof |
|---|---|---|
| Exports | Every value and type export of the legacy barrel exists with the same name and an assignable type. Counted from the barrel: 292 value exports, 211 type exports. | V4.2 generated fixture, one `Eq<>` per export; a missing value fails typecheck |
| Props | Same prop names, defaults and unions per component; no silent drops (`ChartLoadingLabel.className`, P-21) | same fixture, `Props` types compared |
| Tree | Children compose the same way: config carriers, HOC-wrapped and memoised children register (V1.3); `children` required on the 7 families where legacy requires it | V4.1 HOC fixture |
| Failure modes | A child outside a chart throws the legacy message; unknown children are ignored the way legacy ignores them | V4.1 throw fixture |
| Hooks and providers | 27 provider/hook exports with legacy names; `useChartInteraction` result contract (P-8); stable/hover split | V4.1 hook fixture on the host store |
| Runtime behaviour | Enter transition timing, hover dim timing, tooltip springs match at rest and in transit | V4.3 curve parity, QA pixel gate |
| A11y surface | `role="img"` on the surface (P-22), no tab stops legacy lacks (P-23), `ariaLabel`/`ariaDescription` forwarded, `role="status"` on loading label | V4.1 probes |
| Styling surface | Root `chartCssVars` exported (P-6), `--ts-chart-*` theme variables, `data-slot` on every exported HTML part | V3.6, fixture |
| Package | Installs standalone with declared deps and peers, stylesheet imported per family entry (§4) | V1.9 `pnpm pack` into a fresh Next app |
| Tests | The legacy test suite runs against the migrated barrel with import changes only | V4.6 |

## 2. Export families

The barrel's 105 `export` statements group into these families. Each row is a V1.6 or V3.7
checklist line; the generated fixture is the real list.

| Family | Legacy modules (barrel order) | Known gaps |
|---|---|---|
| Animation and motion | `animation`, `chart-reveal-clip`, `indicator-fade`, `chart-phase` | P-5 `DEFAULT_CHART_ENTER_TRANSITION`, P-11 `LoadingStyle`, `ChartEnterTransition` + helpers |
| Area, line, live-line | `area`, `area-chart`, `area-chart-loading`, `line`, `line-chart`, `line-chart-loading`, `line-loading-pulse`, `line-series-terminal-marker`, `live-line`, `live-line-chart`, `live-x-axis`, `live-y-axis` | loading fields on `LineConfig`/`AreaConfig`; 15 loading exports (P-9) |
| Bar | `bar`, `bar-chart`, `bar-chart-loading`, `bar-depth`, `bar-squares`, `bar-squares-layout`, `bar-x-axis`, `bar-y-axis` | P-17 depth types and hook, P-18 `BarAnimationType`/`BarLineCap`, `BarChartProps.status`, `BarYAxis` |
| Candlestick | `candlestick`, `candlestick-chart` | P-3 `OHLCDataPoint`, `xDomain`/`xDomainSlotCount` |
| Brush | `chart-brush`, `chart-brush-layout`, `chart-brush-selection-overlay`, `chart-brush-track-overlay` | P-16 overlays, 11 brush aliases, `brushDirection`/`selection`/`useWindowMoveEvents`, P-25 `data-aligned` |
| Context, providers, hooks | `chart-context`, `chart-config-context`, `chart-child-passthrough`, `chart-scale`, `pie-context` and the family contexts | P-8 `useChartInteraction`, P-15 `TooltipData`, P-26 `Margin`, `ChartMargin`, 27 hook names |
| Legend | `legend/*`, `chart-legend`, `chart-legend-hover`, `profit-loss-legend`, `profit-loss-legend-hover` | P-4 `LegendItem` type vs `LegendItemComponent`, `ChartLegend`, `ProfitLossLegend` |
| Loading and skeleton | `chart-loading-label`, `generate-chart-skeleton-data`, `loading-sweep`, `line-loading-pulse`, `bar-chart-loading` | P-9, P-21, `getSkeletonHeights` |
| Typography and CSS | `chart-center-typography`, `chart-stat-flow`, `background`, `grid` | P-6 `chartCssVars`, P-7 `chartCenter*ClassName` |
| Gradients and patterns | `pattern-area`, `pattern-preset`, `area-gradient-defs` (13 gradient components with visx prop names) | `LinearGradient` and presets emit `gradients`; `RadialGradient`, `PatternLines`, `PatternCircles`, `PatternArea` render via the R10 seam |
| Polar | `pie-chart`, `pie-center`, `pie-center-shell`, `pie-slice`, `gauge`, `gauge-label-layout`, ring, radar, sunburst | P-19 `SunburstCenterProps`, P-20 `centroidAngle`/`localProgress`, sunburst reveal helpers |
| Geo, network, heatmap | `choropleth/*`, sankey, `heatmap/*` | P-1 sankey link props, P-2 sankey tooltip props, P-10 `levelColorsFromStyles`, P-14 tooltip data types, heatmap scale legend |
| Composed, scatter, funnel, markers, projection, reference area, segments | `composed-chart`, `funnel-chart`, `markers`, projection, reference area, segment modules | P-12 `ProjectionStrokeStyle`, P-24 funnel roles, scatter `onPhaseChange`, marker components as registering children |
| Utilities | `chart-formatters`, `decimate-time-series`, `filter-data-by-x-domain`, `y-domain-utils`, `highlight-segment-bounds` | P-13 `isLoadingChromePhase`, `computeYDomainsByAxis`/`niceYDomain`/`mergeYDomainRecords`, 10 utilities |

Un-export: the 36 internal modules the migrated barrel leaks today (`09` §3).

## 3. Per-family slots

What a consumer can place inside each chart and what must keep working. "Slot" means a child
the parent detects by role; detection falls back to `displayName ?? name` (R5).

| Family | Slots (children) | Chrome outside the svg |
|---|---|---|
| area, line, composed | series carriers, `Grid`, axes, `ChartBrush` (+ overlays), `ReferenceArea`, `Segment*`, `Projection*`, `ChartMarkers`/`MarkerGroup`/`SeriesMarkers`, `ProfitLossLine`, `PatternArea`, gradient children, `ChartLegend`, loading children | legend, tooltip body, loading label, brush chrome |
| bar | `Bar*` layers (depth back/front, pulse, column track, squares), `BarXAxis`/`BarYAxis`, `Grid`, legend, loading | legend, tooltip, loading label |
| candlestick | series, axes, `Grid`, legend | legend, tooltip |
| live-line | `LiveXAxis`, `LiveYAxis`, terminal marker | tooltip |
| pie, ring, gauge | `PieCenter`/`PieCenterShell`, `PieSlice` config, gauge labels, `RadialGradient` | centre stat, legend |
| radar, sunburst | series config, `SunburstCenter` | centre overlay (no new tab stop) |
| heatmap | cells config, `HeatmapLegend` (gradient and swatch), separators, axes | legend, tooltip |
| choropleth | `ChoroplethFeature`, `ChoroplethGraticule`, `ChoroplethTooltip` | tooltip |
| sankey | `SankeyLink` props (`getNodeColor`, `getLinkColor`, `patterns`, `getLinkPattern`), `SankeyTooltip` (`nodeContent`, `linkContent`) | tooltip |
| scatter, funnel | series config, `FunnelStage` | tooltip; funnel labels |

## 4. Package contract (V1.9)

| Field | Value |
|---|---|
| `dependencies` | `@tanstack/charts`, `@tanstack/react-charts`, `d3-scale`, `d3-geo`, `d3-delaunay`, `d3-zoom`, `topojson-client` |
| `peerDependencies` | `react`, `react-dom` at `^19`; widened to `^18 \|\| ^19` when I6 ships. Legacy declares `^18.0.0 \|\| ^19.0.0` |
| `sideEffects` | `["**/*.css"]` |
| `exports` | one entry per family plus the root barrel; every family entry imports its stylesheet |
| Removed | `@visx/*` (15 packages), `motion`, `@base-ui/react`, `@number-flow/react`, `react-use-measure`, `d3-shape`, `d3-array`, `d3-sankey` |

## 5. Exceptions

At most three lines, none adding a dependency (R4). Current list:

1. Framer keyframe arrays reproduce exactly; pulses use two package transitions instead of one
   keyframe list.
2. `renderChartImage`/`serializeChartSvg` exports omit R10 resources (patterns, radial
   gradients, sweep) until I4/I5 ship.
3. Grid and axis strokes are solid; legacy default is `strokeDasharray="4,4"` (F-260).

## 6. Legacy test suite (V4.6)

23 files: 17 under `__tests__/` and 6 under `heatmap/__tests__/`. Port with import changes
only; a test that targets a removed internal is rewritten against the public export and logged.

```
animation, bar-depth-geometry, chart-formatters, decimate-time-series,
heatmap-quarter-separator, heatmap-tooltip-format, highlight-segment-bounds,
line-loading-pulse, loading-sweep, profit-loss-segments, projection-utils,
reference-area-geometry, series-bar-layout, series-path-utils,
sunburst-hover-grow, sunburst-reveal, y-domain-utils,
heatmap/{animation, ghost, inactive, separator, week-range, week-start}
```

Note: `08` V4.6 says 17 files; the count on disk is 23. The 23 are the target.
