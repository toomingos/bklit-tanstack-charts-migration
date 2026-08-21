# Initiative 8 — Legend + ChartLegend + ProfitLoss — GROUND TRUTH (pre-plan)

Status: Explore-agent survey persisted 2026-08-19 (lead not yet synthesized into plan-loop-1.md; do that at the initiative 8 boundary). All claims file:line-verified by the survey agent.

## Audit premise checks + corrections (`research/phase-3/audits/08-legend-profitloss.md`)

Audit's absence claim confirmed (exhaustive grep: zero cartesian Legend/ChartLegend/ProfitLoss code in showcase/migrated + showcase/components). Additions:
1. `ChartLegend` is explicitly LEGACY — bklit barrel `index.ts:129` comment "Legacy legend component (backward compatibility)". Forward API = composable `Legend`/`LegendItemComponent`/`LegendMarker`/`LegendLabel`/`LegendValue`/`LegendProgress` (`legend/` dir).
2. Registry metadata phantom dep: `apps/web/public/r/legend.json:8` + legend.mdx list `@number-flow/react`, but ZERO imports in any legend/chart-legend source. Ignore.
3. NO single dim-opacity constant in bklit: ChartLegend row fade `opacity-40` (chart-legend.tsx:224); `SeriesHoverDim` dimOpacity default 0.5 (series-hover-dim.tsx:33) but Line passes 0.3 (line.tsx:336-340); ProfitLossLine local `LEGEND_DIM_OPACITY = 0.25` (profit-loss-line.tsx:22); bar family uses each chart's `fadedOpacity`. Unify-or-replicate = lead ruling.
4. NO reduced-motion handling anywhere in bklit legend/profit-loss files (parity = no gating).
5. `candlestick.tsx:319,426` consumes `useChartLegendHover` (index 0=Bull/positive, 1=Bear/negative) but NO demo wires a legend around CandlestickChart — capability without first-party trigger UI.

## Composable Legend family (`repos/bklit-ui/packages/ui/src/charts/legend/`)

- `Legend` (legend.tsx:16-104): props `items: LegendItemData[]` (`{label, value, maxValue?, color}`), `hoveredIndex?` (controlled iff !== undefined; else internal useState), `onHoverChange?`, `title?`, `titleClassName?` = "text-sm font-semibold", `className?` = "". Root `<div class="legend-container flex flex-col gap-2">`, optional `<h3 class="mb-1 text-legend-foreground">`. Single `children` element `cloneElement`d per item (keyed by label) inside `LegendItemProvider` (per-item `{item, index, isHovered, isFaded, percentage}`). All HTML.
- `LegendItem`/pub `LegendItemComponent` (legend-item.tsx:7-36): `className` = "". div with onMouseEnter→setHoveredIndex(index)/onMouseLeave→null, `data-hovered`, classes `cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out` + `bg-legend-muted` when hovered. Does NOT apply fade itself (isFaded exposed via useLegendItem but unused here — only legacy ChartLegend fades rows).
- `LegendMarker` (:6-23): `className` = "h-2.5 w-2.5"; `<div class="shrink-0 rounded-full" style={{backgroundColor: item.color}}>`.
- `LegendLabel` (:6-23): `className` = "text-sm font-medium"; `<span class="text-legend-foreground">{item.label}`.
- `LegendValue` (:7-46): `className` = "text-sm tabular-nums", `showPercentage` = false, `percentageClassName` = "text-xs tabular-nums", `formatValue` = intFmt (Intl en-US), `formatPercentage` = `${p.toFixed(0)}%`. Span "flex items-center gap-2 text-legend-muted-foreground"; percentage only when showPercentage && item.maxValue.
- `LegendProgress` (:7-49): `trackClassName` = "", `indicatorClassName` = "", `height` = "h-1.5". null if !item.maxValue. `@base-ui/react/progress` Root/Track/Indicator, track "w-full overflow-hidden rounded-full bg-legend-track", indicator "h-full rounded-full transition-all duration-500" + inline backgroundColor. 500ms CSS, no motion.
- `legend-context.tsx`: `legendCssVars` (:5-12) = --legend/--legend-foreground/--legend-muted/--legend-muted-foreground/--legend-track. `useLegend`/`useLegendItem` THROW outside provider (:76-91) — hard, unlike the soft chart-legend-hover contexts.

