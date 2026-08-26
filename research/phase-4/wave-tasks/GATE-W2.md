# GATE-W2 — Wave 2 gate-runner (D246 impl/gate split)

Repo root: /Users/tomasdomingos/bklit-tanstack-charts-migration

## Your role
You are the **single gate-runner** for Wave 2. Five packages (P2.1, P2.2, P2.3, P2.4, P2.5/5b) have implemented and each verified `tsc --noEmit` exit 0 + a production build. **None of them ran a pixel gate** — that is deliberate (D246: packages implement, one runner sweeps, so QA runs never contend for the machine). Your job is to run the sweep and report, **not** to fix anything.

**Do not edit any file under `showcase/`.** If you find a failure, report it with evidence; the lead schedules the fix. The one exception is that you may of course *run* `qa/` and `bench/` scripts. Do not write to `qa/`, `bench/`, `/tmp`, or the clones (`repos/bklit-ui/`, `showcase/repos/tanstack-charts/`) — a guard hook denies these. Do not commit.

## What landed in Wave 2 (so you know what you are gating)
| pkg | change class | charts touched |
|---|---|---|
| P2.1 | deleted the loading sweep/skeleton surface, `resolveGridShimmer` + 3 `DEFAULT_SHIMMER_*` tokens, 2 heatmap loading constants, `paintHeatmapCellHover`, sweep CSS from both `styles.css` blocks, `bar-pulse-overlay.tsx` | line, area, bar, composed, funnel, scatter, heatmap |
| P2.2 | dead vars/branches; completed the K-1 `tooltipBoxSpring` supply-site deletions ×5; `LiveHoverFrameInput.width`; phantom `bandWidth` branch in `toDotConfig` | bar, candlestick, composed, live-line, + line/area via shared `use-hover-chrome` |
| P2.3 | deleted orphaned `.ts-bkm-pie-center` CSS + the duplicate `styles.css` loading block; corrected 6 stale comment sites. **FD16 `:has()` scoping was SKIPPED** (D253) — the legend selector is byte-identical to before | pie, ring, gauge, line, heatmap, + any chart with a legend |
| P2.4 | **not delete-only** — added a static transparent `pie-hitbox` twin mark to fix a hover oscillation | pie (already gated solo, see below) |
| P2.5 + P2.5b | deleted `paintHeatmapLegendSwatchHover`, the 5th per-chrome `tooltipBoxSpring` field, the now-orphan `SharedTooltipChromeOptions`, a dead `stroke` local in `buildMarkerMarks` | heatmap, line, area, markers |

Wave 2 was **delete-only apart from P2.4**, so the expectation is **no pixel movement anywhere**. A diff that moves is a finding, not a tolerance.

## Step 0 — confirm the tree is green before you gate
`cd showcase && npx tsc --noEmit` → must exit 0. If it does not, **stop and report immediately** — do not gate a red tree.

## Step 1 — QA pixel sweep (serial, never parallel)
Use `node qa/screenshot.mjs --charts <list> --n <N>` directly. **`pnpm qa -- --chart x` is broken** (it injects a literal `"--"` argv element the parser rejects) — do not use it.

Run these groups **one at a time, waiting for each to finish**. Batch mode shares ONE `--n`, which is why they are grouped by density:

| group | command | why this density |
|---|---|---|
| A | `node qa/screenshot.mjs --charts line,area,composed,funnel,scatter,candlestick,pie,ring,gauge --n 1000` | standard density (heatmap deliberately excluded — see group C) |
| B | `node qa/screenshot.mjs --charts bar,barsquares,bardepth --n 100` | **bar family NEVER `n≥1000`** — degenerate at that density |
| C | `node qa/screenshot.mjs --charts heatmap --n 52` | at `n=1000` the hover probe lands in empty space and the run fails for a **harness** reason unrelated to the code — a known symmetric artifact since 2026-08-19. **Must not be "fixed."** |
| D | `node qa/screenshot.mjs --charts liveline,markers --n 100` | these charts' mandated density |
| E | `node qa/screenshot.mjs --charts legend --n 4` | legend is a chart-less HTML scenario; 4 items is its scenario size |

Pass criterion per run is the harness's own: `overallPass === true`, i.e. every capture ≤ **0.5%** (`COMPARE_GATE`) **and** `tooltipFailures` empty. Read the numbers from `qa/results/<chart>/<timestamp>/report.json`, and **quote the run-id path** for every chart in your report — a claim without a run id is not evidence.

