# 01 — bklit-ui Chart Library Inventory

Source: `repos/bklit-ui/packages/ui/src/charts` (read-only, not modified). Enumeration starts from the package's public barrel, `src/charts/index.ts` (639 lines), which is the definitive list of every symbol `packages/ui` re-exports from this subsystem. All claims below are cited to a specific file actually read; where something was referenced but not opened, or was too large to fully re-verify, it is flagged explicitly rather than guessed at.

Every top-level chart composes from one shared runtime: a `ChartProvider`/`useChart`/`useChartStable`/`useChartHover` context (`chart-context.tsx`), a `ChartConfigProvider` (`chart-config-context.tsx`), a phase/reveal state machine (`chart-phase.ts` + `use-chart-phase-orchestrator.ts`), and a large library of composable "chrome" components (axes, grid, background, tooltip, legend, brush, markers, reference areas). Sections 3–6 document that shared layer once; per-chart sections reference it instead of repeating it.

---

## 1. Top-level chart components

| Component | One-line purpose | Source file |
|---|---|---|
| `AreaChart` | Cartesian area/stacked-area chart, time or category x-axis | `area-chart.tsx` |
| `BarChart` | Cartesian bar chart (vertical/horizontal), with 3D-depth and "squares" bar variants as composable children | `bar-chart.tsx` |
| `CandlestickChart` | OHLC candlestick chart for financial data | `candlestick-chart.tsx` |
| `ComposedChart` | Multi-series time chart combining Line + Area + SeriesBar (columns) on one shared time scale | `composed-chart.tsx` |
| `LineChart` | Cartesian multi-line chart, supports multiple y-axes via `yAxisId` | `line-chart.tsx` |
| `LiveLineChart` | Real-time streaming line chart (append-only, scrolling window) | `live-line-chart.tsx` |
| `ScatterChart` | Cartesian scatter/bubble chart | `scatter-chart.tsx` |
| `HeatmapChart` | Calendar/grid heatmap (GitHub-contribution-style), binned color levels | `heatmap/` (barrel; see §2.8) |
| `ChoroplethChart` | Geographic map chart with zoom/pan and per-feature fill | `choropleth/` (barrel; see §2.9) |
| `SankeyChart` | Flow diagram (nodes + weighted links) | `sankey/` (barrel; see §2.10) |
| `PieChart` | Pie chart with hover-offset slices and optional center stat | `pie-chart.tsx` (+ `pie-context.tsx`, `pie-slice.tsx`, `pie-center*.tsx`) |
| `RingChart` | Donut/ring chart variant of Pie, shares `PieCenterShell` | `ring-chart.tsx` (+ `ring-context.tsx`, `ring.tsx`, `ring-center.tsx`) |
| `RadarChart` | Radar/spider chart (multi-axis polar) | `radar-chart.tsx` (+ `radar-context.tsx`, `radar-area.tsx`, `radar-axis.tsx`, `radar-grid.tsx`, `radar-labels.tsx`) |
| `SunburstChart` | Multi-ring hierarchical sunburst with zoom/drill-down | `sunburst-chart.tsx` (+ `sunburst/` geometry barrel, `sunburst-context.tsx`, `sunburst-segment.tsx`, `sunburst-labels.tsx`, `sunburst-hint.tsx`, `sunburst-breadcrumb.tsx`, `sunburst-center.tsx`) |
| `Gauge` | Semi-circular/full-circular gauge, reuses `PieCenterShell` for its center stat | `gauge.tsx` (+ `gauge-label-layout.ts`) |
| `FunnelChart` | Conversion funnel (stacked trapezoid stages) | `funnel-chart.tsx` |

**16 top-level chart components.** Each also ships a dedicated `*ChartLoading` shortcut component (`AreaChartLoading`, `BarChartLoading`, `LineChartLoading`, `HeatmapChartLoading`) that pins `status="loading"` — these are convenience wrappers, not separate chart implementations, confirmed via their `index.ts` export comments ("a `status="loading"` shortcut").

---

## 2. Per-chart public API (backwards-compatibility contract)

> Confidence note: every top-level chart's primary file(s) — `area-chart.tsx`/`area.tsx`, `bar-chart.tsx`/`bar.tsx`, `line-chart.tsx`/`line.tsx`, `composed-chart.tsx`/`series-bar.tsx`, `scatter-chart.tsx`/`scatter.tsx`, `candlestick-chart.tsx`/`candlestick.tsx`, `live-line-chart.tsx`/`live-line.tsx`, `pie-chart.tsx`, `ring-chart.tsx`, `radar-chart.tsx`, `sunburst-chart.tsx`, `gauge.tsx`, `funnel-chart.tsx`, `heatmap/heatmap-chart.tsx`, `choropleth/choropleth-chart.tsx`, `sankey/sankey-chart.tsx` — were read directly and in full during this research session. All previously-hedged "(unverified default)" markers on cartesian-family curve types have now been resolved by direct read (see §2.1/§2.3). Remaining unverified items are narrowed to: `x-axis.tsx`'s complete prop table (only its first ~60 lines were re-confirmed), and a handful of small cross-cutting utility files listed in the final report gaps.

### 2.1 AreaChart family
Files: `area-chart.tsx` (`AreaChart`, `AreaChartProps`), `area.tsx` (`Area`, `AreaProps`), `area-chart-loading.tsx`.

**`AreaChart` props** (composes `ChartProvider` + chrome children as `<AreaChart><Area dataKey="x"/><XAxis/><YAxis/></AreaChart>`):
| Prop | Type | Default | Required | Description |
|---|---|---|---|---|
| `data` | `Record<string, unknown>[]` | — | yes | Row data, one object per x-value |
| `xDataKey` | `string` | `"date"` | no | Key used for the x scale |
| `width` / `height` | `number` | — | yes (or container-measured) | Chart pixel dimensions |
| `margin` | `Margin` | internal default | no | Plot-area inset |
| `status` | `"loading" \| "ready"` | `"ready"` | no | Drives the phase orchestrator (see §3) |
| `animationDuration` | `number` | `DEFAULT_ANIMATION_DURATION_MS` (1100ms, `animation.ts`) | no | Reveal/tween duration |
| `children` | `ReactNode` | — | no | `Area`, `XAxis`, `YAxis`, `Grid`, `Background`, `ReferenceArea`, `ChartTooltip`, `ChartLegend`/`Legend`, `ChartBrush*`, `ProjectionLine`, markers |

**`Area` child props** (per-series):
| Prop | Type | Default | Required | Description |
|---|---|---|---|---|
| `dataKey` | `string` | — | yes | Field to plot |
| `stroke` / `fill` | `string` | theme color | no | Line/fill color |
| `fillOpacity` | `number` | — | no | Area fill opacity |
| `stackId` | `string` | — | no | Groups areas into a stacked baseline |
| `curveType` | `string` (visx curve name) | `curveMonotoneX` — **confirmed by direct read of `area.tsx`** | no | Interpolation curve |
| `yAxisId` | `string \| number` | `DEFAULT_Y_AXIS_ID` (`"left"`) | no | Multi-axis routing (`y-axis-scales.ts`) |
| `fadeEdges` | `boolean \| "left" \| "right"` | **`false`** — confirmed; differs from `Line`'s default of `true` (see §2.3) | no | Horizontal edge fade (`fade-edges.ts`) |
| `dashFromIndex` | `number` | — | no | Start index for the dash-tail overlay (`series-dash-tail-overlay.tsx`) |
| `loadingStyle` | `"pulse" \| "sweep"` | `"pulse"` | no | Which loading animation renders while `status="loading"` |
| animation/highlight props | — | — | no | Consumes shared `SeriesHoverDim`, `SeriesHighlightLayer`, `ChartRevealClip` internally |

### 2.2 BarChart family
Files: `bar-chart.tsx`, `bar.tsx` (`Bar`, `BarProps`, `BarAnimationType`, `BarLineCap`), `bar-chart-loading.tsx`, `bar-depth/` (`BarDepthBack`, `BarDepthFront`, `BarDepthProvider`, `BarPulse`, `useBarDepthEntries`), `bar-squares.tsx`/`bar-squares-layout.ts` (`BarSquares`, `BarColumnTrack`), `bar-x-axis.tsx`, `bar-y-axis.tsx`.

**`BarChart` props:**
| Prop | Type | Default | Required |
|---|---|---|---|
| `data` | `Record<string, unknown>[]` | — | yes |
| `orientation` | `BarOrientation` (`"vertical" \| "horizontal"`) | `"vertical"` | no |
| `xDataKey` | `string` | `"date"`/category key | no |
| `status` | `ChartStatus` | `"ready"` | no |
| `children` | `Bar`, `BarDepthBack/Front`, `BarSquares`, `BarColumnTrack`, axes, `Grid`, `Background`, `ReferenceArea` | — | no |

**`Bar` child props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `dataKey` | `string` | — | Field to plot |
| `fill` | `string` | theme color | Bar fill |
| `radius` | `number \| [number,number,number,number]` | — | Corner radius |
| `perspective` | `boolean` | `false` | Enables 3D front-face shrink (shares math with `BarDepthBack`, `bar-depth-geometry.ts`) |
| `lineCap` | `BarLineCap` | — | Cap style for pill-shaped bars |
| `animationType` | `BarAnimationType` | — | Grow direction/easing preset |
| `maxBarSize` / `barSize` | `number` | — | Width caps |

**`BarDepthProvider`/`BarDepthBack`/`BarDepthFront`/`BarPulse`**: composable 3D-depth layer. `BAR_DEPTH_MAX_PX=7`, `BAR_DEPTH_PERSPECTIVE_RATIO=0.45` (`bar-depth-geometry.ts`) are shared constants between `Bar perspective` and `BarDepthBack` so front/back geometry cannot drift.

**`BarSquares`/`BarColumnTrack`**: quantized "stack of squares" bar variant; layout math in `bar-squares-layout.ts` (`computeSquareColumn` — `fit` mode vs rounded mode, `topSquareCenterY`).

### 2.3 LineChart family
Files: `line-chart.tsx`, `line.tsx` (`Line`, `LineProps`), `line-chart-loading.tsx`, `line-loading-pulse.tsx`, `loading-sweep.tsx`, `line-series-terminal-marker.tsx`.

**`LineChart` props:** `data`, `xDataKey`, `status`, `animationDuration`, multi-axis support via each `Line`'s `yAxisId` (grouped by `groupLinesByYAxisId`, `y-axis-scales.ts`).

**`Line` child props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `dataKey` | `string` | — | Field to plot |
| `stroke` | `string` | theme color | Line color |
| `strokeWidth` | `number` | — | Line width |
| `curveType` | `string` | `curveNatural` — **confirmed by direct read of `line.tsx`; distinct from `Area`'s `curveMonotoneX` default** — this asymmetry was previously undocumented | Interpolation |
| `yAxisId` | `string \| number` | `"left"` | Axis routing |
| `dot` | `boolean \| ReactElement` | — | Point markers (delegates to `SeriesPointMarker`/`SeriesMarkers`) |
| `dashFromIndex` | `number` | — | Dash-tail start (`series-dash-tail-overlay.tsx`) |
| `fadeEdges` | `FadeEdges` | **`true`** — confirmed; differs from `Area`'s default of `false` | (`fade-edges.ts`) |
| `loadingStyle` | `"pulse" \| "sweep"` | `"pulse"` | Loading animation choice |
| `animate` | `boolean` | `true` | Enables `useAnimatedSeriesPath` data-transition smoothing, gated by `chartPhase==="ready"` (`useDataTransitionPath = animate && chartPhase === "ready"`) — this hook is used only by `Line`, not `Area` |

