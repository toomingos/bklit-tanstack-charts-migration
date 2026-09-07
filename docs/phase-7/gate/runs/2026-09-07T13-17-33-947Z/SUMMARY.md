# Gate summary — gate 3 (post-D606, workers=2)

Run dir: `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z`. Generated 2026-09-07T14:09:14.119Z.

## Headline

- QA: 43 runs / 194 cells; gate FAIL 0, harness FAIL 4, out-of-range 1, new values 36, tooltip failures 0, errors 12; 2 workers, wall-clock 5m33s (gate 4800 px)
- Bench: 29 cells (0 skipped); 1 flagged (±20% D273), console-error cells 0, tooltip-missing 0, failed invocations 0, wall-clock 44m21s
- Bundle: 43 pinned, FAIL 0, MISSING 0, measure-failed 0, Σgzip 6601081 vs Σpin 6597552 (+0.05%)
- Checks: tsc=ok, lint=ok, bench-tsc=ok, build=ok, unit=ok, census=ok, bundle-gate=skipped
- Census: reach-in-guard exit 0, total 23, failures 0
- Probes: hover-lag, legend-hover-dim, bardepth-toggle, no-rereveal — flags {"hover-lag":4,"legend-hover-dim":4,"bardepth-toggle":0,"no-rereveal":0}, errors 0

## Issues (13)

Classification only — the hypothesis column is intentionally empty for the fix owner.

hover-dim: 5 · harness-race: 3 · bench: 1 · legend: 4

| id | category | chart(s) | cell(s) / metric | evidence | hypothesis |
| --- | --- | --- | --- | --- | --- |
| `qa:bardepth/100:hover-dim` | hover-dim | bardepth/100 | pulse-phase-0.5: 1865 px (out-of-range, mode 1887, hist [1887,1887]) | `qa/results/bardepth/2026-09-07T13-21-40-598Z/pulse-phase-0.5-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/logs/qa/bardepth-100.log` |  |
| `qa:radar/6:harness-race` | harness-race | radar/6 | settled: harness exit 1<br>hover-30: harness exit 1<br>hover-50: harness exit 1<br>hover-70: harness exit 1 | `qa/results/radar/2026-09-07T13-22-07-397Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/logs/qa/radar-6.log`<br>`qa/results/radar/2026-09-07T13-22-07-397Z/hover-30-diff.png`<br>`qa/results/radar/2026-09-07T13-22-07-397Z/hover-50-diff.png`<br>`qa/results/radar/2026-09-07T13-22-07-397Z/hover-70-diff.png` |  |
| `qa:sankey/33:harness-race` | harness-race | sankey/33 | settled: harness exit 1<br>hover-30: harness exit 1<br>hover-50: harness exit 1<br>hover-70: harness exit 1 | `qa/results/sankey/2026-09-07T13-22-37-605Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/logs/qa/sankey-33.log`<br>`qa/results/sankey/2026-09-07T13-22-37-605Z/hover-30-diff.png`<br>`qa/results/sankey/2026-09-07T13-22-37-605Z/hover-50-diff.png`<br>`qa/results/sankey/2026-09-07T13-22-37-605Z/hover-70-diff.png` |  |
| `qa:barloading/100:harness-race` | harness-race | barloading/100 | settled: harness exit 1<br>hover-30: harness exit 1<br>hover-50: harness exit 1<br>hover-70: harness exit 1 | `qa/results/barloading/2026-09-07T13-23-24-907Z/settled-diff.png`<br>`docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/logs/qa/barloading-100.log`<br>`qa/results/barloading/2026-09-07T13-23-24-907Z/hover-30-diff.png`<br>`qa/results/barloading/2026-09-07T13-23-24-907Z/hover-50-diff.png`<br>`qa/results/barloading/2026-09-07T13-23-24-907Z/hover-70-diff.png` |  |
| `bench:tanstack/scatter/100:m1b_settleMs` | bench | tanstack/scatter/100 | m1b_settleMs: 53.2 vs baseline 40.5 (+31.4%) | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/bench.json`<br>`bench/results/2026-09-07T14-01-35-567Z`<br>`bench/results/2026-09-07T14-03-03-231Z` |  |
| `probe:hover-lag:bar/100` | hover-dim | bar/100 | settles-after-700ms-capture | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |
| `probe:hover-lag:pie/1000` | hover-dim | pie/1000 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |
| `probe:hover-lag:sankey/33` | hover-dim | sankey/33 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |
| `probe:hover-lag:liveline/100` | hover-dim | liveline/100 | dim-presence-mismatch | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |
| `probe:legend-hover-dim:legendhover/1000` | legend | legendhover/1000 | item-0: dim presence mismatch (bklit +2, migrated +0)<br>item-1: dim presence mismatch (bklit +1000, migrated +0)<br>item-1: migrated does not fully undim (1000 -> 0) | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |
| `probe:legend-hover-dim:candlelegend/1000` | legend | candlelegend/1000 | item-0: dim presence mismatch (bklit +511, migrated +0)<br>item-0: migrated does not fully undim (1533 -> 0)<br>item-1: dim presence mismatch (bklit +489, migrated +0)<br>item-1: migrated does not fully undim (1465 -> 0) | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |
| `probe:legend-hover-dim:markers/100` | legend | markers/100 | item-0: bklit does not fully undim (6 -> 4)<br>item-1: dim presence mismatch (bklit +1, migrated +0)<br>item-1: bklit does not fully undim (4 -> 3)<br>item-1: migrated does not fully undim (1 -> 0) | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |
| `probe:legend-hover-dim:barsquares/100` | legend | barsquares/100 | item-0: migrated does not fully undim (0 -> 200)<br>item-1: migrated does not fully undim (0 -> 200) | `docs/phase-7/gate/runs/2026-09-07T13-17-33-947Z/probes.json` |  |

## QA cells that changed status vs history (not failing)

| chart | n | cell | px | hist range | mode |
| --- | --- | --- | --- | --- | --- |
| bardepth | 100 | pulse-phase-0.5 | 1865 | [1887,1887] | 1887 |
