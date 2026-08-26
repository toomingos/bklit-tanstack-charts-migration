# P0.1b — sankey settled FAIL 2.4818% (D238 v0.14.0 regression queue)

Working notes. Final ruling goes to `docs/phase-4/LOG.md` as D239 when closed.

## Symptom (D238)

- Post-bump Q1 sweep (runs `qa/results/sankey/2026-08-21T11-20-35-549Z`, `…11-23-46-965Z`):
  settled FAIL **2.4818%**, identical across both runs (deterministic). Gate = 0.5%.
- Historic flake band quoted in D238: **0.16–0.59%**.
- Diff PNG: red concentrated on all 4 node columns + their labels; links near-clean.

## Density/probe sanity check (per P0.1 protocol — FIRST, before any code change)

Census of ALL `qa/results/sankey/*/report.json` (n / mode / settled diff%):

| runs | n | mode | settled % |
|---|---|---|---|
| 07-31 | 4/33/100/300 | self-test | 0 |
| 08-03 early (pre-fix era) | mixed | compare | 0.0008–19.7 (chaotic, mid-debug) |
| 08-03T15-21 → 08-08 (post-5a2c444 green era) | **33** ×7, **4** ×8 | compare | **0.5866–0.5869** / **0.1607–0.1647** |
| 08-04T12-49-05 | 1000 | self-test | 0 (self-test trivially 0) |
| 08-21 D238 failing pair | **1000** | compare | **2.4818** |

Key facts:
1. **The 2.48% runs are the FIRST-EVER sankey compare at n=1000.** Every historic PASS is
   n=4 (0.16%) or n=33 (0.5866–0.5869%) — i.e. the "historic band" was measured ONLY at
   n=4/n=33. There is no pre-bump n=1000 baseline to regress FROM.
2. n=1000 data = `generateSankey` synthetic layered DAG: perLayer=round(sqrt(1000))=32
   nodes/layer ⇒ 4 layers × 32 nodes with nodePadding 24 ⇒ padding alone = 31×24 = 744px
   against inner height ≈ 720px−80 margins... d3-sankey must SCALE DOWN to fit
   (`scale`<1 compresses node heights; ky→0 territory).
3. Both D238 runs byte-stable (23825 diff px both) ⇒ deterministic geometry, not a race.

Hypotheses:
- H1 (density artifact, mirrors D238a bar-family): at n=1000 the layout is in a
  degenerate scaled regime where sub-pixel rounding differs between bklit's
  `[0,0]-extent + translate(margin)` render and migrated's margin-inclusive
  `chart.bounds` extent — amplifying tiny FP differences across 128 dense nodes +
  ~256 labels. If so: NOT a v0.14 API regression; fix = run gate at n=33 (or prove
  parity at n=1000 impossible by construction) + log waiver, zero source diffs.
- H2 (real v0.14 drift): v0.14 changed chart bounds/margins/scene-label rendering such
  that migrated node columns land a consistent offset vs bklit even at sane densities.
  Disprove by running current pinned code at n=33/n=4: if settled returns to
  ≤0.5869%/≤0.1647%, H2 is dead.

## Verification plan

1. Run QA compare at n=33 and n=4 on CURRENT pinned code (unmodified working tree):
   - n=33 expected ≤0.5869% (byte-comparable to 08-08 green runs)
   - n=4 expected ≤0.1647%
   - If both hold → drift confined to degenerate density → decide H1 vs H2 via
     live DOM geometry probe at n=1000 (compare node rect y-coords A vs B).
2. Live probe at n=1000 on bench dev server (port 5199): extract first/last node
   rects + label positions from both impls, diff numerically.
3. Only then consider a code fix (and it must be sankey-confined).

## Status

- [x] Census of prior runs
- [x] n=33 rerun on pinned v0.14 code → **FAIL 0.7305%** (`qa/results/sankey/2026-08-22T09-35-20-400Z`),
      above historic band 0.5866–0.5869% AND above the 0.5% gate. H2 (real drift) ALIVE —
      regression reproduces at sane density, not a n=1000-only artifact.
- [x] n=4 rerun on pinned v0.14 code → **PASS 0.3352%** (`qa/results/sankey/2026-08-22T09-36-05-522Z`)
      BUT historic n=4 band was 0.1607–0.1647% ⇒ ~2× band drift too.
- [ ] Live DOM geometry probe
- [ ] Root cause ruled; fix or waiver

## Verdict after reruns (2026-08-22)

**H1 dead as sole cause, H2 CONFIRMED.** Drift is present at every density:
- n=4: 0.16→0.335 (+0.17pp)
- n=33: 0.5868→0.7305 (+0.14pp) — FAILS 0.5% gate
- n=1000: 2.48 (density amplifies it further, but drift exists at sane n too).
Consistent additive offset ⇒ systematic node/label geometry shift from v0.14,
not a degenerate-regime artifact. Fix required (H2 path).

## Live geometry probe @ n=1000 (2026-08-22, dev server 5199)

Probe script: `scripts/sankey-geometry-probe.mjs` (TEMP, delete when closed).
Results:
- **Node rects: PIXEL-IDENTICAL** (first5+last5 all dx=dy=dw=dh=0). Layout/bounds
  exonerated — H2's "bounds/margin drift" form is dead too.
- **All 256 `<text>` label bboxes shifted dx = −1.0 … −1.1px** (migrated left of
  bklit), dy ≤ 0.2, w/h IDENTICAL (same font stack `13px/500 Geist…`, same sizes).
- Rotation centers: migrated `rotate(-90 176 139.05)` etc. — pure positional shift,
  not metrics. Console errors 0 both sides.

