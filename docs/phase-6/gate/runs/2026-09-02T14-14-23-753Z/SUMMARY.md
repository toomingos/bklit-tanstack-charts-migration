# Gate summary — ver1-2026-09-02T14:14Z

Run dir: `docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z`. Generated 2026-09-02T19:31:08.523Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 25, harness FAIL 25, out-of-range 11, new values 112, tooltip failures 0, errors 0; 4 workers, wall-clock 8m26s (gate 4800 px)
- Bench: not run
- Bundle: not run
- Checks: tsc=ok, build=ok, lint=ok, census=ok, bundle-gate=ok
- Census: reach-in-guard exit 0, total 79, failures 0
- Probes: not run

## Issues (13)

Classification only — the hypothesis column is intentionally empty for the fix owner.

axis: 2 · renderer-regime: 4 · hover-dim: 3 · legend: 1 · polar: 1 · motion/reveal: 2

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:funnel/1000:axis` | axis | funnel/1000 | settled: 435 px (out-of-range, mode 0, hist [0,230]) | `qa/results/funnel/2026-09-02T14-16-59-975Z/settled-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/funnel-1000.log` |  |
| `qa:composedmultiaxis/1000:renderer-regime` | renderer-regime | composedmultiaxis/1000 | settled: 853 px (out-of-range, mode 854, hist [854,59696]) | `qa/results/composedmultiaxis/2026-09-02T14-17-08-807Z/settled-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/composedmultiaxis-1000.log` |  |
| `qa:markers/100:hover-dim` | hover-dim | markers/100 | hover-30: 11387 px (in-range, mode 3717, hist [3574,15483])<br>hover-50: 10173 px (in-range, mode 1750, hist [840,15244])<br>hover-70: 11655 px (in-range, mode 3633, hist [3328,15251]) | `qa/results/markers/2026-09-02T14-17-14-038Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T14-17-14-038Z/hover-50-diff.png`<br>`qa/results/markers/2026-09-02T14-17-14-038Z/hover-70-diff.png` |  |
| `qa:markers/100:legend` | legend | markers/100 | legend-hover-0: 11197 px (in-range, mode 3811, hist [3756,18168])<br>legend-hover-1: 8136 px (in-range, mode 3757, hist [3729,17740])<br>legend-hover-clear: 10591 px (in-range, mode 3755, hist [3731,16612]) | `qa/results/markers/2026-09-02T14-17-14-038Z/legend-hover-0-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T14-17-14-038Z/legend-hover-1-diff.png`<br>`qa/results/markers/2026-09-02T14-17-14-038Z/legend-hover-clear-diff.png` |  |
| `qa:candlestick/1000:renderer-regime` | renderer-regime | candlestick/1000 | hover-30: 6113 px (in-range, mode 4764, hist [4609,7343])<br>hover-50: 5037 px (in-range, mode 3515, hist [3094,6302])<br>hover-70: 5027 px (in-range, mode 3482, hist [3113,6172]) | `qa/results/candlestick/2026-09-02T14-17-19-129Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/candlestick-1000.log`<br>`qa/results/candlestick/2026-09-02T14-17-19-129Z/hover-50-diff.png`<br>`qa/results/candlestick/2026-09-02T14-17-19-129Z/hover-70-diff.png` |  |
| `qa:liveline/100:hover-dim` | hover-dim | liveline/100 | hover-30: 7615 px (in-range, mode 486, hist [486,7692])<br>hover-50: 7496 px (in-range, mode 644, hist [644,7588])<br>hover-70: 7504 px (in-range, mode 982, hist [982,7608]) | `qa/results/liveline/2026-09-02T14-17-27-821Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/liveline-100.log`<br>`qa/results/liveline/2026-09-02T14-17-27-821Z/hover-50-diff.png`<br>`qa/results/liveline/2026-09-02T14-17-27-821Z/hover-70-diff.png` |  |
| `qa:patternarea/1000:axis` | axis | patternarea/1000 | pattern-none: 1221 px (out-of-range, mode 1225, hist [1225,5543])<br>pattern-diagonal: 1097 px (out-of-range, mode 1440, hist [1151,6737])<br>pattern-horizontal: 1106 px (out-of-range, mode 1180, hist [1168,6914])<br>pattern-vertical: 1399 px (out-of-range, mode 1590, hist [1457,7158])<br>pattern-cross: 1086 px (out-of-range, mode 1266, hist [1146,6712])<br>pattern-dots: 1171 px (out-of-range, mode 1286, hist [1225,6874])<br>pattern-circles: 1406 px (out-of-range, mode 1476, hist [1475,6751])<br>pattern-accent: 1095 px (out-of-range, mode 1274, hist [1148,6916]) | `qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-none-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/patternarea-1000.log`<br>`qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-diagonal-diff.png`<br>`qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-horizontal-diff.png`<br>`qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-vertical-diff.png`<br>`qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-cross-diff.png`<br>`qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-dots-diff.png`<br>`qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-circles-diff.png`<br>`qa/results/patternarea/2026-09-02T14-17-28-885Z/pattern-accent-diff.png` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-30: 137433 px (in-range, mode 0, hist [0,143154])<br>hover-50: 138149 px (in-range, mode 748, hist [0,142237])<br>hover-70: 139156 px (in-range, mode 2847, hist [2018,143608]) | `qa/results/scatter/2026-09-02T14-17-28-329Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/scatter-1000.log`<br>`qa/results/scatter/2026-09-02T14-17-28-329Z/hover-50-diff.png`<br>`qa/results/scatter/2026-09-02T14-17-28-329Z/hover-70-diff.png` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-30: 117087 px (in-range, mode 0, hist [0,127866])<br>hover-50: 117777 px (in-range, mode 748, hist [0,128172])<br>hover-70: 118935 px (in-range, mode 2123, hist [2123,129924]) | `qa/results/scattermultiaxis/2026-09-02T14-17-38-942Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/scattermultiaxis-1000.log`<br>`qa/results/scattermultiaxis/2026-09-02T14-17-38-942Z/hover-50-diff.png`<br>`qa/results/scattermultiaxis/2026-09-02T14-17-38-942Z/hover-70-diff.png` |  |
| `qa:radar/6:polar` | polar | radar/6 | hover-50: 6531 px (in-range, mode 852, hist [851,6546]) | `qa/results/radar/2026-09-02T14-18-03-153Z/hover-50-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/radar-6.log` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-30: 11125 px (in-range, mode 3690, hist [3506,31888])<br>hover-70: 7693 px (in-range, mode 1761, hist [1270,11636]) | `qa/results/sankey/2026-09-02T14-18-09-533Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/sankey-33.log`<br>`qa/results/sankey/2026-09-02T14-18-09-533Z/hover-70-diff.png` |  |
| `qa:arealoading/1000:motion/reveal` | motion/reveal | arealoading/1000 | hover-70: 612 px (out-of-range, mode 249, hist [249,541]) | `qa/results/arealoading/2026-09-02T14-18-36-226Z/hover-70-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/arealoading-1000.log` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | settled: 22466 px (in-range, mode 18216, hist [18124,51852])<br>hover-30: 161123 px (in-range, mode 158874, hist [158874,161541])<br>hover-50: 144883 px (in-range, mode 161336, hist [133147,161353])<br>hover-70: 161542 px (mode, mode 161542, hist [132903,164456]) | `qa/results/barloading/2026-09-02T14-18-42-967Z/settled-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-14-23-753Z/logs/qa/barloading-100.log`<br>`qa/results/barloading/2026-09-02T14-18-42-967Z/hover-30-diff.png`<br>`qa/results/barloading/2026-09-02T14-18-42-967Z/hover-50-diff.png`<br>`qa/results/barloading/2026-09-02T14-18-42-967Z/hover-70-diff.png` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| funnel | 1000 | settled | 435 | [0,230] | 0 |
| composedmultiaxis | 1000 | settled | 853 | [854,59696] | 854 |
| patternarea | 1000 | pattern-none | 1221 | [1225,5543] | 1225 |
| patternarea | 1000 | pattern-diagonal | 1097 | [1151,6737] | 1440 |
| patternarea | 1000 | pattern-horizontal | 1106 | [1168,6914] | 1180 |
| patternarea | 1000 | pattern-vertical | 1399 | [1457,7158] | 1590 |
| patternarea | 1000 | pattern-cross | 1086 | [1146,6712] | 1266 |
| patternarea | 1000 | pattern-dots | 1171 | [1225,6874] | 1286 |
| patternarea | 1000 | pattern-circles | 1406 | [1475,6751] | 1476 |
| patternarea | 1000 | pattern-accent | 1095 | [1148,6916] | 1274 |
| arealoading | 1000 | hover-70 | 612 | [249,541] | 249 |