## ChartLegend (legacy, chart-legend.tsx:19-56 props, 167-262 impl)

Props: `items` (required), `hoveredIndex` = null (parent-owned only — no uncontrolled mode), `onHover?`, `showProgress` = false, `showMarker` = true, `showValue` = true, `showPercentage` → resolved `?? showProgress` (:185), `formatValue` = intFmt, `title?`, `className` = "", `titleClassName` = "text-sm font-semibold", `itemClassName` = "", `labelClassName` = "text-sm font-medium", `valueClassName` = "text-sm tabular-nums", `renderItem?` ({item,index,isHovered,isFaded,percentage}) override. Rows: `ProgressItem` (grid-cols-[auto_1fr_auto], base-ui Progress duration-500) or `SimpleItem` (flex). Row wrapper: hover `bg-legend-muted` + faded `opacity-40` (:220-226).

## ChartLegendHoverProvider / useChartLegendHover (chart-legend-hover.tsx)

Provider props: `hoveredIndex` (required), `onHoverChange` (required), children; memo `{hoveredIndex, setHoveredIndex: onHoverChange}` (:22-25). Hook is SOFT — `{hoveredIndex: null, setHoveredIndex: noop}` without provider (:37-43), so all consumer charts work standalone.

## Series dimming consumers (exact mechanisms — NOT uniform)

- Line (line.tsx:279-282 seriesIndex = lines.findIndex; :336-340): wraps stroke+dash-tail in `<SeriesHoverDim seriesIndex dimOpacity={0.3} enabled={effectiveShowHighlight}>`. `SeriesHoverDim` (series-hover-dim.tsx:31-56): reads useChartLegendHover + useChartHover; `isChartHovering = tooltipData !== null || selection?.active`; `isLegendDimmed = legendHovered !== null && !== seriesIndex`; opacity = dim when enabled && (isChartHovering || isLegendDimmed). Rendered `motion.g animate={{opacity}} transition={{duration: 0.4 default, ease:"easeInOut"}}` — motion/react. NOTE: chart hover dims ALL series equally; legend hover spares one.
- Area (area.tsx:28,316-326): same SeriesHoverDim wrapper.
- Bar (bar.tsx:223,233-234,385-386) / BarSquares (bar-squares.tsx:307,321-322,368) / SeriesBar (series-bar.tsx:179-181,222): `isLegendDimmed` folded into per-bar `isFaded`; plain SVG opacity + CSS transition (~0.12-0.15s). SeriesBar warns+null with barScale (:184-189) — composed/line time-axis only.
- SeriesMarkers (series-markers.tsx:241-244): `<g opacity>` with CSS `transition: opacity 0.15s, filter 0.15s` + optional blur(inactiveBlur px).
- Candlestick (candlestick.tsx:319,426; geometryDimOpacity :110-126): legendHovered 0 dims negatives, 1 dims positives; else per-time hover; `<g opacity style transition 0.15s>` (:216-217), fadedOpacity default 0.3.

## ProfitLoss family

