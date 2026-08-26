# children — Phase 4 Research Report

**Files:** `showcase/migrated/charts/children.tsx`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/`: `line.tsx`, `area.tsx`, `pattern-area.tsx`, `scatter.tsx`, `bar.tsx`, `bar-squares.tsx`, `bar-depth.tsx`, `series-bar.tsx`, `grid.tsx`, `x-axis.tsx`, `y-axis.tsx`, `bar-x-axis.tsx`, `bar-y-axis.tsx`, `candlestick.tsx`, `tooltip/chart-tooltip.tsx`, `live-line.tsx`, `live-x-axis.tsx`, `live-y-axis.tsx`, `projection-line.tsx`, `projection-line-end-marker.tsx`, `line-series-terminal-marker.tsx`, `profit-loss-line.tsx`, `markers/chart-markers.tsx`, `background.tsx`, `chart-child-passthrough.ts`

## Feature summary

Config-carrier compositional API: 24 null-rendering React components whose only job is to carry a props object tagged with a `CHART_ROLE` symbol so host chart components can walk their children once and compile a TanStack `defineChart` spec. Replaces bklit's six ad-hoc `displayName` string-matchers and per-chart `React.Children.forEach` walkers with one canonical role marker + one generic `extractChildren` walker (plus dedicated walkers in composed/live-line hosts). Renders nothing itself — no SVG, no DOM, no side effects.

## Public API

Parity is against the legacy child component of the same name (files above). `missing` = legacy prop exists, migrated doesn't; `extra` = migrated-only. Defaults cited as `(d X)`.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `CHART_ROLE` | `unique symbol` (`Symbol.for("migrated.chartRole")`) | extra | Canonical role marker; replaces bklit's six displayName string-matchers (research/01 §3.10) |
| `CHART_CHILD_PASSTHROUGH` | `unique symbol` | renamed | bklit `CHART_CLIP_PASSTHROUGH` (`"__chartClipPassthrough"` string prop, chart-child-passthrough.ts) → symbol marker |
| `roleOf(type)` | `(unknown) => string \| undefined` | extra | Read-side helper; reused by composed-chart, live-line-chart, radar-chart, projection-config |
| `displayNameOf(type)` | util fn | extra | Used by pie/ring/sunburst hosts for bklit displayName checks |
| `extractChildren(children)` | `(ReactNode) => ExtractedChildren` | renamed | Consolidates bklit's per-chart children walkers into one pass |
| **`Line`** | `(LineConfig) => null`, role `"line"` | same | bklit `Line` (line.tsx) |
| Line: `dataKey, yAxisId, stroke (d var(--chart-line-primary)), strokeWidth (d 2.5), curve (d curveNatural), animate (d true), fadeEdges (d true), showHighlight (d true), showMarkers (d false), markers, dashFromIndex, dashArray (d "6,4"), loadingStroke, loadingStrokeOpacity (d 0.5)` | per `LineConfig` | same (14) | Full pilot subset; `curve` now d3-shape-typed vs legacy `any` |
| Line: `loading` | `boolean` | missing | Legacy per-series loading override |
| Line: `loadingPulseMode` | `"loop"\|"exit"\|"enter"` | missing | Pulse phase override |
| Line: `onLoadingPulseCycleComplete` | `() => void` | missing | Loop-cycle callback |
| Line: `loadingStyle` | `"pulse"\|"sweep"` | missing | Sweep shimmer variant |
| **`Area`** | `(AreaConfig) => null`, role `"area"` | same | bklit `Area` (area.tsx) |
| Area: `dataKey, yAxisId, fill, fillOpacity (d 0.4), stroke, strokeWidth (d 2), curve (d curveMonotoneX), animate (d true), fadeEdges (d false), showHighlight (d true), dashFromIndex, dashArray (d "6,4")` | per `AreaConfig` | same (12) | `fadeEdges` boolean-true only (both-side mask); `"left"`/`"right"` unimplemented (D13c precedent) |
| Area: `showLine` | `boolean` | missing | Stroke on/off toggle |
| Area: `gradientToOpacity` | `number` | missing | Bottom gradient opacity |
| Area: `gradientSpan` | `number` | missing | Vertical gradient extent |
| Area: `showMarkers` / `markers` | `boolean` / style | missing | Point markers on area |
| Area: `loading` / `loadingPulseMode` / `loadingStyle` / `loadingStroke` / `loadingStrokeOpacity` | misc | missing (5) | Loading pulse controls |
| **`PatternArea`** | `(PatternAreaConfig) => null`, role `"patternArea"` | same | bklit `PatternArea` (pattern-area.tsx) |
| PatternArea: `dataKey`, `fill` | `string` | same (2) | `fill` accepts raw `url(#id)` escape hatch |
| PatternArea: `patternPreset`, `patternColor` | preset id / color | extra | Migrated convenience (plan §10 ruling 1) forwarded to `renderPatternPreset` |
| PatternArea: `curve` | `CurveFactory` | same | d `curveMonotoneX` |
| PatternArea: `animate` | `boolean` | missing | Deprecated in legacy (pattern not clip-revealed) — dropped |
| **`Scatter`** | `(ScatterConfig) => null`, role `"scatter"` | same | bklit `Scatter` (scatter.tsx) |
| Scatter: `dataKey, fill, stroke, strokeWidth (d 2), ringGap (d 2), radius (d 5)` | per `ScatterConfig` | same (6) | Pilot subset |
| Scatter: `yAxisId`, `animate`, `yGradient` | misc | missing (3) | incl. red→green y-position gradient |
| Scatter: `outlineWidth, outlineColor, fadeOnHover, inactiveOpacity, inactiveBlur, enterBlur, showActiveHighlight` | marker styling | missing (7) | Available only via `Line.markers` (`SeriesPointMarkerStyle`) |
| **`Bar`** | `(BarConfig) => null`, role `"bar"` | same | bklit `Bar` (bar.tsx) |
| Bar: `dataKey, fill, stroke, lineCap, fadedOpacity (d 0.3)` | per `BarConfig` | same (5) | Vertical grouped path only |
| Bar: `yAxisId, animate, animationType, staggerDelay, stackGap, groupGap, perspective, minBarHeight` | misc | missing (8) | Stacked/horizontal/perspective/stagger paths out of pilot scope; legacy `BarLineCap`/`BarAnimationType` types also unre-exported |
| **`BarSquares`** | `(BarSquaresConfig) => null`, role `"barSquares"` | same | bklit `BarSquares` (bar-squares.tsx) |
| BarSquares: `yAxisId` | `string\|number` | missing | Single-scale pilot |
| BarSquares: `dataKey, fill, stroke, squareGap (d 3), squareRadius (d 0.25), squareFit, useGradient, gradientStops, patternPreset, animate, fadedOpacity (d 0.3), staggerDelay, groupGap (d 4)` | per `BarSquaresConfig` | same (13) | `GradientStop` shape identical to legacy |
| **`BarColumnTrack`** | `(BarColumnTrackConfig) => null`, role `"barColumnTrack"` | same | `fill (d var(--chart-grid)), opacity (d 0.3), squareGap (d 3), squareRadius (d 0.25), groupGap (d 4), squareFit, staggerDelay` — all 7 same |
| **`BarDepthProvider`** | `(BarDepthProviderConfig & {children?}) => null`, role `"barDepthProvider"` | same | `segmentsAccessor, groundShadow, minBarHeight` — all 3 same; `children` kept in signature, never rendered |
| **`BarDepthBack`** | `(BarDepthBackConfig) => null`, role `"barDepthBack"` | same | `dataKey, color, colorAccessor` — all 3 same; carries `__isBarDepthLayer` flag like legacy |
| **`BarDepthFront`** | `(BarDepthFrontConfig) => null`, role `"barDepthFront"` | same | `dataKey` — same; `__isBarDepthLayer` flag |
| **`BarPulse`** | `(BarPulseConfig) => null`, role `"barPulse"` | same | `dataKey, activeIndex, pulsePaused` — all 3 same; `__isBarDepthLayer` flag |
| **`SeriesBar`** | `(SeriesBarConfig) => null`, role `"seriesBar"` | same | ComposedChart bar series (bklit series-bar.tsx); distinct role from standalone `Bar` |
| SeriesBar: `dataKey, fill, stroke, radius (d 0), fadedOpacity (d 0.3)` | per `SeriesBarConfig` | same (5) | Square-top default preserved (differs from `<Bar>`) |
| SeriesBar: `animate` | `boolean` | missing | Reveal driven by ComposedChart |
| **`BarXAxis`** | `(BarXAxisConfig) => null`, role `"barXAxis"` | same | `tickerHalfWidth (d 50), showAllLabels (d false), maxLabels (d 12)` — all 3 same |
| **`Grid`** | `(GridConfig) => null`, role `"grid"` | same | bklit `Grid` (grid.tsx) |
| Grid: `numTicks` | `number` (d 5) | renamed | Legacy `numTicksRows`; horizontal density only |
| Grid: `numTicksColumns` | `number` (d 10) | missing | Vertical density fixed in migrated guides renderer |
| Grid: `horizontal, vertical, stroke, strokeOpacity, strokeWidth, rowTickValues, loadingStroke, strokeDasharray, highlightRowValues, highlightRowStroke, highlightRowStrokeOpacity, highlightRowStrokeWidth, highlightRowStrokeDasharray, fadeHorizontal, fadeVertical, hideHorizontalEdgeLines, hideVerticalEdgeLines, yAxisId, shimmer, shimmerStroke, shimmerLength, shimmerSpeed, shimmerSync` | per `GridConfig` | same (23) | Full remaining surface carried incl. shimmer + highlight rows |
| **`XAxis`** | `(XAxisConfig) => null`, role `"xAxis"` | same | bklit `XAxis` (x-axis.tsx) |
| XAxis: `numTicks` | `number` (d 5) | same | |
| XAxis: `tickerHalfWidth` | `number` (d 50) | missing | Hover fade radius fixed internally |
| XAxis: `tickMode` | `"domain"\|"data"` | missing | Data-aligned mode always used |
| XAxis: `formatValue` | `(value: Date) => string` | extra | Migrated-only label formatter |
| **`YAxis`** | `(YAxisConfig) => null`, role `"yAxis"` | same | bklit `YAxis` (y-axis.tsx) |
| YAxis: `orientation` | `"left"\|"right"` | same (name) | Only `"left"` implemented — documented carve-out |
| YAxis: `yAxisId, numTicks (d 5), formatLargeNumbers (d true), formatValue` | per `YAxisConfig` | same (4) | |
| **`ChartTooltip`** | `(ChartTooltipConfig) => null`, role `"tooltip"` | same | bklit `ChartTooltip` (tooltip/chart-tooltip.tsx) |
| ChartTooltip: `enabled` | `boolean` | extra | Injected as `true` by `extractChildren` when child present |
| ChartTooltip: `indicatorWidth`, `indicatorSpan`, `columnWidth` | `IndicatorWidth` / `number` | extra | Migrated-only crosshair sizing knobs |
| ChartTooltip: `showDatePill, showCrosshair, showDots, dotVariant (d "dot"), dotSize (d 5), dotRadiusFraction, dotScale (d 1), dotStrokeWidth, indicatorColor, content, rows, dotColor, children, className, springConfig, matchCrosshair (d false), damping (d 20), indicatorDasharray, indicatorFadeEdges (d "both"), indicatorFadeLength (d 10), boxSpringConfig, panelStyle, backgroundColor` | per `ChartTooltipConfig` | same (23) | Full bklit prop parity (types.ts documents "21 props" + children/className) |
| **`Candlestick`** | `(CandlestickConfig) => null`, role `"candlestick"` | same | bklit `Candlestick` (candlestick.tsx) |
| Candlestick: `positiveFill (d url(#candlestick-positive)), negativeFill (d url(#candlestick-negative)), insideStrokeWidth (d 0), fadedOpacity (d 0.3), showHoverFade (d true)` | per `CandlestickConfig` | same (5) | Solid-fill path only |
| Candlestick: `animate` | `boolean` | same (name) | Reserved for parity; no independent effect yet (reveal owned by host) |
| Candlestick: `bodyPatternPositive` / `bodyPatternNegative` | `string` (url) | missing (2) | Body pattern overlay unsupported |
| **`LiveLine`** | `(LiveLineConfig) => null`, role `"liveLine"` | same | bklit `LiveLine` (live-line.tsx); LiveLineChart-only (LOG D22), not collected by `extractChildren` |
| LiveLine: `dataKey, stroke, strokeWidth (d 2), curve (d curveMonotoneX), fill (d true), pulse (d true), dotSize (d 4), badge (d true), formatValue (d toFixed(2)), momentumColors` | per `LiveLineConfig` | same (10) | `detectMomentum` util + `Momentum` type not re-exported (internalized); `MomentumColors` type exported |
| **`LiveXAxis`** | `(LiveXAxisConfig) => null`, role `"liveXAxis"` | same | `numTicks (d 5), formatTime (d HH:MM:SS)` — both same |
| **`LiveYAxis`** | `(LiveYAxisConfig) => null`, role `"liveYAxis"` | same | bklit `LiveYAxis` |
| LiveYAxis: `position` | `"left"\|"right"` | same (name) | Only `"left"` implemented — documented carve-out |
| LiveYAxis: `minGap (d 36), formatValue, allowDecimals (d true)` | per `LiveYAxisConfig` | same (3) | |
| **`ProjectionLine`** | `(ProjectionLineProps) => null`, role `"projectionLine"` | same | Props interface declared inline (not in internal/types); bklit projection-line.tsx |
| ProjectionLine: `data, yAxisId, stroke (d var(--chart-3)), strokeStyle (d "solid"), gradientStart, gradientEnd (d var(--chart-5)), strokeWidth (d 2), curveKind (d "linear"), curve, strokeDasharray (d "6,4"), strokeOpacity (d 1), showEndMarker, showEndpoints (@deprecated), endpointRadius (d 5), className` | per `ProjectionLineProps` | same (14) | Full parity incl. deprecated alias; legacy `ProjectionStrokeStyle` type unre-exported |
| **`ProjectionLineEndMarker`** | `(ProjectionLineEndMarkerProps) => null`, role `"projectionEndMarker"` | same | `data, yAxisId, stroke, strokeOpacity, radius` — all 5 same; legacy `__isPostOverlay` flag superseded by role/host layering |
| **`LineSeriesTerminalMarker`** | `(LineSeriesTerminalMarkerProps) => null`, role `"terminalMarker"` | same | bklit line-series-terminal-marker.tsx |
| LineSeriesTerminalMarker: `dataKey, yAxisId` + `SeriesPointMarkerStyle` extension (`fill (d "transparent"), stroke (d var(--chart-1)), radius (d 5), ringGap (d 0), strokeWidth (d 1.5)`, outline/hover fields) | interface | same | Extends shared marker-style contract identically |
| **`ProfitLossLine`** | `(ProfitLossLineProps) => null`, role `"profitLossLine"` | same | `dataKey, xDataKey (d "date"), strokeWidth (d 2.5), positiveColor (d emerald-500), negativeColor (d red-500), curve (d curveLinear), fadeEdges (d false)` — all 7 same |
| **`ChartMarkers`** | `(ChartMarkersChildProps) => null`, role `"chartMarkers"` | same | bklit `ChartMarkers` (markers/chart-markers.tsx) |
| ChartMarkers: `items (ChartMarker[]), size (d 28), showLines (d true), animate (d true)` | per `ChartMarkersChildProps` | same (4) | `ChartMarker` item shape identical |
| ChartMarkers: `maxFanned` | `number` | extra | Fan-out cap, migrated-only |
| *(brush slot)* | `ExtractedChildren.brushes: ReactElement[]` | renamed | No component here; `internal/chart-brush.tsx` assigns `CHART_ROLE="brush"`. Kept as ELEMENT (portal chrome re-rendered under BrushHostContext), unlike all prop-extracted shims |
| `BarYAxis` | — | missing | Legacy bar-y-axis.tsx child (horizontal bar category labels); no migrated counterpart anywhere |
| `Background` | — | missing | Legacy plot-area pattern child; no children.tsx role (an orphan `internal/background` module exists per taxonomy, unwired) |
| `Legend` / `LegendItem` family | — | missing | Legacy legend children not collected by `extractChildren` (no slot); migrated `internal/legend` is an orphan |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `CHART_ROLE` symbol registry marker | constant | CUSTOM | CUSTOM | no | `Symbol.for` so cross-module identity works without import cycles; TS-check: none — no React-tree introspection in TanStack |
| `CHART_CHILD_PASSTHROUGH` symbol | constant | CUSTOM | CUSTOM | no | Replaces bklit `__chartClipPassthrough` string prop; TS-check: none |
| Null-render config carriers (24 components) | component | BKLIT | CUSTOM | no | `(props)=>null`; props object IS the config; TS-check: partial — output compiles to native mark factories (lineY/areaY/barY/dot); React-carrier form custom |
| Role string vocabulary (`line`…`brush`, 27 roles) | constant | BKLIT | CUSTOM | no | Duplicated across three sync points: assignment sites, `extractChildren` branches, `ExtractedChildren` keys; TS-check: partial — `ChartMotionRole` union (charts-core types.ts) targets motion only, not extraction |
| `roleOf()` | util fn | CUSTOM | CUSTOM | no | Shared read helper (composed, live-line, radar, projection-config); TS-check: none |
| `displayNameOf()` | util fn | CUSTOM | CUSTOM | no | Pie/ring/sunburst host parity checks; TS-check: none |
| `extractChildren()` single-pass walker | util fn | BKLIT | CUSTOM | no | Analog of bklit `forEachChartChild`; consumers: line/area/bar/scatter/candlestick charts; TS-check: none — composition is spec arrays (`marks`), no tree walking |
| Fragment flattening in `visit()` | behavior | BKLIT | CUSTOM | no | `React.Children.toArray` + recursive fragment descent; TS-check: none |
| Passthrough wrapper unwrapping | behavior | BKLIT | CUSTOM | no | Recursive descent into `[CHART_CHILD_PASSTHROUGH]` components (profit-loss-config, profit-loss-legend-hover set it); TS-check: none |
| Tooltip `{enabled:true}` injection | constant | CUSTOM | CUSTOM | no | Presence-based legacy rendering → explicit enabled flag; TS-check: partial — end state is native: tooltip presence in `ChartDefinitionOptions` enables it |
| Brush children kept as elements | behavior | BKLIT | CUSTOM | no | Only non-prop extraction in `ExtractedChildren`; TS-check: CONTRADICTS no (capability) — native `brushX` control (`@tanstack/charts/interaction/brush`) covers behavior, not element-slot mechanics |
| `__isBarDepthLayer` flags ×3 | constant | BKLIT | CUSTOM | no | Static-property parity with bar-depth.tsx (minification-safe vs displayName); TS-check: none — no depth/perspective bars in TanStack |
| `displayName` assignments (11 carriers) | constant | BKLIT | CUSTOM | no | BarSquares, BarColumnTrack, BarDepth*, PatternArea, Projection*, ProfitLossLine, ChartMarkers; TS-check: none |
| Config type contract (28 `*Config` types via `internal/types`) | type | BKLIT | CUSTOM | no | JSDoc encodes every legacy default (single source for defaults); TS-check: partial — compile targets are native types (LineYOptions, BarYOptions, ChartTooltipOptions); contract itself custom |
| `SeriesPointMarkerStyle` | type | BKLIT | CUSTOM | no | Marker appearance contract shared Line.markers / terminal marker; TS-check: partial — `CrosshairMarkerOptions` + `ChartDotStateStyle` cover most fields; no ringGap |
| `ProjectionPoint` (from `internal/projection-utils`) | type | CUSTOM | CUSTOM | no | Projection path point; TS-check: none — ruleY/regression marks don't express projection paths |
| `CurveFactory` (from `d3-shape`) | type | TANSTACK | TS-NATIVE | yes | TanStack charts consume d3-shape curve factories natively; TS-check: native — `d3Curve` (@tanstack/charts root, d3-shape.ts) wraps CurveFactory into `ChartCurve` |
| Legacy `BarDepthContext` elimination | context | BKLIT | CUSTOM | no | Legacy provider pushed React context; migrated compiles provider config at walk time — no runtime context; TS-check: none |
| Contexts consumed/provided in this module | context | — | — | no | None — pure static analysis of the React tree; TS-check: none |
| Side-effect channels (WAAPI/DOM/events/rAF) | behavior | — | — | no | None — module renders nothing, registers nothing; TS-check: none |
| CSS classes from `styles.css` | CSS class | — | — | no | None used here; TS-check: none |
| Inlined defaults | constant | — | — | no | Only `{enabled:true}`; all visual defaults documented in `internal/types` JSDoc, applied by consuming compilers; TS-check: partial — `{enabled:true}` ≡ native tooltip-presence enablement; visual defaults custom |
| Dedicated host walkers bypassing `extractChildren` | behavior | BKLIT | CUSTOM | no | composed-chart `extractComposed` (cross-role order), live-line-chart `extractLiveLineChildren` — mirrors bklit upsert semantics; TS-check: none — `composeViews` (@tanstack/charts/view) joins whole definitions, not intra-chart role order |

## Imports

- `react` (`* as React`)
- `d3-shape` (`CurveFactory` type)
- `./internal/types` — `AreaConfig, BarConfig, BarColumnTrackConfig, BarDepthBackConfig, BarDepthFrontConfig, BarDepthProviderConfig, BarPulseConfig, BarSquaresConfig, BarXAxisConfig, CandlestickConfig, ChartTooltipConfig, GridConfig, LineConfig, LiveLineConfig, LiveXAxisConfig, LiveYAxisConfig, PatternAreaConfig, ScatterConfig, SeriesBarConfig, XAxisConfig, YAxisConfig, ExtractedChildren, SeriesPointMarkerStyle` (+ inline `ChartMarker`, `ChartMarkersConfig`)
- `./internal/projection-utils` (`ProjectionPoint` type)

## Deviations

- Pilot-subset prop omissions are intentional and documented in `internal/types` JSDoc: Line −4 (loading pulse controls), Area −10, Scatter −10, Bar −8 (no stacked/horizontal/perspective), SeriesBar −animate, Candlestick −bodyPattern±, Grid `numTicksColumns`.
- Renames/drifts: Grid `numTicksRows`→`numTicks`; XAxis loses `tickerHalfWidth`/`tickMode` but gains `formatValue`; ChartTooltip gains `enabled`/`indicatorWidth`/`indicatorSpan`/`columnWidth`; ChartMarkers gains `maxFanned`; PatternArea gains `patternPreset`/`patternColor`, drops deprecated `animate`.
- `extractChildren` injects `{enabled:true}` into tooltip config — new semantics vs bklit's presence-based rendering.
- Legacy children with no migrated counterpart: `BarYAxis`, `Background`, legend-family children (no extraction slot; `internal/legend` is an orphan).
- `YAxis`/`LiveYAxis` accept `orientation`/`position` `"right"` in types but only left is implemented (documented carve-outs).
- `Candlestick.animate` is reserved-for-parity with no effect yet.
- Legacy static markers `__isPostOverlay` (ProjectionLineEndMarker, LineSeriesTerminalMarker) have no direct counterpart — post-overlay ordering moved to host layering; verify parity during synthesis.
- Minor export drift: legacy `detectMomentum`, `Momentum`, `ProjectionStrokeStyle`, `BarLineCap`, `BarAnimationType`, `BarDepthEntry`, `useBarDepthEntries`, `MarkerTooltipContent`, `MarkerGroup`, `useActiveMarkers` are not re-exported from the migrated children surface (some live in internals/barrels).
- `CurveFactory` switched from legacy `any` to d3-shape typing (strictness improvement, slight API narrowing for exotic visx curves).
- Duplication watch: role strings appear in three places (carrier assignments, `extractChildren` branch chain, `ExtractedChildren` field names) — adding a child requires touching all three plus `internal/types`; consider a single table at synthesis.
