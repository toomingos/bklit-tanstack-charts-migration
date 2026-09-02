# Phase-6 gate audit

Scope: the QA pixel gate (`qa/screenshot.mjs`), the bench gate (`bench/run.mjs`), the bundle gate (`bench/measure-bundle.mjs` + `scripts/bundle-gate.mjs`), the census (`scripts/reach-in-guard.mjs`) and the sequential sweep script (`$S/qa-sweep.sh`) as run on the morning of 2026-09-02. Protected files were not modified; the new drivers under `qa/gate/` wrap them. Measurements: 8-CPU macOS box, dist built 10:27Z, 43-run roster (`qa/gate/roster.txt`, 190 cells).

## A. The sequential sweep, step by step

| # | step (per roster entry, ×43) | where it runs | cost | verdict |
| --- | --- | --- | --- | --- |
| 1 | `qa/screenshot.mjs` boot: node + Playwright import | driver process | ~0.8 s | inherent per process; parallelised by the pool |
| 2 | stale-build scan (`distIsStale` mtime walk of showcase + bench/app/src) | 1st run only (sweep exports `QA_SKIP_REBUILD=1` afterwards) | ~1–2 s; a rebuild (`vite build`) ~20–35 s | keep, once per sweep (`buildDistOnce`) |
| 3 | `ensureServer`: probe 5198, else spawn `vite preview --strictPort` and poll | every run; the sweep never keeps a server alive, so each run **boots and tears down its own preview** | ~1.5–2.5 s boot + kill | **redundant ×42** — one preview per batch |
| 4 | Chromium launch + 2 contexts (A/B), viewport 1200×800 | every run | ~1 s | inherent per process (browser cannot be shared across processes) |
| 5 | per impl: navigate, `waitForFunction(__benchSettled)`, `__benchPaintDone`, `+200 ms` settle | 2× per run | 0.5–3 s (pie/1000 ≈ 40 s per impl, funnel ≈ 60 s per impl) | inherent; pie/funnel dominate (see below) |
| 6 | 3 hover captures: move to (2,2) → +30 ms → move (10 steps) → **+700 ms `HOVER_WAIT_MS`** → tooltip detect → screenshot | 2× per run | ≥2.3 s per impl | inherent; the 700 ms is the tooltip-spring settle margin (research/05 Q1) |
| 7 | scenario extras: legend hover ×3 (+700 ms each), brush ×4 (+900 ms), pattern ×8 (+300 ms), depth ×2 (+300 ms), marker fan (extra context, +900 ms) | 2× per run where applicable | 2–8 s | inherent |
| 8 | pixelmatch 4–12 pairs, write PNGs + report.json | per run | 0.3–1 s | inherent |
| 9 | sweep post-processing: grep PASS/FAIL lines from logs; `gate-compare.py` re-parses logs and walks `qa/results` | after the sweep | ~5 s | replaced by `compare-qa.mjs` reading report.json directly |

Per-run wall-clock (parallel-1, identical dist): median 7.8 s; funnel/1000 133 s, funnelvertical/1000 135 s, pie/1000 88 s, barsquares 23 s, composed 21 s, gauge/gaugelinear 21 s, composedmultiaxis 17 s, markers 15 s; everything else < 13 s. Sum of runs 12m19s–12m35s. The sequential sweep took **≈11m15s** (14:41:14 → ~14:52:20 local); the parallel driver takes **3m07s–3m45s** with 4 workers (3.0–3.6× faster). The three long runs (funnel, funnelvertical, pie) are 356 s of the 739 s sum, so with 4 workers the critical path is ≈ funnel (135 s) + tail; worker counts above 4 cannot beat ~2m20s and only add CPU contention to the timing-sensitive cells.

Where the funnel/pie time goes: funnel n=1000 renders 1000 per-stage overlay `div`s (bklit) and the harness's discrete hover-zone snapping (`FUNNEL_CHARTS`) walks every cell's bounding box before each capture; pie n=1000 draws 1000 slices whose reveal must settle before `__benchSettled` resolves. Both are properties of the fixtures at n=1000 — sequential runs show the same 130 s / 87 s — not of the driver.

Redundant or wasteful in the old sweep: (3) per-run preview boot/teardown (≈ 42 × 2 s ≈ 1.5 min); the old sweep's serial execution of 40 short runs whose CPU use is < 1 core each; log-grep post-processing that loses the report's `tooltipVisible`/`informational` fields; no history comparison (the D402/D403 mode rule was applied by hand); and a scratch-dir log namespace shared with the executors' `qa-locked.sh` (their logs overwrite the sweep's, which is why `$S/qa/*.log` cannot be used as the sequential record — `qa/results/*/report.json` in the 13:41Z–13:53Z window is used instead).

