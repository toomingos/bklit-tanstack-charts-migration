# Gate summary — gate-5 D638-D641 instrument

Run dir: `docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z`. Generated 2026-09-07T23:58:25.332Z.

## Headline

- QA: 43 runs / 194 cells; gate FAIL 0, ruled 2, harness FAIL 2, out-of-range 1, thin-history 0, new values 25, tooltip failures 0, errors 0; 4 workers, wall-clock 3m12s (gate 4800 px)
- Bench: 10 cells (0 skipped); 0 flagged (±20% D273), console-error cells 0, tooltip-missing 0, M1b-from-fallback cells 0, failed invocations 0, wall-clock 14m15s
- Bundle: 43 pinned, FAIL 0, MISSING 0, measure-failed 0, Σgzip 5669877 vs Σpin 5666571 (+0.06%)
- Checks: tsc=ok, lint=FAIL(1), bench-tsc=ok, build=ok, unit=ok, census=FAIL(1), bundle-gate=skipped
- Census: reach-in-guard exit 1, total 24, failures 1
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":3,"legend-hover-dim":1,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (7)

Classification only — the hypothesis column is intentionally empty for the fix owner.

polar: 1 · checks: 1 · census: 1 · hover-dim: 2 · tooltip: 1 · legend: 1

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:ring/4:polar` | polar | ring/4 | hover-50: 2476 px (out-of-range, mode 2995, hist [2506,15233]) | `qa/results/ring/2026-09-07T23-41-42-762Z/hover-50-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z/logs/qa/ring-4.log` |  |
| `checks:lint` | checks | — | npx oxlint --type-aware --deny-warnings --format=json migrated exit 1 {"problems":8,"errors":8,"warnings":0,"files":430,"topRules":[["eslint(capitalized-comments)",6],["comments(max-lines)",2]]} | `docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z/logs/checks/lint.log` |  |
| `census` | census | — | node scripts/reach-in-guard.mjs --json exit 1 {"total":24,"files":14,"failures":1} | `docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z/logs/checks/census.log` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | virtual-settle-tail>700ms | `docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z/probes.json` |  |
| `probe:hover-lag:candlestick/1000` | tooltip | candlestick/1000 | tooltip-presence-mismatch<br>dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z/probes.json` |  |
| `probe:hover-lag:choropleth/100` | hover-dim | choropleth/100 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: dimmed count differs >25% (bklit +7, migrated +5)<br>item-1: dimmed count differs >25% (bklit +311, migrated +109) | `docs/phase-7/gate/runs/2026-09-07T23-39-03-113Z/probes.json` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | hist n | mode | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ring | 4 | hover-50 | 2476 | [2506,15233] | 29 | 2995 | out-of-range |
