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

### 1.5 Re-measured at the final gate (2026-09-02, run `2026-09-02T20-09-29-038Z`)

`pnpm gate:bundle` → `docs/phase-6/gate/latest/bundle.{json,md}`: 104 bundles measured, 0 failed; **43 pins, 0 FAIL, 0 missing**.
Σ gzip 5 360 432 B vs Σ pin 5 296 797 B (**+1.2 %**); every migrated scenario is +0.7 … +2.0 % (≈1.2–2.2 kB gzip each), the
largest `migrated/barloading` +1.97 % (84.4 → 86.1 kB). The delta is uniform because it is shared `internal/` code added by the
gate-fix window — the cardinality-gated renderer (D472), `withoutInteraction` (D494), the candlestick wick split (D495),
`polar-hit.ts` — not any one chart. All inside the +3 % tolerance; **pins are left at `c1e9ced`** (raising a pin needs a
D-entry and none is warranted at +1.2 %), which leaves ~1 % headroom for Phase 7 before the guard bites. Logged as D499.

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

### 2.3 Final gate run — `--all` + the 5 migrated cells after the fix window (2026-09-02, `pnpm gate:bench -- --cells all`)

Run dir `docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z` (bench results `bench/results/2026-09-02T20-57-15-845Z` = the new
`bench/results/latest.json`, plus one dir per migrated cell), same harness/config as §2.1, n=7 medians, **29/29 cells, 0 skipped**.
Baseline: `qa/gate/bench-baseline.json` (24 `--all` cells = the Phase-5 close run of 2026-08-27; migrated cells = §3b medians).
Note the machine was *not* quiet for this run — the QA sweep had finished but the bundle measure and static checks overlapped
its first minutes (user call: a shared load hits every arm alike; the clean-room re-run is a Phase-7 item).

**Result: no gated M1b/M1c/M3a regression on any of the 29 cells.** Two flags, both speed-ups: `bklit/line/10000` M1c
**−25.5 %** (the legacy arm, untouched all phase; −22.7 % in §2.1 — same machine drift) and `migrated/scatter/1000` M1c
**−21.1 %** (D472, no per-point motion tracks above the 200-datum threshold; −29.3 % in §2.2(d)). The migrated paired cells
sit within +0.2 % (M1b), +5…+13 % (M1c) and +0.3…+6.2 % (M3a) of §3b, all inside D273's ±20 %. `migrated/line/1000` reports
0 console errors and a tooltip (7 errors / no tooltip before D494).

Two baseline omissions surfaced and were fixed in the gate driver, not the harness (**D500**): the driver hard-coded a
console-error baseline of 0 and a tooltip baseline of `true`, but the *legacy* `bklit/bar/1000` and `/10000` emit
514 742 / 1 540 000 negative-`<rect>`-attribute errors in the Phase-5 close run itself (516 148 / 1 540 000 today, +0.3 % / 0 %),
and `bklit/line/1000` has never satisfied the harness's tooltip signal in any recorded run back to 2026-08-23. Both are inherited
legacy behaviour on code this phase never touched; `qa/gate/bench-baseline.json` now carries them and the driver flags only an
increase past the D273 tolerance (errors) or a `true → false` transition (tooltip). The run's `bench.json` was re-derived under
that rule after the fact; no measurement changed.

