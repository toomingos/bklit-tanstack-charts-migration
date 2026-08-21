# 04 — Migrated Charts Inventory

> **Step 0.2 of PLAN-phase-2.md.** Ground-truth catalogue of `migrated/charts/` — the
> post-Phase-1 TanStack-migrated chart layer — for use by Step 0.3 audits that
> will flag non-TanStack-native patterns, wrappers, and design deviations.
> All file paths are absolute from the repo root
> `/Users/tomasdomingos/bklit-tanstack-charts-migration` unless stated otherwise.
> Line counts are verbatim `wc -l` as measured on 2026-08-07. No file outside
> this document was modified. Audits in 0.3 will make final rulings; this
> document flags candidates only.

**Inputs read**

- `migrated/charts/*.tsx|*.ts|*.css` — all 18 chart-level files (full read of
  headers + mark-definition sites; focus depth on the largest files —
  `live-line-chart.tsx` 958 / `choropleth-chart.tsx` 950 / `gauge.tsx` 1000 /
  `composed-chart.tsx` 875 / `funnel-chart.tsx` 848 / `candlestick-chart.tsx` 826
  / `ring-chart.tsx` 819 / `scatter-chart.tsx` 715 / `sunburst-chart.tsx` 707 —
  reported in the task brief as ~20–37 k characters/bundle, verified here as
  ~577–1000 lines).
- `migrated/charts/internal/*` — all 64 files enumerated via `wc -l` and sampled to
  ≥ 26 files to characterize the helper layer (full headers for all 64 scanned;
  deep read of ≥ 26 including all `*-hover-chrome.ts`, `area-fill-mark.ts`,
  `series-bar-mark.ts`, `live-line-mark.ts`, `sankey-mark.ts`,
  `hover-chrome.ts`, `deferred-reveal.ts`, `spring.ts`, `candle-spring.ts`,
  `x-axis-overlay.tsx`, `y-axis-overlay.tsx`, `center-stat.tsx`,
  `heatmap-components.tsx`, etc.).
- `research/phase-2/tanstack-native/*.md` — `00-README.md` through `05-stack.md` —
  defines TanStack-native: `defineChart(spec)` → `Chart` (`packages/react-charts/src/Chart.tsx:42`)
  → `RendererChart` → `createChartRendererAdapter` → `mountChartRenderer`
  (`packages/charts-core/src/renderer.ts:34`), `ResizeObserver` only when
  `width` undefined, keyed `reconcileChartSvg` string→DOM diff, `animate: true`
  rAF tweens, imperative `paintFocus`/`paintTooltip`, `focus` presets,
  `focusDisabled`, `polar()`/`radialArc`/`geoShape`/`cell`/`barY`/`lineY`/`dot`
  marks.
- `research/phase-2/bklitui-native/*.md` — `00-README.md` through `05-stack.md` —
  defines bklit-native: `ParentSize` `debounceTime={10}` sizing gate,
  `ChartProvider` `ChartStableContext`/`ChartHoverContext` split,
  `ChartPhase` 8-state machine via `useChartPhaseOrchestrator`, `@visx/shape`
  (`LinePath`/`AreaClosed`) + `motion/react` reveals (`ChartRevealClip`
  `motion.rect`, `useAnimatedYDomains`, `useAnimatedSeriesPath`), `useChartInteraction`
  `localPoint→xScale.invert→bisector→scheduleTooltip(rAF deduped)`, portals for
  axes/tooltip/brush.
- `research/phase-2/inventory/01-bklit-ui-inventory.md` §2 (16 top-level charts)
  and §7 (canonical checklist simple→complex: Scatter 1 → Sankey 15) — used to
  verify the migrated set covers the same 16 chart families.

---

## 1. Chart file table

One row per file in `migrated/charts/` with measured `wc -l`, TanStack marks used,
and a wrapper/extra-complexity flag for Step 0.3 to verify. **YES = carries
extra layer beyond what TanStack-native would require for the same pixels; NO =
no extra layer detected at this inventory sweep.**

