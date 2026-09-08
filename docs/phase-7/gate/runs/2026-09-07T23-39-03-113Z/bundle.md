# Bundle gate

Generated 2026-09-07T23:44:09.860Z. Sizes: bench/results/bundle-sizes.json (re-measured, exit 0, 20.8s); pins: bench/results/bundle-gate.json (pinned 2026-09-07 HEAD d92d590 (re-pinned from Gate 4, docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z, D633; @tanstack/charts 0.16.0). 41 of 43 pins lowered to the bytes the D612/D619 ownership inversions actually produce; migrated/legend already sat exactly on its pin; migrated/brush kept its 8661481 pin because the measurement is 0.25% above it and raising a pin needs its own D-entry. Previous pin 2026-09-07 HEAD 8661481 (D595, adopted from the 7.6 run 2026-09-07T09-01-26-415Z) went stale the moment D612/D619 landed: every scenario came in a median 14% under its pin, so with the 3% tolerance the gate could not have seen a 17% regression that gave the whole inversion back. Note migrated/barloading: the 61d6179 pin was 2449 bytes, which is not a bundle -- that scenario's measurement was broken when those pins were stamped, and the row read as passing only because nothing can be smaller than it. Now 83837., tolerance 3%); scripts/bundle-gate.mjs exit 0.

**43 pinned scenarios: 0 FAIL, 0 missing, summed gzip 5537 kB vs pins 5534 kB (+0.06%). Largest delta: migrated/brush +0.28%.**

## Pinned (migrated)

| scenario | gzip | pin | limit | Δ% | verdict |
| --- | --- | --- | --- | --- | --- |
| migrated/area | 152341 | 152275 | 156843 | +0.04 | ok |
| migrated/arealoading | 62939 | 62939 | 64827 | 0 | ok |
| migrated/areamultiaxis | 152447 | 152387 | 156959 | +0.04 | ok |
| migrated/bar | 136013 | 135839 | 139914 | +0.13 | ok |
| migrated/bardepth | 136399 | 136259 | 140347 | +0.1 | ok |
| migrated/barloading | 58013 | 58013 | 59753 | 0 | ok |
| migrated/barmultiaxis | 136102 | 135930 | 140008 | +0.13 | ok |
| migrated/barsquares | 148386 | 148209 | 152655 | +0.12 | ok |
| migrated/brush | 181313 | 180805 | 186229 | +0.28 | ok |
| migrated/candlestick | 133104 | 133046 | 137037 | +0.04 | ok |
| migrated/candlestick-legend | 145220 | 145153 | 149508 | +0.05 | ok |
| migrated/candletween | 133167 | 133105 | 137098 | +0.05 | ok |
| migrated/choropleth | 139365 | 139305 | 143484 | +0.04 | ok |
| migrated/composed | 144890 | 144830 | 149175 | +0.04 | ok |
| migrated/composedmultiaxis | 144964 | 144906 | 149253 | +0.04 | ok |
| migrated/composedstacked | 144866 | 144804 | 149148 | +0.04 | ok |
| migrated/funnel | 102766 | 102704 | 105785 | +0.06 | ok |
| migrated/funnelvertical | 102784 | 102723 | 105805 | +0.06 | ok |
| migrated/gauge | 119115 | 119062 | 122634 | +0.04 | ok |
| migrated/gaugelinear | 119215 | 119163 | 122738 | +0.04 | ok |
| migrated/griddefault | 152098 | 152035 | 156596 | +0.04 | ok |
| migrated/heatmap | 115949 | 115888 | 119365 | +0.05 | ok |
| migrated/legend | 12581 | 12581 | 12958 | 0 | ok |
| migrated/legendhover | 177342 | 177198 | 182514 | +0.08 | ok |
| migrated/line | 152164 | 152103 | 156666 | +0.04 | ok |
| migrated/linemultiaxis | 152234 | 152174 | 156739 | +0.04 | ok |
| migrated/liveline | 131275 | 131227 | 135164 | +0.04 | ok |
| migrated/markers | 163213 | 163160 | 168055 | +0.03 | ok |
| migrated/patternarea | 152409 | 152345 | 156915 | +0.04 | ok |
| migrated/pie | 105951 | 105900 | 109077 | +0.05 | ok |
| migrated/profitloss | 159519 | 159465 | 164249 | +0.03 | ok |
| migrated/projection | 155102 | 155037 | 159688 | +0.04 | ok |
| migrated/projectionxdomain | 155170 | 155110 | 159763 | +0.04 | ok |
| migrated/radar | 108509 | 108457 | 111711 | +0.05 | ok |
| migrated/refarea | 152237 | 152175 | 156740 | +0.04 | ok |
| migrated/refareamultiaxis | 152335 | 152277 | 156845 | +0.04 | ok |
| migrated/ring | 115577 | 115510 | 118975 | +0.06 | ok |
| migrated/sankey | 117830 | 117769 | 121302 | +0.05 | ok |
| migrated/scatter | 131404 | 131357 | 135298 | +0.04 | ok |
| migrated/scattermultiaxis | 131417 | 131368 | 135309 | +0.04 | ok |
| migrated/segment | 152195 | 152133 | 156697 | +0.04 | ok |
| migrated/sunburst | 114595 | 114546 | 117982 | +0.04 | ok |
| migrated/sunchrome | 115362 | 115299 | 118758 | +0.05 | ok |

## Unpinned (informational: bklit / tanstack controls)

| scenario | gzip | raw | note |
| --- | --- | --- | --- |
| bklit/area | 136557 | 393008 | info |
| bklit/arealoading | 90835 | 268332 | info |
| bklit/areamultiaxis | 136650 | 393241 | info |
| bklit/bar | 121777 | 350604 | info |
| bklit/bardepth | 125278 | 361751 | info |
| bklit/barloading | 70063 | 210225 | info |
| bklit/barmultiaxis | 121841 | 350724 | info |
| bklit/barsquares | 127381 | 368451 | info |
| bklit/brush | 151589 | 442470 | info |
| bklit/candlestick-legend | 128518 | 368007 | info |
| bklit/candlestick | 124852 | 357507 | info |
| bklit/candletween | 124922 | 357605 | info |
| bklit/choropleth | 119607 | 340452 | info |
| bklit/composed | 139123 | 399678 | info |
| bklit/composedmultiaxis | 139204 | 399823 | info |
| bklit/composedstacked | 139154 | 399696 | info |
| bklit/funnel | 91026 | 262779 | info |
| bklit/funnelvertical | 91043 | 262818 | info |
| bklit/gauge | 100861 | 290360 | info |
| bklit/gaugelinear | 100965 | 290486 | info |
| bklit/griddefault | 136281 | 392195 | info |
| bklit/heatmap | 123783 | 353886 | info |
| bklit/legend | 11657 | 34545 | info |
| bklit/legendhover | 148807 | 426167 | info |
| bklit/line | 136339 | 392283 | info |
| bklit/linemultiaxis | 136403 | 392463 | info |
| bklit/liveline | 123268 | 351013 | info |
| bklit/markers | 145414 | 415730 | info |
| bklit/patternarea | 138356 | 399164 | info |
| bklit/pie | 97114 | 276417 | info |
| bklit/profitloss | 138481 | 398221 | info |
| bklit/projection | 138686 | 398628 | info |
| bklit/projectionxdomain | 138769 | 398713 | info |
| bklit/radar | 106980 | 310137 | info |
| bklit/refarea | 139284 | 401563 | info |
| bklit/refareamultiaxis | 139389 | 401851 | info |
| bklit/ring | 103967 | 296564 | info |
| bklit/sankey | 101015 | 286340 | info |
| bklit/scatter | 123845 | 354276 | info |
| bklit/scattermultiaxis | 123863 | 354292 | info |
| bklit/segment | 138386 | 397677 | info |
| bklit/sunburst | 87467 | 247357 | info |
| bklit/sunchrome | 88078 | 248619 | info |
| tanstack/area | 88836 | 246603 | info |
| tanstack/bar | 83339 | 229504 | info |
| tanstack/candlestick | 84331 | 234976 | info |
| tanstack/choropleth | 79160 | 215804 | info |
| tanstack/composed | 91540 | 254626 | info |
| tanstack/funnel | 83115 | 228676 | info |
| tanstack/funnelvertical | 83124 | 228689 | info |
| tanstack/gauge | 73309 | 200626 | info |
| tanstack/gaugelinear | 79701 | 217519 | info |
| tanstack/heatmap | 74844 | 205395 | info |
| tanstack/line | 86704 | 241445 | info |
| tanstack/liveline | 84553 | 235240 | info |
| tanstack/pie | 73441 | 201395 | info |
| tanstack/radar | 83084 | 231449 | info |
| tanstack/ring | 73443 | 200745 | info |
| tanstack/sankey | 72301 | 199313 | info |
| tanstack/scatter | 84664 | 235964 | info |
| tanstack/sunburst | 73635 | 201231 | info |

## Parity vs bklit (<= 1.10, no allowances)

**43 migrated cells: 25 over, 0 without control. Worst: migrated/sunburst 1.31.**

| scenario | migrated gzip | bklit gzip | ratio | verdict |
| --- | --- | --- | --- | --- |
| migrated/sunburst | 114595 | 87467 | 1.31 | **FAIL** |
| migrated/sunchrome | 115362 | 88078 | 1.31 | **FAIL** |
| migrated/brush | 181313 | 151589 | 1.196 | **FAIL** |
| migrated/legendhover | 177342 | 148807 | 1.192 | **FAIL** |
| migrated/gauge | 119115 | 100861 | 1.181 | **FAIL** |
| migrated/gaugelinear | 119215 | 100965 | 1.181 | **FAIL** |
| migrated/sankey | 117830 | 101015 | 1.166 | **FAIL** |
| migrated/barsquares | 148386 | 127381 | 1.165 | **FAIL** |
| migrated/choropleth | 139365 | 119607 | 1.165 | **FAIL** |
| migrated/profitloss | 159519 | 138481 | 1.152 | **FAIL** |
| migrated/candlestick-legend | 145220 | 128518 | 1.13 | **FAIL** |
| migrated/funnel | 102766 | 91026 | 1.129 | **FAIL** |
| migrated/funnelvertical | 102784 | 91043 | 1.129 | **FAIL** |
| migrated/markers | 163213 | 145414 | 1.122 | **FAIL** |
| migrated/projection | 155102 | 138686 | 1.118 | **FAIL** |
| migrated/projectionxdomain | 155170 | 138769 | 1.118 | **FAIL** |
| migrated/bar | 136013 | 121777 | 1.117 | **FAIL** |
| migrated/barmultiaxis | 136102 | 121841 | 1.117 | **FAIL** |
| migrated/area | 152341 | 136557 | 1.116 | **FAIL** |
| migrated/areamultiaxis | 152447 | 136650 | 1.116 | **FAIL** |
| migrated/griddefault | 152098 | 136281 | 1.116 | **FAIL** |
| migrated/line | 152164 | 136339 | 1.116 | **FAIL** |
| migrated/linemultiaxis | 152234 | 136403 | 1.116 | **FAIL** |
| migrated/ring | 115577 | 103967 | 1.112 | **FAIL** |
| migrated/patternarea | 152409 | 138356 | 1.102 | **FAIL** |
| migrated/segment | 152195 | 138386 | 1.1 | ok |
| migrated/refarea | 152237 | 139284 | 1.093 | ok |
| migrated/refareamultiaxis | 152335 | 139389 | 1.093 | ok |
| migrated/pie | 105951 | 97114 | 1.091 | ok |
| migrated/bardepth | 136399 | 125278 | 1.089 | ok |
| migrated/legend | 12581 | 11657 | 1.079 | ok |
| migrated/candlestick | 133104 | 124852 | 1.066 | ok |
| migrated/candletween | 133167 | 124922 | 1.066 | ok |
| migrated/liveline | 131275 | 123268 | 1.065 | ok |
| migrated/scatter | 131404 | 123845 | 1.061 | ok |
| migrated/scattermultiaxis | 131417 | 123863 | 1.061 | ok |
| migrated/composed | 144890 | 139123 | 1.041 | ok |
| migrated/composedmultiaxis | 144964 | 139204 | 1.041 | ok |
| migrated/composedstacked | 144866 | 139154 | 1.041 | ok |
| migrated/radar | 108509 | 106980 | 1.014 | ok |
| migrated/heatmap | 115949 | 123783 | 0.937 | ok |
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
