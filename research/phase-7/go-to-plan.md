# Phase 7 — Go-to-plan

Source of truth from 7.1 onward. Items, efforts and "done when" gates are those of
`08-synthesis.md` §4 and are not repeated; this file adds what an executor needs to start an
item without reading `08`: the files it owns, what it deletes, what it must not touch, and the
order. Plan: `PLAN-phase-7.md`. Parity target: `10-parity-contract.md`.

## 1. Family × vector matrix

Families are the 16 chart entry files in `showcase/migrated/charts/` (loading files are part
of their family). Cell = the items that touch that family; `·` = untouched by that vector.

| Family | V1 host | V2 pointer | V3 surface | Notes |
|---|---|---|---|---|
| area (+ area-chart-loading) | V1.2 V1.4 V1.7 V1.8 | V2.4 V2.5 V2.6 | V3.4 V3.5 V3.6 V3.7 V3.9 | hand ids `area-chart.tsx:976,1181,1205`; `undefined` on width `:1146` |
| bar (+ bar-chart-loading) | V1.2 V1.7 V1.8 | V2.5 V2.6 (band crosshair) | V3.4 V3.5 V3.7 V3.9 | nested `defineChart` `:1825,1914` (V0.4); depth entries; squares |
| candlestick | V1.2 V1.7 | V2.4 V2.5 | V3.4 (`RadialGradient` → seam) V3.5 V3.7 | tween parity V4.3 |
| choropleth | V1.2 (margin `:165`) V1.7 | V2.1 V2.2 (`choropleth-hover-chrome.ts`) | V3.2 (`geoShape` + `d3-zoom`) V3.4 (pattern → seam) V3.5 | `undefined` on width `:616` |
| composed | V1.2 V1.7 | V2.2 (listener `:1102`) V2.5 V2.6 | V3.5 V3.7 | |
| funnel | V1.7 | · | V3.1 V3.4 (hand ids `:299-304`) V3.5 | no `defineChart` today; R2 |
| gauge | V1.7 | V2.1 V2.2 (`focusDisabled` `:1028,1518`) | V3.4 (`RadialGradient`) V3.5 | `undefined` on width `:1336` |
| heatmap | V1.2 (`heatmap-cells-hooks.tsx:119`) V1.7 | V2.2 (`heatmap-focus-bridge.ts:143`) V2.6 | V3.3 V3.5 V3.7 (`colorGradientLegend`) | 30+ modules → ~12 |
| line | V1.2 V1.4 V1.7 V1.8 | V2.4 V2.5 V2.6 | V3.4 V3.5 V3.6 V3.7 V3.9 | `Infinity` `:778` |
| live-line | V1.2 (margin `:69`) V1.7 | · | V3.4 (edge fade as gradient stroke) V3.5 | rolling path motion |
| pie | V1.7 | V2.1 V2.2 (`polar-hit.ts`, `pie-hover-chrome.ts`) V2.3 | V3.4 (`RadialGradient`) V3.5 | `focusGroupAngle` |
| radar | V1.2 (margin `:44`) V1.7 | V2.1 V2.2 (`focusDisabled` `:368`, listeners `:681-706`) | V3.5 | D424 drops restored |
| ring | V1.7 | V2.1 V2.2 | V3.5 | |
| sankey | V1.2 (margin `:72`) V1.7 | V2.1 V2.2 (listener `:645`) | V3.2 (`sankeyDiagram`) V3.4 (link gradients, patterns → seam) V3.5 V3.7 | `d3-sankey` imports → 0 |
| scatter | V1.7 | V2.5 | V3.5 V3.7 (`onPhaseChange`) | |
| sunburst | V1.7 | V2.1 V2.2 (`sunburst-hit.tsx`, click via `onSelect`) | V3.2 (package `sunburst()` only) V3.4 (`RadialGradient`) V3.5 | delete `sunburst-geometry.ts`; tab stop `sunburst-center-overlay.tsx:68` (V4.1) |

Cross-family items (no family column): V1.1, V1.3, V1.5, V1.6, V1.9, V3.6, V3.8, all of V4, V5.

## 2. Deletion list

