# Gate summary — final-gate

Run dir: `docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z`. Generated 2026-09-02T21:10:44.932Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 13, harness FAIL 13, out-of-range 5, new values 58, tooltip failures 0, errors 0; 4 workers, wall-clock 8m40s (gate 4800 px)
- Bench: 29 cells (0 skipped); 2 flagged (±20% D273), console-error cells 0, tooltip-missing 0, failed invocations 0, wall-clock 43m51s
- Bundle: 43 pinned, FAIL 0, MISSING 0, measure-failed 0, Σgzip 5360432 vs Σpin 5296797 (+1.2%)
- Checks: tsc=ok, build=ok, lint=ok, census=ok, bundle-gate=ok
- Census: reach-in-guard exit 0, total 79, failures 0
- Probes: not run

## Issues (11)

Classification only — the hypothesis column is intentionally empty for the fix owner.

hover-dim: 2 · legend: 1 · motion/reveal: 1 · harness-race: 1 · renderer-regime: 3 · polar: 1 · bench: 2

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:markers/100:hover-dim` | hover-dim | markers/100 | hover-30: 6045 px (seen, mode 3717, hist [3574,15483])<br>hover-70: 6147 px (in-range, mode 3633, hist [3328,15251]) | `qa/results/markers/2026-09-02T20-10-03-977Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T20-10-03-977Z/hover-70-diff.png` |  |
| `qa:markers/100:legend` | legend | markers/100 | legend-hover-0: 4969 px (in-range, mode 4967, hist [3756,18168])<br>legend-hover-1: 5116 px (seen, mode 3757, hist [3729,17740])<br>legend-hover-clear: 5742 px (seen, mode 3755, hist [3731,16612]) | `qa/results/markers/2026-09-02T20-10-03-977Z/legend-hover-0-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T20-10-03-977Z/legend-hover-1-diff.png`<br>`qa/results/markers/2026-09-02T20-10-03-977Z/legend-hover-clear-diff.png` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | settled: 18839 px (in-range, mode 18216, hist [18124,51852])<br>hover-30: 161310 px (in-range, mode 158874, hist [158874,161541])<br>hover-50: 167154 px (out-of-range, mode 161336, hist [133147,161353])<br>hover-70: 143013 px (in-range, mode 161542, hist [132903,164456]) | `qa/results/barloading/2026-09-02T20-10-24-100Z/settled-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/barloading-100.log`<br>`qa/results/barloading/2026-09-02T20-10-24-100Z/hover-30-diff.png`<br>`qa/results/barloading/2026-09-02T20-10-24-100Z/hover-50-diff.png`<br>`qa/results/barloading/2026-09-02T20-10-24-100Z/hover-70-diff.png` |  |
| `qa:candlestick/1000:harness-race` | harness-race | candlestick/1000 | hover-30: 1848 px (out-of-range, mode 4764, hist [1877,7343]) | `qa/results/candlestick/2026-09-02T20-10-49-642Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/candlestick-1000.log` |  |
| `qa:candlestick/1000:renderer-regime` | renderer-regime | candlestick/1000 | hover-50: 689 px (out-of-range, mode 3515, hist [818,6302])<br>hover-70: 591 px (out-of-range, mode 3482, hist [729,6172]) | `qa/results/candlestick/2026-09-02T20-10-49-642Z/hover-50-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/candlestick-1000.log`<br>`qa/results/candlestick/2026-09-02T20-10-49-642Z/hover-70-diff.png` |  |
| `qa:radar/6:polar` | polar | radar/6 | hover-50: 757 px (out-of-range, mode 852, hist [758,6547]) | `qa/results/radar/2026-09-02T20-12-07-138Z/hover-50-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/radar-6.log` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-30: 11017 px (in-range, mode 3690, hist [3506,31888])<br>hover-70: 5021 px (in-range, mode 1761, hist [1270,11636]) | `qa/results/sankey/2026-09-02T20-12-20-057Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/sankey-33.log`<br>`qa/results/sankey/2026-09-02T20-12-20-057Z/hover-70-diff.png` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-70: 6274 px (in-range, mode 2847, hist [2018,143608]) | `qa/results/scatter/2026-09-02T20-12-23-689Z/hover-70-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/scatter-1000.log` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-70: 6349 px (in-range, mode 2123, hist [2123,129924]) | `qa/results/scattermultiaxis/2026-09-02T20-12-27-852Z/hover-70-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/logs/qa/scattermultiaxis-1000.log` |  |
| `bench:bklit/line/10000:m1c_scriptMs` | bench | bklit/line/10000 | m1c_scriptMs: 94.34 vs baseline 126.71 (-25.5%) | `docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/bench.json`<br>`bench/results/2026-09-02T20-57-15-846Z`<br>`bench/results/2026-09-02T20-58-34-397Z` |  |
| `bench:migrated/scatter/1000:m1c_scriptMs` | bench | migrated/scatter/1000 | m1c_scriptMs: 111.31 vs baseline 141.1 (-21.1%) | `docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z/bench.json`<br>`bench/results/2026-09-02T20-57-15-846Z`<br>`bench/results/2026-09-02T20-58-34-397Z` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| candlestick | 1000 | hover-30 | 1848 | [1877,7343] | 4764 |
| candlestick | 1000 | hover-50 | 689 | [818,6302] | 3515 |
| candlestick | 1000 | hover-70 | 591 | [729,6172] | 3482 |
| radar | 6 | hover-50 | 757 | [758,6547] | 852 |

## Rulings (2026-09-02, 6.5 close)

Every issue above was ruled by hand against the Phase-5 final matrix and the inherited history — none is a regression:
QA cells → **D498** (`docs/phase-6/BENCHMARKS.md` §3.2, per-cell table); the five out-of-range cells are *below* floor
(candlestick D495, radar D493). Bench flags → **D500** (both speed-ups; legacy-arm console-error / tooltip baselines
corrected in `qa/gate/bench-baseline.json`). Bundle → **D499**. Checks → **D501**. Carried to Phase 7 → **D502**.
