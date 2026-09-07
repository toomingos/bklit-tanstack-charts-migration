# Gate probes

Generated 2026-09-07T15:18:04.567Z. Wall-clock 66.4s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Gate captures at +700 ms. Flags: 3.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 106/106/498 | 74/74/0 | 4 | 2 |  |
| area | 1000 | 53/53/435 | 97/97/0 | 4 | 3 |  |
| bar | 100 | 55/55/267 | 64/64/1115 | 202 | 200 | settles-after-700ms-capture |
| scatter | 1000 | 81/81/235 | 206/206/0 | 5 | 3 |  |
| composed | 1000 | 71/71/503 | 94/94/0 | 1004 | 1001 |  |
| candlestick | 1000 | 75/75/324 | 238/238/0 | 1002 | 2999 |  |
| heatmap | 52 | 175/175/377 | 62/62/62 | 747 | 370 |  |
| pie | 1000 | 152/—/377 | 160/—/160 | 999 | 999 |  |
| sankey | 33 | 62/62/1386 | 48/48/141 | 47 | 38 | settles-after-700ms-capture |
| choropleth | 100 | 100/100/177 | —/59/59 | 3 | 176 | dim-presence-mismatch |
| liveline | 100 | 52/52/129 | 29/29/312 | 16 | 6 |  |
| composedstacked | 100 | 88/88/461 | 24/24/0 | 201 | 200 |  |
| areamultiaxis | 1000 | 60/60/442 | 128/128/0 | 5 | 5 |  |

## legend-hover-dim (__qaSetLegendHover)

Flags: 2.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→1003 (16) | 2→1004 (—) | y/y |  |
| legendhover | 1000 | 1 | 0→2001 (16) | 2→2002 (—) | y/y |  |
| candlelegend | 1000 | 0 | 0→512 (16) | 1→1534 (—) | y/y | item-0: dimmed count differs >25% (bklit +512, migrated +1533); item-1: dimmed count differs >25% (bklit +490, migrated +1465) |
| candlelegend | 1000 | 1 | 0→490 (16) | 1→1466 (—) | y/y |  |
| markers | 100 | 0 | 6→5 (288) | 5→6 (—) | n/y | item-0: dim presence mismatch (bklit +-1, migrated +1); item-0: bklit does not fully undim (6 -> 3); item-1: dimmed count differs >25% (bklit +3, migrated +2); item-1: migrated does not fully undim (5 -> 6) |
| markers | 100 | 1 | 3→6 (48) | 5→7 (48) | y/n |  |
| barsquares | 100 | 0 | 200→4212 (16) | 201→4212 (16) | y/y |  |
| barsquares | 100 | 1 | 200→6916 (16) | 201→6916 (16) | y/y |  |
| profitloss | 1000 | 0 | 0→9 (32) | 1→9 (16) | y/y |  |
| profitloss | 1000 | 1 | 0→9 (32) | 1→9 (16) | y/y |  |

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
