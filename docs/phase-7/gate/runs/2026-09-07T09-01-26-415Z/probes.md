# Gate probes

Generated 2026-09-07T09:06:07.258Z. Wall-clock 63.1s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Gate captures at +700 ms. Flags: 5.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 64/64/448 | 77/77/0 | 1 | 1 |  |
| area | 1000 | 45/45/430 | 114/114/0 | 1 | 1 |  |
| bar | 100 | 110/99/294 | 34/34/1097 | 198 | 198 | settles-after-700ms-capture |
| scatter | 1000 | 137/65/137 | 222/222/0 | 2 | 2 |  |
| composed | 1000 | 107/107/489 | 100/100/0 | 1001 | 1000 |  |
| candlestick | 1000 | 179/67/469 | 270/270/0 | 999 | 2998 | tooltip-lag>200ms |
| heatmap | 52 | 182/182/364 | 105/105/105 | 741 | 370 |  |
| pie | 1000 | 124/—/342 | —/—/0 | 999 | 0 | dim-presence-mismatch |
| sankey | 33 | —/65/162 | 49/49/148 | 47 | 5 | dim-presence-mismatch |
| choropleth | 100 | —/65/161 | —/60/60 | 1 | 0 |  |
| liveline | 100 | 94/62/94 | —/28/28 | 4 | 0 | dim-presence-mismatch |
| composedstacked | 100 | 87/87/451 | 23/23/0 | 199 | 199 |  |
| areamultiaxis | 1000 | 57/57/441 | 135/135/0 | 2 | 2 |  |

## legend-hover-dim (__qaSetLegendHover)

Flags: 4.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→2 (16) | 0→0 (—) | y/y | item-0: dim presence mismatch (bklit +2, migrated +0); item-1: dim presence mismatch (bklit +1000, migrated +0); item-1: migrated does not fully undim (1000 -> 0) |
| legendhover | 1000 | 1 | 0→1000 (16) | 1000→1000 (—) | y/n |  |
| candlelegend | 1000 | 0 | 511→511 (—) | 1533→1533 (—) | n/n | item-0: bklit does not fully undim (511 -> 0); item-0: migrated does not fully undim (1533 -> 0); item-1: dim presence mismatch (bklit +489, migrated +0); item-1: migrated does not fully undim (1465 -> 0) |
| candlelegend | 1000 | 1 | 0→489 (16) | 1465→1465 (—) | y/n |  |
| markers | 100 | 0 | 6→4 (272) | 0→0 (—) | n/y | item-0: bklit does not fully undim (6 -> 4); item-1: dim presence mismatch (bklit +1, migrated +0); item-1: bklit does not fully undim (4 -> 3); item-1: migrated does not fully undim (1 -> 0) |
| markers | 100 | 1 | 4→5 (112) | 1→1 (—) | n/n |  |
| barsquares | 100 | 0 | 200→4211 (16) | 0→4211 (16) | y/n | item-0: migrated does not fully undim (0 -> 200); item-1: migrated does not fully undim (0 -> 200) |
| barsquares | 100 | 1 | 200→6915 (16) | 0→6915 (16) | y/n |  |
| profitloss | 1000 | 0 | 0→8 (32) | 0→8 (16) | y/y |  |
| profitloss | 1000 | 1 | 0→8 (32) | 0→8 (16) | y/y |  |

## bardepth-toggle (__qaSetBarDepthEnabled)

Flags: none.

| impl | hooks | elements off/on | settle off/on/off (ms) | off→on moved/opacity | off→off-again moved |
| --- | --- | --- | --- | --- | --- |
| bklit | depth,pulsePaused,pulsePhase | 103/525 | 33/0/0 | 38/0 | 0 |
| migrated | depth,pulsePaused | 100/476 | 33/0/33 | 40/0 | 0 |

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
