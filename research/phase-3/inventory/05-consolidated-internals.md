# 05 — Consolidated Internals Catalog (Phase 3 Initiative Targets 1–5)

> **PLAN-phase-3.md 0.2.** Catalogue of the duplicated internals inside
> `migrated/charts/` that Phase 3 initiatives 1–5 consolidate into ONE
> standardized utility per family (single impl, single import path, zero
> per-chart forks) on a TanStack-native backend with bklit design/API 1:1.
> Phase 3 loop rule: each initiative builds the utility ONCE, propagates it to
> EVERY consumer, then gates cross-chart (Q3 → type-parity → Q2 → Q1 → G1–G4).
>
> **Method (honest scope):** every row below was re-verified `grep`/`wc -l`/
> read against the working tree on 2026-08-18 (HEAD `5a2c444`), NOT copied
> from `04-migrated-inventory.md` (which froze 2026-08-07 and is stale for the
> D137–D146 window — see that file's appended delta note). Line numbers are
> exact at HEAD. Duplication counts are definition sites only (imports
> excluded). All paths relative to repo root.
>
> **Design-token contract:** every magic value named here (`1100ms`,
> `cubic-bezier(0.85,0,0.15,1)`, `FAN_ANGLE 160°`, `BRUSH_TRACK_OUTER_FADE 0.15`,
> `BAR_DEPTH_PERSPECTIVE_RATIO 0.45`, `BACKGROUND_ENTER_FADE_MS 420`,
> `TOOLTIP_SPRING {300,30}`/`BOX_OFFSET`) must end up in the single
> design-tokens module per `research/phase-3/00-layer-contract.md` — never
> inlined at call sites.

---

## 1. Family table (consolidation targets)

| # | Family | Current definition sites (exact) | Count | Initiative | TanStack-native target |
|---|--------|----------------------------------|-------|-----------|------------------------|
| 1 | Spring physics conversion (`springFromBounce`) | `internal/radar-reveal.ts:137`, `internal/funnel-reveal.ts:60`, `internal/pie-reveal.ts:55`, `internal/ring-reveal.ts:53`, `internal/gauge-reveal.ts:80` | **5× (identical clone)** | 1 | Single `spring.ts`-style module (only dependency: no framer; feeds WAAPI keyframe sampling) |
| 2 | Enter-transition resolution (`resolveEnterTransition`) | `internal/funnel-reveal.ts:70`, `internal/pie-reveal.ts:71`, `internal/ring-reveal.ts:69`, `internal/gauge-reveal.ts:99` | **4×** | 1 | Single resolver keyed by bklit `Transition` shape (`spring`/`tween`/`duration`) |
| 3 | Reveal timing dispatch (`revealTiming`) | `internal/funnel-reveal.ts:119`, `internal/pie-reveal.ts:151`, `internal/ring-reveal.ts:148`, `internal/gauge-reveal.ts:160` | **4×** | 1 | Single per-family parameterization of one timing engine |
| 4 | WAAPI progress keyframes (`buildProgressKeyframes`) | `internal/funnel-reveal.ts:134`, `internal/pie-reveal.ts:172`, `internal/ring-reveal.ts:169`, `internal/gauge-reveal.ts:180` | **4×** | 1 | Single sampler (64-sample rule D51, `#`-skeleton-safe, discrete-`d` safe) |
| 5 | Spring sampling for WAAPI (`estimateSpringSettleMs`/`sampleSpringProgress`) | `internal/radar-spring.ts:7` / `internal/radar-spring.ts:33`; consumed via `internal/candle-spring.ts:143` `createSpringResolver` by gauge/ring/pie/funnel/radar | **1 helper, 1 adapter** | 1 | Keep as the canonical sampler; delete per-family re-derivations |
| 6 | rAF spring integrator (`createSpring`) | `internal/spring.ts:31` — **already single** | 1 ✓ | 1 | Model for "one impl" — do not fork when adding consumers |
| 7 | Reveal easing solver (`bezier-easing.ts`) | `internal/bezier-easing.ts` (19 lines, `cubic-bezier(0.85,0,0.15,1)`) | **1** | 1 | Owned by design-tokens module; verify no inlined duplicate remains after consolidation |
| 8 | Deferred-reveal primitives (`onPostPaint` rAF×2+timeout, `setRevealDeadline`, `bkmRevealed` guard) | `internal/deferred-reveal.ts` (151 lines); consumers: `bar-chart.tsx`, `scatter-chart.tsx`, `candlestick-chart.tsx`, `gauge.tsx`, `pie-chart.tsx`, `ring-chart.tsx`, `radar-chart.tsx`, `sunburst-chart.tsx`, `choropleth-chart.tsx`, `composed-chart.tsx` + own reveal in `internal/heatmap-components.tsx` | **1 primitive + heatmap fork** | 1 | Keep single primitive; fold heatmap's `revealInputsRef`/`seenRevealEpochRef` pattern (D141) into it |
| 9 | Hover chrome constants (`TOOLTIP_SPRING`, `BOX_OFFSET`) | `internal/bar-hover-chrome.ts`, `internal/candlestick-hover-chrome.ts`, `internal/hover-chrome.ts`, `internal/live-hover-chrome.ts`, `internal/scatter-hover-chrome.ts` | **5× duplicate** | 1, 4 | Single design-token constants; initiative 4 replaces the per-chart hover chrome with one `ChartTooltip` |
| 10 | Per-chart hover chrome implementations | `internal/bar-hover-chrome.ts` (455), `internal/candlestick-hover-chrome.ts` (445), `internal/hover-chrome.ts` (682, shared line/area/composed), `internal/live-hover-chrome.ts` (547), `internal/scatter-hover-chrome.ts` (504), `internal/heatmap-hover-chrome.ts` coordinator (163) | **6 implementations over 5+ charts** | 4 | Single `focus:'group-x'` + `renderTooltipBody` portal + `createGridPointIndex` + `ColorLegend` per plan D201 |
| 11 | Y-domain derivation (`nicedYDomain` memo) | `line-chart.tsx:167`, `area-chart.tsx:204`, `composed-chart.tsx:451` — identical `scaleLinear().domain(yDomain).nice().domain()` shape | **3×** | 1 | Single `niceYDomain`-style helper (bklit `y-domain-utils.ts:9` parity) |
| 12 | Local scale stashes (`ChartScale` shims) | `line-chart.tsx:222-238` (x via `ChartScale.resolve`), `area-chart.tsx:290`, `scatter-chart.tsx:221`, `candlestick-chart.tsx:241/273/471/565`, `composed-chart.tsx:583/609`, `bar-chart.tsx:219/266`, `live-line-chart.tsx:524/627`, `radar-chart.tsx:367` | **9 chart files** | 1, 2 | Host owns range via `resolveConfiguredScale`; keep stash only where an overlay/chrome needs the resolved scale (D110 precedent) |
| 13 | Sizing: `ResizeObserver` per chart | `area-chart.tsx`, `bar-chart.tsx`, `candlestick-chart.tsx`, `choropleth-chart.tsx`, `composed-chart.tsx`, `funnel-chart.tsx`, `gauge.tsx`, `heatmap-chart.tsx`, `line-chart.tsx`, `live-line-chart.tsx`, `pie-chart.tsx`, `radar-chart.tsx`, `ring-chart.tsx`, `scatter-chart.tsx` | **14 files** | 2 | Single host RO (10ms debounce parity, `ParentSize debounceTime={10}`) + `aspectRatio` via `internal/parse-aspect-ratio.ts` (single) |
| 14 | Contexts (`ChartProvider`/`ChartConfigProvider`/static preview) | migrated: **absent** (only comments at `internal/candlestick-focus-strategy.ts:5`, `candlestick-chart.tsx:144`); bklit source: `chart-context.tsx` (`ChartProvider` line 239, `useChartStable` 376, `useChartHover` 402, `useChart` 419), `chart-config-context.tsx` (`ChartConfigProvider`, `DEFAULT_CHART_CONFIG` `{tooltipSpring {300,30}, tooltipBoxSpring {100,20}, highlightSpring {180,28}}`), `static-chart-preview-context.tsx:8` | **0 migrated** | 2 | Single `focus`+`paintFocus` host; avoid rebuilding bklit's React-state hover context (stack §8.1) |
| 15 | Tooltip config surface (`ChartTooltipConfig`) | `internal/types.ts:181-187` — pilot subset `{enabled, showDatePill, showCrosshair, showDots, content}`; live-line only honors `content` (D22). bklit full surface (tooltip/chart-tooltip.tsx): `showDatePill/showCrosshair/showDots/dotVariant/dotSize/dotRadiusFraction/dotScale/dotStrokeWidth/indicatorColor/content/rows/dotColor/children/className/springConfig/matchCrosshair/damping/indicatorDasharray/indicatorFadeEdges/indicatorFadeLength/boxSpringConfig/panelStyle/backgroundColor` | **subset** | 4 | `renderTooltipBody` + `TooltipBox/Dot/Indicator/DateTicker` islands; `indicatorColor` function form for candlestick close-vs-open |
| 16 | Tooltip island subcomponents | bklit: `tooltip/tooltip-box.tsx` (springs, flip), `tooltip/tooltip-dot.tsx`, `tooltip/tooltip-indicator.tsx` (`IndicatorWidth` presets, `span`/`columnWidth`), `tooltip/date-ticker.tsx` (`COMPACT_TICKER_THRESHOLD 60`, `TICKER_ITEM_HEIGHT 24`), `tooltip/tooltip-content.tsx` (`TooltipRow`); migrated: **absent** — pill/dot/box are hand-rolled inside each hover-chrome fork | **0 migrated** | 4 | Single tooltip-body React island via `RendererChart` tooltip portal (stack §8.4) |
| 17 | Grid + axes + reveal/loading chrome | migrated: `GridConfig` carrier subset (`internal/types.ts:112-119` — horizontal/vertical/stroke/strokeOpacity/strokeWidth/numTicks, no rendering), `XAxisOverlay` (`internal/x-axis-overlay.tsx:116`), `YAxisOverlay` (`internal/y-axis-overlay.tsx:127`), `x-ticks.ts` (284, `MAX_GAP_LAYOUTS=400`), `ChartRevealClip` analog via `deferred-reveal`; bklit: `grid.tsx` (`useGridShimmer`, `highlightRowValues`, `DEFAULT_SHIMMER_LENGTH_PX 140`), `y-axis.tsx` + `y-axis-ticks.ts`, `background.tsx` (`BACKGROUND_ENTER_FADE_MS 420`), `fade-edges.ts`, `indicator-fade.ts`, `chart-reveal-clip.tsx`, `animation.ts` (`DEFAULT_ANIMATION_DURATION_MS 1100`, `DEFAULT_ANIMATION_EASING "cubic-bezier(0.85,0,0.15,1)"`) | **partial** | 3 | `guides:{x:{grid},y:{grid}}` + `gradients`/`clip`; 1100ms reveal timing into design tokens |
| 18 | Loading chrome | migrated: `HeatmapChartLoading` only; residual `loading` handling in `area-chart.tsx`/`composed-chart.tsx`/`line-chart.tsx`/`sunburst-chart.tsx`; bklit: `loading-sweep.tsx`, `line-loading-pulse.tsx`, `line-loading-timing.ts`, `area-chart-loading.tsx`, `bar-chart-loading.tsx`, `line-chart-loading.tsx`, `chart-loading-label.tsx`, `use-grid-shimmer.ts`, `generate-chart-skeleton-data.ts` | **1/10** | 3, 12 | CSS `@keyframes` on stable nodes (stack §8.2) — no per-frame React state |
| 19 | Interaction/phase hooks | migrated: `internal/bisect.ts` (38), `internal/coerce-date.ts`, 3 focus strategies (`bar-focus-strategy.ts` band-index `Math.floor((x-marginLeft)/colWidth)`, `candlestick-focus-strategy.ts`, `scatter-focus-strategy.ts`) wired via `defineChart(spec,{focus,maxFocusDistance:Infinity})`; bklit: `use-chart-interaction.ts` (`ChartSelection` drag), `use-scheduled-tooltip.ts` (rAF dedupe `${index}:${Math.round(x)}`), `use-chart-phase-orchestrator.ts` (ChartPhase 8 states `loading|exiting|gridTweenReady|revealing|ready|exitingReady|gridTweenLoading|revealingLoading`, `revealEpoch`/`concealEpoch`), `chart-phase.ts` (`DEFAULT_Y_DOMAIN_TWEEN_MS 500`, `Y_DOMAIN_TWEEN_SKIP_THRESHOLD 0.02`) | **3 strategies, no phase machine** | 5 | `focus`/`spatialIndex`/`reconcileChartSvg`; phase machine only where bklit-visible (loading↔ready) |

---

## 2. Already-single internals (do NOT fork — precedent for the target state)

- `internal/spring.ts:31` `createSpring` — one rAF integrator, consumed by bar/line/area/pie/ring/funnel/heatmap/live-line.
- `internal/deferred-reveal.ts` `onPostPaint` + `setRevealDeadline` — one primitive, 10 consumers (heatmap still forks; fold in initiative 1).
- `internal/bezier-easing.ts` — one `cubic-bezier(0.85,0,0.15,1)` solver.
- `internal/focus-disabled.ts` (12 lines) — one re-export of `@tanstack/charts/focus/disabled`, consumed by pie/ring/sunburst/gauge/choropleth.
- `internal/parse-aspect-ratio.ts` (5 lines) — one parser, 6 consumers.
- `internal/formatters.ts` (24 lines) — one `shortDateFmt`/`weekdayDateFmt`/`hmsTimeFmt`/`intFmt` (bklit `chart-formatters.ts` parity, subset).
- `internal/y-axis-overlay.tsx` / `internal/x-axis-overlay.tsx` — one each (line/area/bar/scatter/candlestick/composed), parameterized.
- `internal/pie-geometry.ts` (`pieArcPath`/`sliceMidOffset`) — one geometry module shared by pie/ring/gauge.

## 3. Consolidation order note (plan 1.1 foundations-first)

Initiative 1 touches families 1–11 (springs/reveal/hover constants/ChartScale); initiative 2 touches 13–14 (+12); initiative 3 touches 17–18; initiative 4 touches 9–10/15–16; initiative 5 touches 19. Later initiatives never re-touch gated utilities — the family table is the single source for what each initiative owns, and the `→ 0.3` audit of each family (PLAN 0.3) must confirm or correct these counts before the initiative's plan is written.