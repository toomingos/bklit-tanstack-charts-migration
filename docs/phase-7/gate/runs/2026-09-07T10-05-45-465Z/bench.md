# Bench gate

Generated 2026-09-07T10:55:17.433Z. Cells: --all, migrated/line/1000, migrated/area/1000, migrated/composed/1000, migrated/bar/100, migrated/scatter/1000. Baseline: qa/gate/bench-baseline.json (Bench gate baseline. Adopted 2026-09-07 from the 7.6 gate run docs/phase-7/gate/runs/2026-09-07T09-01-26-415Z (D595) -- the first run through the instrument D594 fixed, which is why it supersedes the phase-5 close medians of 2026-08-27 that stood here before. Flag rule: D273 +/-20% on M1b/M1c/M3a; M1a is a VOID channel on this machine (BASELINE §3b verdict) and is reported informationally. TWO CELLS ARE NOT FROM THIS RUN. bklit/composed/1000 was not in the run's cell set and keeps its docs/phase-5/BASELINE.md §3b medians. migrated/scatter/1000.m1b_settleMs is HELD at the phase-5 1258.6 although this run measured 2505.3: that is 1.98x the same-run bklit control (1266.3), p95 2506 over 7 samples, reproduced at +99.0% and +99.1% across two independent runs, so it is a live regression and not baseline drift. Adopting it would pin the defect as the expectation and silence the only flag pointing at it. The hold expires when the scatter double reveal is fixed. Note when reading M1c deltas: every control cell (bklit and tanstack alike) rose 11-19% between the phase-5 run and this one, a uniform machine/browser shift, so migrated's larger rises are roughly 25-35% net of it, not the raw figure. consoleErrorCount baselines: legacy bklit/bar/1000 and /10000 emit negative-<rect>-attribute errors (rx/ry/width) in the Phase-5 close run itself (514742 / 1540000) -- inherited legacy behaviour, gated on increase only (D500). m3c_tooltipAppeared baseline: legacy bklit/line/1000 is false in every recorded run. Regenerate by hand only when a new baseline is formally adopted (D-entry).).
Flag rule D273: |Δ| > 20% on M1b/M1c/M3a. M1a is a VOID channel on this machine (BASELINE §3b) — informational only.

