# Phase 4 Synthesis — Redundancies, Dead Code & Simplification Targets (4.2.1.3)

Date: 2026-08-21 · Lens: remove redundancies, unnecessary complexity, dead code.
Inputs: `research/phase-4/usage-matrix.md`, all 25 part reports, source under `showcase/migrated/charts/`.
Verification method: every claim re-checked against source — grep of ALL importers including the two barrels (`charts/index.ts`, `internal/index.ts`), the wrapper package (`showcase/packages/migrated-charts/index.ts` = bare `export *`), the showcase app (`showcase/components/demos/*`), bench scenarios (`bench/app/src/scenarios/*`), and QA (`qa/api-compat/*`, `qa/screenshot.mjs`, `qa/console-errors.mjs`), plus CSS-class greps in `styles.css`.

## Critical correction to the usage matrix

The matrix counts **internal** import edges only; its 9 "ORPHAN" flags are therefore incomplete as dead-code evidence. Re-verification through the public barrel shows **7 of 9 orphans are LIVE** (consumed by bench/QA/showcase via `charts/index.ts`):

| Matrix orphan | Real status | Proof |
|---|---|---|
| `background` | **DEAD** | no importer anywhere; absent from both barrels; no `Background` role in `children.tsx`; zero demo/bench/QA references |
| `bar-pulse-overlay` | **DEAD** | zero importers (grep clean); bar.md: "nothing imports" |
| `brush-layout` + `chart-brush` | LIVE | `migrated-brush` bench scenario, `qa/console-errors.mjs` (D227), `showcase/components/demos/brush.tsx` |
| `chart-legend` (+ `legend`, `legend-context`) | LIVE | `migrated-legend/-legendhover/-barsquares/-markers/-candlestick-legend` bench scenarios; demos `barsquares.tsx`, `markers.tsx` |
| `heatmap-legend` | LIVE | `migrated-heatmap` bench scenario, `qa/api-compat/heatmap.tsx`, demo `heatmap.tsx` |
| `profit-loss-legend` + `-hover` | LIVE | `migrated-profitloss` bench scenario (both provider and legend) |
| `ring-center` | LIVE | `migrated-ring` bench scenario, `qa/api-compat/ring.tsx`, demo `ring.tsx` |

Consequence: the legend-kit consolidation (3 parallel hovered-index contexts) and brush-stack questions are **API-parity rulings for Fable**, not dead-code deletions. Only 2 modules are provably dead.

## Findings