| cell | M1a base → new | M1b base → new | M1c base → new | M3a base → new | err | tooltip |
|---|---|---|---|---|---|---|
| bklit/line/100 | 58.4 → 59.8 (+2.4%) | 1151.5 → 1152.1 (+0.1%) | 69.5 → 73.2 (+5.3%) | 31.6 → 32.0 (+1.3%) | 0 | true |
| bklit/line/1000 | 59.3 → 60.4 (+1.9%) | 1160.1 → 1160.1 (0.0%) | 85.9 → 82.3 (-4.2%) | 31.1 → 32.2 (+3.5%) | 0 | false |
| bklit/line/10000 | 65.2 → 68.9 (+5.7%) | 1194.7 → 1174.9 (-1.7%) | 126.7 → 94.3 (-25.5%) ‼ | 28.1 → 32.1 (+14.0%) | 0 | true |
| tanstack/line/100 | 26.0 → 24.9 (-4.2%) | 40.1 → 34.8 (-13.2%) | 58.4 → 57.3 (-2.0%) | 32.5 → 32.2 (-0.9%) | 0 | true |
| tanstack/line/1000 | 49.8 → 48.0 (-3.6%) | 70.6 → 76.9 (+8.9%) | 80.0 → 80.2 (+0.1%) | 32.6 → 32.6 (0.0%) | 0 | true |
| tanstack/line/10000 | 270.3 → 263.4 (-2.6%) | 409.3 → 402.6 (-1.6%) | 291.9 → 289.5 (-0.8%) | 77.0 → 74.4 (-3.4%) | 0 | true |
| bklit/area/100 | 59.3 → 55.5 (-6.4%) | 1140.8 → 1137.2 (-0.3%) | 67.8 → 68.6 (+1.2%) | 32.2 → 32.1 (-0.3%) | 0 | true |
| bklit/area/1000 | 60.1 → 60.2 (+0.2%) | 1158.7 → 1158.7 (0.0%) | 79.8 → 81.3 (+1.9%) | 30.5 → 30.4 (-0.2%) | 0 | true |
| bklit/area/10000 | 63.9 → 63.6 (-0.5%) | 1179.2 → 1174.8 (-0.4%) | 100.3 → 95.3 (-5.0%) | 29.7 → 29.8 (+0.3%) | 0 | true |
| tanstack/area/100 | 26.2 → 25.9 (-1.1%) | 39.7 → 35.7 (-10.1%) | 57.7 → 58.7 (+1.8%) | 32.3 → 32.2 (-0.3%) | 0 | true |
| tanstack/area/1000 | 54.2 → 56.6 (+4.4%) | 91.9 → 87.9 (-4.4%) | 87.4 → 92.5 (+5.8%) | 32.6 → 32.6 (0.0%) | 0 | true |
| tanstack/area/10000 | 319.7 → 330.2 (+3.3%) | 480.1 → 493.3 (+2.7%) | 345.5 → 360.6 (+4.4%) | 126.6 → 130.7 (+3.2%) | 0 | true |
| bklit/bar/100 | 65.9 → 60.4 (-8.3%) | 1592.9 → 1588.1 (-0.3%) | 190.5 → 203.6 (+6.9%) | 32.5 → 32.5 (0.0%) | 0 | true |
| bklit/bar/1000 | 269.2 → 272.5 (+1.2%) | 2034.0 → 2033.3 (0.0%) | 1685.7 → 1694.1 (+0.5%) | 32.6 → 32.6 (-0.2%) | 516148 | true |
| bklit/bar/10000 | 2230.4 → 2221.6 (-0.4%) | 7231.4 → 7158.7 (-1.0%) | 6765.1 → 6690.0 (-1.1%) | 158.1 → 156.1 (-1.3%) | 1540000 | true |
| tanstack/bar/100 | 35.2 → 34.9 (-0.9%) | 48.8 → 54.7 (+12.1%) | 67.6 → 69.4 (+2.6%) | 32.6 → 32.6 (0.0%) | 0 | true |
| tanstack/bar/1000 | 136.6 → 128.3 (-6.1%) | 204.5 → 196.6 (-3.9%) | 174.7 → 163.8 (-6.2%) | 50.2 → 48.8 (-2.9%) | 0 | true |
| tanstack/bar/10000 | 1331.2 → 1078.1 (-19.0%) | 1926.3 → 1642.0 (-14.8%) | 1355.4 → 1132.0 (-16.5%) | 565.8 → 504.5 (-10.8%) | 0 | true |
| bklit/scatter/100 | 49.6 → 49.4 (-0.4%) | 1146.8 → 1152.9 (+0.5%) | 141.7 → 148.7 (+4.9%) | 32.6 → 32.4 (-0.6%) | 0 | true |
| bklit/scatter/1000 | 129.8 → 121.9 (-6.1%) | 1290.1 → 1268.8 (-1.7%) | 617.1 → 566.9 (-8.1%) | 32.6 → 32.6 (0.0%) | 0 | true |
| bklit/scatter/10000 | 953.0 → 886.9 (-6.9%) | 3399.5 → 3154.5 (-7.2%) | 2641.2 → 2432.5 (-7.9%) | 74.0 → 69.9 (-5.5%) | 0 | true |
| tanstack/scatter/100 | 30.2 → 30.1 (-0.3%) | 46.7 → 49.5 (+6.0%) | 61.5 → 62.7 (+2.1%) | 32.6 → 32.5 (-0.3%) | 0 | true |
| tanstack/scatter/1000 | 95.0 → 94.8 (-0.2%) | 152.0 → 150.8 (-0.8%) | 117.8 → 117.7 (-0.1%) | 36.0 → 35.4 (-1.5%) | 0 | true |
| tanstack/scatter/10000 | 777.7 → 744.8 (-4.2%) | 1210.8 → 1166.2 (-3.7%) | 707.4 → 650.2 (-8.1%) | 211.9 → 217.2 (+2.5%) | 0 | true |
| migrated/line/1000 | 51.8 → 54.3 (+4.8%) | 1115.5 → 1118.0 (+0.2%) | 76.7 → 86.7 (+13.0%) | 32.5 → 32.6 (+0.3%) | 0 | true |
| migrated/area/1000 | 47.3 → 45.3 (-4.2%) | 1151.2 → 1153.7 (+0.2%) | 88.0 → 92.9 (+5.6%) | 32.2 → 32.6 (+1.2%) | 0 | true |
| migrated/composed/1000 | 83.3 → 88.1 (+5.8%) | 1664.8 → 1665.5 (0.0%) | 123.8 → 130.3 (+5.2%) | 32.2 → 34.2 (+6.2%) | 0 | true |
| migrated/bar/100 | 38.3 → 35.9 (-6.3%) | 1576.1 → 1575.1 (-0.1%) | 72.0 → 77.6 (+7.8%) | 29.7 → 31.2 (+5.1%) | 0 | true |
| migrated/scatter/1000 | 77.5 → 80.3 (+3.6%) | 1258.6 → 1206.4 (-4.1%) | 141.1 → 111.3 (-21.1%) ‼ | 28.8 → 32.2 (+11.8%) | 0 | true |

