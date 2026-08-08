# HeatmapChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/heatmap-audit.md`, live `migrated/charts/heatmap-chart.tsx` + `internal/heatmap-hover-chrome.ts` + `internal/heatmap-components.tsx`.

## Goal
Harden the only broken flow with live repro and trim per-move wakeup cost, keeping the 825-line calendar math and 257-line legend verbatim. Heatmap is the highest-custom chart (`cell` island native, scaffold 100% custom) — not a rewrite.

## Distilled overhead
- Broken (§4): `setHoveredCell(null→null)` and repeated same-cell notifications fire unconditional `notify()` on every `pointermove`, waking O(cells) subscribers per frame; also SSR empty-first-paint and fractional binWidth mismatch.
- Wrappers (§3): 30-dep merged `HeatmapContextValue`, interaction Provider/Boundary/Root trio, `displayName` child walk.

## Synthesis — Keep / Defer / Change

### Keep
- `K1` `cell(cellData, {x,y,z, color})` island + `scaleBand` via `HeatmapCells` — correct TanStack-native.
- `K2` 825-line `heatmap-utils.ts` + 257-line legend + 163-line hover chrome (verbatim bklit parity, ghost-bin, quarter-start precedence, `formatHeatmapContributionLabel`).
- `K3` `useHeatmapChartLifecycle` `revealing→ready` + `HEATMAP_LOADING_CONCEAL_MS` (bench M1b phase machine, not broken).

### Defer
- `D1` Forward sizing to TanStack host (`defineChart((ctx)=>spec)` + `aspectRatio`) — needs separator scene-sync, M fractional proof.
- `D2` Replace coordinator with TanStack `ChartFocusStrategy` + tooltip island (legend cross-highlight needs custom level-grouped strategy, coverage risk).
- `D3` Merge lifecycle into `animate` + `reconcile` tween (needs stagger parity proof).
- `D4` Collapse Provider/Boundary/Root + `displayName→CHART_ROLE` walk.

### Change — tight C this slice

**C1 — Deduplicate `HeatmapHoverCoordinator.notify()` (audit §4 row3 + §6 #5 edge, M).** Guard `setHoveredCell`/`setHoveredLegendLevel`/`setTooltipData`/`clearInteraction` so `notify()` only fires when state actually changes (check `Object.is` for cell identity or shallow cell-key equality for `HeatmapHoveredCell {column,row}` plus level equality). Prevents unconditional per-move broadcast waking 364 cells' `useSyncExternalStore` re-evals on same-cell `pointermove`.

> Scope note: No sizing forward, no coordinator→focus strategy rewrite, no lifecycle unification this slice — all D. Slice is the single per-move wakeup regression with bench-range repro (`pointermove` over same cell at 60fps).

## Execution
- Patch `migrated/charts/internal/heatmap-hover-chrome.ts` single helper: add dedup guards in `setHoveredCell(cell)` etc. (compare incoming vs stored; `if (hoveredCell?.column===cell?.column && hoveredCell?.row===cell?.row) return` style or strictly `Object.is` for same object, whichever matches caller identity — bklit's dedup is `${index}:${round(x)}` string). Keep `bench/app` build PASS. QA heatmap n=26/52 tooltipless? No — heatmap DOES have tooltip; but settled/tooltip both pass on current build.

## Risks
- Low — dedup only suppresses no-op notifications; state-changing hops still fire. Verify hover still paints correctly when moving cell-to-cell and legend-level cross-highlight still dims.

## Questions open
- None blocking — only coordinator churn has per-frame repro.
