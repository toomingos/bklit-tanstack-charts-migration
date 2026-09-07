# Bench gate

Generated 2026-09-07T00:43:37.534Z. Cells: bklit/line/1000, migrated/line/1000, bklit/area/1000, migrated/area/1000, bklit/composed/1000, migrated/composed/1000, bklit/bar/100, migrated/bar/100, bklit/scatter/1000, migrated/scatter/1000. Baseline: qa/gate/bench-baseline.json (Bench gate baseline. --all cells (bklit/tanstack x line/area/bar/scatter x 100/1000/10000) = the Phase-5 close latest.json run of 2026-08-27 (the run docs/phase-6/BENCHMARKS.md §2.1 compares against). migrated/* and bklit control rows not in --all (bklit/composed/1000) = docs/phase-5/BASELINE.md §3b medians. Flag rule: D273 ±20% on M1b/M1c/M3a; M1a is a VOID channel on this machine (BASELINE §3b verdict) and is reported informationally. Regenerate by hand only when a new baseline is formally adopted (D-entry). consoleErrorCount baselines: legacy bklit/bar/1000 and /10000 emit negative-<rect>-attribute errors (rx/ry/width) in the Phase-5 close run itself (514742 / 1540000) — inherited legacy behaviour, gated on increase only (D500). m3c_tooltipAppeared baseline: legacy bklit/line/1000 is false in every recorded run since 2026-08-23 (Phase-5 close included) — inherited; flagged only where the baseline is true (D500).).
Flag rule D273: |Δ| > 20% on M1b/M1c/M3a. M1a is a VOID channel on this machine (BASELINE §3b) — informational only.

**10 cells measured (0 skipped), 7 flagged metric(s), 0 cell(s) with console errors, wall-clock 43m14s.**
| cell | M1a | M1b | M1c | M3a | M3c/move | heap | console err | tooltip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bklit/line/1000 | 59.3 → 58.1 (-2%) (void) | 1160.1 → 1158.9 (-0.1%) | 85.91 → 87.39 (+1.7%) | 31.1 → 32.2 (+3.5%) | 1.54 → 1.55 (+0.8%) | 5.2 MB → 5.6 MB (+8.9%) | 0 | false |
| migrated/line/1000 | 51.8 → 52.5 (+1.4%) (void) | 1115.5 → 1162.7 (+4.2%) | 76.7 → 109.84 (+43.2%) **‼** | 32.5 → 32.6 (+0.3%) | 0.6 → 23.2 (+3767%) | 5.2 MB → 8.6 MB (+65.6%) | 0 | true |
| bklit/area/1000 | 60.1 → 62.9 (+4.7%) (void) | 1158.7 → 1157.8 (-0.1%) | 79.77 → 88.95 (+11.5%) | 30.5 → 30.5 (0%) | 3.18 → 3.6 (+13.2%) | 5.0 MB → 5.5 MB (+9.2%) | 0 | true |
| migrated/area/1000 | 47.3 → 64.5 (+36.4%) (void) | 1151.2 → 1175.2 (+2.1%) | 88 → 127.58 (+45%) **‼** | 32.2 → 32.6 (+1.2%) | 0.6 → 25.22 (+4102.5%) | 5.8 MB → 10.4 MB (+78.9%) | 0 | true |
| bklit/composed/1000 | 78.4 → 77.7 (-0.9%) (void) | 1310.9 → 1296.1 (-1.1%) | 541.8 → 516.83 (-4.6%) | 21.5 → 20.35 (-5.3%) | 13.5 → 12.95 (-4.1%) | 12.2 MB → 12.7 MB (+4.3%) | 0 | true |
| migrated/composed/1000 | 83.3 → 110.2 (+32.3%) (void) | 1664.8 → 1192.3 (-28.4%) **‼** | 123.8 → 152.95 (+23.5%) **‼** | 32.2 → 32.6 (+1.2%) | 0.9 → 31.28 (+3375.3%) | 6.8 MB → 11.4 MB (+67.8%) | 0 | true |
| bklit/bar/100 | 65.9 → 70.1 (+6.4%) (void) | 1592.9 → 1601.9 (+0.6%) | 190.47 → 209.27 (+9.9%) | 32.5 → 32.5 (0%) | 2.62 → 3.03 (+15.6%) | 5.2 MB → 5.6 MB (+9%) | 0 | true |
| migrated/bar/100 | 38.3 → 50.9 (+32.9%) (void) | 1576.1 → 1573.7 (-0.2%) | 72 → 94.98 (+31.9%) **‼** | 29.7 → 31.2 (+5.1%) | 0.7 → 9.76 (+1294.5%) | 4.4 MB → 5.8 MB (+30.9%) | 0 | true |
| bklit/scatter/1000 | 129.8 → 119.4 (-8%) (void) | 1290.1 → 1266.3 (-1.8%) | 617.13 → 575.25 (-6.8%) | 32.6 → 32.6 (0%) | 1.61 → 1.56 (-3.2%) | 8.2 MB → 8.7 MB (+5.7%) | 0 | true |
| migrated/scatter/1000 | 77.5 → 124.9 (+61.2%) (void) | 1258.6 → 2504.7 (+99%) **‼** | 141.1 → 153.41 (+8.7%) | 28.8 → 35.7 (+24%) **‼** | 0.7 → 83.58 (+11840.4%) | 5.3 MB → 9.9 MB (+87.2%) | 0 | true |

Run dirs: `bench/results/2026-09-07T00-01-42-087Z`, `bench/results/2026-09-07T00-32-01-204Z`, `bench/results/2026-09-07T00-33-19-584Z`, `bench/results/2026-09-07T00-34-47-579Z`, `bench/results/2026-09-07T00-36-05-616Z`, `bench/results/2026-09-07T00-37-32-713Z`, `bench/results/2026-09-07T00-38-52-919Z`, `bench/results/2026-09-07T00-40-13-371Z`, `bench/results/2026-09-07T00-41-31-384Z`, `bench/results/2026-09-07T00-43-37-180Z`