Reading: M1a (void channel) shown for completeness. `tanstack/bar/10000` −15…−19 % across the board and `bklit/scatter/*` −6…−8 %
are the reference and legacy arms respectively — machine-state drift on code nothing in this phase touched, inside the flag on the
gated channels. The DoD line "`bench --all` no regression vs phase-5 latest" is ticked on this run.

## 3. QA parity matrix

Sweep `docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z` (label `final-gate`, `pnpm gate:qa -- --workers 4`, HEAD + the D473–D497
fixes, machine otherwise idle). Harness `qa/screenshot.mjs` unchanged (protected); gate = 4800 px of 960 000 (0.5 %). Every cell is
judged against its inherited history (`qa/results/<chart>/*/report.json`, bklit vs migrated, all runs before the sweep start) under
the mode-distribution rule (D402/D403), and the 13 above-line cells were re-checked by hand against the Phase-5 final matrix
(`docs/phase-5/captures/5-3-5-final-matrix.md`) — see §3.2. Full 190-row table with diff-png paths: `docs/phase-6/gate/latest/qa-matrix.md`.

**43 runs, 190 cells (189 gated): gate FAIL 13, out-of-range 5, tooltip failures 0, console errors 0, wall-clock 8m40s (4 workers).**

### 3.1 Per-run summary (max cell of each run)

