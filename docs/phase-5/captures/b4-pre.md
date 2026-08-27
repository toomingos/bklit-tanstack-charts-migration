# B4 (T13) — pre-batch capture: CARRIED FORWARD from `b1c-pre.md`

B4's risk-tier charts are **`candlestick` (T0)** and **`scatter` (T1)** — exactly the two
charts banked in `b1c-pre.md`, which was taken with the tree clean at B1b-complete (D378).

**No re-capture is needed, because no production code has changed since that capture was
taken.** Every batch in between closed as a no-op skip with zero code edited:

| batch | outcome | entry |
|---|---|---|
| B1c | SKIPPED (no-op) | D379 |
| B1d | SKIPPED (no-op) | D380 |
| B2 | SKIPPED as scoped (no-op) | D381 |
| B3 | SKIPPED as scoped (no-op) | D382–D385 |

Independently verified: `find showcase/migrated -newermt "2026-08-27 00:00" -type f` returns
**0 files**, and the four skip entries above each record "no code changed" on their own
evidence.

**Values of record for the B4 post-batch comparison** (from `b1c-pre.md`, NOT from
`BASELINE.md` §1 — comparing against BASELINE would credit B4 with the hover-cell
improvements B1c's capture already showed):

| chart | tier | n | settled | hover-30 | hover-50 | hover-70 |
|---|---|---|---|---|---|---|
| `candlestick` | **T0** | 1000 | 0.3025 | 0.4801 | 0.3661 | 0.3618 |
| `scatter` | **T1** | 1000 | 0.4510 | 0.0000 | 0.0779 | 0.2944 |

`candlestick` is **revert-first, never fix-forward** (GATE-MAP T0 policy, 0.0047 headroom).

Full B4 gate set (GATE-MAP / BATCH-ORDER `:233`): `line` `area` `bar` `scatter` `composed`
`candlestick` `liveline` `choropleth` + hover screenshot pairs.
