# Bundle gate

Generated 2026-09-02T20:20:13.020Z. Sizes: bench/results/bundle-sizes.json (re-measured, exit 0, 12.2s); pins: bench/results/bundle-gate.json (pinned 2026-09-01 HEAD c1e9ced (6.4 refactor), tolerance 3%); scripts/bundle-gate.mjs exit 0.

**43 pinned scenarios: 0 FAIL, 0 missing, summed gzip 5235 kB vs pins 5173 kB (+1.2%). Largest delta: migrated/barloading +1.97%.**

## Pinned (migrated)

| scenario | gzip | pin | limit | Δ% | verdict |
| --- | --- | --- | --- | --- | --- |
| migrated/area | 156025 | 154292 | 158921 | +1.12 | ok |
| migrated/arealoading | 115903 | 114060 | 117482 | +1.62 | ok |
| migrated/areamultiaxis | 156114 | 154393 | 159025 | +1.11 | ok |
| migrated/bar | 126343 | 124693 | 128434 | +1.32 | ok |
| migrated/bardepth | 126457 | 124817 | 128562 | +1.31 | ok |
| migrated/barloading | 86059 | 84398 | 86930 | +1.97 | ok |
| migrated/barmultiaxis | 126433 | 124770 | 128513 | +1.33 | ok |
| migrated/barsquares | 136500 | 134664 | 138704 | +1.36 | ok |
| migrated/brush | 164903 | 163181 | 168076 | +1.06 | ok |
| migrated/candlestick | 119906 | 117955 | 121494 | +1.65 | ok |
| migrated/candlestick-legend | 130515 | 128746 | 132608 | +1.37 | ok |
| migrated/candletween | 119975 | 118022 | 121563 | +1.65 | ok |
| migrated/choropleth | 116911 | 114711 | 118152 | +1.92 | ok |
| migrated/composed | 130253 | 128769 | 132632 | +1.15 | ok |
| migrated/composedmultiaxis | 130328 | 128868 | 132734 | +1.13 | ok |
| migrated/composedstacked | 130251 | 128788 | 132652 | +1.14 | ok |
| migrated/funnel | 46571 | 46572 | 47969 | 0 | ok |
| migrated/funnelvertical | 46593 | 46594 | 47992 | 0 | ok |
| migrated/gauge | 101634 | 100253 | 103261 | +1.38 | ok |
| migrated/gaugelinear | 101740 | 100358 | 103369 | +1.38 | ok |
| migrated/griddefault | 156803 | 155593 | 160261 | +0.78 | ok |
| migrated/heatmap | 101484 | 100059 | 103061 | +1.42 | ok |
| migrated/legend | 11897 | 11897 | 12254 | 0 | ok |
| migrated/legendhover | 156039 | 154639 | 159278 | +0.91 | ok |
| migrated/line | 156853 | 155663 | 160333 | +0.76 | ok |
| migrated/linemultiaxis | 156921 | 155750 | 160423 | +0.75 | ok |
| migrated/liveline | 121627 | 119921 | 123519 | +1.42 | ok |
| migrated/markers | 168453 | 166609 | 171607 | +1.11 | ok |
| migrated/patternarea | 156058 | 154353 | 158984 | +1.1 | ok |
| migrated/pie | 101284 | 99652 | 102642 | +1.64 | ok |
| migrated/profitloss | 168465 | 166597 | 171595 | +1.12 | ok |
| migrated/projection | 159595 | 157940 | 162678 | +1.05 | ok |
| migrated/projectionxdomain | 159651 | 157987 | 162727 | +1.05 | ok |
| migrated/radar | 102260 | 100691 | 103712 | +1.56 | ok |
| migrated/refarea | 156909 | 155742 | 160414 | +0.75 | ok |
| migrated/refareamultiaxis | 157012 | 155890 | 160567 | +0.72 | ok |
| migrated/ring | 101147 | 99622 | 102611 | +1.53 | ok |
| migrated/sankey | 102236 | 100721 | 103743 | +1.5 | ok |
| migrated/scatter | 120489 | 118720 | 122282 | +1.49 | ok |
| migrated/scattermultiaxis | 120509 | 118739 | 122301 | +1.49 | ok |
| migrated/segment | 156903 | 155748 | 160420 | +0.74 | ok |
| migrated/sunburst | 98861 | 97322 | 100242 | +1.58 | ok |
| migrated/sunchrome | 99562 | 98038 | 100979 | +1.55 | ok |

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
| tanstack/area | 88657 | 246093 | info |
| tanstack/bar | 83179 | 228941 | info |
| tanstack/candlestick | 84236 | 234589 | info |
| tanstack/choropleth | 79065 | 215416 | info |
| tanstack/composed | 91360 | 254116 | info |
| tanstack/funnel | 82964 | 228165 | info |
| tanstack/funnelvertical | 82973 | 228178 | info |
| tanstack/gauge | 73203 | 200178 | info |
| tanstack/gaugelinear | 79543 | 217008 | info |
| tanstack/heatmap | 74735 | 205007 | info |
| tanstack/line | 86602 | 241058 | info |
| tanstack/liveline | 84450 | 234853 | info |
| tanstack/pie | 73333 | 200947 | info |
| tanstack/radar | 82969 | 231024 | info |
| tanstack/ring | 73331 | 200297 | info |
| tanstack/sankey | 72199 | 198925 | info |
| tanstack/scatter | 84593 | 235577 | info |
| tanstack/sunburst | 73514 | 200783 | info |
