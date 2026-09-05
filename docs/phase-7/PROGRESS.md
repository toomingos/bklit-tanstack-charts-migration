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
| V0.3 | re-baseline at new HEAD, tree hash, `bundle-sizes.json` | merged | `019215c` | D518 · run `2026-09-05T11-24-30-421Z` @ `61d6179`, tree `69b9ef07` · `docs/phase-7/gate/BASELINE.md` · bundle pins re-pinned (41 up, 2 down) · G2 open for V4.4 |
| V0.4 | housekeeping (`__tm`, 9 orphans, nested `defineChart`) | merged | `ad584cd` | D513 · executor `ses_f8ec060e3ffea8L3Q3VTYvzpO3` (resumed once for the cascade) · orphans 18 → 0 · G1 folded |
| V0.5 | file I1, I2, I4, I5, I6, F-260 comment; numbers in `07` | merged | `437af3a` | D511 · #126 #127 #128 #129 #130 #131 · code links land with the owning items |
| V0.6 | idiom checklist below matches `08` §3 | merged | `075e331` | checked 2026-09-05: 12 idioms, 16 family rows, wording matches §3 |
| — | `10-parity-contract.md` reviewed by lead | merged | `075e331` | reviewed 2026-09-05 (V0.1 session): 292 value + 211 type exports, 3 exceptions, 23 tests (D508) |

## Waves 1–4 — 7.1 Host and package, 7.2 Native definition, 7.3 Evidence

