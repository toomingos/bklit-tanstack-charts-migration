# Migration Progress Tracker — Phase 3

> **Phase 1** is frozen — see `docs/phase-1/PROGRESS.md` (17/17 charts approved, tag `phase-1-complete-2026-08-07`). **Phase 2** is frozen — see `docs/phase-2/PROGRESS.md` (15 charts re-gated, tag `phase-2-complete-2026-08-08`). This file tracks **Phase 3** only.

Source of truth for status: this table. Update status/QA/benchmark columns as work proceeds; log decisions and rationale in `docs/phase-3/LOG.md`, not here.

## Phase 3 — Harden + Close ALL Utility Gaps (PLAN-phase-3.md)

Goal: harden migrated charts + close every remaining bklit utility gap to TanStack-native backend — remove remaining wrappers/unnecessary complexity/duplicated internals while preserving bklit design, animation, and API parity. Gains measured on M1/M2/M3 vs bklit and closeness to TanStack native (research/phase-1/05-qa-and-benchmark-gates.md — frozen gates).

| # | Initiative | Audit | Plan | Refactor | QA (Q1/Q2) | Benchmarks (G1–G4) | Notes — single impl + propagate to all consumers (cross-chart gate) |
|---|---|---|---|---|---|---|---|
| 1 | Internals consolidation — spring / reveal / hover-chrome + ChartScale/y-scales | not started | — | — | — | — | single `spring.ts`/`deferred-reveal.ts`/`hover-chrome` primitives (dedup `springFromBounce/resolveEnterTransition/sampleSpringProgress`, `onPostPaint/setRevealDeadline`, `TOOLTIP_SPRING/BOX_OFFSET`, ChartScale shims, `y-domain-utils/y-axis-scales`→`scaleLinear.nice()`); propagate to all 17 charts — no per-chart forks |
| 2 | Sizing + contexts host — ResizeObserver/ParentSize + ChartProvider/ChartConfigProvider/static-preview | not started | — | — | — | — | single host `ResizeObserver` (replace `ParentSize debounceTime 10ms` per-chart duplication, `measureText` auto-margin, `xRangePadding` ChartScale hatch); single `focus`+`paintFocus` (replace `ChartProvider`/`useChart`/`useChartStable`/`useChartHover` re-render); propagate to Line/Area/Bar/Scatter/Candlestick/Composed/LiveLine |
| 3 | Grid + Background + FadeEdges/IndicatorFade + YAxis + Reveal/Animation/Loading | not started | — | — | — | — | single `guides:{x:{grid},y:{grid}}`+`gradients`/`clip` (replace `grid.tsx`+`use-grid-shimmer` `horizontal/vertical/highlightRowValues/fadeHorizontal/Vertical/shimmer`, `background.tsx` `BACKGROUND_ENTER_FADE_MS 420`, `fade-edges.ts`/`indicator-fade.ts`, `y-axis.tsx`/`y-axis-ticks.ts`, `chart-reveal-clip.tsx`+`animation.ts` `1100ms bezier(0.85,0,0.15,1)` + `loading-sweep/line-loading-pulse`); propagate to all cartesian + reveal to all 17 |
| 4 | ChartTooltip + custom indicator + StatFlow | not started | — | — | — | — | single standardized `ChartTooltip` (`focus:'group-x'`+`renderTooltipBody` portal+`createGridPointIndex` — 1 impl, 1 import, no per-chart hover-chrome forks) preserving `indicatorColor/rows/content/showDatePill/showCrosshair`+`TooltipBox/Dot/Indicator/DateTicker`+`useScheduledTooltip` rAF+`IndicatorFade`; `chart-stat-flow.tsx`→single `center-stat` island; propagate to Line/Area/Bar/Scatter/Candlestick/Composed/LiveLine (all charts using tooltip) |
| 5 | Chart hooks + interaction phase — useChartInteraction/useChartPhaseOrchestrator/useScheduledTooltip | not started | — | — | — | — | single `focus`/`spatialIndex`/`reconcileChartSvg` (replace `use-chart-interaction.ts` `bisectDate`/`selection` drag, `use-scatter-chart-interaction`, `use-scheduled-tooltip` rAF dedupe, `use-chart-phase-orchestrator.ts` `8 states`/`revealEpoch/concealEpoch`, `chart-phase.ts`, `y-domain-utils`); propagate to all time-series + scatter |
| 6 | ReferenceArea + Segment + y-domain registration | not started | — | — | — | — | single `ruleY/rect/link`+`clip` (replace `reference-area.tsx` `ifOverflow hidden/extend`+`PatternPreset`+`showMarkers` bracket+`reference-area-geometry/registration/config`+`resolveTickLabelColor` + `segment.tsx` `SegmentBackground/LineFrom/To`); propagate to Line/Area/Composed/Bar/Scatter/Candlestick |
| 7 | ProjectionLine + TerminalMarker | not started | — | — | — | — | single `ruleY/link` dashed+`gradientStart→End` (replace `projection-line.tsx`+`projection-line-end-marker.tsx` `__isPostOverlay`+`projection-utils.ts` `buildProjectionPath/buildHorizontalTangentBezierPath` `curveKind linear/bezier` `mode auto/target/manual`+`projection-config.ts`); propagate to Line/Area/Composed |
| 8 | Legend + ChartLegend + ProfitLoss | not started | — | — | — | — | single `colorLegend()/colorGradientLegend()` (replace `legend/*` 8 files+`chart-legend.tsx` legacy+`chart-legend-hover.tsx`+`profit-loss-line/segments/legend.tsx`); propagate to all charts with legend |
| 9 | ChartBrush + BrushLayout | not started | — | — | — | — | single filtered data+definition swap (replace `chart-brush.tsx` `@visx/brush`+`chart-brush-layout.tsx`+`handle/selection/track-overlay` `BRUSH_TRACK_OUTER_FADE 0.15`+`filter-data-by-x-domain.ts`); propagate to Line/Area/Composed (brush consumers) |
| 10 | Markers + Series chrome (Markers/SeriesMarkers/Highlight/DashTail) | not started | — | — | — | — | single `dot`+custom `createMark`+`focus` highlight (replace `markers/chart-markers.tsx`+`marker-group.tsx` `FAN_ANGLE 160°` + `series-markers.tsx`+`series-point-marker.tsx`+`series-hover-dim.tsx`+`series-highlight-layer.tsx`+`highlight-segment.tsx`+`series-dash-tail-overlay.tsx`+`dash-tail-stroke.tsx`+`path-stroke-utils.ts`+`line-series-terminal-marker.tsx` `__isPostOverlay`); propagate to Line/Area/Scatter (+ bar terminal) |
| 11 | PatternArea + BarSquares/BarDepth + misc series | not started | — | — | — | — | single custom `createMark` family (replace `pattern-area.tsx`+`pattern-preset.tsx` `PATTERN_PRESET_IDS 8`+`visx-pattern.tsx` + `bar-squares.tsx/layout`+`bar-depth.tsx/geometry` `PERSPECTIVE_RATIO 0.45` + `scatter.tsx`/`candlestick.tsx`/`live-line.tsx` wrappers); propagate to Area/Bar (pattern/squares/depth consumers) |
| 12 | Showcase build + remaining type-debt + shell polish | not started | — | — | — | — | single `chart-defs`/`chart-child-passthrough` passthrough (`isPostOverlay/isUnderlay/isClipExcluded/CHART_CLIP_PASSTHROUGH`)+`chart-formatters/skeleton/decimate`; showcase `ignoreBuildErrors`→clean `tsc`; propagate shell polish to all routes |