Bench (`bench/run.mjs`): one preview on 5199, one Chromium, sequential cells; `--all` measures the 24 legacy cells but **not** migrated, and each invocation overwrites `bench/results/latest.json` — so the Phase-5 numbers cannot be re-read from `latest.json` and are materialised in `qa/gate/bench-baseline.json`. Bundle: `measure-bundle.mjs` builds 104 vite bundles (~2–4 min) — the only unavoidable long step outside QA.

## B. Coverage matrix (what each roster cell exercises)

`cell` = captured as a gated pixel cell in `qa/screenshot.mjs`; `not-gated` = a hook or probe exists but its output is not a gate cell; `—` = not captured for this chart. Hover dim and tooltip are captured together (three fixed-fraction pointer positions; the tooltip check is presence-only: `.ts-chart-tooltip` on migrated, a text-length heuristic on bklit). "Legend toggle" exists in neither implementation. The `state=loading` presets capture one reduced-motion frame and no hovers.

| chart | n | pointer hover dim | tooltip | legend hover dim | legend toggle | brush | zoom | depth toggle | drill/click | live streaming | loading state | multi-axis | reveal animation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| area | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | not-gated (state=loading supported) | — | not-gated (settle waits it out; reveal-probe.mjs) |
| arealoading | 1000 (loading) | — | — | — | n/a (no impl) | — | — | — | — | — | cell (static frame, reduced-motion) | — | — |
| areamultiaxis | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | cell (settled+hover only) | not-gated (settle waits it out; reveal-probe.mjs) |
| bar | 100 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| bardepth | 100 | cell | cell (presence only) | — | n/a (no impl) | — | — | cell | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| barloading | 100 (loading) | — | — | — | n/a (no impl) | — | — | — | — | — | cell (static frame, reduced-motion) | — | — |
| barmultiaxis | 100 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | cell (settled+hover only) | not-gated (settle waits it out; reveal-probe.mjs) |
| barsquares | 100 | cell | cell (presence only) | cell | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| brush | 1000 | cell | cell (presence only) | — | n/a (no impl) | cell | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| candlelegend | 1000 | cell | cell (presence only) | cell | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; k4-tween-probe) |
| candlestick | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | not-gated (state=loading supported) | — | not-gated (settle waits it out; k4-tween-probe) |
| choropleth | 100 | cell | cell (presence only) | — | n/a (no impl) | — | not-gated (qa/zoom-gate.mjs, __benchZoomTo) | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| composed | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | not-gated (state=loading supported) | — | not-gated (settle waits it out; reveal-probe.mjs) |
| composedmultiaxis | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | cell (settled+hover only) | not-gated (settle waits it out; reveal-probe.mjs) |
| composedstacked | 100 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| funnel | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| funnelvertical | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| gauge | 1000 | — | — | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| gaugelinear | 1000 | — | — | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| griddefault | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| heatmap | 52 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | not-gated (state=loading supported) | — | not-gated (settle waits it out; reveal-probe.mjs) |
| legend | 1000 | cell | cell (presence only) | cell | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| legendhover | 1000 | cell | cell (presence only) | cell | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| line | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | not-gated (state=loading supported) | — | not-gated (settle waits it out; reveal-probe.mjs) |
| linemultiaxis | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | cell (settled+hover only) | not-gated (settle waits it out; reveal-probe.mjs) |
| liveline | 100 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | not-gated (bench M3b only) | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| markers | 100 | cell | cell (presence only) | cell | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| patternarea | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| pie | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| profitloss | 1000 | cell | cell (presence only) | not-gated (hook exists) | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| projection | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| projectionxdomain | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| radar | 6 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| refarea | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| refareamultiaxis | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | cell (settled+hover only) | not-gated (settle waits it out; reveal-probe.mjs) |
| ring | 4 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| sankey | 33 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| scatter | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | not-gated (state=loading supported) | — | not-gated (settle waits it out; reveal-probe.mjs) |
| scattermultiaxis | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | cell (settled+hover only) | not-gated (settle waits it out; reveal-probe.mjs) |
| segment | 1000 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | — | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| sunburst | 27 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | not-gated (__benchDrilldown; sb-chrome-probe) | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| sunburst | 33 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | not-gated (__benchDrilldown; sb-chrome-probe) | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
| sunchrome | 27 | cell | cell (presence only) | — | n/a (no impl) | — | — | — | not-gated (__benchDrilldown; sb-chrome-probe) | — | — | — | not-gated (settle waits it out; reveal-probe.mjs) |
Coverage gaps worth naming: zoom (choropleth) and drill (sunburst/sunchrome) have hooks and standalone probes but no roster cell; live streaming is only measured by bench M3b (per-tick script cost), never pixel-compared mid-stream; the loading state is capturable for six more charts (`&state=loading`) but only the two presets are in the roster; multi-axis fixtures capture no axis-specific state (tick/label parity rides on the settled cell); reveal animation is waited out, never compared (the `qa/reveal-probe.mjs` / `qa/k4-tween-probe.mjs` probes exist but are not gated); `profitloss` implements `__qaSetLegendHover` yet the harness does not drive it.

