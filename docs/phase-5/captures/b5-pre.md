# B5 (T14 · T15 · T16 · T17 · T21b) — pre-batch capture of the risk-tier charts

B5 is the first batch since B1b that is expected to touch production code, and its blast
radius reaches **three** tier-tracked charts, not two: `candlestick` (**T0**) and `scatter`
(**T1**) via T14's dataset-flag census, plus `heatmap` (**T1**) via T21b's binning and
retimed reveal. GATE-MAP's T0/T1 policy requires a pre+post capture in every batch that
touches them, whether or not it owns the change.

## Carry-forward, and why it is legitimate

No capture run was taken for B5. `b1c-pre.md`'s values remain the pre-capture of record for
`candlestick` and `scatter`, and BASELINE §1 remains it for `heatmap`, because **no production
file has changed since B1b closed**. Five consecutive batches — B1c (D379), B1d (D380),
B2 (D381), B3 (D382-D385) and B4 (D386) — closed with zero code changed, and this is verified
independently rather than assumed: `find showcase/migrated -newermt "2026-08-27 00:00" -type f`
returns **0 files**. Re-running the matrix could only re-measure an unchanged tree, and on the
hover cells it would re-measure noise (D376 determinism classes: settled cells are
deterministic, hover cells are noise-dominated), which would corrupt rather than sharpen the
comparison.

## Pre-capture of record

| chart | tier | n | settled | hover-30 | hover-50 | hover-70 | source |
|---|---|---|---|---|---|---|---|
| `candlestick` | **T0** | 1000 | 0.3025 | **0.4801** | 0.3661 | 0.3618 | `b1c-pre.md` |
| `scatter` | **T1** | 1000 | 0.4510 | 0.0000 | 0.0779 | 0.2944 | `b1c-pre.md` |
| `heatmap` | **T1** | 52 | 0.4277 | 0.3466 | 0.3533 | 0.4256 | BASELINE §1 |

Headroom against the 0.5% gate: `candlestick` **0.0199** on its worst cell (h30 0.4801),
**[CORRECTED 2026-08-27, D394 — this figure is WRONG. h30 0.4801 is a non-reproducible excursion;
three runs on the unchanged tree all return 0.4953, matching `BASELINE.md` and `GATE-MAP.md:42`,
which has always recorded 0.0047. The true headroom is 0.0047 (~45 px). See `captures/b6-pre.md`.]**
`heatmap` **0.0723** (settled 0.4277), `scatter` **0.0490** (settled 0.4510). All three are
revert-first: any post-batch movement upward is reverted, not fixed forward.

## Charts in B5's radius with a zero-tolerance criterion of their own

| chart | n | all four probes | task | note |
|---|---|---|---|---|
| `gaugelinear` | 1000 | **0.0000** | T17 | The row's own acceptance is "must stay 0.0000% on all four probes — any movement = revert". This is the tightest criterion on the board, with, in the row's own words, **zero gate upside**. |
| `arealoading` | 1000 | 0.0238 / 0.0619 / 0.0252 / 0.0324 | T16 | Baseline reads FAIL → PASS: the original red was a harness gap (a tooltip assertion firing symmetrically on both sides), fixed by adding `arealoading`/`barloading` to `TOOLTIPLESS_CHARTS`. The **pixel gate itself always passed** and was never touched. |
| `sunburst` | 1000, 33 | both densities | T15 | Acceptance is "replay visually identical; both densities unchanged" — the second density (n=33) is a distinct run on the 45-run board and must be captured too. |

## Comparison rule

The post-batch comparison is made against **this table**, not against BASELINE §1, for
`candlestick` and `scatter`. Their moving cells all sit *below* baseline here (candlestick
h30 −0.0152, scatter h30 −0.0762, h70 −0.0020); comparing post-B5 against BASELINE would
credit B5 with improvements it did not cause and would mask a real regression of up to
0.0762 on `scatter` h30. `heatmap` has no intervening capture, so BASELINE §1 is both its
baseline and its pre-capture.
