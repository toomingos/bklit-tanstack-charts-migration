# Bundle gate

Generated 2026-09-07T21:27:11.627Z. Sizes: bench/results/bundle-sizes.json (re-measured, exit 0, 21.9s); pins: bench/results/bundle-gate.json (pinned 2026-09-07 HEAD 8661481 (adopted from the 7.6 gate run docs/phase-7/gate/runs/2026-09-07T09-01-26-415Z, D595; @tanstack/charts 0.16.0; previous pin 2026-09-05 61d6179, which predated V3.9 and left 30 of 43 scenarios failing on stale bytes). Note migrated/barloading: the previous pin was 2449 bytes, which is not a bundle -- that scenario's measurement was broken when the 61d6179 pins were stamped, and the row read as passing only because nothing can be smaller than it. Now 83837., tolerance 3%); scripts/bundle-gate.mjs exit 0.

**43 pinned scenarios: 0 FAIL, 0 missing, summed gzip 5534 kB vs pins 6443 kB (-14.1%). Largest delta: migrated/barloading -30.8%.**

## Pinned (migrated)

| scenario | gzip | pin | limit | Δ% | verdict |
| --- | --- | --- | --- | --- | --- |
| migrated/area | 152275 | 173167 | 178362 | -12.06 | ok |
| migrated/arealoading | 62939 | 88786 | 91450 | -29.11 | ok |
| migrated/areamultiaxis | 152387 | 173270 | 178468 | -12.05 | ok |
| migrated/bar | 135839 | 161041 | 165872 | -15.65 | ok |
| migrated/bardepth | 136259 | 161260 | 166098 | -15.5 | ok |
| migrated/barloading | 58013 | 83837 | 86352 | -30.8 | ok |
| migrated/barmultiaxis | 135930 | 161103 | 165936 | -15.63 | ok |
| migrated/barsquares | 148209 | 173387 | 178589 | -14.52 | ok |
| migrated/brush | 181256 | 180805 | 186229 | +0.25 | ok |
| migrated/candlestick | 133046 | 154710 | 159351 | -14 | ok |
| migrated/candlestick-legend | 145153 | 165688 | 170659 | -12.39 | ok |
| migrated/candletween | 133105 | 154781 | 159424 | -14 | ok |
| migrated/choropleth | 139305 | 152133 | 156697 | -8.43 | ok |
| migrated/composed | 144830 | 165372 | 170333 | -12.42 | ok |
| migrated/composedmultiaxis | 144906 | 165436 | 170399 | -12.41 | ok |
| migrated/composedstacked | 144804 | 165361 | 170322 | -12.43 | ok |
| migrated/funnel | 102704 | 128336 | 132186 | -19.97 | ok |
| migrated/funnelvertical | 102723 | 128353 | 132204 | -19.97 | ok |
| migrated/gauge | 119062 | 145019 | 149370 | -17.9 | ok |
| migrated/gaugelinear | 119163 | 145121 | 149475 | -17.89 | ok |
| migrated/griddefault | 152035 | 172761 | 177944 | -12 | ok |
| migrated/heatmap | 115888 | 141906 | 146163 | -18.33 | ok |
| migrated/legend | 12581 | 12581 | 12958 | 0 | ok |
| migrated/legendhover | 177198 | 197415 | 203337 | -10.24 | ok |
| migrated/line | 152103 | 172829 | 178014 | -11.99 | ok |
| migrated/linemultiaxis | 152174 | 172882 | 178068 | -11.98 | ok |
| migrated/liveline | 131227 | 152803 | 157387 | -14.12 | ok |
| migrated/markers | 163160 | 183669 | 189179 | -11.17 | ok |
| migrated/patternarea | 152345 | 173236 | 178433 | -12.06 | ok |
| migrated/pie | 105900 | 131765 | 135718 | -19.63 | ok |
| migrated/profitloss | 159465 | 180947 | 186375 | -11.87 | ok |
| migrated/projection | 155037 | 175888 | 181165 | -11.85 | ok |
| migrated/projectionxdomain | 155110 | 175945 | 181223 | -11.84 | ok |
| migrated/radar | 108457 | 134400 | 138432 | -19.3 | ok |
| migrated/refarea | 152175 | 172876 | 178062 | -11.97 | ok |
| migrated/refareamultiaxis | 152277 | 173016 | 178206 | -11.99 | ok |
| migrated/ring | 115510 | 141569 | 145816 | -18.41 | ok |
| migrated/sankey | 117769 | 143750 | 148063 | -18.07 | ok |
| migrated/scatter | 131357 | 152744 | 157326 | -14 | ok |
| migrated/scattermultiaxis | 131368 | 152763 | 157346 | -14.01 | ok |
| migrated/segment | 152133 | 172877 | 178063 | -12 | ok |
| migrated/sunburst | 114546 | 140576 | 144793 | -18.52 | ok |
| migrated/sunchrome | 115299 | 141388 | 145630 | -18.45 | ok |

## Unpinned (informational: bklit / tanstack controls)

| scenario | gzip | raw | note |
| --- | --- | --- | --- |
| bklit/area | 136508 | 392836 | info |
| bklit/arealoading | 90835 | 268332 | info |
| bklit/areamultiaxis | 136590 | 393069 | info |
| bklit/bar | 121716 | 350432 | info |
| bklit/bardepth | 125221 | 361579 | info |
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

**43 migrated cells: 25 over, 0 without control. Worst: migrated/sunburst 1.311.**

| scenario | migrated gzip | bklit gzip | ratio | verdict |
| --- | --- | --- | --- | --- |
| migrated/sunburst | 114546 | 87399 | 1.311 | **FAIL** |
| migrated/sunchrome | 115299 | 88013 | 1.31 | **FAIL** |
| migrated/brush | 181256 | 151525 | 1.196 | **FAIL** |
| migrated/legendhover | 177198 | 148750 | 1.191 | **FAIL** |
| migrated/gauge | 119062 | 100795 | 1.181 | **FAIL** |
| migrated/gaugelinear | 119163 | 100900 | 1.181 | **FAIL** |
| migrated/sankey | 117769 | 100947 | 1.167 | **FAIL** |
| migrated/choropleth | 139305 | 119551 | 1.165 | **FAIL** |
| migrated/barsquares | 148209 | 127321 | 1.164 | **FAIL** |
| migrated/profitloss | 159465 | 138423 | 1.152 | **FAIL** |
| migrated/candlestick-legend | 145153 | 128452 | 1.13 | **FAIL** |
| migrated/funnel | 102704 | 90965 | 1.129 | **FAIL** |
| migrated/funnelvertical | 102723 | 90982 | 1.129 | **FAIL** |
| migrated/markers | 163160 | 145356 | 1.122 | **FAIL** |
| migrated/projection | 155037 | 138627 | 1.118 | **FAIL** |
| migrated/projectionxdomain | 155110 | 138713 | 1.118 | **FAIL** |
| migrated/area | 152275 | 136508 | 1.116 | **FAIL** |
| migrated/areamultiaxis | 152387 | 136590 | 1.116 | **FAIL** |
| migrated/bar | 135839 | 121716 | 1.116 | **FAIL** |
| migrated/barmultiaxis | 135930 | 121779 | 1.116 | **FAIL** |
| migrated/griddefault | 152035 | 136221 | 1.116 | **FAIL** |
| migrated/line | 152103 | 136280 | 1.116 | **FAIL** |
| migrated/linemultiaxis | 152174 | 136344 | 1.116 | **FAIL** |
| migrated/ring | 115510 | 103908 | 1.112 | **FAIL** |
| migrated/patternarea | 152345 | 138299 | 1.102 | **FAIL** |
| migrated/segment | 152133 | 138331 | 1.1 | ok |
| migrated/refarea | 152175 | 139220 | 1.093 | ok |
| migrated/refareamultiaxis | 152277 | 139326 | 1.093 | ok |
| migrated/pie | 105900 | 97053 | 1.091 | ok |
| migrated/bardepth | 136259 | 125221 | 1.088 | ok |
| migrated/legend | 12581 | 11657 | 1.079 | ok |
| migrated/candlestick | 133046 | 124781 | 1.066 | ok |
| migrated/candletween | 133105 | 124853 | 1.066 | ok |
| migrated/liveline | 131227 | 123209 | 1.065 | ok |
| migrated/scatter | 131357 | 123780 | 1.061 | ok |
| migrated/scattermultiaxis | 131368 | 123798 | 1.061 | ok |
| migrated/composed | 144830 | 139058 | 1.042 | ok |
| migrated/composedmultiaxis | 144906 | 139146 | 1.041 | ok |
| migrated/composedstacked | 144804 | 139095 | 1.041 | ok |
| migrated/radar | 108457 | 106927 | 1.014 | ok |
| migrated/heatmap | 115888 | 123718 | 0.937 | ok |
| migrated/barloading | 58013 | 70063 | 0.828 | ok |
| migrated/arealoading | 62939 | 90835 | 0.693 | ok |

## CSS

| scenario | migrated CSS gzip | bklit CSS gzip | ratio |
| --- | --- | --- | --- |
| migrated/area | 2172 | 0 | — |
| migrated/arealoading | 2172 | 0 | — |
| migrated/areamultiaxis | 2172 | 0 | — |
| migrated/bar | 2172 | 0 | — |
| migrated/bardepth | 2172 | 0 | — |
| migrated/barloading | 2172 | 0 | — |
| migrated/barmultiaxis | 2172 | 0 | — |
| migrated/barsquares | 2172 | 0 | — |
| migrated/brush | 2172 | 0 | — |
| migrated/candlestick-legend | 2172 | 0 | — |
| migrated/candlestick | 2172 | 0 | — |
| migrated/candletween | 2172 | 0 | — |
| migrated/choropleth | 2172 | 0 | — |
| migrated/composed | 2172 | 0 | — |
| migrated/composedmultiaxis | 2172 | 0 | — |
| migrated/composedstacked | 2172 | 0 | — |
| migrated/funnel | 2172 | 0 | — |
| migrated/funnelvertical | 2172 | 0 | — |
| migrated/gauge | 2172 | 0 | — |
| migrated/gaugelinear | 2172 | 0 | — |
| migrated/griddefault | 2172 | 0 | — |
| migrated/heatmap | 2172 | 0 | — |
| migrated/legend | 2172 | 0 | — |
| migrated/legendhover | 2172 | 0 | — |
| migrated/line | 2172 | 0 | — |
| migrated/linemultiaxis | 2172 | 0 | — |
| migrated/liveline | 2172 | 0 | — |
| migrated/markers | 2172 | 0 | — |
| migrated/patternarea | 2172 | 0 | — |
| migrated/pie | 2172 | 0 | — |
| migrated/profitloss | 2172 | 0 | — |
| migrated/projection | 2172 | 0 | — |
| migrated/projectionxdomain | 2172 | 0 | — |
| migrated/radar | 2172 | 0 | — |
| migrated/refarea | 2172 | 0 | — |
| migrated/refareamultiaxis | 2172 | 0 | — |
| migrated/ring | 2172 | 0 | — |
| migrated/sankey | 2172 | 0 | — |
| migrated/scatter | 2172 | 0 | — |
| migrated/scattermultiaxis | 2172 | 0 | — |
| migrated/segment | 2172 | 0 | — |
| migrated/sunburst | 2172 | 0 | — |
| migrated/sunchrome | 2172 | 0 | — |
