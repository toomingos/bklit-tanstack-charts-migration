# Phase 7 — second independent audit (2026-09-04)

Re-run of `00-independent-audit.md` with the same two claims under test. Only **new** gaps are listed; known ones (funnel raw SVG, pattern hatch, wipe/sweep CSS, live-line fade, radial gradients, framer ease/keyframe arrays, `host`, `xDomainSlotCount`, d3 scale objects in callbacks) are excluded. Counts are from grep/tsc/oxlint/esbuild on the working tree.

## 1. Nativeness — new gaps

| # | Gap | Evidence | Size |
|---|---|---|---|
| N-1 | **Parallel scale construction.** Charts build their own d3 scales next to the package's resolved scales to place marks, axes, markers, projections. | `bar-chart.tsx:2316,2390,2413,2420,2427,2752`; `area-chart.tsx:1118,1331,1620`; `internal/composed-scales.ts`, `scatter-scale-setup.ts`, `line-x-scale.ts`, `y-domain.ts`, `reference-area-scale.ts`, `axis-scale-options.ts`, `line-marker-anchors.ts`, `heatmap-cell-motion.ts` | 44 call sites / 15 files / 26 `d3-scale` imports (vs 70 package-scale reads) |
| N-2 | **Heatmap coordinate system and axes are hand-built.** `xScale`/`yScale` are arithmetic closures; both axes are `createPortal`ed absolutely-positioned `<div>`s. `00` counted heatmap as native from the cell rects alone. | `internal/heatmap-chart-inner-layout.ts:124-135`, `internal/heatmap-x-axis.tsx`, `internal/heatmap-y-axis.tsx` | 17 `createPortal` sites tree-wide |
| N-3 | **Own polar hit-testing and hover bus** for pie/ring; own hit-path SVG overlay for sunburst. Bypasses `resolvePointer`/`setControlledFocus`. | `internal/polar-hit.ts:35,50` ← `pie-chart.tsx:545-556`, `ring-chart.tsx:793`; `internal/pie-hover-chrome.ts`; `internal/sunburst-hit.tsx` | 3 charts |
| N-4 | **Layout outside the package** for choropleth (d3-geo projection+path) and sankey (d3-sankey positions), sunburst geometry duplicated (`internal/sunburst-geometry.ts` + package `sunburst()`). | `choropleth-chart.tsx:5-6`, `internal/sankey-layout.ts:4` | 20 `d3-(geo|sankey|hierarchy|shape)` imports |
| N-5 | **Imperative DOM writes per frame.** Tooltip/indicator springs write `cx`/`x`/`x1` via `setAttribute` in `onUpdate`; sankey builds `linearGradient`/`stop`/`defs` with `createElementNS` and writes `pathLength`. | `internal/tooltip-components.tsx:81,309`, `tooltip-dot.tsx:89`, `tooltip-indicator-inner.tsx:62`, `internal/sankey-animation.ts:58-101` | 27 `setAttribute`, 6 `createElementNS` |
| N-6 | **Bespoke-mark footprint is ~4× the earlier sample.** `createMark` in 18 files (candlestick ×2, gauge, bar-squares, pattern-area, area-fill, bar-trimmed, bar-depth ×2, profit-loss-line, series-bar, sankey, highlight-band, bar-column-track, projection-line, series-marker, bar-pulse). Sanctioned extension point, but the package paints while the migrated code computes. | grep `createMark(` | 18 files |

Per-chart: fully package-rendered = bar/area loading wrappers only. Package paint + own coordinate/hit pipeline = area, bar, line, composed, scatter, radar, candlestick, pie, ring, sunburst, heatmap. Mostly custom = funnel, live-line, choropleth, sankey.

**Nativeness: 5.5 / 10.** The package owns paint; it does not own the coordinate system, hit-testing, or per-frame updates in a majority of charts. Routes in `02`–`04` address marks and motion, not N-1/N-2/N-3.

## 2. API parity — new gaps

| # | Gap | Evidence |
|---|---|---|
| A-1 | **Composition contract changed: real components → null-returning config carriers.** Legacy `Area`, `Grid`, `XAxis`, `ChartBrush`, … are real components (own hooks, own JSX; `area.tsx:136,298`, `chart-brush.tsx:257`, `grid.tsx:96`) and the parent also renders `{children}` verbatim (`area-chart.tsx:181,256`). Migrated equivalents return `null` and carry a `Symbol.for("migrated.chartRole")` tag (`internal/area-child.ts:6-8`, `internal/chart-brush.tsx:24-33`); the parent never renders `{children}`. | 32 carrier files (`grep -l "CHART_ROLE] ="`) |
| A-2 | **Child detection keys off the element `type` symbol, not name.** Legacy accepts `displayName`/`name` fallbacks (`area-chart.tsx:84-89`), so a consumer wrapper/HOC around `<Area>` still works. Migrated reads `type[CHART_ROLE]` (`internal/children-extract.ts:72-77`); a wrapped child is **silently dropped** with no error. | — |
| A-3 | Standalone render of a sub-component (story, unit snapshot, custom layout) paints SVG in legacy, nothing in migrated. Silent. | follows from A-1 |
| A-4 | `ChartBrushProps.onSelectionChange` typed inline instead of the exported `BrushSelection` name (`internal/chart-brush.tsx:13` vs `index.ts:89`): nominal mismatch for consumers who type handlers against the exported name. | — |
| A-5 | `ChartLegend`/`ChartLegendProps.onHover` and `ProfitLossLegend.onHoverChange` exist internally but are not exported from `index.ts` → the hover callback contract is unreachable to consumers who place legends themselves. | `internal/chart-legend.tsx:20`, `internal/profit-loss-legend.tsx` |
| A-6 | Imperative handles: neither side uses `forwardRef`/`useImperativeHandle`. Parity by absence. | — |

