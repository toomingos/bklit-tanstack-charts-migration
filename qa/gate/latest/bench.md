# Bench gate

Generated 2026-09-05T12:10:11.760Z. Cells: bklit/line/1000, migrated/line/1000, bklit/area/1000, migrated/area/1000, bklit/composed/1000, migrated/composed/1000, bklit/bar/100, migrated/bar/100, bklit/scatter/1000, migrated/scatter/1000. Baseline: qa/gate/bench-baseline.json (Bench gate baseline. --all cells (bklit/tanstack x line/area/bar/scatter x 100/1000/10000) = the Phase-5 close latest.json run of 2026-08-27 (the run docs/phase-6/BENCHMARKS.md §2.1 compares against). migrated/* and bklit control rows not in --all (bklit/composed/1000) = docs/phase-5/BASELINE.md §3b medians. Flag rule: D273 ±20% on M1b/M1c/M3a; M1a is a VOID channel on this machine (BASELINE §3b verdict) and is reported informationally. Regenerate by hand only when a new baseline is formally adopted (D-entry). consoleErrorCount baselines: legacy bklit/bar/1000 and /10000 emit negative-<rect>-attribute errors (rx/ry/width) in the Phase-5 close run itself (514742 / 1540000) — inherited legacy behaviour, gated on increase only (D500). m3c_tooltipAppeared baseline: legacy bklit/line/1000 is false in every recorded run since 2026-08-23 (Phase-5 close included) — inherited; flagged only where the baseline is true (D500).).
Flag rule D273: |Δ| > 20% on M1b/M1c/M3a. M1a is a VOID channel on this machine (BASELINE §3b) — informational only.

**10 cells measured (0 skipped), 2 flagged metric(s), 0 cell(s) with console errors, wall-clock 14m09s.**
| cell | M1a | M1b | M1c | M3a | M3c/move | heap | console err | tooltip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bklit/line/1000 | 59.3 → 58.1 (-2%) (void) | 1160.1 → 1158.2 (-0.2%) | 85.91 → 90.34 (+5.2%) | 31.1 → 32.05 (+3.1%) | 1.54 → 1.5 (-2.9%) | 5.2 MB → 5.6 MB (+9.1%) | 0 | false |
| migrated/line/1000 | 51.8 → 54.3 (+4.8%) (void) | 1115.5 → 1119.4 (+0.3%) | 76.7 → 95.61 (+24.7%) **‼** | 32.5 → 32.5 (0%) | 0.6 → 21.81 (+3535.6%) | 5.2 MB → 6.3 MB (+20.4%) | 0 | true |
| bklit/area/1000 | 60.1 → 65.8 (+9.5%) (void) | 1158.7 → 1160.9 (+0.2%) | 79.77 → 90.35 (+13.3%) | 30.5 → 30.4 (-0.3%) | 3.18 → 3.4 (+7.1%) | 5.0 MB → 5.5 MB (+9.3%) | 0 | true |
| migrated/area/1000 | 47.3 → 49.3 (+4.2%) (void) | 1151.2 → 1156.9 (+0.5%) | 88 → 104.76 (+19%) | 32.2 → 32.6 (+1.2%) | 0.6 → 21.66 (+3510.2%) | 5.8 MB → 7.0 MB (+20.9%) | 0 | true |
| bklit/composed/1000 | 78.4 → 77 (-1.8%) (void) | 1310.9 → 1289.9 (-1.6%) | 541.8 → 489 (-9.7%) | 21.5 → 20.3 (-5.6%) | 13.5 → 12.86 (-4.7%) | 12.2 MB → 12.7 MB (+4.4%) | 0 | true |
| migrated/composed/1000 | 83.3 → 92 (+10.4%) (void) | 1664.8 → 1669 (+0.3%) | 123.8 → 127.06 (+2.6%) | 32.2 → 32.5 (+0.9%) | 0.9 → 68.89 (+7554.4%) | 6.8 MB → 8.4 MB (+23%) | 0 | true |
| bklit/bar/100 | 65.9 → 64.2 (-2.6%) (void) | 1592.9 → 1591.9 (-0.1%) | 190.47 → 218.38 (+14.7%) | 32.5 → 32.6 (+0.3%) | 2.62 → 2.38 (-9.3%) | 5.2 MB → 5.6 MB (+9.1%) | 0 | true |
| migrated/bar/100 | 38.3 → 40 (+4.4%) (void) | 1576.1 → 1579.1 (+0.2%) | 72 → 86.11 (+19.6%) | 29.7 → 31.3 (+5.4%) | 0.7 → 9.17 (+1209.6%) | 4.4 MB → 5.6 MB (+27%) | 0 | true |
| bklit/scatter/1000 | 129.8 → 121.6 (-6.3%) (void) | 1290.1 → 1267.8 (-1.7%) | 617.13 → 568.25 (-7.9%) | 32.6 → 32.6 (0%) | 1.61 → 1.58 (-2.2%) | 8.2 MB → 8.7 MB (+5.7%) | 0 | true |
| migrated/scatter/1000 | 77.5 → 105.5 (+36.1%) (void) | 1258.6 → 1242.9 (-1.2%) | 141.1 → 126.76 (-10.2%) | 28.8 → 22.9 (-20.5%) **‼** | 0.7 → 81.83 (+11590.4%) | 5.3 MB → 7.6 MB (+42.7%) | 0 | true |

Run dirs: `bench/results/2026-09-05T11-57-21-194Z`, `bench/results/2026-09-05T11-58-40-323Z`, `bench/results/2026-09-05T11-59-58-773Z`, `bench/results/2026-09-05T12-01-18-000Z`, `bench/results/2026-09-05T12-02-35-659Z`, `bench/results/2026-09-05T12-04-27-341Z`, `bench/results/2026-09-05T12-05-47-545Z`, `bench/results/2026-09-05T12-07-07-710Z`, `bench/results/2026-09-05T12-08-25-810Z`, `bench/results/2026-09-05T12-10-11-453Z`
