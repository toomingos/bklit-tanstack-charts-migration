# Bundle gate

Generated 2026-09-05T12:15:39.806Z. Sizes: bench/results/bundle-sizes.json (not re-measured); pins: bench/results/bundle-gate.json (pinned 2026-09-05 HEAD 61d6179 (V0.3 baseline, @tanstack/charts 0.16.0; previous pin 2026-09-01 c1e9ced), tolerance 3%); scripts/bundle-gate.mjs exit 0.

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