> **Phase 3 loop rule (PLAN-phase-3.md 1.4): each initiative builds ONE standardized utility (tanstack native + bklit 1:1) on a single import path — then propagates it to EVERY migrated chart that consumes it (delete per-chart forks). QA + Benchmarks in `1.4` are cross-chart gates: run `qa/screenshot.mjs` + `bench/run.mjs` across ALL affected charts, not just one. No chart may keep a duplicate tooltip/grid/etc. after its initiative is marked approved.**

## Research tracker (Phase 0)

| Step | Description | Status | Output |
|---|---|---|---|
| 0.0 | Phase 3 docs (PROGRESS / BENCHMARKS / LOG D200+) | done | this file + BENCHMARKS.md + LOG.md |
| 0.1 | All bklit utilities + deferred gaps + duplicated internals catalog | not started | research/phase-3/inventory/01-04 (verbatim copies of phase-2 inventory) + 05-consolidated-internals.md |
| 0.2 | Consolidated internals + every deferred chrome family catalog | not started | research/phase-3/inventory/06-deferred-chrome.md |
| 0.3 | Per-initiative audits (native vs custom vs broken vs design 1:1) | not started | research/phase-3/audits/ (×12 initiatives) |

## Legend

**Phase 3 status values**: `not started` → `auditing` → `planned` → `refactoring` → `QA` → `benchmarking` → `approved` — or `blocked`.

**QA gates** (research/phase-1/05-qa-and-benchmark-gates.md §QA):
- **Q1 — Visual parity**: ≤ 0.5% differing pixels per screenshot.
- **Q2 — API compatibility**: public props/callbacks typecheck with zero runtime console errors.

**Benchmark gates** (research/phase-1/05-qa-and-benchmark-gates.md §Benchmark gates; `B`=bklit, `T`=native TanStack, `M`=migrated):
- **G1 — Improvement**: `M` beats `B` on M1a/M1c/M2a/M3a/M3c, ≥20% on M1a/M3a/M3c.
- **G2 — Closeness**: `(B−M)/(B−T) ≥ 0.6` on M1a/M3a/M3c (waived if no native `T`).
- **G3 — Steady state**: M2a ≤50% of `B`, within 2× of `T`.
- **G4 — Memory/bundle**: M2b/M2c ≤110% of `B`.

Phase 3 gates are identical to Phase 2 (research/phase-1/05 is frozen ground truth). Waivers require lead ruling in `docs/phase-3/LOG.md` (Phase 3: D200+).
