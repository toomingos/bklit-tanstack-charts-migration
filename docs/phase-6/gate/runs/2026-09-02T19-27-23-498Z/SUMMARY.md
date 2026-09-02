# Gate summary — smoke-2026-09-02T19:27Z

Run dir: `docs/phase-6/gate/runs/2026-09-02T19-27-23-498Z`. Generated 2026-09-02T19:31:08.597Z.

## Headline

- QA: 2 runs / 9 cells; gate FAIL 0, harness FAIL 0, out-of-range 0, new values 0, tooltip failures 0, errors 0; 2 workers, wall-clock 6.5s (gate 4800 px)
- Bench: 2 cells (0 skipped); 0 flagged (±20% D273), console-error cells 1, tooltip-missing 1, failed invocations 0, wall-clock 2m42s
- Bundle: 43 pinned, FAIL 0, MISSING 0, measure-failed 0, Σgzip 5358759 vs Σpin 5296797 (+1.17%)
- Checks: tsc=FAIL(2), build=ok, lint=ok, census=ok, bundle-gate=ok
- Census: reach-in-guard exit 0, total 79, failures 0
- Probes: not run

## Issues (3)

Classification only — the hypothesis column is intentionally empty for the fix owner.

bench: 2 · checks: 1

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `bench:migrated/line/1000:consoleErrorCount` | bench | migrated/line/1000 | consoleErrorCount: 7 vs baseline 0 | `docs/phase-6/gate/runs/2026-09-02T19-27-23-498Z/bench.json`<br>`bench/results/2026-09-02T19-29-09-329Z`<br>`bench/results/2026-09-02T19-30-29-251Z` |  |
| `bench:migrated/line/1000:m3c_tooltipAppeared` | bench | migrated/line/1000 | m3c_tooltipAppeared: false vs baseline true | `docs/phase-6/gate/runs/2026-09-02T19-27-23-498Z/bench.json`<br>`bench/results/2026-09-02T19-29-09-329Z`<br>`bench/results/2026-09-02T19-30-29-251Z` |  |
| `checks:tsc` | checks | — | npx tsc --noEmit exit 2 {"errors":1} | `docs/phase-6/gate/runs/2026-09-02T19-27-23-498Z/logs/checks/tsc.log` |  |

## QA cells that changed status vs history (not failing)

none
