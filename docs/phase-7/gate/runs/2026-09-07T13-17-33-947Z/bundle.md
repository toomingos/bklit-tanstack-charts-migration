# Bundle gate

Generated 2026-09-07T13:24:52.959Z. Sizes: bench/results/bundle-sizes.json (re-measured, exit 0, 21.8s); pins: bench/results/bundle-gate.json (pinned 2026-09-07 HEAD 8661481 (adopted from the 7.6 gate run docs/phase-7/gate/runs/2026-09-07T09-01-26-415Z, D595; @tanstack/charts 0.16.0; previous pin 2026-09-05 61d6179, which predated V3.9 and left 30 of 43 scenarios failing on stale bytes). Note migrated/barloading: the previous pin was 2449 bytes, which is not a bundle -- that scenario's measurement was broken when the 61d6179 pins were stamped, and the row read as passing only because nothing can be smaller than it. Now 83837., tolerance 3%); scripts/bundle-gate.mjs exit 0.

**43 pinned scenarios: 0 FAIL, 0 missing, summed gzip 6446 kB vs pins 6443 kB (+0.05%). Largest delta: migrated/bardepth +0.52%.**

## Pinned (migrated)

| scenario | gzip | pin | limit | Δ% | verdict |
| --- | --- | --- | --- | --- | --- |
| migrated/area | 173167 | 173167 | 178362 | 0 | ok |
| migrated/arealoading | 88788 | 88786 | 91450 | 0 | ok |
| migrated/areamultiaxis | 173270 | 173270 | 178468 | 0 | ok |
| migrated/bar | 161724 | 161041 | 165872 | +0.42 | ok |
| migrated/bardepth | 162104 | 161260 | 166098 | +0.52 | ok |
| migrated/barloading | 83837 | 83837 | 86352 | 0 | ok |
| migrated/barmultiaxis | 161779 | 161103 | 165936 | +0.42 | ok |
| migrated/barsquares | 173967 | 173387 | 178589 | +0.33 | ok |
| migrated/brush | 180803 | 180805 | 186229 | 0 | ok |
| migrated/candlestick | 154710 | 154710 | 159351 | 0 | ok |
| migrated/candlestick-legend | 165688 | 165688 | 170659 | 0 | ok |
| migrated/candletween | 154781 | 154781 | 159424 | 0 | ok |
| migrated/choropleth | 152133 | 152133 | 156697 | 0 | ok |
| migrated/composed | 165372 | 165372 | 170333 | 0 | ok |
| migrated/composedmultiaxis | 165436 | 165436 | 170399 | 0 | ok |
| migrated/composedstacked | 165361 | 165361 | 170322 | 0 | ok |
| migrated/funnel | 128336 | 128336 | 132186 | 0 | ok |
| migrated/funnelvertical | 128353 | 128353 | 132204 | 0 | ok |
| migrated/gauge | 145019 | 145019 | 149370 | 0 | ok |
| migrated/gaugelinear | 145121 | 145121 | 149475 | 0 | ok |
| migrated/griddefault | 172761 | 172761 | 177944 | 0 | ok |
| migrated/heatmap | 141906 | 141906 | 146163 | 0 | ok |
| migrated/legend | 12581 | 12581 | 12958 | 0 | ok |
| migrated/legendhover | 198114 | 197415 | 203337 | +0.35 | ok |
| migrated/line | 172829 | 172829 | 178014 | 0 | ok |
| migrated/linemultiaxis | 172882 | 172882 | 178068 | 0 | ok |
| migrated/liveline | 152803 | 152803 | 157387 | 0 | ok |
| migrated/markers | 183669 | 183669 | 189179 | 0 | ok |
| migrated/patternarea | 173236 | 173236 | 178433 | 0 | ok |
| migrated/pie | 131765 | 131765 | 135718 | 0 | ok |
| migrated/profitloss | 180947 | 180947 | 186375 | 0 | ok |
| migrated/projection | 175888 | 175888 | 181165 | 0 | ok |
| migrated/projectionxdomain | 175945 | 175945 | 181223 | 0 | ok |
| migrated/radar | 134400 | 134400 | 138432 | 0 | ok |
| migrated/refarea | 172876 | 172876 | 178062 | 0 | ok |
| migrated/refareamultiaxis | 173014 | 173016 | 178206 | 0 | ok |
| migrated/ring | 141569 | 141569 | 145816 | 0 | ok |
| migrated/sankey | 143750 | 143750 | 148063 | 0 | ok |
| migrated/scatter | 152768 | 152744 | 157326 | +0.02 | ok |
| migrated/scattermultiaxis | 152788 | 152763 | 157346 | +0.02 | ok |
| migrated/segment | 172877 | 172877 | 178063 | 0 | ok |
| migrated/sunburst | 140576 | 140576 | 144793 | 0 | ok |
| migrated/sunchrome | 141388 | 141388 | 145630 | 0 | ok |

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
| migrated/barsquares | 173967 | 127321 | 1.366 | **FAIL** |
| migrated/ring | 141569 | 103908 | 1.362 | **FAIL** |
| migrated/pie | 131765 | 97053 | 1.358 | **FAIL** |
| migrated/legendhover | 198114 | 148750 | 1.332 | **FAIL** |
| migrated/bar | 161724 | 121716 | 1.329 | **FAIL** |
| migrated/barmultiaxis | 161779 | 121779 | 1.328 | **FAIL** |
| migrated/profitloss | 180947 | 138423 | 1.307 | **FAIL** |
| migrated/bardepth | 162104 | 125221 | 1.295 | **FAIL** |
| migrated/candlestick-legend | 165688 | 128452 | 1.29 | **FAIL** |
| migrated/choropleth | 152133 | 119551 | 1.273 | **FAIL** |
| migrated/area | 173167 | 136508 | 1.269 | **FAIL** |
| migrated/areamultiaxis | 173270 | 136590 | 1.269 | **FAIL** |
| migrated/projection | 175888 | 138627 | 1.269 | **FAIL** |
| migrated/griddefault | 172761 | 136221 | 1.268 | **FAIL** |
| migrated/line | 172829 | 136280 | 1.268 | **FAIL** |
| migrated/linemultiaxis | 172882 | 136344 | 1.268 | **FAIL** |
| migrated/projectionxdomain | 175945 | 138713 | 1.268 | **FAIL** |
| migrated/markers | 183669 | 145356 | 1.264 | **FAIL** |
| migrated/radar | 134400 | 106927 | 1.257 | **FAIL** |
| migrated/patternarea | 173236 | 138299 | 1.253 | **FAIL** |
| migrated/segment | 172877 | 138331 | 1.25 | **FAIL** |
| migrated/refarea | 172876 | 139220 | 1.242 | **FAIL** |
| migrated/refareamultiaxis | 173014 | 139326 | 1.242 | **FAIL** |
| migrated/candlestick | 154710 | 124781 | 1.24 | **FAIL** |
| migrated/candletween | 154781 | 124853 | 1.24 | **FAIL** |
| migrated/liveline | 152803 | 123209 | 1.24 | **FAIL** |
| migrated/scatter | 152768 | 123780 | 1.234 | **FAIL** |
| migrated/scattermultiaxis | 152788 | 123798 | 1.234 | **FAIL** |
| migrated/barloading | 83837 | 70063 | 1.197 | **FAIL** |
| migrated/brush | 180803 | 151525 | 1.193 | **FAIL** |
| migrated/composed | 165372 | 139058 | 1.189 | **FAIL** |
| migrated/composedmultiaxis | 165436 | 139146 | 1.189 | **FAIL** |
| migrated/composedstacked | 165361 | 139095 | 1.189 | **FAIL** |
| migrated/heatmap | 141906 | 123718 | 1.147 | **FAIL** |
| migrated/legend | 12581 | 11657 | 1.079 | ok |
| migrated/arealoading | 88788 | 90835 | 0.977 | ok |

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
