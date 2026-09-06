# Bundle gate

Generated 2026-09-06T12:19:36.894Z. Sizes: bench/results/bundle-sizes.json (not re-measured); pins: bench/results/bundle-gate.json (pinned 2026-09-05 HEAD 61d6179 (V0.3 baseline, @tanstack/charts 0.16.0; previous pin 2026-09-01 c1e9ced), tolerance 3%); scripts/bundle-gate.mjs exit 0.

**43 pinned scenarios: 0 FAIL, 0 missing, summed gzip 5474 kB vs pins 5474 kB (0%). Largest delta: migrated/area 0%.**

## Pinned (migrated)

| scenario | gzip | pin | limit | Δ% | verdict |
| --- | --- | --- | --- | --- | --- |
| migrated/area | 168043 | 168043 | 173084 | 0 | ok |
| migrated/arealoading | 127922 | 127922 | 131760 | 0 | ok |
| migrated/areamultiaxis | 168116 | 168116 | 173159 | 0 | ok |
| migrated/bar | 134546 | 134546 | 138582 | 0 | ok |
| migrated/bardepth | 134747 | 134747 | 138789 | 0 | ok |
| migrated/barloading | 2449 | 2449 | 2522 | 0 | ok |
| migrated/barmultiaxis | 134603 | 134603 | 138641 | 0 | ok |
| migrated/barsquares | 146726 | 146726 | 151128 | 0 | ok |
| migrated/brush | 178442 | 178442 | 183795 | 0 | ok |
| migrated/candlestick | 127176 | 127176 | 130991 | 0 | ok |
| migrated/candlestick-legend | 137813 | 137813 | 141947 | 0 | ok |
| migrated/candletween | 127244 | 127244 | 131061 | 0 | ok |
| migrated/choropleth | 119026 | 119026 | 122597 | 0 | ok |
| migrated/composed | 140194 | 140194 | 144400 | 0 | ok |
| migrated/composedmultiaxis | 140253 | 140253 | 144461 | 0 | ok |
| migrated/composedstacked | 140180 | 140180 | 144385 | 0 | ok |
| migrated/funnel | 48669 | 48669 | 50129 | 0 | ok |
| migrated/funnelvertical | 48688 | 48688 | 50149 | 0 | ok |
| migrated/gauge | 104637 | 104637 | 107776 | 0 | ok |
| migrated/gaugelinear | 104744 | 104744 | 107886 | 0 | ok |
| migrated/griddefault | 170324 | 170324 | 175434 | 0 | ok |
| migrated/heatmap | 105621 | 105621 | 108790 | 0 | ok |
| migrated/legend | 12434 | 12434 | 12807 | 0 | ok |
| migrated/legendhover | 174096 | 174096 | 179319 | 0 | ok |
| migrated/line | 170390 | 170390 | 175502 | 0 | ok |
| migrated/linemultiaxis | 170469 | 170469 | 175583 | 0 | ok |
| migrated/liveline | 125519 | 125519 | 129285 | 0 | ok |
| migrated/markers | 181897 | 181897 | 187354 | 0 | ok |
| migrated/patternarea | 168100 | 168100 | 173143 | 0 | ok |
| migrated/pie | 92430 | 92430 | 95203 | 0 | ok |
| migrated/profitloss | 178434 | 178434 | 183787 | 0 | ok |
| migrated/projection | 173485 | 173485 | 178690 | 0 | ok |
| migrated/projectionxdomain | 173534 | 173534 | 178740 | 0 | ok |
| migrated/radar | 103613 | 103613 | 106721 | 0 | ok |
| migrated/refarea | 170480 | 170480 | 175594 | 0 | ok |
| migrated/refareamultiaxis | 170607 | 170607 | 175725 | 0 | ok |
| migrated/ring | 102295 | 102295 | 105364 | 0 | ok |
| migrated/sankey | 104293 | 104293 | 107422 | 0 | ok |
| migrated/scatter | 126075 | 126075 | 129857 | 0 | ok |
| migrated/scattermultiaxis | 126095 | 126095 | 129878 | 0 | ok |
| migrated/segment | 170460 | 170460 | 175574 | 0 | ok |
| migrated/sunburst | 99807 | 99807 | 102801 | 0 | ok |
| migrated/sunchrome | 100467 | 100467 | 103481 | 0 | ok |

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

