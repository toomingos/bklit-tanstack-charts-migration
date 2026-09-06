# Bundle gate

Generated 2026-09-06T16:36:30.864Z. Sizes: bench/results/bundle-sizes.json (re-measured, exit 0, 11.9s); pins: bench/results/bundle-gate.json (pinned 2026-09-05 HEAD 61d6179 (V0.3 baseline, @tanstack/charts 0.16.0; previous pin 2026-09-01 c1e9ced), tolerance 3%); scripts/bundle-gate.mjs exit 1.

**43 pinned scenarios: 30 FAIL, 0 missing, summed gzip 6440 kB vs pins 5474 kB (+17.66%). Largest delta: migrated/barloading +3323.32%.**

## Pinned (migrated)

| scenario | gzip | pin | limit | Δ% | verdict |
| --- | --- | --- | --- | --- | --- |
| migrated/area | 173167 | 168043 | 173084 | +3.05 | **FAIL** |
| migrated/arealoading | 86177 | 127922 | 131760 | -32.63 | ok |
| migrated/areamultiaxis | 173270 | 168116 | 173159 | +3.07 | **FAIL** |
| migrated/bar | 161041 | 134546 | 138582 | +19.69 | **FAIL** |
| migrated/bardepth | 161260 | 134747 | 138789 | +19.68 | **FAIL** |
| migrated/barloading | 83837 | 2449 | 2522 | +3323.32 | **FAIL** |
| migrated/barmultiaxis | 161103 | 134603 | 138641 | +19.69 | **FAIL** |
| migrated/barsquares | 173389 | 146726 | 151128 | +18.17 | **FAIL** |
| migrated/brush | 180795 | 178442 | 183795 | +1.32 | ok |
| migrated/candlestick | 154710 | 127176 | 130991 | +21.65 | **FAIL** |
| migrated/candlestick-legend | 165694 | 137813 | 141947 | +20.23 | **FAIL** |
| migrated/candletween | 154781 | 127244 | 131061 | +21.64 | **FAIL** |
| migrated/choropleth | 152133 | 119026 | 122597 | +27.81 | **FAIL** |
| migrated/composed | 165372 | 140194 | 144400 | +17.96 | **FAIL** |
| migrated/composedmultiaxis | 165436 | 140253 | 144461 | +17.96 | **FAIL** |
| migrated/composedstacked | 165361 | 140180 | 144385 | +17.96 | **FAIL** |
| migrated/funnel | 128336 | 48669 | 50129 | +163.69 | **FAIL** |
| migrated/funnelvertical | 128353 | 48688 | 50149 | +163.62 | **FAIL** |
| migrated/gauge | 145019 | 104637 | 107776 | +38.59 | **FAIL** |
| migrated/gaugelinear | 145121 | 104744 | 107886 | +38.55 | **FAIL** |
| migrated/griddefault | 172761 | 170324 | 175434 | +1.43 | ok |
| migrated/heatmap | 141906 | 105621 | 108790 | +34.35 | **FAIL** |
| migrated/legend | 12594 | 12434 | 12807 | +1.29 | ok |
| migrated/legendhover | 197410 | 174096 | 179319 | +13.39 | **FAIL** |
| migrated/line | 172829 | 170390 | 175502 | +1.43 | ok |
| migrated/linemultiaxis | 172882 | 170469 | 175583 | +1.42 | ok |
| migrated/liveline | 152803 | 125519 | 129285 | +21.74 | **FAIL** |
| migrated/markers | 183667 | 181897 | 187354 | +0.97 | ok |
| migrated/patternarea | 173236 | 168100 | 173143 | +3.06 | **FAIL** |
| migrated/pie | 131765 | 92430 | 95203 | +42.56 | **FAIL** |
| migrated/profitloss | 180929 | 178434 | 183787 | +1.4 | ok |
| migrated/projection | 175888 | 173485 | 178690 | +1.39 | ok |
| migrated/projectionxdomain | 175945 | 173534 | 178740 | +1.39 | ok |
| migrated/radar | 134400 | 103613 | 106721 | +29.71 | **FAIL** |
| migrated/refarea | 172876 | 170480 | 175594 | +1.41 | ok |
| migrated/refareamultiaxis | 173016 | 170607 | 175725 | +1.41 | ok |
| migrated/ring | 141569 | 102295 | 105364 | +38.39 | **FAIL** |
| migrated/sankey | 143750 | 104293 | 107422 | +37.83 | **FAIL** |
| migrated/scatter | 152744 | 126075 | 129857 | +21.15 | **FAIL** |
| migrated/scattermultiaxis | 152763 | 126095 | 129878 | +21.15 | **FAIL** |
| migrated/segment | 172877 | 170460 | 175574 | +1.42 | ok |
| migrated/sunburst | 140576 | 99807 | 102801 | +40.85 | **FAIL** |
| migrated/sunchrome | 141388 | 100467 | 103481 | +40.73 | **FAIL** |

## Unpinned (informational: bklit / tanstack controls)

