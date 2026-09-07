# QA pixel-gate matrix — d623-rework-check

Generated 2026-09-07T22:35:53.488Z. Gate = 4800 px of 960000 (0.5%). History = qa/results/<chart>/*/report.json (bklit vs migrated, before 2026-09-07T22:35:37.482Z); status per D402/D403: mode / seen / in-range (new value inside [min,max]) / out-of-range / no-history.

**1 runs, 10 cells (10 gated): gate FAIL 0, harness FAIL 0, out-of-range 2, new values 3, no-history 0, tooltip failures 0, errors 0, runs with non-zero exit 0.**
| chart | n | cell | px | pct | gate | harness | base px (5.3.5) | hist range | mode | status | tipA/B | diff png | run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bardepth | 100 | settled | 0 | 0.0000 | PASS | PASS | — | [0,239441] n=43 | 29 | seen | -/- | qa/results/bardepth/2026-09-07T22-35-50-829Z/settled-diff.png | 10s |
| bardepth | 100 | hover-30 | 2047 | 0.2132 | PASS | PASS | — | [5,274813] n=43 | 5 | seen | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/hover-30-diff.png | 10s |
| bardepth | 100 | hover-50 | 2094 | 0.2181 | PASS | PASS | — | [5,275261] n=43 | 436 | seen | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/hover-50-diff.png | 10s |
| bardepth | 100 | hover-70 | 1960 | 0.2042 | PASS | PASS | — | [5,275012] n=43 | 719 | seen | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/hover-70-diff.png | 10s |
| bardepth | 100 | depth-off | 1432 | 0.1492 | PASS | PASS | — | [228,246134] n=43 | 273 | seen | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/depth-off-diff.png | 10s |
| bardepth | 100 | depth-on | 1496 | 0.1558 | PASS | PASS | — | [162,247587] n=43 | 1501 | in-range (new) | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/depth-on-diff.png | 10s |
| bardepth | 100 | pulse-phase-0 | 1590 | 0.1656 | PASS | PASS | — | [1590,1590] n=6 | 1590 | mode | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/pulse-phase-0-diff.png | 10s |
| bardepth | 100 | pulse-phase-0.25 | 1622 | 0.1690 | PASS | PASS | — | [1590,1610] n=6 | 1590 | out-of-range (new) | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/pulse-phase-0.25-diff.png | 10s |
| bardepth | 100 | pulse-phase-0.5 | 1912 | 0.1992 | PASS | PASS | — | [1865,1897] n=6 | 1897 | out-of-range (new) | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/pulse-phase-0.5-diff.png | 10s |
| bardepth | 100 | pulse-phase-0.75 | 1590 | 0.1656 | PASS | PASS | — | [1590,2175] n=6 | 1590 | mode | true/true | qa/results/bardepth/2026-09-07T22-35-50-829Z/pulse-phase-0.75-diff.png | 10s |