Charts in `TOOLTIPLESS_CHARTS` (radar, pie, ring, gauge, gaugelinear, sunburst, funnel, funnelvertical, legend) skip the tooltip assertion **identically on both sides** — that is expected, not a failure, and the pixel diffs remain the full gate for them.

### The batch-contention rule — this is binding
**A batch-mode FAIL is not a finding until a solo repro confirms it.** Batch runs have produced false failures before (candlestick and scatter both, later disproved). So: if any chart fails in a group run, immediately re-run **that chart alone** at the same `--n` and report **both** numbers. Only a solo-confirmed failure counts. Say explicitly which failures were batch-only and evaporated on solo repro.

### Already gated — do not re-litigate, but do re-run
- **pie** was gated solo by P2.4 at `--n 1000`: `qa/results/pie/2026-08-23T19-02-45-552Z`, `overallPass=true`, settled 0.0054 / hover-30 0.0000 / hover-50 0.0000 / hover-70 0.0007. It is in group A anyway because P2.3 touched pie's comments and the shared center-stat CSS block. If your group-A pie numbers differ materially from those, that is a finding.
- **sunburst** and **choropleth** were fixed and gated in Wave 1 (D250/D251) and **no Wave 2 package touched them** — they are deliberately absent from the groups above. Do not add them.

## Step 2 — `state=loading` sweep (REQUIRED — do not skip or default away from this)
P2.1 deleted code **in the loading surface**. A settled-only gate does not exercise a single line of what it removed. Load each of these with `state=loading` and confirm the loading UI still renders and then transitions cleanly to the settled chart:

- **line, area** (were the `LineLoadingSweep` / `LoadingLabel` consumers)
- **bar** (was the `BarLoadingSkeleton` consumer; also the `bar-pulse-overlay.tsx` deletion — the pulse must still animate, now from `internal/bar-pulse-mark.ts`)
- **heatmap** (loading internals deleted; the kept exports must still drive the enter-reveal)
- **liveline** (`state=loading` load specifically)

Use the same read-only headless-load pattern `qa/console-errors.mjs` uses. Report, per chart: did the loading state render, did it transition, and were there **zero console errors and warnings**. If the loading UI is now visibly broken or absent, that is the single most likely Wave 2 regression — say so loudly with a description of what you saw.

## Step 3 — console sweep
Run `node qa/console-errors.mjs` (its fixed list). Report the tally as `<pass>/<total>, N errors / M warnings`. Any chart in the Wave 2 touch list that is **not** in the script's fixed list, load ad-hoc read-only and report separately. Do not edit the script.

## Step 4 — bench compare (EXCLUSIVE SLOT — nothing else running)
Run **after** all QA is finished, with no other work in flight, serialized single-combo runs. Required cells: **line, bar** (P2.1) and **scatter, ring, liveline** (P2.2). Compare against the 4.4.1 baseline in `docs/phase-4/BENCHMARKS.md`. Report M1a mount→paint, M1b settle, M3a update, tooltip, plus skipped-count and console-error-count per cell (both must be 0).

Wave 2 deleted code; it should be neutral-to-faster. **A significant regression is a finding.** Note the known caveat that composed's M3a has no pre-existing baseline (~2.6× anchor flagged in D248) — composed is not in your bench list, so this should not arise, but do not silently invent a baseline for anything.

## Known non-findings — do NOT chase these
- **heatmap at `n=1000`**: symmetric harness artifact (see group C). Run it at 52.
- **sunburst tooltips**: `tooltipVisibleA/B` are false on all sunburst captures. Long-standing norm, out of scope.
- **`__qaSetBarPulsePhase` unwired**: the bardepth pulse-phase-freeze capture auto-skips on **both** sides, so dynamic pulse parity is unverified. Pre-existing (D238a). Report if you see it; do not try to fix it.
- **lockfile / module-type warnings** during build: pre-existing and unrelated.

## Report back
1. **Verdict first**: PASS or FAIL for Wave 2 overall, in one line, before any detail.
2. A table: `chart | n | settled | hover-30 | hover-50 | hover-70 | overallPass | run-id path`.
3. Every batch-mode failure and its solo repro result, explicitly paired.
4. The `state=loading` results per chart (step 2) — this section must not be empty.
5. Console tally; bench table vs baseline.
6. Anything you could not run, and why. **Report failures honestly and completely — an omitted failure is far worse than a reported one.** Do not fix anything; the lead schedules fixes.