| Item | Location (file/module) | Type | Evidence (verified how) | Proposed action | Risk |
|---|---|---|---|---|---|
| `Background` component + pattern/fade machinery | `internal/background.tsx` (136 LOC) | dead-code | 0 importers: no `./background` edge in `migrated/charts/**`, absent from `internal/index.ts` + `charts/index.ts`, no `Background` slot in `children.tsx`, zero demo/bench/QA hits | delete | none — never wired |
| `BarPulseOverlay` (animated wave home) | `internal/bar-pulse-overlay.tsx` (114 LOC) | dead-code | 0 importers (grep + bar.md Deviation "split-brain pulse"); live `barPulseMark` voids its own wave constants (`bar-pulse-mark.ts:108-109`) so the animation is unreachable | delete (or resurrect into `barPulseMark` — open Q3) | none for gates (static silhouette is what renders today) |
| Sweep/skeleton loading surface: `LineLoadingSweep`, `BarLoadingSkeleton`, `generateChartSkeletonData`, `getSkeletonHeights` | `internal/loading-chrome.tsx` (~200 of 320 LOC) | dead-code | zero importers outside the module (grep: defs + intra-module use only); none exported from `charts/index.ts`; migrated loading = empty grid + `LoadingLabel` (area.md/line.md deviations) | delete the 4 symbols; keep `LoadingLabel` + `LineLoadingPulse` (live) | none — `loadingStyle="sweep"`/`status="loading"` branches don't exist in migrated |
| `resolveGridShimmer` | `internal/grid.ts:66` | dead-code | zero consumers (axes-grid.md deviation + grep: definition only); shimmer band never rendered | delete fn; keep `GridConfig.shimmer*` fields (parity surface per children.md) | none |
| `MARKER_DIM_*`/`MARKER_ACTIVE_SCALE`/`MARKER_ENTER_*` exports (6 consts) | `internal/series-marker-mark.ts:106-110` | dead-code | "no in-tree consumer — hover-chrome re-declares privately" (legend-markers.md); grep confirms private copies at `hover-chrome.ts:38` | un-export (delete); private copies in `hover-chrome.ts` are the behavioral owner | none |
| `topSquareCenterY` | `internal/bar-squares-layout.ts:65` + barrel line `internal/index.ts:167` | dead-code | zero call sites (grep: definition + barrel export only; bar.md "unconsumed") | delete fn + barrel entry | low — was a legacy public util; see open Q2 |
| Heatmap loading remnants: `heatmapLoadingCellParticipates`, `HEATMAP_LOADING_BASE_CELL_OPACITY`, `HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY/RANDOMNESS` plumbing | `internal/heatmap-animation.ts:40-45,82` | dead-code | dead after shimmer cut (heatmap.md deviation); not in `charts/index.ts` heatmap block; absent from `qa/api-compat/heatmap.tsx` | delete internals; `loadingCellMaxOpacity`/`loadingCellRandomness` **props stay accepted-but-inert** for API compat | none |
| Orphaned pie-center CSS | `styles.css:443-457` `[data-bkm-chart="pie"] .ts-bkm-pie-center*` | dead-code | no element applies these classes since PieCenter moved to `.ts-bkm-center-stat*` (pie.md deviation; grep: CSS + comments only) | delete rules | none |
| Duplicated loading/sweep CSS block | `styles.css` ~846-926 vs ~928-984 | dead-code | verbatim duplicate selectors verified by grep (`.ts-bkm-loading-label-wrap` 870/928, `.ts-bkm-sweep-band` 910/968, exit rules 897/955, reduced-motion 918/976, 921/979); foundation.md: "merge artifact" | delete one copy (sweep portions also go with loading-surface deletion) | trivial — diff the two copies first (open Q6) |
| `earlyRenderData` computed then voided | `line-chart.tsx:144-148` | dead-code | `void earlyRenderData` verified in source; line.md deviation | delete computation | none |
| `columns` array built then discarded + duplicate x-rounding | `bar-chart.tsx:845` (`animateSquaresCascade`) | dead-code | `void columns` verified; bar.md deviation | delete build + dedupe rounding | none |
| Void-ed options + no-op statements in `barTrimmedMark` | `internal/bar-trimmed-mark.ts:31-32` (+ 5 destructured-then-voided options) | dead-code | `void barDepthAndRise; void barDepthMaxDepth;` verified; bar.md deviation | remove void statements + unused destructure | none |
| Dead import of `extractReferenceAreaConfigs` | `composed-chart.tsx:404` | dead-code | `void extractReferenceAreaConfigs;` verified; reference-area.md deviation | remove import + void | none |
| `input.width` dead param | `internal/live-hover-chrome.ts:348` | dead-code | `void input.width` verified; live-line.md deviation | drop param | none |
| `tooltipBoxSpring` chrome option accepted-then-voided ×4 | `internal/hover-chrome.ts:170`, `scatter-hover-chrome.ts:137`, `candlestick-hover-chrome.ts:98`, `bar-hover-chrome.ts:154` | dead-code | all four `void` statements verified; box spring actually resolves inside tooltip-chrome via config | drop the redundant per-chrome option (keep `ChartTooltipConfig.boxSpringConfig`, which is live parity surface) | low |
| Phantom `bandWidth` read | `internal/bar-hover-chrome.ts:382` `(state as {bandWidth?}).bandWidth` | dead-code | never populated by any caller (bar.md deviation) → ring-dot sizing always takes gap-4 fallback | remove dead branch (fallback IS the observed behavior) | none |
| `ScatterHoverChromeState.hoveredIndex` | `internal/scatter-hover-chrome.ts` | dead-code | declared + read but never set by `scatter-chart.tsx` (scatter.md deviation) | remove field; pill keeps consuming `datumIndex` | none |
| `hoverInputsRef` fully populated, never read | `funnel-chart.tsx:671-698` | dead-code | grep: only assignment sites, zero reads (funnel.md deviation) | delete ref + population block | none |
| `RingHoverConfig.groupEl` `@deprecated` | `internal/ring-hover-chrome.ts:64-65` | dead-code | "no caller in this part" (ring.md); grep: no external consumer | remove | none |
| Fake-Animation seeding + double listener-cleanup registration | `ring-chart.tsx` (`{cancel(){}} as Animation` into `pendingExpandAnimsRef`; `cleanupMap` registers progressGroup cleanup twice) | stale TODO-workaround | ring.md deviations; type-laundering + benign duplication | simplify two-writer gate (real sentinel type); register once | low — touch reveal handoff carefully |
| Redundant wake-loop branch | `live-line-chart.tsx` (audit §4 C2: both `if (!shouldWake)` branches call `wakeLoopRef.current?.()`) | stale TODO-workaround | live-line.md deviation "branch redundant as written" | collapse to unconditional wake | none |
| Stale comments batch | `pie-chart.tsx:35` (claims NumberFlow omitted — resolved via CenterStat); `internal/focus-disabled.ts` header + `gauge.tsx:21` (claim radar uses FOCUS_DISABLED — radar imports native `focusDisabled`); `styles.css:548,551` (cite nonexistent `internal/gauge-arc-mark.ts`); `grid.ts:7-9` (cites nonexistent `grid-chrome.tsx`); `sunburst-labels.tsx` header (claims cull parity — impl dims instead) | stale TODO-workaround | each checked against current imports/source (gauge.md, axes-grid.md, sunburst.md deviations) | update or delete comments | none |
| `pie-reveal.ts` | `internal/pie-reveal.ts` (33 LOC) | pass-through shim | byte-equivalent re-export of `enter-transition` (`buildProgressKeyframes`/`resolveEnterTransition`/`revealTiming`) + `PIE_TWEEN_FALLBACK === TWEEN_FALLBACK` + type aliases; sole consumer `pie-chart.tsx` | fold: import `enter-transition` directly; keep `PieEnterTransition` alias where the barrel needs it | none |
| `ring-reveal.ts` | `internal/ring-reveal.ts` (33 LOC) | pass-through shim | same shape as pie-reveal (source-verified identical header contract); sole consumer `ring-chart.tsx` | fold | none |
| `funnel-reveal.ts` | `internal/funnel-reveal.ts` (41 LOC) | pass-through shim | funnel.md: "thin re-export shim over `internal/enter-transition` … providing only funnel-family aliases"; sole consumer `funnel-chart.tsx` | fold | none |
| `gauge-reveal.ts` (shim half) | `internal/gauge-reveal.ts:40-62` | pass-through shim | re-exports `resolveEnterTransition`/`revealTiming` + `GaugeResolvedTiming/GaugeRevealTiming` aliases; the file's `reconcileGaugeReveal` engine is REAL and stays | fold re-export block into `gauge.tsx`; move `reconcileGaugeReveal` + `GAUGE_SPRING_FALLBACK` to a gauge-owned module | none |
| `radar-reveal.ts` (shim half) | `internal/radar-reveal.ts:117-138` | pass-through shim | aliased re-exports (`buildRadarProgressKeyframes` etc., `RADAR_TWEEN_FALLBACK === TWEEN_FALLBACK`); the file's `bklitRadarGrid` PolarGuide (~115 LOC) is REAL and stays | fold aliases into `radar-chart.tsx`; keep guide (rename file or move guide) | none |
| `FOCUS_DISABLED` local constant | `internal/focus-disabled.ts` (12 LOC) | pass-through shim | duplicates TanStack-native `focusDisabled` (`@tanstack/charts/focus/disabled`) — gauge.md TS-check: "verified identical shape"; radar already migrated to native | switch `gauge.tsx` to native `focusDisabled`; delete file | none |
| `tooltip-scheduler.ts` | `internal/tooltip-scheduler.ts` (67 LOC) | unnecessary complexity (single-consumer module) | sole importer `tooltip-chrome.ts` (grep + usage-matrix fold chain) | inline into `tooltip-chrome.ts` | none |
| `hover-reanchor.ts` | `internal/hover-reanchor.ts` (49 LOC) | unnecessary complexity (single-consumer module) | sole importer `hover-chrome.ts`; also carries private `bisectDateLeft` (:16) near-duplicating `bisect.ts` | inline; use shared `bisectDateLeft` | none |
| `x-ticks.ts` | `internal/x-ticks.ts` (284 LOC) | unnecessary complexity (single-consumer module) | sole importer `x-axis-overlay.tsx` (usage-matrix fold chain) | inline | none |
| `visx-pattern-bridge.tsx` | `internal/visx-pattern-bridge.tsx` (17 LOC) | unnecessary complexity (single-consumer module) | sole importer `pattern-preset.tsx` (grep) | inline the two @visx/pattern passthroughs | none |
| `radar-spring.ts` | `internal/radar-spring.ts` (49 LOC) | unnecessary complexity (single-consumer module + misnomer) | sole importer `enter-transition.ts`; generic spring settle-sampling, "radar" name only (usage-matrix) | inline into `enter-transition.ts`, drop misleading name | none |
| `bandWidthForSquares` ×3 | `internal/bar-squares-mark.ts:28`, `internal/bar-column-track-mark.ts:23`, inline in `toDotConfig` (`bar-hover-chrome.ts`) | redundant duplicate | bar.md: "triplicated helper"; grep confirms 2 fn copies + 1 inline | consolidate into `bar-squares-layout.ts` (already shared by both marks) | none (pure fn) |
| Hand-rolled pill date formatter ×5 | `bar-chart.tsx:647`, `scatter-chart.tsx:402`, `composed-chart.tsx:967`, `candlestick-chart.tsx:567`, `use-hover-chrome.ts:70` | redundant duplicate | all five hand-roll `toLocaleDateString("en-US",{month:"short",day:"numeric"})` (grep) instead of shared `shortDateFmt` (formatters) | consolidate on `shortDateFmt` after byte-identity check of output | low — verify identical formatting first |
| `SegmentComponent` interface ×2 | `internal/chart-selection.ts:178` + `internal/segment-visuals.tsx:8` | redundant duplicate | structurally identical (interaction.md deviation; grep) | keep one, import other | none |
| `ChartMarker` interface ×2 | `internal/chart-markers.tsx:8` + `internal/types.ts:458` (canonical, barrel-exported) | redundant duplicate | legend-markers.md deviation "drift risk" | import canonical from `types.ts` | none |
| Duplicate y-domain memos | `scatter-chart.tsx` (`yDomain` ≡ `yDomainScatter`; `timeExtentScatter` recomputes min/max from x-scale memo) | redundant duplicate | scatter.md deviation "identical logic in the same file" | merge memos | none |
| `maxRevealDelayMs` exported but recomputed inline | `internal/sunburst-reveal.ts:75` vs `sunburst-chart.tsx:817` | redundant duplicate | sunburst.md deviation | consume the export or drop it | none |
| `intFmt` inlined ×2 | `internal/legend.tsx` + `internal/chart-legend.tsx` | redundant duplicate | legend-markers.md deviation (legacy shared via chart-formatters) | import `formatters.intFmt` | none |
| `xForDate` extended-x mapping hand-rolled ×3 | `composed-chart.tsx` terminal-anchor / end-anchor / gradient-def memos | redundant duplicate | composed.md deviation "suspicious duplication" | extract one local helper | none |
| Zoom-transform writers ≈ duplicates | `choropleth-chart.tsx` `applyZoomToGroups` vs `syncZoomTransform` (+ repeated try/cancel blocks) | redundant duplicate | choropleth.md deviation "near-identical" | merge | low — zoom gesture paths |
| Heatmap literal/JSX duplication | levelStyles 5-entry literal built 3× (colors module, legend fallback, `levelStylesFromColors`); tooltip content JSX duplicated instant/animated paths | redundant duplicate | heatmap.md deviation | single builder + one JSX branch | none |
| Brush drag duplication | `internal/brush-drag.ts` clamp/sort repeated in `onPointerMove` + `onPointerUp`; `blurPx=1.5` default in `ChartBrush` + `BrushChrome` | redundant duplicate | internal-brush.md deviations | extract clamp helper; single default | none |

