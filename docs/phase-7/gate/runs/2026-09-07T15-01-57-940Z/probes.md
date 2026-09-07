# Gate probes

Generated 2026-09-07T15:02:53.227Z. Wall-clock 55.3s. Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal.

## legend-hover-dim (__qaSetLegendHover)

Flags: 2.

| chart | n | item | bklit dimmed (before→after, ms) | migrated dimmed (before→after, ms) | undim ok | flags |
| --- | --- | --- | --- | --- | --- | --- |
| legendhover | 1000 | 0 | 0→1003 (16) | 2→1004 (—) | y/y |  |
| legendhover | 1000 | 1 | 0→2001 (16) | 2→2002 (—) | y/y |  |
| candlelegend | 1000 | 0 | 0→512 (16) | 1→1534 (—) | y/y | item-0: dimmed count differs >25% (bklit +512, migrated +1533); item-1: dimmed count differs >25% (bklit +490, migrated +1465) |
| candlelegend | 1000 | 1 | 0→490 (16) | 1→1466 (—) | y/y |  |
| markers | 100 | 0 | 6→5 (224) | 5→6 (—) | n/y | item-0: dim presence mismatch (bklit +-1, migrated +1); item-0: bklit does not fully undim (6 -> 3); item-1: dimmed count differs >25% (bklit +3, migrated +2); item-1: migrated does not fully undim (5 -> 6) |
| markers | 100 | 1 | 3→6 (48) | 5→7 (48) | y/n |  |
| barsquares | 100 | 0 | 200→4212 (16) | 201→4212 (—) | y/y |  |
| barsquares | 100 | 1 | 200→6916 (16) | 201→6916 (16) | y/y |  |
| profitloss | 1000 | 0 | 0→9 (32) | 1→9 (16) | y/y |  |
| profitloss | 1000 | 1 | 0→9 (16) | 1→9 (16) | y/y |  |

## bardepth-toggle (__qaSetBarDepthEnabled)

Flags: none.

| impl | hooks | elements off/on | settle off/on/off (ms) | off→on moved/opacity | off→off-again moved |
| --- | --- | --- | --- | --- | --- |
| bklit | depth,pulsePaused,pulsePhase | 103/525 | 66/0/0 | 38/0 | 0 |
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
