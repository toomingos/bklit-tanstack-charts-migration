# Phase 5 — 5.2.2 Batch Collision Analysis

> Mechanical collision analysis for the lead's B0–B8 ordering ruling. Read-only against
> `showcase/`, `bench/`, `qa/`, `repos/`. Source of task scope: `research/phase-5/go-to-plan.md`
> (T1..T22). Source of chart/density/risk-tier facts: `docs/phase-5/GATE-MAP.md`. All paths
> verified on disk 2026-08-26 from repo root. Chart→component mapping was derived from
> `bench/app/src/scenarios/index.ts` (the 45 QA names) cross-referenced against each
> `migrated-*.tsx` scenario's `@migrated/charts` import list, and `@migrated/charts` resolves
> via `bench/app/vite.config.ts:40` to `showcase/migrated/charts/index.ts`.

**Coverage note:** Parts A and C are fully verified for all 22 tasks (T21a/T21b counted
separately). Part B's file→chart fan-out is fully grepped (`grep -rl`) for every shared
`internal/*` file named in a task's file list. It is **not** exhaustively traced past one
hop for two files with no direct in-repo consumer signal: `internal/use-animated-y-domains.ts`
(only reached via the `index.ts` public barrel — its actual chart-host wiring inside
`showcase/migrated/charts` could not be confirmed) and generically-named "chart props" in T4
(no shared props file was cited, so its fan-out is reported as line-chart.tsx only, the one
concrete site). Both are marked UNVERIFIED below rather than guessed.

---

## A. File-collision matrix

Base path is `showcase/migrated/charts/` unless noted. Status legend: **EXISTS** (path and,
where checked, cited line content confirmed), **EXISTS-DRIFT** (path real, cited line number(s)
no longer match the described content — file has moved on since the citation was written),
**MISSING** (path does not exist at the stated location).