| Wave | Item | Title | State | Session | Commit | D-entries |
|---|---|---|---|---|---|---|
| 1 | V1.1 | host module + legacy hooks | merged | `ses_f8eaea0aeffephB8JH5HsfyVlr` | `341f0e6` | D520 · fixture renders `<svg`, 12 `Eq<>` · library-cannot: `ResolvedScale` carries no scale (0.16.0) · resumed once |
| 1 | V1.2 | scales and bounds from the store | in progress (G6) | `ses_f8e278ecaffe1v21g6xwaZOzjf` (first: `ses_f8e5d909effe6PGyPKJO5rnNpP`) | | D521 · classification 13 FACTORY / 7 STORE / 26 LOCAL / 2 rulings · heatmap sites handed to V3.3 · sankey/choropleth/radar margins deferred behind V2.1 |
| 1 | V1.6 | export parity | merged | `ses_f8e5d9e25ffeJtbjO7zCE0Xdv3` | `171e3c7` | D523 · red lines 478 → 384 (re-read at V3.7, must be 0) · 84 leaked internals un-exported · `internal/parity/` 10 modules · kept: `BrushLayout`, `ChartSelectionContext` (demos) |
| 1 | V1.8 | aria forwarding | merged | `ses_f8eae9829ffegZk4H0yURVPpUM` | `e50babd` | D516 · `ariaLabel="` literals 16 → 0 · funnel props only until V3.1 (R2) · heatmap via context |
| 1 | V1.9 | package contract | merged | `ses_f8eae8f80ffemH1q37JpHnKBRr` | `e29b694` | D517 · pack 450 files, fresh Next app builds + renders · +10 deps declared, removals owned by later items · G4 |
| 1 | V4.1 | `qa/unit` scaffold (scene tests, probes) | merged | `ses_f8eae88aeffeCW2EwgcvXZY2hd` | `0c25747` | D515 D525 D529 · `pnpm test` 105 tests / 86 pass / 0 fail / 19 todo / 1.1 s · probes pinned per family · ssr, hoc, throw, states fixtures wired (lead) |
| 1 | V4.2 | generated type fixture | merged | `ses_f8eae74d6ffevmKWqC0OMWAzCO` | `04ad318` | D514 · 292 value + 211 type `Eq` lines · 478 red / 420 exports = V1.6 backlog · 81 migrated-only exports · G3 folded |
| 1 | V4.4 | gate integrity | merged | `ses_f8e7dd459ffeYm5llQgxkw0yTz` | `1ae5f10` | D519 · tree-hash + refusal · checks order tsc→lint(floor 7)→bench tsc→build→unit→census→bundle · 11 rulings in `qa/gate/rulings.json` (baseline: gate FAIL 0 / ruled 6) · ledger re-keyed, guard 17 → 0 |
| 2 | V1.3 | registering children | merged | `ses_f8e2786caffe0MKE485qxGYfHD` | `dec759f` | D527 · registry provider in `ChartHost` · `roleOf` unwraps memo/forwardRef (R5) · hoc fixture exit 0 · plain-wrapper end-to-end waits for G6 (entries render `{children}` in the host) |
| 2 | V1.4 | optional layers own imports | todo | | | |
| 2 | V1.5 | `cursorHost`, x-domain padding | todo | | | |
| 2 | V1.7 | host-owned sizing and SSR | merged | `ses_f8e4ede21ffelVsLjas4cNJSPd` | `0012eca` | D521 D524 · 18 `initialWidth` mounts · SSR svg 16/16 · `use-container-size` only in funnel (V3.1) · heatmap local observer until V3.3 · 10 probe pins moved |
| 2 | V2.1 | `withStates` on polar/geo | merged | `ses_f8e277e8fffeFjKx9XQ1oKJ1yO` | `eaf8174` | D528 · `withStates` on pie/radar/sunburst polar containers + choropleth `geoShape` · states fixture exit 0 · 3 D424 drops restored · sankey states = library-cannot at 0.16.0 → V3.2 · reactive dims stay until V2.2 deletes them |
| 2 | V3.3 | heatmap on band scales | merged | `ses_f8e27770effe1nrPt7XO6YzT69` | `76a0fb1` | D526 · 39 → 13 modules · `.range(`/portal/observer in heatmap = 0 · QA 4/4 PASS (+≈500 px vs baseline) · band instances, not factories (ruling) |
| 2 | V4.3 | curve parity in Node | merged | `ses_f8e4ea68affeIAxEMFrhK6abJf` | `3917d3d` | D522 · 10 curves, 9 PASS ≤ 0.02, line-pulse = exception 1 · `pnpm curve-parity` · k4 probe → smoke |
| 3 | V2.2 | package pointer and focus — pie · ring · sunburst · gauge · radar · composed (one row per family when dispatched) | todo | | | G7 closed (D531); polar row dispatched below; composed waits for V1.2 |
| 3 | V2.2 choropleth | package pointer on `geoShape`, delete `choropleth-hover-chrome.ts` | dispatched | `ses_f8df31363ffemCraJgg3s2V47c` | | |
| 3 | V2.2 sankey | package pointer on sankey marks, delete listener `:645` | dispatched | `ses_f8df309c7ffey1M4upskkD33FU` | | no `states` on sankey (D528) |
| 3 | V2.2 heatmap (+V2.3) | package pointer on cells, legend → controlled focus | dispatched | `ses_f8df3022fffem7UGkplAShFIJN` | | |
| 3 | V2.3 | legend → controlled focus / selection | todo | | | |
| 3 | V2.4 | decorative tooltip springs | todo | | | |
| 3 | V2.5 | `spatialIndex`, D472 decision | todo | | | |
| 3 | V2.6 | crosshair + package tooltip | todo | | | |
| 3 | V3.2 | package layouts (geo, sankey, sunburst) | todo | | | |
| 3 | V3.4 | declared resources + R10 seam | todo | | | |
| 3 | V3.7 | config parity | todo | | | |
| 3 | V4.6 | 23 legacy tests ported | merged | `ses_f8df2fa43ffe2dgjjTlywgbbxC` | `5cabf0b` | D530 · 23 files, imports only · 38 pass / 87 named todos (V3.7 backlog) / 1 signature gap (`buildHorizontalTangentBezierPath`, V3.7) · `pnpm test` 230 / 123 / 0 / 107 |
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
| G2 | V0.3 gate (lead) | `gate:checks` census fails: 17 reach-in ledger failures (15 internal modules not in ledger, radar 20>19, sunburst 8>7); total 67 sites ≤ phase-6's 79; ledger predates the module split in `f5928ab` (guard already failing at `325a065`, before 7.0) | V4 (gate integrity) | FOLD into V4.4 (re-key ledger to split modules, pins = today's counts, total ≤ 79) — done, guard 0 failures | D512 (V0.3), D519 |
| G3 | V4.2 executor (`ses_f8eae74d6ffevmKWqC0OMWAzCO`) | `cd bench/app && npx tsc --noEmit` had 22 pre-existing errors (`toSorted` needs lib ES2023; implicit-any comparators in 5 migrated internals) invisible to the gate because `gate:checks` only runs `vite build` | V4 (gate integrity) | FOLD: lib `ES2022` → `ES2023` in `bench/app/tsconfig.json` by the lead in the V4.2 commit (bench tsc 0); V4.4 adds bench tsc to `gate:checks` — done | D514, D519 |

