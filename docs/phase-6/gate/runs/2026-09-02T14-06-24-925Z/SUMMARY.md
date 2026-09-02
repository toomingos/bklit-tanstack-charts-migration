# Gate summary — par2-2026-09-02T14:06Z

Run dir: `docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z`. Generated 2026-09-02T19:31:08.446Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 25, harness FAIL 25, out-of-range 0, new values 0, tooltip failures 0, errors 0; 4 workers, wall-clock 3m07s (gate 4800 px)
- Bench: not run
- Bundle: not run
- Checks: not run
- Census: not run
- Probes: not run

## Issues (10)

Classification only — the hypothesis column is intentionally empty for the fix owner.

hover-dim: 3 · legend: 1 · renderer-regime: 3 · motion/reveal: 2 · polar: 1

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:markers/100:hover-dim` | hover-dim | markers/100 | hover-30: 11655 px (seen, mode 3717, hist [3574,15483])<br>hover-50: 10236 px (seen, mode 1750, hist [840,15244])<br>hover-70: 11477 px (seen, mode 3633, hist [3328,15251]) | `qa/results/markers/2026-09-02T14-07-49-868Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T14-07-49-868Z/hover-50-diff.png`<br>`qa/results/markers/2026-09-02T14-07-49-868Z/hover-70-diff.png` |  |
| `qa:markers/100:legend` | legend | markers/100 | legend-hover-0: 11263 px (seen, mode 3811, hist [3756,18168])<br>legend-hover-1: 10655 px (seen, mode 3757, hist [3729,17740])<br>legend-hover-clear: 10657 px (seen, mode 3755, hist [3731,16612]) | `qa/results/markers/2026-09-02T14-07-49-868Z/legend-hover-0-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/markers-100.log`<br>`qa/results/markers/2026-09-02T14-07-49-868Z/legend-hover-1-diff.png`<br>`qa/results/markers/2026-09-02T14-07-49-868Z/legend-hover-clear-diff.png` |  |
| `qa:liveline/100:hover-dim` | hover-dim | liveline/100 | hover-30: 7114 px (seen, mode 486, hist [486,7300])<br>hover-50: 7216 px (seen, mode 644, hist [644,7440])<br>hover-70: 7226 px (seen, mode 982, hist [982,7608]) | `qa/results/liveline/2026-09-02T14-08-03-758Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/liveline-100.log`<br>`qa/results/liveline/2026-09-02T14-08-03-758Z/hover-50-diff.png`<br>`qa/results/liveline/2026-09-02T14-08-03-758Z/hover-70-diff.png` |  |
| `qa:candlestick/1000:renderer-regime` | renderer-regime | candlestick/1000 | hover-30: 6105 px (seen, mode 4764, hist [4609,7343])<br>hover-50: 4888 px (seen, mode 3515, hist [3094,6302]) | `qa/results/candlestick/2026-09-02T14-08-16-748Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/candlestick-1000.log`<br>`qa/results/candlestick/2026-09-02T14-08-16-748Z/hover-50-diff.png` |  |
| `qa:bardepth/100:motion/reveal` | motion/reveal | bardepth/100 | depth-off: 244052 px (seen, mode 650, hist [228,246134]) | `qa/results/bardepth/2026-09-02T14-08-46-176Z/depth-off-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/bardepth-100.log` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-30: 137509 px (seen, mode 0, hist [0,143154])<br>hover-50: 138136 px (seen, mode 748, hist [0,142237])<br>hover-70: 139200 px (seen, mode 2847, hist [2018,143608]) | `qa/results/scatter/2026-09-02T14-08-56-114Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/scatter-1000.log`<br>`qa/results/scatter/2026-09-02T14-08-56-114Z/hover-50-diff.png`<br>`qa/results/scatter/2026-09-02T14-08-56-114Z/hover-70-diff.png` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-30: 117085 px (seen, mode 0, hist [0,127866])<br>hover-50: 117805 px (seen, mode 748, hist [0,128172])<br>hover-70: 118883 px (seen, mode 2123, hist [2123,129924]) | `qa/results/scattermultiaxis/2026-09-02T14-09-00-383Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/scattermultiaxis-1000.log`<br>`qa/results/scattermultiaxis/2026-09-02T14-09-00-383Z/hover-50-diff.png`<br>`qa/results/scattermultiaxis/2026-09-02T14-09-00-383Z/hover-70-diff.png` |  |
| `qa:radar/6:polar` | polar | radar/6 | hover-50: 6538 px (seen, mode 852, hist [851,6544]) | `qa/results/radar/2026-09-02T14-09-13-194Z/hover-50-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/radar-6.log` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | settled: 18399 px (seen, mode 18216, hist [18124,51852])<br>hover-30: 159249 px (seen, mode 158874, hist [158874,161541])<br>hover-50: 161177 px (seen, mode 161336, hist [133147,161353])<br>hover-70: 132917 px (seen, mode 161542, hist [132903,164456]) | `qa/results/barloading/2026-09-02T14-09-11-111Z/settled-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/barloading-100.log`<br>`qa/results/barloading/2026-09-02T14-09-11-111Z/hover-30-diff.png`<br>`qa/results/barloading/2026-09-02T14-09-11-111Z/hover-50-diff.png`<br>`qa/results/barloading/2026-09-02T14-09-11-111Z/hover-70-diff.png` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-30: 11247 px (seen, mode 3690, hist [3506,31888])<br>hover-70: 7128 px (seen, mode 1761, hist [1270,11636]) | `qa/results/sankey/2026-09-02T14-09-15-081Z/hover-30-diff.png`<br>`docs/phase-6/gate/runs/2026-09-02T14-06-24-925Z/logs/qa/sankey-33.log`<br>`qa/results/sankey/2026-09-02T14-09-15-081Z/hover-70-diff.png` |  |

## QA cells that changed status vs history (not failing)

none
