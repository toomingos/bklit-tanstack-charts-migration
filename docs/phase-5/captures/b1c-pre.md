# B1c (T5) — pre-batch capture of the risk-tier charts

Taken with the tree clean at B1b-complete (D378), before any T5 edit. Mandated by
GATE-MAP's T0/T1 policy: "pre+post capture in **every** batch that touches it, whether or
not it owns the change".

| chart | tier | n | settled | hover-30 | hover-50 | hover-70 | overall |
|---|---|---|---|---|---|---|---|
| `candlestick` | **T0** | 1000 | 0.3025 | **0.4801** | 0.3661 | 0.3618 | PASS |
| `scatter` | **T1** | 1000 | 0.4510 | 0.0000 | 0.0779 | 0.2944 | PASS |

BASELINE §1 for comparison: `candlestick` 0.3025 / 0.4953 / 0.3661 / 0.3618 ·
`scatter` 0.4510 / 0.0762 / 0.0779 / 0.2964.

Both charts' **settled** cells are bit-exact against baseline. The moving cells are all
hover cells and all move *downward* here (candlestick h30 −0.0152, scatter h30 −0.0762,
h70 −0.0020) — the post-batch comparison must be made against THIS capture, not against
BASELINE §1, or B1c will be credited with improvements it did not cause.
