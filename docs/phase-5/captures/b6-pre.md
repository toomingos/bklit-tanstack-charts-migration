# B6 (T18 · T19) — pre-batch capture of the risk-tier charts

Taken after B5 closed (D391, `gauge.tsx` the only production file changed), before any B6 edit.
Mandated by GATE-MAP's T0/T1 policy: "pre+post capture in **every** batch that touches it,
whether or not it owns the change". B6 touches `candlestick` (**T0**, two `@visx/pattern` call
sites at `candlestick-chart.tsx:1036/1041`) and `heatmap` (**T1**, `heatmap-components.tsx:253`
+ `heatmap-legend.tsx:50`).

| chart | tier | n | settled | hover-30 | hover-50 | hover-70 | overall |
|---|---|---|---|---|---|---|---|
| `candlestick` | **T0** | 1000 | 0.3025 | **0.4953** | 0.3661 | 0.3618 | PASS |
| `heatmap` | **T1** | 52 | **0.4277** | 0.3466 | 0.3533 | 0.4256 | PASS |

Both charts are **bit-identical to BASELINE §1** on all eight cells (`candlestick`
0.3025 / 0.4953 / 0.3661 / 0.3618 · `heatmap` 0.4277 / 0.3466 / 0.3533 / 0.4256). B5 changed
only `gauge.tsx` and neither chart moved — as expected.

## Headroom correction — candlestick T0 is 4x tighter than the board records

**Correction to this file's own first draft.** It stated that "the tier table has carried 0.0199
since B1c". That is wrong, and the error was mine, not the board's: **`GATE-MAP.md:42` has always
recorded `candlestick` (0.0047)**, and `BASELINE.md` has always had h30 at 0.4953. The 0.0199
figure was introduced by **`captures/b5-pre.md:29` and `D387` — both written in this session** —
by computing headroom from `b1c-pre.md`'s h30 reading of **0.4801**, which is a non-reproducible
excursion. The canonical sources were right throughout and are corroborated across D362, D370,
D371, D373, D377, D378 and D384.

**The operative headroom is 0.0047** — roughly **45 pixels of 960000** — as GATE-MAP always said.
The measurement below still stands and was worth taking; only the attribution was wrong.

## Which cells are actually noisy — measured, not assumed

A first draft of this file asserted that h30 sits inside its own noise floor and that single
readings there prove nothing. **That was wrong**, and the opposite is true. Three consecutive
`candlestick` runs on the unchanged B5-complete tree:

| cell | run 1 | run 2 | run 3 | verdict |
|---|---|---|---|---|
| settled | 0.3025 | 0.3025 | 0.3025 | **deterministic** |
| hover-30 | 0.4953 | 0.4953 | 0.4953 | **deterministic** |
| hover-50 | 0.3661 | 0.3661 | 0.3661 | **deterministic** |
| hover-70 | 0.3618 | **0.3890** | 0.3618 | **noisy — band >= 0.0272 (~261 px)** |

This refines **D376** rather than contradicting it. D376's split is settled-vs-hover; the measured
reality on this chart is narrower — **three of four cells are bit-stable and only h70 moves**.
The b1c-pre 0.4801 h30 reading is not reproducible on today's tree and must not be used as a
reference point for B6.

**Operative headroom for B6, against this capture:**

| cell | value | headroom to 0.5 | trustworthy? |
|---|---|---|---|
| `candlestick` hover-30 | 0.4953 | **0.0047 (~45 px)** | yes — deterministic |
| `candlestick` settled | 0.3025 | 0.1975 | yes — deterministic |
| `candlestick` hover-50 | 0.3661 | 0.1339 | yes — deterministic |
| `candlestick` hover-70 | 0.3618–0.3890 | 0.1110 from worst observed | no — re-run before believing |
| `heatmap` settled | 0.4277 | 0.0723 | yes — bit-stable on all 4 cells |

**Consequence for T18.** The two `candlestick-chart.tsx` pattern call sites are the highest-risk
edit on the B6 board. Because h30 is deterministic, a single post-batch reading there *is* valid
evidence — but the cell tolerates only ~45 differing pixels, so any pattern geometry change that
alters even a handful of pixels in the hover region fails outright. The T0 policy is
**revert-first, never fix-forward**. Preferred outcome: scope the pattern port so the candlestick
call sites are not touched at all. If they must be touched, h30 and settled are the signals; an
h70 excursion alone is not evidence of regression and must be re-run before it is acted on.