Composable additions specific to Line/Composed: `ProjectionLine` (forward dashed projection, §3), `ProfitLossLine` (sign-colored segments, §3), `LineSeriesTerminalMarker` (last-point ring), `ChartBrush`/`ChartBrushLayout` (zoom strip).

### 2.4 ComposedChart
File: `composed-chart.tsx` (`ComposedChart`, `ComposedChartProps`). Combines `Line`, `Area`, and `SeriesBar` (`series-bar.tsx`) children on one shared time x-scale. `SeriesBar` width/grouping resolved by `computeSeriesBarWidth` (`series-bar-layout.ts`: `composedBarSize`, `composedMaxBarSize`, `composedBarGap=4`, shrinks group width if it would exceed 92% of its slot) and clip padding via `computeSeriesBarRevealClipPadding`.

### 2.5 ScatterChart
Files: `scatter-chart.tsx`, `scatter.tsx` (`Scatter`, `ScatterProps`). Single y-axis (`wrapSingleYScale`, `y-axis-scales.ts`). Points rendered via the shared marker system (`SeriesPointMarker`/`SeriesMarkers`), so bubble sizing/coloring and hover/legend-dim behavior are inherited from that shared component rather than reimplemented.

**Confirmed distinguishing details (direct read):**
- **Unique sizing mechanism**: `ScatterChart` measures its container with `react-use-measure`'s `useMeasure({debounce: 10})` directly — every other cartesian chart (Area/Bar/Line/Composed/Candlestick/Radar/Pie/Ring) uses `@visx/responsive`'s `ParentSize` instead. It also uses its own `ScatterChartInner` (`scatter-chart-shell.tsx`), not the shared `TimeSeriesChartInner`.
- `ScatterChartProps`: `data`, `xDataKey="date"`, `margin` (default `{top:40,right:40,bottom:40,left:40}`), `animationDuration=1100`, `animationEasing?`, `enterTransition` (default **`DEFAULT_CHART_ENTER_TRANSITION`** from `animation.ts` — the only cartesian-chart-level prop with a concrete non-`undefined` default observed anywhere in this family), `revealSignature?`, `aspectRatio="2 / 1"`, `className`, `onPhaseChange?`.
- `extractScatterConfigs()` round-robins `defaultScatterColors` (from `chart-context.tsx`) across series lacking an explicit color, keyed by `dataKey`.
- **`ScatterProps`** (extends `Omit<SeriesMarkersProps, "animate">`): `dataKey`, `fill?`, `stroke?`, `strokeWidth=2`, `ringGap=2`, `outlineWidth=0`, `outlineColor?`, `radius=5`, `yAxisId?` (default `"left"`), `animate=true`, `fadeOnHover=true`, `inactiveOpacity=0.5`, `inactiveBlur=2`, `enterBlur=2`, `showActiveHighlight=true`, `yGradient?: boolean | {from?: string; to?: string}` — colors each dot by vertical position via a per-instance `userSpaceOnUse` `<linearGradient>` (default stops `var(--color-red-500)` bottom → `var(--color-emerald-500)` top). `Scatter` is structurally a thin wrapper delegating straight to `SeriesMarkers` plus this y-gradient addition.

