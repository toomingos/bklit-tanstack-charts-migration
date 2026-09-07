# QA pixel-gate matrix — d623-determinism pass 2

Generated 2026-09-07T22:37:12.514Z. Gate = 4800 px of 960000 (0.5%). History = qa/results/<chart>/*/report.json (bklit vs migrated, before 2026-09-07T22:37:03.183Z); status per D402/D403: mode / seen / in-range (new value inside [min,max]) / out-of-range / no-history.

**1 runs, 10 cells (10 gated): gate FAIL 0, harness FAIL 0, out-of-range 1, new values 3, no-history 0, tooltip failures 0, errors 0, runs with non-zero exit 0.**
| chart | n | cell | px | pct | gate | harness | base px (5.3.5) | hist range | mode | status | tipA/B | diff png | run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bardepth | 100 | settled | 0 | 0.0000 | PASS | PASS | — | [0,239441] n=45 | 29 | seen | -/- | qa/results/bardepth/2026-09-07T22-37-11-303Z/settled-diff.png | 9s |
| bardepth | 100 | hover-30 | 2047 | 0.2132 | PASS | PASS | — | [5,274813] n=45 | 5 | seen | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/hover-30-diff.png | 9s |
| bardepth | 100 | hover-50 | 2094 | 0.2181 | PASS | PASS | — | [5,275261] n=45 | 436 | seen | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/hover-50-diff.png | 9s |
| bardepth | 100 | hover-70 | 1960 | 0.2042 | PASS | PASS | — | [5,275012] n=45 | 719 | seen | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/hover-70-diff.png | 9s |
| bardepth | 100 | depth-off | 1441 | 0.1501 | PASS | PASS | — | [228,246134] n=45 | 273 | seen | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/depth-off-diff.png | 9s |
| bardepth | 100 | depth-on | 1518 | 0.1581 | PASS | PASS | — | [162,247587] n=45 | 1501 | in-range (new) | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/depth-on-diff.png | 9s |
| bardepth | 100 | pulse-phase-0 | 1590 | 0.1656 | PASS | PASS | — | [1590,1590] n=8 | 1590 | mode | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/pulse-phase-0-diff.png | 9s |
| bardepth | 100 | pulse-phase-0.25 | 1629 | 0.1697 | PASS | PASS | — | [1590,1622] n=8 | 1590 | out-of-range (new) | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/pulse-phase-0.25-diff.png | 9s |
| bardepth | 100 | pulse-phase-0.5 | 1910 | 0.1990 | PASS | PASS | — | [1865,1912] n=8 | 1897 | in-range (new) | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/pulse-phase-0.5-diff.png | 9s |
| bardepth | 100 | pulse-phase-0.75 | 1590 | 0.1656 | PASS | PASS | — | [1590,2175] n=8 | 1590 | mode | true/true | qa/results/bardepth/2026-09-07T22-37-11-303Z/pulse-phase-0.75-diff.png | 9s |
