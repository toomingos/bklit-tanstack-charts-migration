# Phase 7 — Progress

Plan: `PLAN-phase-7.md`. Items: `research/phase-7/go-to-plan.md` (files, deletes, waves) and
`research/phase-7/08-synthesis.md` §4 ("done when"). One tree, lead commits (D509).

State: `todo` → `dispatched` (session id filled) → `review` → `merged` (commit hash) · `blocked (G<n>)`.
Tick a row only after the lead re-ran its "done when" count and committed.

## Wave 0 — 7.0 Freeze (lead, serial)

| Item | Title | State | Commit | D-entries |
|---|---|---|---|---|
| V0.1 | commit open diff, merge `chore/oxlint-migrated-charts` | merged | `6c5bc53` | — |
| V0.2 | pin 0.16.0, fix R1 breaking surface (15 definitions) | merged | `0bcf471` | D510 · executors `ses_f8ed0fe71ffeZPR00ZjS98CmRI` (migrated), `ses_f8ed0d417ffeeTMDv0dnyJ32LO` (bench) |
| V0.3 | re-baseline at new HEAD, tree hash, `bundle-sizes.json` | todo | | |
| V0.4 | housekeeping (`__tm`, 9 orphans, nested `defineChart`) | merged | `ad584cd` | D513 · executor `ses_f8ec060e3ffea8L3Q3VTYvzpO3` (resumed once for the cascade) · orphans 18 → 0 · G1 folded |
| V0.5 | file I1, I2, I4, I5, I6, F-260 comment; numbers in `07` | merged | `437af3a` | D511 · #126 #127 #128 #129 #130 #131 · code links land with the owning items |
| V0.6 | idiom checklist below matches `08` §3 | merged | `075e331` | checked 2026-09-05: 12 idioms, 16 family rows, wording matches §3 |
| — | `10-parity-contract.md` reviewed by lead | merged | `075e331` | reviewed 2026-09-05 (V0.1 session): 292 value + 211 type exports, 3 exceptions, 23 tests (D508) |

## Waves 1–4 — 7.1 Host and package, 7.2 Native definition, 7.3 Evidence

| Wave | Item | Title | State | Session | Commit | D-entries |
|---|---|---|---|---|---|---|
| 1 | V1.1 | host module + legacy hooks | todo | | | |
| 1 | V1.2 | scales and bounds from the store | todo | | | |
| 1 | V1.6 | export parity | todo | | | |
| 1 | V1.8 | aria forwarding | todo | | | |
| 1 | V1.9 | package contract | todo | | | |
| 1 | V4.1 | `qa/unit` scaffold (scene tests, probes) | todo | | | |
| 1 | V4.2 | generated type fixture | merged | `ses_f8eae74d6ffevmKWqC0OMWAzCO` | (next commit) | D514 · 292 value + 211 type `Eq` lines · 478 red / 420 exports = V1.6 backlog · 81 migrated-only exports · G3 folded |
| 1 | V4.4 | gate integrity | todo | | | |
| 2 | V1.3 | registering children | todo | | | |
| 2 | V1.4 | optional layers own imports | todo | | | |
| 2 | V1.5 | `cursorHost`, x-domain padding | todo | | | |
| 2 | V1.7 | host-owned sizing and SSR | todo | | | |
| 2 | V2.1 | `withStates` on polar/geo | todo | | | |
| 2 | V3.3 | heatmap on band scales | todo | | | |
| 2 | V4.3 | curve parity in Node | todo | | | |
| 3 | V2.2 | package pointer and focus — pie · ring · sunburst · gauge · radar · composed · sankey · heatmap · choropleth (one row per family when dispatched) | todo | | | |
| 3 | V2.3 | legend → controlled focus / selection | todo | | | |
| 3 | V2.4 | decorative tooltip springs | todo | | | |
| 3 | V2.5 | `spatialIndex`, D472 decision | todo | | | |
| 3 | V2.6 | crosshair + package tooltip | todo | | | |
| 3 | V3.2 | package layouts (geo, sankey, sunburst) | todo | | | |
| 3 | V3.4 | declared resources + R10 seam | todo | | | |
| 3 | V3.7 | config parity | todo | | | |
| 3 | V4.6 | 23 legacy tests ported | todo | | | |
| 4 | V3.1 | funnel on marks (D364 reversal) | todo | | | |
| 4 | V3.5 | one animation owner | todo | | | |
| 4 | V3.6 | stylesheet audit, `data-slot` | todo | | | |
| 4 | V3.9 | skeleton as a chart | todo | | | |
| 4 | V3.8 | census and idiom rows (last) | todo | | | |

