# Gate probes

Generated 2026-09-07T21:09:13.806Z. Wall-clock 76.2s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Gate captures at +700 ms. Flags: 3.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 108/108/509 | 82/82/0 | 14 | 2 |  |
| area | 1000 | 56/56/441 | 73/73/0 | 15 | 3 |  |
| bar | 100 | 55/55/277 | 35/35/1088 | 217 | 200 | settles-after-700ms-capture |
| scatter | 1000 | 131/131/405 | 203/203/0 | 6019 | 4003 |  |
| composed | 1000 | 100/100/511 | 103/103/0 | 1021 | 1001 |  |
| candlestick | 1000 | 75.5/75.5/348 | 243/243/0 | 3009 | 2999 |  |
| heatmap | 52 | 181/181/412 | 61/61/61 | 753 | 370 |  |
| pie | 1000 | 159/—/398 | 151/—/151 | 999 | 999 |  |
| sankey | 33 | 57/57/157 | 58/58/154 | 47 | 38 |  |
| choropleth | 100 | 58/58/169 | —/61/61 | 188 | 176 | dim-presence-mismatch |
| liveline | 100 | 47/47/510 | 29/29/316 | 31 | 9 | settles-after-700ms-capture |
| composedstacked | 100 | 83/83/483 | 23/23/0 | 221 | 200 |  |
| areamultiaxis | 1000 | 46/46/427 | 126/126/0 | 23 | 5 |  |

## legend-hover-dim (__qaSetLegendHover)

Flags: 1.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→1010 (16) | 2→1008 (16) | y/y |  |
| legendhover | 1000 | 1 | 0→2005 (16) | 2→2006 (16) | y/y |  |
| candlelegend | 1000 | 0 | 0→1538 (16) | 1→1538 (16) | y/y |  |
| candlelegend | 1000 | 1 | 0→1472 (16) | 1→1470 (16) | y/y |  |
| markers | 100 | 0 | 20→10 (256) | 5→10 (16) | n/y | item-0: dim presence mismatch (bklit +-10, migrated +5); item-0: bklit does not fully undim (20 -> 3); item-1: dimmed count differs >25% (bklit +311, migrated +109) |
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
