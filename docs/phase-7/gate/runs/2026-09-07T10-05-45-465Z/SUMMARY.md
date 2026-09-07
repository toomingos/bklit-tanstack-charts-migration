# Gate summary — Gate 2: close (items 7-9 landed)

Run dir: `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z`. Generated 2026-09-07T10:55:17.483Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 1, ruled 3, harness FAIL 4, out-of-range 0, new values 50, tooltip failures 0, errors 0; 4 workers, wall-clock 3m03s (gate 4800 px)
- Bench: 29 cells (0 skipped); 4 flagged (±20% D273), console-error cells 2, tooltip-missing 1, failed invocations 0, wall-clock 44m38s
- Bundle: 43 pinned, FAIL 0, MISSING 0, measure-failed 0, Σgzip 6597552 vs Σpin 6597552 (0%)
- Checks: tsc=ok, lint=ok, bench-tsc=ok, build=ok, unit=ok, census=ok, bundle-gate=skipped
- Census: reach-in-guard exit 0, total 23, failures 0
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":4,"legend-hover-dim":4,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (16)

Classification only — the hypothesis column is intentionally empty for the fix owner.

motion/reveal: 1 · bench: 7 · hover-dim: 4 · legend: 4

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | settled: 22041 px (in-range, mode 18216, hist [0,51852]) | `qa/results/barloading/2026-09-07T10-09-11-162Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/logs/qa/barloading-100.log` |  |
| `bench:bklit/line/1000:m3c_tooltipAppeared` | bench | bklit/line/1000 | m3c_tooltipAppeared: false vs baseline true | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/bench.json`<br>`bench/results/2026-09-07T10-47-26-662Z`<br>`bench/results/2026-09-07T10-48-54-393Z` |  |
| `bench:bklit/bar/1000:consoleErrorCount` | bench | bklit/bar/1000 | consoleErrorCount: 503196 vs baseline 0 | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/bench.json`<br>`bench/results/2026-09-07T10-47-26-662Z`<br>`bench/results/2026-09-07T10-48-54-393Z` |  |
| `bench:bklit/bar/10000:consoleErrorCount` | bench | bklit/bar/10000 | consoleErrorCount: 1540000 vs baseline 0 | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/bench.json`<br>`bench/results/2026-09-07T10-47-26-662Z`<br>`bench/results/2026-09-07T10-48-54-393Z` |  |
| `bench:tanstack/bar/100:m1b_settleMs` | bench | tanstack/bar/100 | m1b_settleMs: 38.5 vs baseline 52.2 (-26.2%) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/bench.json`<br>`bench/results/2026-09-07T10-47-26-662Z`<br>`bench/results/2026-09-07T10-48-54-393Z` |  |
| `bench:tanstack/scatter/1000:m1b_settleMs` | bench | tanstack/scatter/1000 | m1b_settleMs: 153.8 vs baseline 98.2 (+56.6%) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/bench.json`<br>`bench/results/2026-09-07T10-47-26-662Z`<br>`bench/results/2026-09-07T10-48-54-393Z` |  |
| `bench:tanstack/scatter/1000:m1c_scriptMs` | bench | tanstack/scatter/1000 | m1c_scriptMs: 125.76 vs baseline 101.27 (+24.2%) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/bench.json`<br>`bench/results/2026-09-07T10-47-26-662Z`<br>`bench/results/2026-09-07T10-48-54-393Z` |  |
| `bench:migrated/scatter/1000:m1b_settleMs` | bench | migrated/scatter/1000 | m1b_settleMs: 2504.7 vs baseline 1258.6 (+99%) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/bench.json`<br>`bench/results/2026-09-07T10-47-26-662Z`<br>`bench/results/2026-09-07T10-48-54-393Z` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |
| `probe:hover-lag:pie/1000` | hover-dim | pie/1000 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |
| `probe:hover-lag:sankey/33` | hover-dim | sankey/33 | dim-presence-mismatch<br>settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |
| `probe:hover-lag:liveline/100` | hover-dim | liveline/100 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |
| `probe:legend-hover-dim:legendhover/1000` | legend | legendhover/1000 | item-0: dim presence mismatch (bklit +2, migrated +0)<br>item-1: dim presence mismatch (bklit +1000, migrated +0)<br>item-1: migrated does not fully undim (1000 -> 0) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |
| `probe:legend-hover-dim:candlelegend/1000` | legend | candlelegend/1000 | item-0: dim presence mismatch (bklit +511, migrated +0)<br>item-0: migrated does not fully undim (1533 -> 0)<br>item-1: dim presence mismatch (bklit +489, migrated +0)<br>item-1: migrated does not fully undim (1465 -> 0) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: bklit does not fully undim (6 -> 4)<br>item-1: dim presence mismatch (bklit +1, migrated +0)<br>item-1: bklit does not fully undim (4 -> 3)<br>item-1: migrated does not fully undim (1 -> 0) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |
| `probe:legend-hover-dim:barsquares/100` | legend | barsquares/100 | item-0: migrated does not fully undim (0 -> 200)<br>item-1: migrated does not fully undim (0 -> 200) | `docs/phase-7/gate/runs/2026-09-07T10-05-45-465Z/probes.json` |  |

## QA cells that changed status vs history (not failing)

none
