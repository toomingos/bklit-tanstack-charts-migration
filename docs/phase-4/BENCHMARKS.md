# Phase 4 Benchmarks

> Placeholder created at 4.1.1. Baseline captured at 4.4.1 (BEFORE any phase-4 change); per-batch gate comparisons at 4.4.3; final pass at 4.4.5. Gates per `research/phase-1/05-qa-and-benchmark-gates.md` (frozen).

## 4.4.1 Baseline (pre-change)

Captured 2026-08-22, lanes B1–B3 per **D246** (baseline split: B1 typecheck/build, B2 24-part visual refs, B3 console sweep — all pre-T-02b-close; B4 = exclusive `bench --all` + sankey refs, after T-02b). Only sankey code is changing under T-02b, so these captures are valid pre-change baselines for the other 24 parts.

- **HEAD**: `7d60a7f246fa8c1bbb47fd2092863a5c9cdfcf1f` — `7d60a7f` *fix(charts): adapt to TanStack v0.14.0 API + pin build-time clone (D238)*. Tracked tree clean at capture start; untracked `PLAN-phase-4.md`, `docs/phase-4/`, `research/phase-4/`, `scripts/sankey-geometry-probe.mjs` are expected phase-4 planning artifacts. Concurrent T-02b (P0.1b sankey fix) may hold working-tree changes during this capture — confined to sankey files per the guard fence; they do not taint the 24 non-sankey parts below.
- bench/app run id: **`bench/results/2026-08-22T15-46-19-823Z`** (B4 exclusive rerun, post-T-02b, `BENCH_PORT=5302`; 24/24 cells — line/area/bar/scatter × bklit/tanstack × n=100/1000/10000 — **0 skipped**). Diagnostic run `2026-08-22T13-14-51-974Z` is superseded: all 12 tanstack cells skipped there on the v0.14 `tooltip: true` scenario crash (`'create' in true` in `resolveTooltipInput`), fixed by passing the `@tanstack/charts/tooltip` extension in the 10 tanstack bench scenarios (see `notes-b4-bench.md` B4b). Headline medians (ms, M1a mount→paint / M1b settle / M3a update):

| chart | n | bklit M1a/M1b/M3a | tanstack M1a/M1b/M3a |
|---|---|---|---|
| line | 100 | 64.7 / 1156.5 / 31.9 | 24.1 / 33.6 / 32.2 |
| line | 1000 | 53.7 / 1154.3 / 32.1 | 47.0 / 66.3 / 32.5 |
| line | 10000 | 65.2 / 1170.7 / 31.9 | 259.8 / 412.5 / 73.8 |
| area | 100 | 66.2 / 1148.5 / 32.0 | 25.1 / 32.8 / 32.1 |
| area | 1000 | 61.9 / 1160.9 / 30.4 | 52.8 / 83.1 / 32.5 |
| area | 10000 | 62.9 / 1166.9 / 29.7 | 305.6 / 461.8 / 124.5 |
| bar | 100 | 71.4 / 1599.3 / 32.4 | 33.6 / 52.7 / 32.6 |
| bar | 1000 | 261.9 / 1997.1 / 32.6 | 126.1 / 193.6 / 47.4 |
| bar | 10000 | 2195.1 / 7120.9 / 156.5 | 1052.0 / 1607.6 / 496.3 |
| scatter | 100 | 56.8 / 1155.5 / 32.4 | 28.8 / 42.7 / 32.4 |
| scatter | 1000 | 119.1 / 1264.4 / 32.6 | 91.6 / 138.7 / 34.3 |
| scatter | 10000 | 879.0 / 3140.5 / 70.8 | 728.6 / 1139.8 / 222.1 |

Notes: bklit M1b ~1.1s reveal floor preserved (intentional, per M1b parity precedent); tanstack M1b sub-second (no reveal by design). Both impls degrade together on bar n=10000 (known degenerate class). `tooltipAppeared=true` on all tanstack cells; sole anomaly `bklit/line n=1000` tooltipAppeared=false (bklit-side hover observation, pre-existing, flagged in notes-b4-bench.md).
- typecheck: **PASS** — `cd showcase && npx tsc --noEmit`, exit 0, **0 errors**
- build: **PASS** — `npm run build` (showcase; includes prebuild clone+install prep) exit 0; `next build` step ≈15.8s wall / 27.6s CPU. Compiled successfully, 29/29 static pages generated, zero lint/type errors. Notable warnings (benign): Next "Detected additional lockfiles" (`showcase/pnpm-lock.yaml` + root `pnpm-lock.yaml` → `outputFileTracingRoot` hint); Node MODULE_TYPELESS warning on `eslint.config.js`.
- visual/behavior reference pass (per part): **DONE** — 31 QA runs covering all 24 non-sankey parts captured 2026-08-22 (incl. loading states and single-retry reruns; sankey deferred to B4). **28 PASS / 3 FAIL**. Gate failures (all deterministic, pre-existing, reproduce byte-identically across days — none attributable to T-02b, which touched only sankey files): **pie** hover-30/70 ≈3.18%, **choropleth** hover-30 1.5345% (migrated tooltip absent), **heatmap** hover 0.52–0.59% at n=52. Attention (PASS but near gate): scatter settled 0.451%, candlestick hover-30 0.4968% (0.003pp under gate), markers 0.34–0.45%, candlelegend 0.3211%. Full table below.
- console sweep (CE): **PASS** — `qa/console-errors.mjs` over all migrated scenarios except sankey: 21/21 loads clean (line/area/heatmap incl. `state=loading`), **0 console errors, 0 warnings, 0 page errors**, exit 0. Scope note: the harness's fixed target list covers 19 charts; refarea/segment/projection/polar/funnel-family scenarios are outside it but were pixel-gated in B2 with no visible issues.

### B2 — Visual reference pass, 24 non-sankey parts (qa/screenshot.mjs, bklit vs migrated)

Coverage note: the 24 parts = the 25 per-part research reports (`research/phase-4/<part>.md`) minus sankey. The 18 chart-type parts are captured via 29 scenario pairs (sub-part/composite scenarios included); the 6 internal parts (foundation/animation/brush/interaction/axes-grid/legend-markers) have no standalone visual — their behavior is exercised inside these same scenarios (loading states, hover/tooltip captures, brush/legend/marker composites, grid+axes on every chart). Density rules per AGENTS.md/D238a: bar-family (`bar`, `barsquares`, `bardepth`) at n=100; all others n=1000. Loading-state captures for the three loading-chrome charts (`line`, `area`, `heatmap`) per D211/D212. Gate: settled+each capture ≤0.5% differing pixels, tooltips must assert visible.