Batch-end audits (`--agent audit`, `08` §6 counts + idiom rows for touched families): after wave 1 ☐ · wave 2 ☐ · wave 3 ☐ · wave 4 ☐.

## 7.4 Refactor and 7.5 Gate

| Item | Title | State | Commit | D-entries |
|---|---|---|---|---|
| 7.4 | `research/phase-7/11-refactor.md` triage, one `refactor` commit | todo | | |
| 7.5 | QA matrix vs V0.3 baseline | todo | | |
| 7.5 | bench, no regression; V4.5 explained columns | todo | | |
| V5.1 | bundle column ≤ 1.10, CSS column | todo | | |
| V5.2 | bundle measured after V1.4/V3 | todo | | |
| V5.3 | `internal/` shape (after 7.4) | todo | | |
| V5.4 | lint 0, D472 threshold work if kept | todo | | |
| 7.5 | census 0, `08` §6 grep counts re-run from a fresh clone | todo | | |
| 7.5 | upstream re-check of I1–I6 and F-260 against the pin | todo | | |

## Discovered work

Every issue found mid-phase gets a row before any code (PLAN "Discovered work"). Disposition is
one of FOLD (into open item), NEW (item appended to go-to-plan), ACCEPT-WITH-LOG (D-entry, version
stamp), UPSTREAM (I-number in `07`). No vector = synthesis defect: amend `08` §9 first.

| G | Found by | Symptom | Vector | Disposition | Ref |
|---|---|---|---|---|---|
| G1 | V0.2b executor (`ses_f8ed0d417ffeeTMDv0dnyJ32LO`) | `bench/app/src/scenarios/migrated-choropleth.tsx:137` fails bench tsc: `CountryProperties` (`[key: string]: unknown`) not assignable to `ChoroplethFeatureProperties`; pre-existing, independent of 0.16.0; `npm run build` unaffected | V4 (gate integrity: bench app must typecheck) | FOLD into V0.4 housekeeping (typed bench data, no showcase edit) — done | D513 |
| G2 | V0.3 gate (lead) | `gate:checks` census fails: 17 reach-in ledger failures (15 internal modules not in ledger, radar 20>19, sunburst 8>7); total 67 sites ≤ phase-6's 79; ledger predates the module split in `f5928ab` (guard already failing at `325a065`, before 7.0) | V4 (gate integrity) | FOLD into V4.4 (re-key ledger to split modules, pins = today's counts, total ≤ 79) | D515 |
| G3 | V4.2 executor (`ses_f8eae74d6ffevmKWqC0OMWAzCO`) | `cd bench/app && npx tsc --noEmit` had 22 pre-existing errors (`toSorted` needs lib ES2023; implicit-any comparators in 5 migrated internals) invisible to the gate because `gate:checks` only runs `vite build` | V4 (gate integrity) | FOLD: lib `ES2022` → `ES2023` in `bench/app/tsconfig.json` by the lead in the V4.2 commit (bench tsc 0); V4.4 adds bench tsc to `gate:checks` | D514 |

## Idiom checklist (V0.6 / V3.8)

Twelve idioms per `08` §3. One row per family, ticked at V3.8. Not every idiom applies to every
family; write `n/a` where it does not.

| Family | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| area | | | | | | | | | | | | |
| bar | | | | | | | | | | | | |
| candlestick | | | | | | | | | | | | |
| choropleth | | | | | | | | | | | | |
| composed | | | | | | | | | | | | |
| funnel | | | | | | | | | | | | |
| gauge | | | | | | | | | | | | |
| heatmap | | | | | | | | | | | | |
| line | | | | | | | | | | | | |
| live-line | | | | | | | | | | | | |
| pie | | | | | | | | | | | | |
| radar | | | | | | | | | | | | |
| ring | | | | | | | | | | | | |
| sankey | | | | | | | | | | | | |
| scatter | | | | | | | | | | | | |
| sunburst | | | | | | | | | | | | |

Idioms: 1 `svgAnimation:false` + `motion()` · 2 `states` with `when:{focus}` and `transition` · 3 `decorative()` chrome · 4 `radialText` centre · 5 second decorative polar layer / `crosshair` band · 6 funnel as `areaX` + `text` · 7 sparkline silence · 8 HTML legend buttons with `aria-pressed` · 9 preview via `initialWidth` + `aspectRatio` · 10 `idPrefix` per instance · 11 `tooltip.content(points)` · 12 `--ts-chart-tooltip-*` + `theme.palette`.
