# Benchmarks — Phase 6

Gate run for Phase 6.5, 2026-09-01, at `c1e9ced` (6.4 refactor commit) on `@tanstack/charts@0.15.0` /
`@tanstack/react-charts@0.15.0`. Three channels: **bundle size (M2c)**, **runtime bench** (`bench/run.mjs`,
`--all` matrix + the 10 paired migrated cells of `docs/phase-5/BASELINE.md` §3b), and the **QA parity matrix**
(`qa/screenshot.mjs`, 43 runs vs `docs/phase-5/captures/5-3-5-final-matrix.md`). Gate math below was recomputed by
the orchestrator from the raw JSON, not taken from agent reports. Nothing is interpolated; every cell is a value
that a completed run wrote to disk.

## 1. Bundle size — M2c, finally owned

### 1.1 The measurement was wrong before this phase (D462, D463)

`bench/measure-bundle.mjs` used to bundle a **bare side-effect import** of each scenario module
(`import "./migrated-line.tsx"`). Under `sideEffects:false`, esbuild is allowed to drop everything that
import does not *use* — and for `bklit` it did: every legacy scenario tree-shook down to the one thing with a
side effect, the 106 kB TopoJSON fixture (38.3 kB gzip), while the migrated barrel (no `sideEffects` manifest at
the time) survived whole at ~216 kB. That is the "5-6x gzip gap vs legacy" that Phase 5 recorded and this plan
inherited. It was an artifact of the harness, not of the port.

Two corrections, both in `c1e9ced`:

- the entry is now `import S from "./<impl>-<chart>.tsx"; export default S;` — the scenario component is *used*,
  so tree-shaking is real and symmetric across impls;
- `showcase/migrated/package.json` declares `sideEffects: ["**/*.css"]`, so the migrated barrel is shaken the
  same way the legacy package already was.