| Part | Scenario | n | Results path | Settled diff % | Status |
|---|---|---|---|---|---|
| line | `line` | 1000 | `qa/results/line/2026-08-22T11-02-11-867Z` | 0.0000 | PASS |
| line (loading) | `line` | 1000 | `qa/results/line/2026-08-22T11-02-14-514Z` | 0.0526 | PASS |
| area | `area` | 1000 | `qa/results/area/2026-08-22T11-03-37-872Z` | 0.0003 | PASS |
| area (loading) | `area` | 1000 | `qa/results/area/2026-08-22T11-03-40-557Z` | 0.0508 | PASS |
| heatmap (loading) | `heatmap` | 1000 | `qa/results/heatmap/2026-08-22T11-43-32-361Z` | 0.3783 | PASS |
| heatmap | `heatmap` | 52 | `qa/results/heatmap/2026-08-22T11-46-56-926Z` | 0.4277 | **FAIL** — attention: settled+loading pass; ready-state hover diffs 0.5196/0.5218/0.5945% vs 0.5% gate, tooltips assert true both sides → real marginal hover-chrome drift, pre-existing (last ready-PASS 2026-08-02; all n=1000 attempts fail tooltip assertion symmetrically — probes land in empty space, "no heatmap cells found", hence n=52 per CE standard). Second baseline gate failure to fix |
| bar | `bar` | 100 | `qa/results/bar/2026-08-22T11-12-42-709Z` | 0.0000 | PASS |
| barsquares | `barsquares` | 100 | `qa/results/barsquares/2026-08-22T11-13-14-324Z` | 0.0046 | PASS (legend-hover ×3 ≤0.1568%) |
| bardepth | `bardepth` | 100 | `qa/results/bardepth/2026-08-22T11-13-22-333Z` | 0.0030 | PASS (depth-off/on ≤0.0640%; pulse-phase captures auto-skipped — `__qaSetBarPulsePhase` unwired both sides, per D238a) |
| scatter | `scatter` | 1000 | `qa/results/scatter/2026-08-22T11-14-35-859Z` | 0.4509 | PASS — attention: settled 0.45%, near gate; hover ≤0.296% |
| candlestick | `candlestick` | 1000 | `qa/results/candlestick/2026-08-22T11-14-41-808Z` | 0.3026 | PASS — attention: hover-30 0.4968% (0.003pp under the 0.5% gate); P1.9 K-cluster touches this chart |
| composed | `composed` | 1000 | `qa/results/composed/2026-08-22T11-14-47-809Z` | 0.0845 | PASS |
| radar | `radar` | 1000 | `qa/results/radar/2026-08-22T11-23-07-952Z` | 0.2419 | PASS (tooltipless polar family per D24; hover chrome diffs ≤0.297%) |
| pie | `pie` | 1000 | `qa/results/pie/2026-08-22T11-31-04-763Z` | 0.0139 | **FAIL** — attention: settled pixel-perfect but hover-30/70 ≈3.17–3.18% (gate 0.5%), hover-50 0.0000%. Deterministic: identical across 3 runs over 2 days incl. pre-T-02b sweep (`…/pie/2026-08-21T11-12-03-805Z`, `2026-08-22T11-24-33-806Z`) → pre-existing migrated hover-chrome drift at off-center probes, NOT T-02b/tainting. First baseline gate failure to fix |
| ring | `ring` | 1000 | `qa/results/ring/2026-08-22T11-32-52-112Z` | 0.0868 | PASS on retry — first attempt (`2026-08-22T11-26-23-495Z`) hover-70 failed 0.5253% mid-rebuild window (T-02b dist churn); retry on fresh server all-PASS ≤0.256% |
| gauge | `gauge` | 1000 | `qa/results/gauge/2026-08-22T11-34-54-488Z` | 0.1026 | PASS (tooltipless per D24; identical diff across all 4 captures — hover chrome static) |
| gauge | `gaugelinear` | 1000 | `qa/results/gaugelinear/2026-08-22T11-35-15-064Z` | 0.0225 | PASS |
| funnel | `funnel` | 1000 | `qa/results/funnel/2026-08-22T11-37-55-720Z` | 0.0000 | PASS (all 4 captures 0.0000%) |
| funnel | `funnelvertical` | 1000 | `qa/results/funnelvertical/2026-08-22T11-40-04-202Z` | 0.0000 | PASS (all 4 captures 0.0000%) |
| sunburst | `sunburst` | 1000 | `qa/results/sunburst/2026-08-22T12-03-24-724Z` | 0.0599 | PASS (tooltipless per D24; hover ≤0.254%) |
| choropleth | `choropleth` | 1000 | `qa/results/choropleth/2026-08-22T12-04-10-537Z` | 0.0000 | **FAIL** — attention: settled pixel-perfect; hover-30 fails 1.5345% with migrated tooltip not visible (bklit's fires). Byte-identical across retry + prior-day run (`2026-08-21T11-20-27-891Z`, `2026-08-22T12-03-30-095Z`) → deterministic pre-existing drift at the hover-30 probe, NOT T-02b/tainting. Third baseline gate failure to fix |
| live-line | `liveline` | 1000 | `qa/results/liveline/2026-08-22T12-03-42-276Z` | 0.0292 | PASS |
| reference-area | `refarea` | 1000 | `qa/results/refarea/2026-08-22T11-05-04-735Z` | 0.0021 | PASS |
| segment | `segment` | 1000 | `qa/results/segment/2026-08-22T11-05-10-216Z` | 0.0000 | PASS |
| children/profitloss | `profitloss` | 1000 | `qa/results/profitloss/2026-08-22T11-08-03-153Z` | 0.0194 | PASS |
| children/legend | `legend` | 1000 | `qa/results/legend/2026-08-22T11-08-05-752Z` | 0.0000 | PASS |
| children/candlelegend | `candlelegend` | 1000 | `qa/results/candlelegend/2026-08-22T11-08-10-494Z` | 0.3211 | PASS |
| children/legendhover | `legendhover` | 1000 | `qa/results/legendhover/2026-08-22T11-08-20-621Z` | 0.0592 | PASS |
| internal-brush | `brush` | 1000 | `qa/results/brush/2026-08-22T11-09-06-013Z` | 0.0001 | PASS |
| internal-legend-markers | `markers` | 1000 | `qa/results/markers/2026-08-22T11-09-16-440Z` | 0.4517 | PASS — attention: every capture 0.34–0.45% (widest composite deltas; candlestick hover-30 0.4968% remains closest overall), incl. marker-fan-open 0.4377% informational cross-impl per D229; watch for drift at W1 P1.12 |
| internal-legend-markers | `patternarea` | 1000 | `qa/results/patternarea/2026-08-22T11-09-25-408Z` | 0.0002 | PASS (8 pattern-preset captures all ≤0.166%) |
| sankey | `sankey` | 1000 | `qa/results/sankey/2026-08-22T12-37-42-696Z` | 0.3041 | settled PASS (post-D239 fix); hover-30/50/70 FAIL 2.84/1.94/1.43% — pre-existing, separate issue, deferred to Wave 1 P1.2 (see D239); visual refs verified in B4 — 12 PNGs each in `qa/results/sankey/2026-08-22T12-37-02-035Z` (n=4), `…12-39-35-219Z` (n=33), `…12-37-42-696Z` (n=1000) |

Legend: `legend`/`candlelegend`/`legendhover`/`markers`/`patternarea`/`barsquares`/`bardepth`/`brush` carry extra deterministic captures beyond settled (legend-hover, brush-domain, marker-fan, pattern presets, depth toggles) — full per-capture detail in each run's `report.json`.

## Per-batch gate results

Relabeled to the wave/package scheme (`research/phase-4/go-to-plan.md` §Batch execution order). Every package gates on typecheck+build green plus its listed extras (Q1/Q2 pixel gates for named parts · CE console sweep · bench compare vs this baseline · RF revert-swap-on-fail). Filled at 4.4.3 after each package lands.

### Wave 0 — pre-baseline

| Pkg | Tasks | typecheck+build | Q1/Q2 | CE | bench | Notes |
|---|---|---|---|---|---|---|
| P0.1 | T-01+T-02 bar-family v0.14 regressions | ✅ | ✅ barsquares+bardepth n=100 ALL PASS | ✅ | n/a (density artifact, D238a) | closed zero-diff vs `7d60a7f` |
| P0.1b | T-02b sankey regression fix | ✅ typecheck clean | ✅ settled PASS n=4/33/1000 (0.0008/0.1092/0.3041%) | ✅ 3 loads clean | ✅ B4 done (run `2026-08-22T15-46-19-823Z`; sankey not in bench matrix — visual refs verified, see B2 sankey row) | CLOSED (D239): root cause `97aaf78` label baseline, not v0.14; hover FAILs n≥33 pre-existing → Wave 1 P1.2 |
| P0.2 | T-03 baseline capture (this file, lanes B1–B3; B4 = bench --all + sankey refs post-T-02b) | ✅ PASS | ✅ 28/31 runs PASS, 3 FAIL (pie, choropleth, heatmap) | ✅ 21/21 clean | ✅ 24/24 cells, 0 skipped (`bench/results/2026-08-22T15-46-19-823Z`) | failures pre-existing/deterministic |

### Wave 1 — W1 parity fixes

| Pkg | Tasks | typecheck+build | Q1/Q2 | CE | bench | Notes |
|---|---|---|---|---|---|---|
| P1.1 | grid `horizontal` default (AX2) + prop-less Grid scenario | — | candlestick/scatter/bar prop-less Grid | — | — | scenario is LEAD-OWNED |
| P1.2 | sankey SK1/SK2/SK6/SK7/SK8/SK10 | — | sankey incl. controlled-hover | — | — | after P0.1b closes |
| P1.3 | composed stacked-sum (C5) + stackGap (C6) | — | composed stacked | — | composed | |
| P1.4 | choropleth CP11 palette, CP4–6 defaults, CP7 exit-fade | — | choropleth | — | — | fixes baseline hover-30 FAIL |
| P1.5 | heatmap HM16 ring removal + HM14 patterns + HM7/HM6 | — | heatmap | — | — | fixes baseline hover FAIL |
| P1.6 | reference-area className (RA1) | — | spot-check refarea | — | — | |
| P1.7 | sunburst semantics quintet SB1/SB12–SB15 | — | sunburst hover/zoom | — | — | gate spec for T-D12 |
| P1.8 | radar RD5/RD7/RD6 | — | radar timing | — | — | |
| P1.9 | candlestick K7/K9/K10 | — | candlestick | — | — | baseline hover-30 at 0.4968% — tight margin |
| P1.10 | gauge G2/G3/G5 + scatter S8–S12 | — | gauge+scatter | — | — | scatter settled at 0.4509% — tight margin |
| P1.11 | LiveLine V1 right y-axis | — | liveline | — | — | |
| P1.12 | markers LM cluster + QA-hook gating (LM1/LM13) | — | markers | — | — | markers captures 0.34–0.45% — watch |
| P1.13 | T-W1-18/T-W1-19/T-W1-20 (bar pulse wave resurrect, area legacy props, Background wire) | — | loading-wave pixel gate + area | — | line+bar | |

#### Wave 1 consolidated gate sweep — 2026-08-23 (D246 impl/gate split)

Post-implementation sweep run once for the whole wave by the gate-runner (full executor detail in `notes-gate-w1.md`). All pixel runs `qa/screenshot.mjs`, bklit vs migrated, gate 0.5%. Densities per each package's Gates section (bar-family n=100 per AGENTS.md; sankey n=33; sunburst n=27; legend n=4; heatmap gated at n=52 — see note). The two new-fixture runs were already gated by the lead pre-sweep and are re-verified here from disk only. Console = `qa/console-errors.mjs` fixed list + ad-hoc headless loads for charts outside it. Bench cells below are the **first-ever composed rows and first migrated-column entries** in any results set (the P0.2 baseline matrix contains neither), so they carry fresh same-session bklit anchor cells instead of frozen-baseline comparisons.

Per-chart QA runs:

| chart | n | run dir | settled % | worst capture % | verdict |
|---|---|---|---|---|---|
| candlestick | 1000 | `qa/results/candlestick/2026-08-23T08-47-16-866Z` | 0.3025 | hover-30 0.4962 | **PASS** |
| scatter | 1000 | `qa/results/scatter/2026-08-23T09-36-05-240Z` | 0.4509 | settled 0.4509 | **PASS** — first batch attempt (`…T08-47-16-436Z`) settled 14.9020% was a one-off reveal-timing capture flake (hovers were 0–0.26% there); solo repro byte-identical to baseline |
| choropleth | 1000 | `qa/results/choropleth/2026-08-23T08-47-15-816Z` | 0.0000 | hover-30 **1.5345** | **FAIL** — byte-identical to the pre-Wave-1 baseline failure (`…12-04-10-537Z`: same 1.5345%, migrated tooltip absent at hover-30 while bklit's fires); P1.4's expected fix NOT observed. Real finding, lead triage |
| heatmap | 52 | `qa/results/heatmap/2026-08-23T09-32-51-329Z` | 0.4277 | hover-70 **0.5834** | **FAIL** — marginal (hovers 0.5057/0.5077/0.5834 vs baseline 0.5196/0.5218/0.5945, tooltips assert on both sides). n=1000 supplementary run (`…T08-47-28-937Z`) passes pixels but its probes land in empty space both impls (symmetric harness artifact, matches every n=1000 run since Aug 19) so hover chrome is only testable at n=52. P1.5's expected fix NOT fully observed. Real finding, lead triage |
| radar | 1000 | `qa/results/radar/2026-08-23T08-50-01-918Z` | 0.2419 | hover-30 0.2968 | **PASS** (tooltipless polar family per D24) |
| gauge | 1000 | `qa/results/gauge/2026-08-23T08-47-36-419Z` | 0.1122 | 0.1122 all | **PASS** (tooltipless) |
| line | 1000 | `qa/results/line/2026-08-23T08-50-06-872Z` | 0.0000 | hover-70 0.1494 | **PASS** |
| area | 1000 | `qa/results/area/2026-08-23T08-50-07-219Z` | 0.0003 | hover-70 0.1580 | **PASS** |
| bar | 100 | `qa/results/bar/2026-08-23T08-54-04-191Z` | 0.0000 | 0.0000 all | **PASS** |
| barsquares | 100 | `qa/results/barsquares/2026-08-23T08-54-32-038Z` | 0.0046 | hover-70 0.1530 | **PASS** (legend-hover ×3 ≤0.0524%) |
| bardepth | 100 | `qa/results/bardepth/2026-08-23T08-54-05-668Z` | 0.0030 | depth-on 0.0626 | **PASS** (pulse-phase-freeze captures auto-skipped BOTH sides — `__qaSetBarPulsePhase` still unwired, so dynamic pulse-phase parity remains unverified, per D238a) |
| liveline | 100 | `qa/results/liveline/2026-08-23T08-54-44-590Z` | 0.0315 | hover-70 0.1368 | **PASS** |
| markers | 100 | `qa/results/markers/2026-08-23T08-54-41-807Z` | 0.3601 | hover-30 **0.5507** | **FAIL (chronic)** — reproduces the Aug-20 approved-era n=100 profile (0.5501/0.5489% same capture); all other captures incl. marker-fan-open 0.3426% pass at approved magnitudes. Density-dependent marginal fail, not a Wave 1 regression; n=100 canonical green run still outstanding (n=1000 passed fully Aug 21/22) |
| sankey | 33 | `qa/results/sankey/2026-08-23T08-55-52-351Z` | 0.1092 | hover-30 0.3675 | **PASS — D239 hover gap CLOSED**: hover-30 1.0540%→0.3675%, all three hovers under gate for the first time at n=33 (settled matches D239 post-fix exactly) |
| sunburst | 27 | `qa/results/sunburst/2026-08-23T09-04-28-325Z` | 0.0599 | hover-70 **4.8809** | **FAIL** — all three hovers fail (2.5088/2.6442/4.8809; tooltips correctly absent, TOOLTIPLESS family). Worse than the most recent pre-Wave-1 profile (Aug 19: hover-30 0.9478 only fail, 50/70 passed); matches the worse of the two historical oscillation patterns. Possible P1.7 SB12/SB15 involvement. Real finding, lead triage |
| legend | 4 | `qa/results/legend/2026-08-23T09-11-34-941Z` | 0.0000 | 0.0000 all | **PASS** (hover-item ×3 pixel-perfect) |
| griddefault (lead-gated) | 1000 | `qa/results/griddefault/2026-08-23T00-14-15-551Z` | 0.0000 | hover-70 0.1423 | **PASS** (re-verified from disk) |
| composedstacked (lead-gated) | 1000 | `qa/results/composedstacked/2026-08-23T00-14-20-987Z` | 0.0756 | hover-70 0.2706 | **PASS** (re-verified from disk) |

Sweep tally: **12/17 chart-densities PASS** (incl. both lead-gated fixtures); 5 FAIL findings — 2 chronic/pre-existing-classified (heatmap n=52 marginal, markers n=100 hover-30), **3 real open findings for lead triage: choropleth hover-30 (P1.4 claim unmet), heatmap n=52 still over gate (P1.5 claim unmet), sunburst low-n hovers (possible P1.7 regression)**. Scatter one-off flake documented and cleared by repro.

#### Lead triage ruling (D248)

All three open findings were re-verified against the on-disk `report.json` history before dispatching. Rulings:

| finding | classification | evidence that settled it | action |
|---|---|---|---|
| sunburst n=27 hovers | **REAL Wave 1 regression** (P1.7) | `settled` byte-identical pre/post (0.0599%), but hover-50 0.3165%→2.6442% and hover-70 0.3141%→4.8809% — two captures that previously **PASSED** now fail ~8× and ~15×. Corroborated at n=33. Hover-state-confined; only P1.7 touched sunburst | fix dispatch **F1** |
| choropleth hover-30 | **T-W1-9 / CP7 acceptance UNMET** (P1.4) | 1.5345% identical to 4 decimals across `2026-08-21T11-20-27-891Z`, `2026-08-22T12-04-10-537Z`, `2026-08-23T08-47-15-816Z` — three runs on three days spanning a 217-line rewrite of the choropleth cluster. T-W1-9's acceptance is literally "hover visuals indistinguishable from legacy", so this is unmet, not inherited debt | fix dispatch **F2** |
| heatmap n=52 hovers | **T-W1-9 / HM16 acceptance likely unmet** (P1.5) | moved only 0.011–0.014pp; `settled` not at all. F3 is chartered to determine whether HM16 was actually removed, or removed with a separate residual remaining — an accurately-characterised ~0.08pp residual is an acceptable outcome | fix dispatch **F3** |

**Correction to the candlestick row above.** Candlestick's *batch* attempt (`qa/results/candlestick/2026-08-23T00-46-20-101Z`) reported settled **1.2564%** against its 0.3026% norm and was provisionally read by the lead as a Wave 1 regression; the solo re-run at 0.3025% cleared it. Together with scatter's 14.9020% batch flake, that is **two false pixel failures manufactured by the same concurrent batch run**. Standing rule from this: **a batch-mode QA FAIL is not a finding until a solo repro confirms it.**

**Unowned baseline debt carried forward.** `pie` hover-30/70 ≈3.18% was one of the three 4.4.1 baseline gate failures (line 52 above) and **no Wave 1 task owns it** — it was not in the Wave 1 sweep because no Wave 1 package touched pie. It needs explicit lead assignment to a later wave; it is not closed and must not be assumed closed by Wave 1's tally.

**Update — pie now assigned (D249).** The full disk history makes this diagnosable rather than diffuse, so it is chartered as a fix (new task **T-W2-7** / package **P2.4**), not accepted as a deviation:

| run (`--n 1000`) | settled | hover-30 | hover-50 | hover-70 |
|---|---|---|---|---|
| `2026-08-19T20-50-25-175Z` | 0.0083% PASS | 3.1827% FAIL | **0.0000% PASS** | 3.1716% FAIL |
| `2026-08-21T11-12-03-805Z` | 0.0085% PASS | 3.1828% FAIL | **0.0000% PASS** | 3.1712% FAIL |
| `2026-08-22T11-24-33-806Z` | 0.0124% PASS | 3.1829% FAIL | **0.0000% PASS** | 3.1714% FAIL |
| `2026-08-22T11-31-04-763Z` | 0.0139% PASS | 3.1842% FAIL | **0.0000% PASS** | 3.1721% FAIL |

The exactly-zero hover-50 across all four runs is the tell: the impls are pixel-identical at one probe point and ~3.18% apart at the other two, so this is a probe-position-specific **hover-state** divergence (a displaced slice, or an overlay/tooltip panel), not a rendering drift — ~3.18% of a 1200×800 viewport is far too large for an antialiasing seam. Scheduled into the W2 slot because **P3.1's gate is "zero-drift on pie/scatter/sankey/choropleth/sunburst"** and a standing 3.18% pie failure would make that gate unreadable. Dispatch held until F1/F2/F3 clear, per the solo-repro rule above.

**RESOLVED — this debt is closed (D254).** P2.4 fixed it; solo `qa/results/pie/2026-08-23T19-02-45-552Z` is `overallPass=true`:

| run (`--n 1000`) | settled | hover-30 | hover-50 | hover-70 |
|---|---|---|---|---|
| `2026-08-23T19-02-45-552Z` | 0.0054% PASS | **0.0000% PASS** | 0.0000% PASS | 0.0007% PASS |

**My reading of the four-run signature above was wrong on the mechanism, and the correction is worth keeping.** I inferred "a displaced slice, or an overlay/tooltip panel." The actual cause was a **hover oscillation**: the migrated port collapsed legacy's static-hitbox / animated-visual *pair* into one TanStack `radialArc` mark, so the 10px hover pop moved the hit area out from under a stationary cursor, unhovering and re-hovering indefinitely — the whole-disc fade of 999 slices was therefore **never applied at capture time**, which is what the ~3.18% actually measured. What broke it open was a technique worth reusing: diffing each impl's hover capture against **its own settled capture** (bklit 30,342 px changed on hover; migrated 408 px) rather than against the other impl. The exactly-zero hover-50 remained a valid tell that the divergence was hover-state and probe-specific; the inference about *which* hover state was the error. See D254, including the repo-wide audit dispatched for the same root pattern.

Console sweep: `qa/console-errors.mjs` fixed list **21/21 PASS, 0 errors / 0 warnings** (incl. sunburst n=27 — already in the script's working-tree list — plus candlelegend/legendhover companions, heatmap+loading). Ad-hoc read-only headless loads (temp probe script, pattern-mirrors console-errors, deleted after run): **sankey n=33, choropleth n=1000, radar n=1000, gauge n=1000, liveline n=100 `state=loading` — all 5 PASS, zero errors/warnings** (liveline loading closes P1.11's required-but-unlisted load).

Markers QA-hook gating (LM1/LM13): `__qaSetMarkerFan` verified inert-by-default in source (`internal/chart-markers.tsx` requires the flag pre-set before module evaluation; prod pages never set it pre-boot) AND functionally exercised by the markers run — `marker-fan-open` capture executed through the harness `addInitScript` path, passed at 0.3426%, PNG visually confirms fanned clusters.

Bench compare (exclusive slot; serialized single-combo runs; 0 skipped anywhere; 0 console errors on every cell):

| cell | run dir | M1a mount→paint ms | M1b settle ms | M3a update ms | tooltip |
|---|---|---|---|---|---|
| migrated/composed n=1000 | `bench/results/2026-08-23T09-38-57-228Z` | 112.5 | 1699.1 | 55.6 | true |
| bklit/composed n=1000 (anchor) | `bench/results/2026-08-23T09-40-16-144Z` | 84.7 | 1315.2 | 21.1 | true |
| migrated/bar n=100 | `bench/results/2026-08-23T09-41-36-674Z` | 39.8 | 1577.0 | 29.9 | true |
| bklit/bar n=100 (anchor) | `bench/results/2026-08-23T09-42-57-089Z` | 67.5 | 1591.7 | 32.5 | true |

Verdicts (order-of-magnitude bar per dispatch): **bar-family clean** — fresh bklit anchor reproduces the frozen P0.2 medians (67.5/1591.7/32.5 vs baseline 71.4/1599.3/32.4) and migrated sits at parity on every metric (M3a 29.9 vs 32.5; M1b within 15ms; M1a faster than bklit). **Composed: no regression cliff, but flagged for lead** — these are the first composed bench cells ever recorded (no baseline trend exists); migrated M3a 55.6ms vs bklit 21.1ms (~2.6×) and M1b +384ms slower, same order of magnitude but the widest gap in this table. No chase ordered by dispatch; numbers recorded for triage.


### Wave 2 — W2 dead code + hygiene

| Pkg | Tasks | typecheck+build | Q1/Q2 | CE | bench | Notes |
|---|---|---|---|---|---|---|
| P2.1 | loading surface + overlay deletion (T-W2-1) | — | smoke line+bar | — | line+bar | |
| P2.2 | dead vars sweep + MARKER_* un-export + live-line/ring cleanup (T-W2-2/5/6) | — | smoke touched parts | — | scatter+ring+liveline | |
| P2.3 | styles.css orphans + stale comments (T-W2-3/4) | — | visual spot-check consumers | — | — | |

### Wave 3 — W3 native swaps (RF applies)

| Pkg | Tasks | typecheck+build | Q1/Q2 | CE | bench | Notes |
|---|---|---|---|---|---|---|
| P3.1 | T-D15 palette alias layer FIRST | — | zero-drift pie/scatter/sankey/choropleth/sunburst | — | — | prerequisite for palette swaps |
| P3.2 | T-D1 motion() defaults ×7 | — | reveal gates all parts | — | — | |
| P3.3 | T-D2 focusDisabled + T-D11 hover dim states | — | gauge dim/focus | — | — | |
| P3.4 | T-D3 linear stagger | — | reveal timing byte-equal | — | — | |
| P3.5 | T-D4 grid guides/rules/bands | — | line+funnel | — | — | |
| P3.6 | T-D12 sunburst native swap | — | sunburst incl. drill-down | — | — | RF |
| P3.7 | T-D13 sankey native swap | — | sankey | — | — | RF |
| P3.8 | T-D6 findNearestPoint + T-D7 svgAnimation tween | — | hover targeting + tween-fire | — | line/area/composed | |
| P3.9 | T-D8 native tooltip cutover (per-part sub-runs) | — | per-part | — | — | RF per part |
| P3.10 | T-D5 gradients/clipPath natives | — | gradient pixel identity | — | — | |
| P3.11 | T-D9 brushX mechanics | — | brush behavior | — | — | |
| P3.12 | T-D10 createChartSpring + host sizing audit | — | spring visual tolerance | — | — | |

#### Bench backfill attempt — 2026-08-24 — **VOID, DO NOT CITE (D273)**

The 4.4.3 gate requires `bench compare vs baseline` after every package. It **was never run for 25 consecutive packages** (all of Wave 1, Wave 2, and P3.1–P3.4). Per-package attribution is permanently lost: those 25 packages sit in one undifferentiated working tree at HEAD `7d60a7f` with no per-package commits to bisect. A single aggregate backfill was therefore the only measurement available, and it was run.

Validity of the comparison was gated first and **passed**: the 10 modified `bench/app/src/scenarios/tanstack-*.tsx` files carry only the `tooltip: true` → `@tanstack/charts/tooltip` extension fix that is already inside the baseline, and `bench/run.mjs`'s changes are infrastructure (`BENCH_PORT`, `QA_SKIP_REBUILD`, atomic build lock) — corroborated by the baseline itself having been captured with `BENCH_PORT=5302`. No `bklit-*.tsx` scenario was edited; the two `bklit-*` entries in `git status` (`bklit-composedstacked.tsx`, `bklit-griddefault.tsx`) are untracked **additions**.

Run: `bench/results/2026-08-24T10-53-28-454Z` — 24/24 cells, **0 skipped**, no crashes.

**The run is void on its face, and the control channel is what proves it.** `bklit` is legacy code Phase 4 has never touched and whose scenarios are unmodified, so it cannot have regressed. It moved anyway:

| control cell (must not move) | baseline | this run | delta |
|---|---|---|---|
| `bklit/bar n=100` M1a | 71.4 | 442.2 | **+519.3%** |
| `bklit/bar n=100` M3a | 32.4 | 204.6 | **+531.5%** |
| `bklit/area n=1000` M1a | 61.9 | 268.7 | **+334.1%** |

Per-run values identify the mechanism as **mid-cell regime shifts, not dispersion**: `bklit/bar n=100` M1a ran `70, 66, 69, 519, 533, 442, 815`, and its M3a held ≈32 for ~60 runs before stepping to ≈230 and staying; `bklit/area n=1000` M1a ran the same shift **in reverse** (`420, 295, 344, 269, 53, 60, 68`). A code regression cannot switch on mid-cell in one cell and switch off mid-cell in another. The machine was under load.

Consequences for the `tanstack` column: the uniform +3–15% seen across nearly every migrated cell appears **equally in the untouched control**, so it is environmental. The single migrated move over 10% (`tanstack/bar n=10000` M3a, 496.3 → 559.0, +12.6%) sits inside that same envelope and is not chargeable. This is a **weak negative result with a ~20% detection ceiling** — real migrated-side drift below that magnitude is invisible here. It is **not** a clean bill of health, and **bench remains an OPEN 4.4.3 gate** for Waves 1–3.

One number is worth carrying forward as the best evidence currently available, with the caveat above attached: **`tanstack/scatter n=1000` M3a — baseline 34.3, previously observed 65.5, this run 37.2 (+8.5% vs baseline).** The 65.5 did not reproduce. The P4.2 watch stands but is downgraded.

**Standing rule from this (D273):** bench is only meaningful as an **exclusive quiet run**, and **every future bench compare must report the `bklit` control deltas alongside the `tanstack` ones. A bench result whose control channel moved is void on its face** — that one glance would have caught this before any analysis was spent on it.

#### Bench backfill, exclusive re-run — 2026-08-24 — **VALID, with a ~17% resolution floor**

Re-run of the above under D273 conditions: no executor dispatched, no QA sweep, no concurrent bench, process table asserted empty via `ps aux | grep -E "npm-global/bin/cmd|dispatch.sh"` before starting (D287 procedure). Run: `bench/results/2026-08-24T20-41-16-047Z` — 24/24 cells, 0 skipped.

**Control channel first, per D273.** `bklit` is untouched legacy and must not move. It moved, modestly and coherently:

| control cell (must not move) | baseline | this run | delta |
|---|---|---|---|
| `bklit/area n=100` M1a | 66.2 | 54.6 | **−17.5%** |
| `bklit/scatter n=100` M1a | 56.8 | 48.7 | **−14.3%** |
| `bklit/bar n=100` M1a | 71.4 | 61.8 | **−13.4%** |
| `bklit/area n=1000` M1a | 61.9 | 54.6 | **−11.8%** |

Four cells exceed ±8%; **all are `m1a_mountToPaintMs` and all are negative** — a uniformly faster mount environment, not the mid-cell regime shift that voided the 10-53 run. M1b and M3a controls held. **Verdict: not void.** But cross-run absolute comparison against the 2026-08-22 baseline now carries a **~17% resolution floor** — migrated-side drift smaller than that is not detectable here. Within-run comparisons are unaffected.

**THE STRUCTURAL FINDING (D289 §4): `bench --all` contains zero `migrated` cells.** Its matrix is `{bklit, tanstack} × {line, area, bar, scatter} × {100, 1000, 10000}`. The 4.4.1 baseline has the identical shape. **Every "bench compare vs baseline" in this phase has therefore compared two reference implementations to each other — neither of which is the code we are writing.** `tanstack` is the upstream performance ceiling (D258: ports none of bklit's styling); `bklit` is the legacy control. Our port appeared in neither column.

`migrated` **is** benchable — single-cell mode (`node bench/run.mjs --chart <c> --impl migrated --n <n>`) has no impl allowlist. It had simply never been invoked.

#### `migrated/scatter n=1000` — first direct measurement of our own code

Run `bench/results/2026-08-24T21-01-31-188Z`, exclusive. Compared **within session** against the same-run control, so the 17% cross-run floor above does not apply:

| scatter n=1000 | M1a mount→paint | M1b settled | M3a update |
|---|---|---|---|
| `bklit` (legacy — the parity target) | 128.2 | 1274.9 | **32.6** |
| `tanstack` (upstream ceiling) | 97.3 | 151.4 | 24.9 |
| **`migrated` (ours)** | **102.1** | **1192.1** | **67.5** |

- **M1a — better than legacy.** 102.1 vs 128.2, close to the 97.3 ceiling. No action.
- **M1b — matches legacy.** 1192 vs 1275. Both carry the intentional ~1100 ms reveal animation that the ceiling scenario does not implement. Expected, not a regression.
- **M3a — 2.07× legacy (67.5 vs 32.6), and 2.7× the ceiling.** This is a real interactivity-parity regression on the hover/update path, measured against the control in a single session, so no environmental drift explains it.

**This also corrects the record on the "scatter M3a" series.** The `34.3 → 65.5` pair recorded above was filed under `tanstack/scatter`; on that channel the 65.5 has now failed to reproduce **three consecutive times** (37.2 in the void run, **24.9 here**, −27.4% vs its 34.3 baseline). That watch is **CLOSED**. Meanwhile `67.5 ≈ 65.5` on the `migrated` channel — the spike was almost certainly ours all along and was mislabelled, which is exactly why it kept "not reproducing" where it was being looked for while persisting where it was not.

**`migrated/scatter n=1000` M3a = 67.5 is the binding before-number for P4.2**, whose T-C2 (focus strategies) and T-C7 (broadcast store) both sit on scatter's hover path. P4.2's own bench mandate was cancelled — it cannot produce a valid number concurrently — and replaced by this lead-run exclusive cell plus a qualitative requirement to flag new allocations on that path.

### Wave 4 — W4 centralization

| Pkg | Tasks | typecheck+build | Q1/Q2 | CE | bench | Notes |
|---|---|---|---|---|---|---|
| P4.1 | T-C1 mapper kit + surviving T-C5 folds | — | hover chromes | — | — | |
| P4.2 | T-C2 focus strategies + T-C7 broadcast store + T-C8 bar-squares math | — | bar/scatter/candlestick focus + heatmap/pie hover | — | — | pie baseline hover FAIL must be resolved by here |
| P4.3 | T-C3 reveal-shim collapse + T-C4 CenterShell merge | — | pie/ring/gauge/funnel reveals | — | — | |
| P4.4 | T-C6 legend unify + T-C9 axis overlay layer + most of T-C10 | — | legends/axis overlays | — | — | |
| P4.5 | T-C10 remainder (moved to P6.2) | — | — | — | — | see Moves log |

### Wave 5 — W5 API surface restoration

| Pkg | Tasks | typecheck+build | Q1/Q2 | CE | bench | Notes |
|---|---|---|---|---|---|---|
| P5.1 | T-E1a barrel tier ×3 sub-runs (TYPES/CONSTS/HELPER-FNs) | — | api-compat QA per sub-run | — | — | sunburst-geometry block held post-P3.6 |
| P5.2 | T-E1b port/wrapper tier ×2 sub-runs | — | api-compat QA | — | — | useYScale/useAnimatedYDomains → P6.2 |
| P5.3 | T-E1c ACCEPT ledger + CH17 drift audit | — | ledger review only | — | — | runs last of E1 trio |
| P5.4 | T-E2 default exports + T-E7 dev-warn layer | — | api-compat QA | dev-warn CE | — | |
| P5.5 | T-E3 stub-prop family + T-E6 sunburst Hint/Breadcrumb | — | per part touched | — | — | |
| P5.6 | T-E4 renamed-compat batch | — | api-compat QA | — | — | needs P4.3 CenterShell |
| P5.7 | T-E5 loading presets | — | line+area loading states | — | — | |
| P5.8 | T-E8 measurement debounce parity (pie P9 + gauge G5) | — | spot-check resize | — | — | |

### Wave 6 — multi-axis + closing

| Pkg | Tasks | typecheck+build | Q1/Q2 | CE | bench | Notes |
|---|---|---|---|---|---|---|
| P6.1 | T-F1 multi-axis yAxisId (scale layer + 6 consumer clusters + AX7 filter + AX4 re-add) | ✅ tsc rc=0 · bench build rc=0 | ✅ 6 new multi-axis fixtures PASS, each with a FAILING D331 control; 9 regression charts PASS | — | ✅ 8 exclusive cells, paired same-session controls (below) | CLOSED — see §P6.1 bench below |
| P6.2 | deferred scale-adjacent items (T-C10 xForDate/tokens, T-E1b wrappers) | ✅ tsc rc=0 · bench build rc=0 | ✅ 13 charts PASS incl. new `projectionxdomain` fixture with a moving D331 control; two real defects fixed (D347) + one harness defect fixed (D348) | — | ✅ 6 exclusive paired cells (below) | CLOSED — see §P6.2 bench below |
| P6.3 | T-F2 D-log entries D240–D245 + unlogged ACCEPTs | — | review only, zero code | — | — | CLOSED — D349–D354; charter numbers were stale (D240 occupied, D241–D245 never written), split by content per D266 |
| P6.3b | `centralize 5` — 33 `dataset.bkmRevealed` sites → `deferred-reveal` primitives (9 files) | ✅ tsc rc=0 · bench build rc=0 | ✅ 10 charts PASS (line/area/composed/scatter/candlestick 1000, bar 100, sunburst 27+33, choropleth 100, heatmap 52); heatmap = D250 F3 to 4dp, sunburst = D281 at both densities | — | not run (DOM-flag rewire, no measurable path) | CLOSED — D356. **D331 control NEGATIVE:** latch fully stubbed out, all 12 numbers identical to 4dp → gate is structurally blind to this subsystem. PASS = nothing else regressed; **not** evidence the latch works. |
| P6.4 | T-F3 final pass (4.4.5) | tsc rc=0, showcase build rc=0, bench build rc=0 | 45 runs, ALL 43 kinds + ring n=4 + sunburst n=33 | **42 PASS / 3 known-non-parity** (`barloading` D341 fixture, `ring` n=1000 D335, `candletween` D330 §2) | 10 exclusive paired cells — **M1a VOID** (control drift +8.3%/+12.3%), M1b/M1c/M3a/M3c valid | **CLOSED — D358.** All three 4.4.1 baseline gate failures resolved (`pie`, `choropleth`, `heatmap`); `sankey` too. One harness fix (`TOOLTIPLESS_CHARTS`). |

#### P6.1 bench — 8 exclusive cells, 2026-08-26

Run under D273 conditions (no executor dispatched, no QA sweep concurrent, process table asserted empty). Densities per the standing mandate: bar n=100, everything else n=1000. Per **D289 §4** the `migrated` column is the only one that measures our own code, so each chart was run as a **`bklit` / `migrated` pair inside the same session** — within-run comparison, so the ~17% cross-run resolution floor does not apply.

| chart | n | impl | M1a mount→paint | M1b settle | M3a update | M3c frame | heap |
|---|---|---|---|---|---|---|---|
| line | 1000 | `bklit` (control) | 59.9 | 1158.5 | 31.6 | 16.7 | 5.3 MB |
| line | 1000 | **`migrated`** | **51.7** | **1117.0** | **32.4** | 16.7 | 5.4 MB |
| bar | 100 | `bklit` (control) | 68.6 | 1594.7 | 32.6 | 16.7 | 5.3 MB |
| bar | 100 | **`migrated`** | **36.8** | **1574.7** | **30.2** | 16.7 | 4.6 MB |
| scatter | 1000 | `bklit` (control) | 126.7 | 1313.8 | 32.5 | 16.7 | 8.5 MB |
| scatter | 1000 | **`migrated`** | **72.8** | **1241.8** | **31.5** | 16.7 | 5.5 MB |
| composed | 1000 | `bklit` (control) | 74.6 | 1291.4 | 21.2 | 16.7 | 12.7 MB |
| composed | 1000 | **`migrated`** | **78.2** | **1665.5** | **30.6** | 16.7 | 7.1 MB |

**Control channel first (D273).** The two `bklit` cells that have frozen baseline counterparts both held: `bklit/bar n=100` M1a 71.4 → 68.6 (−3.9%), M3a 32.4 → 32.6 (+0.6%); `bklit/scatter n=1000` M1a 128.2 → 126.7 (−1.2%) against the D289 exclusive run. Nothing approaches the ±8% threshold that voided earlier attempts. **Not void.**

**Verdicts.**

- **line, bar — no regression, migrated ahead on mount.** M1a 51.7 vs 59.9 and 36.8 vs 68.6; M3a at parity on both. The per-axis projector is an identity function on every single-axis chart, which is exactly what these numbers say: the scale-layer change cost nothing.
- **scatter — the M3a regression recorded at P4.2 is GONE.** D289's exclusive cell measured `migrated/scatter n=1000` M3a at **67.5 against a 32.6 control (2.07×)** and made that the binding before-number for P4.2. This run measures **31.5 against a 32.5 control — parity, a 2.1× improvement**, with heap also down from bklit's 8.5 MB to 5.5 MB. P6.1 did not target scatter's hover path, so the credit belongs to the Wave 4/5 work between the two measurements; recorded here because this is the first paired cell since.
- **composed — the one cell to watch, and it improved.** M3a 30.6 vs a 21.2 control is **1.44×**, still the widest gap in the table. But the Wave 1 sweep recorded composed M3a at **55.6 vs 21.1 (2.63×)**, so the gap has more than halved while the control held. M1b is +29% (1665.5 vs 1291.4) — composed runs a genuinely double reveal (shared clip wipe plus an independent per-bar WAAPI stagger), so a longer settle is expected by construction rather than a defect. Heap is *better* than legacy (7.1 MB vs 12.7 MB). No chase ordered; **composed M3a 30.6 is the new carried-forward watch number**, replacing 55.6.

#### P6.2 bench — 6 exclusive cells, 2026-08-26

Run under D273 conditions (no executor dispatched, no QA sweep concurrent). Every chart run as a **`bklit` control / `migrated`** pair in the same session; densities per the standing mandate (n=1000).

| chart | n | impl | M1a mount→paint | M1b settle | M1c script | M3a update | M3c per-move script | heap |
|---|---|---|---|---|---|---|---|---|
| line | 1000 | `bklit` (control) | 64.7 | 1164.1 | 78.2 | 31.4 | 1.3 | 5.3 MB |
| line | 1000 | **`migrated`** | **50.7** | **1116.1** | **75.0** | **32.5** | **0.6** | 5.4 MB |
| area | 1000 | `bklit` (control) | 56.1 | 1154.4 | 82.8 | 30.5 | 2.8 | 5.2 MB |
| area | 1000 | **`migrated`** | **44.2** | **1148.9** | **85.0** | **32.5** | **0.7** | 6.1 MB |
| composed | 1000 | `bklit` (control) | 80.7 | 1315.7 | 529.8 | 21.3 | 13.7 | 12.7 MB |
| composed | 1000 | **`migrated`** | **80.3** | **1672.3** | **118.8** | **31.3** | **0.9** | 7.1 MB |

**Control channel first (D273) — and one channel is VOID.** Against the P6.1 cells above, the `bklit` control moved on **M1a** by **+8.0%** (line 59.9 → 64.7) and **+8.2%** (composed 74.6 → 80.7), at/above the ±8% threshold that voids a comparison. **M1a is therefore not evidence in this run and no M1a claim is made from it.** Every other channel's control held: M1b +0.5% / +1.9%, M3a −0.6% / +0.5%, M3c flat, heap identical (5.3 MB, 12.7 MB). Those channels are valid.

**Verdicts (valid channels only).**

- **line, composed — P6.2 is flat.** Migrated moved less than its own control did: line M1b 1117.0 → 1116.1 (−0.1%), M3a 32.4 → 32.5; composed M1b 1665.5 → 1672.3 (+0.4%), M3a 30.6 → 31.3 (+2.3%), heap unchanged at 7.1 MB. Consolidating five inline x-scale copies onto one helper and hoisting two memos cost nothing measurable, which is what a pure de-duplication should read as.
- **composed M3a stays the widest gap in the board** — 31.3 vs a 21.3 control (1.47×), essentially unchanged from P6.1's 1.44×. Unrelated to P6.2; carried forward to P6.4.
- **area — first paired cell, so no before-number.** Migrated is ahead of its control on M1a and M1b and 4× better on per-move script (0.7 vs 2.8), behind on M3a (32.5 vs 30.5, +6.6%) and on heap (6.1 vs 5.2 MB, +17%). Recorded as a new datum, not a regression: there is nothing to regress from.

## 4.4.5 Final pass

Run 2026-08-26, lead-executed, after P6.3b closed.

- **full build: PASS** — `npx tsc --noEmit` from `showcase/` **rc=0**, `showcase` `npm run build` **rc=0**, `bench/app` `npm run build` **rc=0**.
- **parity spot-check ALL charts: 45 runs, 41 PASS / 4 FAIL as captured; all four FAILs triaged to a pre-existing ruling or a harness gap, and after the harness gap was fixed the board is 42 PASS / 3 known-non-parity.** Table and triage below.
- **bench compare vs baseline: see §P6.4 bench.**

### P6.4 parity board — 45 runs, mandated densities

Densities per the standing mandate, which supersedes the 4.4.1 baseline's choices for several charts (sunburst 1000 -> 27 **and** 33, choropleth 1000 -> 100, heatmap -> 52, sankey -> 33, radar 1000 -> 6). Where the mandate moved the density, the comparison point is the most recent recorded run at the mandated density, not the baseline row.

| chart | n | settled | hover-30 | hover-50 | hover-70 | overall |
|---|---|---|---|---|---|---|
| `line` | 1000 | 0.0000 | 0.0000 | 0.0540 | 0.1478 | PASS |
| `area` | 1000 | 0.0003 | 0.0001 | 0.0001 | 0.1593 | PASS |
| `composed` | 1000 | 0.0845 | 0.0000 | 0.0000 | 0.1394 | PASS |
| `scatter` | 1000 | 0.4510 | 0.0762 | 0.0779 | 0.2964 | PASS |
| `candlestick` | 1000 | 0.3025 | 0.4953 | 0.3661 | 0.3618 | PASS |
| `candletween` | 1000 | 1.3619 | 3.0002 | 0.3661 | 0.3890 | FAIL |
| `refarea` | 1000 | 0.0021 | 0.0000 | 0.0523 | 0.1451 | PASS |
| `segment` | 1000 | 0.0000 | 0.0000 | 0.0532 | 0.1435 | PASS |
| `profitloss` | 1000 | 0.0189 | 0.0152 | 0.0516 | 0.1375 | PASS |
| `legend` | 1000 | 0.0000 | — | — | — | PASS |
| `candlelegend` | 1000 | 0.3211 | — | — | — | PASS |
| `legendhover` | 1000 | 0.0593 | — | — | — | PASS |
| `patternarea` | 1000 | 0.0002 | 0.0002 | 0.0541 | 0.1388 | PASS |
| `brush` | 1000 | 0.0001 | — | — | — | PASS |
| `projection` | 1000 | 0.0166 | 0.1435 | 0.0881 | 0.0540 | PASS |
| `projectionxdomain` | 1000 | 0.0724 | 0.0360 | 0.0360 | 0.0907 | PASS |
| `pie` | 1000 | 0.0138 | 0.0000 | 0.0000 | 0.0007 | PASS |
| `gauge` | 1000 | 0.0064 | 0.0064 | 0.0064 | 0.0064 | PASS |
| `gaugelinear` | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | PASS |
| `funnel` | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | PASS |
| `funnelvertical` | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | PASS |
| `ring` | 1000 | 0.0100 | 0.7161 | 0.2292 | 0.7351 | FAIL |
| `ring` | 4 | 0.0000 | 0.3111 | 0.3105 | 0.0142 | PASS |
| `griddefault` | 1000 | 0.0000 | 0.0000 | 0.0536 | 0.1422 | PASS |
| `arealoading` | 1000 | 0.0238 | 0.0619 | 0.0252 | 0.0324 | FAIL → **PASS** after harness fix |
| `linemultiaxis` | 1000 | 0.0000 | 0.0000 | 0.1249 | 0.1794 | PASS |
| `areamultiaxis` | 1000 | 0.0007 | 0.0003 | 0.0842 | 0.1869 | PASS |
| `scattermultiaxis` | 1000 | 0.2898 | 0.0001 | 0.0000 | 0.2736 | PASS |
| `composedmultiaxis` | 1000 | 0.0890 | 0.0478 | 0.0485 | 0.2209 | PASS |
| `refareamultiaxis` | 1000 | 0.1978 | 0.1827 | 0.2800 | 0.3767 | PASS |
| `bar` | 100 | 0.0000 | 0.0000 | 0.0757 | 0.0000 | PASS |
| `barmultiaxis` | 100 | 0.0000 | 0.0000 | 0.0745 | 0.0722 | PASS |
| `barsquares` | 100 | 0.0049 | 0.1364 | 0.1504 | 0.1486 | PASS |
| `bardepth` | 100 | 0.0030 | 0.0005 | 0.0454 | 0.0748 | PASS |
| `barloading` | 100 | 2.0031 | 16.5953 | 16.7929 | 16.8837 | FAIL |
| `composedstacked` | 100 | 0.0408 | 0.1152 | 0.1230 | 0.1172 | PASS |
| `markers` | 100 | 0.1100 | 0.3872 | 0.1823 | 0.3784 | PASS |
| `liveline` | 100 | 0.0167 | 0.0506 | 0.0827 | 0.1023 | PASS |
| `choropleth` | 100 | 0.0000 | 0.0000 | 0.1470 | 0.0000 | PASS |
| `heatmap` | 52 | 0.4277 | 0.3466 | 0.3533 | 0.4256 | PASS |
| `sankey` | 33 | 0.1101 | 0.3835 | 0.2782 | 0.1323 | PASS |
| `sunburst` | 27 | 0.0599 | 0.0780 | 0.1400 | 0.1466 | PASS |
| `sunburst` | 33 | 0.0599 | 0.0744 | 0.1046 | 0.0872 | PASS |
| `sunchrome` | 27 | 0.0677 | 0.0931 | 0.1548 | 0.1676 | PASS |
| `radar` | 6 | 0.0141 | 0.0128 | 0.0888 | 0.0141 | PASS |

**All three 4.4.1 baseline gate failures are resolved.** `pie` n=1000 — the phase's longest-standing unowned debt, hover-30/70 ~3.18% since 2026-08-21 and explicitly *not* owned by any Wave 1 package — now reads **0.0138 / 0.0000 / 0.0000 / 0.0007, PASS**. `choropleth`'s hover-30 1.5345% (migrated tooltip absent while bklit's fired) reads **0.0000% with both tooltips asserting** at the mandated n=100. `heatmap`'s marginal ready-state hover FAILs (0.5196/0.5218/0.5945%) read **0.3466/0.3533/0.4256%**. `sankey`, deferred out of the baseline with hover FAILs of 2.84/1.94/1.43%, reads **0.3835/0.2782/0.1323%** at n=33.

### P6.4 FAIL triage — all four, with the control that settled each

| fixture | numbers | verdict | evidence |
|---|---|---|---|
| `arealoading` n=1000 | all four captures PASS (<=0.0640%), `overall: FAIL` | **HARNESS GAP — fixed, now PASS** | The FAIL was the tooltip assertion alone, and it fired **symmetrically on A and B**. D331 control: `--self-test` (bklit vs bklit) scores **0.0000% on all four captures and still reports `overall: FAIL`** — an instrument that fails against itself. A loading skeleton has no data behind it, so neither impl renders a tooltip. `arealoading`/`barloading` added to `TOOLTIPLESS_CHARTS`; the pixel gate is untouched. Re-gate: **PASS**. |
| `barloading` n=100 | settled 1.8975%, hovers 16.55-17.13% | **NOT A PARITY GATE — by explicit prior design** | `bench/app/src/scenarios/bklit-barloading.tsx`'s own header says it: *"this pair is not expected to reach parity ... it exists to prove the new component mounts and paints, and to put a NUMBER on how far the two mechanisms land apart instead of asserting it."* D341 measured and explained the residual (d3 `.nice()` stretch + `paddingOuter` inset, irreducible without new API surface). Settled has **improved** since: **4.5259% -> 1.8975%**. Self-test is **0.0000% on all four captures**, so the instrument is clean and the hover numbers are real signal — and they are new information D341 did not have, because D341 measured settled only: per-impl movement from settled to hover-30 is **bklit 3.05% vs migrated 16.35%**, i.e. the two skeleton animations diverge over TIME, not merely in geometry. Recorded, not chased — the fixture is a measurement, not an assertion. |
| `ring` n=1000 | settled 0.0100%, hover-30 0.7161%, hover-70 0.7351% | **INVALID INSTRUMENT — D335, now corroborated structurally** | D335 already ruled ring n=1000 an invalid interaction gate on pixel evidence and named ring n=4 the gate of record; **`ring` n=4 PASSES (0.0000 / 0.3111 / 0.3105 / 0.0142)**. A DOM readback now corroborates the *reason* rather than just the verdict: at n=1000 **bklit holds 962 of its 975 transformed groups at `scale(0)`**, only ~13 segments tapering 0.998 -> 0.002, while migrated renders 40 groups all at exactly `scale(1)`. Neither side applies a >1 hover scale at capture time (max 1.0 both), so the 0.72% is **not** a hover-scale mismatch — it is which arcs happen to be visible and hit-testable in a stagger that never completes. Worth recording against D335: today's `--self-test` **passed** (max 0.0935%) where D335's failed, so the instrument is *marginal*, not reliably self-failing. The fixture is degenerate either way. |
| `candletween` n=1000 | settled 1.3619% (1.4408% on solo re-run) | **PIXEL-INVALID BY DESIGN — D330 §2** | This fixture deliberately captures **mid-reveal** (3000 ms tween against an 1100 ms settle timer -> a frame at ~37% of raw tween time). D330 §2 already ruled it **"gated by DOM readback (`qa/k4-tween-probe.mjs`), not pixels — framer-rAF vs WAAPI do not share a start instant, so a mid-flight diff measures scheduler skew."** Two independent confirmations: `--self-test` **FAILS at settled 0.1883%** (bklit vs bklit, against a 0.1% floor) and the two runs disagree (1.3619 vs 1.4408), so the capture is not deterministic; and the k4 probe reads **`animCount: 0` on bklit** (framer drives rAF, not WAAPI) against **200 on migrated** — the instrument cannot see bklit's animation at all. Gate of record, migrated side: **duration 1800 ms, easing `cubic-bezier(0.85, 0, 0.15, 1)`, 64 sampled frames, staggered delays 0 -> 21.6 ms** — a sampled tween on the declared curve, which is exactly K4's contract and not the spring it would show had K4 regressed. |

### P6.4 DOM probes

| probe | result |
|---|---|
| `qa/sb-chrome-probe.mjs` (sunburst breadcrumb + hint) | **PASS** — all four states (root / hovered / drilled / navigated) and all four presence assertions (trail, hover branch, multi-crumb trail, link/current split) |
| `qa/k4-tween-probe.mjs` (candlestick tween) | migrated runs the declared tween — see the `candletween` row above. bklit `animCount: 0` (framer rAF), so this probe reads one side only, by construction |
| `qa/reveal-probe.mjs` (sankey link reveal) | readback only, no assertions — 33 flows, each `{strokeDasharray+strokeDashoffset}` dur=1100 ease=`cubic-bezier(0.85, 0, 0.15, 1)`, delays 0.0 -> 561.3 ms |


### P6.4 bench — 10 exclusive paired cells, 2026-08-26

Run under D273 conditions: exclusive and quiet (`ps aux | grep -E "vite|playwright|chromium|node qa"` asserted **empty** before launch), every `migrated` cell paired with its own `bklit` control measured in the same quiet window. 8 runs per cell (1 warmup + 7 measured), medians below.

| chart | n | impl | M1a mount->paint | M1b settle | M1c script | M3a update | M3c per-move script | heap |
|---|---|---|---|---|---|---|---|---|
| line | 1000 | `bklit` (control) | 65.2 | 1163.7 | 80.4 | 31.7 | 1.3 | 5.0 MB |
| line | 1000 | **`migrated`** | **51.8** | **1115.5** | **76.7** | **32.5** | **0.6** | 5.2 MB |
| area | 1000 | `bklit` (control) | 63.0 | 1162.0 | 86.2 | 30.0 | 2.8 | 4.9 MB |
| area | 1000 | **`migrated`** | **47.3** | **1151.2** | **88.0** | **32.2** | **0.6** | 5.8 MB |
| composed | 1000 | `bklit` (control) | 78.4 | 1310.9 | 541.8 | 21.5 | 13.5 | 12.2 MB |
| composed | 1000 | **`migrated`** | **83.3** | **1664.8** | **123.8** | **32.2** | **0.9** | 6.8 MB |
| bar | 100 | `bklit` (control) | 68.3 | 1592.6 | 192.4 | 32.4 | 1.7 | 5.1 MB |
| bar | 100 | **`migrated`** | **38.3** | **1576.1** | **72.0** | **29.7** | **0.7** | 4.4 MB |
| scatter | 1000 | `bklit` (control) | 138.9 | 1300.2 | 593.4 | 32.2 | 1.5 | 8.1 MB |
| scatter | 1000 | **`migrated`** | **77.5** | **1258.6** | **141.1** | **28.8** | **0.7** | 5.3 MB |

**Control channel first (D273) — and M1a is VOID again.** Comparing each `bklit` control against the same control measured in earlier exclusive runs:

| channel | control drift | verdict |
|---|---|---|
| **M1a** | scatter **128.2 -> 138.9 = +8.3%** (vs D289's exclusive run); area **56.1 -> 63.0 = +12.3%** and line **59.9 -> 65.2 = +8.8%** (vs P6.1); bar -4.3%, composed -2.9% | **VOID** — over the +/-8% threshold on three of five charts. No M1a claim is made from this run. |
| M1b | line -0.03%, area +0.7%, composed -0.4%, bar -0.4% | **valid** |
| M1c | line +2.8%, area +4.1%, composed +2.3% | **valid** |
| M3a | bar 0.0%, line +1.0%, area -1.6%, composed +0.9% | **valid** |
| M3c | line 1.3 -> 1.3, area 2.8 -> 2.8, composed 13.7 -> 13.5 | **valid** |
| heap | line -5.7%, area -5.8%, composed -3.9% | **valid only for large gaps** — a <6% control drift cannot settle line's +0.2 MB or area's +0.9 MB, but does not touch composed's -44% or scatter's -35%. |

This is the **third consecutive run in which M1a is the void channel** (P6.1, P6.2, P6.4), which is itself the finding: M1a is not a stable channel on this machine and should not gate anything in Phase 5 without a fresh in-run control.

**What the valid channels say.** `migrated` is at or ahead of `bklit` on settle (M1b) everywhere except `composed`; script cost (M1c) is dramatically lower on the two heaviest fixtures — **composed 541.8 -> 123.8 ms (-77%)**, **scatter 593.4 -> 141.1 (-76%)**, **bar 192.4 -> 72.0 (-63%)** — and per-move script (M3c) is lower on every one of the five, most sharply **composed 13.5 -> 0.9 ms**. Heap is materially lower where it is large: **composed 12.2 -> 6.8 MB**, **scatter 8.1 -> 5.3 MB**.

**Two regressions stand, both on `composed`, both carried from P6.2 rather than new.** M1b **1310.9 -> 1664.8 ms (+27%)** and M3a **21.5 -> 32.2 ms (~1.5x)**. The M3a gap is the wider of the two and the one with a known shape: bklit's composed control sits at 21.5 ms while every other fixture on both impls clusters at 29-33 ms, i.e. bklit's composed update is the outlier low, not migrated's high. Not chased in Phase 4; carried to Phase 5 with the number on record.
