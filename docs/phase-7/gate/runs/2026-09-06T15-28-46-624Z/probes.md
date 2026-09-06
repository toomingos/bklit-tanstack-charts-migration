# Gate probes

Generated 2026-09-06T15:51:40.296Z. Wall-clock 19m38s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Gate captures at +700 ms. Flags: 4.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 92/92/483 | 113/113/0 | 1 | 1 |  |
| area | 1000 | 91/91/481 | 119/119/0 | 1 | 1 |  |
| bar | 100 | 85/50/232 | 81/81/1131 | 198 | 198 | settles-after-700ms-capture |
| scatter | 1000 | 103/51/103 | 236/236/0 | 2 | 2 |  |
| composed | 1000 | 98/98/497 | 109/109/0 | 1001 | 1000 |  |
| candlestick | 1000 | 128/64/267 | 249/249/0 | 999 | 2998 |  |
| heatmap | 52 | 181/181/433 | 87/87/87 | 741 | 370 |  |
| pie | 1000 | 173/—/400 | —/—/0 | 999 | 0 | dim-presence-mismatch |
| sankey | 33 | —/102/181 | 113/113/203 | 47 | 5 | dim-presence-mismatch |
| choropleth | 100 | —/109/181 | —/71/71 | 1 | 0 |  |
| liveline | 100 | 84/51/84 | —/37/37 | 4 | 0 | dim-presence-mismatch |
| composedstacked | 100 | 87/87/479 | 75/75/0 | 199 | 199 |  |
| areamultiaxis | 1000 | 82/82/449 | 172/172/0 | 2 | 2 |  |

## legend-hover-dim (__qaSetLegendHover)

Flags: 4.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→2 (114) | 0→0 (—) | n/y | item-0: dim presence mismatch (bklit +2, migrated +0); item-0: bklit does not fully undim (0 -> 2); item-1: dim presence mismatch (bklit +998, migrated +0); item-1: bklit does not fully undim (2 -> 0); item-1: migrated does not fully undim (1000 -> 0) |
| legendhover | 1000 | 1 | 2→1000 (164) | 1000→1000 (—) | n/n |  |
| candlelegend | 1000 | 0 | 0→511 (92) | 1533→1533 (—) | y/n | item-0: dim presence mismatch (bklit +511, migrated +0); item-0: migrated does not fully undim (1533 -> 0); item-1: dim presence mismatch (bklit +489, migrated +0); item-1: migrated does not fully undim (1465 -> 0) |
| candlelegend | 1000 | 1 | 0→489 (65) | 1465→1465 (—) | y/n |  |
| markers | 100 | 0 | 3→4 (41) | 0→0 (—) | n/y | item-0: dim presence mismatch (bklit +1, migrated +0); item-0: bklit does not fully undim (3 -> 4); item-1: dim presence mismatch (bklit +1, migrated +0); item-1: bklit does not fully undim (4 -> 3); item-1: migrated does not fully undim (1 -> 0) |
| markers | 100 | 1 | 4→5 (118) | 1→1 (—) | n/n |  |
| barsquares | 100 | 0 | 200→4211 (253) | 0→4211 (142) | n/n | item-0: bklit does not fully undim (200 -> 4211); item-0: migrated does not fully undim (0 -> 200); item-1: bklit does not fully undim (200 -> 6915); item-1: migrated does not fully undim (0 -> 200) |
| barsquares | 100 | 1 | 200→6915 (371) | 0→6915 (119) | n/n |  |
| profitloss | 1000 | 0 | 0→8 (32) | 0→8 (41) | y/y |  |
| profitloss | 1000 | 1 | 0→8 (27) | 0→8 (34) | y/y |  |

## bardepth-toggle (__qaSetBarDepthEnabled)

Flags: none.

| impl | hooks | elements off/on | settle off/on/off (ms) | off→on moved/opacity | off→off-again moved |
| --- | --- | --- | --- | --- | --- |
| bklit | depth,pulsePaused | 103/525 | 0/0/0 | 38/0 | 0 |
| migrated | depth,pulsePaused | 100/476 | 54/0/54 | 40/0 | 0 |

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
