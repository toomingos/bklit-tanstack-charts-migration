# Migration Progress Tracker — Phase 3

> **Phase 1** is frozen — see `docs/phase-1/PROGRESS.md` (17/17 charts approved, tag `phase-1-complete-2026-08-07`). **Phase 2** is frozen — see `docs/phase-2/PROGRESS.md` (15 charts re-gated, tag `phase-2-complete-2026-08-08`). This file tracks **Phase 3** only.

Source of truth for status: this table. Update status/QA/benchmark columns as work proceeds; log decisions and rationale in `docs/phase-3/LOG.md`, not here.

## Phase 3 — Harden + Consolidate (PLAN-phase-3.md)

Goal: harden migrated charts + deferred utilities to TanStack-native backend — remove remaining wrappers/unnecessary complexity/duplicated internals while preserving bklit design, animation, and API parity. Gains measured on M1/M2/M3 vs bklit and closeness to TanStack native (research/phase-1/05-qa-and-benchmark-gates.md — frozen gates).

| # | Initiative | Audit | Plan | Refactor | QA (Q1/Q2) | Benchmarks (G1–G4) | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Internals consolidation — spring / reveal / hover-chrome | not started | — | — | — | — | dedup `springFromBounce`/`resolveEnterTransition`/`sampleSpringProgress`, `onPostPaint`/`setRevealDeadline`/`deferred-reveal.ts`, `TOOLTIP_SPRING`/`BOX_OFFSET` hover constants; no behavior change (D139) |
| 2 | Sizing host — ResizeObserver / ParentSize → TanStack host | not started | — | — | — | — | manual `ResizeObserver` duplication (audit #4), `ParentSize debounceTime 10ms` → host `ResizeObserver` single owner, `measureText` auto-margin, `xRangePadding` ChartScale hatch |
| 3 | Deferred chrome — Legend (U2) + Markers (U1) + Background (U4) + ChartRevealClip (U13) | not started | — | — | — | — | Legend system, ChartMarkers/MarkerGroup, Background, reveal clip — TanStack `colorLegend()`/`gradients`/`clip` resources vs custom wrappers |
| 4 | Deferred chrome — ChartTooltip (U3) + ChartStatFlow (U12) + useChart hooks (U14) | not started | — | — | — | — | tooltip render-props, stat flow ticker, `useChart`/`useChartStable`/`useChartHover` → `renderTooltipBody` portal + `focus` strategy |
| 5 | Deferred chrome — ChartBrush (U5) + ReferenceArea (U7) + SegmentBackground (U8) + ProjectionLine (U6) | not started | — | — | — | — | brush/zoom selection → filtered data + definition swap, ReferenceArea bands, projection `buildProjectionPath` → `ruleY`/`link` marks |
| 6 | Deferred chrome — PatternArea (U11) + BarSquares/BarDepth (U10) + ProfitLossLine (U9) | not started | — | — | — | — | `PatternArea` presets, `BarSquares` waffle/`BarDepth` 3D perspective, profit-loss — custom `createMark` families |
| 7 | Showcase type-debt + build polish | not started | — | — | — | — | ~20 pre-existing `migrated/charts` type errors under showcase `ignoreBuildErrors`, `bench/app`/`showcase` build gates |

## Research tracker (Phase 0)

| Step | Description | Status | Output |
|---|---|---|---|
| 0.0 | Phase 3 docs (PROGRESS / BENCHMARKS / LOG D200+) | not started | this file + BENCHMARKS.md + LOG.md |
| 0.1 | Deferred + duplicated inventory (reuse phase-2) | not started | research/phase-3/inventory/01-04 (verbatim copies of phase-2 inventory) |
| 0.2 | Consolidated internals catalog (spring/reveal/hover/ChartScale) | not started | research/phase-3/inventory/05-consolidated-internals.md |
| 0.3 | Per-initiative audits (native vs custom vs broken vs design) | not started | research/phase-3/audits/ (per-initiative audits) |

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
