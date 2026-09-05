# Gate probes

Generated 2026-09-05T11:56:02.451Z. Wall-clock 20m22s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Gate captures at +700 ms. Flags: 5.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 89/89/482 | 137/81/137 | 1 | 1 |  |
| area | 1000 | 86/86/482 | 142/84/142 | 1 | 1 |  |
| bar | 100 | 85/50/231 | 44/62/1116 | 198 | 198 | settles-after-700ms-capture |
| scatter | 1000 | 95/51/95 | 571/82/571 | 2 | 2 | dim-lag>200ms |
| composed | 1000 | 93/93/482 | 109/246/246 | 1001 | 1000 |  |
| candlestick | 1000 | 126/55/267 | 159/402/662 | 999 | 2998 | tooltip-lag>200ms |
| heatmap | 52 | 187/187/433 | 118/143/143 | 741 | 370 |  |
| pie | 1000 | 178/—/400 | —/—/0 | 999 | 0 | dim-presence-mismatch |
| sankey | 33 | —/98/181 | 104/104/1298 | 47 | 0 | dim-presence-mismatch; settles-after-700ms-capture |
| choropleth | 100 | —/91/167 | —/129/129 | 1 | 0 |  |
| liveline | 100 | 84/51/84 | 28/38/38 | 4 | 0 |  |
| composedstacked | 100 | 90/90/480 | 31/50/265 | 199 | 199 |  |
| areamultiaxis | 1000 | 91/91/482 | 226/173/226 | 2 | 2 |  |

## legend-hover-dim (__qaSetLegendHover)

Flags: 4.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→2 (126) | 0→0 (—) | n/y | item-0: dim presence mismatch (bklit +2, migrated +0); item-0: bklit does not fully undim (0 -> 2); item-1: dim presence mismatch (bklit +998, migrated +0); item-1: bklit does not fully undim (2 -> 0); item-1: migrated does not fully undim (1000 -> 0) |
| legendhover | 1000 | 1 | 2→1000 (173) | 1000→1000 (—) | n/n |  |
| candlelegend | 1000 | 0 | 0→511 (67) | 0→1533 (196) | y/y | item-0: dimmed count differs >25% (bklit +511, migrated +1533); item-1: dimmed count differs >25% (bklit +489, migrated +1465) |
| candlelegend | 1000 | 1 | 0→489 (62) | 0→1465 (139) | y/y |  |
| markers | 100 | 0 | 3→4 (64) | 0→1 (173) | n/n | item-0: bklit does not fully undim (3 -> 4); item-0: migrated does not fully undim (0 -> 2); item-1: bklit does not fully undim (4 -> 3); item-1: migrated does not fully undim (1 -> 2) |
| markers | 100 | 1 | 4→5 (136) | 1→2 (186) | n/n |  |
| barsquares | 100 | 0 | 200→4211 (259) | 4211→4211 (—) | n/n | item-0: dim presence mismatch (bklit +4011, migrated +0); item-0: bklit does not fully undim (200 -> 4211); item-0: migrated does not fully undim (4211 -> 200); item-1: dim presence mismatch (bklit +6715, migrated +0); item-1: bklit does not fully undim (200 -> 6915); item-1: migrated does not fully undim (6915 -> 200) |
| barsquares | 100 | 1 | 200→6915 (335) | 6915→6915 (—) | n/n |  |
| profitloss | 1000 | 0 | 0→8 (28) | 0→8 (80) | y/y |  |
| profitloss | 1000 | 1 | 0→8 (24) | 0→8 (32) | y/y |  |

## bardepth-toggle (__qaSetBarDepthEnabled)

Flags: none.

| impl | hooks | elements off/on | settle off/on/off (ms) | off→on moved/opacity | off→off-again moved |
| --- | --- | --- | --- | --- | --- |
| bklit | depth,pulsePaused | 103/525 | 0/0/0 | 38/0 | 0 |
| migrated | depth,pulsePaused | 100/476 | 0/0/0 | 40/0 | 0 |

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
