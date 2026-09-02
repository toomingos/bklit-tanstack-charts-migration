# Bundle gate

Generated 2026-09-02T19:30:40.338Z. Sizes: bench/results/bundle-sizes.json (re-measured, exit 0, 10.7s); pins: bench/results/bundle-gate.json (pinned 2026-09-01 HEAD c1e9ced (6.4 refactor), tolerance 3%); scripts/bundle-gate.mjs exit 0.

**43 pinned scenarios: 0 FAIL, 0 missing, summed gzip 5233 kB vs pins 5173 kB (+1.17%). Largest delta: migrated/barloading +1.97%.**

## Pinned (migrated)

| scenario | gzip | pin | limit | Δ% | verdict |
| --- | --- | --- | --- | --- | --- |
| migrated/area | 155921 | 154292 | 158921 | +1.06 | ok |
| migrated/arealoading | 115785 | 114060 | 117482 | +1.51 | ok |
| migrated/areamultiaxis | 156005 | 154393 | 159025 | +1.04 | ok |
| migrated/bar | 126334 | 124693 | 128434 | +1.32 | ok |
| migrated/bardepth | 126440 | 124817 | 128562 | +1.3 | ok |
| migrated/barloading | 86059 | 84398 | 86930 | +1.97 | ok |
| migrated/barmultiaxis | 126418 | 124770 | 128513 | +1.32 | ok |
| migrated/barsquares | 136507 | 134664 | 138704 | +1.37 | ok |
| migrated/brush | 164951 | 163181 | 168076 | +1.08 | ok |
| migrated/candlestick | 119683 | 117955 | 121494 | +1.46 | ok |
| migrated/candlestick-legend | 130316 | 128746 | 132608 | +1.22 | ok |
| migrated/candletween | 119748 | 118022 | 121563 | +1.46 | ok |
| migrated/choropleth | 116174 | 114711 | 118152 | +1.28 | ok |
| migrated/composed | 130151 | 128769 | 132632 | +1.07 | ok |
| migrated/composedmultiaxis | 130231 | 128868 | 132734 | +1.06 | ok |
| migrated/composedstacked | 130146 | 128788 | 132652 | +1.05 | ok |
| migrated/funnel | 46571 | 46572 | 47969 | 0 | ok |
| migrated/funnelvertical | 46593 | 46594 | 47992 | 0 | ok |
| migrated/gauge | 101634 | 100253 | 103261 | +1.38 | ok |
| migrated/gaugelinear | 101740 | 100358 | 103369 | +1.38 | ok |
| migrated/griddefault | 156813 | 155593 | 160261 | +0.78 | ok |
| migrated/heatmap | 101470 | 100059 | 103061 | +1.41 | ok |
| migrated/legend | 11897 | 11897 | 12254 | 0 | ok |
| migrated/legendhover | 156178 | 154639 | 159278 | +1 | ok |
| migrated/line | 156863 | 155663 | 160333 | +0.77 | ok |
| migrated/linemultiaxis | 156934 | 155750 | 160423 | +0.76 | ok |
| migrated/liveline | 121633 | 119921 | 123519 | +1.43 | ok |
| migrated/markers | 168518 | 166609 | 171607 | +1.15 | ok |
| migrated/patternarea | 155950 | 154353 | 158984 | +1.03 | ok |
| migrated/pie | 101284 | 99652 | 102642 | +1.64 | ok |
| migrated/profitloss | 168543 | 166597 | 171595 | +1.17 | ok |
| migrated/projection | 159644 | 157940 | 162678 | +1.08 | ok |
| migrated/projectionxdomain | 159695 | 157987 | 162727 | +1.08 | ok |
| migrated/radar | 102260 | 100691 | 103712 | +1.56 | ok |
| migrated/refarea | 156931 | 155742 | 160414 | +0.76 | ok |
| migrated/refareamultiaxis | 157018 | 155890 | 160567 | +0.72 | ok |
| migrated/ring | 101147 | 99622 | 102611 | +1.53 | ok |
| migrated/sankey | 102238 | 100721 | 103743 | +1.51 | ok |
| migrated/scatter | 120492 | 118720 | 122282 | +1.49 | ok |
| migrated/scattermultiaxis | 120512 | 118739 | 122301 | +1.49 | ok |
| migrated/segment | 156909 | 155748 | 160420 | +0.75 | ok |
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
