# Phase 5.0.3 — Pre-Upgrade Baseline

> **Source: PORTED from Phase 4 records.** No benchmarks or QA were re-run to produce this document — every number below is copied from `docs/phase-4/BENCHMARKS.md`, `docs/phase-4/LOG.md` (principally **D358**, the 4.4.5 final-pass close), `docs/phase-4/PROGRESS.md`, and the raw run directories under `qa/results/**`. Where a number could not be located on disk it is marked `not-recorded` — none are invented.

- **Captured (ported):** 2026-08-26 (this document), reflecting phase-4's close-out state recorded the same day.
- **Git commit at capture:** `f49b5a2d5e88a4fa6474dc96892a1c0d8a436988` (`git rev-parse HEAD`) — *"Phase 4 complete: TanStack-native refactor, 59 packages, 45-chart parity board"*, committed 2026-08-26T21:14:10+01:00.
- **TanStack pin in effect:** `a285ce7` / v0.14.0, per **D238** ("re-cloned fresh 2026-08-21 10:27 straight to origin/main tip `a285ce7` (v0.14.0)"; carried unchanged through phase 4 — no later re-pin found in `docs/phase-4/LOG.md`).
  - **Disk discrepancy — RESOLVED by the lead (2026-08-26).** The baseline agent inspected the wrong clone. There were **two** TanStack clones on disk: `repos/tanstack-charts` at the repo root (`4b940ed`, 2026-07-30 — an older, unused snapshot that `bench/app/vite.config.ts` explicitly warns must NOT be resolved) and `showcase/repos/tanstack-charts`, the one both the bench app and the showcase actually resolved, verified at `a285ce7` (2026-08-15) before Phase 5.0.1 archived it. D238's pin is therefore accurate as written; the agent's `4b940ed` reading is the root clone and is not the baseline runtime. The showcase clone now lives at `local_cache/tanstack-charts-a285ce7-v0.14.0/` for diffing.

---

## 1. QA parity — final phase-4 board (45 runs, D358 / 4.4.5 final pass)

