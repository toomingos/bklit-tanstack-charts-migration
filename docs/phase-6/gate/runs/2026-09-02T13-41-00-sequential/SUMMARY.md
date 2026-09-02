# Gate summary — seq-2026-09-02T13:41Z

Run dir: `docs/phase-6/gate/runs/2026-09-02T13-41-00-sequential`. Generated 2026-09-02T19:31:08.293Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 33, harness FAIL 33, out-of-range 26, new values 120, tooltip failures 0, errors 0 (gate 4800 px)
- Bench: not run
- Bundle: not run
- Checks: not run
- Census: not run
- Probes: not run

## Issues (22)

Classification only — the hypothesis column is intentionally empty for the fix owner.

renderer-regime: 4 · hover-dim: 7 · motion/reveal: 2 · axis: 4 · legend: 2 · brush/zoom: 1 · polar: 2

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:areamultiaxis/1000:renderer-regime` | renderer-regime | areamultiaxis/1000 | hover-30: 5073 px (in-range, mode 3, hist [3,14922]) | `qa/results/areamultiaxis/2026-09-02T13-41-32-519Z/hover-30-diff.png` |  |
| `qa:bar/100:hover-dim` | hover-dim | bar/100 | hover-30: 4025 px (out-of-range, mode 0, hist [0,3308])<br>hover-50: 4147 px (out-of-range, mode 727, hist [0,3425])<br>hover-70: 4433 px (out-of-range, mode 1193, hist [0,3719]) | `qa/results/bar/2026-09-02T13-41-38-828Z/hover-30-diff.png`<br>`qa/results/bar/2026-09-02T13-41-38-828Z/hover-50-diff.png`<br>`qa/results/bar/2026-09-02T13-41-38-828Z/hover-70-diff.png` |  |
| `qa:bardepth/100:motion/reveal` | motion/reveal | bardepth/100 | depth-off: 246134 px (out-of-range, mode 650, hist [228,245429]) | `qa/results/bardepth/2026-09-02T13-41-46-096Z/depth-off-diff.png` |  |
| `qa:barloading/100:motion/reveal` | motion/reveal | barloading/100 | settled: 18399 px (in-range, mode 18216, hist [18124,51852])<br>hover-30: 159444 px (in-range, mode 158874, hist [158874,161019])<br>hover-50: 161019 px (in-range, mode 161336, hist [142625,161353])<br>hover-70: 133268 px (in-range, mode 164456, hist [132903,164456]) | `qa/results/barloading/2026-09-02T13-41-51-074Z/settled-diff.png`<br>`qa/results/barloading/2026-09-02T13-41-51-074Z/hover-30-diff.png`<br>`qa/results/barloading/2026-09-02T13-41-51-074Z/hover-50-diff.png`<br>`qa/results/barloading/2026-09-02T13-41-51-074Z/hover-70-diff.png` |  |
| `qa:barsquares/100:axis` | axis | barsquares/100 | settled: 951 px (out-of-range, mode 44, hist [44,53]) | `qa/results/barsquares/2026-09-02T13-42-13-812Z/settled-diff.png` |  |
| `qa:barsquares/100:hover-dim` | hover-dim | barsquares/100 | hover-30: 3656 px (out-of-range, mode 1309, hist [353,1419])<br>hover-50: 3309 px (out-of-range, mode 294, hist [294,1542])<br>hover-70: 3447 px (out-of-range, mode 1427, hist [731,1675]) | `qa/results/barsquares/2026-09-02T13-42-13-812Z/hover-30-diff.png`<br>`qa/results/barsquares/2026-09-02T13-42-13-812Z/hover-50-diff.png`<br>`qa/results/barsquares/2026-09-02T13-42-13-812Z/hover-70-diff.png` |  |
| `qa:barsquares/100:legend` | legend | barsquares/100 | legend-hover-0: 3451 px (out-of-range, mode 502, hist [246,1298])<br>legend-hover-1: 3490 px (out-of-range, mode 503, hist [237,605])<br>legend-hover-clear: 3451 px (out-of-range, mode 354, hist [235,604]) | `qa/results/barsquares/2026-09-02T13-42-13-812Z/legend-hover-0-diff.png`<br>`qa/results/barsquares/2026-09-02T13-42-13-812Z/legend-hover-1-diff.png`<br>`qa/results/barsquares/2026-09-02T13-42-13-812Z/legend-hover-clear-diff.png` |  |
| `qa:brush/1000:axis` | axis | brush/1000 | settled: 401 px (out-of-range, mode 1, hist [1,227]) | `qa/results/brush/2026-09-02T13-42-20-710Z/settled-diff.png` |  |
| `qa:brush/1000:brush/zoom` | brush/zoom | brush/1000 | brush-left-half: 630 px (out-of-range, mode 233, hist [233,348])<br>brush-right-half: 689 px (out-of-range, mode 498, hist [498,622])<br>brush-hover-50: 2644 px (out-of-range, mode 890, hist [890,1015])<br>brush-clear: 401 px (out-of-range, mode 1, hist [1,227]) | `qa/results/brush/2026-09-02T13-42-20-710Z/brush-left-half-diff.png`<br>`qa/results/brush/2026-09-02T13-42-20-710Z/brush-right-half-diff.png`<br>`qa/results/brush/2026-09-02T13-42-20-710Z/brush-hover-50-diff.png`<br>`qa/results/brush/2026-09-02T13-42-20-710Z/brush-clear-diff.png` |  |
| `qa:candlestick/1000:renderer-regime` | renderer-regime | candlestick/1000 | hover-30: 7343 px (out-of-range, mode 4764, hist [4609,6814])<br>hover-50: 6294 px (out-of-range, mode 3515, hist [3094,5784])<br>hover-70: 6171 px (out-of-range, mode 3482, hist [3113,5657]) | `qa/results/candlestick/2026-09-02T13-42-35-501Z/hover-30-diff.png`<br>`qa/results/candlestick/2026-09-02T13-42-35-501Z/hover-50-diff.png`<br>`qa/results/candlestick/2026-09-02T13-42-35-501Z/hover-70-diff.png` |  |
| `qa:composedstacked/100:hover-dim` | hover-dim | composedstacked/100 | hover-30: 5374 px (in-range, mode 1106, hist [129,13104])<br>hover-50: 5530 px (in-range, mode 1181, hist [129,11720])<br>hover-70: 5432 px (in-range, mode 1125, hist [1125,8880]) | `qa/results/composedstacked/2026-09-02T13-43-05-506Z/hover-30-diff.png`<br>`qa/results/composedstacked/2026-09-02T13-43-05-506Z/hover-50-diff.png`<br>`qa/results/composedstacked/2026-09-02T13-43-05-506Z/hover-70-diff.png` |  |
| `qa:liveline/100:axis` | axis | liveline/100 | settled: 4131 px (out-of-range, mode 160, hist [160,4013]) | `qa/results/liveline/2026-09-02T13-48-50-886Z/settled-diff.png` |  |
| `qa:liveline/100:hover-dim` | hover-dim | liveline/100 | hover-30: 7300 px (out-of-range, mode 486, hist [486,7017])<br>hover-50: 7440 px (out-of-range, mode 644, hist [644,7420])<br>hover-70: 7608 px (out-of-range, mode 982, hist [982,7443]) | `qa/results/liveline/2026-09-02T13-48-50-886Z/hover-30-diff.png`<br>`qa/results/liveline/2026-09-02T13-48-50-886Z/hover-50-diff.png`<br>`qa/results/liveline/2026-09-02T13-48-50-886Z/hover-70-diff.png` |  |
| `qa:markers/100:hover-dim` | hover-dim | markers/100 | hover-30: 13650 px (in-range, mode 3717, hist [3574,15483])<br>hover-50: 12519 px (in-range, mode 1750, hist [840,15244])<br>hover-70: 13211 px (in-range, mode 3633, hist [3328,15251]) | `qa/results/markers/2026-09-02T13-49-04-395Z/hover-30-diff.png`<br>`qa/results/markers/2026-09-02T13-49-04-395Z/hover-50-diff.png`<br>`qa/results/markers/2026-09-02T13-49-04-395Z/hover-70-diff.png` |  |
| `qa:markers/100:legend` | legend | markers/100 | legend-hover-0: 12922 px (in-range, mode 3811, hist [3756,18168])<br>legend-hover-1: 12316 px (in-range, mode 3757, hist [3729,17740])<br>legend-hover-clear: 12316 px (in-range, mode 3755, hist [3731,16612]) | `qa/results/markers/2026-09-02T13-49-04-395Z/legend-hover-0-diff.png`<br>`qa/results/markers/2026-09-02T13-49-04-395Z/legend-hover-1-diff.png`<br>`qa/results/markers/2026-09-02T13-49-04-395Z/legend-hover-clear-diff.png` |  |
| `qa:projection/1000:axis` | axis | projection/1000 | settled: 547 px (out-of-range, mode 158, hist [40,545]) | `qa/results/projection/2026-09-02T13-50-53-161Z/settled-diff.png` |  |
| `qa:radar/6:polar` | polar | radar/6 | hover-50: 6544 px (out-of-range, mode 852, hist [851,6542]) | `qa/results/radar/2026-09-02T13-51-06-565Z/hover-50-diff.png` |  |
| `qa:refareamultiaxis/1000:hover-dim` | hover-dim | refareamultiaxis/1000 | hover-30: 8845 px (in-range, mode 1754, hist [0,300532])<br>hover-50: 9045 px (in-range, mode 2688, hist [764,301423])<br>hover-70: 9331 px (in-range, mode 3617, hist [1713,301910]) | `qa/results/refareamultiaxis/2026-09-02T13-51-19-099Z/hover-30-diff.png`<br>`qa/results/refareamultiaxis/2026-09-02T13-51-19-099Z/hover-50-diff.png`<br>`qa/results/refareamultiaxis/2026-09-02T13-51-19-099Z/hover-70-diff.png` |  |
| `qa:ring/4:polar` | polar | ring/4 | hover-50: 2963 px (out-of-range, mode 2995, hist [2965,15233]) | `qa/results/ring/2026-09-02T13-51-26-097Z/hover-50-diff.png` |  |
| `qa:sankey/33:hover-dim` | hover-dim | sankey/33 | hover-30: 11109 px (in-range, mode 3690, hist [3506,31888])<br>hover-70: 7512 px (in-range, mode 1761, hist [1270,11636]) | `qa/results/sankey/2026-09-02T13-51-32-870Z/hover-30-diff.png`<br>`qa/results/sankey/2026-09-02T13-51-32-870Z/hover-70-diff.png` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-30: 143154 px (seen, mode 0, hist [0,143154])<br>hover-50: 142236 px (in-range, mode 748, hist [0,142237])<br>hover-70: 143606 px (in-range, mode 2847, hist [2018,143608]) | `qa/results/scatter/2026-09-02T13-51-40-577Z/hover-30-diff.png`<br>`qa/results/scatter/2026-09-02T13-51-40-577Z/hover-50-diff.png`<br>`qa/results/scatter/2026-09-02T13-51-40-577Z/hover-70-diff.png` |  |
| `qa:scattermultiaxis/1000:renderer-regime` | renderer-regime | scattermultiaxis/1000 | hover-30: 125900 px (seen, mode 0, hist [0,127866])<br>hover-50: 124935 px (in-range, mode 748, hist [0,128172])<br>hover-70: 127833 px (in-range, mode 2123, hist [2123,129924]) | `qa/results/scattermultiaxis/2026-09-02T13-51-48-514Z/hover-30-diff.png`<br>`qa/results/scattermultiaxis/2026-09-02T13-51-48-514Z/hover-50-diff.png`<br>`qa/results/scattermultiaxis/2026-09-02T13-51-48-514Z/hover-70-diff.png` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| bar | 100 | hover-30 | 4025 | [0,3308] | 0 |
| bar | 100 | hover-50 | 4147 | [0,3425] | 727 |
| bar | 100 | hover-70 | 4433 | [0,3719] | 1193 |
| barsquares | 100 | settled | 951 | [44,53] | 44 |
| barsquares | 100 | hover-30 | 3656 | [353,1419] | 1309 |
| barsquares | 100 | hover-50 | 3309 | [294,1542] | 294 |
| barsquares | 100 | hover-70 | 3447 | [731,1675] | 1427 |
| barsquares | 100 | legend-hover-0 | 3451 | [246,1298] | 502 |
| barsquares | 100 | legend-hover-1 | 3490 | [237,605] | 503 |
| barsquares | 100 | legend-hover-clear | 3451 | [235,604] | 354 |
| brush | 1000 | settled | 401 | [1,227] | 1 |
| brush | 1000 | brush-left-half | 630 | [233,348] | 233 |
| brush | 1000 | brush-right-half | 689 | [498,622] | 498 |
| brush | 1000 | brush-hover-50 | 2644 | [890,1015] | 890 |
| brush | 1000 | brush-clear | 401 | [1,227] | 1 |
| liveline | 100 | settled | 4131 | [160,4013] | 160 |
| projection | 1000 | settled | 547 | [40,545] | 158 |
| ring | 4 | hover-50 | 2963 | [2965,15233] | 2995 |