| scenario | gzip | raw | note |
| --- | --- | --- | --- |
| bklit/area | 136508 | 392836 | info |
| bklit/arealoading | 90835 | 268332 | info |
| bklit/areamultiaxis | 136590 | 393069 | info |
| bklit/bar | 121716 | 350432 | info |
| bklit/bardepth | 124441 | 359746 | info |
| bklit/barloading | 70063 | 210225 | info |
| bklit/barmultiaxis | 121779 | 350552 | info |
| bklit/barsquares | 127321 | 368279 | info |
| bklit/brush | 151525 | 442298 | info |
| bklit/candlestick-legend | 128452 | 367827 | info |
| bklit/candlestick | 124781 | 357327 | info |
| bklit/candletween | 124853 | 357425 | info |
| bklit/choropleth | 119551 | 340272 | info |
| bklit/composed | 139058 | 399506 | info |
| bklit/composedmultiaxis | 139146 | 399651 | info |
| bklit/composedstacked | 139095 | 399524 | info |
| bklit/funnel | 90965 | 262607 | info |
| bklit/funnelvertical | 90982 | 262646 | info |
| bklit/gauge | 100795 | 290188 | info |
| bklit/gaugelinear | 100900 | 290314 | info |
| bklit/griddefault | 136221 | 392021 | info |
| bklit/heatmap | 123718 | 353706 | info |
| bklit/legend | 11657 | 34545 | info |
| bklit/legendhover | 148750 | 425995 | info |
| bklit/line | 136280 | 392109 | info |
| bklit/linemultiaxis | 136344 | 392289 | info |
| bklit/liveline | 123209 | 350841 | info |
| bklit/markers | 145356 | 415558 | info |
| bklit/patternarea | 138299 | 398992 | info |
| bklit/pie | 97053 | 276245 | info |
| bklit/profitloss | 138423 | 398048 | info |
| bklit/projection | 138627 | 398456 | info |
| bklit/projectionxdomain | 138713 | 398541 | info |
| bklit/radar | 106927 | 309965 | info |
| bklit/refarea | 139220 | 401391 | info |
| bklit/refareamultiaxis | 139326 | 401679 | info |
| bklit/ring | 103908 | 296392 | info |
| bklit/sankey | 100947 | 286160 | info |
| bklit/scatter | 123780 | 354104 | info |
| bklit/scattermultiaxis | 123798 | 354120 | info |
| bklit/segment | 138331 | 397505 | info |
| bklit/sunburst | 87399 | 247187 | info |
| bklit/sunchrome | 88013 | 248449 | info |
| tanstack/area | 88781 | 246431 | info |
| tanstack/bar | 83286 | 229332 | info |
| tanstack/candlestick | 84278 | 234804 | info |
| tanstack/choropleth | 79101 | 215632 | info |
| tanstack/composed | 91486 | 254454 | info |
| tanstack/funnel | 83063 | 228504 | info |
| tanstack/funnelvertical | 83070 | 228517 | info |
| tanstack/gauge | 73250 | 200454 | info |
| tanstack/gaugelinear | 79639 | 217347 | info |
| tanstack/heatmap | 74788 | 205223 | info |
| tanstack/line | 86650 | 241273 | info |
| tanstack/liveline | 84495 | 235068 | info |
| tanstack/pie | 73394 | 201223 | info |
| tanstack/radar | 83038 | 231277 | info |
| tanstack/ring | 73389 | 200573 | info |
| tanstack/sankey | 72245 | 199141 | info |
| tanstack/scatter | 84613 | 235792 | info |
| tanstack/sunburst | 73573 | 201059 | info |

## Parity vs bklit (<= 1.10, no allowances)

**43 migrated cells: 41 over, 0 without control. Worst: migrated/sunburst 1.608.**