| chart/n | cells | max px | max % | above 0.5 % | statuses |
|---|---|---|---|---|---|
| area/1000 | 4 | 1377 (hover-70) | 0.143 | — | in-range 1, mode 1, seen 2 |
| arealoading/1000 | 4 | 541 (hover-70) | 0.056 | — | in-range 2, seen 2 |
| areamultiaxis/1000 | 4 | 1832 (hover-70) | 0.191 | — | in-range 2, mode 1, seen 1 |
| bar/100 | 4 | 2288 (hover-50) | 0.238 | — | in-range 2, mode 1, seen 1 |
| bardepth/100 | 6 | 762 (hover-30) | 0.079 | — | in-range 2, mode 1, seen 3 |
| barloading/100 | 4 | 167154 (hover-50) | 17.412 | 4 | in-range 3, out-of-range 1 |
| barmultiaxis/100 | 4 | 2160 (hover-50) | 0.225 | — | in-range 3, mode 1 |
| barsquares/100 | 7 | 2346 (hover-30) | 0.244 | — | in-range 5, seen 2 |
| brush/1000 | 5 | 1231 (brush-hover-50) | 0.128 | — | seen 5 |
| candlelegend/1000 | 4 | 3497 (settled) | 0.364 | — | seen 4 |
| candlestick/1000 | 4 | 3263 (settled) | 0.340 | — | out-of-range 3, seen 1 |
| choropleth/100 | 4 | 1348 (hover-70) | 0.140 | — | in-range 1, mode 1, seen 2 |
| composed/1000 | 4 | 1846 (hover-70) | 0.192 | — | in-range 1, mode 1, seen 2 |
| composedmultiaxis/1000 | 4 | 2435 (hover-70) | 0.254 | — | in-range 1, mode 1, seen 2 |
| composedstacked/100 | 4 | 3676 (hover-50) | 0.383 | — | in-range 3, seen 1 |
| funnel/1000 | 4 | 0 (settled) | 0.000 | — | mode 4 |
| funnelvertical/1000 | 4 | 0 (settled) | 0.000 | — | mode 4 |
| gauge/1000 | 4 | 65 (settled) | 0.007 | — | in-range 4 |
| gaugelinear/1000 | 4 | 0 (settled) | 0.000 | — | mode 4 |
| griddefault/1000 | 4 | 1172 (hover-70) | 0.122 | — | mode 1, seen 3 |
| heatmap/52 | 4 | 4185 (hover-70) | 0.436 | — | in-range 1, mode 1, seen 2 |
| legend/1000 | 4 | 0 (settled) | 0.000 | — | mode 4 |
| legendhover/1000 | 4 | 1154 (hover-item-0) | 0.120 | — | mode 2, seen 2 |
| line/1000 | 4 | 1267 (hover-70) | 0.132 | — | in-range 1, mode 1, seen 2 |
| linemultiaxis/1000 | 4 | 1821 (hover-70) | 0.190 | — | in-range 1, mode 1, seen 2 |
| liveline/100 | 4 | 2273 (hover-50) | 0.237 | — | in-range 4 |
| markers/100 | 8 | 6147 (hover-70) | 0.640 | 5 | in-range 4, seen 4 |
| patternarea/1000 | 12 | 1406 (pattern-circles) | 0.146 | — | mode 2, seen 10 |
| pie/1000 | 4 | 394 (settled) | 0.041 | — | in-range 1, mode 3 |
| profitloss/1000 | 4 | 1115 (hover-70) | 0.116 | — | in-range 2, mode 1, seen 1 |
| projection/1000 | 4 | 1205 (hover-30) | 0.126 | — | in-range 1, seen 3 |
| projectionxdomain/1000 | 4 | 1839 (hover-70) | 0.192 | — | in-range 1, seen 3 |
| radar/6 | 4 | 757 (hover-50) | 0.079 | — | mode 1, out-of-range 1, seen 2 |
| refarea/1000 | 4 | 1219 (hover-70) | 0.127 | — | mode 1, seen 3 |
| refareamultiaxis/1000 | 4 | 4242 (hover-70) | 0.442 | — | seen 4 |
| ring/4 | 4 | 2996 (hover-50) | 0.312 | — | in-range 1, mode 1, seen 2 |
| sankey/33 | 4 | 11017 (hover-30) | 1.148 | 2 | in-range 2, mode 1, seen 1 |
| scatter/1000 | 4 | 6274 (hover-70) | 0.653 | 1 | in-range 1, seen 3 |
| scattermultiaxis/1000 | 4 | 6349 (hover-70) | 0.661 | 1 | in-range 3, mode 1 |
| segment/1000 | 4 | 1196 (hover-70) | 0.125 | — | mode 1, seen 3 |
| sunburst/27 | 4 | 3107 (hover-30) | 0.324 | — | seen 4 |
| sunburst/33 | 4 | 2768 (hover-30) | 0.288 | — | seen 4 |
| sunchrome/27 | 4 | 3252 (hover-30) | 0.339 | — | seen 4 |

### 3.2 Cells above the 0.5 % line or outside their history range — rulings