- `ProfitLossLine` (profit-loss-line.tsx:35-48 props): `dataKey` req, `xDataKey` = "date", `strokeWidth` = 2.5, `positiveColor` = `PROFIT_LOSS_POSITIVE_COLOR` = "var(--color-emerald-500)", `negativeColor` = `PROFIT_LOSS_NEGATIVE_COLOR` = "var(--color-red-500)", `curve` = curveLinear, `fadeEdges: FadeEdges` = false. Exports also `profitLossColor(value)` (>=0 → positive), `PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK` = "Profit/Loss", `resolveProfitLossTooltipLabel`. Reads tooltipData (useChart), hoveredIndex (useProfitLossLegendHover), renderData/scales (useChartStable). `focusedLegendIndex` (:73-85): legend hover wins, else tooltip point's SIGN (chart hover alone dims opposite-sign segments). Per-segment `<g opacity={isDimmed?0.25:1} style transition 0.2s ease-in-out>` + visx LinePath, strokeLinecap/join round. fadeEdges → two per-sign linearGradients (:113-154), ids `profit-loss-gradient-{pos|neg}-${dataKey}-${reactId}`.
- `splitProfitLossSegments` (profit-loss-segments.ts:59-123): `({data, dataKey, xDataKey="date", xAccessor}) → {data[], isPositive}[]`. Zero-crossing interpolation `t = ya/(ya-yb)` inserting `[dataKey]: 0` point on BOTH sides of split; zeros don't flip sign (attach to preceding sign, initial ties → positive); tests at `__tests__/profit-loss-segments.test.ts` (port these).
- `ProfitLossLegend` (profit-loss-legend.tsx:31-58): props `hoveredIndex` = null, `onHoverChange?`, `align: "start"|"center"|"end"` = "start" (justify-* map :22-29), `className?`. `PROFIT_LOSS_LEGEND_ITEMS` (:10-13, exported): [{Profit, 0, positive}, {Loss, 0, negative}] — values hardcoded 0, only marker+label render. Wraps composable `<Legend className="flex-row flex-wrap gap-4">` + LegendItem(gap-2)/LegendMarker(h-2.5 w-2.5)/LegendLabel(text-xs).
- `ProfitLossLegendHoverProvider`/`useProfitLossLegendHover` (profit-loss-legend-hover.tsx): context value `{hoveredIndex}` ONLY (no setter); soft default null (:28).

## Threading facts

- NO chart shell extracts Legend/ChartLegend/ProfitLossLegend from children — always manually-composed plain-flow HTML siblings by the app author (NOT position:absolute overlays; correction to the overlay-convention premise). `ProfitLossLine` IS a chart child (SVG).
- No automatic lines→legend-items derivation: `LineConfig` has no label/value; every demo builds items manually (studio-trio: value = LAST data point value per key).
- **Hidden-Line trick (load-bearing)**: ProfitLossLine demos require sibling `<Line dataKey=… stroke="transparent" strokeWidth={0} showHighlight={false} fadeEdges={false}/>` so the series registers for y-domain + tooltip (profit-loss-line.mdx:18). ProfitLossLine does not register in `lines`.
- Radial charts (Ring/Pie/Radar/Sunburst/Funnel): DIFFERENT pattern — charts accept `hoveredIndex`/`onHoverChange` props directly (dual controlled/uncontrolled), app syncs one useState to both chart and composable Legend (ring-chart.tsx:58-60,140-165; pie-chart.tsx:50-52,163-186; radar-chart-demo.tsx:91-96; SunburstWithLegend chart-examples.tsx:7005; FunnelHeroWithLegend :6433). Check whether migrated radial charts already expose hoveredIndex/onHoverChange props (phase 1/2 scope) before duplicating.
- Scatter + LiveLine: unwired in bklit (parity by omission).

## Demo API surface (parity gate)