**29 cells measured (0 skipped), 4 flagged metric(s), 2 cell(s) with console errors, wall-clock 44m38s.**
| cell | M1a | M1b | M1c | M3a | M3c/move | heap | console err | tooltip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bklit/line/100 | 56.6 → 64.2 (+13.4%) (void) | 1144.2 → 1156.4 (+1.1%) | 78.25 → 80.06 (+2.3%) | 31.4 → 31.9 (+1.6%) | 2.02 → 1.66 (-17.8%) | 5.1 MB → 5.1 MB (0%) | 0 | true |
| bklit/line/1000 | 61.5 → 61.5 (0%) (void) | 1157.7 → 1161.8 (+0.4%) | 87.81 → 87.9 (+0.1%) | 32.2 → 32 (-0.6%) | 1.59 → 1.41 (-11.3%) | 5.6 MB → 5.6 MB (0%) | 0 | false |
| bklit/line/10000 | 64.9 → 71.1 (+9.6%) (void) | 1169.6 → 1176.5 (+0.6%) | 101.3 → 102.04 (+0.7%) | 32.1 → 32 (-0.3%) | 1.3 → 1.33 (+2.2%) | 7.3 MB → 7.3 MB (0%) | 0 | true |
| tanstack/line/100 | 26.5 → 25.4 (-4.2%) (void) | 39.7 → 40 (+0.8%) | 66.18 → 65.82 (-0.5%) | 32.3 → 32.5 (+0.6%) | 1.01 → 0.71 (-29.7%) | 4.6 MB → 4.6 MB (0%) | 0 | true |
| tanstack/line/1000 | 49.6 → 49.6 (0%) (void) | 77.5 → 70.8 (-8.6%) | 88.51 → 88.12 (-0.4%) | 32.6 → 32.6 (0%) | 2.12 → 1.35 (-36.5%) | 5.6 MB → 5.6 MB (0%) | 0 | true |
| tanstack/line/10000 | 267.2 → 268 (+0.3%) (void) | 412.9 → 406.7 (-1.5%) | 297.77 → 302.85 (+1.7%) | 75.7 → 76.15 (+0.6%) | 5.81 → 5.84 (+0.4%) | 14.7 MB → 14.7 MB (0%) | 0 | true |
| bklit/area/100 | 54.5 → 54.9 (+0.7%) (void) | 1138.2 → 1136.4 (-0.2%) | 77.23 → 75.39 (-2.4%) | 32.1 → 32.1 (0%) | 1.99 → 1.72 (-13.4%) | 5.1 MB → 5.1 MB (0%) | 0 | true |
| bklit/area/1000 | 62.8 → 54 (-14%) (void) | 1160 → 1153.1 (-0.6%) | 88.45 → 87.38 (-1.2%) | 30.4 → 30.1 (-1%) | 3.52 → 3.36 (-4.6%) | 5.5 MB → 5.5 MB (0%) | 0 | true |
| bklit/area/10000 | 65 → 62.4 (-4%) (void) | 1167.5 → 1166.7 (-0.1%) | 102.54 → 104.38 (+1.8%) | 29.9 → 29.6 (-1%) | 3.59 → 3.7 (+3.1%) | 7.2 MB → 7.2 MB (0%) | 0 | true |
| tanstack/area/100 | 28.2 → 26.8 (-5%) (void) | 41.7 → 38.8 (-7%) | 68.95 → 67.08 (-2.7%) | 32.2 → 32.35 (+0.5%) | 0.79 → 0.68 (-13.5%) | 4.7 MB → 4.7 MB (0%) | 0 | true |
| tanstack/area/1000 | 59.1 → 56.4 (-4.6%) (void) | 76.3 → 86.3 (+13.1%) | 97.55 → 96.96 (-0.6%) | 32.5 → 32.6 (+0.3%) | 1.99 → 1.72 (-13.7%) | 6.0 MB → 6.0 MB (0%) | 0 | true |
| tanstack/area/10000 | 322.8 → 321.4 (-0.4%) (void) | 463.2 → 461.8 (-0.3%) | 355.9 → 355.31 (-0.2%) | 128.65 → 129.45 (+0.6%) | 6.5 → 6.23 (-4.2%) | 18.0 MB → 18.0 MB (-0.1%) | 0 | true |
| bklit/bar/100 | 61.7 → 64.5 (+4.5%) (void) | 1593.6 → 1592.4 (-0.1%) | 214.29 → 190.54 (-11.1%) | 32.5 → 32.55 (+0.2%) | 2.8 → 2.17 (-22.3%) | 5.6 MB → 5.6 MB (0%) | 0 | true |
| bklit/bar/1000 | 264.2 → 274.5 (+3.9%) (void) | 2011.5 → 2022 (+0.5%) | 1682.78 → 1690.88 (+0.5%) | 32.7 → 32.6 (-0.3%) | 6.66 → 5.54 (-16.8%) | 7.3 MB → 7.3 MB (-0.3%) | 503196 | true |
| bklit/bar/10000 | 2203.2 → 2229.1 (+1.2%) (void) | 7089.9 → 7215 (+1.8%) | 6652.48 → 6760.74 (+1.6%) | 156.35 → 159.05 (+1.7%) | 27.52 → 27.96 (+1.6%) | 22.0 MB → 22.0 MB (0%) | 1540000 | true |
| tanstack/bar/100 | 34.4 → 34.7 (+0.9%) (void) | 52.2 → 38.5 (-26.2%) **‼** | 75.43 → 69.58 (-7.7%) | 32.6 → 32.6 (0%) | 1.37 → 1.12 (-18%) | 4.9 MB → 4.9 MB (-0.1%) | 0 | true |
| tanstack/bar/1000 | 126.8 → 126.1 (-0.6%) (void) | 188.9 → 192.6 (+2%) | 170.59 → 170.15 (-0.3%) | 47.3 → 48.4 (+2.3%) | 4.02 → 3.42 (-14.9%) | 7.4 MB → 7.4 MB (0%) | 0 | true |
| tanstack/bar/10000 | 1068.2 → 1066.8 (-0.1%) (void) | 1645.7 → 1666.6 (+1.3%) | 1120.14 → 1149.78 (+2.6%) | 494.05 → 513.2 (+3.9%) | 15.87 → 16.06 (+1.2%) | 33.1 MB → 33.1 MB (0%) | 0 | true |
| bklit/scatter/100 | 49 → 48.8 (-0.4%) (void) | 1147.5 → 1153.9 (+0.6%) | 148.61 → 153.25 (+3.1%) | 32.5 → 32.5 (0%) | 1.87 → 1.77 (-5.3%) | 5.7 MB → 5.8 MB (+0.4%) | 0 | true |
| bklit/scatter/1000 | 120.3 → 126.7 (+5.3%) (void) | 1266.3 → 1273.3 (+0.6%) | 564.05 → 577.13 (+2.3%) | 32.6 → 32.6 (0%) | 1.57 → 1.6 (+2.1%) | 8.7 MB → 8.7 MB (0%) | 0 | true |
| bklit/scatter/10000 | 894.4 → 875.4 (-2.1%) (void) | 3253.7 → 3127.5 (-3.9%) | 2547.06 → 2429.68 (-4.6%) | 69.25 → 68.7 (-0.8%) | 4.71 → 4.46 (-5.4%) | 37.6 MB → 37.5 MB (-0.4%) | 0 | true |
| tanstack/scatter/100 | 30.2 → 30.9 (+2.3%) (void) | 40.5 → 42.6 (+5.2%) | 68.87 → 69.64 (+1.1%) | 32.5 → 32.5 (0%) | 1.3 → 1.11 (-14.4%) | 4.7 MB → 4.7 MB (0%) | 0 | true |
| tanstack/scatter/1000 | 94.7 → 95.5 (+0.8%) (void) | 98.2 → 153.8 (+56.6%) **‼** | 101.27 → 125.76 (+24.2%) **‼** | 35 → 35.4 (+1.1%) | 3.26 → 2.84 (-12.9%) | 6.3 MB → 6.3 MB (0%) | 0 | true |
| tanstack/scatter/10000 | 740 → 755.6 (+2.1%) (void) | 1147.4 → 1177.7 (+2.6%) | 679.41 → 691 (+1.7%) | 206.65 → 206.35 (-0.1%) | 11.29 → 11.59 (+2.6%) | 21.7 MB → 21.7 MB (0%) | 0 | true |
| migrated/line/1000 | 52.8 → 54.6 (+3.4%) (void) | 1163.7 → 1166.2 (+0.2%) | 112.54 → 115.76 (+2.9%) | 32.6 → 32.6 (0%) | 23.33 → 23.38 (+0.2%) | 8.6 MB → 8.6 MB (0%) | 0 | true |
| migrated/area/1000 | 60.9 → 61.8 (+1.5%) (void) | 1173.6 → 1173.8 (0%) | 125.08 → 124.86 (-0.2%) | 32.6 → 32.6 (0%) | 25.03 → 25 (-0.1%) | 10.4 MB → 10.4 MB (0%) | 0 | true |
| migrated/composed/1000 | 112.9 → 111.3 (-1.4%) (void) | 1195.5 → 1192.9 (-0.2%) | 156.42 → 154.79 (-1%) | 32.6 → 32.6 (0%) | 31.33 → 31.34 (0%) | 11.4 MB → 11.4 MB (0%) | 0 | true |
| migrated/bar/100 | 53.2 → 51.4 (-3.4%) (void) | 1575.5 → 1574.2 (-0.1%) | 98.57 → 96.03 (-2.6%) | 31.2 → 31.2 (0%) | 9.78 → 9.66 (-1.2%) | 5.8 MB → 5.8 MB (0%) | 0 | true |
| migrated/scatter/1000 | 127 → 126.8 (-0.2%) (void) | 1258.6 → 2504.7 (+99%) **‼** | 157.57 → 155.38 (-1.4%) | 36.1 → 36 (-0.3%) | 87.57 → 84.35 (-3.7%) | 9.9 MB → 9.9 MB (0%) | 0 | true |

Run dirs: `bench/results/2026-09-07T10-47-26-662Z`, `bench/results/2026-09-07T10-48-54-393Z`, `bench/results/2026-09-07T10-50-22-269Z`, `bench/results/2026-09-07T10-51-49-464Z`, `bench/results/2026-09-07T10-53-09-767Z`, `bench/results/2026-09-07T10-55-17-124Z`