Every item that replaces something names what it deletes. The executor's commit must contain
these deletions or the item is not done.

| Item | Deletes |
|---|---|
| V0.4 | `internal/__tm`; 9 orphan modules (orphan script output); the inner `defineChart` at `bar-chart.tsx:1825,1914` |
| V1.2 | 22 local `.range(` sites; margin constants in `brush-chrome.tsx`, `dash-tail.ts`, `terminal-marker.tsx`, `heatmap-cells-hooks.tsx`; hand margins in sankey, live-line, choropleth, radar where parity allows |
| V1.4 | static brush/pattern/marker/projection/profit-loss imports in `area-chart.tsx`, `line-chart.tsx` |
| V1.6 | the 36 leaked internal modules from the barrel (`09` §3) |
| V1.7 | `use-container-size` from chart mounting (13 files); the four `undefined`-on-width returns |
| V2.2 | `polar-hit.ts`, `pie-hover-chrome.ts`, `sunburst-hit.tsx`, painted hit overlay; `focusDisabled` on radar/gauge; listeners at `radar-chart.tsx:681-706`, `sankey-chart.tsx:645`, `composed-chart.tsx:1102`, `heatmap-focus-bridge.ts:143`, `choropleth-hover-chrome.ts:21-35`; `styles.css:193` |
| V2.4 | every non-aria `setAttribute` in tooltip indicator code |
| V2.5 | `POSITIVE_INFINITY` in focus options; the D472 gate (conditional on the bench) |
| V2.6 | `hover-geometry.ts`, `native-tooltip.tsx`, the HTML date pill (`date-pill-overlay.ts`) |
| V3.1 | `funnel-hover-chrome`, funnel WAAPI keyframes, funnel branch of `enter-transition` |
| V3.2 | `sunburst-geometry.ts`; `d3-sankey` imports; every `createElementNS` |
| V3.3 | heatmap arithmetic scale closures; the two portal axes |
| V3.4 | the 12 hidden `<svg><defs>` islands; hand gradient/pattern ids |
| V3.5 | `deferred-reveal.ts`, `enter-transition.ts`, `chartRendererFor`/`useChartRenderer` in `motion-renderer.ts`, `ts-chart__marks--revealing` rules, wipe/sweep `@keyframes`; `NATIVE_MOTION_MAX_POINTS` after V2.5 |
| V3.6 | pre-hide `opacity: 0`, non-pulse `animation`, transform rules on package nodes in `styles.css` |
| V3.9 | hand `<rect|<path` in loading modules; CSS sweep on placeholders |
| V4.2 | the 15 hand-written fixtures that import only our barrel |
| V5.3 | 32 `*-child.ts` carriers (merged to one table) |

Helpers whose removal is the V5 bundle story: `internal/{motion-renderer, enter-transition,
deferred-reveal, hover-geometry, native-tooltip}` ≈ 923 lines.

## 3. Ownership and collisions

All work happens on `main` in the one checkout; there are no worktrees (D509). Rule: within a
batch, no two running items edit the same file. Where they would, the table says who owns it
and who waits. Executors edit only the files their prompt names and never commit; the lead
commits one item at a time.

| Contested file(s) | Owner | Others |
|---|---|---|
| host module (new, `internal/chart-host.tsx`) | V1.1 | everyone imports, nobody edits until V1.1 is merged |
| `index.ts` (barrel) | V1.6 in wave 1, then V3.7 in wave 3 | V1.3/V1.4 add exports through V1.6's list, not by editing the barrel |
| `package.json` (migrated) | V1.9 | V0.2 pins first; nobody else |
| `area-chart.tsx`, `line-chart.tsx` | wave 2: V1.4; wave 3: V2.6; wave 4: V3.5 then V3.6 | V1.2 and V1.7 edit them in wave 2 as well: run V1.2 → V1.7 → V1.4 serially on these two files |
| `pie-chart.tsx`, `ring-chart.tsx`, `sunburst-chart.tsx`, `gauge.tsx`, `radar-chart.tsx` | wave 2: V2.1; wave 3: V2.2+V2.3 per family | V3.2 (sunburst) and V3.4 (radial gradients) wait for V2.2 on that family |
| `styles.css` | V3.6 only | V2.2 removes one line (`:193`) in wave 3 before V3.6 starts; V3.9 adds the pulse through V3.6's pass |
| `internal/resource-host.tsx` (new) | V3.4 | V3.9 sweep and V3.7 `RadialGradient` register into it after V3.4 merges |
| `motion-renderer.ts` | V3.5 | V2.5 removes `NATIVE_MOTION_MAX_POINTS` only if it lands after V3.5; otherwise V3.5 does |
| heatmap modules | V3.3 (wave 2) | V2.2 heatmap bridge and V2.6 axes wait for V3.3 |
| `qa/gate/*`, `qa/unit/*`, `qa/api-compat/*` | V4.x | never touched by V1–V3 items |

