# Gate summary — 7.5 final gate at 3e8092d (G18+G33+G19 closed)

Run dir: `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z`. Generated 2026-09-06T16:36:30.903Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 1, ruled 3, harness FAIL 4, out-of-range 36, new values 50, tooltip failures 0, errors 0; 4 workers, wall-clock 2m54s (gate 4800 px)
- Bench: 29 cells (0 skipped); 8 flagged (±20% D273), console-error cells 0, tooltip-missing 0, failed invocations 0, wall-clock 44m38s
- Bundle: 43 pinned, FAIL 30, MISSING 0, measure-failed 0, Σgzip 6594929 vs Σpin 5605143 (+17.66%)
- Checks: tsc=ok, lint=ok, bench-tsc=ok, build=ok, unit=ok, census=ok, bundle-gate=FAIL(1)
- Census: reach-in-guard exit 0, total 21, failures 0
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":4,"legend-hover-dim":4,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (67)

Classification only — the hypothesis column is intentionally empty for the fix owner.

polar: 3 · hover-dim: 13 · legend: 5 · axis: 2 · renderer-regime: 3 · motion/reveal: 2 · bench: 8 · bundle: 31

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:pie/1000:polar` | polar | pie/1000 | settled: 116 px (out-of-range, mode 398, hist [398,411]) | `qa/results/pie/2026-09-06T15-30-35-528Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/pie-1000.log` |  |
| `qa:barsquares/100:hover-dim` | hover-dim | barsquares/100 | hover-30: 2017 px (out-of-range, mode 2035, hist [2035,2508])<br>hover-50: 2517 px (out-of-range, mode 2222, hist [2222,2482]) | `qa/results/barsquares/2026-09-06T15-30-05-678Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/barsquares-100.log`<br>`qa/results/barsquares/2026-09-06T15-30-05-678Z/hover-50-diff.png` |  |
| `qa:barsquares/100:legend` | legend | barsquares/100 | legend-hover-0: 1938 px (out-of-range, mode 1953, hist [1953,2031])<br>legend-hover-1: 2001 px (out-of-range, mode 2016, hist [2016,2094])<br>legend-hover-clear: 1934 px (out-of-range, mode 1949, hist [1949,2027]) | `qa/results/barsquares/2026-09-06T15-30-05-678Z/legend-hover-0-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/barsquares-100.log`<br>`qa/results/barsquares/2026-09-06T15-30-05-678Z/legend-hover-1-diff.png`<br>`qa/results/barsquares/2026-09-06T15-30-05-678Z/legend-hover-clear-diff.png` |  |
| `qa:liveline/100:axis` | axis | liveline/100 | settled: 1794 px (out-of-range, mode 1626, hist [1626,1751]) | `qa/results/liveline/2026-09-06T15-30-31-817Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/liveline-100.log` |  |
| `qa:liveline/100:hover-dim` | hover-dim | liveline/100 | hover-30: 3122 px (out-of-range, mode 3158, hist [3158,3276])<br>hover-50: 3424 px (out-of-range, mode 3459, hist [3459,3533])<br>hover-70: 3383 px (out-of-range, mode 2807, hist [2807,2894]) | `qa/results/liveline/2026-09-06T15-30-31-817Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/liveline-100.log`<br>`qa/results/liveline/2026-09-06T15-30-31-817Z/hover-50-diff.png`<br>`qa/results/liveline/2026-09-06T15-30-31-817Z/hover-70-diff.png` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-70: 1856 px (out-of-range, mode 1614, hist [1614,1835]) | `qa/results/scattermultiaxis/2026-09-06T15-30-45-462Z/hover-70-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/scattermultiaxis-1000.log` |  |
| `qa:bardepth/100:hover-dim` | hover-dim | bardepth/100 | hover-30: 2047 px (out-of-range, mode 1873, hist [1873,1873]) | `qa/results/bardepth/2026-09-06T15-31-02-340Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/bardepth-100.log` |  |
| `qa:bardepth/100:motion/reveal` | motion/reveal | bardepth/100 | depth-off: 1423 px (out-of-range, mode 1435, hist [1435,1448]) | `qa/results/bardepth/2026-09-06T15-31-02-340Z/depth-off-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/bardepth-100.log` |  |
| `qa:radar/6:polar` | polar | radar/6 | hover-30: 629 px (out-of-range, mode 628, hist [628,628]) | `qa/results/radar/2026-09-06T15-31-17-534Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/radar-6.log` |  |
| `qa:areamultiaxis/1000:renderer-regime` | renderer-regime | areamultiaxis/1000 | hover-30: 1588 px (out-of-range, mode 2106, hist [2106,2106])<br>hover-70: 2351 px (out-of-range, mode 2257, hist [2257,2257]) | `qa/results/areamultiaxis/2026-09-06T15-31-20-159Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/areamultiaxis-1000.log`<br>`qa/results/areamultiaxis/2026-09-06T15-31-20-159Z/hover-70-diff.png` |  |
| `qa:segment/1000:hover-dim` | hover-dim | segment/1000 | hover-30: 1640 px (out-of-range, mode 1400, hist [1400,1400])<br>hover-50: 1612 px (out-of-range, mode 1630, hist [1630,1630]) | `qa/results/segment/2026-09-06T15-31-24-131Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/segment-1000.log`<br>`qa/results/segment/2026-09-06T15-31-24-131Z/hover-50-diff.png` |  |
| `qa:ring/4:polar` | polar | ring/4 | hover-30: 2927 px (out-of-range, mode 2900, hist [2900,2924])<br>hover-70: 591 px (out-of-range, mode 2601, hist [2601,2622]) | `qa/results/ring/2026-09-06T15-31-25-041Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/ring-4.log`<br>`qa/results/ring/2026-09-06T15-31-25-041Z/hover-70-diff.png` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-70: 1452 px (out-of-range, mode 3814, hist [3814,4567]) | `qa/results/sankey/2026-09-06T15-31-25-014Z/hover-70-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/sankey-33.log` |  |
| `qa:griddefault/1000:hover-dim` | hover-dim | griddefault/1000 | hover-30: 1376 px (out-of-range, mode 1625, hist [1625,1625]) | `qa/results/griddefault/2026-09-06T15-31-26-355Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/griddefault-1000.log` |  |
| `qa:refareamultiaxis/1000:hover-dim` | hover-dim | refareamultiaxis/1000 | hover-30: 3424 px (out-of-range, mode 3950, hist [3950,3951])<br>hover-70: 4571 px (out-of-range, mode 4161, hist [4161,4357]) | `qa/results/refareamultiaxis/2026-09-06T15-31-34-191Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/refareamultiaxis-1000.log`<br>`qa/results/refareamultiaxis/2026-09-06T15-31-34-191Z/hover-70-diff.png` |  |
| `qa:projection/1000:axis` | axis | projection/1000 | settled: 129 px (out-of-range, mode 131, hist [131,138]) | `qa/results/projection/2026-09-06T15-31-45-901Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/projection-1000.log` |  |
| `qa:projection/1000:hover-dim` | hover-dim | projection/1000 | hover-50: 1414 px (out-of-range, mode 1609, hist [1609,1609]) | `qa/results/projection/2026-09-06T15-31-45-901Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/projection-1000.log` |  |
| `qa:linemultiaxis/1000:renderer-regime` | renderer-regime | linemultiaxis/1000 | hover-30: 1683 px (out-of-range, mode 2007, hist [2007,2008])<br>hover-50: 2106 px (out-of-range, mode 2117, hist [2117,2117]) | `qa/results/linemultiaxis/2026-09-06T15-31-48-525Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/linemultiaxis-1000.log`<br>`qa/results/linemultiaxis/2026-09-06T15-31-48-525Z/hover-50-diff.png` |  |
| `qa:refarea/1000:hover-dim` | hover-dim | refarea/1000 | hover-50: 1615 px (out-of-range, mode 1605, hist [1605,1605])<br>hover-70: 1671 px (out-of-range, mode 1750, hist [1750,1750]) | `qa/results/refarea/2026-09-06T15-31-55-215Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/refarea-1000.log`<br>`qa/results/refarea/2026-09-06T15-31-55-215Z/hover-70-diff.png` |  |
| `qa:arealoading/1000:motion/reveal` | motion/reveal | arealoading/1000 | settled: 3153 px (out-of-range, mode 3277, hist [3277,3752])<br>hover-30: 247 px (out-of-range, mode 273, hist [273,368])<br>hover-50: 24407 px (out-of-range, mode 378, hist [378,3683])<br>hover-70: 617 px (out-of-range, mode 655, hist [655,9582]) | `qa/results/arealoading/2026-09-06T15-31-57-232Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/qa/arealoading-1000.log`<br>`qa/results/arealoading/2026-09-06T15-31-57-232Z/hover-30-diff.png`<br>`qa/results/arealoading/2026-09-06T15-31-57-232Z/hover-50-diff.png`<br>`qa/results/arealoading/2026-09-06T15-31-57-232Z/hover-70-diff.png` |  |
| `bench:tanstack/scatter/1000:m1b_settleMs` | bench | tanstack/scatter/1000 | m1b_settleMs: 97.9 vs baseline 152 (-35.6%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bench:migrated/line/1000:m1c_scriptMs` | bench | migrated/line/1000 | m1c_scriptMs: 109.6 vs baseline 76.7 (+42.9%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bench:migrated/area/1000:m1c_scriptMs` | bench | migrated/area/1000 | m1c_scriptMs: 120.98 vs baseline 88 (+37.5%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bench:migrated/composed/1000:m1b_settleMs` | bench | migrated/composed/1000 | m1b_settleMs: 1192.6 vs baseline 1664.8 (-28.4%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bench:migrated/composed/1000:m1c_scriptMs` | bench | migrated/composed/1000 | m1c_scriptMs: 151.81 vs baseline 123.8 (+22.6%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bench:migrated/bar/100:m1c_scriptMs` | bench | migrated/bar/100 | m1c_scriptMs: 93.89 vs baseline 72 (+30.4%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bench:migrated/scatter/1000:m1b_settleMs` | bench | migrated/scatter/1000 | m1b_settleMs: 2505.2 vs baseline 1258.6 (+99%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bench:migrated/scatter/1000:m3a_updateMs` | bench | migrated/scatter/1000 | m3a_updateMs: 35.7 vs baseline 28.8 (+24%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bench.json`<br>`bench/results/2026-09-06T16-28-24-971Z`<br>`bench/results/2026-09-06T16-29-52-618Z` |  |
| `bundle:migrated/area` | bundle | migrated/area | FAIL: gzip 173167 vs pin 168043 (limit 173084, +3.05%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/areamultiaxis` | bundle | migrated/areamultiaxis | FAIL: gzip 173270 vs pin 168116 (limit 173159, +3.07%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/bar` | bundle | migrated/bar | FAIL: gzip 161041 vs pin 134546 (limit 138582, +19.69%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/bardepth` | bundle | migrated/bardepth | FAIL: gzip 161260 vs pin 134747 (limit 138789, +19.68%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barloading` | bundle | migrated/barloading | FAIL: gzip 83837 vs pin 2449 (limit 2522, +3323.32%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barmultiaxis` | bundle | migrated/barmultiaxis | FAIL: gzip 161103 vs pin 134603 (limit 138641, +19.69%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/barsquares` | bundle | migrated/barsquares | FAIL: gzip 173389 vs pin 146726 (limit 151128, +18.17%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candlestick` | bundle | migrated/candlestick | FAIL: gzip 154710 vs pin 127176 (limit 130991, +21.65%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candlestick-legend` | bundle | migrated/candlestick-legend | FAIL: gzip 165694 vs pin 137813 (limit 141947, +20.23%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/candletween` | bundle | migrated/candletween | FAIL: gzip 154781 vs pin 127244 (limit 131061, +21.64%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/choropleth` | bundle | migrated/choropleth | FAIL: gzip 152133 vs pin 119026 (limit 122597, +27.81%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composed` | bundle | migrated/composed | FAIL: gzip 165372 vs pin 140194 (limit 144400, +17.96%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composedmultiaxis` | bundle | migrated/composedmultiaxis | FAIL: gzip 165436 vs pin 140253 (limit 144461, +17.96%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/composedstacked` | bundle | migrated/composedstacked | FAIL: gzip 165361 vs pin 140180 (limit 144385, +17.96%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/funnel` | bundle | migrated/funnel | FAIL: gzip 128336 vs pin 48669 (limit 50129, +163.69%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/funnelvertical` | bundle | migrated/funnelvertical | FAIL: gzip 128353 vs pin 48688 (limit 50149, +163.62%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/gauge` | bundle | migrated/gauge | FAIL: gzip 145019 vs pin 104637 (limit 107776, +38.59%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/gaugelinear` | bundle | migrated/gaugelinear | FAIL: gzip 145121 vs pin 104744 (limit 107886, +38.55%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/heatmap` | bundle | migrated/heatmap | FAIL: gzip 141906 vs pin 105621 (limit 108790, +34.35%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/legendhover` | bundle | migrated/legendhover | FAIL: gzip 197410 vs pin 174096 (limit 179319, +13.39%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/liveline` | bundle | migrated/liveline | FAIL: gzip 152803 vs pin 125519 (limit 129285, +21.74%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/patternarea` | bundle | migrated/patternarea | FAIL: gzip 173236 vs pin 168100 (limit 173143, +3.06%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/pie` | bundle | migrated/pie | FAIL: gzip 131765 vs pin 92430 (limit 95203, +42.56%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/radar` | bundle | migrated/radar | FAIL: gzip 134400 vs pin 103613 (limit 106721, +29.71%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/ring` | bundle | migrated/ring | FAIL: gzip 141569 vs pin 102295 (limit 105364, +38.39%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sankey` | bundle | migrated/sankey | FAIL: gzip 143750 vs pin 104293 (limit 107422, +37.83%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/scatter` | bundle | migrated/scatter | FAIL: gzip 152744 vs pin 126075 (limit 129857, +21.15%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/scattermultiaxis` | bundle | migrated/scattermultiaxis | FAIL: gzip 152763 vs pin 126095 (limit 129878, +21.15%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sunburst` | bundle | migrated/sunburst | FAIL: gzip 140576 vs pin 99807 (limit 102801, +40.85%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `bundle:migrated/sunchrome` | bundle | migrated/sunchrome | FAIL: gzip 141388 vs pin 100467 (limit 103481, +40.73%) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/bundle.json`<br>`bench/results/bundle-sizes.json` |  |
| `checks:bundle-gate` | bundle | — | node scripts/bundle-gate.mjs exit 1 {"ok":13,"fail":30} | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/logs/checks/bundle-gate.log` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |
| `probe:hover-lag:pie/1000` | hover-dim | pie/1000 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |
| `probe:hover-lag:sankey/33` | hover-dim | sankey/33 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |
| `probe:hover-lag:liveline/100` | hover-dim | liveline/100 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |
| `probe:legend-hover-dim:legendhover/1000` | legend | legendhover/1000 | item-0: dim presence mismatch (bklit +2, migrated +0)<br>item-0: bklit does not fully undim (0 -> 2)<br>item-1: dim presence mismatch (bklit +998, migrated +0)<br>item-1: bklit does not fully undim (2 -> 0)<br>item-1: migrated does not fully undim (1000 -> 0) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |
| `probe:legend-hover-dim:candlelegend/1000` | legend | candlelegend/1000 | item-0: dim presence mismatch (bklit +511, migrated +0)<br>item-0: migrated does not fully undim (1533 -> 0)<br>item-1: dim presence mismatch (bklit +489, migrated +0)<br>item-1: migrated does not fully undim (1465 -> 0) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: dim presence mismatch (bklit +1, migrated +0)<br>item-0: bklit does not fully undim (3 -> 4)<br>item-1: dim presence mismatch (bklit +1, migrated +0)<br>item-1: bklit does not fully undim (4 -> 3)<br>item-1: migrated does not fully undim (1 -> 0) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |
| `probe:legend-hover-dim:barsquares/100` | legend | barsquares/100 | item-0: bklit does not fully undim (200 -> 4211)<br>item-0: migrated does not fully undim (0 -> 200)<br>item-1: bklit does not fully undim (200 -> 6915)<br>item-1: migrated does not fully undim (0 -> 200) | `docs/phase-7/gate/runs/2026-09-06T15-28-46-624Z/probes.json` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| pie | 1000 | settled | 116 | [398,411] | 398 |
| barsquares | 100 | hover-30 | 2017 | [2035,2508] | 2035 |
| barsquares | 100 | hover-50 | 2517 | [2222,2482] | 2222 |
| barsquares | 100 | legend-hover-0 | 1938 | [1953,2031] | 1953 |
| barsquares | 100 | legend-hover-1 | 2001 | [2016,2094] | 2016 |
| barsquares | 100 | legend-hover-clear | 1934 | [1949,2027] | 1949 |
| liveline | 100 | settled | 1794 | [1626,1751] | 1626 |
| liveline | 100 | hover-30 | 3122 | [3158,3276] | 3158 |
| liveline | 100 | hover-50 | 3424 | [3459,3533] | 3459 |
| liveline | 100 | hover-70 | 3383 | [2807,2894] | 2807 |
| scattermultiaxis | 1000 | hover-70 | 1856 | [1614,1835] | 1614 |
| bardepth | 100 | hover-30 | 2047 | [1873,1873] | 1873 |
| bardepth | 100 | depth-off | 1423 | [1435,1448] | 1435 |
| radar | 6 | hover-30 | 629 | [628,628] | 628 |
| areamultiaxis | 1000 | hover-30 | 1588 | [2106,2106] | 2106 |
| areamultiaxis | 1000 | hover-70 | 2351 | [2257,2257] | 2257 |
| segment | 1000 | hover-30 | 1640 | [1400,1400] | 1400 |
| segment | 1000 | hover-50 | 1612 | [1630,1630] | 1630 |
| ring | 4 | hover-30 | 2927 | [2900,2924] | 2900 |
| ring | 4 | hover-70 | 591 | [2601,2622] | 2601 |
| sankey | 33 | hover-70 | 1452 | [3814,4567] | 3814 |
| griddefault | 1000 | hover-30 | 1376 | [1625,1625] | 1625 |
| refareamultiaxis | 1000 | hover-30 | 3424 | [3950,3951] | 3950 |
| refareamultiaxis | 1000 | hover-70 | 4571 | [4161,4357] | 4161 |
| projection | 1000 | settled | 129 | [131,138] | 131 |
| projection | 1000 | hover-50 | 1414 | [1609,1609] | 1609 |
| linemultiaxis | 1000 | hover-30 | 1683 | [2007,2008] | 2007 |
| linemultiaxis | 1000 | hover-50 | 2106 | [2117,2117] | 2117 |
| refarea | 1000 | hover-50 | 1615 | [1605,1605] | 1605 |
| refarea | 1000 | hover-70 | 1671 | [1750,1750] | 1750 |
| arealoading | 1000 | settled | 3153 | [3277,3752] | 3277 |
| arealoading | 1000 | hover-30 | 247 | [273,368] | 273 |
| arealoading | 1000 | hover-70 | 617 | [655,9582] | 655 |