### 2.6 CandlestickChart
Files: `candlestick-chart.tsx` (`CandlestickChart`, `CandlestickChartProps`, `OHLCDataPoint`), `candlestick.tsx` (`Candlestick`, `CandlestickProps`).
`OHLCDataPoint`: `{ date, open, high, low, close }` — **confirmed verbatim by direct read** of `candlestick-chart.tsx`. Single y-axis (`wrapSingleYScale`). Uses the shared `useChartInteraction` hook directly (passing `xScale`, `yScale`, `yScales: wrapSingleYScale(yScale)`, `data`, `lines`, `margin`, `xAccessor`, `bisectDate`, `canInteract: isLoaded`) — this is the clearest evidence that Candlestick reuses the exact same interaction mechanism as Area/Line/Composed, unlike Bar (own mouse handlers) or Scatter (own shell). **Known JSDoc/code mismatch — confirmed verbatim**: `CandlestickChartProps.animationDuration`'s JSDoc reads `/** Animation duration in milliseconds. Default: 1500 */`, but the destructured default in the `CandlestickChart` function signature is `animationDuration = 1100`. The JSDoc is stale; the effective default is 1100ms.
`ChartCore` (memo'd) applies `decimateOhlcData(data, maxRenderPointsForWidth(innerWidth))` from `decimate-time-series.ts` (the OHLC-preserving variant of the shared LTTB downsampler) via `useMemo(() => decimateOhlcData(data, maxRenderPointsForWidth(innerWidth)), [data, innerWidth])`. It also has its own local `isDefsComponent()` displayName-matching helper — an additional independent instance of the pattern flagged in §3.10.
`AnimatedCandle` (in `candlestick.tsx`) uses a spring-based `scaleY` transform-origin grow animation, default `{type: "spring", duration: 0.8, bounce: 0.15}` — a third animation system distinct from both the shared clip-reveal (`ChartRevealClip`) used by Area/Line/Composed/Scatter and the per-element stagger-delay grow used by Bar/SeriesBar. `WICK_WIDTH = 1.5`.

### 2.7 LiveLineChart
Files: `live-line-chart.tsx` (`LiveLineChart`, `LiveLineChartProps`, `LiveLinePoint`), `live-line.tsx` (`LiveLine`, `LiveLineProps`, `detectMomentum`, `Momentum`, `MomentumColors`), `live-x-axis.tsx` (`LiveXAxis`), `live-y-axis.tsx` (`LiveYAxis`).
Distinguishing feature: `detectMomentum()` classifies the recent trend direction (`Momentum`) and exposes `MomentumColors` so the line can recolor based on live trend — a feature with no equivalent in the other cartesian charts. Uses its own `LiveXAxis`/`LiveYAxis` rather than the shared `XAxis`/`YAxis` (append-only scrolling window semantics differ from a fixed-domain axis).

**Confirmed distinguishing details (direct read):**
- `LiveLinePoint = {time, value}`. Distinct margin default: `DEFAULT_MARGIN = {top: 24, right: 16, bottom: 32, left: 16}` — differs from every other cartesian chart's `{top:40,right:40,bottom:40,left:40}`.
- `LiveLineChartCore` constructs its `ChartProvider` value with **`isLoaded: true, animationDuration: 0`** — LiveLineChart does not participate in the shared reveal/phase-orchestrator animation system at all; there is no mount reveal.
- Bespoke rAF-driven interpolation loop (`nextAnimFrame()`): lerps y-domain min/max and the displayed value toward their targets at `LERP_SPEED = 0.08` per tick; only commits to React state via `startTransition` every `LIVE_FRAME_COMMIT_MS = 32` (~30fps) or when the scheduled-tooltip dedupe key changes — a distinct throttling strategy from `use-scheduled-tooltip.ts`'s RAF-coalescing used elsewhere.
- `contextData` includes **two virtual trailing data points** appended to the real series to make the live edge render smoothly mid-interpolation.
- `detectMomentum(data, dataKey, lookback=20)`: classifies `"up"|"down"|"flat"` by comparing the last-5-points delta against 12% of the lookback window's value range.
- `LiveLine`'s pulsing dot ring uses a native SVG `<animate>` element — not `motion`/framer-motion — a rare pure-SVG-animation exception in an otherwise motion-dominated codebase. The value badge (`motion.g`) dims to 0.25 opacity while scrubbing.
- Default curve is `curveMonotoneX` (matches `Area`, not `Line`'s `curveNatural`).

### 2.8 HeatmapChart

**`HeatmapChartProps`** (direct read of `heatmap/heatmap-chart.tsx`, full source, 729 lines):
| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `HeatmapColumn[]` | — | One entry per week/category column, each with row `bins` |
| `xDomain?` | `[Date, Date]` | — | Filters visible week columns |
| `sizingColumnCount?` | `number` | — | Stabilizes bin size while `xDomain` scrubs |
| `layout?` | `"fluid" \| "fill"` | `"fluid"` | `fluid` = square cells drive height (GitHub-style); `fill` = cells expand to fill parent |
| `margin?` | `Partial<Margin>` | `{top:28,right:16,bottom:0,left:40}` | |
| `binSize?` | `number` | `0` (auto-square-to-fit) | |
| `gap?` | `number` | `2` | |
| `colorScale?` | `(count) => string` | derived from `levelStyles` | |
| `levelColors?` / `levelStyles?` | level-color config | `HEATMAP_DEFAULT_LEVEL_COLORS`/`STYLES` | `levelStyles` takes precedence |
| `aspectRatio?` | `string` | — (fills parent if omitted) | |
| `status?` | `ChartStatus` | `"ready"` | |
| `loadingLabel?` | `string` | — | |
| `animationDuration?` | `number` | `HEATMAP_DEFAULT_ENTER_DURATION_MS` (1600, per prior-session finding) | |
| `enterTransition?` | `Transition` | `HEATMAP_DEFAULT_ENTER_TRANSITION` | |
| `revealSignature?` | `string` | `""` | |
| `enterStaggerScale?` | `number` | `1` | |
| `animate?` | `boolean` | `true` | |
| `loadingOpacity?` | `number` | `HEATMAP_LOADING_CHART_OPACITY` (0.5, per JSDoc) | |
| `showLoadingCells?` | `boolean` | `true` | |
| `loadingCellMaxOpacity?` / `loadingCellRandomness?` | `number` | `HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY` (0.5) / `_RANDOMNESS` (0.65) | |
| `columnSeparators?` | `HeatmapSeparatorParsedConfig` | — | Overridden by a `HeatmapSeparator` child if present |
| `weekStartDay?` | `HeatmapWeekStartDay` | `0` (Sunday) | Rotates column bins for display without reshaping data |
| `children` | `ReactNode` | — | `HeatmapCells`, `HeatmapXAxis`, `HeatmapYAxis` |

Confirmed to reuse the shared `chart-phase.ts` (`ChartPhase`/`ChartStatus`/`resolveRestingChartPhase`) and `ChartLoadingLabel` — its own `useHeatmapChartLifecycle()` hook independently re-implements a phase state machine (`revealing`→`ready`, `exitingReady`→`loading` with a `HEATMAP_LOADING_CONCEAL_MS` delay) rather than calling the shared `use-chart-phase-orchestrator.ts` used by the cartesian charts — a further distinct lifecycle implementation, not the same one documented in §3.1. Uses `@visx/responsive`'s plain `ParentSize` (no debounce arg, unlike most other charts' `debounceTime={10}`).

Barrel: `heatmap/` — very large export surface (§ visible in `index.ts` lines 213–284): `HeatmapChart`, `HeatmapChartProps`, `HeatmapCells`, `HeatmapProvider`/`useHeatmap`/`HeatmapContextValue`, `HeatmapXAxis`, `HeatmapYAxis` (+ `HeatmapYAxisLabelFormat`, `HeatmapYAxisTickFilter`), `HeatmapLegend` (+ `HeatmapLegendVariant` — its own legend, not the shared `Legend`/`ChartLegend` systems), `HeatmapTooltip`, `HeatmapSeparator`, `HeatmapInteractionProvider`/`HeatmapInteractionBoundary`.
Level/color system: `HeatmapLevelStyle`/`HeatmapLevelStyles`/`HeatmapLevelColors`/`HeatmapLevelFillMode`, `HEATMAP_DEFAULT_LEVEL_COLORS`, `HEATMAP_DEFAULT_LEVEL_STYLES`, `HEATMAP_LEGEND_LEVELS`, `resolveHeatmapLevelStyles`, `levelColorsFromStyles`/`levelStylesFromColors`, `heatmapLevelPatternId`/`isHeatmapLevelPattern` (pattern-fill support per level, reuses the shared `pattern-preset.tsx` system). Color scales: `buildHeatmapColorScale`, `buildHeatmapColorScaleFromStyles`, `buildHeatmapFillScale`, `defaultHeatmapColorScale`/`defaultHeatmapFillScale`.
Calendar-layout helpers: `getHeatmapCalendarRangeStart`/`inferHeatmapCalendarRangeStart`, `getHeatmapWeekStartSunday`/`getHeatmapWeekStartAlignedToRange`, `HeatmapWeekStartDay`, `getHeatmapWeekCount`, `getHeatmapTimeExtent`, `getHeatmapYearStartMonth`, `getHeatmapColumnMonthAnchor`, `getHeatmapSeparatorColumnIndices`, `HEATMAP_WEEKS_ONE_YEAR`, `HEATMAP_MONTHS_ONE_YEAR`/`HEATMAP_MONTHS_SIX`, `HEATMAP_DAY_LABELS`/`getHeatmapDayLabels`, `filterHeatmapColumns`, `shouldShowHeatmapYAxisTick`. This is the single largest and most self-contained chart subsystem in the package — its calendar-math utilities have no counterpart in any other chart and will need the most net-new logic in a TanStack port (a grid/canvas library will not supply GitHub-style calendar binning out of the box).

### 2.9 ChoroplethChart

**`ChoroplethChartProps`** (direct read of `choropleth/choropleth-chart.tsx`, full source, 513 lines):
| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `FeatureCollection<Geometry, ChoroplethFeatureProperties>` | — | GeoJSON |
| `margin?` | `Partial<Margin>` | `{top:0,right:0,bottom:0,left:0}` | |
| `animationDuration?` | `number` | `800` | |
| `enterTransition?` | `Transition` | — | |
| `revealSignature?` | `string` | — | |
| `aspectRatio?` | `string` | `"16 / 9"` | |
| `scale?` | `number` | auto: `(innerWidth / 630) * 100` | |
| `center?` | `[number, number]` | `[0, 20]` | |
| `translate?` | `[number, number]` | auto-centered | |
| `zoomEnabled?` | `boolean` | `false` | |
| `zoomMin?` / `zoomMax?` | `number` | `0.5` / `4` | |
| `initialZoom?` | `TransformMatrix` | identity matrix | |
| `className?` | `string` | `""` | |
| `children` | `ReactNode` | — | `ChoroplethFeature`, `ChoroplethGraticule`, `ChoroplethTooltip`, plus arbitrary HTML overlay children |

**Confirmed dependency (direct read, resolving the prior "likely/unverified" hedge)**: imports `Mercator` from **`@visx/geo`** for the projection, and `Zoom`/`TransformMatrix` from **`@visx/zoom`** for the continuous pan/zoom interaction — both confirmed by literal `import` statements. Children are split into `svgChildren`/`overlayChildren` via `isChoroplethSvgChild()` (checks against a `SVG_COMPONENT_TYPES` Set of literal component references first, then falls back to a `getComponentDisplayName()` string match against `SVG_COMPONENT_NAMES` — a hybrid of the "type reference" and "displayName string" detection strategies, distinct from every other chart's children-classification approach) and separately by whether the child is a known HTML tag name (`div`/`span`/`button`/`p`/`a`) vs. component. `zoomEnabled` wraps content in `@visx/zoom`'s `<Zoom>` render-prop component; wheel delta is custom-mapped (`deltaY>0 ? 0.95 : 1.05`) rather than using `@visx/zoom`'s default wheel handling.

Barrel (`choropleth/index.ts`) also exports: `ChoroplethProvider`/`useChoropleth`, `ChoroplethFeatureComponent` (+ `ChoroplethFeature`, `ChoroplethFeatureProperties`, `ChoroplethFeatureProps`), `ChoroplethGraticule`, `ChoroplethTooltip` (+ `ChoroplethTooltipData`), `useChoroplethZoom`, `defaultChoroplethColors`, `choroplethCssVars`.

### 2.10 SankeyChart

**`SankeyChartProps`** (direct read of `sankey/sankey-chart.tsx`, full source, 272 lines):
| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `SankeyData = {nodes: SankeyNodeDatum[], links: SankeyLinkDatum[]}` | — | Graph-shaped, not row/series-shaped |
| `margin?` | `Partial<Margin>` | `{top:40,right:180,bottom:40,left:180}` — much larger left/right than any cartesian chart, to fit node labels | |
| `animationDuration?` | `number` | `1100` | |
| `enterTransition?` | `Transition` | — | |
| `revealSignature?` | `string` | — | |
| `aspectRatio?` | `string` | `"2 / 1"` | |
| `nodeWidth?` | `number` | `16` | |
| `nodePadding?` | `number` | `24` | |
| `className?` | `string` | `""` | |
| `children` | `ReactNode` | — | `SankeyNode`, `SankeyLink`, `SankeyTooltip` |
| `hoveredNodeIndex?` / `onNodeHoverChange?` | controlled node hover | uncontrolled by default | Can be driven externally, e.g. from a `ChartLegend` |

**Confirmed dependency (direct read, resolving the prior "likely/unverified" hedge)**: imports `sankey`, `sankeyCenter`, `sankeyLinkHorizontal` from **`@visx/sankey`** (literal `import` statement) — this matches the prior session's Fork D finding that `@visx/sankey` is the runtime dependency and `d3-sankey` is only a type-only `@types/d3-sankey` devDependency (no runtime `d3-sankey` import exists in this file). The sankey generator is configured with `.nodeAlign(sankeyCenter)` and a fixed `.extent([[0,0],[innerWidth,innerHeight]])`; link paths are generated via `sankeyLinkHorizontal()` wrapped in a `try/catch` that silently falls back to an empty path string on failure. Data is defensively shallow-cloned (`{...node}`/`{...link}`) before being passed to the mutating `sankeyGenerator()` call, since `@visx/sankey`/d3-sankey mutates its input graph in place.

### 2.11 PieChart / RingChart
Files: `pie-chart.tsx` (`PieChart`, `DEFAULT_HOVER_OFFSET`), `pie-context.tsx` (`PieProvider`, `usePie`/`usePieHover`/`usePieStable`, `PieArcData`, `PieData`, `defaultPieColors`, `pieCssVars`), `pie-slice.tsx` (`PieSlice`, `PieSliceHoverEffect`), `pie-center.tsx`/`pie-center-shell.tsx` (`PieCenter`, `PieCenterShell` — reused by `Gauge`), `ring-chart.tsx`, `ring-context.tsx` (parallel provider/hooks), `ring.tsx` (`Ring`, `RingLineCap`), `ring-center.tsx`.
`PieChart`/`RingChart` share the same context-provider shape (`*Provider`/`use*`/`use*Hover`/`use*Stable` triplet — the same "stable vs hover context split" pattern used by `useChartHover`/`useChartLegendHover` elsewhere) and both center their stat display through `PieCenterShell` + `ChartStatFlow` (number-flow-driven animated value, `chart-stat-flow.tsx`). `DEFAULT_HOVER_OFFSET = 10` governs the radial pop-out distance on slice hover.

**`PieChartProps`** (direct read of `pie-chart.tsx`, full source, 530 lines):
| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `PieData[]` | — | Each item is a slice |
| `size?` | `number` | uses `ParentSize` if omitted | Fixed chart size in px |
| `innerRadius?` | `number` | `0` | Donut hole (0 = solid pie) |
| `padAngle?` | `number` | `0` | Radian gap between slices |
| `cornerRadius?` | `number` | `0` | Rounded slice corners |
| `startAngle?` / `endAngle?` | `number` | `-PI/2` / `3*PI/2` | Arc sweep (top-start, full circle) |
| `className?` | `string` | `""` | — |
| `hoveredIndex?` / `onHoverChange?` | `number \| null` / callback | uncontrolled if omitted | Controlled slice hover |
| `hoverOffset?` | `number` | `DEFAULT_HOVER_OFFSET=10` | Hover pop-out distance; also pads the chart to avoid clipping |
| `children` | `ReactNode` | — | `PieSlice`, `PieCenter`, gradients/patterns |
| `enterTransition?` | `Transition` (motion) | — | Slice enter animation |
| `enterStaggerScale?` | `number` | `1` | Stagger delay multiplier |
| `geometryScrubbing?` | `boolean` | `false` | Studio-scrub mode: renders plain static SVG paths instead of Motion `d`/spring morphing (bypasses `PieSlice` children entirely, drawing scrub paths directly) |

Uses `d3-shape`'s `pie()` generator (`.sort(null)` to preserve data order) and `@visx/shape`'s `arc()` for path generation. Children are partitioned into `svgChildren`/`centerChildren`/`defsChildren` via a local `isPieCenter()`/`isDefsComponent()` displayName-matcher (yet another independent instance of the pattern in §3.10) — HTML `PieCenter` content and SVG slice content are stacked via **CSS Grid** (`gridTemplateColumns/Rows: "1fr"`, both layers at `gridArea: "1 / 1"`), explicitly to avoid Safari's `foreignObject` positioning bug (WebKit #23113) rather than nesting HTML inside an SVG `foreignObject`. `RingChartProps` mirrors this almost exactly, adding `strokeWidth=12`, `ringGap=6`, `baseInnerRadius=60`, and an auto-scaling `scale` factor so all rings fit the available radius; same CSS-Grid-over-foreignObject-bug workaround.

### 2.12 RadarChart
Files: `radar-chart.tsx`, `radar-context.tsx` (`RadarProvider`, `useRadar`/`useRadarHover`/`useRadarStable`, `RadarData`, `RadarMetric`, `defaultRadarColors`, `radarCssVars`), `radar-area.tsx` (`RadarArea`), `radar-axis.tsx` (`RadarAxis`), `radar-grid.tsx` (`RadarGrid`), `radar-labels.tsx` (`RadarLabels`). Polar-coordinate composition mirroring the cartesian `<Area><XAxis/><YAxis/><Grid/></Area>` shape but with per-metric polar axes (`RadarAxis`) and a polar grid (`RadarGrid`) instead of cartesian ones.

**`RadarChartProps`** (direct read of `radar-chart.tsx`, full source, 263 lines):
| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `RadarData[]` | — | One entry per polygon/series |
| `metrics` | `RadarMetric[]` | — | Axis/spoke definitions |
| `size?` | `number` | `ParentSize`-driven if omitted | |
| `levels?` | `number` | `5` | Concentric grid circles |
| `margin?` | `number` | `60` | Uniform margin (not a `Margin` object — single number) |
| `animate?` | `boolean` | `true` | |
| `enterDurationMs?` | `number` | `1100` | |
| `staggerScale?` | `number` | `1` | |
| `enterTransition?` | `Transition` | — | |
| `motionReplayKey?` | `string` | `""` | Changing it replays enter animation |
| `hoveredIndex?` / `onHoverChange?` | controlled hover | uncontrolled by default | |
| `className?` | `string` | `""` | |
| `children` | `ReactNode` | — | `RadarGrid`, `RadarAxis`, `RadarLabels`, `RadarArea` |

Value-to-radius scale is always `scaleLinear({range:[0, radius], domain:[0, 100]})` — i.e., **RadarChart's radial scale is hardcoded to a 0–100 domain**, not derived from the data's actual min/max like the cartesian charts' y-domains. First axis is always rotated to the top (`angleOffset = -PI/2`). Renders a single bare `<svg>` (no `ParentSize`-measured inner width/height split, no `ChartRevealClip`, no phase orchestrator) with a `<Group>` centered at `size/2, size/2`; children receive geometry via `getPointPosition(metricIndex, value)` from context.

### 2.13 SunburstChart
Files: `sunburst-chart.tsx`, `sunburst/` geometry barrel (`ArcDatum`, `ArcGeometry`, `arcPath`, `buildArcs`, `buildRevealDelays`, `buildRevealSchedule`, `buildSunburstEnterTiming`, `SunburstEnterTiming`, `centroidAngle`/`geomCentroidAngle`/`geomCentroidRadius`, `clockwiseFraction`, `defaultSunburstGrowPadding`, `Focus`, `geometryFor`/`lerpGeometry`/`transitionGeometry`, `localProgress`, `ringOptions`, `segmentRevealFromRingSweep`, `SunburstRevealSchedule`, `SunburstSegmentEnterDelays`, `sumValues`), `sunburst-context.tsx` (`useSunburstHover`/`useSunburstStable`, `defaultSunburstColors`, `opacityForRelativeDepth`, `sunburstCssVars`), `sunburst-segment.tsx`, `sunburst-labels.tsx`, `sunburst-hint.tsx`, `sunburst-breadcrumb.tsx` (`useSunburstBreadcrumbItems`), `sunburst-center.tsx`, `sunburst-data.ts` (`SunburstNode` type only).
By far the largest dedicated geometry module of any chart (14+ exported helpers) — zoom/drill-down uses imperative `animate()`-based ring transitions (`transitionGeometry`/`lerpGeometry`) rather than the shared `useAnimatedSeriesPath`/`useMountProgress` primitives used elsewhere, and its reveal stagger (`buildRevealDelays`/`buildRevealSchedule`/`segmentRevealFromRingSweep`) is a bespoke per-ring-sweep formula distinct from every other chart's stagger math.

**`SunburstChartProps`** (direct read of `sunburst-chart.tsx`, full source, 489 lines):
| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `SunburstNode` | — | Hierarchical tree root |
| `size?` | `number` | `520` | |
| `playKey?` | `number` | `0` | Bump to replay init animation |
| `className?` | `string` | — | |
| `focusId?` / `onFocusChange?` | controlled drill-down focus | uncontrolled by default (internal state seeded to root) | |
| `hoveredIndex?` / `onHoverChange?` | controlled arc-index hover | uncontrolled by default | |
| `hoverPop?` | `number` | `DEFAULT_HOVER_POP=8` | |
| `padding?` | `number` | derived via `defaultSunburstGrowPadding(maxDepth, size, hoverPop)` | Reserved inset for hover growth |
| `enterTransition?` | `Transition` | — | |
| `enterStaggerScale?` | `number` | `1` | |
| `children` | `ReactNode` | — | `SunburstSegment`, `SunburstBreadcrumb`, `SunburstHint`, gradients/patterns |

Confirmed mechanics: children are partitioned via a local `isDefsComponent()` (identical implementation to `pie-chart.tsx`'s and `candlestick-chart.tsx`'s — a further independent instance of §3.10's fragility) into `defsChildren`/`outsideChildren` (`SunburstBreadcrumb`, `SunburstHint` — rendered as HTML siblings, outside the `<svg>`) /`svgChildren`; segments are re-sorted so **inner rings render last** (`sortSunburstSegments` — parent segments must win hit-testing at ring boundaries). Zoom/drill-down (`zoomTo`) and hover-grow (`buildHoverGrowTargets`) are both driven by raw `motion`'s imperative `animate(0, 1, {...})` writing into a `useRef<Map>` + a `growTick` counter to force re-reads, rather than React state directly — explicitly bypasses `prefers-reduced-motion` via `window.matchMedia` checks at multiple call sites. `SunburstChart` itself is a wrapper around a `memo`'d `SunburstChartCore` and takes **no `ParentSize`/responsive-container step** — it renders at a fixed `size` (default 520) inside a `div` with `aspectRatio: "1/1"`.

### 2.14 Gauge
Files: `gauge.tsx` (`Gauge`, `GaugeProps`, `GaugeOrientation`), `gauge-label-layout.ts` (`GaugeLabelAlign`, `GaugeLabelPlacement`), `notch-gauge-shared.ts` (`ComputedNotch`, `createNotchPath`, `collectGaugeDefsElements`, `interpolateGaugeHex`, `resolveGaugeActiveFill`/`resolveGaugeBgFill`, default fill-opacity/gradient constants). Reuses `PieCenterShell` (§2.11) for its numeric center label rather than a bespoke implementation — confirms Gauge is architecturally a constrained/clipped Pie/Ring variant, not an independent radial chart.

**`GaugeProps`** (direct read of `gauge.tsx`, full source, 739 lines) — **no `children`-as-config composition; Gauge is a single flat props object**, unlike every other chart in the package:
| Prop | Type | Default | Description |
|---|---|---|---|
| `orientation?` | `"arc" \| "linear"` | `"arc"` | Two entirely different rendering paths (`GaugeArcInner` vs `GaugeLinearInner`) |
| `value` | `number` | — | 0–100 fill level |
| `totalNotches?` | `number` | `40` | |
| `spacing?` | `number` | `25` | % of track reserved for gaps |
| `notchCornerRadius?` | `number` | `0` | |
| `uniformWidth?` | `boolean` | `false` (arc) / `true` (linear) | Rectangular vs. tapered notches |
| `startAngle?` / `endAngle?` | `number` | `135` / `405` (arc only) | |
| `useGradient?` | `boolean` | `false` | |
| `activeGradient?` / `inactiveGradient?` | `readonly [string,string]` | `DEFAULT_ACTIVE_GRADIENT` | |
| `centerValue?` | `number` | — | Omit to hide the label block entirely |
| `defaultLabel?` | `string` | `"Total"` | |
| `prefix?` / `suffix?` | `string` | — | |
| `formatOptions?` | `ChartStatFlowFormat` | `defaultChartStatFlowFormat` | |
| `labelPlacement?` | `GaugeLabelPlacement` | `"top"` (linear only; arc always overlays center) | |
| `labelAlign?` | `GaugeLabelAlign` | `"start"` | |
| `inactiveFill?` / `activeFill?` | `string` | — | |
| `inactiveFillOpacity?` / `activeFillOpacity?` | `number` | `DEFAULT_INACTIVE_FILL_OPACITY` / `DEFAULT_ACTIVE_FILL_OPACITY` | |
| `children?` | `ReactNode` | — | Only used to collect defs elements (`collectGaugeDefsElements`) — not a config-composition API |
| `width?` / `height?` / `minWidth?` | `number` | `minWidth` default `200` (linear) / `300` (arc) | |
| `notchLengthPercent?` | `number` | `100` | |
| `notchWidthPercent?` | `number` | `80` (linear only) | |
| `linearHeight?` | `number` | `DEFAULT_LINEAR_GAUGE_HEIGHT` | |
| `enterTransition?` | `Transition` | `DEFAULT_NOTCH_ENTER_TRANSITION = {type:"spring", stiffness:300, damping:20}` | |
| `enterStaggerScale?` | `number` | `1` (clamped 0.25–2.5) | |
| `geometryScrubbing?` | `boolean` | `false` | Static paths while scrubbing, same pattern as Pie/Sunburst |

Notch geometry is entirely custom polygon math (`createNotchPath` builds a 4-point quad per notch, optionally corner-rounded) — no `@visx/shape` arc generator used for the arc variant's notches (unlike Pie/Ring, which do use `@visx/shape`'s `arc()`). Respects `useReducedMotion()` (duration forced to 0). Both orientations render two independent `motion.path` passes per notch (background pass + active-only pass), each with its own per-index stagger delay.

### 2.15 FunnelChart
File: `funnel-chart.tsx` (`FunnelChart`, `FunnelChartProps`, `FunnelStage`, `FunnelGradientStop`). Architectural outlier: does not participate in the `ChartProvider`/`useChart` cartesian-or-radial context family at all — it is effectively a standalone stacked-trapezoid layout with its own gradient-stop model (`FunnelGradientStop`), confirming it needs the most bespoke migration treatment of any chart (no shared axis/grid/tooltip context to lean on).

**`FunnelChartProps`** (direct read of `funnel-chart.tsx`, full source, 1042 lines — the single largest per-chart file read this session):
| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `FunnelStage[]` | — | `{label, value, displayValue?, color?, gradient?: FunnelGradientStop[]}` |
| `orientation?` | `"horizontal" \| "vertical"` | `"horizontal"` | |
| `color?` | `string` | `"var(--chart-1)"` | |
| `layers?` | `number` | `3` | Concentric "halo ring" count per segment |
| `className?` / `style?` | — | — | |
| `showPercentage?` / `showValues?` / `showLabels?` | `boolean` | all `true` | |
| `hoveredIndex?` / `onHoverChange?` | controlled hover | uncontrolled by default | |
| `formatPercentage?` / `formatValue?` | function | `fmtPct` (`${Math.round(p)}%`) / `intFmt` | |
| `staggerDelay?` | `number` | `0.12` (seconds) | |
| `enterTransition?` | `Transition` | — | |
| `gap?` | `number` | `4` (px) | |
| `renderPattern?` | `(id, color) => ReactNode` | — | Render-prop for a `<defs>` pattern on the innermost ring |
| `edges?` | `"curved" \| "straight"` | `"curved"` | |
| `labelLayout?` | `"spread" \| "grouped"` | `"spread"` | |
| `labelOrientation?` | `"vertical" \| "horizontal"` | inferred from chart orientation | |
| `labelAlign?` | `"center" \| "start" \| "end"` | `"center"` | |
| `grid?` | `boolean \| {bands?, bandColor?, lines?, lineColor?, lineOpacity?, lineWidth?}` | `false` | |

No `ChartProvider`, no `ParentSize` (uses a raw `ResizeObserver` + `getBoundingClientRect` on its own ref), no phase orchestrator, no shared axes/grid/tooltip. It does reuse two shared, chart-context-independent primitives — `useMountProgress` (`use-mount-progress.ts`) and `useEnterComplete` (`use-enter-complete.ts`, not opened this session) — for its per-segment entrance animation, but every geometry helper (`hSegmentPath`/`vSegmentPath` cubic-Bezier trapezoid paths) and every hover animation (per-ring `motion.path` spring scale, stiffness/damping decreasing per ring index) is otherwise self-contained to this one file. Confirms FunnelChart is the most standalone top-level chart in the package.

---

## 3. Inner components & shared infrastructure

### 3.1 Phase / reveal / lifecycle machine
- **`chart-phase.ts`** (54 lines): `ChartPhase = "loading" | "exiting" | "gridTweenReady" | "revealing" | "ready" | "exitingReady" | "gridTweenLoading" | "revealingLoading"`; `ChartStatus = "loading" | "ready"`; `DEFAULT_Y_DOMAIN_TWEEN_MS = 500`; `Y_DOMAIN_TWEEN_SKIP_THRESHOLD = 0.02`; `resolveRestingChartPhase()`; `isChartInteractionPhase()` (only `"ready"` is interactive — tooltips/hover/brush are disabled during every other phase). Used by essentially every chart.
- **`use-chart-phase-orchestrator.ts`** (184 lines): the central state machine. Owns `chartPhase`, `plotData` (skeleton vs. real target data), `revealEpoch`/`concealEpoch` (bump counters that retrigger reveal/conceal animations), `isLoaded`. Transition sequence ready→loading: `exitingReady` (waits for `notifyRevealConcealComplete`) → `gridTweenLoading` (waits for `notifyYDomainTweenComplete`) → `loading`. loading→ready: `exiting` (waits for `notifyLoadingPulseComplete`) → `gridTweenReady` → `revealing` (`window.setTimeout(animationDuration)`) → `ready` + `isLoaded=true`. Handles `animationDuration<=0` fast paths and `revealSignature`-triggered replays (skippable via `skipEnterReveal`). Used by every cartesian chart (Area/Bar/Line/Composed/Scatter/Candlestick).
- **`animation.ts`** (37 lines): `DEFAULT_ANIMATION_EASING = "cubic-bezier(0.85, 0, 0.15, 1)"`, `DEFAULT_ANIMATION_DURATION_MS = 1100`, `DEFAULT_CHART_ENTER_TRANSITION` (framer-motion tween, 1.1s, ease `[0.85,0,0.15,1]`), `clipRevealTransition()` (forces `type:"tween"` since spring cannot reliably animate SVG width for clip-reveal). Re-exported publicly from `index.ts`.
- **`chart-reveal-clip.tsx`** (93 lines): `ChartRevealClip` — left-to-right clip-path grow/shrink reveal for cartesian series, `mode: "reveal"|"conceal"`, via `<motion.rect>` width/x animation keyed by `revealEpoch` (framer-motion). Used by Area, Line, Bar, Scatter series layers.
- **`use-mount-progress.ts`** (30 lines) / (`useMountProgress`, referenced from Pie/Ring/Radar/Sunburst/Funnel): drives a `useMotionValue(0)` 0→1 via imperative `animate()` with `delaySeconds`, retriggered by `replayKey` (number or string) — the shared enter-progress primitive for radial charts.
- **`use-animated-series-path.ts`** (166 lines): `useAnimatedSeriesPath` — smooths path *data-transitions* (not just entrance reveal): snapshots `displayedPointsRef`, animates 0→1 progress imperatively, recomputes target points and interpolates every frame (`interpolateSeriesPathPoints`) to track a moving target (e.g., mid-flight y-domain retween). Gated on `chartPhase==="ready"`, `durationMs>0`, `!reducedMotion`. Used by Line (and Composed's line layer).

### 3.2 Axes, grid, background
- **`grid.tsx`** (318 lines): `Grid`/`GridProps` — wraps `@visx/grid`'s `GridRows`/`GridColumns`; horizontal/vertical toggle; tick-count vs. explicit `rowTickValues`; edge-line hiding; `highlightRowValues` (e.g. zero baseline with alternate stroke); horizontal/vertical fade masks; **shimmer band** (`shimmer`, `shimmerStroke`, `shimmerLength=140`, `shimmerSpeed`, `shimmerSync`) — a second overlaid `GridRows` stroked with `url(#shimmer-gradient)`, driven by `useGridShimmer`, gated by `isLoadingChromePhase(chartPhase)`. Swaps `columnScale`↔`yScale` when the parent is a horizontal bar chart.
- **`use-grid-shimmer.ts`** (112 lines): drives a `useMotionValue` progress loop via imperative `animate()`; respects `useReducedMotion()`; `oneShot` (half-cycle, for synced loading→ready handoff) vs. `shimmerSync` (full synced cycle with `LINE_LOADING_LOOP_PAUSE_MS=280` gap) vs. default infinite repeat. Cycle length = `LINE_LOADING_PULSE_CYCLE_S / max(shimmerSpeed,0.1)`.
- **`background.tsx`** (220 lines): `Background`/`BackgroundProps` — plot-area pattern-fill layer rendered behind series, pattern via shared `renderPatternPreset`, dual independent fade masks (horizontal + vertical, combinable via mask-on-mask `<g mask=...>`), 420ms enter fade (`BACKGROUND_ENTER_FADE_MS`), gated by `isLoaded`.
- **`x-axis.tsx`** (`XAxis`/`XAxisProps`) — read in a prior session in this same task; content is too large to re-surface verbatim in this window. **Do not fabricate its exact prop table**; re-open this file before relying on X-axis prop defaults during migration.
- **`y-axis.tsx`** (172 lines, `YAxis`/`YAxisProps`): props `yAxisId?`, `orientation?: "left"|"right"` (default `"left"`), `numTicks?` (default `Y_AXIS_DEFAULT_TICK_COUNT=5`, clamped via `resolveYAxisTickCount`), `formatLargeNumbers?: boolean` (default `true`, renders `${v/1000}k` for ≥1000), `formatValue?: (value:number)=>string` (overrides `formatLargeNumbers`). Mount-gated, portal-rendered into `containerRef` (via `createPortal`, HTML div overlay, not inline SVG). Ticks positioned with CSS `transition: top ${DEFAULT_Y_DOMAIN_TWEEN_MS}ms cubic-bezier(...)` for smooth y-domain retweening. Supports per-tick `labelColor` override sourced from `ReferenceArea.axisLabelColor` via `resolveTickLabelColor()` (checks whether the tick's y-pixel falls inside a registered reference-area band on the matching `yAxisId`).
- **`y-axis-scales.ts`** (116 lines): `DEFAULT_Y_AXIS_ID = "left"`; `normalizeYAxisId()`; `groupLinesByYAxisId()`; `getPrimaryYScale()`; `buildYScalesForLines()` (resolves per-axis-group domains via a caller-supplied `resolveDomain`, `nice:true`); `buildYScalesFromDomains()` (builds from pre-computed/nice'd domains, no y-domain fallback nicing); `wrapSingleYScale()` (single-axis charts: Bar, Scatter, Candlestick, LiveLine).
- **`y-axis-ticks.ts`** (27 lines): `Y_AXIS_DEFAULT_TICK_COUNT=5`, `Y_AXIS_MIN_TICK_COUNT=1`, `Y_AXIS_MAX_TICK_COUNT=10`, `resolveYAxisTickCount()` clamp helper.
- **`y-domain-utils.ts`**: exported from `index.ts` (`computeYDomainsByAxis`, `isLoadingChromePhase`, `isYDomainTweenPhase`, `mergeYDomainRecords`, `niceYDomain`, `shouldTweenYDomain`, `YDomain`) — referenced by `grid.tsx` and `reference-area.tsx` for phase-gating logic; file itself not opened this session, so its internal implementation is not independently verified here (only its call sites' usage is).

### 3.3 Formatters, scale vars
- **`chart-formatters.ts`** (21 lines): `shortDateFmt`, `weekdayDateFmt`, `hmsTimeFmt` (all `Intl.DateTimeFormat` instances), `intFmt = Intl.NumberFormat("en-US").format` (bound getter).
- **`chart-scale.ts`** (20 lines): `CHART_SCALE_VARS` — 5 sequential CSS custom-property names (`--chart-scale-01`…`05`) used by heatmap/choropleth/binned-data color ramps, plus `chartScaleCssVars.patternColor`.

### 3.4 Tooltip system
Barrel export from `tooltip/`: `ChartTooltip`/`ChartTooltipProps`, `DateTicker`/`DateTickerProps`, `IndicatorWidth`, `TooltipBox`/`TooltipBoxProps`, `TooltipContent`/`TooltipContentProps`, `TooltipDot`/`TooltipDotProps`, `TooltipIndicator`/`TooltipIndicatorProps`, `TooltipRow`.
- `TooltipContent` (`tooltip/tooltip-content.tsx`, 63 lines, full source read this session): renders the row list (`TooltipRow[]`) inside the box — label/value/color-swatch layout, dot indicator per row.
- `TooltipBox` is portal-rendered (same portal-into-container pattern as `YAxis`); its motion/spring behavior is resolved via `resolveTooltipBoxMotion` from `chart-config-context.tsx`.
- `TooltipIndicator` supports fade-gradient crosshair edges via `indicator-fade.ts`: `IndicatorFadeEdges = "both"|"none"|"top"|"bottom"`, `resolveVerticalFadeSides()`, `indicatorFadeGradientStops()` (2–40% clamped fade length).
- **`use-scheduled-tooltip.ts`** (98 lines): `useScheduledTooltip`/`scheduleTooltip(tooltip, dedupeKey?)` — RAF-batched, dedupe-keyed tooltip state setter that coalesces rapid pointermove updates into one `requestAnimationFrame`; default dedupe key is `${index}:${roundedX}` to skip redundant state writes. This is the "scheduled tooltips" mechanism named in the interactivity requirements (§4).

### 3.5 Legend system (three overlapping implementations)
1. **`chart-legend.tsx`** — `ChartLegend`/`ChartLegendProps`/`LegendItem` (data type), explicitly commented in `index.ts` as the "Legacy legend component (backward compatibility)".
2. **`legend/`** barrel — the current composable system: `Legend`, `LegendItem` (component, aliased on export as `LegendItemComponent` to avoid colliding with the legacy `LegendItem` type), `LegendLabel`, `LegendMarker`, `LegendProgress`, `LegendValue`, plus context (`LegendContextValue`, `LegendItemContextValue`, `useLegend`/`useLegendItem`), `legendCssVars`.
3. **`chart-legend-hover.tsx`** — `ChartLegendHoverProvider`/`useChartLegendHover`, a hover-sync context consumed independently by both legend implementations and by series components (`SeriesHoverDim`, `SeriesMarkersDimWrapper`) so hovering a legend entry dims the corresponding series — decoupled from which legend UI is actually rendered.
4. **`profit-loss-legend.tsx`**/**`profit-loss-legend-hover.tsx`** — a fourth, narrowly-scoped legend+hover-context pair specific to `ProfitLossLine` (own `ProfitLossLegendHoverProvider`/`useProfitLossLegendHover`, same safe-fallback-context pattern as `useChartLegendHover`), not built on the `legend/` composable system.

### 3.6 Reference areas
- **`reference-area.tsx`** (286 lines): `ReferenceArea`/`ReferenceAreaProps`/`ReferenceAreaStrokeStyle` — registers itself via `useReferenceAreaRegistration()` (`reference-area-registration-context.tsx`, 17 lines) so `YAxis` can look up per-band label colors. Supports pattern fill (`renderPatternPreset`), solid `fill`, dashed/solid stroke edges, edge-fade mask, bidirectional bracket markers (`showMarkers`), `ifOverflow` clipping, entrance fade gated by `isReferenceAreaVisiblePhase(chartPhase)`.
- **`reference-area-geometry.ts`**: `computeReferenceAreaRect`, `ReferenceAreaIfOverflow`, `ReferenceAreaRect`, `resolveReferenceDataRange` (used by `y-axis.tsx` for label-color banding).
- **`reference-area-config.ts`** (69 lines): `extractReferenceAreaConfigs` — walks chart children (recursively, including nested `children` props) matching by `displayName`/`name === "ReferenceArea"` string check, to collect configs for `YAxis` label-color purposes. **Fragile name-string-matching pattern** — see §3.10.

### 3.7 Brush / zoom system (5 files)
- **`chart-brush.tsx`** (344 lines): `ChartBrush`/`ChartBrushProps` (`onSelectionChange`, `brushDirection: "horizontal"|"vertical"|"both"`, `selectedBoxStyle`, `initialSelection`, `selection`, `useWindowMoveEvents=true`, `blurPx`, `fadeOuterEdges`, `selectionPattern`). Wraps `@visx/brush`'s `Brush` (type-cast via `unknown` due to a type mismatch). Gated on `isLoaded && innerWidth>0 && innerHeight>0`.
- **`chart-brush-layout.tsx`** (124 lines): `ChartBrushLayout`/`ChartBrushLayoutProps`/`ChartBrushLayoutState` — higher-level layout wrapper (`data`, `xDataKey="date"`, `xExtentMax`, `enabled`, `height`, `fitMainContent=false`, render-prop `children`/`brushStrip`), decoupled from `ChartBrush` itself; composes a "brush strip" (mini chart + brush) below a main chart. Uses `resolveBrushTrackXExtent` from `filter-data-by-x-domain.ts` (referenced, not directly opened this session).
- **`chart-brush-track-overlay.tsx`** (142 lines): `ChartBrushTrackOverlay` — backdrop-blur dimming panes outside the selection (`blurPx` 0–5, `fadeOuterEdges` masks at `BRUSH_TRACK_OUTER_FADE=0.15`), portal-rendered, z-index 1.
- **`chart-brush-selection-overlay.tsx`** (110 lines): `ChartBrushSelectionOverlay` — optional pattern fill inside the selection window, portal-rendered, z-index 1.
- **`chart-brush-handle.tsx`** (117 lines): `renderChartBrushHandle()` (invisible hit-rect with `ew-resize`/`ns-resize` cursor), `ChartBrushHandleOverlay` (visible `24×4px` resize-pill handles matching shadcn's `ResizableHandle`, portal-rendered, z-index 2).
All three overlay components render via `createPortal` into the chart's HTML container div (not inside the SVG) — a portal pattern shared with `YAxis` and `TooltipBox`.

### 3.8 Markers (two separate systems)
- **Series point markers** — `series-markers.tsx` (295 lines: `SeriesMarkers`/`SeriesMarkersProps`, `SeriesMarkersDimWrapper`, `SeriesMarkersActiveHighlight`) + `series-point-marker.tsx` (210 lines: `StaticSeriesPointMarker`, `SeriesPointMarker`, `MarkerCircles`, `getSeriesMarkerVisualExtent`). Per-data-point circle markers for scatter-like series; clip-reveal-synced enter delay (`revealDelay` computed from `leadingEdge/innerWidth * revealDurationSec`); `SeriesMarkersDimWrapper` internally subscribes to `useChartHover`+`useChartLegendHover` so the parent stays on a stable context slice; `SeriesMarkersActiveHighlight` renders an enlarged (1.35×) active dot on top of the hovered point.
- **Annotation/event markers** — `markers/chart-markers.tsx` (215 lines: `ChartMarkers`/`ChartMarkersProps`, `MarkerTooltipContent`, `useActiveMarkers`) + `markers/marker-group.tsx` (521 lines: `MarkerGroup`/`MarkerGroupProps`). Icon-in-circle event/annotation markers grouped by date, with fan-out-on-hover (`FAN_ANGLE=160°`, `FAN_RADIUS=50px`), portaled HTML divs for the fanned circles (real click/href behavior via `MarkerCircleHTML`) separate from the always-visible collapsed SVG `MarkerCircle` (`foreignObject`-embedded icon). `MarkerTooltipContent` caps at `MAX_TOOLTIP_MARKERS=2` then shows "+N more...". Sets a static `__isChartMarkers` flag consumed by `chart-child-passthrough.ts` to render markers after the interaction overlay (so they stay clickable).

### 3.9 Loading / skeleton system
- **`chart-phase.ts`**'s `LoadingStyle` type gates two entirely different loading visualizations, selected per-series via each chart's `loadingStyle` prop:
  - **`"pulse"`** — `line-loading-pulse.tsx` (219 lines): `LineLoadingPulseStroke` — a clip-path-driven grow-then-shrink traveling stroke segment, three modes (`loop`/`exit`/`enter`), synced to `LINE_LOADING_PULSE_CYCLE_S=2.2s` (`line-loading-timing.ts`, 14 lines: also `LINE_LOADING_LOOP_PAUSE_MS=280`, `LOADING_LABEL_EXIT_S=0.45`, `LOADING_LABEL_EXIT_Y_PX=30`, `LINE_LOADING_PULSE_EASE=[0.85,0,0.15,1]` — the same ease as `DEFAULT_CHART_ENTER_TRANSITION`), reports completion via `onCycleComplete`/`notifyLoadingPulseComplete` back to the phase orchestrator.
  - **`"sweep"`** — `loading-sweep.tsx` (489 lines): `LineLoadingSweep` (line/area silhouette) and `BarLoadingSkeleton` (bar-shaped variant, `baseline: "bottom"|"center"`). Diagonal shimmer band traveling across a self-contained, deterministically-hashed, re-randomizing skeleton silhouette (own curve via `@visx/shape`'s `AreaClosed`/`LinePath`; heights via `hashFract()`, explicitly not `Math.random()`, to avoid SSR/client hydration mismatch), built with SVG `<pattern>`+`<mask>`. Re-randomizes only between full sweep passes (`onSweepComplete`), holding the silhouette steady mid-sweep. Respects `useReducedMotion()` (static silhouette, no mask/animation).
- **`chart-loading-label.tsx`** (57 lines): `ChartLoadingLabel` — centered "Loading" text using `ShimmeringText` (not itself read), exit animation (`y+30px`, opacity 0, blur 2px) timed to `LOADING_LABEL_EXIT_S`.
- **`generate-chart-skeleton-data.ts`** (43 lines): `generateChartSkeletonData()` (deterministic sine-wave placeholder series, 7 points default, seeded off index) and `generateChartSkeletonFromTarget()` (skeleton mirroring real target dates/count at lower magnitude, used for the y-domain-tween skeleton).

### 3.10 Cross-cutting layering, defs, and pattern systems
- **`chart-child-passthrough.ts`** (118 lines): the authoritative "which layer renders where" classification for cartesian chart composition — `CHART_CLIP_PASSTHROUGH` (marker for wrapper components whose child inherits clip classification), `CLIP_EXCLUDED_COMPONENT_NAMES` (Background, Grid, XAxis, YAxis, Bar/LiveX/YAxis variants — excluded from the series reveal clip), `UNDERLAY_COMPONENT_NAMES` (ReferenceArea, BarColumnTrack — above grid/axes, below series), `isPostOverlayComponent()` (ChartMarkers, MarkerGroup, ChartBrush, or any component flagged `__isChartMarkers`/`__isPostOverlay` — rendered after the interaction overlay), `forEachChartChild()` (flattens Fragments while walking children).
- **`chart-defs.ts`** (73 lines): detects `<defs>`-worthy children (patterns/gradients) via `isPatternDefComponent`/`isGradientDefComponent`, matching by name-substring against `VISX_PATTERN_COMPONENT_NAMES = {Lines,Circles,Waves,Hexagons,Path,Pattern}` or `*Gradient*`; `partitionChartDefNodes()` splits self-wrapping pattern-defs from gradient-defs.
- **`pattern-preset.tsx`** (187 lines): the central shared pattern system used by `Background`, `ReferenceArea`, and `ChartBrushSelectionOverlay` alike. `PATTERN_PRESET_IDS = ["none","diagonal","horizontal","vertical","cross","dots","circles","accent"]`; built on `@visx/pattern`'s `PatternLines`/`PatternCircles` via an internal `./visx-pattern` wrapper (itself re-exported publicly as `PatternCircles`/`PatternHexagons`/`PatternLines`/`PatternWaves`); `renderPatternPreset()` is the single entry point; `patternPresetTileSize()` gives per-preset tile sizing; `isCirclePattern`/`isCirclesPattern` and `dotFill` distinguish dot-vs-hollow-dot rendering.
- **Systemic pattern to flag for migration**: at least **five or six** independent, ad hoc "walk children and match by displayName/name string" implementations exist side by side, confirmed by direct reads across the full chart roster (not just the cartesian family): `reference-area-config.ts` (simple, no Fragment/passthrough unwrapping), `projection-config.ts` (Fragment + `isChartClipPassthrough` unwrapping, most thorough of the group), `chart-defs.ts`'s def-detection (substring matching against a hardcoded component-name set), `candlestick-chart.tsx`'s local `isDefsComponent()`, `pie-chart.tsx`'s local `isDefsComponent()` (near-identical logic to Candlestick's, independently re-implemented rather than shared), and `sunburst-chart.tsx`'s local `isDefsComponent()` (also near-identical). `choropleth-chart.tsx`'s `isChoroplethSvgChild()` is a further, distinct variant — a hybrid that checks a `Set` of literal component-type references first and only falls back to displayName-string matching second. None of these six-plus implementations share a common traversal utility. A TanStack migration should either consolidate all of them into one canonical "classify chart children" utility or explicitly and separately re-derive each one, since they are not drop-in equivalent implementations of the same idea (they differ in Fragment-unwrapping, passthrough-marker handling, and match strategy).

### 3.11 Profit/Loss sub-system (composable child API, not in original requirements list but present)
`profit-loss-line.tsx` (191 lines: `ProfitLossLine`/`ProfitLossLineProps`, `profitLossColor`, `resolveProfitLossTooltipLabel`, `PROFIT_LOSS_POSITIVE_COLOR`/`PROFIT_LOSS_NEGATIVE_COLOR` = emerald-500/red-500, `PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK`), `profit-loss-segments.ts` (124 lines: `splitProfitLossSegments`, `interpolateZeroCrossing` — exact zero-crossing interpolation so color splits happen precisely at the sign change), `profit-loss-legend.tsx` (59 lines: `ProfitLossLegend`, `PROFIT_LOSS_LEGEND_ITEMS`), `profit-loss-legend-hover.tsx` (30 lines: its own hover context, §3.5). Renders a line split into positive/negative-colored segments; supports per-segment gradient-based edge fade via the shared `fade-edges.ts`.

### 3.12 Projection sub-system (composable child API, not in original requirements list but present)
`projection-config.ts` (130 lines: `extractProjectionLineConfigs`, `mergeProjectionYDomain`, `mergeProjectionXDomainMax`, `ProjectionLineConfig`), `projection-line.tsx` (235 lines: `ProjectionLine`/`ProjectionLineProps`, `ProjectionStrokeStyle`), `projection-line-end-marker.tsx` (70 lines: `ProjectionLineEndMarker`, flagged `__isPostOverlay = true`), `projection-utils.ts` (387 lines: `buildProjectionPath`, `buildHorizontalTangentBezierPath`, `computeProjectionAnchorTangentSlope`, `ProjectionAutoMethod`, `ProjectionCurveKind`, `ProjectionMode`, `ProjectionPathDensity`, `ProjectionPoint`, `projectionDateExtents`, `projectionValueExtents`). Forward-looking dashed projection line extending past real data (`<ProjectionLine data={...}>`), three modes (`"auto"|"target"|"manual"`), two auto sub-methods (`linearRegression` vs. `lastSegment`), two curve kinds (`"linear"|"bezier"` — bezier via a custom S-curve with horizontal tangents at both ends), gradient-or-solid stroke, domain-extension helpers that scan chart children for `<ProjectionLine>` (the most thorough of the three "extract config from children" implementations — see §3.10).
`LineSeriesTerminalMarker` (`line-series-terminal-marker.tsx`, 95 lines): hollow ring marker at the last real data point, shared anchor for projection lines, also flagged `__isPostOverlay = true`, fades in/out keyed by `revealEpoch`, gated by `chartPhase` (`ready`/`exitingReady`).

### 3.13 Interaction/config/statistic primitives
- **`use-chart-interaction.ts`** (353 lines, full source read and confirmed): `ChartSelection` (`{startX,endX,startIndex,endIndex,active}`), `useChartInteraction()` — the shared hover/tooltip/drag-selection engine reused directly by Area/Line/Composed (via `TimeSeriesChartInner`) and by Candlestick. Handles both mouse and touch (single-touch = hover/tooltip via `resolveTooltipFromX`; two-finger touch = drag-selection, mirroring `onMouseDown`+`onMouseMove` desktop behavior). `resolveTooltipFromX()`/`resolveIndexFromX()` bisect on `xScale.invert()` via a caller-supplied `bisectDate`, picking whichever of the two neighboring points is nearer in time. Selection dragging tracks `isDraggingRef`/`dragStartXRef` and clears any active tooltip on mousedown. A dedicated `useEffect` re-anchors the tooltip/crosshair to `lastHoveredXRef` whenever `canInteract`, the x-scale, or visible data changes (e.g. after a brush-zoom commit), so the tooltip doesn't go stale/disappear when the domain changes under a still-hovering pointer. Delegates tooltip scheduling/dedupe to `useScheduledTooltip` (§4). Exposes `interactionStyle` (`cursor: canInteract ? "crosshair" : "default"`, `touchAction: "none"`) and a conditional `interactionHandlers` object (empty when `canInteract` is false) meant to spread directly onto the chart's interaction-catching `<g>`.
- **`chart-config-context.tsx`**: `ChartConfigProvider`, `ChartConfigValue`, `SpringConfig`, `DEFAULT_CHART_CONFIG`, `resolveTooltipBoxMotion`, `useChartConfig` — referenced by `use-highlight-segment.ts` (`highlightSpring` tuning) and by `TooltipBox`; file itself not opened this session.
- **`use-highlight-segment.ts`** (62 lines, full source read this session) + **`series-highlight-layer.tsx`** (50 lines) + **`highlight-segment-bounds.ts`** (72 lines, pure geometry): computes a pixel band `{x, width}` one data-point either side of the hovered index (or the active drag-selection range, which takes priority), springs `xSpring`/`widthSpring` via `useSpring` tuned by `ChartConfigProvider.highlightSpring`, with a "jump not ease" on inactive→active transition (`wasActive` ref) so the band appears instantly at the hover point instead of sliding in from x=0.
- **`series-hover-dim.tsx`** (61 lines): `SeriesHoverDim` — wraps stable series visuals (area fill, stroke, dash tail) with a `<motion.g>` opacity dim on hover; subscribes to `useChartHover()`+`useChartLegendHover()` internally (same "children as prop, wrapper subscribes internally" pattern as `SeriesMarkersDimWrapper`).
- **`series-dash-tail-overlay.tsx`** (83 lines) + **`path-stroke-utils.ts`** (90 lines): re-strokes the tail portion of a line path (from `dashFromIndex` onward) with a dash pattern. Documents a **deliberate accuracy/performance tradeoff**: uses a cheap linear (index-based) approximation of path-length-at-index rather than the exact `findPathLengthAtX` binary search via `getPointAtLength`, because the code comments state the exact approach costs ~40ms per series on a 365-point bezier — ~400ms blocking across ~10 series, eating into the first second of the entrance animation. `resolveDashTailBounds()`/`resolveDashStartX()` are pure helpers; `usePathStrokeMetrics()` measures the actual rendered path's `d` attribute + `getTotalLength()` via a `useEffect` with caller-supplied `deps` (explicitly documented as unsafe to replace with a stringified summary, since same-length in-place mutations would not retrigger it).
- **`fade-edges.ts`** (59 lines): the general horizontal edge-fade system used across Line/Area/ProfitLossLine/LineLoadingPulse — `FadeEdges = boolean | "left" | "right"`, `resolveFadeSides()`, `fadeGradientStops()` (fixed 0/15/85/100% stop pattern), `viewportFadeGradientAttrs()` (pins the gradient to the viewport via `gradientUnits="userSpaceOnUse"`, not the path's bounding box).
- **`chart-stat-flow.tsx`** (125 lines): `ChartStatFlow` — shared value+label stack used by Pie/Ring/Gauge centers, built on `@number-flow/react`'s `NumberFlow` custom element with a `useNumberFlowElementReady()` gate (`customElements.whenDefined("number-flow-react")`) that falls back to a plain formatted string (`formatStatValue`) until the custom element registers, avoiding a flash of unformatted/unanimated content.

---

## 4. Interactivity features per chart

| Feature | Charts using it | Mechanism |
|---|---|---|
| Hover tooltip | All cartesian charts, Heatmap, Choropleth, Sankey | Pointer events → React state, RAF-batched via `useScheduledTooltip` (dedupe-keyed), portal-rendered `TooltipBox` |
| Scheduled/dedupe-keyed tooltips | All cartesian charts | `use-scheduled-tooltip.ts` — `requestAnimationFrame` coalescing of pointermove-driven updates |
| Legend hover dimming | Area/Bar/Line/Composed/Scatter (via `SeriesHoverDim`), scatter/marker series (`SeriesMarkersDimWrapper`) | `useChartLegendHover` context; wrapped series subscribe internally, parent stays on a stable slice |
| Crosshair / vertical indicator | Cartesian charts (via `TooltipIndicator`) | SVG line + `indicator-fade.ts` gradient fade at top/bottom/both edges |
| Highlight segment (drag-select / hover band) | Cartesian line/area charts | `useHighlightSegment` + `SeriesHighlightLayer`; pixel band computed from hover index or active drag-selection, animated via `useSpring` (framer-motion), "jump not ease" on activation |
| Brush / zoom (range selection) | Line/Area/Composed (via `ChartBrush`/`ChartBrushLayout`) | `@visx/brush`'s `Brush`, three portal-rendered HTML overlays (track dim, selection pattern, resize handles) |
| Pan/zoom (continuous transform) | ChoroplethChart | `useChoroplethZoom`, `TransformMatrix` affine transform state |
| Live streaming / scrolling window | LiveLineChart | `LiveLine`/`LiveXAxis`/`LiveYAxis`, append-only data with momentum detection (`detectMomentum`) |
| Momentum-based recoloring | LiveLineChart | `detectMomentum()` classifies trend direction, applies `MomentumColors` |
| Click/select segments | Segment components (`SegmentBackground`, `SegmentLineFrom`/`SegmentLineTo`) | Composable click-to-select overlay, `segment.tsx` (barrel; not deep-read this session — flagged as a gap) |
| Fan-out marker interaction | `ChartMarkers`/`MarkerGroup` | Hover-triggered fan expansion (`FAN_ANGLE=160°`, `FAN_RADIUS=50px`), portaled HTML circles for real click/href targets |
| Reference-area-aware axis label coloring | `YAxis` + `ReferenceArea` | `resolveTickLabelColor()` checks each tick against registered reference-area bands via `useReferenceAreaRegistration` context |
| Sunburst drill-down / zoom | SunburstChart | Imperative `animate()`-driven ring-geometry transitions (`transitionGeometry`/`lerpGeometry`), not the shared reveal primitives |
| Slice hover pop-out | PieChart/RingChart | `DEFAULT_HOVER_OFFSET` radial displacement on `PieSlice` hover |
| Keyboard interaction | Not confirmed in any file read this session | **Gap** — no dedicated keyboard-handling file was found; if keyboard nav exists it is not part of the shared chart-context/tooltip/brush infrastructure documented here and should be treated as unconfirmed rather than assumed absent |

---

## 5. Animation / design characteristics

| Characteristic | Where | Motion system |
|---|---|---|
| Mount/enter reveal (clip grow) | `ChartRevealClip` — Area/Line/Bar/Scatter series | framer-motion (`motion.rect` width/x, keyed by `revealEpoch`) |
| Radial mount progress | Pie/Ring/Radar/Sunburst/Funnel centers & arcs | `useMountProgress` — `useMotionValue` + imperative `animate()`, retriggered by `replayKey` |
| Data-transition path smoothing | Line/Composed | `useAnimatedSeriesPath` — imperative `animate()` + per-frame point interpolation |
| Loading pulse (traveling stroke) | Line/Area (`loadingStyle="pulse"`) | `LineLoadingPulseStroke` — clip-path + imperative `animate()`, three modes (loop/exit/enter) |
| Loading sweep (shimmer over skeleton silhouette) | Line/Area (`loadingStyle="sweep"`), Bar (`BarLoadingSkeleton`) | SVG `<pattern>`+`<mask>`, deterministic hashed heights (no `Math.random()`), respects `useReducedMotion()` |
| Grid shimmer band | `Grid` (loading phases) | `useGridShimmer` — `useMotionValue` loop, `oneShot`/`shimmerSync`/infinite modes |
| Y-axis retween | `YAxis` | CSS `transition: top` (not motion-library-driven) |
| Background pattern fade-in | `Background` | CSS/SVG mask fade, 420ms (`BACKGROUND_ENTER_FADE_MS`) |
| Reference-area entrance fade | `ReferenceArea` | Gated by `isReferenceAreaVisiblePhase(chartPhase)` |
| Highlight-segment band | `SeriesHighlightLayer` | framer-motion `useSpring`, config from `ChartConfigProvider.highlightSpring` |
| Dash-tail overlay | `SeriesDashTailOverlay` | SVG `stroke-dasharray`, path-length approximated (documented perf tradeoff) |
| Number/stat flow | Pie/Ring/Gauge centers | `@number-flow/react`'s `NumberFlow` custom element (`ChartStatFlow`) |
| Loading label shimmer | `ChartLoadingLabel` | `ShimmeringText` (not independently read) + exit motion (y+30px, opacity 0, blur 2px) |
| Sunburst zoom/hover-grow | `SunburstChart` | Bespoke imperative `animate()`, distinct from shared primitives |
| 3D bar depth/perspective | `Bar perspective`, `BarDepthBack/Front` | Pure geometry (`bar-depth-geometry.ts`), no motion library — static per-frame recompute |
| Gradient/pattern fills | `Background`, `ReferenceArea`, `ChartBrushSelectionOverlay`, Bar gradients | SVG `<defs>` — `@visx/pattern`/`@visx/gradient`, shared `renderPatternPreset` |
| Edge fades (horizontal) | Line/Area/ProfitLossLine/LineLoadingPulse | SVG gradient (`fade-edges.ts`, fixed 0/15/85/100% stops) |
| Crosshair edge fades (vertical) | `TooltipIndicator` | SVG gradient (`indicator-fade.ts`) |

At least **7 distinct animation-stagger/timing formulas** exist across the codebase and are not unified: chart-phase orchestrator timing, line-loading-pulse cycle timing, grid-shimmer cycle timing, sunburst ring-sweep reveal delays, series-marker reveal delay (`leadingEdge/innerWidth * revealDurationSec`), highlight-segment spring config, and per-chart `animationDuration` props. A migration should treat each as a separate porting task rather than assuming one shared timing utility covers all of them.

---

## 6. Dependency map (visx/d3 per chart)

| Chart | Confirmed visx/d3 packages |
|---|---|
| AreaChart | `@visx/shape` (Area/AreaClosed via `Area`), `@visx/scale`, `@visx/grid`, `@visx/pattern`, `@visx/gradient` |
| BarChart | `@visx/shape` (Bar), `@visx/scale`, `@visx/grid` |
| CandlestickChart | `@visx/shape`, `@visx/scale` |
| ComposedChart | `@visx/shape` (Line/Area/Bar combined), `@visx/scale`, `@visx/grid` |
| LineChart | `@visx/shape` (LinePath), `@visx/scale`, `@visx/grid` |
| LiveLineChart | `@visx/shape`, `@visx/scale` |
| ScatterChart | `@visx/shape`, `@visx/scale` |
| HeatmapChart | `@visx/scale` (color scales), custom calendar-binning math (no d3-time dependency confirmed directly) |
| ChoroplethChart | `@visx/geo` (`Mercator` projection), `@visx/zoom` (`Zoom`/`TransformMatrix` for continuous pan/zoom) — confirmed by direct `import` statements in `choropleth-chart.tsx` |
| SankeyChart | `@visx/sankey` (`sankey`, `sankeyCenter`, `sankeyLinkHorizontal`) — confirmed by direct `import` statements in `sankey-chart.tsx`; `d3-sankey` itself is only a type-only `@types/d3-sankey` devDependency, not a runtime import |
| PieChart / RingChart | `@visx/shape` (Pie/Arc) |
| RadarChart | `@visx/shape`, `@visx/scale` (polar) |
| SunburstChart | `@visx/shape` (Arc), custom hierarchical geometry (`sunburst/` barrel) — no external d3-hierarchy import confirmed this session |
| Gauge | `@visx/shape` (Arc), reuses `PieCenterShell` |
| FunnelChart | Likely custom SVG polygon geometry, no visx dependency confirmed |
| Shared (all) | `@visx/brush` (`ChartBrush`), `@visx/grid` (`Grid`), `@visx/pattern` (pattern presets, `visx-pattern.ts` wrapper), `@visx/gradient` (`LinearGradient`/`RadialGradient`/named gradient presets re-exported from `index.ts`), `@visx/scale` (`scaleLinear` in `y-axis-scales.ts`) |
| Shared (motion) | `framer-motion` (`motion.rect`, `motion.g`, `useMotionValue`, `useSpring`, `animate()`, `useReducedMotion()`) — pervasive across reveal/loading/highlight/marker systems |
| Shared (numeric display) | `@number-flow/react` (`ChartStatFlow`) |

---

## 7. Canonical migration checklist (simple → complex)

| # | Chart | File | Trickiest feature to preserve |
|---|---|---|---|
| 1 | ScatterChart | `scatter-chart.tsx` | Marker reveal-delay sync with clip-reveal (`getSeriesMarkerVisualExtent`) |
| 2 | BarChart | `bar-chart.tsx` | 3D perspective depth math shared between `Bar` and `BarDepthBack` (must not drift) + `BarSquares` quantization |
| 3 | CandlestickChart | `candlestick-chart.tsx` | Stale JSDoc default (1500ms) vs. actual code default (1100ms) — verify real intended duration with the design owner before porting; also reuses the shared `useChartInteraction` hover/drag-select engine (same one Area/Line/Composed use via `TimeSeriesChartInner`) plus OHLC-preserving LTTB downsampling (`decimateOhlcData`) and a distinct spring-based `scaleY` transform-origin animation (`AnimatedCandle`, `{type:"spring",duration:0.8,bounce:0.15}`) not used by any other chart |
| 4 | AreaChart | `area-chart.tsx` | Stacked-area baseline (`stackId`) combined with clip-reveal and edge fades |
| 5 | LineChart | `line-chart.tsx` | `useAnimatedSeriesPath` data-transition smoothing (frame-by-frame interpolation against a moving target) |
| 6 | LiveLineChart | `live-line-chart.tsx` | Append-only scrolling window + momentum-based recoloring (`detectMomentum`) — no direct analog in the other cartesian charts |
| 7 | ComposedChart | `composed-chart.tsx` | Multi-series-type bar-width negotiation (`computeSeriesBarWidth`, 92%-of-slot shrink rule) across mixed Line+Area+Bar children |
| 8 | RadarChart | `radar-chart.tsx` | Polar axis/grid composition mirroring the cartesian child API exactly |
| 9 | PieChart / RingChart | `pie-chart.tsx` / `ring-chart.tsx` | Shared `PieCenterShell`/`ChartStatFlow` center-stat reuse across two chart types; CSS-Grid SVG/HTML layering (deliberate Safari `foreignObject` bug #23113 workaround) instead of `foreignObject`; each file has its own independently-implemented `isDefsComponent()` (see §3.10) |
| 10 | Gauge | `gauge.tsx` | Reuse of `PieCenterShell` under a clipped/semi-circular layout; unlike every other chart in the package it has **no children-as-config composition API at all** — a single flat props object; two entirely separate render paths (`GaugeArcInner`/`GaugeLinearInner`); custom polygon notch geometry (`createNotchPath`) instead of `@visx/shape`'s `arc()` (which Pie/Ring do use) |
| 11 | FunnelChart | `funnel-chart.tsx` | No shared `ChartProvider` context, `ParentSize`, or phase orchestrator at all — but it does partially reuse two shared, chart-context-independent primitives (`useMountProgress`, `useEnterComplete`) for its entrance animation, so it is not a fully clean-room migration; geometry (cubic-Bezier trapezoid segments) and hover springs are otherwise self-contained |
| 12 | HeatmapChart | `heatmap/` | Largest, most self-contained subsystem — calendar-binning math (week alignment, separators, month anchors) has no off-the-shelf TanStack equivalent; also runs its **own independent `useHeatmapChartLifecycle()` phase state machine**, separate from the shared `use-chart-phase-orchestrator.ts` used by the cartesian charts — a second lifecycle implementation to either consolidate or re-derive |
| 13 | SunburstChart | `sunburst-chart.tsx` + `sunburst/` | Bespoke imperative zoom/drill-down animation (raw `motion.animate()` writing into a `useRef<Map>` plus a `growTick` counter to force re-reads) and unique per-ring-sweep reveal stagger, entirely independent of the shared reveal/mount-progress primitives; no `ParentSize`/responsive-container step (fixed `size`, default 520, inside an `aspectRatio:"1/1"` div); its own independently-implemented `isDefsComponent()` (near-identical to Pie's/Candlestick's, see §3.10) |
| 14 | ChoroplethChart | `choropleth/` | Continuous pan/zoom affine transform via **confirmed** `@visx/zoom` (`Zoom`/`TransformMatrix`) over a **confirmed** `@visx/geo` `Mercator` projection; children classification is a hybrid type-reference-then-displayName-string strategy (`isChoroplethSvgChild()`) unlike any other chart's approach |
| 15 | SankeyChart | `sankey/` | Graph-shaped (node/link) data model instead of row/series data — least compatible with the shared cartesian context; layout is **confirmed** `@visx/sankey` (`sankey`/`sankeyCenter`/`sankeyLinkHorizontal`) with `d3-sankey` present only as a type-only devDependency; large asymmetric default margin (`{top:40,right:180,bottom:40,left:180}`) for node labels; data is defensively shallow-cloned before being handed to the mutating sankey generator |
| 16 | Cross-cutting: Brush/Markers/ReferenceArea/Projection/ProfitLoss composables | multiple (§3.6–3.12) | These are not top-level charts but composable child APIs used across several of the above; each must be re-verified against whichever host chart(s) adopt it post-migration, since they depend on `chart-child-passthrough.ts`'s layering rules and the "extract config from children" string-matching pattern (§3.10), neither of which has an obvious TanStack Charts equivalent |

Ordering rationale: charts 1–7 (cartesian family) share the most infrastructure (phase orchestrator, clip-reveal, shared axes/grid/tooltip) and are ordered by increasing per-chart special-casing (scatter has the least; composed has multi-series-type bar-width logic). Charts 8–11 (radial family) are next, ordered by how much they reuse vs. diverge from the Pie/Ring center-stat pattern (Gauge partially diverges via its flat-props API; Funnel diverges completely). Charts 12–15 are the four charts with the least infrastructure sharing, ordered by subsystem size and confirmed complexity (Heatmap's calendar math and independent lifecycle hook > Sunburst's bespoke imperative animation > Choropleth's confirmed geo/zoom dependency and hybrid children-classification > Sankey's confirmed graph-layout dependency and structurally different node/link data model). Row 16 flags that the composable cross-cutting features are a migration risk in their own right, independent of chart ordering.