| scenario | migrated gzip | bklit gzip | ratio | verdict |
| --- | --- | --- | --- | --- |
| migrated/sunburst | 140576 | 87399 | 1.608 | **FAIL** |
| migrated/sunchrome | 141388 | 88013 | 1.606 | **FAIL** |
| migrated/gauge | 145019 | 100795 | 1.439 | **FAIL** |
| migrated/gaugelinear | 145121 | 100900 | 1.438 | **FAIL** |
| migrated/sankey | 143750 | 100947 | 1.424 | **FAIL** |
| migrated/funnel | 128336 | 90965 | 1.411 | **FAIL** |
| migrated/funnelvertical | 128353 | 90982 | 1.411 | **FAIL** |
| migrated/barsquares | 173389 | 127321 | 1.362 | **FAIL** |
| migrated/ring | 141569 | 103908 | 1.362 | **FAIL** |
| migrated/pie | 131765 | 97053 | 1.358 | **FAIL** |
| migrated/legendhover | 197410 | 148750 | 1.327 | **FAIL** |
| migrated/bar | 161041 | 121716 | 1.323 | **FAIL** |
| migrated/barmultiaxis | 161103 | 121779 | 1.323 | **FAIL** |
| migrated/profitloss | 180929 | 138423 | 1.307 | **FAIL** |
| migrated/bardepth | 161260 | 124441 | 1.296 | **FAIL** |
| migrated/candlestick-legend | 165694 | 128452 | 1.29 | **FAIL** |
| migrated/choropleth | 152133 | 119551 | 1.273 | **FAIL** |
| migrated/area | 173167 | 136508 | 1.269 | **FAIL** |
| migrated/areamultiaxis | 173270 | 136590 | 1.269 | **FAIL** |
| migrated/projection | 175888 | 138627 | 1.269 | **FAIL** |
| migrated/griddefault | 172761 | 136221 | 1.268 | **FAIL** |
| migrated/line | 172829 | 136280 | 1.268 | **FAIL** |
| migrated/linemultiaxis | 172882 | 136344 | 1.268 | **FAIL** |
| migrated/projectionxdomain | 175945 | 138713 | 1.268 | **FAIL** |
| migrated/markers | 183667 | 145356 | 1.264 | **FAIL** |
| migrated/radar | 134400 | 106927 | 1.257 | **FAIL** |
| migrated/patternarea | 173236 | 138299 | 1.253 | **FAIL** |
| migrated/segment | 172877 | 138331 | 1.25 | **FAIL** |
| migrated/refarea | 172876 | 139220 | 1.242 | **FAIL** |
| migrated/refareamultiaxis | 173016 | 139326 | 1.242 | **FAIL** |
| migrated/candlestick | 154710 | 124781 | 1.24 | **FAIL** |
| migrated/candletween | 154781 | 124853 | 1.24 | **FAIL** |
| migrated/liveline | 152803 | 123209 | 1.24 | **FAIL** |
| migrated/scatter | 152744 | 123780 | 1.234 | **FAIL** |
| migrated/scattermultiaxis | 152763 | 123798 | 1.234 | **FAIL** |
| migrated/barloading | 83837 | 70063 | 1.197 | **FAIL** |
| migrated/brush | 180795 | 151525 | 1.193 | **FAIL** |
| migrated/composed | 165372 | 139058 | 1.189 | **FAIL** |
| migrated/composedmultiaxis | 165436 | 139146 | 1.189 | **FAIL** |
| migrated/composedstacked | 165361 | 139095 | 1.189 | **FAIL** |
| migrated/heatmap | 141906 | 123718 | 1.147 | **FAIL** |
| migrated/legend | 12594 | 11657 | 1.08 | ok |
| migrated/arealoading | 86177 | 90835 | 0.949 | ok |

## CSS

| scenario | migrated CSS gzip | bklit CSS gzip | ratio |
| --- | --- | --- | --- |
| migrated/area | 2087 | 0 | — |
| migrated/arealoading | 2087 | 0 | — |
| migrated/areamultiaxis | 2087 | 0 | — |
| migrated/bar | 2087 | 0 | — |
| migrated/bardepth | 2087 | 0 | — |
| migrated/barloading | 2087 | 0 | — |
| migrated/barmultiaxis | 2087 | 0 | — |
| migrated/barsquares | 2087 | 0 | — |
| migrated/brush | 2087 | 0 | — |
| migrated/candlestick-legend | 2087 | 0 | — |
| migrated/candlestick | 2087 | 0 | — |
| migrated/candletween | 2087 | 0 | — |
| migrated/choropleth | 2087 | 0 | — |
| migrated/composed | 2087 | 0 | — |
| migrated/composedmultiaxis | 2087 | 0 | — |
| migrated/composedstacked | 2087 | 0 | — |
| migrated/funnel | 2087 | 0 | — |
| migrated/funnelvertical | 2087 | 0 | — |
| migrated/gauge | 2087 | 0 | — |
| migrated/gaugelinear | 2087 | 0 | — |
| migrated/griddefault | 2087 | 0 | — |
| migrated/heatmap | 2087 | 0 | — |
| migrated/legend | 2087 | 0 | — |
| migrated/legendhover | 2087 | 0 | — |
| migrated/line | 2087 | 0 | — |
| migrated/linemultiaxis | 2087 | 0 | — |
| migrated/liveline | 2087 | 0 | — |
| migrated/markers | 2087 | 0 | — |
| migrated/patternarea | 2087 | 0 | — |
| migrated/pie | 2087 | 0 | — |
| migrated/profitloss | 2087 | 0 | — |
| migrated/projection | 2087 | 0 | — |
| migrated/projectionxdomain | 2087 | 0 | — |
| migrated/radar | 2087 | 0 | — |
| migrated/refarea | 2087 | 0 | — |
| migrated/refareamultiaxis | 2087 | 0 | — |
| migrated/ring | 2087 | 0 | — |
| migrated/sankey | 2087 | 0 | — |
| migrated/scatter | 2087 | 0 | — |
| migrated/scattermultiaxis | 2087 | 0 | — |
| migrated/segment | 2087 | 0 | — |
| migrated/sunburst | 2087 | 0 | — |
| migrated/sunchrome | 2087 | 0 | — |
