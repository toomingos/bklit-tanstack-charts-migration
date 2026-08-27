# B1d (T1) — pre-batch capture of the risk-tier charts

B1c changed no code (**D379**, skipped), so `b1c-pre.md`'s `candlestick` and `scatter` rows
remain valid as B1d's pre-baseline; only `heatmap` is added here. Mandated by GATE-MAP's
T0/T1 policy.

| chart | tier | n | settled | hover-30 | hover-50 | hover-70 | overall | vs BASELINE §1 |
|---|---|---|---|---|---|---|---|---|
| `candlestick` | **T0** | 1000 | 0.3025 | 0.4801 | 0.3661 | 0.3618 | PASS | h30 −0.0152, rest exact (carried from `b1c-pre.md`) |
| `scatter` | **T1** | 1000 | 0.4510 | 0.0000 | 0.0779 | 0.2944 | PASS | h30 −0.0762, h70 −0.0020, rest exact (carried) |
| `heatmap` | **T1** | 52 | 0.4277 | 0.3466 | 0.3533 | 0.4256 | PASS | **bit-exact on all four cells** |

B1d is the widest batch so far — it deletes a 225-LOC sizing module and touches all 14
`<Chart>` hosts, so its gate is the **full 45-run**. Compare post-batch against THIS table for
the three risk-tier charts and against BASELINE §1 for the rest, applying D376's split
ceiling (settled 0.01pp / hover ≤ the measured self-test floor) and D378's `candlestick`
first-FAIL protocol.
