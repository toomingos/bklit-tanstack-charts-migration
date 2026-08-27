# Phase 5 — Canonical QA Gate Map

> Authored by the lead for §5.3.3 ("gate after EVERY batch"). **This supersedes the
> gate section of `research/phase-5/02-visx-removal.md`,** which is stale: it lists
> heatmap / pie / choropleth as failing baselines and instructs that post-change diffs
> be taken against those failures. D358 resolved all three before phase-4 close.
> All Phase 5 diffs are taken against **`docs/phase-5/BASELINE.md` §1**.

## Rules of record

- Gate: **≤0.5%** differing pixels per capture (`settled`, `hover-30/50/70`), tooltips
  must assert visible where applicable. Self-test floor **0.1%**.
- **Density is not free choice.** Each chart has one mandated density (below). A run at
  another density is not a gate result and may not be reported as one.
- Only **three** known-non-parity baselines exist. Nothing else is allowed to be red:
  | baseline | why it is not a gate | gate of record instead |
  |---|---|---|
  | `candletween` n=1000 | pixel-invalid by design (D330 §2) | `qa/k4-tween-probe.mjs` |
  | `ring` n=1000 | invalid instrument (D335) | `ring` n=4 (PASSES) |
  | `barloading` n=100 | not a parity gate by design (D341) | none — measured, not chased |

## Chart → mandated density (45 runs)

n=1000 (30): `line` `area` `composed` `scatter` `candlestick` `candletween` `refarea`
`segment` `profitloss` `legend` `candlelegend` `legendhover` `patternarea` `brush`
`projection` `projectionxdomain` `pie` `gauge` `gaugelinear` `funnel` `funnelvertical`
`ring` `griddefault` `arealoading` `linemultiaxis` `areamultiaxis` `scattermultiaxis`
`composedmultiaxis` `refareamultiaxis`

n=100 (9): `bar` `barmultiaxis` `barsquares` `bardepth` `barloading` `composedstacked`
`markers` `liveline` `choropleth`

Other (6): `heatmap` n=52 · `sankey` n=33 · `sunburst` n=27 **and** n=33 · `sunchrome` n=27
· `radar` n=6 · `ring` n=4

## Risk tiers — headroom to the 0.5% gate at baseline

Computed by the lead from `BASELINE.md` §1 (worst of the four probes per chart).

| tier | charts | headroom | policy |
|---|---|---|---|
| **T0 critical** | `candlestick` (0.0047) | <1% of gate | pre+post capture in **every** batch that touches it, whether or not it owns the change; **revert-first**, never fix-forward |
| **T1 tight** | `scatter` (0.0490), `heatmap` (0.0723) | ~10–15% of gate | pre+post capture in every batch that touches it; revert-first |
| **T2 watch** | `markers` (0.1128), `sankey` (0.1165), `refareamultiaxis` (0.1233), `candlelegend` (0.1789), `ring` n=4 (0.1889) | | capture post-batch; investigate any movement >0.05% |
| **T3** | everything else | >0.2% | standard post-batch capture |

**Planning consequence carried into 5.2.2:** the three tightest-headroom charts are each
the primary target of one of the three riskiest deviations — `candlestick`→D7 (tooltip,
"highest parity risk"), `scatter`→D10/D11, `heatmap`→D2 (full wrapper re-scope). Batch
sequencing must not stack two of those onto the same chart in one gate.

## Sweep driver

Full 45-run sweep is scripted; per-size splitting is required because bench/QA scripts
exceed the 600s Bash timeout on a single invocation. One line per run:
`chart|n|settled|h30|h50|h70|overall`. Reconcile **45/45** rows against BASELINE.md §1 —
a sweep that reports fewer rows than the board is an incomplete gate, not a pass.