| File | Lines `wc -l` | TanStack marks used | Wrapper / extra complexity | Source for classification |
|------|---------------|----------------------|----------------------------|---------------------------|
| `migrated/charts/area-chart.tsx` | 483 | `lineY` (stock) + `areaFill` (custom `createMark`, replaces `areaY`) | **YES** — custom `areaFill` mark (avoids `areaY`'s per-datum `ChartPoint` + polygon-retained heap, G4 +10% ceiling) + imperative `attachHoverChrome` + local `scaleUtc`/`scaleLinear` + `XAxisOverlay` | `migrated/charts/area-chart.tsx:29` `d3Curve, defineChart, lineY`; `migrated/charts/internal/area-fill-mark.ts:1` header |
| `migrated/charts/bar-chart.tsx` | 542 | `barY` (stock, one per `<Bar>` series, with `groupScale` `scaleBand`) | **YES** — margin-inclusive local `scaleBand`+`scaleLinear` rebuilt in parallel to TanStack's `resolveConfiguredScale`; band-index pointermove (not TanStack `focus`/`bisector`); WAAPI stagger reveal via `querySelectorAll(.ts-chart__bar-y)`; custom `attachBarHoverChrome` | `migrated/charts/bar-chart.tsx:50` `defineChart, barY`; header 1–45 |
| `migrated/charts/candlestick-chart.tsx` | 826 | `createMark` ×2 — `wicksMark` + `bodiesMark` (custom, no stock `rect`/`link`) | **YES** — two GAP custom marks justified per PLAN 1.2; `candle-spring.ts`→WAAPI spring sampling replaces framer; `onPostPaint` + `querySelectorAll` reveal; bypasses stock `rect`/`link` that TanStack docs prescribe for this composition | `migrated/charts/candlestick-chart.tsx:36` `defineChart, createMark`; header 1–30 |
| `migrated/charts/choropleth-chart.tsx` | 950 | `geoShape` (stock `@tanstack/charts/geo`, `projection: geoMercator`) | **YES** — mark itself is TanStack-native, but zoom/pan is custom `@visx/zoom` matrix (`createProvidedZoom`, ~190 lines) applied as CSS `transform` on a wrapper (TanStack owns the SVG); imperative `ChoroplethHoverChrome` via `data-ts-key` lookup; dual-timer reveal (800 ms `isLoaded` + 1100 ms WAAPI) | `migrated/charts/choropleth-chart.tsx:55–56` `defineChart`/`geoShape`; `migrated/charts/internal/choropleth-hover-chrome.ts` |
| `migrated/charts/composed-chart.tsx` | 875 | `lineY` (stock) + `areaFill` (custom) + `seriesBarMark` (custom `createMark`) | **YES** — custom `seriesBarMark` (stock `barY`'s `inferBandwidth` ×0.8 mis-sizes composed bars ~9%); `areaFill` heap rationale as above; single-pass `extractComposed` preserving cross-role encounter order | `migrated/charts/composed-chart.tsx:73` `d3Curve, defineChart, lineY`; `migrated/charts/internal/series-bar-mark.ts:12` |
| `migrated/charts/funnel-chart.tsx` | 848 | **None** — plain `<svg>`/`<div>`, no `defineChart`/`Chart` | **YES — FULLY CUSTOM (GAP)** — `ResizeObserver` + pixel trapezoid math (`hSegmentPath`/`vSegmentPath`) with no `x`/`y` scale domain; one WAAPI per-ring reveal; `FunnelHoverCoordinator` + `createFunnelSegmentHoverRuntime`; follows D30 authorized escape clause | `migrated/charts/funnel-chart.tsx:1–35` header |
| `migrated/charts/gauge.tsx` | 1000 | Arc path: `polar` + 2× `radialArc` (stock `@tanstack/charts/polar`); Linear path: **none** (plain `<svg>`) | **YES** — linear orientation re-implements plain SVG (no `defineChart`); arc uses stock marks but WAAPI via `reconcileGaugeReveal` + `renderChartSvgWithResources` gradients; `usePrefersReducedMotion` vs TanStack `respectReducedMotion`; `children` defs only honored on linear | `migrated/charts/gauge.tsx:106–109` `Chart`/`defineChart`/`polar, radialArc`/`renderChartSvgWithResources`; header D82 |
| `migrated/charts/heatmap-chart.tsx` | 606 | Delegates to `HeatmapCells` which uses `cell` (stock `@tanstack/charts`) via `defineChart({ marks:[cell(...)] })` | **YES** — outer `HeatmapChart` is custom scaffolding (`ResizeObserver`, `HeatmapChartLifecycle` phase machine, separator/axis portals); TanStack `cell` is confined to `internal/heatmap-components.tsx`; hover is external `HeatmapHoverCoordinator`, not TanStack focus | `migrated/charts/heatmap-chart.tsx:1–48`; `migrated/charts/internal/heatmap-components.tsx:17` `defineChart, cell` |
| `migrated/charts/line-chart.tsx` | 362 | `lineY` (stock, one per `<Line>`, `d3Curve(curveNatural)`) | **YES** — local `scaleUtc`/`scaleLinear` with decimation (`decimateTimeSeries`); `XAxisOverlay`/`YAxisOverlay` HTML overlays vs TanStack guides; `attachHoverChrome` imperative; phase via custom reveal | `migrated/charts/line-chart.tsx:9–10` `Chart`/`d3Curve, defineChart, lineY` |
| `migrated/charts/live-line-chart.tsx` | 958 | `liveLineMark` (custom `createMark` bundling `area`+`polyline` per series, `curveMonotoneX`) | **YES** — custom mark + continuous rAF loop (`LERP_SPEED=0.08`, `LIVE_FRAME_COMMIT_MS=32` throttled `startTransition`); native pointer listeners → ref (`cursorXRef`), not TanStack focus; `animate:false` (motion from outer lerp) | `migrated/charts/live-line-chart.tsx:40–41` `d3Curve, defineChart`; `migrated/charts/internal/live-line-mark.ts:5` |
| `migrated/charts/pie-chart.tsx` | 725 | `polar` + `radialArc` (stock, one `radialArc` over `pieRows` from `d3-shape pie().sort(null)`) | **YES** — stock marks but WAAPI angular-sweep reveal (64 uniform samples to avoid `d` discrete interpolation, D51), imperative hover springs (`pie-hover-chrome.ts`), `focusDisabled`, `data-ts-key` DOM queries; `PieCenter` via imperative variant grid | `migrated/charts/pie-chart.tsx:56–58` `defineChart`/`focusDisabled`/`polar, radialArc` |
| `migrated/charts/radar-chart.tsx` | 549 | `polar` + `radialArea` + `radialDot` + `angleGrid` (all stock `@tanstack/charts/polar`) + `bklitRadarGrid` (custom `PolarGuide`) | **YES** — custom `bklitRadarGrid` because `radialGrid({shape:"polygon"})` cannot reproduce half-step vertex offset; lightweight `useLayoutEffect` DOM walk for dim/glow/scale/dot-size; `focus:"nearest"` used | `migrated/charts/radar-chart.tsx:19–20` `defineChart`/`angleGrid, polar, radialArea, radialDot`; `migrated/charts/internal/radar-reveal.ts:15` |
| `migrated/charts/ring-chart.tsx` | 819 | `polar` + `radialArc` (stock, 2× per ring: track + progress) | **YES** — same class as pie: WAAPI two-phase reveal (track scale-pop + progress sweep), imperative hover springs with `settleAtRest()` hazard gate, `focusDisabled`; `RingCenter` via sanctioned `CenterStat`/`NumberFlow` island | `migrated/charts/ring-chart.tsx:40–43` `Chart`/`defineChart`/`focusDisabled`/`polar, radialArc` |
| `migrated/charts/sankey-chart.tsx` | 577 | `createSankeyMark` (custom `createMark`, single mark for links+nodes) | **YES — GAP** — app-run `d3-sankey` layout (`computeSankeyLayout`) fed into one custom mark; gradient/label injection via `onRender`; WAAPI reveal + CSS 0.18s hover transitions; element-ref arrays, no `data-ts-key` queries | `migrated/charts/sankey-chart.tsx:31` `defineChart`; `migrated/charts/internal/sankey-mark.ts:5` `createMark` |
| `migrated/charts/scatter-chart.tsx` | 715 | `dot` (stock, one per `<Scatter>` series; radial gradient fill reproduces ring+gap) | **YES** — custom `ChartScale` object for `xRangePadding` to survive `resolveConfiguredScale` (plain scale's `.range()` is overwritten); WAAPI per-circle imperatives via `onRender`; `attachScatterHoverChrome` dims via imperative copy | `migrated/charts/scatter-chart.tsx:21` `defineChart, dot`; header D14 |
| `migrated/charts/sunburst-chart.tsx` | 707 | `polar` + `radialArc` with custom `d3-shape arc()` generator (`geometryFor`→`ringOptions` radii) | **YES** — custom `arc()` generator per-datum (not a channel value); depth opacity baked into `fill` string (no `fillOpacity` channel); WAAPI reveal (ring-staggered, 64 samples) + zoom (30 samples, 25 ms/frame); focus state deferred until WAAPI finishes | `migrated/charts/sunburst-chart.tsx:41–44` `Chart`/`defineChart`/`focusDisabled`/`polar, radialArc`/`arc` |
| `migrated/charts/children.tsx` | 163 | None — config-carrier children (return `null`, `CHART_ROLE` Symbol) | **NO** — consolidation of bklit's 6 ad-hoc `displayName` string matchers (`research/phase-2/bklitui-native` §3.10) into one canonical `roleOf()` walker; flag for Step 0.3 to verify no residual `displayName` matchers remain elsewhere | `migrated/charts/children.tsx:24` `CHART_ROLE`; `roleOf()` |
| `migrated/charts/index.ts` | 226 | Re-export barrel | **NO** | `migrated/charts/index.ts:1` |
| `migrated/charts/styles.css` | 817 | No marks — hand-authored CSS ports Tailwind clamp/typography for centers, labels, heatmap, funnel typography | **N/A** — bypasses Tailwind `@source` scan; verify visual parity via screenshot diff in Step 0.3 | `migrated/charts/styles.css:1` |

Measurement source: `wc -l migrated/charts/*.tsx migrated/charts/*.ts migrated/charts/*.css` (see §5).

> TanStack-native baseline (contrast): a stock chart is `defineChart({ marks:[lineY|barY|dot|cell|radialArc|geoShape], x:{scale}, y:{scale}, guides:false, animate:true })` rendered by a single
> `<Chart definition={definition}>`, with sizing via `<Chart height|aspectRatio>` +
> TanStack's internal `ResizeObserver`, interaction via `defineChart(def, { focus:'group-x', tooltip:true })`
> callbacks, and animation via `reconcileChartSvg` tweens — no local `scaleLinear` range
> math, no `ParentSize`/`ParentSize debounceTime={10}`, no `motion`/`WAAPI` layer,
> no `querySelector[data-ts-key]`.
> See `research/phase-2/tanstack-native/00-README.md`, `01-load.md` (`defineChart`→`Chart`→
> `RendererChart`→`mountChartRenderer`), `02-render.md` (keyed reconcile), `03-hooks-and-updates.md`,
> `04-interactivity.md`; bklit-native contrast in `research/phase-2/bklitui-native/00-README.md` §Entry/Sizing/Animation.

---

## 2. Internal helpers table

64 files, `wc -l` in the second column, purpose in one line, primary consumers,
and a TanStack-native vs custom-overhead classification. **Candidates flagged
with `→ 0.3`** require the per-chart audits to rule on necessity/performance
impact — this inventory does not conclude.

| Internal file | Lines | Purpose | Used-by charts | TanStack-native vs custom overhead |
|---------------|-------|---------|----------------|------------------------------------|
| `internal/area-fill-mark.ts` | 95 | Minimal `area` mark replacing `areaY` to avoid per-datum `ChartPoint` heap | `area`, `composed` | **Custom overhead** — heap optimization at cost of duplicating `areaY` top/bottom logic; candidate → 0.3 to verify G4 headroom still holds |
| `internal/bar-hover-chrome.ts` | 455 | Imperative crosshair/dot/box/pill + per-category bar dim for bars | `bar` | **Custom overhead** — replaces TanStack `focus`/`tooltip` with spring-driven DOM writes |
| `internal/bar-x-axis-overlay.tsx` | 90 | HTML `left:bandCenterX` category labels, modulo-thinned (`ceil(count/maxLabels)`) | `bar` | **Custom overhead** — HTML overlay vs TanStack `x.guide`/`format` auto-guides |
| `internal/bezier-easing.ts` | 19 | JS solver for `cubic-bezier(0.85,0,0.15,1)` reveal easing | `line`, `area`, `bar`, `scatter`, `composed` (via `y-ticks`/`hover` timing) | **Custom overhead** — TanStack `animate:{easing}` already supports linear/ease presets; → 0.3 check if duplicate |
| `internal/bisect.ts` | 38 | `bisectDateLeft` + `resolveNearestIndex` binary search | `scatter`, `live-line`, `composed`, `line` | **Custom overhead** — TanStack `spatialIndex`/`focus:'nearest-x'` could replace |
| `internal/candle-spring.ts` | 217 | Verbatim `motion-dom` spring `duration/bounce→{stiffness,damping}` + WAAPI keyframe sampler | `candlestick` | **Custom overhead** — re-implements framer physics to feed WAAPI; audit vs TanStack `animate:true` path |
| `internal/candlestick-hover-chrome.ts` | 445 | Imperative highlight + crosshair/tooltip for OHLC (hoveredCandleIndex dim) | `candlestick` | **Custom overhead** — imperative hover vs `defineChart({ focus })` |
| `internal/center-stat.tsx` | 225 | Shared `CenterStat` + `NumberFlow` digit-roll island + `useCenterStatHover` | `ring`, `gauge` (arc+linear) | **Sanctioned React island** — disclosed exception to D10; → 0.3 verify `useSyncExternalStore` scope stays minimal |
| `internal/choropleth-graticule.tsx` | 74 | `geoGraticule`+`geoPath` graticule `<path>` overlay driven by chart projection | `choropleth` | **Custom overhead** — TanStack `geoShape` has no graticule primitive |
| `internal/choropleth-hover-chrome.ts` | 213 | Hover dim to 0.4 + centroid-placed tooltip via `geoCentroid` + `applyMatrixToPoint` | `choropleth` | **Custom overhead** — replaces TanStack tooltip anchor |
| `internal/decimate.ts` | 93 | LTTB + OHLC-preserving downsampler, `maxRenderPointsForWidth(innerWidth*1.5)` | `line`, `area`, `composed`, `candlestick` | **Custom overhead** — TanStack has no decimation; bklit parity but → 0.3 measure if redundant at bench n=100 |
| `internal/deferred-reveal.ts` | 151 | `onPostPaint` (rAF×2+timeout) + `checkRevealGuard` (`bkmRevealed` flag) + `setRevealDeadline` | `bar`, `scatter`, `gauge`, `sunburst`, `composed`, `candlestick`, `choropleth`, `funnel` | **Custom overhead** — WAAPI reveal orchestrator; compare with TanStack `animate:true` in 0.3 |
| `internal/focus-disabled.ts` | 12 | `focusDisabled` re-export / sentinel disabling TanStack native focus | `pie`, `ring`, `sunburst`, `gauge`, `choropleth` | **TanStack-native** — thin wrapper around `@tanstack/charts/focus/disabled` |
| `internal/formatters.ts` | 24 | `shortDateFmt`/`weekdayDateFmt`/`hmsTimeFmt` (`Intl.DateTimeFormat`) + `intFmt` (`Intl.NumberFormat`) | `bar`, `funnel`, `heatmap`, `live-line`, `sankey` | **Bklit-parity** — otherwise TanStack `x.format`/`tooltip.format` could cover; trivial cost |
| `internal/funnel-geometry.ts` | 160 | `hSegmentPath`/`vSegmentPath` cubic-Bezier trapezoid paths + ring halo computation | `funnel` | **Custom overhead (GAP)** — no TanStack funnel primitive |
| `internal/funnel-hover-chrome.ts` | 133 | Per-ring `scaleY`/`scaleX` pop springs + graphic/label dim | `funnel` | **Custom overhead (GAP)** |
| `internal/funnel-reveal.ts` | 139 | `resolveEnterTransition`/`revealTiming` spring-or-tween dispatch for funnel segments | `funnel` | **Custom overhead (GAP)** |
| `internal/gauge-center.tsx` | 290 | `GaugeCenterOverlay` (double-rAF intro) + `GaugeLabelStat` + `GaugeLabelLayout` | `gauge` | **Custom overhead** — center overlay; linear label path has no TanStack equivalent |
| `internal/gauge-notch.ts` | 455 | `computeLinearNotches` + `createNotchPath` + `interpolateGaugeHex` + fill resolvers | `gauge` | **Custom overhead (GAP)** — polygon notch geometry |
| `internal/gauge-reveal.ts` | 233 | `reconcileGaugeReveal` key-diffing WAAPI reconciler (mount + value-update spring-pop) | `gauge` | **Custom overhead** — replaces TanStack reconcile animation |
| `internal/heatmap-animation.ts` | 118 | `HEATMAP_DEFAULT_ENTER_DURATION_MS` (1600) + transition presets | `heatmap` | **Custom overhead** — heatmap-specific timing not via TanStack `animate` |
| `internal/heatmap-colors.ts` | 141 | `resolveHeatmapLevelStyles` + `buildHeatmapColorScale/ FillScale` | `heatmap` | **Custom overhead** — binned color ramp |
| `internal/heatmap-components.tsx` | 867 | `HeatmapCells` (`cell` mark via `defineChart`), `HeatmapXAxis`/`YAxis`, `HeatmapTooltip`, `HeatmapSeparator` | `heatmap` | **Mixed** — `cell` mark is TanStack-native; surrounding lifecycle/hover/portal layers are custom |
| `internal/heatmap-context.ts` | 73 | `HeatmapContext` + `useHeatmap` (margin, bin size, scales) | `heatmap` | **Custom overhead** — replaces TanStack's auto-margin/scales |
| `internal/heatmap-hover-chrome.ts` | 163 | `createHeatmapHoverCoordinator` (cell + legend + tooltip state) + `paintHeatmapCellHover` | `heatmap` | **Custom overhead** |
| `internal/heatmap-interaction.tsx` | 121 | `HeatmapInteractionProvider`/`HeatmapInteractionBoundary` context | `heatmap` | **Custom overhead** |
| `internal/heatmap-legend.tsx` | 257 | `HeatmapLegend`/`HeatmapLegendGradient` + swatch hover mirroring | `heatmap` | **Custom overhead** |
| `internal/heatmap-lifecycle.ts` | 109 | `useHeatmapChartLifecycle` — `revealing→ready` / `exitingReady→loading` phase machine | `heatmap` | **Custom overhead** — second lifecycle impl beside TanStack's own; → 0.3 compare with `use-chart-phase-orchestrator` analog |
| `internal/heatmap-utils.ts` | 825 | Calendar math (week alignment, separators, month anchors), color-scale builders, ghost-bin logic | `heatmap` | **Custom overhead** — largest internal file; self-contained domain logic |
| `internal/hover-chrome.ts` | 682 | Generic `attachHoverChrome` (crosshair/dot/box/pill, springs) for time-series line/area | `line`, `area`, `composed` | **Custom overhead** — duplicates TanStack tooltip/focus with per-chart springs |
| `internal/index.ts` | 88 | Barrel re-export of `heatmap-utils`/`heatmap-colors`/`heatmap-components` | `heatmap` | **TanStack-native (barrel)** |
| `internal/live-hover-chrome.ts` | 547 | Live tip chrome: five-decoration dim + crosshair/tooltip for `LiveLineChart` rAF loop | `live-line` | **Custom overhead** — per-tick hover resolution via refs |
| `internal/live-line-mark.ts` | 123 | `liveLineMark` bundling sibling `area`+`polyline` scene groups in one `createMark` | `live-line` | **Custom overhead** — avoids two-mark data/scale init duplication |
| `internal/parse-aspect-ratio.ts` | 5 | `parseAspectRatio("16 / 9"→ratio)` string parser | `line`, `area`, `bar`, `scatter`, `composed`, `choropleth` | **Custom overhead (trivial)** — mirrors `docs/LOG.md` `aspectRatio` handling |
| `internal/pie-center.tsx` | 242 | `PieCenter` N+1 variant grid, `PieStableContext`/`PieHoverCoordinatorContext` | `pie` | **Custom overhead** — imperative `display` toggle, no React hover state |
| `internal/pie-geometry.ts` | 67 | `pieArcPath` + `sliceMidOffset` (d3 arc helpers) | `pie`, `ring`, `gauge` | **Custom overhead** — geometry not in TanStack |
| `internal/pie-hover-chrome.ts` | 240 | `createPieHoverCoordinator` + `createPieSliceHoverRuntime` (translate/grow/fade) | `pie` (reused by `ring`,`funnel`) | **Custom overhead** — spring-driven slice pop |
| `internal/pie-reveal.ts` | 177 | `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes` for angular sweep | `pie` | **Custom overhead** — WAAPI 64-sample sweep |
| `internal/radar-reveal.ts` | 109 | `bklitRadarGrid` custom `PolarGuide` + `radar-reveal` timing | `radar` | **Custom overhead** — TanStack `radialGrid` insufficient |
| `internal/radar-spring.ts` | 49 | `estimateSpringSettleMs`/`sampleSpringProgress` generic spring sampler | `pie`, `ring`, `gauge`, `funnel` (via `candle-spring`) | **Custom overhead** — WAAPI spring emulation |
| `internal/ring-center.tsx` | 102 | `RingCenter` via `CenterStat`/`NumberFlow` + `useCenterStatHover` | `ring` | **Sanctioned React island** — as `center-stat` |
| `internal/ring-hover-chrome.ts` | 168 | `createRingHoverRuntime` with `settleAtRest()` two-writer hazard gate | `ring` | **Custom overhead** |
| `internal/ring-reveal.ts` | 174 | Two-phase expand+progress timing for ring tracks | `ring` | **Custom overhead** |
| `internal/sankey-animation.ts` | 288 | `injectGradientDefs` + `injectSankeyLabels` + `runSankeyReveal` | `sankey` | **Custom overhead (GAP)** |
| `internal/sankey-hover-chrome.ts` | 160 | Connectivity hover (`computeNodeHoverConnected`/`computeLinkHoverConnected`) | `sankey` | **Custom overhead (GAP)** |
| `internal/sankey-layout.ts` | 117 | `computeSankeyLayout` thin wrapper over `d3-sankey` `sankeyCenter().extent()` | `sankey` | **Custom overhead (GAP)** — app-owned layout |
| `internal/sankey-mark.ts` | 149 | `createSankeyMark` — single `createMark` emitting `rect` nodes + ribbon paths | `sankey` | **Custom overhead (GAP)** |
| `internal/scatter-hover-chrome.ts` | 504 | Scatter hover: per-series enlarged undimmed copy of hovered point | `scatter` | **Custom overhead** |
| `internal/series-bar-layout.ts` | 68 | `computeSeriesBarWidth` (composed `composedBarSize`/`composedMaxBarSize`/`composedBarGap=4`, 92% slot shrink) | `composed` | **Custom overhead** — negotiates stock `barY` incompatibility |
| `internal/series-bar-mark.ts` | 166 | Custom `seriesBarMark` — absolute pixel `rect` positioning via precomputed bar widths | `composed` | **Custom overhead** — absolute-pixel bypass of TanStack band inference |
| `internal/spring.ts` | 100 | Minimal `createSpring` rAF integrator (mass 1, stiffness/damping, `jump`/`set`/`stop`) | `bar`, `line`, `area`, `pie`, `ring`, `funnel`, `heatmap`, `live-line` | **Custom overhead** — replaces `framer-motion`/`useSpring`; → 0.3 audit for rest-threshold correctness (D51) |
| `internal/sunburst-center.tsx` | 78 | `SunburstCenter` config carrier + `SunburstCenterOverlay` | `sunburst` | **Custom overhead** |
| `internal/sunburst-colors.ts` | 35 | `defaultSunburstColors` + `opacityForRelativeDepth` | `sunburst` | **Bklit-parity (trivial)** |
| `internal/sunburst-geometry.ts` | 503 | `buildArcs`/`geometryFor`/`ringOptions`/`transitionGeometry` hierarchy math | `sunburst` | **Custom overhead (GAP-adjacent)** — `d3-hierarchy` partition logic |
| `internal/sunburst-hint.tsx` | 42 | `SunburstHint` config carrier + `SunburstHintDisplay` | `sunburst` | **Custom overhead** |
| `internal/sunburst-hover-chrome.ts` | 112 | `createSunburstHoverCoordinator` + `SunburstSliceHoverRuntime` (opacity+WAAPI) | `sunburst` | **Custom overhead** |
| `internal/sunburst-labels.tsx` | 92 | `SunburstLabels` config carrier + `SunburstLabelsOverlay` | `sunburst` | **Custom overhead** |
| `internal/sunburst-reveal.ts` | 165 | `buildRevealTiming` (ring-staggered) + `buildRevealKeyframes` / `buildZoomKeyframes` | `sunburst` | **Custom overhead** |
| `internal/sunburst-types.ts` | 48 | `SunburstNode`/`ArcDatum`/`Focus` types | `sunburst` | **Types only** — no overhead |
| `internal/types.ts` | 304 | `ChartDatum`, `ChartPhase`/`ChartStatus`, `LineConfig`/`AreaConfig`/`BarConfig` etc. | all cartesian | **Types only** |
| `internal/use-prefers-reduced-motion.ts` | 15 | `usePrefersReducedMotion` via `matchMedia('(prefers-reduced-motion: reduce)')` | `gauge` | **Custom overhead** — mirrors TanStack `respectReducedMotion` but via separate hook |
| `internal/x-axis-overlay.tsx` | 116 | `XAxisOverlay` — `selectEvenlySpacedIndices` ticks from rendered (decimated) data | `line`, `area`, `composed`, `scatter`, `candlestick` | **Custom overhead** — HTML overlay vs TanStack guides |
| `internal/x-ticks.ts` | 284 | `selectEvenlySpacedIndices` combinatorial even-spacing tick search (`MAX_GAP_LAYOUTS=400`) | `line`, `area`, `composed`, `scatter`, `candlestick` | **Custom overhead** — TanStack's `ticks` option + auto-guides vs bklit's own data-aligned tick picker |
| `internal/y-axis-overlay.tsx` | 127 | `YAxisOverlay` — precomputed or auto `scaleLinear.ticks(numTicks)` HTML labels | `line`, `candlestick`, `composed` | **Custom overhead** — HTML gutter vs TanStack `y.guide` |

Sampling source: each file's opening header comment (first ~30 lines) plus `wc -l`
counts; full catalogue verified via `ls -1 migrated/charts/internal/` (64 files).

---

## 3. Per-chart capsules

One paragraph per migrated chart: what it does, which TanStack patterns it already
follows, which bklit patterns it still carries, and a design/animation fidelity
note. Each capsule ends with a **→ 0.3** candidate for audit verification.

### AreaChart (`migrated/charts/area-chart.tsx`, 483 lines)

Stacked-time area chart rendering one `areaFill` (custom `createMark`) fill per
`<Area dataKey>` under a `lineY` boundary stroke, with `scaleUtc`/`scaleLinear`
(`curveMonotoneX`, `fadeEdges` default false differing from Line's `curveNatural`/true)
and `defineChart` rendered by a single `<Chart>` — TanStack-native at the mark
definition level — but hover is fully imperative (`internal/hover-chrome.ts`
`attachHoverChrome`, shared with Line, dim to `0.6` not `0.3`) and axes are HTML
overlays (`XAxisOverlay` via `x-ticks.ts`), carrying bklit's tick-selection algorithm
and `motion`-era reveal easing (`bezier-easing.ts`/`deferred-reveal.ts`) rather than
TanStack `animate:true` + `x.format` guides; design fidelity is the gradient-fade
fill (gradient stop opacity, not shape `fillOpacity` — verified as byte-identical
to bklit) and clip-reveal timing; → 0.3 verify whether `areaFill`'s heap saving
remains justified after TanStack `areaY` improvements and whether HTML axis
overlays can be replaced by `x.ticks`/`y.ticks` + `color` legend.

### BarChart (`migrated/charts/bar-chart.tsx`, 542 lines)

Vertical grouped bar chart (pilot scope: no stacking/horizontal/perspective/square
variants) building one stock `barY` per `<Bar>` with a nested `groupScale`
`scaleBand` for `individualBarWidth`/`groupGap=4` math, `defineChart` + `<Chart>` —
TanStack `barY` is native — but the chart reconstructs a margin-inclusive
`scaleBand`/`scaleLinear` range in parallel to TanStack's own `resolveConfiguredScale`
(verified not to drift), resolves hover by band index (`Math.floor((x-margin.left)/columnWidth)`)
via a native `pointermove` listener rather than TanStack `focus`, dims bars per
category index via direct `rect[fillOpacity]` writes (`bar-hover-chrome.ts`),
and drives a WAAPI stagger reveal by querying `.ts-chart__bar-y`; bklit's
`BarDepth`/`BarSquares` branches remain out-of-scope stubs; design note:
`BarXAxisOverlay` (modulo thinning) reproduces bklit's `bar-x-axis.tsx` tick
choice, not the line/scatter data-aligned optimizer; → 0.3 check if `bandWidth`
path can be expressed via `barY`'s `groupScale` + stock `focus:'group-x'` instead
of the parallel scale + custom hover math.

### CandlestickChart (`migrated/charts/candlestick-chart.tsx`, 826 lines)

OHLC candlestick chart consuming `OHLCDataPoint[]`, decimated via
`decimateOhlcData`/`maxRenderPointsForWidth`, rendering wicks+bodies as **two
custom `createMark` marks** (not TanStack `link`+`rect` the docs prescribe as the
composed alternative) — the custom marks emit `rule`/`rect`-like `SceneNode`s via
`render({scales})` → imperative `scene.nodes`, justified as GAP per D82.2/D83
but a candidate for re-evaluation — with hover as its own
`candlestick-hover-chrome.ts` band and WAAPI reveal via `candle-spring.ts`'s
verbatim `motion-dom` spring sampler (60 keyframes, duration 800 ms bounce 0.15)
instead of TanStack reconcile tweens; axes via `XAxisOverlay`/`YAxisOverlay`;
TanStack-native elements are `defineChart` + `<Chart>` lifecycle only; design
note: `WICK_WIDTH 1.5`, `scaleY` spring grow on mount; → 0.3 audit whether the
two custom marks can be replaced by stock `link` (wick) + `rect` (body, ranged)
marks with identical `x: {scale: scaleTime}` domain, eliminating the custom-mark
maintenance cost.

### ChoroplethChart (`migrated/charts/choropleth-chart.tsx`, 950 lines — largest chart file)

Geo choropleth rendering GeoJSON `FeatureCollection` via the stock TanStack
`geoShape(features, { projection: geoMercator(), fill: resolveFeatureFill })`
mark inside `defineChart({ x:null,y:null,guides:false,margin:0 })` + `<Chart>` —
the marks layer is fully TanStack-native (TanStack docs' prescribed primitive) —
but zoom/pan is a **170-line manual `ProvidedZoom` implementation**
(`createProvidedZoom`) over `@visx/zoom`'s `TransformMatrix` applied as a CSS
`transform` on a wrapper `<div>` (TanStack owns the SVG), with bespoke wheel
(0.95/1.05), drag, and pinch handling plus `clamp` min/max and 180 ms ease; reveal
is dual-timer (`animationDuration` 800 ms `isLoaded` + 1100 ms WAAPI
`.ts-chart__geo` opacity) and hover is `choropleth-hover-chrome.ts` (dim 0.4,
centroid tooltip via `geoCentroid` + `applyMatrixToPoint` zoom correction); the
graticule is a separate `d3-geo` SVG overlay, not a TanStack guide; design note:
`Mercator center [0,20] scale (innerWidth/630)*100 translate [innerWidth/2, innerH/2+50]`
matches bklit `Mercator` construction verbatim; → 0.3 verify whether zoom can be
expressed via TanStack's documented brush/zoom `onRender` + `focusDisabled` pattern
without a wrapper-transform re-implementation.

### ComposedChart (`migrated/charts/composed-chart.tsx`, 875 lines)

Multi-series time chart combining `lineY` + `areaFill` + `seriesBarMark` on one
shared `scaleUtc` time scale (`scaleLinear` y, `curveMonotoneX`/`curveNatural`
per series), `defineChart({ marks:[...] })` → `<Chart>` — TanStack-native
grammar for composition (the task's “all marks in one `ChartSpec.marks` array”
pattern) — but bars require the custom `seriesBarMark` (`internal/series-bar-mark.ts`,
absolute-pixel `rect` placement via `computeSeriesBarWidth`'s 92%-of-slot shrink)
because stock `barY`'s `inferBandwidth` mispredicts width ~9% in this mixed
context, and area uses the same custom `areaFill` heap rationale as `AreaChart`;
single-pass `extractComposed` preserves bklit's `upsert` encounter order
(`roleOf` + cross-role ordering, not `children.tsx`'s generic `extractChildren`);
hover/reveal via shared `hover-chrome.ts` + `deferred-reveal.ts`; design note:
column-width negotiation is the trickiest bklit parity point (§7 row 7); → 0.3
audit whether `seriesBarMark` can be folded into a `createMark` that reuses
TanStack's scale resolution rather than absolute pixels, to regain zoom/resize
scale reuse.

### FunnelChart (`migrated/charts/funnel-chart.tsx`, 848 lines)

Conversion funnel (stacked trapezoid stages, `FunnelStage[]`) rendering **plain
SVG/HTML without `defineChart`/`Chart` at all** — the largest GAP verdict in the
set (TanStack has no funnel primitive; docs/LOG.md D30 authorized plain-SVG escape
identical to `gauge-linear`'s precedent) — so TanStack-native patterns are
limited to the `FunnelEnterTransition` type shape; bklit patterns carried include
`ResizeObserver` measurement, cubic-Bezier segment paths (`hSegmentPath`/`vSegmentPath`),
halo-ring layers (`layers=3` by default), `FunnelHoverCoordinator` reusing
`PieHoverCoordinator`'s contract with axis-specific `scaleY`/`scaleX` pops,
and a per-segment WAAPI reveal; design/animation fidelity notes: label layout
(`spread`/`grouped`, `labelOrientation`, `labelAlign`) and grid bands/lines are
ported as byte-identical flexbox/inline-style composition; reveal uses
`resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes` 64-sample sampling
to avoid `d` discrete interpolation; → 0.3 Fable review per the file's own
instruction — verify WAAPI vs TanStack `animate` seam and whether the plain-SVG
structure can later adopt `createMark` without reintroducing an empty
`x: null`/`y: null` cartesian wrapper.

### Gauge (`migrated/charts/gauge.tsx`, 1000 lines)

Segmented notch meter (`value` 0–100 → `round(value/100*totalNotches)` active
notches) dispatching on `orientation`: **arc** uses stock `polar` + 2× `radialArc`
(`bg` track + `active` overlay, per-datum `startAngle`/`endAngle`, `radiusRatio:1`,
`focus:FOCUS_DISABLED`) via `defineChart` + `Chart` with
`renderChartSvgWithResources` gradients, while **linear** re-implements the entire
track as plain SVG (`computeLinearNotches` → `createNotchPath` quads), so only the
arc path is TanStack-native; shared bklit patterns include `gauge-notch.ts`
notch math, `gauge-reveal.ts`'s single `reconcileGaugeReveal` WAAPI engine for
both mount and value-update (spring-pop newly-active notches, instant vanish on
decrease), `CenterStat`/`NumberFlow` center readout (`GaugeCenterOverlay`
double-rAF intro for arc, direct pass-through for linear), and
`usePrefersReducedMotion`; disclosed gaps: arc cannot render arbitrary caller
`<linearGradient>`/`<pattern>` `children` defs, linear track has no cartesian
domain; design note: floating clamp typography ported as hand-authored CSS
(`styles.css .ts-bkm-gauge-*`); → 0.3 audit linear path for possible `barX` or
`rect` custom-mark representation and arc's `children` defs extension point.

### HeatmapChart (`migrated/charts/heatmap-chart.tsx`, 606 lines + `internal/heatmap-*` 2750+ lines)

Calendar/grid heatmap reusing bklit's `HeatmapColumn` model (`bins` per column)
with a distinct architecture from cartesian charts: outer `HeatmapChart` → inner
`HeatmapChartInner` measuring `width`/`height` (custom `ResizeObserver`, not
TanStack `width` prop) and building `HeatmapContext` (`xScale`/`yScale` as
`(index)=>index*binWidth+offset`, not D3 scales), while **`HeatmapCells` is the
TanStack-native island** — `defineChart({ marks:[cell(cellData, {x:colKey,y:rowKey,z:level})],
x:{scale:scaleBand}, y:{scale:scaleBand}, color:{scale:scaleOrdinal}, animate:false })`
→ `<Chart>` (TanStack `cell` is the native mark); bklit patterns include the full
calendar-math domain (`heatmap-utils.ts` 825 lines: week alignment, separators,
`filterHeatmapColumns`, ghost-bin logic), `useHeatmapChartLifecycle`'s independent
phase machine (`revealing→ready`, `exitingReady→loading` with `HEATMAP_LOADING_CONCEAL_MS`),
and an imperative `HeatmapHoverCoordinator` + separate `HeatmapTooltip` with
`createPortal` into `htmlLayerEl`; the 364-cell hover dim uses `paintHeatmapCellHover`
(CSS 0.22s `cubic-bezier(0.4,0,0.2,1)` tween, not springs) and white-fill overlay rects
plus a highlight border; → 0.3 audit whether the cell lifecycle can be unified
with TanStack `animate:true` rather than the second phase machine inherited from bklit.

### LineChart (`migrated/charts/line-chart.tsx`, 362 lines — smallest chart, simplest scope)

Cartesian multi-line chart (`Line dataKey` per series, `xDataKey="date"`), one
stock `lineY` per series (`curveNatural`, `strokeWidth` default 2.5,
`fadeEdges` default true) into a single `defineChart({ marks:[lineY(...)], x:{scale:scaleUtc},
y:{scale:scaleLinear.nice()}, margin })` → `<Chart>` — the most TanStack-native
cartesian chart (the pilot's reference for compositional API parity: `CHART_ROLE`
walk, `defineChart` spec, commit-once SVG) — but it retains bklit's local
`scaleUtc`/`scaleLinear` construction + `decimateTimeSeries` LTTB path,
HTML `XAxisOverlay`/`YAxisOverlay` via `x-ticks.ts`/`parseAspectRatio` vs TanStack auto-guides,
and `attachHoverChrome` imperative crosshair/dot/box/pill with
`createSpring` rAF springs; design fidelity: decimated `renderData`
(`maxRenderPointsForWidth(innerWidth*1.5)`) + reveal clip (via
`deferred-reveal.ts`) + `bezier-easing.ts` y-tween; → 0.3 verify decimation
necessity at bench `n≤100` and whether guides can move to TanStack.

### LiveLineChart (`migrated/charts/live-line-chart.tsx`, 958 lines)

Real-time append-only streaming chart (push-model `data: LiveLinePoint[]` `time/value`,
`window` seconds cutoff, `paused`, momentum-based recolor `detectMomentum`),
rendering via a **custom `liveLineMark`** (`internal/live-line-mark.ts`,
one `createMark` bundling an `area` fill group + `polyline` stroke group per
series so data scales initialize once) fed into `defineChart({ marks:[liveLineMark(...)],
x:{scale:scaleTime}, y:{scale:scaleLinear}, margin, animate:false })` → `<Chart>` —
the marks layer is custom, but the shell reuses TanStack's keyed reconcile (the
~30 fps `LIVE_FRAME_COMMIT_MS=32` `startTransition` cost is intentional, D22 M3b);
bklit patterns include the full `live-line-chart.tsx` tick loop port (`nextAnimFrame`
LERP `0.08`, two synthetic tip points, hysteresis `pickNiceInterval` for Y ticks,
SMIL `<animate>` pulse ring), `attachLiveHoverChrome` ref-only pointer path
(no React hover state), and `hmsTimeFmt`/`decimate`-like windowing; design note:
gradient stroke/area + left-edge fade mask (`linearGradient` with `offset %`)
+ dashed mid-line + five `LiveTipChrome` decorations (glow/solid dot/badge);
→ 0.3 audit whether the rAF lerp can be moved closer to TanStack's streaming
guidance (bounded window + definition rebuild) without losing momentum recoloring.

### PieChart (`migrated/charts/pie-chart.tsx`, 725 lines)

Pie/donut (`PieData[]` via `d3-shape pie().sort(null)` → `radialArc` radii
derived from `pieArcPath` geometry) rendering `polar({inset:hoverOffset,radiusRatio:1,
marks:[radialArc(pieRows, {startAngle,endAngle,padAngle,innerRadius,outerRadius,
cornerRadius})]})` into `defineChart` → `<Chart focusDisabled>` — marks are
TanStack-native polar after the Phase-1.2 redo — but the mount reveal is
WAAPI 64-sample angular sweep (to fix CSS `d` discrete interpolation between
`d:none` and differing command structures, D51), hover is imperative springs via
`pie-hover-chrome.ts` (`translate`/`grow`/`none` effects, `FADE_OPACITY 0.4`,
`spring {400,25}`), center `PieCenter` is an N+1 imperative variant grid
(`display` toggle) with `Intl.NumberFormat` static fallback (no `NumberFlow`
after D49), and scrub layers bypass marks as plain React paths; design notes:
`DEFAULT_HOVER_OFFSET 10`, `cornerRadius`/`padAngle` channels, glow is dead code
ported as `filter:none`; → 0.3 parity audit for `d:"none"` suppression (<0.01 rad)
and staggerScale `0.25–2.5` clamping.

### RadarChart (`migrated/charts/radar-chart.tsx`, 549 lines)

Radar/spider (`RadarData[]` + `RadarMetric[]`, `levels=5`, fixed `domain [0,100]`
radial scale, `angleOffset -PI/2`) rendering
`defineChart({ marks:[polar({angle:{scale:scalePoint}, radius:{scale:scaleLinear 0-100}},
marks:[radialArea(curveLinearClosed), radialDot], guides:[angleGrid, bklitRadarGrid])], x:null,y:null,guides:false })`
→ `<Chart>` with `focus:"nearest"` + `onFocusGroupChange` — polar marks + focus
are TanStack-native, animation is TanStack `animate:true` — but the polar grid is a
**custom `bklitRadarGrid` `PolarGuide`** (half-step vertex offset that
`radialGrid({shape:"polygon"})` cannot reproduce) and hover chrome is a lightweight
`useLayoutEffect` that walks `.ts-chart__radial-dot circle` by `z`-padded series
index and writes `transform`/`opacity`/`r` directly (no coordinator); bklit's
`RadarProvider`/`getPointPosition` geometry is re-derived via `scalePoint`/`scaleLinear`;
→ 0.3 verify `bklitRadarGrid` cannot be expressed via existing `radialGrid` options
before carrying a custom guide.

### RingChart (`migrated/charts/ring-chart.tsx`, 819 lines)

Multi-ring donut (`RingData[]` `value/maxValue/color`, `baseInnerRadius=60`
+ `ringGap=6` + `strokeWidth=12`, auto `scale` to fit) rendering
`polar({inset:padding, marks: [radialArc(trackRow)+radialArc(progressRow)]*rings })`
into `defineChart` → `<Chart focusDisabled>` — marks are TanStack-native after the
Phase-1.2 redo (same transformation that took Ring from 23.2→13.6 ms) — but reveal
is a **two-phase WAAPI** (track `scale` pop + progress angular sweep, 64 samples),
hover is `ring-hover-chrome.ts` with a `settleAtRest()` two-writer hazard gate
(WAAPI vs hover `transform` on the same `scale`), glow/fade are dead-code `filter:none`/`opacity:1`
ported as observed pixels, and `RingCenter` is the sanctioned `CenterStat`/`NumberFlow`
React island (`useCenterStatHover`) with a deferred `setTimeout`-past-M1a mount;
design fidelity is full-circle `d3-arc` `cornerRadius` (branch not taken for 2π)
and `pieArcPath` scrub paths; → 0.3 audit the WAAPI-vs-hover `transform` handoff
and whether the `styles.css` clamp typography can be shared with `pie-center`.

### SankeyChart (`migrated/charts/sankey-chart.tsx`, 577 lines)

Flow diagram (`SankeyData {nodes, links}`, graph-shaped not row-shaped, margin
`{40,180,40,180}` for labels) rendering via a **single custom `createSankeyMark`**
(`internal/sankey-mark.ts`) whose `computeSankeyLayout` wraps `@visx/sankey`
`sankeyCenter().extent([[0,0],[innerWidth,innerHeight]])` + `sankeyLinkHorizontal()`,
with `defineChart` → `<Chart>` scaffolding — custom-mark GAP after D30 (TanStack
has no Sankey primitive; conformance has no `sankey` case) — plus gradient/label/
reveal injection (`sankey-animation.ts`: `injectGradientDefs`, `injectSankeyLabels`,
`runSankeyReveal` WAAPI: nodes `scaleY 0→1` 1100 ms stagger, links `strokeDashoffset`
draw, labels fade) and connectivity hover (`sankey-hover-chrome.ts`:
`computeNodeHoverConnected`/`computeLinkHoverConnected` → `applySankeyHoverStyle`
with `fadedNodeOpacity 0.4`/`fadedLinkOpacity 0.1`, CSS 0.18 s); element-ref arrays
(no `data-ts-key` queries) drive hover listeners; design note: shim shallow-clones
graph before `d3-sankey` mutation, label orientation `horizontal`/`vertical`;
→ 0.3 verify whether `cell`/`rect`/`link` composition (as TanStack's own network
examples do) could express the same layout without a custom mark.

### ScatterChart (`migrated/charts/scatter-chart.tsx`, 715 lines)

Scatter/bubble (`Scatter dataKey` per series, `xDataKey="date"`, `radius`/`fill`/`stroke`
with y-gradient) rendering **one stock `dot` per series**
(`dot(renderData, {x:xAccessor, y:yAccessor, r:radius, fill:"url(#gradient)", stroke,
strokeWidth})` — single `dot` halved DOM node count vs the original 2-marks design)
into `defineChart({ marks:[dot(...)], x:{scale}), y:{scale}, margin, animate:true })`
→ `<Chart>` — TanStack-native marks and animation — but X-scaling is inset by
`xRangePadding` via a **custom `ChartScale` object** (the only mechanism that
survives `resolveConfiguredScale`'s unconditional `.range()` overwrite, verified in
`repos/tanstack-charts/.../configured-scale.ts`), the mount reveal is imperative
WAAPI per-`dot` (`onPostPaint` + `onRender` per-circle tween, 500 ms `ENTER_TWEEN_MS`),
and hover is `scatter-hover-chrome.ts` (bisect + `resolveNearestIndex` + imperative
enlarged undimmed copy of the hovered point per series); `XAxisOverlay` port via
`x-ticks.ts` data-aligned ticks; design note: per-series 0×0 sibling `<svg>`
gradient `url()` technique; → 0.3 audit whether the custom `ChartScale` can be
removed by delegating padding to TanStack `margin` + `inset`.

### SunburstChart (`migrated/charts/sunburst-chart.tsx`, 707 lines)

Hierarchical sunburst (`SunburstNode` tree, `size=520` default, `focusId` drill-down,
`hoverPop=8`, `padding = defaultSunburstGrowPadding(maxDepth,size,hoverPop)`) rendering
a single `polar()` container with **one `radialArc` whose custom `d3-shape arc()`
generator computes per-datum `innerR`/`outerR` via `geometryFor`→`ringOptions`**
(`defineChart({ marks:[polar({marks:[radialArc(arcRows,{endAngle,innerRadius,outerRadius,
generator})]})], x:null,y:null,guides:false, focusDisabled })` → `<Chart>`) —
marks are TanStack-native after the D102 redo, but depth opacity is baked into `fill`
color strings (no `fillOpacity` channel), and reveal + zoom are WAAPI: reveal is
ring-staggered angular sweep (64 samples, 1100 ms, `bezier-easing.ts`), zoom is a
750 ms `transitionGeometry` `d`-keyframe tween (30 frames, `buildZoomKeyframes` via
`sunburst-geometry.ts`'s verbatim bklit `lerpGeometry`); hover is
`sunburst-hover-chrome.ts` (opacity 0.25 `ease-in-out` + WAAPI `d`-keyframe grow,
coalesced `useLayoutEffect` over cached path refs via `data-ts-key`); focus change
is deferred until zoom finishes to avoid a TanStack reconcile jump; design bật
`maxHoverSegmentThickness` / `defaultSunburstGrowPadding`; → 0.3 verify empty
`geometryFor` / <0.01 rad suppression and `bkmRevealed` guard interaction with
`focusId` re-renders.

---

## 4. Summary of overhead categories

13 distinct wrapper/overhead classes found across the 16 migrated chart files
(and 64 internal helpers). Flags use Step 0.3 terminology: **Custom** = extra
layer beyond TanStack; **Native** = TanStack first-party mechanism; **GAP** =
no TanStack primitive exists. Step 0.3 should rule on whether each Custom item
can be absorbed into TanStack-native without losing bench/bench-data/qa fidelity.

| # | Overhead class | What it is | Where it appears | TanStack-native alternative (candidate → 0.3) | Files / lines |
|---|---------------|-----------|-----------------|----------------------------------------------|---------------|
| 1 | **Custom `createMark` where a stock mark exists** | `areaFill` recomputes `curve.area(top,bottom)` without `ChartPoint`s to halve heap; `seriesBarMark` does absolute-pixel rects; `liveLineMark` bundles `area`+`polyline`; candlestick's two marks sidestep `rect`/`link` | `area`, `composed`, `live-line`, `candlestick` | Stock `areaY`/`barY`/`rect`/`link` + TanStack `animate` path | `area-fill-mark.ts:1` (95) `series-bar-mark.ts:12` (166) `live-line-mark.ts:5` (123) `candlestick-chart.tsx:36` (826) |
| 2 | **Custom GAP `createMark` where no stock primitive exists** | `createSankeyMark` (node rects + ribbon paths from `d3-sankey` layout) is the only GAP mark actually wrapped in `defineChart`; `funnel` and `gauge-linear` escape entirely | `sankey` (mixed), `funnel`, `gauge-linear` | Homegrown mark via `createMark` is the sanctioned GAP path (`research/phase-2/tanstack-native/02-render.md` custom-mark guidance); `funnel` flagged for later `createMark({x:null,y:null,guides:false})` wrap | `sankey-mark.ts:5` (149) `funnel-chart.tsx:1` (848) `gauge.tsx:25` (1000) |
| 3 | **Imperative DOM queries bypassing TanStack's renderer** | `querySelectorAll('[data-ts-key]')`, `.ts-chart__marks`, `.ts-chart__bar-y`, `.ts-chart__geo`, `.ts-chart__radial-arc` to collect elements for WAAPI/hover | `bar`, `scatter`, `choropleth`, `pie`, `ring`, `sunburst`, `sunburst-hover-chrome`, `candlestick`, `composed` | TanStack's `onRender` + `scene`/`points` APIs; hoist element handles through React refs where possible | `deferred-reveal.ts:151` (151) `bar-chart.tsx:480` `pie-chart.tsx:446` `sunburst-chart.tsx:41` |
| 4 | **`ResizeObserver` / sizing re-implementation** | Per-chart `ResizeObserver` + `getBoundingClientRect` + `setSz` vs TanStack's host-driven `width`/`height` via `mountChartRenderer` (`renderer.ts:190`) + `aspectRatio` | `heatmap` (outer), `funnel`, `gauge` (both orientations), `choropleth`, `live-line`, `bar` | `<Chart width|height|aspectRatio>` alone; pass 0-width guards via `initialWidth` | `heatmap-chart.tsx:112` `funnel-chart.tsx:632` `gauge.tsx:366` `live-line-chart.tsx:353` |
| 5 | **Spring loaders duplicating TanStack reconcile animation** | Hand-rolled `spring.ts` (`createSpring`, rest-threshold D51) + `candle-spring.ts` (verbatim `motion-dom` Newton iteration) + `radar-spring.ts` sampling, driving `requestAnimationFrame` or WAAPI keyframes | `bar`, `line`, `area`, `pie`, `ring`, `funnel`, `candlestick` | TanStack `defineChart(def, {animate:{duration,easing,resize}})` + `reconcileChartSvg` attribute tweens | `spring.ts:100` `candle-spring.ts:217` `radar-spring.ts:49` `candle-spring.ts` header |
| 6 | **WAAPI reveal orchestration (gated vs ungated)** | `onPostPaint` (rAF×2+timeout) → 64-sample `d` keyframes (to avoid discrete `d:none` bugs, D51) + `bkmRevealed` flag + `setRevealDeadline` + `reconcileGaugeReveal` | `bar`, `scatter`, `pie`, `ring`, `sunburst`, `gauge`, `choropleth`, `funnel`, `candlestick` | TanStack `animate:true` + `reconcileChartSvg` numeric-skeleton `d` tween; compare bench M1a without WAAPI | `deferred-reveal.ts:151` `pie-reveal.ts:177` `ring-reveal.ts:174` `sunburst-reveal.ts:165` `gauge-reveal.ts:233` |
| 7 | **Hover-chrome duplication (`focus`/`tooltip` bypass)** | ~3 200 lines of imperative springs/CSS writes: `hover-chrome.ts`/`bar-hover-chrome.ts`/`scatter-hover-chrome.ts`/`live-hover-chrome.ts`/`candlestick-hover-chrome.ts`/`choropleth-hover-chrome.ts`/`pie-hover-chrome.ts`/`ring-hover-chrome.ts`/`sunburst-hover-chrome.ts`/`funnel-hover-chrome.ts`/`heatmap-hover-chrome.ts`/`sankey-hover-chrome.ts`, plus `scatter-hover-chrome` enlarged-dot copy | All 13 interactive charts | `defineChart(def, {focus:'nearest-x'| 'group-x'| custom Strategy, tooltip:true, maxFocusDistance:48})` + `onFocusChange` callbacks | `hover-chrome.ts:682` `scatter-hover-chrome.ts:504` `bar-hover-chrome.ts:455` etc. |
| 8 | **HTML axis/overlay re-implementation** | `XAxisOverlay` (data-aligned `selectEvenlySpacedIndices` via `x-ticks.ts`), `YAxisOverlay`, `BarXAxisOverlay` (modulo thinning), `ChoroplethGraticuleOverlay` (`geoGraticule` SVG) | `line`, `area`, `scatter`, `composed`, `bar`, `candlestick`, `choropleth` | TanStack `x:{scale, guide:true, ticks, format}` + `y:{...}` + `polar` guides; verify `x.format`/`y.format` parity | `x-axis-overlay.tsx:116` `y-axis-overlay.tsx:127` `bar-x-axis-overlay.tsx:90` `choropleth-graticule.tsx:74` `x-ticks.ts:284` |
| 9 | **Manual decimation / downsampling** | LTTB `decimateTimeSeries` / `decimateOhlcData`, `maxRenderPointsForWidth(innerWidth*1.5)` | `line`, `area`, `composed`, `candlestick` | TanStack has no decimation primitive; candidate to keep, but measure at bench `n=100` where cost may dominate benefit | `decimate.ts:93` |
| 10 | **Custom lifecycle / phase machines** | `useHeatmapChartLifecycle` (`revealing→ready`, `exitingReady→loading`) alongside TanStack's own host-driven render; funnel/heatmap outer `isLoaded`/`revealEpoch` not wired to definition identity | `heatmap`, `funnel` | TanStack definition-identity + `animate` + `hasRendered` gate; unify or document why second machine is required | `heatmap-lifecycle.ts:109` `heatmap-chart.tsx:287` |
| 11 | **`NumberFlow` / React-island center stats** | `center-stat.tsx` (`useNumberFlowElementReady` + `useSyncExternalStore` hover) + `pie-center.tsx`/`ring-center.tsx`/`gauge-center.tsx` — sanctioned D10/D51 islands that re-introduce React re-render on hover | `pie`, `ring`, `gauge` (arc+linear) | TanStack has no `centerStat` primitive; candidate to keep as-is, with scoping audit | `center-stat.tsx:225` `pie-center.tsx:242` `ring-center.tsx:102` `gauge-center.tsx:290` |
| 12 | **App-owned layout engines** | `sankey-layout.ts` (`d3-sankey` mutation + shallow-clone guard), `sunburst-geometry.ts` (hierarchy `buildArcs`/`transitionGeometry`), `funnel-geometry.ts`/`gauge-notch.ts` | `sankey`, `sunburst`, `funnel`, `gauge` | Sanctioned for GAP charts; TanStack sunburst docs do suggest `d3-hierarchy partition` + `radialArc.generator` pattern — compare our `arc()` generator approach | `sankey-layout.ts:117` `sunburst-geometry.ts:503` `funnel-geometry.ts:160` `gauge-notch.ts:455` |
| 13 | **Utility/CSS adaptations** | `parse-aspect-ratio.ts` (string `aspectRatio` parser), `bezier-easing.ts` + `x-ticks.ts` combinatorial search, `use-prefers-reduced-motion.ts`, `styles.css` hand-authored Tailwind-clamp ports (`ts-bkm-center-stat*`, `ts-bkm-gauge-linear-stat-*`, `ts-bkm-funnel-*`) | `line`, `area`, `bar`, `scatter`, `composed`, `choropleth`, `gauge`, `funnel` | TanStack's `aspectRatio` prop already parses numbers; `bezier-easing` duplicates TanStack easing; CSS clamp ports are a `bench/app` scan-scope workaround — verify via screenshot diff | `parse-aspect-ratio.ts:5` `bezier-easing.ts:19` `styles.css:817` |

Cross-check: the 7-stack-comparison invariants that *must* stay TanStack-native per
`research/phase-2/inventory/03-stack-comparison.md` §Implications (do not rebuild
hover in React, do not `animate()+setState`, do not mount per-datum React
components, treat `ChartSurface memo()=>true` as model, let TanStack measure
margins, SSR via `prerender()`) are directly exercised by categories 5/6/7/8/4.

---

## 5. Sizing

### Total lines (`wc -l`)

| Scope | Files | Lines | Source |
|-------|-------|-------|--------|
| `migrated/charts` (chart-level) | 18 files (`*.tsx` + `*.ts` + `*.css` + `children.tsx` + `index.ts`/`styles.css`) | **12 748** | `wc -l migrated/charts/*.tsx migrated/charts/*.ts migrated/charts/*.css` → `12748 total` |
| `migrated/charts/internal` | 64 files | **12 481** | `wc -l migrated/charts/internal/*` → `12481 total` |
| **Combined** | 82 files | **25 229** | sum of above |

### Breakdown by chart file (`migrated/charts/`, descending)

```
 1000  gauge.tsx               (arc polar + linear plain-SVG; largest single chart)
  958  live-line-chart.tsx     (rAF lerp loop + synthetic tip points + chrome)
  950  choropleth-chart.tsx    (geoShape + manual ProvidedZoom ~190 lines + hover)
  875  composed-chart.tsx      (three mark families on one time scale)
  848  funnel-chart.tsx        (plain-SVG GAP; trapezoid math + WAAPI)
  826  candlestick-chart.tsx   (two custom marks + spring sampler)
  819  ring-chart.tsx          (polar multi-ring + two-phase WAAPI + two-writer gate)
  817  styles.css              (center-stat / gauge / funnel / heatmap typography ports)
  725  pie-chart.tsx           (polar single-mark + N+1 center variants)
  715  scatter-chart.tsx       (dot gradient + custom ChartScale + WAAPI)
  707  sunburst-chart.tsx      (polar custom-generator + zoom WAAPI)
  606  heatmap-chart.tsx       (outer scaffold; inner cells in internal/)
  577  sankey-chart.tsx        (custom sankey mark + gradient/label injection)
  549  radar-chart.tsx         (polar native + custom PolarGuide)
  542  bar-chart.tsx           (barY + groupScale + band-index hover)
  483  area-chart.tsx          (lineY + areaFill + gradient)
  362  line-chart.tsx          (lineY; smallest chart, most TanStack-native)
  226  index.ts                (barrel)
  163  children.tsx            (role-carrier extraction)
```

### Breakdown by internal helper family (64 files, 12 481 lines)

| Family | Files | Total lines | Note |
|--------|-------|-------------|------|
| **Hover chrome** (springs + DOM paint) | `hover-chrome.ts`, `bar-hover-chrome.ts`, `scatter-hover-chrome.ts`, `live-hover-chrome.ts`, `candlestick-hover-chrome.ts`, `choropleth-hover-chrome.ts`, `pie-hover-chrome.ts`, `ring-hover-chrome.ts`, `sunburst-hover-chrome.ts`, `funnel-hover-chrome.ts`, `heatmap-hover-chrome.ts`, `sankey-hover-chrome.ts` | **3 412** | Single largest family; all bypass TanStack `focus` |
| **Reveal / animation orchestration** | `candle-spring.ts`, `deferred-reveal.ts`, `funnel-reveal.ts`, `gauge-reveal.ts`, `pie-reveal.ts`, `radar-reveal.ts`, `radar-spring.ts`, `ring-reveal.ts`, `sankey-animation.ts`, `sunburst-reveal.ts`, `heatmap-animation.ts`, `bezier-easing.ts`, `spring.ts` | **1 944** | 64-sample `d` keyframe sampling is the D51 fix |
| **Heatmap domain** | `heatmap-components.tsx`, `heatmap-utils.ts`, `heatmap-context.ts`, `heatmap-interaction.tsx`, `heatmap-legend.tsx`, `heatmap-lifecycle.ts`, `heatmap-animation.ts`, `heatmap-colors.ts`, `heatmap-hover-chrome.ts` | **2 782** | Self-contained calendar subsystem |
| **Geometry / layout** | `funnel-geometry.ts`, `gauge-notch.ts`, `sunburst-geometry.ts`, `pie-geometry.ts`, `sankey-layout.ts`, `sankey-mark.ts`, `series-bar-layout.ts`, `series-bar-mark.ts`, `area-fill-mark.ts`, `live-line-mark.ts`, `sunburst-types.ts` | **1 751** | `sunburst-geometry.ts` (503) and `gauge-notch.ts` (455) dominate |
| **Chromes + overlays (axes, labels)** | `bar-x-axis-overlay.tsx`, `x-axis-overlay.tsx`, `y-axis-overlay.tsx`, `x-ticks.ts`, `choropleth-graticule.tsx`, `center-stat.tsx`, `pie-center.tsx`, `ring-center.tsx`, `gauge-center.tsx`, `sunburst-center.tsx`, `sunburst-hint.tsx`, `sunburst-labels.tsx` | **1 386** | HTML overlays vs TanStack guides |
| **Shared utilities** | `bisect.ts`, `decimate.ts`, `focus-disabled.ts`, `formatters.ts`, `parse-aspect-ratio.ts`, `types.ts`, `use-prefers-reduced-motion.ts`, `index.ts` | **574** | `types.ts` (304) is the config-carrier contract |
| **All internal** | 64 | **12 481** | |

Largest internal single files: `heatmap-components.tsx` 867, `heatmap-utils.ts` 825, `hover-chrome.ts` 682, `live-hover-chrome.ts` 547, `sunburst-geometry.ts` 503, `scatter-hover-chrome.ts` 504, `bar-hover-chrome.ts` 455, `gauge-notch.ts` 455.

### Context versus legacy

- Bklit-ui source (Phase-1 baseline, `research/phase-1/01-bklit-ui-inventory.md` §7): 16 top-level chart files over `repos/bklit-ui/packages/ui/src/charts` (~204 files total). Migrated preserves the same 16 families (bar's `perspective`/`square` branches remain pilot-out-of-scope, heatmap/sankey/choropleth/funnel are present).
- Migrated chart-level code (12 748) vs internal helpers (12 481) is ~50/50 — indicates the TanStack marks themselves are compact, while bklit-parity chrome (hover, reveal, geometry, heatmap calendar math) dominates retained logic, consistent with `research/phase-2/bklitui-native/00-README.md`'s characterization and `research/phase-2/tanstack-native/00-README.md`'s "marks array + thin adapter" model.
- The three standalone helper families with the most lines — hover chrome (3 412), reveal (1 944), and heatmap domain (2 782) — together account for ~66% of all internal code and map directly to the “do not port `useChartInteraction`/`motion`/`ParentSize` patterns as-is” warnings in `research/phase-2/inventory/03-stack-comparison.md` §Implications.

---

## Methodology & audit handoff

**Method:** every `migrated/charts/*.tsx` file's header architecture comment
(verified against the actual `import { defineChart|lineY|barY|dot|cell|polar|radialArc|geoShape|createMark }`
statements and `defineChart({ marks:[...] })` call sites), sampled `migrated/charts/internal/*.ts` headers to depth ≥ 20,
cross-checked with `research/phase-2/tanstack-native/*.md` and `research/phase-2/bklitui-native/*.md`
contrast docs and `research/phase-2/inventory/01-bklit-ui-inventory.md` §2/§7 checklist, measured with
`wc -l` (byte count not used).

**What this document does not do:** it does not rule on whether any flagged
Custom/GAP item should be removed — that is the Step 0.3 audit's job, which must
verify hover-parity via pointer tests, bench `M1a`/`G4` budgets, and design
pixel diffs before concluding. Where a stock mark existed (e.g. `areaY` →
`areaFill`) or a TanStack `focus`/`tooltip`/`animate`/`guide` could have been
used, the tables say so explicitly and cite the file that would need to change.

**Candidates requiring Step 0.3 verification (consolidated):**

- `areaFill` / `seriesBarMark` / `liveLineMark` custom marks vs stock (`→ 0.3` heap/width correctness)
- `candlestick` two custom marks vs `link`+`rect` (`→ 0.3`)
- `funnel` plain-SVG vs `createMark({x:null,y:null,guides:false})` wrap (`→ 0.3`, Fable)
- `gauge-linear` plain-SVG vs `barX`/`rect` mark (`→ 0.3`)
- `ResizeObserver` re-implementations vs `<Chart width|aspectRatio>` (`→ 0.3` per chart)
- WAAPI reveal vs `animate:true` across all families (`→ 0.3` bench + discrete-`d` correctness)
- Hover chrome vs `focus`/`tooltip` per chart (`→ 0.3` spring vs `maxFocusDistance` parity)
- `XAxisOverlay`/`YAxisOverlay`/`x-ticks.ts` vs TanStack `x.format`/`y.ticks` (`→ 0.3` label dedup correctness)
- `decimate.ts` necessity at `n=100` (`→ 0.3` via D10 zero-React-state rule)
- `center-stat.tsx` / `heatmap-lifecycle.ts` island/lifecycle scoping (`→ 0.3`)

---

## Phase 3 delta note — D137–D146 post-freeze changes

> Appended 2026-08-18 per PLAN-phase-3.md 0.1. This file is a **verbatim copy** of the Phase 2 freeze state (tag `phase-2-complete-2026-08-08`); nothing above this line was edited. This appendix records what changed in the D137–D146 window *after* the Phase 2 freeze, so Phase 3 readers know where the copied inventory is stale. Source: `docs/phase-2/LOG.md` for D137–D141; git commit messages for D142–D146.

| Delta | Subject | What changed post-freeze | Source |
|---|---|---|---|
| D137 | RingChart reveal | `migrated/charts/ring-chart.tsx`: WAAPI stolen by StrictMode teardown + deferred-paint stall. Fixes: `isMountedRef+setTimeout(0)`; hover defer gated on `pendingExpandAnimsRef.has(i) && !seenRingRevealedRef.has(i)`; `ringConfigs` memoized by content key (not `children` identity); reveal moved to `onPostPaint` (2×rAF+setTimeout 0); `data-bkm-revealed` on `<svg.ts-chart>` root; stale `style.transform="scale(1)"` cleared before WAAPI so `fill:backwards` paints `scale(0)` correctly | LOG.md D137 |
| D138 | GaugeChart reveal | `gauge.tsx`: ARC target selector mismatch (`.ts-chart__radial-arc` stale vs live `[data-ts-key="gauge-bg"]`/`[data-ts-key="gauge-active"]` — 7× 0-target false-alarms) + `radar-spring.ts` `createSpringResolver(...,0,0)` `initialDelta=0` flatline → fixed to `0,1`; `transformOrigin:"0px 0px"` delegated to `styles.css` | LOG.md D138 |
| D139 | Critique sweep | Removed dead `runDeferredReveal`/`createDeferredRevealGuard` from `deferred-reveal.ts` (live primitives `onPostPaint`+`setRevealDeadline` kept); flagged 5× cloned `springFromBounce/resolveEnterTransition/revealTiming/buildProgressKeyframes` (keep per-family precedent) + duplicated `TOOLTIP_SPRING`/`BOX_OFFSET` hover constants; `.ts-bkm-heatmap-rect` retired (`#if 0`'d) | LOG.md D139 |
| D140 | RadarChart reveal + hover | `radar-chart.tsx`: same spring `0,0` flatline fix (D138 root); `focus:"nearest"` never hits `polar/radialArea` centroids via spatial index → `focusDisabled` + imperative `pointerenter/leave` on `radial-area path`/`radial-dot circle` groups; `onPostPaint` scale `0→1` reveal about polar center; `seenRevealedRef:Set`+`pendingRevealRef:Map` gate blocks hover `scale(1.05)` during reveal; `setRevealDeadline` cleanup | LOG.md D140 |
| D141 | HeatmapChart reveal + hover | `heatmap-components.tsx`: reintroduced deferred reveal (`revealInputsRef`+`seenRevealEpochRef`+`onPostPaint`) with single-pass `Map<key,delayMs>` (`computeHeatmapEnterFadeDelayMs`/`resolveHeatmapEnterFadeDurationSec`/`HEATMAP_DEFAULT_ENTER_EASE`, default `delay:0 dur:1600 cubic-bezier(0.85,0,0.916,0.282) fill:backwards`); hover darkening fixed via two load-bearing separate guards (`seen===epoch` and `dataset.bkmRevealed==="1"`) | LOG.md D141 |
| D142–D143 | SunburstChart hover/zoom + debt | commit `4df1aff`: WAAPI reveal with `bkmRevealed` guard + `setRevealDeadline` + `onPostPaint` keyed by `data-ts-key`; labels morph via `transitionGeometry` with hover dimming (no remount); zoom dims unrelated labels (0.25) instead of culling (`isRelatedArc`); **deleted orphaned `internal/sunburst-hover-chrome.ts` (112 lines)**; deduped `getSunburstPathMap` (4 sites) + `isRelatedArc` (3 sites); `applyAlphaToColor` → `color-mix`; removed `d3 arc()` wrapper; `usePrefersReducedMotion` hook; `pendingReveal` Map→Set | ⚠️ commit message only, NOT in LOG.md |
| D144 | ChoroplethChart native zoom | commit `490aeba`: replaced hand-rolled `ProvidedZoom` (`createProvidedZoom`/`useZoomState`, ~260 lines) with bklit's native `<Zoom>`; svg is gesture target via `containerRef`; single `<g.transform>` drives marks+graticule; pinch/wheel share focal+compose+clamp; removed dead `featureByTsKeyFallback` + `isMountedRef` dance; extracted `applyZoomToGroups`; graticule single outer `<g>` via `graticuleGRef` | ⚠️ commit message only, NOT in LOG.md |
| D145 | ChoroplethChart tooltip clear | commit `6a05c09`: country→ocean left `hoveredKey` live so tooltip stuck at `opacity:0` through 200ms exit timer; `handleLeave`/`handleRootLeave` consolidated into `clearHover()`; `svg:mousemove/leave/pointerleave` clear when event target has no `data-ts-key` ancestor; re-wire on reconnect so TanStack re-renders don't drop the listener | ⚠️ commit message only, NOT in LOG.md |
| D146 | Showcase build | commit `692fc28`: `showcase/tsconfig.json` paths `../repos/...` → `./repos/...` (Vercel Root Directory = `showcase/`, `clone-repos.sh` places repos at `showcase/repos`); webpack+turbopack aliases for `@tanstack/*` generated from `package.json` exports (like `bench/app/vite.config.ts`); `globals.css` source includes showcase-relative paths | ⚠️ commit message only, NOT in LOG.md |

**Impact on this file (04 — migrated inventory):** **significant.** The per-chart capsules and internal-helper rows predate D137–D146 and are stale for: `ring-chart.tsx` (reveal moved to `onPostPaint`, `data-bkm-revealed` on SVG root, `ringConfigs` memoized), `gauge.tsx` (arc selector `[data-ts-key="gauge-bg"/"gauge-active"]`, spring `0,1`), `radar-chart.tsx` (`focusDisabled` + imperative listeners, spring `0,1`), `heatmap-components.tsx` (deferred reveal + epoch guards), `sunburst-chart.tsx` (WAAPI reveal + `data-ts-key`-keyed morph, labels dim not cull), `choropleth-chart.tsx` (native `<Zoom>`, `clearHover()` tooltip, `applyZoomToGroups`, graticule single `<g>`). **Deleted post-freeze:** `internal/sunburst-hover-chrome.ts`. Counts of internal helpers / per-chart lines in this file are pre-delta. Chart count (15) is unchanged; no chart was added or removed in the D137–D146 window.