## C. What each channel measures and cannot detect

| channel | measures | blind to |
| --- | --- | --- |
| QA settled cell | one full-viewport frame after `__benchSettled` + 200 ms, pixelmatch vs 0.5% (4800 px) | anything before the settle (reveal replay, flash of unstyled axes); sub-threshold drift (an axis-label font change is ~200–600 px and passes); layout changes outside the 1200×800 viewport |
| QA hover-30/50/70 | frame at +700 ms after a 10-step pointer move; tooltip presence | **transient flashes** (a dim that arrives late but before 700 ms, a tooltip that flickers); **hover lag** (any latency < 700 ms is invisible, > 700 ms shows as a spurious dim/tooltip diff); **tooltip content** (position, text, number formatting — only presence is asserted, and bklit's side uses a text-length heuristic that false-negatives on charts whose tooltip is short: choropleth hover-30); pointer position mismatch between impls that lands on different data points (candlestick/choropleth "straddle" cells, D413) |
| QA legend-hover cells | frame at +700 ms after `__qaSetLegendHover(i)`; only 5 charts | dim transition timing; legend item geometry itself (both impls render their own legend, so a legend layout drift is counted as diff and cannot be told apart from a dim failure) |
| QA brush / pattern / depth cells | frame after a hook-driven prop change (+900/+300/+300 ms) | re-reveal on prop change if it finishes inside the wait; interaction path (real drag) is never exercised |
| history status (D402/D403) | new px value vs the multiset of past values for the same cell | a regression that has been recorded a few times is "seen" — after 2–3 failing sweeps a FAIL looks historically normal; the **mode** (not "seen") is the signal, and the mode itself drifts once the failing value repeats ≥ mode count |
| bench M1b/M1c/M3a (±20%, D273) | settle time, script time, update cost per cell, median of n | run-to-run noise ≈ 5–15% on this box; anything CPU-adjacent (a concurrent QA sweep) perturbs it — hence `gate:all` runs bench after QA, not alongside; M1a is VOID (BASELINE §3b) |
| bench M3c | per-move script and frame time, tooltip appeared | visual correctness of the tooltip; hover lag as perceived (frame time only) |
| bundle gate (3% per scenario pin) | gzip size of 43 pinned scenario bundles | runtime cost; tree-shaking regressions in unpinned scenarios (reported as `info` only) |
| census (`reach-in-guard`) | reach-ins into `@tanstack/charts` internals vs the ledger | behavioural parity; anything not on the ledger's patterns |
| probes (`qa/gate/probes`) | hover lag (ms to first dim/tooltip), legend-dim settle, bardepth round-trip, re-reveal samples at +100/+400/+900 ms | one-shot samples (no statistics beyond 3 repeats); they sample the DOM (`opacity`, `getBBox`) — a canvas/CSS-variable based dim is invisible to them |

## D. Driver design notes

- One `vite preview` (5198) for the whole QA batch, started after `buildDistOnce` (a single stale check); workers spawn `qa/screenshot.mjs --base-url` with `QA_SKIP_REBUILD=1`. The preview is torn down at the end. The shared-port protocol (`$S/qa.lock`, re-entrant within `gate:all`) is held from the checks build through QA and probes so no other harness has its served dist rebuilt underneath it.
- Longest-first scheduling from the previous run's `qa-timings.json` (funnel/funnelvertical/pie start first).
- Worker count 4: chosen empirically (see SUMMARY / the verification section of the run report); 8 CPUs, each Chromium pair uses 1–2 cores, and the critical path is bounded by funnel at ~135 s regardless of worker count.
- Bench runs sequentially after QA by default (`--bench-parallel` to overlap); bundle after bench. History cutoff for the compare step is the run's own start time so a run never judges itself against itself.
