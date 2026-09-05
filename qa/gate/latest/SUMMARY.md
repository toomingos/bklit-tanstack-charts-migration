# Gate summary — V0.3 baseline @ 61d6179 (frozen worktree)

Run dir: `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z`. Generated 2026-09-05T12:16:23.643Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 6, harness FAIL 6, out-of-range 0, new values 189, tooltip failures 0, errors 0; 4 workers, wall-clock 10m50s (gate 4800 px)
- Bench: 10 cells (0 skipped); 2 flagged (±20% D273), console-error cells 0, tooltip-missing 0, failed invocations 0, wall-clock 14m09s
- Bundle: 43 pinned, FAIL 0, MISSING 0, measure-failed 0, Σgzip 5605143 vs Σpin 5605143 (0%)
- Checks: tsc=ok, build=ok, lint=FAIL(1), census=FAIL(1), bundle-gate=ok
- Census: reach-in-guard exit 1, total 67, failures 17
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":5,"legend-hover-dim":4,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (16)

Classification only — the hypothesis column is intentionally empty for the fix owner.

hover-dim: 6 · motion/reveal: 1 · bench: 2 · checks: 1 · census: 1 · tooltip: 1 · legend: 4

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:markers/100:hover-dim` | hover-dim | markers/100 | hover-30: 4847 px (no-history)<br>hover-70: 4912 px (no-history) | `qa/results/markers/2026-09-05T11-25-31-176Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-05T11-25-31-176Z/hover-70-diff.png` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | hover-50: 53588 px (no-history)<br>hover-70: 33734 px (no-history) | `qa/results/barloading/2026-09-05T11-25-50-479Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/logs/qa/barloading-100.log`<br>`qa/results/barloading/2026-09-05T11-25-50-479Z/hover-70-diff.png` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-30: 8377 px (no-history)<br>hover-70: 7367 px (no-history) | `qa/results/sankey/2026-09-05T11-27-44-593Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/logs/qa/sankey-33.log`<br>`qa/results/sankey/2026-09-05T11-27-44-593Z/hover-70-diff.png` |  |
| `bench:migrated/line/1000:m1c_scriptMs` | bench | migrated/line/1000 | m1c_scriptMs: 95.61 vs baseline 76.7 (+24.7%) | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/bench.json`<br>`bench/results/2026-09-05T11-57-21-194Z`<br>`bench/results/2026-09-05T11-58-40-323Z` |  |
| `bench:migrated/scatter/1000:m3a_updateMs` | bench | migrated/scatter/1000 | m3a_updateMs: 22.9 vs baseline 28.8 (-20.5%) | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/bench.json`<br>`bench/results/2026-09-05T11-57-21-194Z`<br>`bench/results/2026-09-05T11-58-40-323Z` |  |
| `checks:lint` | checks | — | npx oxlint --type-aware --format=json migrated packages/migrated-charts exit 1 {"problems":7,"errors":7,"warnings":0,"topRules":[["typescript(no-unsafe-type-assertion)",2],["typescript(no-deprecated)",2],["anti-slop(no-reflect-get)",1],["sonarjs(variable-name)",1],["eslint(sort-keys)",1]]} | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/logs/checks/lint.log` |  |
| `census` | census | — | node scripts/reach-in-guard.mjs --json exit 1 {"total":67,"files":21,"failures":17} | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/logs/checks/census.log` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:hover-lag:scatter/1000` | hover-dim | scatter/1000 | dim-lag>200ms | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:hover-lag:candlestick/1000` | tooltip | candlestick/1000 | tooltip-lag>200ms | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:hover-lag:pie/1000` | hover-dim | pie/1000 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:hover-lag:sankey/33` | hover-dim | sankey/33 | dim-presence-mismatch<br>settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:legend-hover-dim:legendhover/1000` | legend | legendhover/1000 | item-0: dim presence mismatch (bklit +2, migrated +0)<br>item-0: bklit does not fully undim (0 -> 2)<br>item-1: dim presence mismatch (bklit +998, migrated +0)<br>item-1: bklit does not fully undim (2 -> 0)<br>item-1: migrated does not fully undim (1000 -> 0) | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:legend-hover-dim:candlelegend/1000` | legend | candlelegend/1000 | item-0: dimmed count differs >25% (bklit +511, migrated +1533)<br>item-1: dimmed count differs >25% (bklit +489, migrated +1465) | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: bklit does not fully undim (3 -> 4)<br>item-0: migrated does not fully undim (0 -> 2)<br>item-1: bklit does not fully undim (4 -> 3)<br>item-1: migrated does not fully undim (1 -> 2) | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |
| `probe:legend-hover-dim:barsquares/100` | legend | barsquares/100 | item-0: dim presence mismatch (bklit +4011, migrated +0)<br>item-0: bklit does not fully undim (200 -> 4211)<br>item-0: migrated does not fully undim (4211 -> 200)<br>item-1: dim presence mismatch (bklit +6715, migrated +0)<br>item-1: bklit does not fully undim (200 -> 6915)<br>item-1: migrated does not fully undim (6915 -> 200) | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z/probes.json` |  |

## QA cells that changed status vs history (not failing)

none
