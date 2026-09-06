# Gate probes

Generated 2026-09-06T13:28:23.079Z. Wall-clock 19m39s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Gate captures at +700 ms. Flags: 4.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 91/91/480 | 116/116/0 | 1 | 1 |  |
| area | 1000 | 90/90/481 | 122/122/0 | 1 | 1 |  |
| bar | 100 | 85/52/234 | 84/84/1131 | 198 | 198 | settles-after-700ms-capture |
| scatter | 1000 | 104/51/104 | 235/235/0 | 2 | 2 |  |
| composed | 1000 | 101/101/498 | 109/109/0 | 1001 | 1000 |  |
| candlestick | 1000 | 141/68/271 | 252/252/0 | 999 | 2998 |  |
| heatmap | 52 | 205/205/449 | 121/121/121 | 741 | 370 |  |
| pie | 1000 | 172/—/400 | —/—/0 | 999 | 0 | dim-presence-mismatch |
| sankey | 33 | —/100/181 | 115/115/204 | 47 | 5 | dim-presence-mismatch |
| choropleth | 100 | —/110/181 | —/79/79 | 1 | 0 |  |
| liveline | 100 | 84/51/84 | —/36/36 | 4 | 0 | dim-presence-mismatch |
| composedstacked | 100 | 92/92/496 | 71/71/0 | 199 | 199 |  |
| areamultiaxis | 1000 | 98/98/498 | 170/170/0 | 2 | 2 |  |

## legend-hover-dim (__qaSetLegendHover)

Flags: 4.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→2 (133) | 0→0 (—) | n/y | item-0: dim presence mismatch (bklit +2, migrated +0); item-0: bklit does not fully undim (0 -> 2); item-1: dim presence mismatch (bklit +998, migrated +0); item-1: bklit does not fully undim (2 -> 0); item-1: migrated does not fully undim (1000 -> 0) |
| legendhover | 1000 | 1 | 2→1000 (182) | 1000→1000 (—) | n/n |  |
| candlelegend | 1000 | 0 | 0→511 (84) | 1533→1533 (—) | y/n | item-0: dim presence mismatch (bklit +511, migrated +0); item-0: migrated does not fully undim (1533 -> 0); item-1: dim presence mismatch (bklit +489, migrated +0); item-1: migrated does not fully undim (1465 -> 0) |
| candlelegend | 1000 | 1 | 0→489 (65) | 1465→1465 (—) | y/n |  |
| markers | 100 | 0 | 3→4 (48) | 0→0 (—) | n/y | item-0: dim presence mismatch (bklit +1, migrated +0); item-0: bklit does not fully undim (3 -> 4); item-1: dim presence mismatch (bklit +1, migrated +0); item-1: bklit does not fully undim (4 -> 3); item-1: migrated does not fully undim (1 -> 0) |
| markers | 100 | 1 | 4→5 (122) | 1→1 (—) | n/n |  |
| barsquares | 100 | 0 | 200→4211 (251) | 0→4211 (161) | n/n | item-0: bklit does not fully undim (200 -> 4211); item-0: migrated does not fully undim (0 -> 200); item-1: dim presence mismatch (bklit +0, migrated +6915); item-1: bklit does not fully undim (200 -> 6915); item-1: migrated does not fully undim (0 -> 200) |
| barsquares | 100 | 1 | 200→200 (—) | 0→6915 (121) | n/n |  |
| profitloss | 1000 | 0 | 0→8 (49) | 0→8 (43) | y/y |  |
| profitloss | 1000 | 1 | 0→8 (26) | 0→8 (39) | y/y |  |

## bardepth-toggle (__qaSetBarDepthEnabled)

Flags: none.

| impl | hooks | elements off/on | settle off/on/off (ms) | off→on moved/opacity | off→off-again moved |
| --- | --- | --- | --- | --- | --- |
| bklit | depth,pulsePaused | 103/525 | 0/0/0 | 38/0 | 0 |
| migrated | depth,pulsePaused | 100/476 | 56/0/53 | 40/0 | 0 |

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