Protected, never edited: `bench/run.mjs`, `bench/report.mjs`, `qa/screenshot.mjs`, `repos/`.

## 4. Waves and dispatch

A wave is a dispatch batch on one tree. Items in one row run in parallel only because they
own disjoint files (§3); "serial constraints" are the exceptions inside the wave.

| Wave | Items (parallel) | Blocked on | Serial constraints inside the wave |
|---|---|---|---|
| 0 | V0.1 → V0.6 | — | lead, serial |
| 1 | V1.1+V1.2 · V1.6 · V1.8 · V1.9 · V4.1 scaffold · V4.2 · V4.4 | wave 0 | V1.1 commits first; V1.2 waits for it |
| 2 | V1.3 · V1.4 · V1.5 · V1.7 · V2.1 · V3.3 · V4.3 | V1.1 | on area/line: V1.2 → V1.7 → V1.4 |
| 3 | V2.2+V2.3 (per family) · V2.4 · V2.5 · V2.6 · V3.2 · V3.4 · V3.7 · V4.6 | V1.3, V1.4, V1.7, V2.1 | V2.2 family before V3.2/V3.4 on that family; V3.3 before V2.6 heatmap |
| 4 | V3.1 · V3.5 · V3.6 · V3.8 · V3.9 | V2.5, V3.4 | V3.5 → V3.6 → V3.9 on `styles.css`; V3.8 last |
| 5 | V5.1 → V5.4 | goals 1–2 green (`08` §6) | 7.4 refactor before V5.3 |

Dispatch template (one per item, `run_in_background: true`, all independent items of a wave in
one message). Fill every `<…>` from this file and `08` §4; do not paraphrase the "done when":

```bash
bash .agents/skills/opencode-subagents/run.sh --agent executor "V<item> <short title>" <<'EOF'
Item V<item> from research/phase-7/go-to-plan.md: <one-line title from 08 §4>.
Files you own: <list>. Files you must not edit: <list from §3>. Do not add dependencies.
Delete: <row from §2>.
Done when: <"done when" cell from research/phase-7/08-synthesis.md §4, verbatim>.
Verify: run the command(s) that prove the "done when" count, then from `showcase/`:
`npx tsc --noEmit` and `npx oxlint --type-aware migrated packages/migrated-charts`; paste their
output. Do not commit.
If a step needs a file you do not own, a new dependency, or a decision, stop and report.
Final message: what changed, where, how verified, or what blocked you.
EOF
```

Read-only work (batch-end count audits, 7.4 inventories, inventories for V1.6/V4.2) uses
`--agent audit` with the same shape minus the edit lines.

## 5. Lead checklist per item

1. Read the executor's final message and the full diff; every touched file must be in its list.
2. Re-run the item's "done when" count yourself; from `showcase/`: `npx tsc --noEmit` and
   `npx oxlint --type-aware migrated packages/migrated-charts` (the `gate:checks` commands);
   `pnpm test` from V4.1.
3. Deletions from §2 present in the diff.
4. Any new "library cannot" claim gets a D-entry with a version stamp (D417).
5. Commit `phase-7(V<item>): <summary>`, D-entries in the body.
6. Tick `docs/phase-7/PROGRESS.md` (state, session id, D-entries); idiom rows for the families touched.
7. Anything discovered that is not the item: a `G<n>` row in PROGRESS with vector and
   disposition (PLAN "Discovered work"), never silent code.