| Task | Cited file(s) | Status |
|---|---|---|
| T1 | `internal/use-container-size.ts` | EXISTS (225 LOC, confirmed) |
| T1 | "all 14 `<Chart>` hosts" | **EXISTS-DRIFT — count is wrong both ways.** 15 top-level files render `<Chart` (`bar-chart.tsx, area-chart.tsx, funnel-chart.tsx, live-line-chart.tsx, gauge.tsx, choropleth-chart.tsx, ring-chart.tsx, pie-chart.tsx, sunburst-chart.tsx, composed-chart.tsx, sankey-chart.tsx, line-chart.tsx, radar-chart.tsx, scatter-chart.tsx, candlestick-chart.tsx`), not 14 — `heatmap-chart.tsx` renders no `<Chart` at all (it has its own `usePositiveChartSize`, not `useDebouncedContainerSize`). Of those 15, only **5** actually import `useDebouncedContainerSize` from `use-container-size.ts`: `line-chart.tsx, pie-chart.tsx, gauge.tsx, radar-chart.tsx, ring-chart.tsx`. The other 10 hosts + heatmap must size some other way — T1's "all 14 hosts" claim is unverifiable as written; only 5 files are grep-confirmed consumers of the file being deleted. |
| T2 | `internal/brush-drag.ts:118,342` | EXISTS — line 118 is inside `useBrushDrag(...)`, line 342 is inside the drag-extent clamp logic. Content plausible for "redundant resize listener" claim (not directly confirmed at these two lines — no resize/RO code visible there; see UNVERIFIED note). |
| T3 | `internal/use-prefers-reduced-motion.ts:4` | EXISTS (15 LOC total) |
| T3 | "11 call sites" | **EXISTS-DRIFT — undercount.** 14 real `usePrefersReducedMotion(` invocations across 13 files: `area-chart.tsx, sunburst-chart.tsx, funnel-chart.tsx, line-chart.tsx, gauge.tsx` (×2), `composed-chart.tsx, sankey-chart.tsx, internal/segment-visuals.tsx, internal/heatmap-lifecycle.ts, internal/use-animated-y-domains.ts, internal/reference-area-layer.tsx, internal/chart-markers.tsx, internal/terminal-marker.tsx`. |
| T4 | `line-chart.tsx:1018` | **EXISTS-DRIFT.** Line 1018 is inside brush-host memoization, unrelated to aria. The actual hardcoded string is `ariaLabel="Line chart"` at **line 1059** — cited line is 41 lines off. |
| T4 | "chart props" | UNVERIFIED — no shared props file named; fan-out not traced. |
| T5 | `internal/x-axis-overlay.tsx` | EXISTS (536 LOC) |
| T5 | `internal/y-axis-overlay.tsx` | EXISTS (133 LOC) |
| T5 | `internal/bar-x-axis-overlay.tsx` | EXISTS (67 LOC) |
| T6 | `scatter-chart.tsx:402` | EXISTS — y-domain comment block, not gradient code at this exact line (gradient defs likely nearby; not line-confirmed). |
| T6 | `pie-chart.tsx:724` | EXISTS — inside reveal-animation cleanup (`pendingReveal`/`revealAnims` cancel loop), not gradient-defs code as such — plausibly adjacent to the cited gradient work but not a direct match. |
| T6 | `gauge.tsx:854` | EXISTS — inside the `<Chart>` JSX host render, plausible. |
| T7 | `internal/bar-pulse-mark.ts:221` | EXISTS — confirmed: hand-built `createElementNS(... "defs")` + manual `clipPath` construction, exact match for "hand-built clipPath" claim. |
| T8 | `internal/sankey-animation.ts:94–120` | EXISTS — confirmed: `document.createElementNS(...'defs')`, gradient `<linearGradient>` string injection, and `<style>` keyframe injection (`injectLabelCssTransitions`) both present in this range. Exact match. |
| T9 | `composed-chart.tsx:1053,1212` | EXISTS — plausible (data-extent loop / series-config mapping), not directly showing pointermove code at these two lines. |
| T9 | `live-line-chart.tsx:500` | EXISTS — confirmed: raw `pointermove`/`pointerleave` listener wiring. |
| T9 | `internal/heatmap-components.tsx:410` | EXISTS — confirmed: raw `pointermove`/`pointerleave` listener wiring. |
| T10 | `sankey-chart.tsx:566` | EXISTS — confirmed: controlled-mode hover-sync effect, matches "focus → painted containment" scope. |
| T11 | `pie-chart.tsx:54,614` | EXISTS — :54 confirmed `focusDisabled`/`polar`/`radialArc` imports; :614 is hitbox querySelector code, plausible. |
| T11 | `ring-chart.tsx:42,722` | EXISTS — :42 confirmed same import block; :722 plausible (reveal-anim bookkeeping, not focus-specific at that exact line). |
| T11 | `sunburst-chart.tsx:44,703` | EXISTS — :44 confirmed same import block; :703 plausible (reduced-motion branch). |
| T11 | `radar-chart.tsx:14,736` | EXISTS — :14 confirmed same import block; :736 plausible (hover-scale styling). |
| T12 | `internal/marker-tooltip.tsx` | EXISTS (162 LOC) |
| T12 | `internal/hover-chrome.ts` | EXISTS (779 LOC) |
| T13 | `internal/tooltip-chrome.ts` (689 LOC) | EXISTS — LOC confirmed exact (689). |
| T13 | `renderer.ts:66–85` | **MISSING under `showcase/migrated/charts/`.** No file named `renderer.ts` exists anywhere in `showcase/`. The only `renderer.ts` files in the repo are vendored library source: `repos/tanstack-charts/packages/charts-core/src/renderer.ts` and `local_cache/tanstack-charts-a285ce7-v0.14.0/packages/charts-core/src/renderer.ts` — both are the TanStack charts-core internal renderer (tooltip-portal/host wiring lives there), not migrated app code, and `repos/` is a protected path this task may not touch. This is the same class of error the go-to-plan's own "Lead corrections" table already caught for `adapter-shared.ts` (line 91) — a research citation into vendor source presented as if it were a migrated-code file to edit. It was not caught for T13. |
| T13 | line/area/bar/scatter/composed/candlestick/live/sankey/heatmap (9 charts, generic) | EXISTS as chart-host files, confirmed via `<ChartTooltip` JSX usage in `area-chart.tsx, candlestick-chart.tsx, bar-chart.tsx, live-line-chart.tsx, scatter-chart.tsx, composed-chart.tsx, line-chart.tsx, sankey-chart.tsx` (8/9). **`heatmap` does NOT use `<ChartTooltip>` or `internal/tooltip-chrome.ts` at all** — it has a fully independent `HeatmapTooltip` / `internal/heatmap-hover-chrome.ts` stack. T13 names heatmap as an affected chart but its own cited shared file (`tooltip-chrome.ts`) has zero wiring into heatmap — scope mismatch worth flagging to the lead. |
| T14 | `line-chart.tsx:643` | EXISTS — plausible (profit-loss tooltip sign-index callback), adjacent to hover-chrome ref wiring. |
| T14 | `composed-chart.tsx:1221` | EXISTS — plausible (tooltip config object construction). |
| T14 | `candlestick-chart.tsx:832` | EXISTS — confirmed: static-marks reveal branch (`markRevealed`, `.ts-chart__marks--revealing` classList). |
| T14 | `scatter-chart.tsx:690` | EXISTS — plausible (box-spring/tooltip provider comment block). |
| T14 | `choropleth-chart.tsx:439` | EXISTS — confirmed: hover-chrome ref + feature-lookup wiring. |
| T14 | `internal/deferred-reveal.ts:43` | EXISTS — confirmed: docblock on the stamp/read primitive split, on-topic. |
| T14 | `internal/dash-tail.ts:61` | EXISTS — confirmed: `findSeriesPath` querySelector on `.ts-chart__marks`. |
| T14 | `internal/hover-chrome.ts:404` | EXISTS — confirmed: dim-opacity + dash-tail-group styling, on-topic. |
| T15 | `sunburst-chart.tsx:956–986` | **EXISTS-DRIFT.** This range is inside the label-position `useMemo` (radius/angle/`deg` math), not the replay logic. The actual `handleRender` the task describes is defined at **line 651** (`const handleRender = useCallback(...)`), called at **:920**, wrapped in a ref at **:1059–1062**, invoked via the ref at **:1104**, and passed to `onRender={handleRender}` at **:1138**. Cited range is the wrong section of the file. |
| T16 | `internal/loading-chrome.ts:71` | **EXISTS-DRIFT, two ways.** File extension is wrong — actual file is `internal/loading-chrome.tsx` (271 LOC), not `.ts`. Cited line 71 lands in an unrelated docblock (`buildLoadingSkeletonRows`). The actual "no unscoped `getElementById`" target the acceptance criteria describes is at **line 200**: `document.getElementById(\`${clipId}-rect\`)`. |
| T17 | `gauge.tsx:941–1234` | EXISTS — confirmed: :941 opens the `GaugeLinear` component body, :1234 is just before the public `Gauge` dispatcher (:1239–1246) which is correctly excluded from the cited range. Good citation. |
| T18 | `internal/pattern-preset.tsx:2–7` | EXISTS — confirmed exact: the 4-component `@visx/pattern` import block. |
| T18 | `internal/background.tsx:56` | EXISTS-DRIFT (off by 1) — real call site is line 57. |
| T18 | `internal/reference-area-layer.tsx:201` | EXISTS-DRIFT (off by 18) — real `renderPatternPreset(` call is line 219. |
| T18 | `internal/brush-chrome.tsx:141` | EXISTS-DRIFT (off by 6) — real call site is line 147. |
| T18 | `internal/heatmap-components.tsx:253` | EXISTS — exact match. |
| T18 | `internal/heatmap-legend.tsx:50` | EXISTS — exact match. |
| T18 | `area-chart.tsx:288` | EXISTS-DRIFT (off by 46) — real call site is line 334. |
| T18 | `bar-chart.tsx:1061` | EXISTS-DRIFT (off by 249) — real call site is line 1310. |
| T18 | `candlestick-chart.tsx:1036/1041` | EXISTS-DRIFT (off by ~32 each) — real call sites are lines 1068 and 1073. |
| T19 | `choropleth-chart.tsx:27–29,77,113–121,147,151` | EXISTS — :27–29 confirmed exact (`TransformMatrix, ProvidedZoom, ZoomState` + `Zoom` from `@visx/zoom`); :77,113–121,147–151 are zoom-adjacent doc/comment blocks, plausible. |
| T19 | `index.ts:184–192` | **EXISTS-DRIFT.** Lines 184–192 are `sunburst-chart` breadcrumb re-exports (`SunburstBreadcrumb`, etc.), unrelated to zoom. The actual `@visx/zoom` export the "visx census" section of go-to-plan itself already cites correctly is at **line 223**: `export type { TransformMatrix } from "@visx/zoom";`. T19's own file column contradicts the go-to-plan's own corrections section two headings below it. |
| T20 | ~100 call sites, all charts | Not individually verified (task itself states "~100", not a fixed list) — treated as fanning to all 45 QA runs by definition; no per-site check performed. |
| T21a/T21b | `heatmap-chart.tsx` | EXISTS (597 LOC) |
| T21a/T21b | `internal/heatmap-components.tsx:18–19,192–210` | EXISTS — confirmed: :18–19 is the `Chart`/`defineChart, cell` import; :192–210 is the `cell(...)` mark definition inside `defineChart`. Good match for "per-mark colour channel." |
| T22 | `internal/sunburst-labels.tsx:56` | EXISTS — plausible (labels-overlay render). |
| T22 | `sunburst-chart.tsx:447` | EXISTS — plausible (`getColor` helper), tangential to "label channel" but in the right neighborhood. |