## Deferred to the TanStack lens (custom machinery with a noted simpler native path — 1 line each, not duplicated here)

- Spring stack (`spring.ts` rAF integrator + `candle-spring.ts` motion-dom port + `radar-spring.ts`) vs native `createChartSpring` — TS-check: partial native coverage; defer.
- Candlestick dual reveal path (CSS `@keyframes ts-candle-reveal` fast path at bounce≈0.15 + WAAPI fallback) — perf-motivated (20k WAAPI objects at n=10k); defer.
- Per-chart reveal replay guards (`data-bkmRevealed` stamp + data-identity refs) — systemic workaround for TanStack recreating the marks group; belongs to the lens, not per-chart cleanup.
- Sunburst `Object.assign` accessor stubs over d3 `arc()` to satisfy `WrappedArc` typing — native `RadialArcOptions.generator` hook exists; defer.
- Candlestick 4× duplicated scale math ("independently exact") — deliberate pattern; defer.
- Gauge key-diffing reconciler vs `motion()` key-diff enter/exit — defer.
- Funnel/gauge-linear/plain-SVG bypasses of `defineChart` — already FLAGGED FOR FABLE in part reports; not re-litigated here.

## Not flagged (deliberately kept)

- `decimate.ts` LTTB — required by bench conventions (bklit decimation strategy parity).
- `HeatmapCells.colorScale` accepted-but-ignored (`void _colorScaleProp`) — parity prop; keep.
- Inert parity props (`BarDepthProvider.segmentsAccessor/minBarHeight`, `BarDepthBack.colorAccessor`, `BarXAxis.tickerHalfWidth`, `Candlestick.insideStrokeWidth`, `stacked`, `xDomainSlotCount`, choropleth `patterns`/`enterTransition`/`revealSignature`) — API-surface parity, not dead code; deletion needs a Fable waiver.
- Deliberate dead-behavior ports (pie/ring glow, ring fade 0.35, `CHART_LEGEND_FADED_OPACITY_CLASS`) — D19/D49 "ported as observed pixels" precedent.
- Legend kit / brush overlay stack / heatmap-legend / profit-loss legends / ring-center — barrel-LIVE (see correction above).

