# Gate summary — par1-2026-09-02T14:00Z

Run dir: `docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z`. Generated 2026-09-02T19:31:08.369Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 34, harness FAIL 35, out-of-range 8, new values 78, tooltip failures 1, errors 0 (gate 4800 px)
- Bench: not run
- Bundle: not run
- Checks: not run
- Census: not run
- Probes: not run

## Issues (18)

Classification only — the hypothesis column is intentionally empty for the fix owner.

hover-dim: 6 · legend: 2 · motion/reveal: 3 · renderer-regime: 4 · tooltip: 1 · axis: 1 · polar: 1

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:markers/100:hover-dim` | hover-dim | markers/100 | hover-30: 13655 px (in-range, mode 3717, hist [3574,15483])<br>hover-50: 11769 px (in-range, mode 1750, hist [840,15244])<br>hover-70: 12442 px (in-range, mode 3633, hist [3328,15251]) | `qa/results/markers/2026-09-02T14-01-07-959Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T14-01-07-959Z/hover-50-diff.png`<br>`qa/results/markers/2026-09-02T14-01-07-959Z/hover-70-diff.png` |  |
| `qa:markers/100:legend` | legend | markers/100 | legend-hover-0: 12922 px (seen, mode 3811, hist [3756,18168])<br>legend-hover-1: 12317 px (in-range, mode 3757, hist [3729,17740])<br>legend-hover-clear: 12316 px (seen, mode 3755, hist [3731,16612]) | `qa/results/markers/2026-09-02T14-01-07-959Z/legend-hover-0-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T14-01-07-959Z/legend-hover-1-diff.png`<br>`qa/results/markers/2026-09-02T14-01-07-959Z/legend-hover-clear-diff.png` |  |
| `qa:bardepth/100:motion/reveal` | motion/reveal | bardepth/100 | depth-off: 246133 px (in-range, mode 650, hist [228,246134]) | `qa/results/bardepth/2026-09-02T14-01-03-086Z/depth-off-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/bardepth-100.log` |  |
| `qa:arealoading/1000:motion/reveal` | motion/reveal | arealoading/1000 | hover-70: 412 px (out-of-range, mode 249, hist [249,361]) | `qa/results/arealoading/2026-09-02T14-01-15-526Z/hover-70-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/arealoading-1000.log` |  |
| `qa:areamultiaxis/1000:renderer-regime` | renderer-regime | areamultiaxis/1000 | hover-30: 5073 px (seen, mode 3, hist [3,14922]) | `qa/results/areamultiaxis/2026-09-02T14-01-20-065Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/areamultiaxis-1000.log` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | settled: 47570 px (in-range, mode 18216, hist [18124,51852])<br>hover-30: 161541 px (out-of-range, mode 158874, hist [158874,161019])<br>hover-50: 133147 px (out-of-range, mode 161336, hist [142625,161353])<br>hover-70: 161542 px (seen, mode 164456, hist [132903,164456]) | `qa/results/barloading/2026-09-02T14-01-27-123Z/settled-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/barloading-100.log`<br>`qa/results/barloading/2026-09-02T14-01-27-123Z/hover-30-diff.png`<br>`qa/results/barloading/2026-09-02T14-01-27-123Z/hover-50-diff.png`<br>`qa/results/barloading/2026-09-02T14-01-27-123Z/hover-70-diff.png` |  |
| `qa:barsquares/100:legend` | legend | barsquares/100 | legend-hover-1: 3497 px (out-of-range, mode 503, hist [237,3490])<br>legend-hover-clear: 3458 px (out-of-range, mode 354, hist [235,3451]) | `qa/results/barsquares/2026-09-02T14-01-52-112Z/legend-hover-1-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/barsquares-100.log`<br>`qa/results/barsquares/2026-09-02T14-01-52-112Z/legend-hover-clear-diff.png` |  |
| `qa:candlestick/1000:renderer-regime` | renderer-regime | candlestick/1000 | hover-30: 7320 px (in-range, mode 4764, hist [4609,7343])<br>hover-50: 6302 px (out-of-range, mode 3515, hist [3094,6294])<br>hover-70: 6172 px (out-of-range, mode 3482, hist [3113,6171]) | `qa/results/candlestick/2026-09-02T14-02-03-714Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/candlestick-1000.log`<br>`qa/results/candlestick/2026-09-02T14-02-03-714Z/hover-50-diff.png`<br>`qa/results/candlestick/2026-09-02T14-02-03-714Z/hover-70-diff.png` |  |
| `qa:choropleth/100:tooltip` | tooltip | choropleth/100 | hover-30: 10141 px (in-range, mode 0, hist [0,11937]) tooltip A/B false/true | `qa/results/choropleth/2026-09-02T14-01-59-932Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/choropleth-100.log` |  |
| `qa:choropleth/100:hover-dim` | hover-dim | choropleth/100 | hover-30:tooltip: undefined px (undefined) | `qa/results/choropleth/2026-09-02T14-01-59-932Z`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/choropleth-100.log` |  |
| `qa:composedstacked/100:hover-dim` | hover-dim | composedstacked/100 | hover-30: 5327 px (in-range, mode 1106, hist [129,13104])<br>hover-50: 5529 px (in-range, mode 1181, hist [129,11720])<br>hover-70: 5431 px (in-range, mode 1125, hist [1125,8880]) | `qa/results/composedstacked/2026-09-02T14-02-18-286Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/composedstacked-100.log`<br>`qa/results/composedstacked/2026-09-02T14-02-18-286Z/hover-50-diff.png`<br>`qa/results/composedstacked/2026-09-02T14-02-18-286Z/hover-70-diff.png` |  |
| `qa:liveline/100:hover-dim` | hover-dim | liveline/100 | hover-30: 7013 px (in-range, mode 486, hist [486,7300])<br>hover-50: 7239 px (in-range, mode 644, hist [644,7440])<br>hover-70: 7545 px (in-range, mode 982, hist [982,7608]) | `qa/results/liveline/2026-09-02T14-02-47-821Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/liveline-100.log`<br>`qa/results/liveline/2026-09-02T14-02-47-821Z/hover-50-diff.png`<br>`qa/results/liveline/2026-09-02T14-02-47-821Z/hover-70-diff.png` |  |
| `qa:projection/1000:axis` | axis | projection/1000 | settled: 555 px (out-of-range, mode 158, hist [40,547]) | `qa/results/projection/2026-09-02T14-02-48-246Z/settled-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/projection-1000.log` |  |
| `qa:radar/6:polar` | polar | radar/6 | hover-50: 6537 px (in-range, mode 852, hist [851,6544]) | `qa/results/radar/2026-09-02T14-02-55-137Z/hover-50-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/radar-6.log` |  |
| `qa:refareamultiaxis/1000:hover-dim` | hover-dim | refareamultiaxis/1000 | hover-30: 8845 px (seen, mode 1754, hist [0,300532])<br>hover-50: 9045 px (seen, mode 2688, hist [764,301423])<br>hover-70: 9331 px (seen, mode 3617, hist [1713,301910]) | `qa/results/refareamultiaxis/2026-09-02T14-02-59-640Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/refareamultiaxis-1000.log`<br>`qa/results/refareamultiaxis/2026-09-02T14-02-59-640Z/hover-50-diff.png`<br>`qa/results/refareamultiaxis/2026-09-02T14-02-59-640Z/hover-70-diff.png` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-30: 11150 px (in-range, mode 3690, hist [3506,31888])<br>hover-70: 7385 px (in-range, mode 1761, hist [1270,11636]) | `qa/results/sankey/2026-09-02T14-03-02-483Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/sankey-33.log`<br>`qa/results/sankey/2026-09-02T14-03-02-483Z/hover-70-diff.png` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-30: 143151 px (in-range, mode 0, hist [0,143154])<br>hover-50: 142230 px (in-range, mode 748, hist [0,142237])<br>hover-70: 143608 px (seen, mode 2847, hist [2018,143608]) | `qa/results/scatter/2026-09-02T14-03-07-601Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/scatter-1000.log`<br>`qa/results/scatter/2026-09-02T14-03-07-601Z/hover-50-diff.png`<br>`qa/results/scatter/2026-09-02T14-03-07-601Z/hover-70-diff.png` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-30: 125879 px (in-range, mode 0, hist [0,127866])<br>hover-50: 124934 px (in-range, mode 748, hist [0,128172])<br>hover-70: 127830 px (in-range, mode 2123, hist [2123,129924]) | `qa/results/scattermultiaxis/2026-09-02T14-03-10-203Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-00-20-546Z/logs/qa/scattermultiaxis-1000.log`<br>`qa/results/scattermultiaxis/2026-09-02T14-03-10-203Z/hover-50-diff.png`<br>`qa/results/scattermultiaxis/2026-09-02T14-03-10-203Z/hover-70-diff.png` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| arealoading | 1000 | hover-70 | 412 | [249,361] | 249 |
| barsquares | 100 | legend-hover-1 | 3497 | [237,3490] | 503 |
| barsquares | 100 | legend-hover-clear | 3458 | [235,3451] | 354 |
| projection | 1000 | settled | 555 | [40,547] | 158 |