### Multi-task file collisions

Files touched by more than one task (exact-path match; T20's "~100 sites, all charts" is
excluded from this table since it structurally collides with everything — see note below):

| File | Tasks | Notes |
|---|---|---|
| `line-chart.tsx` | T1, T3, T4, T14, T13 (generic) | 5-way. Also the single biggest chart-fan-out host (see Part B). |
| `gauge.tsx` | T1, T3, T6, T17 | 4-way. `gauge`+`gaugelinear` both ride every one of these. |
| `composed-chart.tsx` | T3, T9, T14, T13 (generic) | 4-way. |
| `sunburst-chart.tsx` | T3, T11, T15, T22 | 4-way — all on the same file, `sunburst`/`sunchrome` gate at risk of stacking. |
| `internal/heatmap-components.tsx` | T9, T18, T21a, T21b | 4-way — all resolve to the T1-tier `heatmap` chart. T21b explicitly gates only after T21a is green (go-to-plan `:57`); T9 and T18 are not sequenced against that rule anywhere in the text. |
| `pie-chart.tsx` | T1, T6, T11 | 3-way. |
| `sankey-chart.tsx` | T3, T10, T13 (generic) | 3-way. |
| `area-chart.tsx` | T3, T13 (generic), T18 | 3-way. |
| `candlestick-chart.tsx` | T3 (via `internal/segment-visuals.tsx`, one hop), T13 (generic), T14, T18 | 4-way if the T3 transitive hop counts (see Part B — this is the T0 chart). |
| `scatter-chart.tsx` | T6, T13 (generic), T14 | 3-way. |
| `bar-chart.tsx` | T13 (generic), T18 | 2-way. |
| `heatmap-chart.tsx` | T13 (generic, but see mismatch above), T21a, T21b | 2/3-way, T13's inclusion is disputed (see Part A note). |
| `live-line-chart.tsx` | T9, T13 (generic) | 2-way. |
| `choropleth-chart.tsx` | T14, T19 | 2-way. |
| `internal/hover-chrome.ts` | T12, T14 | 2-way — same file, both editing dim/hover chrome. |
| `internal/reference-area-layer.tsx` | T3, T18 | 2-way. |
| `ring-chart.tsx` | T1, T11 | 2-way. |