## Open questions for 4.3

1. **Public-barrel orphans**: `ChartLegend`/legend kit, `ProfitLossLegend` family, `BrushLayout`/`ChartBrush`, `HeatmapLegend`, `RingCenter` are consumed only by harness/demo code through the barrel. Is legacy-API parity of the migrated package a hard requirement post-migration, or may the public surface shrink (needs Fable ruling + bench/QA scenario updates)? This gates the largest consolidation opportunity (3 parallel hovered-index contexts).
2. **Legacy-public utils**: `topSquareCenterY` (and `computeSeriesBarRevealClipPadding`, unused-at-runtime but "kept for docs/parity") were reachable from the legacy barrel. Confirm barrel-parity obligations before deleting.
3. **Bar pulse**: ship-of-theseus — the animated wave exists only in dead `bar-pulse-overlay.tsx` while the live mark renders a static silhouette. Delete (accept static as parity) or resurrect (wire wave into `barPulseMark`)? Needs a pixel-gate check against bklit.
4. **Heatmap loading-cell props**: `loadingCellMaxOpacity`/`loadingCellRandomness` are accepted-but-inert after the shimmer cut. Keep for API compat (current state) or drop with waiver?
5. **`dateLabelsForPill` consolidation**: confirm `shortDateFmt` output is byte-identical to the five hand-rolled `toLocaleDateString` calls before swapping (timezone/ICU defaults should match, but verify).
6. **styles.css duplicate block**: the two loading-block copies look verbatim-identical by selector grep; do a full diff before deleting one (and confirm which copy is authoritative).
