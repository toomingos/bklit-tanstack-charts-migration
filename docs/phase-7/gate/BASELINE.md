# Phase 7 — V0.3 baseline

The reference every 7.5 comparison reads (replaces the inherited phase-6 baseline of D503).

| Field | Value |
|---|---|
| Commit | `61d6179` (V0.3 retarget; last wave-0 code state before wave 1) |
| Tree hash | `69b9ef079d0c4bd77d9f2db6e7a3d614794788fc` (`git rev-parse 61d6179^{tree}`) |
| Run | `docs/phase-7/gate/runs/2026-09-05T11-24-30-421Z` (+ `qa/gate/latest`), label "V0.3 baseline @ 61d6179 (frozen worktree)" |
| Command | `pnpm gate:all -- --workers 4 --probes --issues --label …` in a git worktree at `61d6179` (`node_modules`, `repos`, `archive` linked from the main checkout) while wave-1 executors edited the main tree |
| Package | `@tanstack/charts` 0.16.0, `@tanstack/react-charts` 0.16.0 |
| Wall clock | 45m53s: checks 18.5 s, QA 10m51s, probes 20m22s, bench 14m09s, bundle 11.8 s |

## Headline

- Checks: tsc 0 errors, bench build ok, lint 7 errors (the floor V5.4 takes to 0), census 17 failures / 67 sites (G2, folded into V4.4), bundle-gate ok after the re-pin below.
- QA: 43 runs / 190 cells, gate FAIL 6 (markers hover-30/70, barloading hover-50/70, sankey hover-30/70: the D498-ruled cells), harness FAIL 6, tooltip failures 0, errors 0.
- Probes (first run with probes; phase 6 did not run them): hover-lag 5 flags (bar/100 settles late, scatter/1000 dim lag, candlestick/1000 tooltip lag, pie/1000 and sankey/33 dim-presence mismatch), legend-hover-dim 4 flags (legendhover, candlelegend, markers, barsquares), bardepth-toggle 0, no-rereveal 0. These are the numbers V2.2–V2.6 and V2.3 move.
- Bench: 10 paired cells, 2 flags vs `qa/gate/bench-baseline.json` (phase-5 medians, kept): migrated/line/1000 M1c script 95.6 ms vs 76.7 (+24.7 %), migrated/scatter/1000 M3a update 22.9 ms vs 28.8 (−20.5 %). The bench ran with three executors compiling on the same machine; the line flag is noise until a quiet re-run says otherwise (7.5 re-runs bench on an idle machine).
- Bundle: 43 scenarios measured (`bench/results/bundle-sizes.json`), Σgzip 5 605 143.

## QA vs the phase-6 baseline (`archive/phase-6/docs/gate/latest`, run 2026-09-02T20-09-29-038Z)

`node qa/gate/compare-qa.mjs --diff archive/phase-6/docs/gate/latest/qa-matrix.json <run>/qa-matrix.json`: 86 of 190 cells changed, 34 by more than 500 px, 7 gate flips, all FAIL → PASS: markers legend-hover-0/1/clear (4969/5116/5742 → 3751/4519/4529), barloading settled and hover-30 (18839/161310 → 0), scatter and scattermultiaxis hover-70 (6274/6349 → 4690/4718). Largest moves: barloading hover-50/70 (167154/143013 → 53588/33734), scatter settled (4330 → 34), ring/4 hover-70 (136 → 2970), and the bar family hover/legend/depth cells (+1 650…+2 050 px each, bar, bardepth, barmultiaxis, barsquares) from the pre-phase bar focus restore (`325a065`, `6b4a41c`). No cell moved from PASS to FAIL.

## Bundle re-pin (D518)

`bench/results/bundle-gate.json` pins moved from `c1e9ced` (2026-09-01, 0.14.0) to this run's measurements: 41 raised, 2 lowered. Growth is the 0.16.0 pin plus the wave-0 fixes: +3.5 % (sankey) … +12.6 % (legendhover), Σ +5.82 %. Lowered: pie −7.2 %, barloading −97.1 % (`bar-chart-loading.tsx` is a standalone skeleton since the faithful port; 2.4 kB gzip). The phase-7 bundle target (V5.1, migrated ≤ 1.10 × legacy) is measured against legacy, not against these pins; the pins are the regression guard from here (tolerance 3 %).

## Notes

- `logs/` under the run dir stay local (`*.log` is gitignored); the json/md evidence is committed.
- The first checks pass in the worktree reported 194 tsc errors because `showcase/repos` (gitignored) was not linked; the stage was re-run at `61d6179` after linking it (tsc 0) and again after the re-pin (bundle-gate ok). `run-all.json` keeps the first pass's stage timings.
- `qa/gate/bench-baseline.json` is unchanged: a baseline measured beside three compiling executors would be worse evidence than the phase-5 medians it would replace.
