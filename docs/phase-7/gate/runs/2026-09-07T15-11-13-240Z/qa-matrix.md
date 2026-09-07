# QA pixel-gate matrix — waitfor-fix-check

Generated 2026-09-07T15:12:58.064Z. Gate = 4800 px of 960000 (0.5%). History = qa/results/<chart>/*/report.json (bklit vs migrated, before 2026-09-07T15:11:13.241Z); status per D402/D403: mode / seen / in-range (new value inside [min,max]) / out-of-range / no-history.

**3 runs, 16 cells (15 gated): gate FAIL 0, harness FAIL 0, out-of-range 0, new values 1, no-history 0, tooltip failures 0, errors 0, runs with non-zero exit 0.**
| chart | n | cell | px | pct | gate | harness | base px (5.3.5) | hist range | mode | status | tipA/B | diff png | run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pie | 1000 | settled | 399 | 0.0416 | PASS | PASS | — | [0,816] n=46 | 406 | in-range (new) | -/- | qa/results/pie/2026-09-07T15-12-41-288Z/settled-diff.png | 88s |
| pie | 1000 | hover-30 | 98 | 0.0102 | PASS | PASS | — | [0,33240] n=46 | 0 | seen | false/false | qa/results/pie/2026-09-07T15-12-41-288Z/hover-30-diff.png | 88s |
| pie | 1000 | hover-50 | 0 | 0.0000 | PASS | PASS | — | [0,33246] n=46 | 0 | mode | false/false | qa/results/pie/2026-09-07T15-12-41-288Z/hover-50-diff.png | 88s |
| pie | 1000 | hover-70 | 155 | 0.0161 | PASS | PASS | — | [0,33246] n=46 | 7 | seen | false/false | qa/results/pie/2026-09-07T15-12-41-288Z/hover-70-diff.png | 88s |
| markers | 100 | settled | 1218 | 0.1269 | PASS | PASS | — | [786,7024] n=42 | 1090 | seen | -/- | qa/results/markers/2026-09-07T15-12-54-413Z/settled-diff.png | 13s |
| markers | 100 | hover-30 | 4184 | 0.4358 | PASS | PASS | — | [3574,15483] n=42 | 3717 | seen | true/true | qa/results/markers/2026-09-07T15-12-54-413Z/hover-30-diff.png | 13s |
| markers | 100 | hover-50 | 3036 | 0.3162 | PASS | PASS | — | [840,15244] n=42 | 1750 | seen | true/true | qa/results/markers/2026-09-07T15-12-54-413Z/hover-50-diff.png | 13s |
| markers | 100 | hover-70 | 4209 | 0.4384 | PASS | PASS | — | [3328,15251] n=42 | 3633 | seen | true/true | qa/results/markers/2026-09-07T15-12-54-413Z/hover-70-diff.png | 13s |
| markers | 100 | legend-hover-0 | 3926 | 0.4090 | PASS | PASS | — | [3751,18168] n=42 | 3926 | mode | true/true | qa/results/markers/2026-09-07T15-12-54-413Z/legend-hover-0-diff.png | 13s |
| markers | 100 | legend-hover-1 | 4057 | 0.4226 | PASS | PASS | — | [3729,17740] n=42 | 3757 | seen | true/true | qa/results/markers/2026-09-07T15-12-54-413Z/legend-hover-1-diff.png | 13s |
| markers | 100 | legend-hover-clear | 4057 | 0.4226 | PASS | PASS | — | [3731,16612] n=42 | 3755 | seen | true/true | qa/results/markers/2026-09-07T15-12-54-413Z/legend-hover-clear-diff.png | 13s |
| markers | 100 | marker-fan-open | 1471 | 0.1532 | INFO | PASS | — | [1344,5565] n=42 | 1344 | seen | true/true | qa/results/markers/2026-09-07T15-12-54-413Z/marker-fan-open-diff.png | 13s |
| legend | 1000 | settled | 0 | 0.0000 | PASS | PASS | — | [0,0] n=22 | 0 | mode | -/- | qa/results/legend/2026-09-07T15-12-57-035Z/settled-diff.png | 2s |
| legend | 1000 | hover-item-0 | 0 | 0.0000 | PASS | PASS | — | [0,0] n=22 | 0 | mode | true/true | qa/results/legend/2026-09-07T15-12-57-035Z/hover-item-0-diff.png | 2s |
| legend | 1000 | hover-item-1 | 0 | 0.0000 | PASS | PASS | — | [0,0] n=22 | 0 | mode | true/true | qa/results/legend/2026-09-07T15-12-57-035Z/hover-item-1-diff.png | 2s |
| legend | 1000 | hover-item-2 | 0 | 0.0000 | PASS | PASS | — | [0,0] n=22 | 0 | mode | true/true | qa/results/legend/2026-09-07T15-12-57-035Z/hover-item-2-diff.png | 2s |