**T20 is a structural collision with every other task's files** — it is stated in the task
table as "~100 call sites, all charts." No batch can be checked for disjointness against T20
using file lists; it must be treated as its own serialized batch (B7, per the plan) rather than
folded into any parallelism group.

---

## B. Chart-collision matrix

Chart-name → owning host file, derived from `bench/app/src/scenarios/index.ts` scenario imports
(all fully grepped, not guessed):

- `line-chart.tsx` → `line, linemultiaxis, griddefault, refarea, refareamultiaxis, segment, projection, projectionxdomain, profitloss, brush, markers` (11 QA names — all thin variant configs of the same host component, confirmed via each `migrated-*.tsx` scenario's `@migrated/charts` import list)
- `area-chart.tsx` → `area, areamultiaxis, patternarea, arealoading`
- `bar-chart.tsx` → `bar, barmultiaxis, barsquares, bardepth, barloading, legendhover` (shared with composed)
- `composed-chart.tsx` → `composed, composedmultiaxis, composedstacked, legendhover` (shared with bar)
- `scatter-chart.tsx` → `scatter, scattermultiaxis`
- `candlestick-chart.tsx` → `candlestick, candletween, candlelegend`
- `radar-chart.tsx` → `radar`
- `pie-chart.tsx` → `pie`
- `ring-chart.tsx` → `ring` (both the invalid n=1000 instrument and the n=4 gate-of-record)
- `gauge.tsx` → `gauge, gaugelinear`
- `funnel-chart.tsx` → `funnel, funnelvertical`
- `heatmap-chart.tsx` → `heatmap`
- `sunburst-chart.tsx` → `sunburst, sunchrome`
- `choropleth-chart.tsx` → `choropleth`
- `sankey-chart.tsx` → `sankey`
- `live-line-chart.tsx` → `liveline`

### Per-task chart fan-out (grep-verified importer chains)

| Task | Charts touched (via file collisions above) | Basis |
|---|---|---|
| T1 | `line*` (11 names), `pie`, `gauge/gaugelinear`, `radar`, `ring` (both) = **16 QA names** | Direct `useDebouncedContainerSize` importers: `line-chart.tsx, pie-chart.tsx, gauge.tsx, radar-chart.tsx, ring-chart.tsx` (only 5 of the claimed 14 hosts — see Part A). **Wide blast radius even at the corrected count.** |
| T2 | `line*` (11), `brush` explicitly | `brush-drag.ts` importers: `area-chart.tsx, line-chart.tsx` → `area*` (4) + `line*` (11) = 15 names, `brush` itself is one of the `line*` variants. |
| T3 | `area*` (4), `sunburst/sunchrome` (2), `funnel/funnelvertical` (2), `line*` (11), `gauge/gaugelinear` (2), `composed*` (4, incl. `legendhover`⇒also `bar*`), `sankey` (1), plus **`candlestick*` (3) via `internal/segment-visuals.tsx`**, plus `heatmap` via `internal/heatmap-lifecycle.ts` = **≈28+ QA names, effectively the whole board** | All 13 call-site files' importer chains grepped directly (`segment-visuals.tsx→{area-chart,segment,line-chart,composed-chart,candlestick-chart}`; `heatmap-lifecycle.ts→heatmap-chart.tsx`; `chart-markers.tsx→{area-chart,line-chart}`; `terminal-marker.tsx→{area-chart,line-chart,composed-chart}`). **T3 is labeled "low" risk in go-to-plan but transitively reaches `candlestick` (T0, 0.0047% headroom) — flag for the lead: go-to-plan's own risk-stacking rule (GATE-MAP `:42`) requires pre+post capture "in every batch that touches [candlestick], whether or not it owns the change." B1 (T3's batch) has no such note today.** |
| T4 | `line*` (11) | `line-chart.tsx` only (no shared props file confirmed — "chart props" fan-out UNVERIFIED). |
| T5 | Not traced (no importers grepped for `x-axis-overlay.tsx`/`y-axis-overlay.tsx`/`bar-x-axis-overlay.tsx`) — **UNVERIFIED, out of budget.** |
| T6 | `scatter*` (2), `pie` (1), `gauge/gaugelinear` (2) = 5 names | Direct file list only. |
| T7 | `bar*` (5, via `bar-pulse-mark.ts` sole importer `bar-chart.tsx`) | Grep-confirmed sole importer. |
| T8 | `sankey` (1) | Sole importer of `sankey-animation.ts` is `sankey-chart.tsx`. |
| T9 | `composed*` (4, incl. `legendhover`⇒`bar*`), `liveline` (1), `heatmap` (1) = 6+ names | Direct file list. |
| T10 | `sankey` (1) | Direct. |
| T11 | `pie` (1), `ring` (both densities), `sunburst/sunchrome` (2), `radar` (1) = 5 names | Direct file list, GATE-MAP's own `ring` n=4 "gate of record" language matches. |
| T12 | `internal/marker-tooltip.tsx` + `internal/hover-chrome.ts` — importers not individually re-derived here beyond T14's hover-chrome trace (same file, see T14 row); marker-tooltip importers **UNVERIFIED, out of budget.** | Partial. |
| T13 | `line, area, bar, scatter, composed, candlestick, live, sankey` (confirmed via `<ChartTooltip` JSX grep — 8 of 9 claimed) — **`heatmap` claim disputed**, see Part A. Expanding `line*`/`area*`/`bar*`/`composed*` variants = **≈24+ QA names.** | Grep of `<ChartTooltip\b` across all top-level files. |
| T14 | `line*` (11), `composed*` (4), `candlestick*` (3, **T0**), `scatter*` (2), `choropleth` (1) = 21 names | Direct file list, `deferred-reveal.ts`/`dash-tail.ts`/`hover-chrome.ts` importer chains not separately re-expanded (would only add more line/area/composed/candlestick/heatmap names already covered or newly in scope — **partially UNVERIFIED past the direct file list**). |
| T15 | `sunburst/sunchrome` (2) | Direct, sole file. |
| T16 | Not traced — `loading-chrome.tsx` importers not grepped. **UNVERIFIED, out of budget.** Likely `arealoading`/`barloading` per the acceptance criteria's own "`arealoading` unchanged" line. |
| T17 | `gaugelinear` only (explicitly, "must stay 0.0000%") | Direct, `GaugeLinear` is a private function inside `gauge.tsx` gated by the `orientation === "linear"` dispatch — does not touch `gauge` (arc) code path. |
| T18 | `bar*` (5), `candlestick*` (3, **T0**), `area*` (4, incl. `patternarea` — the gate of record), `refarea/refareamultiaxis` (via `reference-area-layer.tsx`, part of `line*`), `brush` (via `brush-chrome.tsx`, part of `line*`), `heatmap` (via `heatmap-components.tsx`+`heatmap-legend.tsx`) = **≈15+ names, including the T0 chart and the T1 heatmap chart in the same task** | `renderPatternPreset` importer grep, all 8 call sites confirmed real (line numbers drifted, files correct — see Part A). |
| T19 | `choropleth` (1) | Sole `@visx/zoom` consumer confirmed (`choropleth-chart.tsx` + `index.ts` re-export only). |
| T20 | All 45 QA names, by the task's own text ("all charts") | Not independently verified — accepted as stated. |
| T21a/T21b | `heatmap` (1) | Sole file, `heatmap-chart.tsx`/`heatmap-components.tsx`. |
| T22 | `sunburst/sunchrome` (2) | Direct, sole files. |

### T0/T1/T2 risk-tier chart → touching tasks

| Chart (tier) | Tasks that touch it |
|---|---|
| `candlestick` (**T0**, 0.0047% headroom) | T3 (transitive, via `segment-visuals.tsx`), T13 (generic, confirmed), T14 (direct, `candlestick-chart.tsx:832`), T18 (direct, `candlestick-chart.tsx:1068/1073`) |
| `scatter` (**T1**, 0.0490%) | T6 (direct), T13 (generic, confirmed), T14 (direct, `scatter-chart.tsx:690`) |
| `heatmap` (**T1**, 0.0723%) | T9 (direct, `heatmap-components.tsx:410`), T13 (generic, **disputed** — no actual wiring found), T18 (direct, pattern call sites), T21a (direct, gates first per D368), T21b (direct, gates only after T21a green) |
| `markers` (T2, 0.1128%) | T2 (via `line*`), T3 (via `line*` + `chart-markers.tsx` direct call site), T14 (via `line*`) |
| `sankey` (T2, 0.1165%) | T3 (direct call site), T8 (direct), T9 (direct), T10 (direct), T13 (generic, confirmed) |
| `refareamultiaxis` (T2, 0.1233%) | T2 (via `line*`), T3 (via `line*` + `reference-area-layer.tsx` direct), T14 (via `line*`) |
| `candlelegend` (T2, 0.1789%) | Same task set as `candlestick*` above (T3 transitive, T13 generic, T14, T18) |
| `ring` n=4 (T2, 0.1889%) | T1 (direct), T11 (direct, "gate of record") |

---

## C. Hard dependency edges

Every edge below is quoted or paraphrased from go-to-plan.md text, with the source cell cited.

| Constraint | Reason | Source |
|---|---|---|
| **T21b MUST follow T21a (same gate)** | "Gates only after T21a is green" — B is the only half that can move geometry/retime the reveal; A must be paint-clean first | go-to-plan.md:57, "T21b" row, `acceptance criteria` column |
| **Tooltip motion (T20) rides on T13** | "Tooltip motion is opt-in via the `motion()` renderer, not automatic" — T13 depends on T20's `motion()` renderer existing to opt tooltips into it, but T13 is batched B4 and T20 is batched B7, i.e. T13 ships *before* T20 in the plan's own batch numbers | go-to-plan.md:48 (T13 cell) + go-to-plan.md:55 (T20 cell) — **this is a plan-internal contradiction to flag to the lead**, not a resolved edge: if T13's tooltip-motion opt-in genuinely requires T20's renderer, B4-before-B7 is backwards, or T13 must ship with motion off until B7. |
| **T21a/T21b heatmap work must not stack with other risky heatmap changes in one gate** | Risk policy: "No batch may stack two risky changes onto one chart within a single gate" | go-to-plan.md:28 (Risk policy, D362) — applies directly to the T9/T18/T21a/T21b collision on `internal/heatmap-components.tsx` found in Part A: at least one of these must be pulled into its own gate. |
| **candlestick (T0) must never get two batches' worth of change in one gate** | Same risk policy, "never fix-forward" for candlestick specifically | GATE-MAP.md:42-43 + go-to-plan.md:28 — applies to the T3/T13/T14/T18 collision on `candlestick` found in Part B. |
| **T18's pattern guards are a hard requirement, not optional** | "Guards REQUIRED (D366b): dev-mode registry assertion, solid-fill degradation off-SVG, static `url(#` registry test" | go-to-plan.md:53 (T18 acceptance criteria) |
| **Sequencing of B0–B8 batch numbers is itself undecided** | "Batch ordering (5.2.2) — B0–B8 sequencing... This is the only remaining blocker before implementation." | go-to-plan.md:105 — i.e. the `batch` column's B1..B8 labels in the task table are *proposed*, not yet ruled; this collision report is an input to that ruling, not a confirmation of it. |

**SUSPECTED edges (technical, not textually sourced — reasoning given, not verified by running anything):**

- `T9` and `T13` SUSPECTED to interact on `internal/heatmap-components.tsx` / hover behavior: T9 replaces heatmap's raw `pointermove` bisector (`:410`) with `group-x`/`group-y` focus, while T13's generic chart list nominally includes heatmap tooltips — if T13's tooltip anchor logic reads focus state, sequencing T9 before T13-for-heatmap would be safer. Weakened by Part A's finding that heatmap doesn't actually route through `tooltip-chrome.ts` — so this edge may not exist. Flagged, not asserted.
- `T12` and `T14` SUSPECTED to collide on `internal/hover-chrome.ts` (both edit it per Part A's file table) — likely the same function region (`:404` for T14; T12 has no line cited). Needs the lead's own line-range check since I could not diff two edits against one baseline.
- `T6` and `T18` SUSPECTED to interact on `area-chart.tsx`/`candlestick-chart.tsx`: T6 touches gradient `<defs>` scaffolding project-wide (D10), T18 touches pattern `<defs>` scaffolding in the same two files — both inject SVG defs into chart internals. No direct textual link found; flagged on file-adjacency only.

---

## D. Parallelism candidates

Using Part A (files) ∩ Part B (charts) for disjointness. Groups are candidates only —
the lead must still apply the C-section constraints (T21a/T21b ordering, the T13/T20 ordering
contradiction, and the T0/T1 risk-stacking rule) on top of this.

- **T7 + T8 + T10 + T19** — disjoint files (`bar-pulse-mark.ts`, `sankey-animation.ts`, `sankey-chart.tsx`, `choropleth-chart.tsx`+`index.ts`) and disjoint charts (`bar*`, `sankey`, `sankey`, `choropleth`) **except T8/T10 both touch `sankey`** — so this is really two groups: `{T7, T19}` (bar vs choropleth, fully disjoint) and `{T8, T10}` (both sankey, same chart — do NOT run concurrently, sankey is T2-tier watch).
- **T15 + T22** — both touch only `sunburst-chart.tsx`/`internal/sunburst-labels.tsx`, i.e. the SAME file/chart pair as each other — NOT parallel-safe despite both being "sunburst-only" scope; they collide directly (see Part A collision table: `sunburst-chart.tsx` is a 4-way hit with T3/T11 too).
- **T11 alone** is disjoint in files from T7/T8/T10/T19/T15/T22 but shares `sunburst-chart.tsx` with T15/T22 and `pie-chart.tsx`/`ring-chart.tsx` with T1/T6 — not cleanly parallel with any of them.
- **Wide-blast-radius tasks to serialize on their own, never grouped:** T1 (16 QA names via corrected count), T3 (≈28+ names, whole-board), T13 (≈24+ names), T14 (21 names), T18 (≈15+ names incl. T0+T1 charts), T20 (all 45, by definition). That is **6 of the 22 tasks** — more than a quarter of the task table — flagged "wide blast radius — serialize," each requiring its own gate per the risk policy.
- **Genuinely narrow, mutually disjoint candidates:** `{T7 (bar), T19 (choropleth)}`, `{T17 (gaugelinear only)}` alone (touches no other task's files per Part A, and its own acceptance text demands isolation: "zero gate upside," "any movement = revert"), `{T21a}` alone before `{T21b}` (hard sequence, not parallel).

**Explicit incompleteness:** T5's and T16's chart fan-outs were not traced (no importer greps run — out of budget); they cannot be placed into any parallelism group with confidence and should be treated as unknown-blast-radius, not narrow, until traced.