**43 migrated cells: 21 over, 0 without control. Worst: migrated/arealoading 1.408.**

| scenario | migrated gzip | bklit gzip | ratio | verdict |
| --- | --- | --- | --- | --- |
| migrated/arealoading | 127922 | 90835 | 1.408 | **FAIL** |
| migrated/profitloss | 178434 | 138423 | 1.289 | **FAIL** |
| migrated/markers | 181897 | 145356 | 1.251 | **FAIL** |
| migrated/projection | 173485 | 138627 | 1.251 | **FAIL** |
| migrated/projectionxdomain | 173534 | 138713 | 1.251 | **FAIL** |
| migrated/griddefault | 170324 | 136221 | 1.25 | **FAIL** |
| migrated/line | 170390 | 136280 | 1.25 | **FAIL** |
| migrated/linemultiaxis | 170469 | 136344 | 1.25 | **FAIL** |
| migrated/segment | 170460 | 138331 | 1.232 | **FAIL** |
| migrated/area | 168043 | 136508 | 1.231 | **FAIL** |
| migrated/areamultiaxis | 168116 | 136590 | 1.231 | **FAIL** |
| migrated/refarea | 170480 | 139220 | 1.225 | **FAIL** |
| migrated/refareamultiaxis | 170607 | 139326 | 1.225 | **FAIL** |
| migrated/patternarea | 168100 | 138299 | 1.215 | **FAIL** |
| migrated/brush | 178442 | 151525 | 1.178 | **FAIL** |
| migrated/legendhover | 174096 | 148750 | 1.17 | **FAIL** |
| migrated/barsquares | 146726 | 127321 | 1.152 | **FAIL** |
| migrated/sunburst | 99807 | 87399 | 1.142 | **FAIL** |
| migrated/sunchrome | 100467 | 88013 | 1.142 | **FAIL** |
| migrated/bar | 134546 | 121716 | 1.105 | **FAIL** |
| migrated/barmultiaxis | 134603 | 121779 | 1.105 | **FAIL** |
| migrated/bardepth | 134747 | 124441 | 1.083 | ok |
| migrated/candlestick-legend | 137813 | 128452 | 1.073 | ok |
| migrated/legend | 12434 | 11657 | 1.067 | ok |
| migrated/gauge | 104637 | 100795 | 1.038 | ok |
| migrated/gaugelinear | 104744 | 100900 | 1.038 | ok |
| migrated/sankey | 104293 | 100947 | 1.033 | ok |
| migrated/candlestick | 127176 | 124781 | 1.019 | ok |
| migrated/candletween | 127244 | 124853 | 1.019 | ok |
| migrated/liveline | 125519 | 123209 | 1.019 | ok |
| migrated/scatter | 126075 | 123780 | 1.019 | ok |
| migrated/scattermultiaxis | 126095 | 123798 | 1.019 | ok |
| migrated/composed | 140194 | 139058 | 1.008 | ok |
| migrated/composedmultiaxis | 140253 | 139146 | 1.008 | ok |
| migrated/composedstacked | 140180 | 139095 | 1.008 | ok |
| migrated/choropleth | 119026 | 119551 | 0.996 | ok |
| migrated/ring | 102295 | 103908 | 0.984 | ok |
| migrated/radar | 103613 | 106927 | 0.969 | ok |
| migrated/pie | 92430 | 97053 | 0.952 | ok |
| migrated/heatmap | 105621 | 123718 | 0.854 | ok |
| migrated/funnel | 48669 | 90965 | 0.535 | ok |
| migrated/funnelvertical | 48688 | 90982 | 0.535 | ok |
| migrated/barloading | 2449 | 70063 | 0.035 | ok |

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
