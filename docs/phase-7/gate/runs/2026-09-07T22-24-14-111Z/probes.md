# Gate probes

Generated 2026-09-07T22:25:29.962Z. Wall-clock 75.8s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Virtual-ms tail threshold 700 ms (animation-design time, NOT the gate's wall-clock capture -- D622). Flags: 2.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 101/101/498 | 70/70/0 | 14 | 2 |  |
| area | 1000 | 43/43/427 | 107/107/0 | 15 | 3 |  |
| bar | 100 | 82.5/82.5/210 | 36/36/1092 | 214 | 200 | virtual-settle-tail>700ms |
| scatter | 1000 | 137/137/374 | 207/207/0 | 6019 | 4003 |  |
| composed | 1000 | 99/99/489 | 93/93/0 | 1021 | 1001 |  |
| candlestick | 1000 | 83/83/0 | 236/236/0 | 0 | 2999 |  |
| heatmap | 52 | 201/201/392 | 91/91/91 | 757 | 370 |  |
| pie | 1000 | 160/—/406 | 151/—/151 | 999 | 999 |  |
| sankey | 33 | 63/63/158 | 53/53/153 | 47 | 38 |  |
| choropleth | 100 | 61/61/156 | —/47/47 | 188 | 176 | dim-presence-mismatch |
| liveline | 100 | 53/53/118 | 29/29/317 | 31 | 9 |  |
| composedstacked | 100 | 66/66/449 | 22/22/0 | 221 | 200 |  |
| areamultiaxis | 1000 | 55/55/438 | 129/129/0 | 23 | 5 |  |

## legend-hover-dim (__qaSetLegendHover)

Flags: 1.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→1010 (16) | 2→1008 (16) | y/y |  |
| legendhover | 1000 | 1 | 0→2005 (16) | 2→2006 (16) | y/y |  |
| candlelegend | 1000 | 0 | 0→1538 (16) | 1→1538 (16) | y/y |  |
| candlelegend | 1000 | 1 | 0→1472 (16) | 1→1470 (16) | y/y |  |
| markers | 100 | 0 | 3→10 (48) | 5→10 (16) | y/y | item-0: dimmed count differs >25% (bklit +7, migrated +5); item-1: dimmed count differs >25% (bklit +311, migrated +109) |
| markers | 100 | 1 | 3→314 (48) | 5→114 (48) | y/y |  |
| barsquares | 100 | 0 | 200→4216 (16) | 201→4216 (16) | y/y |  |
| barsquares | 100 | 1 | 200→6920 (16) | 201→6920 (16) | y/y |  |
| profitloss | 1000 | 0 | 0→19 (32) | 1→19 (16) | y/y |  |
| profitloss | 1000 | 1 | 0→19 (32) | 1→19 (16) | y/y |  |

## bardepth-toggle (__qaSetBarDepthEnabled)

Flags: none.

| impl | hooks | elements off/on | settle off/on/off (ms) | off→on moved/opacity | off→off-again moved |
| --- | --- | --- | --- | --- | --- |
| bklit | depth,pulsePaused,pulsePhase | 103/525 | 0/0/0 | 38/0 | 0 |
| migrated | depth,pulsePaused,pulsePhase | 100/476 | 33/0/33 | 40/0 | 0 |

## no-rereveal (samples at +100/+400/+900 ms after a prop toggle)

Flagged rows: 0.

| chart | impl | toggle | moved 100→400 | moved 400→900 | opacity chg 400→900 | low-opacity @100/@900 | re-reveal? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bardepth | bklit | __qaSetBarDepthEnabled(true) | 0 | 0 | 0 | 0/0 | no |
| bardepth | migrated | __qaSetBarDepthEnabled(true) | 0 | 0 | 0 | 0/0 | no |
| patternarea | bklit | __qaSetPatternPreset('dots') | 0 | 0 | 0 | 0/0 | no |
| patternarea | migrated | __qaSetPatternPreset('dots') | 0 | 0 | 0 | 0/0 | no |
| brush | bklit | __qaSetBrush(0.25,0.75) | 0 | 0 | 0 | 0/0 | no |
| brush | migrated | __qaSetBrush(0.25,0.75) | 0 | 0 | 0 | 0/0 | no |
| legendhover | bklit | __qaSetLegendHover(0) | 0 | 0 | 0 | 0/0 | no |
| legendhover | migrated | __qaSetLegendHover(0) | 0 | 0 | 0 | 0/0 | no |
