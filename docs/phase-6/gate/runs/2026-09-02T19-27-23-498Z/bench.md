# Bench gate

Generated 2026-09-02T19:30:29.558Z. Cells: migrated/line/1000, migrated/bar/100. Baseline: qa/gate/bench-baseline.json (Bench gate baseline. --all cells (bklit/tanstack x line/area/bar/scatter x 100/1000/10000) = the Phase-5 close latest.json run of 2026-08-27 (the run docs/phase-6/BENCHMARKS.md §2.1 compares against). migrated/* and bklit control rows not in --all (bklit/composed/1000) = docs/phase-5/BASELINE.md §3b medians. Flag rule: D273 ±20% on M1b/M1c/M3a; M1a is a VOID channel on this machine (BASELINE §3b verdict) and is reported informationally. Regenerate by hand only when a new baseline is formally adopted (D-entry).).
Flag rule D273: |Δ| > 20% on M1b/M1c/M3a. M1a is a VOID channel on this machine (BASELINE §3b) — informational only.

**2 cells measured (0 skipped), 0 flagged metric(s), 1 cell(s) with console errors, wall-clock 2m42s.**
| cell | M1a | M1b | M1c | M3a | M3c/move | heap | console err | tooltip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| migrated/line/1000 | 51.8 → 54.1 (+4.4%) (void) | 1115.5 → 1117.8 (+0.2%) | 76.7 → 86.86 (+13.3%) | 32.5 → 32.5 (0%) | 0.6 → 9.36 (+1460.1%) | 5.2 MB → 5.9 MB (+13.3%) | 7 | false |
| migrated/bar/100 | 38.3 → 37.2 (-2.9%) (void) | 1576.1 → 1575 (-0.1%) | 72 → 79.39 (+10.3%) | 29.7 → 31.3 (+5.4%) | 0.7 → 9.33 (+1233.4%) | 4.4 MB → 5.2 MB (+18.6%) | 0 | true |

Run dirs: `bench/results/2026-09-02T19-29-09-329Z`, `bench/results/2026-09-02T19-30-29-251Z`