- legend-demo.tsx: `LegendSimpleDemo` (Item gap-3 + Marker + Label flex-1 + Value); `LegendProgressDemo` (title "Sessions by Channel", Item grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1, Value showPercentage, col-span-full LegendProgress); `LegendHorizontalDemo` (Legend flex-row flex-wrap gap-4, Marker h-2 w-2, Label text-xs). sampleData ×4 items maxValue 5000.
- profit-loss-line-demo.tsx (canonical): LineChart + Grid `highlightRowStroke="var(--foreground)" highlightRowStrokeOpacity={0.35} highlightRowValues={[0]} horizontal` + hidden Line + ProfitLossLegendHoverProvider(hoveredIndex)>ProfitLossLine + XAxis + ChartTooltip (indicatorColor/rows via profitLossColor + resolveProfitLossTooltipLabel); `<ProfitLossLegend align="center" hoveredIndex onHoverChange/>` below chart.
- line-chart-studio-trio-demo.tsx: ChartLegendHoverProvider wraps whole layout; `<ChartLegend className="w-full flex-row flex-wrap gap-x-4 gap-y-2" itemClassName="w-auto shrink-0" labelClassName="font-medium text-xs tabular-nums" showValue={false} items hoveredIndex onHover/>` above chart; items value = last data point.
- chart-examples.tsx: RingWithLegend :3958-3997 (Legend + LegendProgress synced to RingChart); PieWithLegend :4018+; ProfitLossLine examples :1497-1561 + makeProfitLossLineExamples :6026-6160; profit-loss trio gallery :3357-3380; ChartLegend bar gallery import :6185; FunnelHeroWithLegend :6433-6503; SunburstWithLegend :7005-7153.
- bar-chart-demo.tsx BarChartStackedWithLegendDemo :165-198: decorative uncontrolled Legend (no provider, no hover wiring).
- radar-chart-demo.tsx :75-118: Legend items = per-series average, maxValue 100, formatValue `${v.toFixed(0)}%`, title "Campaign Performance".

## Migrated today

- Zero cartesian legend/profit-loss code. Heatmap legend family FULLY PORTED (`internal/heatmap-legend.tsx`, 258 lines; barrel internal/index.ts:82-91) — different family, but its coordinator pattern is the precedent.
- Legend CSS vars ALREADY PORTED byte-identical: `showcase/app/globals.css:41-45` (--color-legend* maps), :127-131 light, :198-202 dark. No CSS work needed.
- `intFmt` already at `internal/formatters.ts:24`.
- `@base-ui/react ^1.0.0-alpha.8` and `motion ^12.27.0` already in showcase/package.json (:14,:39) — NO new deps (m2c D207(f) stands). NOTE: migrated charts doctrine avoids motion/react in chart internals — Legend is plain HTML chrome, dim animations in migrated go through hover-chrome CSS transitions/WAAPI, so motion stays unused; do not import it.
- **Architecture fact**: migrated hover/dim is imperative DOM via `internal/hover-chrome.ts` `attachHoverChrome` (:156-469) — cached node sets (dimmedPaths/dimmedBarRects :197-198), `data-ts-key` querySelector lookup (:287-298), `base.style.opacity = dimOpacity` (:332-334), `BAR_DIM_TRANSITION = "opacity 0.12s ease-in-out"` (:37). Legend hover must REACH this layer.
- Bridge options (lead ruling needed): (a) extend HoverChromeState/getState with legendHoveredIndex read by update(); (b) new `setLegendHover(index)` method on the HoverChrome handle (alongside onFocusGroupChange/reanchor/detach); (c) a `useSyncExternalStore` coordinator like `internal/heatmap-interaction.tsx` (subscribe/getHoveredLegendLevel/setHoveredLegendLevel — consumed heatmap-legend.tsx:87-123) — the closest proven precedent for React-component ↔ imperative-DOM shared hover state.
- `internal/design-tokens.ts` has no legend dim token yet (TOOLTIP_SPRING etc. :8-10).

## Open lead rulings for plan-loop-1

1. Port composable Legend family as primary; ChartLegend legacy = secondary (still demoed — needed for studio-trio parity; decide port vs defer).
2. Legend-hover → hover-chrome bridge choice (coordinator pattern recommended by survey; decide (a)/(b)/(c)).
3. Dim opacity/duration values: replicate bklit's per-chart inconsistency exactly (parity) vs unify — parity-first doctrine suggests replicate, with constants in one internal site.
4. Hidden-Line registration trick must be documented + covered in demo/QA.
5. Radial (ring/pie/radar/sunburst/funnel) hoveredIndex/onHoverChange props: verify what migrated already exposes from phases 1–2 before adding; sync-with-Legend demos may need only demo work.
6. Line/Area dim uses motion/react 0.4s easeInOut in bklit — migrated port must express as CSS/WAAPI in hover-chrome layer (doctrine), matching timing.
