# Gate probes

Generated 2026-09-07T23:43:49.025Z. Wall-clock 70.4s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## hover-lag (ms from first pointermove; medians of repeats)

Virtual-ms tail threshold 700 ms (animation-design time, NOT the gate's wall-clock capture -- D622). Flags: 3.

| chart | n | bklit dim/tip/last | migrated dim/tip/last | bklit dimmed | migrated dimmed | flags |
| --- | --- | --- | --- | --- | --- | --- |
| line | 1000 | 101/101/504 | 101/101/0 | 14 | 2 |  |
| area | 1000 | 59/59/443 | 92/92/0 | 15 | 3 |  |
| bar | 100 | 63/63/270 | 33/33/1101 | 216 | 200 | virtual-settle-tail>700ms |
| scatter | 1000 | 128/128/335 | 203/203/0 | 6019 | 4003 |  |
| composed | 1000 | 70/70/509 | 91/91/0 | 1021 | 1001 |  |
| candlestick | 1000 | —/—/0 | 239/239/0 | 0 | 2999 | tooltip-presence-mismatch; dim-presence-mismatch |
| heatmap | 52 | 202/202/387 | 91/91/91 | 757 | 370 |  |
| pie | 1000 | 159/—/399 | 159/—/159 | 999 | 999 |  |
| sankey | 33 | 62/62/158 | 51/51/145 | 47 | 38 |  |
| choropleth | 100 | 65/65/161 | —/57/57 | 188 | 176 | dim-presence-mismatch |
| liveline | 100 | 39/39/118 | 28/28/311 | 31 | 9 |  |
| composedstacked | 100 | 90/90/449 | 22/22/0 | 221 | 200 |  |
| areamultiaxis | 1000 | 47/47/431 | 125/125/0 | 23 | 5 |  |

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