| cell | px (%) | Phase-5 base / range | Phase-6 history (mode) | ruling |
|---|---|---|---|---|
| markers/100 hover-30 | 6045 (0.630) | 3673 PASS · [3574, 8430] | [3574, 15483] (3717×7/34) | in inherited range — ACCEPT-WITH-LOG, D498 |
| markers/100 hover-70 | 6147 (0.640) | 3679 PASS · [3328, 8004] | [3328, 15251] (3633×7/34) | in inherited range — ACCEPT-WITH-LOG, D498 |
| markers/100 legend-hover-0 | 4969 (0.518) | — (cell added in 6.x) | [3756, 18168] (4967×4/34) | at mode — ACCEPT-WITH-LOG, D498 |
| markers/100 legend-hover-1 | 5116 (0.533) | — | [3729, 17740] (3757×6/34) | in range — ACCEPT-WITH-LOG, D498 |
| markers/100 legend-hover-clear | 5742 (0.598) | — | [3731, 16612] (3755×8/34) | in range — ACCEPT-WITH-LOG, D498 |
| barloading/100 settled | 18839 (1.96) | 51852 FAIL · [18124, 51852] | [18124, 51852] (18216×2/12) | inherited FAIL (loading-skeleton phase) — unchanged |
| barloading/100 hover-30 | 161310 (16.8) | 161019 FAIL · [158874, 161019] | [158874, 161541] | +0.2 % of a 161k-px inherited FAIL cell — animation phase, not a regression |
| barloading/100 hover-50 | 167154 (17.4) | 142625 FAIL · [142625, 161336] | [133147, 161353] | +3.6 % of an inherited FAIL cell — animation phase; only cell above every ceiling, ACCEPT-WITH-LOG D498 |
| barloading/100 hover-70 | 143013 (14.9) | 161371 FAIL · [159081, 164456] | [132903, 164456] | below Phase-5 floor, inside Phase-6 range — animation phase |
| candlestick/1000 hover-30/50/70 | 1848 / 689 / 591 | 4771 / 3094 / 3473 PASS | floors 1877 / 818 / 729 | **below floor — improvement** (wick split, D495) |
| radar/6 hover-50 | 757 (0.079) | 851 PASS · [851, 852] | floor 758 | **below floor — improvement** (scene-key wrap, D493) |
| sankey/33 hover-30 | 11017 (1.15) | 3767 PASS · [3506, 28944] | [3506, 31888] (3690×2/29) | in inherited range (bimodal history 3.7k/10k/16k/24k) — ACCEPT-WITH-LOG D498; Phase-7 item |
| sankey/33 hover-70 | 5021 (0.523) | 1633 PASS · [1270, 33134] | [1270, 11636] (1761×2/29) | in inherited range — ACCEPT-WITH-LOG D498 |
| scatter/1000 hover-70 | 6274 (0.653) | 2503 PASS · [1884, 23324] | [2018, 143608] (2847×6/47) | in inherited range (hover-timing tail) — ACCEPT-WITH-LOG D498 |
| scattermultiaxis/1000 hover-70 | 6349 (0.661) | 2126 PASS · [2123, 129924] | (2123×1/14) | in inherited range — ACCEPT-WITH-LOG D498 |

Verdict: **no cell regressed past its inherited history**; the only above-ceiling readings are two barloading cells whose whole
value is the loading-skeleton animation phase (an inherited FAIL at 15–17 % since Phase 5). Five cells moved *below* their
historical floor, all attributable to this window's fixes. The DoD line "full QA matrix within inherited known baselines" is
ticked on that basis.

### 3.3 What the fix window changed (D483–D497, verified per chart before the sweep)

| chart/cell | before → after (px) | fix |
|---|---|---|
| choropleth/100 hover-30 | 11953 → 791 | scene-key `valueKey` string wrap reproduced + spherical centroid anchor (D493) |
| radar/6 hover-50 | 851 → 758 | same key-wrap helper (D487/D493) |
| line/1000 (bench) | 7 console errors, no tooltip → 0, tooltip | highlight-band `lineY` stripped of `interaction` (`withoutInteraction`, D494) |
| candlestick/1000 hover-30/50/70 | 4771/3094/3473 → 1848/689/591 (sweep; 1877/818/729 at verification) | wick split into upper/lower rects (no double-composite dim, D495) |
| liveline/100 settled | 4197 → 1278 → 1084 (sweep) | `.nice()` restored on the y scale (D496); Geist Mono + tick `dy` (D497) |


## 4. Typecheck / build / lint / guards at gate

Final gate run `docs/phase-6/gate/runs/2026-09-02T20-09-29-038Z` (`pnpm gate:checks`, re-run after the two type-only lint edits;
the bench/app JS asset hash `index-CnKMuzu2.js` is identical before and after, so the QA sweep and bench above stand). Results in
`docs/phase-6/gate/latest/checks.json` + `census.json`.

| check | result |
|---|---|
| `cd showcase && npx tsc --noEmit` | exit 0, 0 errors |
| `cd bench/app && npm run build` | exit 0 (chunk-size warning only) |
| `cd showcase && npx eslint migrated` | 0 errors, **24 warnings** (18 at D470 + 6 `no-explicit-any` on `withMarkerBaseClassName` in `internal/series-marker-mark.ts`, added by the gate-fix window; a generic signature fails `createMark`'s `ChartValue` constraint, so it stays as lint debt — D501; 2 unused type imports the window left in `scatter-chart.tsx` were removed) |
| `node scripts/reach-in-guard.mjs` (`pnpm guard:reach-in`) | 79 sites / 15 files, 0 failures — OK (D468) |
| `node scripts/bundle-gate.mjs` (`pnpm guard:bundle`) | 43 pins, 0 FAIL, 0 missing (pins at `c1e9ced`, +1.2 % used of +3 %, §1.5) |
| QA sweep (§3) | 190 cells, 0 above inherited history except two barloading animation-phase cells; 0 tooltip failures; 0 console errors |
| Bench (§2.3) | 29 cells, 0 gated regressions, 2 speed-up flags |