⇒ Root cause is a **uniform ~−1px horizontal label-paint translation** in the
migrated impl post-v0.14, NOT layout, NOT fonts, NOT density. Diff PNG confirms:
red exclusively on label columns (links + node rects clean).

## Census CORRECTION (full report survey, contradicts "historic band" framing)

Full report.json survey of ALL sankey runs (67):
- **n=33 compares were ALWAYS overall=FAIL** (hover diffs 1.1–1.7%); even their
  settled 0.5866–0.5869% sat ABOVE today's 0.5% gate. Only **n=4 (settled 0.1607%)**
  ever passed overall cleanly (many runs, 08-03→08-08).
- Post-bump deltas are additive on top of history: n=4 settled 0.1607→**0.3352**,
  n=33 settled 0.5866→**0.7305** (both ≈ +0.15pp ≈ one extra 1px column over every
  label glyph run). Consistent with the probe's uniform −1px label shift.

## Status

- [x] Census of prior runs (CORRECTED: n=33 never passed overall; n=4 was the real green)
- [x] n=33 rerun on pinned v0.14 code → FAIL settled 0.7305% (`qa/results/sankey/2026-08-22T09-35-20-400Z`)
- [x] n=4 rerun on pinned v0.14 code → PASS gate but 2× historic band: 0.3352% (`qa/results/sankey/2026-08-22T09-36-05-522Z`)
- [x] Live DOM geometry probe @ n=1000 → node rects identical; ALL labels −1px x
- [x] Root cause ruled: commit 97aaf78 baseline semantics (NOT v0.14)

## ROOT CAUSE FOUND (2026-08-22)

**Not v0.14. Commit `97aaf78` (Aug 13, "native SceneLabel labels") — inside the
ungated Aug 8 → Aug 21 window.**

- Pre-97aaf78: injected-DOM labels carried bklit-verbatim `dy="0.35em"`
  (alphabetic baseline).
- Post-97aaf78: SceneLabels emitted `baseline:"middle"` → renderer prints
  `dominant-baseline="middle"`. On −90°-rotated labels the two centering
  conventions differ by ~1px along the text-normal = screen X.
- svg-renderer.ts byte-identical between pins b869067→a285ce7; node rects
  identical live ⇒ bump exonerated. D238 misattributed (no sankey gate ran in
  the 97aaf78 window).

Causal proof (scripts/sankey-baseline-experiment.mjs, dev server, n=1000):
live-patching migrated's 256 texts to `dominant-baseline:auto` + `dy=0.35em`
moves each label dx +0.93…+1.1px and lands AABBs within 0.05–0.15px of bklit's
reference (residual subpixel noise). h/w unchanged.

## Fix plan (minimal, sankey-confined)

`showcase/migrated/charts/internal/sankey-mark.ts` pushLabel(): drop
`baseline:"middle"`, add `+0.35*fontSize` to y (renderer derives rotate() center
from the same x/y ⇒ rigid shift, geometry preserved; emulates dy exactly).
Horizontal branch gets same treatment (bklit horizontal uses identical dy).

- [x] Apply fix
- [x] `pnpm --dir showcase check-types` clean, exit 0
- [x] QA settled back in band, all densities: n=4 0.0008% (`2026-08-22T12-37-02-035Z`),
      n=33 0.1092% (`2026-08-22T12-39-35-219Z`, beats the historic 0.5866–0.5869% band —
      the em-baseline fix removed the extra label-column pixels cleanly), n=1000 0.3041%
      (`2026-08-22T12-37-42-696Z`). Settled regression: **CLOSED**.
- [x] Zero console errors (migrated n=4/n=1000 + bklit n=1000, 3 loads, 0 errors/warnings/pageerrors)
- [x] Delete temp scripts (`scripts/sankey-baseline-experiment.mjs`, `scripts/sankey-geometry-probe.mjs`)

## Hover-state divergence — separate, pre-existing, NOT fixed by this patch

The label-baseline fix targets the settled paint path only. Hover/dim states fail at
n≥33 both before and after the fix, and were **never gated to pass at n≥33 historically**
(census correction above: n=33 compares "ALWAYS overall=FAIL"). The fix improves hover
numbers (it removes the systematic label offset that hover diffs also inherit) but does
not close them:

| n | hover-30 pre-fix → post-fix | gate |
|---|---|---|
| 4 | 0.4302% → 0.1819% (PASS both) | 0.5% |
| 33 | 1.3978% → 1.0540% (FAIL both) | 0.5% |
| 1000 | 3.2448% → 2.8392% (FAIL both) | 0.5% |

This is a distinct rendering-path issue (link/node dim-highlight on hover, not label
paint) already scoped for Wave 1 package **P1.2 — sankey incl. controlled-hover**
(`research/phase-4/go-to-plan.md`). Ruled out of T-02b's scope: T-02b closes the settled
v0.14-window regression; hover divergence is carried forward as P1.2's problem, not
re-investigated here.

## Ruling (D239)

**T-02b CLOSED.** Root cause: commit `97aaf78`'s SceneLabel `baseline:"middle"` vs
bklit's verbatim `dy="0.35em"` alphabetic-baseline offset (not the v0.14.0 API bump —
D238's attribution corrected). Fix: `sankey-mark.ts` `pushLabel()` now applies the
rotation-aware equivalent of bklit's dy (±0.35·fontSize along the rotated text-normal)
instead of CSS middle-baseline. Settled gate green at all three densities, typecheck
clean, console clean, sankey-confined (2 files, both diffs shown above). Hover-state
FAILs at n≥33 are separate, pre-existing (reproduce byte-comparably before and after
this fix), and deferred to Wave 1 P1.2 by design — not a T-02b blocker.