The stale Phase-5 series is preserved as `bench/results/bundle-sizes-phase-5.json` and shown below as
"p5 as-shipped" only so the old number can be recognised for what it was. The honest pre-Phase-6 reference is the
**Phase-5 tip re-measured with the corrected harness** ("p5tip", git worktree at `f8e8c7a`, "Phase 5 final state
snapshot (pre-phase-6 base)"), in two variants: *barrel* (as the repo stood — no manifest, so the whole migrated barrel is kept) and
*forced* (every migrated module marked side-effect free — the best case tree-shaking could have reached).

### 1.2 Per-scenario gzip (kB), esbuild minify, `react`/`react-dom` external

| scenario | legacy bklit | p5 as-shipped (stale) | p5tip barrel | p5tip forced | **HEAD migrated** | tanstack ceiling | HEAD vs legacy | HEAD vs p5tip barrel |
|---|---|---|---|---|---|---|---|---|
| area | 133.3 | 216.1 | 216.4 | 114.6 | **150.7** | 86.6 | +13% | -30% |
| arealoading | 88.7 | 177.5 | 176.8 | 75.4 | **111.4** | — | +26% | -37% |
| areamultiaxis | 133.4 | 216.1 | 216.5 | 114.7 | **150.8** | — | +13% | -30% |
| bar | 118.9 | 216.2 | 216.5 | 104 | **121.8** | 81.2 | +2% | -44% |
| bardepth | 121.5 | 216.2 | 216.6 | 104.1 | **121.9** | — | +0% | -44% |
| barloading | 68.4 | 177.5 | 176.8 | 65.4 | **82.4** | — | +20% | -53% |
| barmultiaxis | 118.9 | 216.2 | 216.6 | 104 | **121.8** | — | +2% | -44% |
| barsquares | 124.3 | 216.2 | 216.9 | 115.5 | **131.5** | — | +6% | -39% |
| brush | 148.0 | 216.2 | 222.6 | 126.6 | **159.4** | — | +8% | -28% |
| candlestick | 121.9 | 216.2 | 222 | 99.2 | **115.2** | 82.3 | -5% | -48% |
| candlestick-legend | 125.4 | 216.2 | 222.4 | 109.4 | **125.7** | — | +0% | -43% |
| candletween | 121.9 | 216.2 | 222.1 | 99.3 | **115.3** | — | -5% | -48% |
| choropleth | 116.7 | 217.1 | 217.6 | 98.6 | **112.0** | 77.2 | -4% | -49% |
| composed | 135.8 | 216.1 | 222.4 | 108.5 | **125.8** | 89.2 | -7% | -43% |
| composedmultiaxis | 135.9 | 216.1 | 222.4 | 108.6 | **125.8** | — | -7% | -43% |
| composedstacked | 135.8 | 216.1 | 222.3 | 108.6 | **125.8** | — | -7% | -43% |
| funnel | 88.8 | 216.2 | 219.2 | 45.3 | **45.5** | 81.0 | -49% | -79% |
| funnelvertical | 88.8 | 216.2 | 219.2 | 45.3 | **45.5** | 81.0 | -49% | -79% |
| gauge | 98.4 | 216.2 | 216.2 | 85.5 | **97.9** | 71.5 | -1% | -55% |
| gaugelinear | 98.5 | 216.2 | 216.3 | 85.6 | **98.0** | 77.7 | -1% | -55% |
| griddefault | 133.0 | 216.1 | 221.9 | 115.9 | **151.9** | — | +14% | -32% |
| heatmap | 120.8 | 216.2 | 226.4 | 81.1 | **97.7** | 73.0 | -19% | -57% |
| legend | 11.4 | 177.5 | 177.2 | 11.6 | **11.6** | — | +2% | -93% |
| legendhover | 145.3 | 216.1 | 223.1 | 134.2 | **151.0** | — | +4% | -32% |
| line | 133.1 | 216.1 | 221.9 | 116 | **152.0** | 84.6 | +14% | -31% |
| linemultiaxis | 133.1 | 216.1 | 222 | 116.1 | **152.1** | — | +14% | -31% |
| liveline | 120.3 | 216.2 | 223.4 | 96.1 | **117.1** | 82.5 | -3% | -48% |
| markers | 141.9 | 216.1 | 222.6 | 127.2 | **162.7** | — | +15% | -27% |
| patternarea | 135.1 | 216.1 | 216.5 | 114.7 | **150.7** | — | +12% | -30% |
| pie | 94.8 | 216.2 | 216.2 | 85.3 | **97.3** | 71.6 | +3% | -55% |
| profitloss | 135.2 | 216.1 | 222.4 | 127.1 | **162.7** | — | +20% | -27% |
| projection | 135.4 | 216.0 | 224.6 | 119 | **154.2** | — | +14% | -31% |
| projectionxdomain | 135.5 | 216.0 | 150.2 | 150.2 | **154.3** | — | +14% | +3% |
| radar | 104.4 | 216.2 | 221.7 | 85 | **98.3** | 81.0 | -6% | -56% |
| refarea | 136.0 | 216.1 | 222 | 116.1 | **152.1** | — | +12% | -31% |
| refareamultiaxis | 136.1 | 216.1 | 222.1 | 116.2 | **152.2** | — | +12% | -31% |
| ring | 101.5 | 216.2 | 216.2 | 85.2 | **97.3** | 71.6 | -4% | -55% |
| sankey | 98.6 | 216.2 | 217.5 | 80.5 | **98.4** | 70.5 | -0% | -55% |
| scatter | 120.9 | 216.2 | 220.7 | 98.9 | **115.9** | 82.6 | -4% | -47% |
| scattermultiaxis | 120.9 | 216.2 | 220.7 | 98.9 | **116.0** | — | -4% | -47% |
| segment | 135.1 | 216.1 | 222 | 116.1 | **152.1** | — | +13% | -31% |
| sunburst | 85.4 | 77.3 | 95.3 | 95.3 | **95.0** | 71.8 | +11% | -0% |
| sunchrome | 86.0 | 77.3 | 96 | 96 | **95.7** | — | +11% | -0% |

Sums over the 43 migrated scenarios (gzip kB):

| series | sum | vs HEAD |
|---|---|---|
| legacy bklit | 5023.1 | HEAD is **+3%** |
| p5tip barrel (what actually shipped at Phase-5 close, correctly measured) | 9020.4 | HEAD is **−43%** |
| p5tip forced (theoretical best case for the Phase-5 code) | 4300.9 | HEAD is **+20%** |
| **HEAD migrated** | **5172.7** | — |

All 43 scenarios carry a constant ~38 kB gzip of `choropleth-world-data.ts` (the TopoJSON fixture, imported by
the bench app's shared scenario data module) on every impl; it is a fixture cost, identical across columns, and
is not subtracted here because the harness file that would strip it is not this phase's to change.

### 1.3 Where the bytes went (esbuild metafile, `migrated/line`, minified bytes in output)

| group | p5tip forced | HEAD | Δ |
|---|---|---|---|
| `@tanstack/charts` dist | 85.4 kB | 156.7 kB | **+71 kB** — `motion.js` 42 kB (native motion renderer, D432), `interaction-brush.js` 8 kB, `tooltip.js` 6 kB, `crosshair-resolver.js` 5 kB |
| d3 pulled by the library | ~33 kB | ~68 kB | +35 kB — `d3-brush`/`d3-selection`/`d3-transition`/`d3-drag` arrive with `@tanstack/charts/interaction/brush` (line has an optional brush, statically imported) |
| `migrated/internal` (app-owned chrome) | 86.4 kB | 70.6 kB | −16 kB — `tooltip-chrome.ts` 13 kB, `hover-chrome.ts` 12 kB, `x-axis-overlay.tsx` 4.5 kB, `chart-markers.tsx` gone |
| `migrated/charts` (chart components) | 21.9 kB | 24.4 kB | +2.5 kB — native `states`/`extensions` config now lives in the chart file |

**Reading.** Phase 6 moved ~30 kB of hand-rolled chrome out of the app and took ~100 kB of library modules in
exchange for it — native motion, native brush, native tooltip and crosshair. The net for the cartesian family is
+12–20 kB gzip vs the theoretical Phase-5 best case, and +13–15% vs the legacy visx build; for the polar and
special charts (candlestick, composed, heatmap, radar, ring, scatter, choropleth, sankey, gauge) HEAD is at or
**below** legacy. The subpath-import work in 6.4 (§D of `research/phase-6/10-refactor.md`) is bundle-neutral, as
predicted: `@tanstack/charts` ships `sideEffects:false` and its barrel re-exports shake cleanly either way.

### 1.4 Verdict on the DoD line "recorded, materially down, and gated"

- **Recorded** — yes, above and in `bench/results/bundle-sizes.json` (104 bundles, 0 failed).
- **Materially down** — **yes against the number this plan was written from** (the Phase-5 as-shipped series,
  216 kB → 152 kB on `line`, −30%; −43% summed), and **yes against the code that actually shipped at Phase-5
  close** (p5tip barrel, same figures). **No against legacy bklit** (parity, +3% summed) and **no against the
  Phase-5 best-case tree-shake** (+20% summed). The "~5-6x gap" the plan expected to close never existed; what
  existed was a ~1.7x gap (barrel) that is now closed to parity with legacy. Logged as D469; the DoD box is
  ticked with this qualification.
- **Gated** — `bench/results/bundle-gate.json` pins all 43 migrated scenarios at the HEAD values with a +3%
  tolerance; `pnpm guard:bundle` (`scripts/bundle-gate.mjs`) fails on any pin exceeded or missing scenario.
  Lowering a pin is free; raising one needs a D-entry.

## 2. Runtime bench

Harness `bench/run.mjs` unchanged (protected). Config `warmupRuns:1, measuredRuns:7, idleMs:5000, updateTicks:30,
hoverSteps:60`; medians of the 7 measured runs. Machine quiet: nothing else scheduled during either run (the QA sweep
was started only after the last cell wrote). D273's ±20% flag threshold is applied per cell; M1a remains the VOID
channel on this machine (three consecutive Phase-4/5 runs) and is shown, not gated.

### 2.1 `--all` matrix (24 cells) vs `bench/results/latest.json` of 2026-08-27 (Phase-5 close)

Run 2026-09-01T21:38Z, Chromium per `latest.json`, **24/24 cells, `skipped: []`, n=7 on every M1 channel**. Note
what this matrix is: `bklit` (legacy, untouched all phase) and `tanstack` (native reference, no app code) — neither
arm contains Phase-6 code. It is the **control run** that validates the machine before the migrated cells below,
and it passes: 71 of 72 M1b/M1c/M3a deltas inside ±20%; the one outside is `bklit/line/10000` M1c **−22.7%**
(126.7 → 98.0 ms) — the *legacy* arm getting faster, on code nothing in this phase touched; not a regression.

| cell | M1a base → new | M1b base → new | M1c base → new | M3a base → new |
|---|---|---|---|---|
| bklit/line/100 | 58.4 → 58.5 (+0.2%) | 1151.5 → 1150.3 (-0.1%) | 69.5 → 73.3 (+5.5%) | 31.6 → 31.8 (+0.6%) |
| bklit/line/1000 | 59.3 → 61.3 (+3.4%) | 1160.1 → 1161.7 (+0.1%) | 85.9 → 81.9 (-4.7%) | 31.1 → 31.9 (+2.6%) |
| bklit/line/10000 | 65.2 → 65.9 (+1.1%) | 1194.7 → 1171.6 (-1.9%) | 126.7 → 98.0 (-22.7%) **‼** | 28.1 → 31.5 (+11.9%) |
| tanstack/line/100 | 26.0 → 25.5 (-1.9%) | 40.1 → 38.2 (-4.7%) | 58.4 → 58.4 (+0.0%) | 32.5 → 32.4 (-0.3%) |
| tanstack/line/1000 | 49.8 → 49.0 (-1.6%) | 70.6 → 76.3 (+8.1%) | 80.0 → 81.5 (+1.9%) | 32.6 → 32.6 (-0.0%) |
| tanstack/line/10000 | 270.3 → 271.4 (+0.4%) | 409.3 → 414.9 (+1.4%) | 292.0 → 296.9 (+1.7%) | 77.0 → 76.2 (-1.1%) |
| bklit/area/100 | 59.3 → 58.5 (-1.3%) | 1140.8 → 1142.3 (+0.1%) | 67.8 → 70.1 (+3.4%) | 32.2 → 32.0 (-0.6%) |
| bklit/area/1000 | 60.1 → 64.1 (+6.7%) | 1158.7 → 1159.9 (+0.1%) | 79.8 → 83.3 (+4.4%) | 30.5 → 30.4 (-0.3%) |
| bklit/area/10000 | 63.9 → 60.8 (-4.9%) | 1179.2 → 1172.5 (-0.6%) | 100.3 → 97.6 (-2.7%) | 29.7 → 29.8 (+0.3%) |
| tanstack/area/100 | 26.2 → 26.6 (+1.5%) | 39.7 → 36.7 (-7.6%) | 57.7 → 60.0 (+4.0%) | 32.3 → 32.3 (+0.0%) |
| tanstack/area/1000 | 54.2 → 55.1 (+1.7%) | 91.9 → 77.4 (-15.8%) | 87.4 → 89.2 (+2.1%) | 32.6 → 32.6 (+0.0%) |
| tanstack/area/10000 | 319.7 → 317.9 (-0.6%) | 480.1 → 466.9 (-2.7%) | 345.5 → 349.6 (+1.2%) | 126.6 → 130.0 (+2.6%) |
| bklit/bar/100 | 65.9 → 63.3 (-3.9%) | 1592.9 → 1594.4 (+0.1%) | 190.5 → 207.3 (+8.9%) | 32.5 → 32.5 (+0.0%) |
| bklit/bar/1000 | 269.2 → 266.0 (-1.2%) | 2034.0 → 2025.1 (-0.4%) | 1685.7 → 1693.3 (+0.4%) | 32.7 → 32.6 (-0.2%) |
| bklit/bar/10000 | 2230.4 → 2201.2 (-1.3%) | 7231.4 → 7191.9 (-0.5%) | 6765.1 → 6727.7 (-0.6%) | 158.1 → 159.4 (+0.9%) |
| tanstack/bar/100 | 35.2 → 35.1 (-0.3%) | 48.8 → 54.7 (+12.1%) | 67.6 → 69.3 (+2.5%) | 32.6 → 32.6 (-0.0%) |
| tanstack/bar/1000 | 136.6 → 129.2 (-5.4%) | 204.5 → 197.7 (-3.3%) | 174.7 → 164.9 (-5.6%) | 50.2 → 48.6 (-3.2%) |
| tanstack/bar/10000 | 1331.2 → 1095.0 (-17.7%) | 1926.3 → 1666.0 (-13.5%) | 1355.4 → 1152.0 (-15.0%) | 565.8 → 510.1 (-9.8%) |
| bklit/scatter/100 | 49.6 → 50.1 (+1.0%) | 1146.8 → 1152.6 (+0.5%) | 141.7 → 148.3 (+4.7%) | 32.6 → 32.5 (-0.3%) |
| bklit/scatter/1000 | 129.8 → 128.3 (-1.2%) | 1290.1 → 1274.3 (-1.2%) | 617.1 → 568.1 (-7.9%) | 32.6 → 32.6 (-0.0%) |
| bklit/scatter/10000 | 953.0 → 888.0 (-6.8%) | 3399.5 → 3176.4 (-6.6%) | 2641.2 → 2460.2 (-6.9%) | 74.0 → 69.8 (-5.7%) |
| tanstack/scatter/100 | 30.2 → 30.2 (-0.0%) | 46.7 → 43.2 (-7.5%) | 61.4 → 62.1 (+1.0%) | 32.6 → 32.5 (-0.3%) |
| tanstack/scatter/1000 | 95.0 → 96.1 (+1.2%) | 152.0 → 142.2 (-6.4%) | 117.8 → 116.7 (-0.9%) | 36.0 → 35.7 (-0.7%) |
| tanstack/scatter/10000 | 777.7 → 755.8 (-2.8%) | 1210.8 → 1178.0 (-2.7%) | 707.4 → 656.6 (-7.2%) | 212.0 → 204.3 (-3.6%) |

### 2.2 Paired migrated cells vs `docs/phase-5/BASELINE.md` §3b

Same harness and config as §2.1 (`bench/run.mjs --chart X --impl migrated --n N`, n=7 medians, machine quiet). The §3b
migrated row is the baseline (composed 1664.8/123.8/32.2, scatter 1258.6/141.1/28.8, line 1115.5/76.7/32.5, area
1151.2/88.0/32.2, bar 1576.1/72.0/29.7 for M1b/M1c/M3a). **Outcome: the first pass FAILED the gate** (composed and scatter
M3a ×6–7), the plan's failure protocol was run — bisect by subsystem commit → C5, fix forward (**D472**, cardinality-gated
renderer, `NATIVE_MOTION_MAX_POINTS = 200`), re-run only the failing cells — and the re-run passes. Read the four tables in
order; the gate verdict is table (d).

**(a) Pre-fix, HEAD before D472 (`e55f9f9`), n=7 medians vs §3b migrated row:**

| cell | M1b base → new | M1c base → new | M3a base → new |
|---|---|---|---|
| migrated/composed/1000 | 1664.8 → 1849.1 (+11.1%) | 123.8 → 314.1 (+153.7%) **‼** | 32.2 → 190.0 (+490.1%) **‼** |
| migrated/scatter/1000 | 1258.6 → 1817.9 (+44.4%) **‼** | 141.1 → 220.0 (+55.9%) **‼** | 28.8 → 202.2 (+601.9%) **‼** |
| migrated/line/1000 | 1115.5 → 1121.8 (+0.6%) | 76.7 → 98.4 (+28.3%) **‼** | 32.5 → 32.1 (-1.2%) |
| migrated/area/1000 | 1151.2 → 1162.9 (+1.0%) | 88.0 → 105.8 (+20.3%) **‼** | 32.2 → 31.9 (-0.9%) |
| migrated/bar/100 | 1576.1 → 1576.1 (+0.0%) | 72.0 → 79.3 (+10.1%) | 29.7 → 31.2 (+5.1%) |

**(b) Bisect by subsystem commit (`showcase/migrated` checked out per rung; composed/1000 and scatter/1000):**

| cell | M1b base → new | M1c base → new | M3a base → new |
|---|---|---|---|
| C4 composed/1000 | 1664.8 → 1669.7 (+0.3%) | 123.8 → 132.2 (+6.7%) | 32.2 → 34.6 (+7.5%) |
| C4 scatter/1000 | 1258.6 → 1236.9 (-1.7%) | 141.1 → 133.4 (-5.4%) | 28.8 → 32.4 (+12.5%) |
| C5 composed/1000 | 1664.8 → 1851.2 (+11.2%) | 123.8 → 314.0 (+153.7%) **‼** | 32.2 → 189.0 (+487.0%) **‼** |
| C5 scatter/1000 | 1258.6 → 1821.5 (+44.7%) **‼** | 141.1 → 223.9 (+58.7%) **‼** | 28.8 → 205.2 (+612.5%) **‼** |
| C6 composed/1000 | 1664.8 → 1852.4 (+11.3%) | 123.8 → 317.2 (+156.2%) **‼** | 32.2 → 191.0 (+493.2%) **‼** |
| C6 scatter/1000 | 1258.6 → 1821.3 (+44.7%) **‼** | 141.1 → 224.6 (+59.1%) **‼** | 28.8 → 205.5 (+613.4%) **‼** |

**(c) Calibration — C4 (static renderer) vs HEAD (motion renderer), same harness, n=7; deltas are HEAD vs C4, not vs §3b:**

| cell | M1b C4 → HEAD | M1c C4 → HEAD | M3a C4 → HEAD |
|---|---|---|---|
| scatter/200 | 1158.3 → 1664.7 (+43.7%) **‼** | 72.3 → 77.8 (+7.6%) | 32.5 → 32.5 (+0.0%) |
| scatter/400 | 1177.6 → 1688.5 (+43.4%) **‼** | 87.9 → 102.2 (+16.3%) | 32.5 → 48.3 (+48.8%) **‼** |
| composed/200 | 1613.1 → 1624.6 (+0.7%) | 76.3 → 94.8 (+24.3%) **‼** | 32.5 → 32.1 (-1.2%) |
| composed/400 | 1622.6 → 1667.2 (+2.7%) | 92.0 → 133.9 (+45.6%) **‼** | 32.5 → 44.0 (+35.4%) **‼** |

**(d) Re-run of the failing cells with D472 (HEAD, n=7) vs §3b migrated row:**

| cell | M1b base → new | M1c base → new | M3a base → new |
|---|---|---|---|
| migrated/composed/1000 | 1664.8 → 1666.1 (+0.1%) | 123.8 → 130.3 (+5.2%) | 32.2 → 34.3 (+6.5%) |
| migrated/scatter/1000 | 1258.6 → 1197.5 (-4.9%) | 141.1 → 99.8 (-29.3%) **‼** | 28.8 → 32.5 (+13.0%) |
| migrated/line/1000 | 1115.5 → 1119.0 (+0.3%) | 76.7 → 85.8 (+11.9%) | 32.5 → 32.6 (+0.3%) |
| migrated/area/1000 | 1151.2 → 1153.4 (+0.2%) | 88.0 → 91.9 (+4.5%) | 32.2 → 32.6 (+1.2%) |

Reading (d): every delta inside D273's ±20% flag except scatter M1c **−29%**, a speed-up (no per-point motion tracks are
built above the threshold). bar/100 was inside the flag before the fix and is not re-run. Bar and candlestick take the
same helper but have no §3b paired cell above 200 datums (bar's is n=100), so their above-threshold regime is covered by
typecheck and the QA sweep, not by a bench cell. Accepted cost recorded in D472: no native entrance motion above 200
datums on the six per-datum charts; composed/200 keeps +24% M1c on the initial render (M3a flat).

## 3. QA parity matrix

_(filled in below once the sweep completes — see §3)_

## 4. Typecheck / build / lint / guards at gate

| check | result |
|---|---|
| `cd showcase && npx tsc --noEmit` | exit 0 |
| `cd bench/app && npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `cd showcase && pnpm build` | exit 0 |
| `cd bench/app && npm run build` | exit 0 (chunk-size warning only) |
| `cd showcase && npx eslint migrated` | 0 errors, **18 warnings** (24 before 6.4; every survivor is a pre-existing warning at a shifted line — 9 `react-hooks/exhaustive-deps`, 8 `no-explicit-any`, 1 `no-unused-vars`; none introduced by the refactor — logged as lint debt, D470) |
| `pnpm guard:reach-in` | 79 sites / 15 files, all pinned — OK (D468) |
| `pnpm guard:bundle` | 43 pins, OK |
