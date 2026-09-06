# Gate summary — 7.5 final gate f9580df

Run dir: `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z`. Generated 2026-09-06T14:12:54.431Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 0, ruled 2, harness FAIL 2, out-of-range 39, new values 39, tooltip failures 0, errors 0; 2 workers, wall-clock 5m25s (gate 4800 px)
- Bench: 29 cells (0 skipped); 9 flagged (±20% D273), console-error cells 0, tooltip-missing 0, failed invocations 0, wall-clock 44m18s
- Bundle: 43 pinned, FAIL 30, MISSING 0, measure-failed 0, Σgzip 6589104 vs Σpin 5605143 (+17.55%)
- Checks: tsc=ok, lint=ok, bench-tsc=ok, build=ok, unit=ok, census=ok, bundle-gate=ok
- Census: reach-in-guard exit 0, total 21, failures 0
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":4,"legend-hover-dim":4,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (66)

Classification only — the hypothesis column is intentionally empty for the fix owner.

hover-dim: 10 · legend: 5 · polar: 3 · axis: 2 · renderer-regime: 4 · motion/reveal: 3 · bench: 9 · bundle: 30

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:barsquares/100:hover-dim` | hover-dim | barsquares/100 | hover-30: 2479 px (out-of-range, mode 2353, hist [2353,2353])<br>hover-50: 2461 px (out-of-range, mode 2536, hist [2536,2536])<br>hover-70: 2614 px (out-of-range, mode 2633, hist [2633,2633]) | `qa/results/barsquares/2026-09-06T13-03-34-468Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/barsquares-100.log`<br>`qa/results/barsquares/2026-09-06T13-03-34-468Z/hover-50-diff.png`<br>`qa/results/barsquares/2026-09-06T13-03-34-468Z/hover-70-diff.png` |  |
| `qa:barsquares/100:legend` | legend | barsquares/100 | legend-hover-0: 2031 px (out-of-range, mode 1903, hist [1903,1903])<br>legend-hover-1: 2094 px (out-of-range, mode 1966, hist [1966,1966])<br>legend-hover-clear: 2027 px (out-of-range, mode 1899, hist [1899,1899]) | `qa/results/barsquares/2026-09-06T13-03-34-468Z/legend-hover-0-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/barsquares-100.log`<br>`qa/results/barsquares/2026-09-06T13-03-34-468Z/legend-hover-1-diff.png`<br>`qa/results/barsquares/2026-09-06T13-03-34-468Z/legend-hover-clear-diff.png` |  |
| `qa:pie/1000:polar` | polar | pie/1000 | settled: 397 px (out-of-range, mode 398, hist [398,398]) | `qa/results/pie/2026-09-06T13-06-53-057Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/pie-1000.log` |  |
| `qa:gauge/1000:polar` | polar | gauge/1000 | settled: 207 px (out-of-range, mode 212, hist [212,212])<br>hover-30: 207 px (out-of-range, mode 212, hist [212,212])<br>hover-50: 207 px (out-of-range, mode 212, hist [212,212])<br>hover-70: 207 px (out-of-range, mode 212, hist [212,212]) | `qa/results/gauge/2026-09-06T13-06-02-525Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/gauge-1000.log`<br>`qa/results/gauge/2026-09-06T13-06-02-525Z/hover-30-diff.png`<br>`qa/results/gauge/2026-09-06T13-06-02-525Z/hover-50-diff.png`<br>`qa/results/gauge/2026-09-06T13-06-02-525Z/hover-70-diff.png` |  |
| `qa:markers/100:axis` | axis | markers/100 | settled: 1215 px (out-of-range, mode 1210, hist [1210,1210]) | `qa/results/markers/2026-09-06T13-06-35-477Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/markers-100.log` |  |
| `qa:liveline/100:axis` | axis | liveline/100 | settled: 1778 px (out-of-range, mode 1662, hist [1662,1662]) | `qa/results/liveline/2026-09-06T13-06-47-987Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/liveline-100.log` |  |
| `qa:liveline/100:hover-dim` | hover-dim | liveline/100 | hover-30: 3359 px (out-of-range, mode 3009, hist [3009,3009])<br>hover-50: 3465 px (out-of-range, mode 3330, hist [3330,3330])<br>hover-70: 3647 px (out-of-range, mode 3401, hist [3401,3401]) | `qa/results/liveline/2026-09-06T13-06-47-987Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/liveline-100.log`<br>`qa/results/liveline/2026-09-06T13-06-47-987Z/hover-50-diff.png`<br>`qa/results/liveline/2026-09-06T13-06-47-987Z/hover-70-diff.png` |  |
| `qa:bar/100:hover-dim` | hover-dim | bar/100 | hover-30: 3413 px (out-of-range, mode 3376, hist [3376,3376]) | `qa/results/bar/2026-09-06T13-07-08-102Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/bar-100.log` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-50: 1905 px (out-of-range, mode 1853, hist [1853,1853]) | `qa/results/scatter/2026-09-06T13-07-17-350Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/scatter-1000.log` |  |
| `qa:composedmultiaxis/1000:renderer-regime` | renderer-regime | composedmultiaxis/1000 | hover-50: 2462 px (out-of-range, mode 2463, hist [2463,2463])<br>hover-70: 3117 px (out-of-range, mode 3115, hist [3115,3115]) | `qa/results/composedmultiaxis/2026-09-06T13-07-18-618Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/composedmultiaxis-1000.log`<br>`qa/results/composedmultiaxis/2026-09-06T13-07-18-618Z/hover-70-diff.png` |  |
| `qa:composed/1000:renderer-regime` | renderer-regime | composed/1000 | hover-50: 1963 px (out-of-range, mode 2089, hist [2089,2089])<br>hover-70: 2515 px (out-of-range, mode 2514, hist [2514,2514]) | `qa/results/composed/2026-09-06T13-07-23-775Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/composed-1000.log`<br>`qa/results/composed/2026-09-06T13-07-23-775Z/hover-70-diff.png` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-70: 1856 px (out-of-range, mode 1835, hist [1835,1835]) | `qa/results/scattermultiaxis/2026-09-06T13-07-28-043Z/hover-70-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/scattermultiaxis-1000.log` |  |
| `qa:bardepth/100:motion/reveal` | motion/reveal | bardepth/100 | depth-off: 1415 px (out-of-range, mode 1432, hist [1432,1432])<br>depth-on: 1498 px (out-of-range, mode 1477, hist [1477,1477]) | `qa/results/bardepth/2026-09-06T13-07-41-143Z/depth-off-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/bardepth-100.log`<br>`qa/results/bardepth/2026-09-06T13-07-41-143Z/depth-on-diff.png` |  |
| `qa:ring/4:polar` | polar | ring/4 | hover-30: 2925 px (out-of-range, mode 2887, hist [2887,2887])<br>hover-50: 2520 px (out-of-range, mode 2506, hist [2506,2506])<br>hover-70: 2570 px (out-of-range, mode 2633, hist [2633,2633]) | `qa/results/ring/2026-09-06T13-08-04-444Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/ring-4.log`<br>`qa/results/ring/2026-09-06T13-08-04-444Z/hover-50-diff.png`<br>`qa/results/ring/2026-09-06T13-08-04-444Z/hover-70-diff.png` |  |
| `qa:arealoading/1000:motion/reveal` | motion/reveal | arealoading/1000 | settled: 724 px (out-of-range, mode 726, hist [726,726])<br>hover-30: 665 px (out-of-range, mode 632, hist [632,632])<br>hover-50: 470 px (out-of-range, mode 514, hist [514,514])<br>hover-70: 425 px (out-of-range, mode 383, hist [383,383]) | `qa/results/arealoading/2026-09-06T13-08-08-776Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/arealoading-1000.log`<br>`qa/results/arealoading/2026-09-06T13-08-08-776Z/hover-30-diff.png`<br>`qa/results/arealoading/2026-09-06T13-08-08-776Z/hover-50-diff.png`<br>`qa/results/arealoading/2026-09-06T13-08-08-776Z/hover-70-diff.png` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-50: 3311 px (out-of-range, mode 2965, hist [2965,2965])<br>hover-70: 4633 px (out-of-range, mode 4384, hist [4384,4384]) | `qa/results/sankey/2026-09-06T13-08-16-991Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/sankey-33.log`<br>`qa/results/sankey/2026-09-06T13-08-16-991Z/hover-70-diff.png` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | hover-50: 2234 px (out-of-range, mode 1854, hist [1854,1854]) | `qa/results/barloading/2026-09-06T13-08-30-312Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/barloading-100.log` |  |
| `qa:profitloss/1000:hover-dim` | hover-dim | profitloss/1000 | hover-50: 1289 px (out-of-range, mode 1288, hist [1288,1288]) | `qa/results/profitloss/2026-09-06T13-08-36-132Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/profitloss-1000.log` |  |
| `qa:projection/1000:hover-dim` | hover-dim | projection/1000 | hover-30: 1621 px (out-of-range, mode 1655, hist [1655,1655]) | `qa/results/projection/2026-09-06T13-08-41-843Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/logs/qa/projection-1000.log` |  |
| `bench:bklit/line/10000:m1c_scriptMs` | bench | bklit/line/10000 | m1c_scriptMs: 99.56 vs baseline 126.71 (-21.4%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:tanstack/line/1000:m1b_settleMs` | bench | tanstack/line/1000 | m1b_settleMs: 53.6 vs baseline 70.6 (-24.1%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:migrated/line/1000:m1c_scriptMs` | bench | migrated/line/1000 | m1c_scriptMs: 112.81 vs baseline 76.7 (+47.1%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:migrated/area/1000:m1c_scriptMs` | bench | migrated/area/1000 | m1c_scriptMs: 123.8 vs baseline 88 (+40.7%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:migrated/composed/1000:m1b_settleMs` | bench | migrated/composed/1000 | m1b_settleMs: 1194.8 vs baseline 1664.8 (-28.2%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:migrated/composed/1000:m1c_scriptMs` | bench | migrated/composed/1000 | m1c_scriptMs: 154.14 vs baseline 123.8 (+24.5%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:migrated/bar/100:m1c_scriptMs` | bench | migrated/bar/100 | m1c_scriptMs: 92.62 vs baseline 72 (+28.6%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:migrated/scatter/1000:m1b_settleMs` | bench | migrated/scatter/1000 | m1b_settleMs: 2504.6 vs baseline 1258.6 (+99%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bench:migrated/scatter/1000:m3a_updateMs` | bench | migrated/scatter/1000 | m3a_updateMs: 35.8 vs baseline 28.8 (+24.3%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bench.json`<br>`bench/results/2026-09-06T14-04-53-375Z`<br>`bench/results/2026-09-06T14-06-21-026Z` |  |
| `bundle:migrated/area` | bundle | migrated/area | FAIL: gzip 173167 vs pin 168043 (limit 173084, +3.05%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/areamultiaxis` | bundle | migrated/areamultiaxis | FAIL: gzip 173270 vs pin 168116 (limit 173159, +3.07%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/bar` | bundle | migrated/bar | FAIL: gzip 160473 vs pin 134546 (limit 138582, +19.27%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/bardepth` | bundle | migrated/bardepth | FAIL: gzip 160710 vs pin 134747 (limit 138789, +19.27%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barloading` | bundle | migrated/barloading | FAIL: gzip 83837 vs pin 2449 (limit 2522, +3323.32%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barmultiaxis` | bundle | migrated/barmultiaxis | FAIL: gzip 160512 vs pin 134603 (limit 138641, +19.25%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barsquares` | bundle | migrated/barsquares | FAIL: gzip 172846 vs pin 146726 (limit 151128, +17.8%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candlestick` | bundle | migrated/candlestick | FAIL: gzip 154222 vs pin 127176 (limit 130991, +21.27%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candlestick-legend` | bundle | migrated/candlestick-legend | FAIL: gzip 165161 vs pin 137813 (limit 141947, +19.84%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candletween` | bundle | migrated/candletween | FAIL: gzip 154292 vs pin 127244 (limit 131061, +21.26%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/choropleth` | bundle | migrated/choropleth | FAIL: gzip 152133 vs pin 119026 (limit 122597, +27.81%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composed` | bundle | migrated/composed | FAIL: gzip 164871 vs pin 140194 (limit 144400, +17.6%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composedmultiaxis` | bundle | migrated/composedmultiaxis | FAIL: gzip 164933 vs pin 140253 (limit 144461, +17.6%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composedstacked` | bundle | migrated/composedstacked | FAIL: gzip 164857 vs pin 140180 (limit 144385, +17.6%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/funnel` | bundle | migrated/funnel | FAIL: gzip 128336 vs pin 48669 (limit 50129, +163.69%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/funnelvertical` | bundle | migrated/funnelvertical | FAIL: gzip 128353 vs pin 48688 (limit 50149, +163.62%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/gauge` | bundle | migrated/gauge | FAIL: gzip 145019 vs pin 104637 (limit 107776, +38.59%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/gaugelinear` | bundle | migrated/gaugelinear | FAIL: gzip 145121 vs pin 104744 (limit 107886, +38.55%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/heatmap` | bundle | migrated/heatmap | FAIL: gzip 141906 vs pin 105621 (limit 108790, +34.35%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/legendhover` | bundle | migrated/legendhover | FAIL: gzip 196855 vs pin 174096 (limit 179319, +13.07%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/liveline` | bundle | migrated/liveline | FAIL: gzip 152803 vs pin 125519 (limit 129285, +21.74%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/patternarea` | bundle | migrated/patternarea | FAIL: gzip 173236 vs pin 168100 (limit 173143, +3.06%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/pie` | bundle | migrated/pie | FAIL: gzip 131765 vs pin 92430 (limit 95203, +42.56%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/radar` | bundle | migrated/radar | FAIL: gzip 134400 vs pin 103613 (limit 106721, +29.71%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/ring` | bundle | migrated/ring | FAIL: gzip 141569 vs pin 102295 (limit 105364, +38.39%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sankey` | bundle | migrated/sankey | FAIL: gzip 143750 vs pin 104293 (limit 107422, +37.83%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/scatter` | bundle | migrated/scatter | FAIL: gzip 152744 vs pin 126075 (limit 129857, +21.15%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/scattermultiaxis` | bundle | migrated/scattermultiaxis | FAIL: gzip 152763 vs pin 126095 (limit 129878, +21.15%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sunburst` | bundle | migrated/sunburst | FAIL: gzip 140576 vs pin 99807 (limit 102801, +40.85%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sunchrome` | bundle | migrated/sunchrome | FAIL: gzip 141388 vs pin 100467 (limit 103481, +40.73%) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |
| `probe:hover-lag:pie/1000` | hover-dim | pie/1000 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |
| `probe:hover-lag:sankey/33` | hover-dim | sankey/33 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |
| `probe:hover-lag:liveline/100` | hover-dim | liveline/100 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |
| `probe:legend-hover-dim:legendhover/1000` | legend | legendhover/1000 | item-0: dim presence mismatch (bklit +2, migrated +0)<br>item-0: bklit does not fully undim (0 -> 2)<br>item-1: dim presence mismatch (bklit +998, migrated +0)<br>item-1: bklit does not fully undim (2 -> 0)<br>item-1: migrated does not fully undim (1000 -> 0) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |
| `probe:legend-hover-dim:candlelegend/1000` | legend | candlelegend/1000 | item-0: dim presence mismatch (bklit +511, migrated +0)<br>item-0: migrated does not fully undim (1533 -> 0)<br>item-1: dim presence mismatch (bklit +489, migrated +0)<br>item-1: migrated does not fully undim (1465 -> 0) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: dim presence mismatch (bklit +1, migrated +0)<br>item-0: bklit does not fully undim (3 -> 4)<br>item-1: dim presence mismatch (bklit +1, migrated +0)<br>item-1: bklit does not fully undim (4 -> 3)<br>item-1: migrated does not fully undim (1 -> 0) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |
| `probe:legend-hover-dim:barsquares/100` | legend | barsquares/100 | item-0: bklit does not fully undim (200 -> 4211)<br>item-0: migrated does not fully undim (0 -> 200)<br>item-1: dim presence mismatch (bklit +0, migrated +6915)<br>item-1: bklit does not fully undim (200 -> 6915)<br>item-1: migrated does not fully undim (0 -> 200) | `docs/phase-7/gate/runs/2026-09-06T13-02-53-709Z/probes.json` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| barsquares | 100 | hover-30 | 2479 | [2353,2353] | 2353 |
| barsquares | 100 | hover-50 | 2461 | [2536,2536] | 2536 |
| barsquares | 100 | hover-70 | 2614 | [2633,2633] | 2633 |
| barsquares | 100 | legend-hover-0 | 2031 | [1903,1903] | 1903 |
| barsquares | 100 | legend-hover-1 | 2094 | [1966,1966] | 1966 |
| barsquares | 100 | legend-hover-clear | 2027 | [1899,1899] | 1899 |
| pie | 1000 | settled | 397 | [398,398] | 398 |
| gauge | 1000 | settled | 207 | [212,212] | 212 |
| gauge | 1000 | hover-30 | 207 | [212,212] | 212 |
| gauge | 1000 | hover-50 | 207 | [212,212] | 212 |
| gauge | 1000 | hover-70 | 207 | [212,212] | 212 |
| markers | 100 | settled | 1215 | [1210,1210] | 1210 |
| liveline | 100 | settled | 1778 | [1662,1662] | 1662 |
| liveline | 100 | hover-30 | 3359 | [3009,3009] | 3009 |
| liveline | 100 | hover-50 | 3465 | [3330,3330] | 3330 |
| liveline | 100 | hover-70 | 3647 | [3401,3401] | 3401 |
| bar | 100 | hover-30 | 3413 | [3376,3376] | 3376 |
| scatter | 1000 | hover-50 | 1905 | [1853,1853] | 1853 |
| composedmultiaxis | 1000 | hover-50 | 2462 | [2463,2463] | 2463 |
| composedmultiaxis | 1000 | hover-70 | 3117 | [3115,3115] | 3115 |
| composed | 1000 | hover-50 | 1963 | [2089,2089] | 2089 |
| composed | 1000 | hover-70 | 2515 | [2514,2514] | 2514 |
| scattermultiaxis | 1000 | hover-70 | 1856 | [1835,1835] | 1835 |
| bardepth | 100 | depth-off | 1415 | [1432,1432] | 1432 |
| bardepth | 100 | depth-on | 1498 | [1477,1477] | 1477 |
| ring | 4 | hover-30 | 2925 | [2887,2887] | 2887 |
| ring | 4 | hover-50 | 2520 | [2506,2506] | 2506 |
| ring | 4 | hover-70 | 2570 | [2633,2633] | 2633 |
| arealoading | 1000 | settled | 724 | [726,726] | 726 |
| arealoading | 1000 | hover-30 | 665 | [632,632] | 632 |
| arealoading | 1000 | hover-50 | 470 | [514,514] | 514 |
| arealoading | 1000 | hover-70 | 425 | [383,383] | 383 |
| sankey | 33 | hover-50 | 3311 | [2965,2965] | 2965 |
| sankey | 33 | hover-70 | 4633 | [4384,4384] | 4384 |
| barloading | 100 | hover-50 | 2234 | [1854,1854] | 1854 |
| profitloss | 1000 | hover-50 | 1289 | [1288,1288] | 1288 |
| projection | 1000 | hover-30 | 1621 | [1655,1655] | 1655 |
