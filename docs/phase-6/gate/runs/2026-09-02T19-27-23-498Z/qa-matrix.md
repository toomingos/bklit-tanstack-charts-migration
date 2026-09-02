# QA pixel-gate matrix — smoke (legend,brush; bench subset)

Generated 2026-09-02T19:27:46.457Z. Gate = 4800 px of 960000 (0.5%). History = qa/results/<chart>/*/report.json (bklit vs migrated, before 2026-09-02T19:27:38.915Z); status per D402/D403: mode / seen / in-range (new value inside [min,max]) / out-of-range / no-history.

**2 runs, 9 cells (9 gated): gate FAIL 0, harness FAIL 0, out-of-range 0, new values 0, no-history 0, tooltip failures 0, errors 0, runs with non-zero exit 0.**
| chart | n | cell | px | pct | gate | harness | base px (5.3.5) | hist range | mode | status | tipA/B | diff png | run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| brush | 1000 | settled | 401 | 0.0418 | PASS | PASS | 1 | [1,401] n=24 | 1 | seen | -/- | qa/results/brush/2026-09-02T19-27-45-476Z/settled-diff.png | 6s |
| brush | 1000 | brush-left-half | 630 | 0.0656 | PASS | PASS | — | [233,630] n=24 | 233 | seen | true/true | qa/results/brush/2026-09-02T19-27-45-476Z/brush-left-half-diff.png | 6s |
| brush | 1000 | brush-right-half | 689 | 0.0718 | PASS | PASS | — | [498,689] n=24 | 498 | seen | true/true | qa/results/brush/2026-09-02T19-27-45-476Z/brush-right-half-diff.png | 6s |
| brush | 1000 | brush-hover-50 | 1231 | 0.1282 | PASS | PASS | — | [890,2644] n=24 | 890 | seen | true/true | qa/results/brush/2026-09-02T19-27-45-476Z/brush-hover-50-diff.png | 6s |
| brush | 1000 | brush-clear | 401 | 0.0418 | PASS | PASS | — | [1,401] n=24 | 1 | seen | true/true | qa/results/brush/2026-09-02T19-27-45-476Z/brush-clear-diff.png | 6s |
| legend | 1000 | settled | 0 | 0.0000 | PASS | PASS | 0 | [0,0] n=14 | 0 | mode | -/- | qa/results/legend/2026-09-02T19-27-41-658Z/settled-diff.png | 3s |
| legend | 1000 | hover-item-0 | 0 | 0.0000 | PASS | PASS | — | [0,0] n=14 | 0 | mode | true/true | qa/results/legend/2026-09-02T19-27-41-658Z/hover-item-0-diff.png | 3s |
| legend | 1000 | hover-item-1 | 0 | 0.0000 | PASS | PASS | — | [0,0] n=14 | 0 | mode | true/true | qa/results/legend/2026-09-02T19-27-41-658Z/hover-item-1-diff.png | 3s |
| legend | 1000 | hover-item-2 | 0 | 0.0000 | PASS | PASS | — | [0,0] n=14 | 0 | mode | true/true | qa/results/legend/2026-09-02T19-27-41-658Z/hover-item-2-diff.png | 3s |
