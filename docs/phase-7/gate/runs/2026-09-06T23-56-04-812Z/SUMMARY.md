# Gate summary — 7.5 gate: probes vector + pulse port (4ee2ef6)

Run dir: `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z`. Generated 2026-09-07T00:43:49.260Z.

## Headline

- QA: 43 runs / 184 cells; gate FAIL 5, ruled 3, harness FAIL 8, out-of-range 16, new values 126, tooltip failures 0, errors 1; 4 workers, wall-clock 2m57s (gate 4800 px)
- Bench: 10 cells (0 skipped); 7 flagged (±20% D273), console-error cells 0, tooltip-missing 0, failed invocations 0, wall-clock 43m14s
- Bundle: 43 pinned, FAIL 30, MISSING 0, measure-failed 0, Σgzip 6597550 vs Σpin 5605143 (+17.71%)
- Checks: tsc=ok, lint=ok, bench-tsc=ok, build=ok, unit=ok, census=FAIL(1), bundle-gate=skipped
- Census: reach-in-guard exit 1, total 23, failures 1
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":4,"legend-hover-dim":4,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (58)

Classification only — the hypothesis column is intentionally empty for the fix owner.

polar: 5 · renderer-regime: 2 · harness-race: 1 · brush/zoom: 1 · motion/reveal: 2 · axis: 1 · bench: 7 · bundle: 30 · census: 1 · hover-dim: 4 · legend: 4

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:sunburst/33:polar` | polar | sunburst/33 | settled: 583 px (out-of-range, mode 575, hist [575,581]) | `qa/results/sunburst/2026-09-06T23-58-15-822Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/sunburst-33.log` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-70: 1889 px (out-of-range, mode 2847, hist [2018,143608]) | `qa/results/scatter/2026-09-06T23-58-18-537Z/hover-70-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/scatter-1000.log` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-70: 1835 px (out-of-range, mode 6349, hist [2123,129924]) | `qa/results/scattermultiaxis/2026-09-06T23-58-33-377Z/hover-70-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/scattermultiaxis-1000.log` |  |
| `qa:sunburst/27:polar` | polar | sunburst/27 | settled: 577 px (out-of-range, mode 575, hist [575,576]) | `qa/results/sunburst/2026-09-06T23-58-34-630Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/sunburst-27.log` |  |
| `qa:sunchrome/27:polar` | polar | sunchrome/27 | settled: 652 px (out-of-range, mode 651, hist [650,651]) | `qa/results/sunchrome/2026-09-06T23-58-43-208Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/sunchrome-27.log` |  |
| `qa:bardepth/100:harness-race` | harness-race | bardepth/100 | (no report): no report | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/bardepth-100.log` |  |
| `qa:brush/1000:brush/zoom` | brush/zoom | brush/1000 | brush-right-half: 201 px (out-of-range, mode 498, hist [498,689]) | `qa/results/brush/2026-09-06T23-58-48-163Z/brush-right-half-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/brush-1000.log` |  |
| `qa:radar/6:polar` | polar | radar/6 | settled: 96 px (out-of-range, mode 135, hist [135,135])<br>hover-30: 629 px (out-of-range, mode 123, hist [123,532])<br>hover-70: 99 px (out-of-range, mode 141, hist [135,143]) | `qa/results/radar/2026-09-06T23-58-50-212Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/radar-6.log`<br>`qa/results/radar/2026-09-06T23-58-50-212Z/hover-30-diff.png`<br>`qa/results/radar/2026-09-06T23-58-50-212Z/hover-70-diff.png` |  |
| `qa:ring/4:polar` | polar | ring/4 | hover-30: 2921 px (out-of-range, mode 3007, hist [2982,15233])<br>hover-50: 2519 px (out-of-range, mode 2995, hist [2933,15233]) | `qa/results/ring/2026-09-06T23-58-55-539Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/ring-4.log`<br>`qa/results/ring/2026-09-06T23-58-55-539Z/hover-50-diff.png` |  |
| `qa:arealoading/1000:motion/reveal` | motion/reveal | arealoading/1000 | settled: 24836 px (out-of-range, mode 228, hist [227,552])<br>hover-30: 25142 px (out-of-range, mode 630, hist [237,658])<br>hover-50: 24863 px (out-of-range, mode 247, hist [239,417])<br>hover-70: 24984 px (out-of-range, mode 541, hist [249,775]) | `qa/results/arealoading/2026-09-06T23-59-18-275Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/arealoading-1000.log`<br>`qa/results/arealoading/2026-09-06T23-59-18-275Z/hover-30-diff.png`<br>`qa/results/arealoading/2026-09-06T23-59-18-275Z/hover-50-diff.png`<br>`qa/results/arealoading/2026-09-06T23-59-18-275Z/hover-70-diff.png` |  |
| `qa:sankey/33:axis` | axis | sankey/33 | settled: 1028 px (out-of-range, mode 1057, hist [1048,7013]) | `qa/results/sankey/2026-09-06T23-59-02-218Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/sankey-33.log` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | settled: 21785 px (in-range, mode 18216, hist [0,51852]) | `qa/results/barloading/2026-09-06T23-59-22-522Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/qa/barloading-100.log` |  |
| `bench:migrated/line/1000:m1c_scriptMs` | bench | migrated/line/1000 | m1c_scriptMs: 109.84 vs baseline 76.7 (+43.2%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bench.json`<br>`bench/results/2026-09-07T00-01-42-087Z`<br>`bench/results/2026-09-07T00-32-01-204Z` |  |
| `bench:migrated/area/1000:m1c_scriptMs` | bench | migrated/area/1000 | m1c_scriptMs: 127.58 vs baseline 88 (+45%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bench.json`<br>`bench/results/2026-09-07T00-01-42-087Z`<br>`bench/results/2026-09-07T00-32-01-204Z` |  |
| `bench:migrated/composed/1000:m1b_settleMs` | bench | migrated/composed/1000 | m1b_settleMs: 1192.3 vs baseline 1664.8 (-28.4%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bench.json`<br>`bench/results/2026-09-07T00-01-42-087Z`<br>`bench/results/2026-09-07T00-32-01-204Z` |  |
| `bench:migrated/composed/1000:m1c_scriptMs` | bench | migrated/composed/1000 | m1c_scriptMs: 152.95 vs baseline 123.8 (+23.5%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bench.json`<br>`bench/results/2026-09-07T00-01-42-087Z`<br>`bench/results/2026-09-07T00-32-01-204Z` |  |
| `bench:migrated/bar/100:m1c_scriptMs` | bench | migrated/bar/100 | m1c_scriptMs: 94.98 vs baseline 72 (+31.9%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bench.json`<br>`bench/results/2026-09-07T00-01-42-087Z`<br>`bench/results/2026-09-07T00-32-01-204Z` |  |
| `bench:migrated/scatter/1000:m1b_settleMs` | bench | migrated/scatter/1000 | m1b_settleMs: 2504.7 vs baseline 1258.6 (+99%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bench.json`<br>`bench/results/2026-09-07T00-01-42-087Z`<br>`bench/results/2026-09-07T00-32-01-204Z` |  |
| `bench:migrated/scatter/1000:m3a_updateMs` | bench | migrated/scatter/1000 | m3a_updateMs: 35.7 vs baseline 28.8 (+24%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bench.json`<br>`bench/results/2026-09-07T00-01-42-087Z`<br>`bench/results/2026-09-07T00-32-01-204Z` |  |
| `bundle:migrated/area` | bundle | migrated/area | FAIL: gzip 173167 vs pin 168043 (limit 173084, +3.05%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/areamultiaxis` | bundle | migrated/areamultiaxis | FAIL: gzip 173270 vs pin 168116 (limit 173159, +3.07%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/bar` | bundle | migrated/bar | FAIL: gzip 161041 vs pin 134546 (limit 138582, +19.69%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/bardepth` | bundle | migrated/bardepth | FAIL: gzip 161260 vs pin 134747 (limit 138789, +19.68%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barloading` | bundle | migrated/barloading | FAIL: gzip 83837 vs pin 2449 (limit 2522, +3323.32%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barmultiaxis` | bundle | migrated/barmultiaxis | FAIL: gzip 161103 vs pin 134603 (limit 138641, +19.69%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barsquares` | bundle | migrated/barsquares | FAIL: gzip 173387 vs pin 146726 (limit 151128, +18.17%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candlestick` | bundle | migrated/candlestick | FAIL: gzip 154710 vs pin 127176 (limit 130991, +21.65%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candlestick-legend` | bundle | migrated/candlestick-legend | FAIL: gzip 165688 vs pin 137813 (limit 141947, +20.23%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candletween` | bundle | migrated/candletween | FAIL: gzip 154781 vs pin 127244 (limit 131061, +21.64%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/choropleth` | bundle | migrated/choropleth | FAIL: gzip 152133 vs pin 119026 (limit 122597, +27.81%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composed` | bundle | migrated/composed | FAIL: gzip 165372 vs pin 140194 (limit 144400, +17.96%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composedmultiaxis` | bundle | migrated/composedmultiaxis | FAIL: gzip 165436 vs pin 140253 (limit 144461, +17.96%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composedstacked` | bundle | migrated/composedstacked | FAIL: gzip 165361 vs pin 140180 (limit 144385, +17.96%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/funnel` | bundle | migrated/funnel | FAIL: gzip 128336 vs pin 48669 (limit 50129, +163.69%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/funnelvertical` | bundle | migrated/funnelvertical | FAIL: gzip 128353 vs pin 48688 (limit 50149, +163.62%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/gauge` | bundle | migrated/gauge | FAIL: gzip 145019 vs pin 104637 (limit 107776, +38.59%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/gaugelinear` | bundle | migrated/gaugelinear | FAIL: gzip 145121 vs pin 104744 (limit 107886, +38.55%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/heatmap` | bundle | migrated/heatmap | FAIL: gzip 141906 vs pin 105621 (limit 108790, +34.35%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/legendhover` | bundle | migrated/legendhover | FAIL: gzip 197415 vs pin 174096 (limit 179319, +13.39%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/liveline` | bundle | migrated/liveline | FAIL: gzip 152803 vs pin 125519 (limit 129285, +21.74%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/patternarea` | bundle | migrated/patternarea | FAIL: gzip 173236 vs pin 168100 (limit 173143, +3.06%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/pie` | bundle | migrated/pie | FAIL: gzip 131765 vs pin 92430 (limit 95203, +42.56%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/radar` | bundle | migrated/radar | FAIL: gzip 134400 vs pin 103613 (limit 106721, +29.71%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/ring` | bundle | migrated/ring | FAIL: gzip 141569 vs pin 102295 (limit 105364, +38.39%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sankey` | bundle | migrated/sankey | FAIL: gzip 143750 vs pin 104293 (limit 107422, +37.83%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/scatter` | bundle | migrated/scatter | FAIL: gzip 152744 vs pin 126075 (limit 129857, +21.15%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/scattermultiaxis` | bundle | migrated/scattermultiaxis | FAIL: gzip 152763 vs pin 126095 (limit 129878, +21.15%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sunburst` | bundle | migrated/sunburst | FAIL: gzip 140576 vs pin 99807 (limit 102801, +40.85%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sunchrome` | bundle | migrated/sunchrome | FAIL: gzip 141388 vs pin 100467 (limit 103481, +40.73%) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `census` | census | — | node scripts/reach-in-guard.mjs --json exit 1 {"total":23,"files":13,"failures":1} | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/logs/checks/census.log` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |
| `probe:hover-lag:pie/1000` | hover-dim | pie/1000 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |
| `probe:hover-lag:sankey/33` | hover-dim | sankey/33 | dim-presence-mismatch<br>settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |
| `probe:hover-lag:liveline/100` | hover-dim | liveline/100 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |
| `probe:legend-hover-dim:legendhover/1000` | legend | legendhover/1000 | item-0: dim presence mismatch (bklit +2, migrated +0)<br>item-1: dim presence mismatch (bklit +1000, migrated +0)<br>item-1: migrated does not fully undim (1000 -> 0) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |
| `probe:legend-hover-dim:candlelegend/1000` | legend | candlelegend/1000 | item-0: dim presence mismatch (bklit +511, migrated +0)<br>item-0: migrated does not fully undim (1533 -> 0)<br>item-1: dim presence mismatch (bklit +489, migrated +0)<br>item-1: migrated does not fully undim (1465 -> 0) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: bklit does not fully undim (6 -> 4)<br>item-1: dim presence mismatch (bklit +1, migrated +0)<br>item-1: bklit does not fully undim (4 -> 3)<br>item-1: migrated does not fully undim (1 -> 0) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |
| `probe:legend-hover-dim:barsquares/100` | legend | barsquares/100 | item-0: migrated does not fully undim (0 -> 200)<br>item-1: migrated does not fully undim (0 -> 200) | `docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z/probes.json` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| sunburst | 33 | settled | 583 | [575,581] | 575 |
| scatter | 1000 | hover-70 | 1889 | [2018,143608] | 2847 |
| scattermultiaxis | 1000 | hover-70 | 1835 | [2123,129924] | 6349 |
| sunburst | 27 | settled | 577 | [575,576] | 575 |
| sunchrome | 27 | settled | 652 | [650,651] | 651 |
| brush | 1000 | brush-right-half | 201 | [498,689] | 498 |
| radar | 6 | settled | 96 | [135,135] | 135 |
| radar | 6 | hover-30 | 629 | [123,532] | 123 |
| radar | 6 | hover-70 | 99 | [135,143] | 141 |
| ring | 4 | hover-30 | 2921 | [2982,15233] | 3007 |
| ring | 4 | hover-50 | 2519 | [2933,15233] | 2995 |
| sankey | 33 | settled | 1028 | [1048,7013] | 1057 |