Fixture coverage: 15 fixtures, all typecheck-only, none render. No fixture for `ChartBrush`, `ChartLegend`, `Background`, `ProjectionLine`, `ProfitLossLine`, `Segment`, `BarSquares`, `BarDepth*`, `Sunburst` — exactly the carrier surface where A-1..A-3 would surface first.

**API parity: 6 / 10.** Canonical `<Chart><Child/></Chart>` usage swaps cleanly; any other composition shape breaks silently, and nothing tests either path.

## 3. Evidence — new gaps

| # | Gap | Evidence |
|---|---|---|
| E-1 | **Gate artefacts are outside the repo.** `SUMMARY.md`, run history, and `latest/` live under `archive/` (gitignored, `.gitignore:14`); `qa/gate/summarize.mjs` now throws ENOENT on `docs/phase-6/gate/latest`. The "gate closed" commit cannot be re-derived from a fresh clone. | `qa/gate/run-all.mjs:2`, `archive/phase-6/docs/gate/` |
| E-2 | Working tree does not typecheck: 3 `TS2322` in `internal/reference-area-layer.tsx:150,156,162`. Gate ran before the uncommitted refactor (303 modified files); bench-baseline 2026-09-02, bundle-sizes 2026-09-02. | `tsc --noEmit` |
| E-3 | Zero unit/integration tests in `showcase/migrated` and `qa` (`*.test.*`/`*.spec.*` = 0). All evidence is screenshot/bench/typecheck. | find |
| E-4 | 1055 oxlint errors remain in `migrated/charts` (react-perf, sonarjs naming, id-length). Not gated. | `oxlint migrated/charts` |
| E-5 | Bench scenarios 43 vs API fixtures 15; sunburst, segment, brush, legend, projection, profit-loss have bench cells but no API fixture. | `ls bench/app/src/scenarios`, `ls qa/api-compat` |

**Evidence: 5 / 10.** The gate itself is sound; its outputs are unversioned, its inputs are stale relative to the tree, and nothing exercises behaviour below the screenshot.

## 4. Bundle — status

`scripts/bundle-gate.mjs`: all cells OK, ≤ +1.6 % vs pin (e.g. arealoading 114.5 kB gzip vs bklit 88.7; sunburst 96.5 vs 85.4). Pins are the migrated sizes themselves, not bklit, so the gate measures drift, not parity. `styles.css` is 49.9 kB and stubbed to `""` in `bench/measure-bundle.mjs`, so CSS never appears in any number. Routes in `04` stand; no new gap beyond the CSS blind spot.

**Bundle: 7 / 10.**

## 5. Maintainability — new gaps

| # | Gap | Evidence |
|---|---|---|
| M-1 | **Internal module count is 350, not 156** as recorded in `00`–`04` (that figure was the reachable set for one chart). Legacy total is 204 files. | `git ls-files showcase/migrated/charts/internal` |
| M-2 | Migrated tree is 60 404 lines vs legacy 38 488 (×1.57); `bar-chart.tsx` 2 854 lines vs legacy 733, `candlestick-chart.tsx` 2 305, `area-chart.tsx` 1 915. | wc |
| M-3 | 9 orphan internal modules imported by nothing: `candlestick-marks.ts`, `chart-marker-fan-geometry.ts`, `chart-marker-primary.tsx`, `ensure-spring.ts`, `gradients.tsx`, `heatmap-cell-helpers.ts`, `heatmap-pattern-defs.tsx`, `heatmap-tooltip-bridge.ts`, `tooltip-dot.tsx`. | scratch `orphans.mjs` |
| M-4 | Stray tracked file `internal/__tm` containing a git error message, committed in `fedfe3c`. | `git log -- internal/__tm` |
| M-5 | Fan-in hotspots: `types` 126, `chart-child-carrier` 59, `enter-transition` 41, `heatmap-utils` 32. Heatmap alone spans 30+ modules. | scratch |

**Maintainability: 4 / 10.**

## 6. Scores

| Aspect | `00` | Now | Delta driver |
|---|---|---|---|
| Nativeness | 6.5 | **5.5** | parallel scales, heatmap coords/axes, own hit-testing (N-1..N-3) |
| API parity | 7 | **6** | config-carrier composition break (A-1..A-3) |
| Evidence | 6 | **5** | artefacts gitignored, tree does not typecheck, zero tests |
| Bundle | 5 | **7** | gate green; CSS blind spot |
| Maintainability | 5 | **4** | 350 modules, ×1.57 LOC, 9 orphans |

Achievable scores in `04-last-mile.md` assumed the `00` gap list was complete. N-1/N-2/N-3 and A-1/A-2 are not covered by any route in `02`–`04` and need a sixth pass.