| G5 | V1.2 executor (`ses_f8e5d909effe6PGyPKJO5rnNpP`) | No entry mounts `ChartHost` (V1.1 built the host, nothing uses it), so the 26 LOCAL `.range(` sites have no store above them; mounting is V1.7's owned work | V1 (one chart host) | FOLD: reorder V1.7 before V1.2 (D521 rulings a–d), V1.2 re-dispatched after V1.7 merges | D521 |
| G6 | V1.2 executor (`ses_f8e278ecaffe1v21g6xwaZOzjf`) | Cartesian entries (area, line, bar, composed, candlestick, live-line) mount `<ChartHost>` with no children: overlays (`brushChromeNode`, `DashTailOverlay`, `ProjectionMarkerOverlay`, reference-area layers) render as siblings, so no `useChartStable()` provider sits above the 20 remaining LOCAL `.range(` sites; the host store is invisible to them | V1 (one chart host) | FOLD into V1.2: after V1.3 merges, resume the session with ownership of the six entry mount blocks; overlays become `ChartHost` children reading `useChartStable()`, entries render `{children}` inside the host and merge `extractChildren(children, useChartChildEntries())` (V1.3's plain-wrapper path, D527); 4 dead-code edits already on disk (`y-domain.ts` `useYScale`, `area-chart-definition.ts:467`, `use-bar-definition.ts:217` guards, `bar-trimmed-mark.ts` D521b label) | D521 |
| G7 | lead (V2.1 verification) | gauge/1000 and gaugelinear/1000 QA cells read 16742 / 14143 px (1.74 % / 1.47 %, every scenario, gate 4800) on HEAD `dec759f` and on a clean-HEAD worktree; they PASS at `171e3c7`, so V1.7's host-owned sizing of `gauge.tsx` (`0012eca`, 42+/28−) draws the migrated arc larger and lower than legacy (centre ≈ (590,275) vs (550,240) at 1200×800); baseline `qa/gate/latest` predates V1.7 and did not catch it | V1 (one chart host: host sizing must reproduce legacy geometry) | FOLD into V1.7 follow-up: one executor on `gauge.tsx` + gauge internals (`ses_f8df59e99ffe4FxjDa0GPJD75e`), done when gauge/gaugelinear cells read within the baseline range | D528 · closed: fluid wrapper width, gauge 206 px / gaugelinear 0 px, D531 |
| G4 | V1.9 executor (`ses_f8eae8f80ffemH1q37JpHnKBRr`) + lead | `showcase/package.json` cannot drop `@tanstack/charts`/`@tanstack/react-charts` yet: the showcase resolves `@showcase/migrated-charts` to `migrated/charts/index.ts` through tsconfig `paths` (source, not an installed package), `showcase/migrated` is no workspace member, and `qa/unit/lib/render.mjs` + `next.config.mjs` read `showcase/node_modules/@tanstack/charts`; a fresh `pnpm install` after the drop would lose the package | V5 (package shape) | FOLD into V5.3: make `showcase/migrated` a workspace package consumed as `@showcase/migrated-src` (showcase, qa/unit, next.config point at it), then drop the deps from the showcase root | D517 |

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