This is the **last-recorded** parity state at phase-4 close, ported verbatim from `docs/phase-4/BENCHMARKS.md` § "P6.4 parity board — 45 runs, mandated densities". It covers all 43 registered chart kinds at their mandated density, plus `ring` and `sunburst` at a second density each = 45 runs. Densities follow the standing mandate (which supersedes the original 4.4.1 baseline's choices for several charts — see source note).

| chart | n | settled | hover-30 | hover-50 | hover-70 | overall | known-failing / known-non-parity |
|---|---|---|---|---|---|---|---|
| `line` | 1000 | 0.0000 | 0.0000 | 0.0540 | 0.1478 | PASS | no |
| `area` | 1000 | 0.0003 | 0.0001 | 0.0001 | 0.1593 | PASS | no |
| `composed` | 1000 | 0.0845 | 0.0000 | 0.0000 | 0.1394 | PASS | no |
| `scatter` | 1000 | 0.4510 | 0.0762 | 0.0779 | 0.2964 | PASS | no |
| `candlestick` | 1000 | 0.3025 | 0.4953 | 0.3661 | 0.3618 | PASS | no |
| `candletween` | 1000 | 1.3619 | 3.0002 | 0.3661 | 0.3890 | **FAIL** | **yes — pixel-invalid by design (D330 §2); gate of record is `qa/k4-tween-probe.mjs`, not pixels** |
| `refarea` | 1000 | 0.0021 | 0.0000 | 0.0523 | 0.1451 | PASS | no |
| `segment` | 1000 | 0.0000 | 0.0000 | 0.0532 | 0.1435 | PASS | no |
| `profitloss` | 1000 | 0.0189 | 0.0152 | 0.0516 | 0.1375 | PASS | no |
| `legend` | 1000 | 0.0000 | — | — | — | PASS | no |
| `candlelegend` | 1000 | 0.3211 | — | — | — | PASS | no |
| `legendhover` | 1000 | 0.0593 | — | — | — | PASS | no |
| `patternarea` | 1000 | 0.0002 | 0.0002 | 0.0541 | 0.1388 | PASS | no |
| `brush` | 1000 | 0.0001 | — | — | — | PASS | no |
| `projection` | 1000 | 0.0166 | 0.1435 | 0.0881 | 0.0540 | PASS | no |
| `projectionxdomain` | 1000 | 0.0724 | 0.0360 | 0.0360 | 0.0907 | PASS | no |
| `pie` | 1000 | 0.0138 | 0.0000 | 0.0000 | 0.0007 | PASS | no — **historically failing, resolved this pass; see §2** |
| `gauge` | 1000 | 0.0064 | 0.0064 | 0.0064 | 0.0064 | PASS | no |
| `gaugelinear` | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | PASS | no |
| `funnel` | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | PASS | no |
| `funnelvertical` | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | PASS | no |
| `ring` | 1000 | 0.0100 | 0.7161 | 0.2292 | 0.7351 | **FAIL** | **yes — invalid instrument (D335); `ring` n=4 is the gate of record and PASSES (next row)** |
| `ring` | 4 | 0.0000 | 0.3111 | 0.3105 | 0.0142 | PASS | no (gate of record for ring) |
| `griddefault` | 1000 | 0.0000 | 0.0000 | 0.0536 | 0.1422 | PASS | no |
| `arealoading` | 1000 | 0.0238 | 0.0619 | 0.0252 | 0.0324 | FAIL → **PASS** after harness fix | no — was a harness gap (tooltip assertion firing symmetrically on both sides), fixed same session by adding `arealoading`/`barloading` to `TOOLTIPLESS_CHARTS` in `qa/screenshot.mjs`; pixel gate itself untouched and always passed |
| `linemultiaxis` | 1000 | 0.0000 | 0.0000 | 0.1249 | 0.1794 | PASS | no |
| `areamultiaxis` | 1000 | 0.0007 | 0.0003 | 0.0842 | 0.1869 | PASS | no |
| `scattermultiaxis` | 1000 | 0.2898 | 0.0001 | 0.0000 | 0.2736 | PASS | no |
| `composedmultiaxis` | 1000 | 0.0890 | 0.0478 | 0.0485 | 0.2209 | PASS | no |
| `refareamultiaxis` | 1000 | 0.1978 | 0.1827 | 0.2800 | 0.3767 | PASS | no |
| `bar` | 100 | 0.0000 | 0.0000 | 0.0757 | 0.0000 | PASS | no |
| `barmultiaxis` | 100 | 0.0000 | 0.0000 | 0.0745 | 0.0722 | PASS | no |
| `barsquares` | 100 | 0.0049 | 0.1364 | 0.1504 | 0.1486 | PASS | no — **historically failing (v0.14 tooltip regression), resolved; see §2** |
| `bardepth` | 100 | 0.0030 | 0.0005 | 0.0454 | 0.0748 | PASS | no — **historically failing (v0.14 regression, later reclassified as n=1000 density artifact), resolved; see §2** |
| `barloading` | 100 | 2.0031 | 16.5953 | 16.7929 | 16.8837 | **FAIL** | **yes — not a parity gate by explicit prior design (scenario's own header + D341); measured divergence, not chased** |
| `composedstacked` | 100 | 0.0408 | 0.1152 | 0.1230 | 0.1172 | PASS | no |
| `markers` | 100 | 0.1100 | 0.3872 | 0.1823 | 0.3784 | PASS | no |
| `liveline` | 100 | 0.0167 | 0.0506 | 0.0827 | 0.1023 | PASS | no |
| `choropleth` | 100 | 0.0000 | 0.0000 | 0.1470 | 0.0000 | PASS | no — **historically failing, resolved this pass; see §2** |
| `heatmap` | 52 | 0.4277 | 0.3466 | 0.3533 | 0.4256 | PASS | no — **historically failing (marginal hover), resolved this pass; see §2** |
| `sankey` | 33 | 0.1101 | 0.3835 | 0.2782 | 0.1323 | PASS | no — **historically failing (v0.14 settled regression + hover-state gap), resolved earlier in phase 4; see §2** |
| `sunburst` | 27 | 0.0599 | 0.0780 | 0.1400 | 0.1466 | PASS | no |
| `sunburst` | 33 | 0.0599 | 0.0744 | 0.1046 | 0.0872 | PASS | no |
| `sunchrome` | 27 | 0.0677 | 0.0931 | 0.1548 | 0.1676 | PASS | no |
| `radar` | 6 | 0.0141 | 0.0128 | 0.0888 | 0.0141 | PASS | no |

**Board summary (D358):** 45 runs (43 chart kinds + `ring` n=4 second density + `sunburst` n=33 second density). **41 PASS / 4 FAIL as captured; 42 PASS / 3 known-non-parity after the `arealoading` harness fix.** Gate is ≤0.5% differing pixels per capture (settled + hover-30/50/70), tooltips must assert visible where applicable.

### The 3 known-non-parity baselines at phase-4 close

| baseline | failure signature | status / ruling |
|---|---|---|
| `barloading` n=100 | settled 2.0031%, hovers 16.59–16.88% | **Not a parity gate by design.** `bench/app/src/scenarios/bklit-barloading.tsx`'s own header states this pair is not expected to reach parity — it exists to measure how far the two skeleton mechanisms land apart, not to assert equality. Ruled at **D341**; re-measured at D358 with settled improved 4.5259%→1.8975%/2.0031% and self-test 0.0000% (clean instrument) showing the two skeleton animations diverge **over time**, not merely in geometry. |
| `ring` n=1000 | settled 0.0100%, hover-30 0.7161%, hover-70 0.7351% | **Invalid instrument — D335.** DOM readback shows bklit holds 962/975 transformed groups at `scale(0)` (only ~13 segments tapering) vs migrated's 40 groups all at exactly `scale(1)` — the diff is *which arcs are visible in a stagger that never completes*, not a hover-scale mismatch. `ring` n=4 is the **gate of record** and **PASSES** (0.0000/0.3111/0.3105/0.0142). |
| `candletween` n=1000 | settled 1.3619% (1.4408% on solo re-run — non-deterministic) | **Pixel-invalid by design — D330 §2.** This fixture deliberately captures mid-reveal (3000ms framer tween vs an 1100ms settle timer); framer-rAF and WAAPI don't share a start instant, so a mid-flight pixel diff measures scheduler skew, not a real defect. Self-test **fails** at 0.1883% (against a 0.1% floor), confirming the pixel gate is non-deterministic here. **Gate of record is `qa/k4-tween-probe.mjs`** (DOM readback of migrated's WAAPI keyframes: 1800ms duration, `cubic-bezier(0.85,0,0.15,1)`, 64 sampled frames, delays 0→21.6ms — exactly K4's declared contract) against bklit's `animCount: 0` (framer drives rAF, invisible to the probe by construction). |

---

## 2. Historical failures explicitly asked about (heatmap, pie, choropleth, barsquares, bardepth, sankey)

These are the baselines commonly assumed to be failing from earlier phase-4 checkpoints (notably the **D238** v0.14 pin-bump sweep and the **4.4.1 baseline**, both 2026-08-21/22). **As of the phase-4 close (D358, 2026-08-26), all six are resolved and PASS** — none remain known-failing. Recorded here in full so the "known-failing" claim isn't silently dropped from the record, only its status is:

- **`pie`** — hover-30/70 ≈3.18% (unowned since 2026-08-21, longest-standing debt of the phase). Resolved via **P2.4/D254** and re-confirmed clean at final close: **0.0138 / 0.0000 / 0.0000 / 0.0007, PASS**.
- **`choropleth`** — hover-30 1.5345% (migrated tooltip absent while bklit's fired; same signature since 2026-08-03). Resolved via fix dispatch **F2 (D250)**, confirmed at final close: **0.0000% with both tooltips asserting**, n=100.
- **`heatmap`** — ready-state hover 0.5196/0.5218/0.5945% (marginal, over the 0.5% gate). Resolved via fix dispatch **F3 (D250)**, confirmed at final close: **0.3466/0.3533/0.4256%**, n=52.
- **`sankey`** — settled FAIL 2.4818% at the D238 v0.14 pin bump (root cause: pre-existing commit `97aaf78` label-baseline shift, not the bump itself — corrected attribution at **D239**); separately, hover-state FAILs at n≥33 (2.84/1.94/1.43%). Settled fixed at **D239**; hover cluster (SK1/SK2/SK6/SK7/SK8/SK10) fixed at **P1.2/D239 close**. Confirmed at final close: **0.3835/0.2782/0.1323%** at n=33.
- **`barsquares`** — D238's Q1 sweep found migrated tooltip absent at hover-30/50/70 (`tooltipVisibleB=false`), flagged as a "new v0.14 regression." **Reclassified at D238a**: the sweep had run barsquares at n=1000 for the first time ever, which is a known-degenerate density (AGENTS.md: "bklit BarChart is degenerate at n≥1000... gates for bar run at n=100 only"); at n=1000 `squareSize` goes negative and both impls render zero squares while bklit's tooltip still fires. Re-run at the mandated n=100: **all PASS** (settled 0.0046%, hovers 0.1450/0.1466/0.1623%). Confirmed again at final close: **0.0049/0.1364/0.1504/0.1486%, PASS**.
- **`bardepth`** — D238 also flagged settled FAIL 1.4929% + hover ~4.9% with a "focus off-by-one" (bklit tooltip one datum ahead of migrated). **Reclassified at D238a** as the same n=1000 degenerate-density artifact — re-run at n=100 all PASS (settled 0.0030%, hovers 0.0005%, no off-by-one). Confirmed again at final close: **0.0030/0.0005/0.0454/0.0748%, PASS**.

**Net effect:** none of pie / choropleth / heatmap / sankey / barsquares / bardepth are known-failing baselines going into Phase 5. The only three known-non-parity baselines carried into Phase 5 are `barloading`, `ring` n=1000 (invalid instrument; `ring` n=4 is the real gate), and `candletween` (pixel-invalid by design; DOM probe is the real gate) — see the table in §1.

---

## 3. Bench — ported from `docs/phase-4/BENCHMARKS.md`, NOT re-run

Two verbatim snapshots are ported below: the **4.4.1 pre-change baseline** (bklit vs. raw tanstack, before any phase-4 migrated-code change) and the **P6.4 final-pass bench** (bklit vs. `migrated`, 2026-08-26, the numbers phase-4 actually closed on). Both are copied byte-for-byte from the source tables; nothing here was re-measured.

### 3a. 4.4.1 baseline (pre-change, 2026-08-22) — `bklit` vs. raw `tanstack`

> ported verbatim from `docs/phase-4/BENCHMARKS.md` § "4.4.1 Baseline (pre-change)"; run id `bench/results/2026-08-22T15-46-19-823Z`, 24/24 cells, 0 skipped.

```
| chart | n | bklit M1a/M1b/M3a | tanstack M1a/M1b/M3a |
|---|---|---|---|
| line | 100 | 64.7 / 1156.5 / 31.9 | 24.1 / 33.6 / 32.2 |
| line | 1000 | 53.7 / 1154.3 / 32.1 | 47.0 / 66.3 / 32.5 |
| line | 10000 | 65.2 / 1170.7 / 31.9 | 259.8 / 412.5 / 73.8 |
| area | 100 | 66.2 / 1148.5 / 32.0 | 25.1 / 32.8 / 32.1 |
| area | 1000 | 61.9 / 1160.9 / 30.4 | 52.8 / 83.1 / 32.5 |
| area | 10000 | 62.9 / 1166.9 / 29.7 | 305.6 / 461.8 / 124.5 |
| bar | 100 | 71.4 / 1599.3 / 32.4 | 33.6 / 52.7 / 32.6 |
| bar | 1000 | 261.9 / 1997.1 / 32.6 | 126.1 / 193.6 / 47.4 |
| bar | 10000 | 2195.1 / 7120.9 / 156.5 | 1052.0 / 1607.6 / 496.3 |
| scatter | 100 | 56.8 / 1155.5 / 32.4 | 28.8 / 42.7 / 32.4 |
| scatter | 1000 | 119.1 / 1264.4 / 32.6 | 91.6 / 138.7 / 34.3 |
| scatter | 10000 | 879.0 / 3140.5 / 70.8 | 728.6 / 1139.8 / 222.1 |
```

Notes (ported): bklit M1b ~1.1s reveal floor preserved (intentional, per M1b parity precedent); tanstack M1b sub-second (no reveal by design). Both impls degrade together on bar n=10000 (known degenerate class). `tooltipAppeared=true` on all tanstack cells; sole anomaly `bklit/line n=1000` `tooltipAppeared=false` (bklit-side hover observation, pre-existing).

### 3b. P6.4 final-pass bench (2026-08-26) — `bklit` control vs. `migrated`, 10 exclusive paired cells

> ported verbatim from `docs/phase-4/BENCHMARKS.md` § "P6.4 bench — 10 exclusive paired cells, 2026-08-26". Run under D273 conditions: exclusive/quiet process table asserted empty before launch, 8 runs per cell (1 warmup + 7 measured), medians shown.

```
| chart | n | impl | M1a mount->paint | M1b settle | M1c script | M3a update | M3c per-move script | heap |
|---|---|---|---|---|---|---|---|---|
| line | 1000 | bklit (control) | 65.2 | 1163.7 | 80.4 | 31.7 | 1.3 | 5.0 MB |
| line | 1000 | migrated | 51.8 | 1115.5 | 76.7 | 32.5 | 0.6 | 5.2 MB |
| area | 1000 | bklit (control) | 63.0 | 1162.0 | 86.2 | 30.0 | 2.8 | 4.9 MB |
| area | 1000 | migrated | 47.3 | 1151.2 | 88.0 | 32.2 | 0.6 | 5.8 MB |
| composed | 1000 | bklit (control) | 78.4 | 1310.9 | 541.8 | 21.5 | 13.5 | 12.2 MB |
| composed | 1000 | migrated | 83.3 | 1664.8 | 123.8 | 32.2 | 0.9 | 6.8 MB |
| bar | 100 | bklit (control) | 68.3 | 1592.6 | 192.4 | 32.4 | 1.7 | 5.1 MB |
| bar | 100 | migrated | 38.3 | 1576.1 | 72.0 | 29.7 | 0.7 | 4.4 MB |
| scatter | 1000 | bklit (control) | 138.9 | 1300.2 | 593.4 | 32.2 | 1.5 | 8.1 MB |
| scatter | 1000 | migrated | 77.5 | 1258.6 | 141.1 | 28.8 | 0.7 | 5.3 MB |
```

**Control-channel validity (D273), ported verbatim:**

```
| channel | control drift | verdict |
|---|---|---|
| M1a | scatter 128.2 -> 138.9 = +8.3% (vs D289's exclusive run); area 56.1 -> 63.0 = +12.3% and line 59.9 -> 65.2 = +8.8% (vs P6.1); bar -4.3%, composed -2.9% | VOID — over the +/-8% threshold on three of five charts. No M1a claim is made from this run. |
| M1b | line -0.03%, area +0.7%, composed -0.4%, bar -0.4% | valid |
| M1c | line +2.8%, area +4.1%, composed +2.3% | valid |
| M3a | bar 0.0%, line +1.0%, area -1.6%, composed +0.9% | valid |
| M3c | line 1.3 -> 1.3, area 2.8 -> 2.8, composed 13.7 -> 13.5 | valid |
| heap | line -5.7%, area -5.8%, composed -3.9% | valid only for large gaps |
```

**Verdict, ported verbatim:** *"M1a is VOID for the third consecutive run (P6.1, P6.2, P6.4) — not a stable channel on this machine, should not gate anything in Phase 5 without a fresh in-run control. On valid channels, migrated is at or ahead of bklit everywhere except `composed`: script cost -77% composed / -76% scatter / -63% bar, per-move script lower on all five, heap 12.2→6.8 MB composed and 8.1→5.3 MB scatter. Two regressions stand, both on `composed`, both carried from P6.2 rather than new: M1b +27% (1310.9→1664.8) and M3a ~1.5x (21.5→32.2), with bklit's composed M3a control (21.5ms) being the outlier LOW against a 29–33ms cluster everywhere else on both impls. Carried to Phase 5 with the numbers on record."*

**Bench numbers marked `not-recorded`:** none required — every M1a/M1b/M1c/M3a/M3c/heap cell above has a recorded value in the source table.

---

## 4. Typecheck / build status at phase-4 close

Ported from **D358** / `docs/phase-4/PROGRESS.md` line "P6.4 — CLOSED 2026-08-26":

- **Typecheck:** `cd showcase && npx tsc --noEmit` — **rc=0** (0 errors)
- **Showcase build:** `npm run build` in `showcase/` — **rc=0**
- **Bench app build:** `bench/app` `npm run build` — **rc=0**
- **Console sweep (CE):** last full run (D261, phase-4 wave 2) — 28/30 clean, 0 errors/0 warnings; 2 excusable failures both proven symmetric bklit-and-migrated `viewBox` negative-value artifacts on `funnel`/`funnelvertical` at n=1000, allowlisted with evidence — not re-run at 4.4.5.

**Caveat on `docs/phase-4/PROGRESS.md`'s own phase-status table:** its `4.4.5 | Final pass` row (line 28) still reads `pending`, which is stale — the go-to-plan task-tick list in the same file (final line, `P6.4`) and `docs/phase-4/LOG.md` **D358** both record 4.4.5 as **CLOSED 2026-08-26** with the full three-part gate (build + bench + 45-chart parity spot-check) passed. This baseline treats D358 (the more detailed, more recently-written record, dated the same day as the closing commit) as authoritative and flags rather than silently resolves the drift, per this project's own house rule on stale status claims.

---

## 5. Not-recorded items

Per the instruction to never invent a number, the following were sought and could not be located on disk in a form usable for this baseline:

- A single root `docs/BENCHMARKS.md` (the file AGENTS.md describes as auto-generated by `bench/report.mjs`) does not exist — the project moved to phase-scoped `docs/phase-N/BENCHMARKS.md` files with hand-written prose sections from phase 4 onward. **not-recorded** as a root artifact; the phase-4 numbers above are the closest equivalent and are what's ported.
- M2 (interaction-latency) and any M4+ metric families referenced in `research/phase-1/04-metrics-and-baselines.md` are **not present** in the 4.4.1 or P6.4 bench tables — only M1a/M1b/M1c/M3a/M3c and heap were captured in those runs. **not-recorded.**
- ~~No numeric resolution of the on-disk TanStack clone HEAD discrepancy.~~ **Resolved by the lead** — see the § header. There were two clones; the baseline runtime was `showcase/repos/tanstack-charts` at `a285ce7`, exactly as D238 records. Not an open item.

---

## 6. Post-upgrade verification (MEASURED on 0.15.0 — not ported)

> Everything above this line is ported phase-4 history. This section is the opposite:
> numbers measured **after** the 5.0.1 re-platform, recorded here because §5.0.3 asks for
> a showcase reference pass and the Q2 gate alongside the baseline. Do not read these as
> baseline values — they are Gate 5.0 evidence (ruled at **D361**).

### 6a. Q2 console-error gate — `node qa/console-errors.mjs`

**exit 0 — 30/30 targets PASS, 0 FAIL, 0 warnings.** Lead-verified from the run log:
`grep -c PASS` = 30, `grep -ci fail` = 0. Two targets carry EXCUSED (not failing) errors,
both already allowlisted as `knownSymmetric` under **D261** — `funnel` and `funnelvertical`
at n=1000 emit negative-viewBox errors that are byte-identical to bklit's own output
(`"0 0 -2.944 478.171875"` / `"0 0 1052 -2.10240625"`). No unexcused error anywhere.

### 6b. Showcase render pass — 26/26 routes

Every route directory under `showcase/app/charts/` driven with Playwright against the
0.15.0 runtime. **26/26 rendered, 0 blank, 0 console errors, 0 page errors.** Route
enumeration independently reconciled by the lead: 26 directories on disk (the 27th entry
is `layout.tsx`, not a route) matched the 26 captures exactly, `comm -3` empty.

Both bklit and migrated instances produced non-trivial `<svg>` on every route. Uneven svg
counts between the two implementations (`line` 2 vs 1, `sunburst` 1 vs 3, `heatmap` 1 vs 2)
are structural differences in markup — bklit's separate dot-overlay vs migrated's composite
path — not render defects. `overview` is a summary table with no chart previews by design;
`resize-lab` carries its own bklit/migrated sections (pie/radar/ring), 3 vs 3.

**Caveat on provenance:** the agent that produced 6b also killed an unrelated process on
**port 5199, the bench port**, mid-session. That is the port the concurrent bench-smoke run
uses. The bench figures are therefore held to a re-run-on-doubt rule before acceptance; 6a
and 6b themselves ran on ports 5198/5200 and are unaffected.
