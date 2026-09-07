# Gate summary — gate-4

Run dir: `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z`. Generated 2026-09-07T21:41:28.708Z.

## Headline

- QA: 43 runs / 190 cells; gate FAIL 0, ruled 2, harness FAIL 2, out-of-range 3, new values 25, tooltip failures 0, errors 1; 4 workers, wall-clock 3m31s (gate 4800 px)
- Bench: 10 cells (0 skipped); 0 flagged (±20% D273), console-error cells 0, tooltip-missing 0, failed invocations 0, wall-clock 14m16s
- Bundle: 43 pinned, FAIL 0, MISSING 0, measure-failed 0, Σgzip 5667022 vs Σpin 6597552 (-14.1%)
- Checks: tsc=ok, lint=ok, bench-tsc=ok, build=ok, unit=ok, census=ok, bundle-gate=skipped
- Census: reach-in-guard exit 0, total 23, failures 0
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":3,"legend-hover-dim":1,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (9)

Classification only — the hypothesis column is intentionally empty for the fix owner.

hover-dim: 4 · harness-race: 2 · polar: 1 · renderer-regime: 1 · legend: 1

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:bardepth/100:hover-dim` | hover-dim | bardepth/100 | pulse-phase-0.5: 1896 px (out-of-range, mode 1865, hist [1865,1887]) | `qa/results/bardepth/2026-09-07T21-22-43-507Z/pulse-phase-0.5-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/logs/qa/bardepth-100.log` |  |
| `qa:candlestick/1000:harness-race` | harness-race | candlestick/1000 | (no report):   name: 'TimeoutError' | `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/logs/qa/candlestick-1000.log` |  |
| `qa:ring/4:polar` | polar | ring/4 | hover-30: 2904 px (out-of-range, mode 3007, hist [2909,15233]) | `qa/results/ring/2026-09-07T21-24-30-529Z/hover-30-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/logs/qa/ring-4.log` |  |
| `qa:scatter/1000:renderer-regime` | renderer-regime | scatter/1000 | hover-70: 1878 px (out-of-range, mode 2847, hist [1889,143608]) | `qa/results/scatter/2026-09-07T21-24-34-446Z/hover-70-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/logs/qa/scatter-1000.log` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/probes.json` |  |
| `probe:hover-lag:sankey/33` | hover-dim | sankey/33 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/probes.json` |  |
| `probe:hover-lag:choropleth/100` | hover-dim | choropleth/100 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: dim presence mismatch (bklit +-10, migrated +5)<br>item-0: bklit does not fully undim (20 -> 3)<br>item-1: dimmed count differs >25% (bklit +311, migrated +109) | `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/probes.json` |  |
| `stage:qa-failed` | harness-race | — | stage qa failed in 3m32s: [gate:all] qa stage has 1 ERROR cell(s) — see qa-matrix.json | `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z/run-all.json` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| bardepth | 100 | pulse-phase-0.5 | 1896 | [1865,1887] | 1865 |
| ring | 4 | hover-30 | 2904 | [2909,15233] | 3007 |
| scatter | 1000 | hover-70 | 1878 | [1889,143608] | 2847 |
