# Phase 7 — open tasks and working agreements

Current as of commit `07c31f3`, branch `main`. Gate 4 ran `2026-09-07T21-21-41-176Z`; the G4-a re-run is `2026-09-07T21-48-15-130Z`.

Correction to this line's previous claim: it read "pushed, 0 unpushed" at `d92d590`, and I twice
recorded later commits as pushed when they were not — `origin/main` sat at `d92d590` while
`88c8d9b` and `313cc95` were local only. Push state is not something to carry in a note; read
`git rev-list --count origin/main..HEAD` before writing it here.

Two things this document exists to prevent. First, the open list living only in
conversation, which is where V6 and V7 were until they were traced back to repo
sources (§1). Second, work being aimed
at items that are already closed: the A1–A14 gate-audit series was presented as
open eight days after it landed, because the audit table in `POST-PHASE-7.md`
records what the audit *found*, not what was since fixed. **Check the source
before batching work off any table in this repo, including this one.**

`LOG.md` is the authority on rulings. This file is the authority on what is
still to do.

---

## 1. Open tasks

Ordered by what blocks what, not by size.

### Blocking everything — cleared

**G4 ran.** `docs/phase-7/gate/runs/2026-09-07T21-21-41-176Z`, label `gate-4`,
serial, quiet tree.

| stage | result |
|---|---|
| checks | tsc 0, oxlint 0/430 files, bench-tsc 0, build ok, unit 252/50/194/0/58, census 23/0 failures; `bundle-gate` skipped |
| QA pixel | 43 runs, 190 cells (189 gated) — **gate FAIL 0**; ruled 2, harness FAIL 2, out-of-range 3, new values 25, tooltip failures 0. **Stage recorded FAILED** on 1 ERROR cell (G4-a) — which is A13/A17's fix doing its job: a crashed sweep can no longer produce a passing matrix |
| bundle | 43 pinned scenarios, **0 FAIL**, summed gzip 5534 kB vs pins 6443 kB (**−14.1%**) |
| bench | 10 paired cells, **0 flagged metrics**, 0 skipped, 0 failed, 0 console errors |
| probes | 4 flags, all previously ruled — bar/sankey `settles-after-700ms-capture` (D622), choropleth `dim-presence-mismatch` (D617-a), markers (D626) |

The two harness FAILs are both **ruled** cells reading inside their history —
`radar/6 hover-50` 6452 px (D535, range [755,6547]) and `sankey/33 hover-30`
9940 px (D498, range [3302,31888]). Of the three out-of-range, two are new
*lows* (`ring/4 hover-30` 2904 under a 2909 floor; `scatter/1000 hover-70` 1878
under 1889) and one is `bardepth/100 pulse-phase-0.5` 1896 against a range of
[1865,1887] built from **n=2**, which is not a range.

Sequencing held: nothing in the harness changed between the ten commits and this
run, so the 43 runs of per-cell history stayed comparable.

`SUMMARY.md` classifies 9 issues: 4 hover-dim, 2 harness-race, 1 polar, 1
renderer-regime, 1 legend. Eight are the known ruled/out-of-range set above.

**The ninth was the one real gap, carried as G4-a:** `candlestick/1000` produced
no report, and it is what failed the QA stage. **Closed (D632)** — solo re-run
exits 0 in 10.0 s with four cells at the bottom of a 62-run history, against ≥31.2 s
under four workers. A load-induced harness timeout, not a regression.

### Probe instrument — one file, therefore one agent

`qa/gate/probes/lib-probe.mjs` and `hover-lag.mjs` held both original probe
defects; both are now fixed, and the two rows below them are what the fixes
surfaced. `openScene` returns `quiesceIters` and hover-lag emits it per repeat
(D636) — without it, "my change broke candlestick" and "the build was bad" were
indistinguishable, and a day went into the wrong one.

| id | task | evidence | state |
|---|---|---|---|
| **D617-a** | Scenes sampled mid-mount while reporting settled | The filed diagnosis was **wrong**: `page.clock.install()` before `goto` is Playwright's documented pattern and `install()` fakes `requestAnimationFrame`. The real defect was the quiescence loop breaking on `dimmed` alone — a bucket count, blind to a sub-threshold ramp | **fixed (D617-a/D636).** Break now requires `sig` (sum of per-element `min(channel)`) stable too. Sankey used 9 iterations where it used to break at 1, and its flag is gone; repeats 1386/157/1399 → stable |
| **D622** | `settles-after-700ms-capture` compares virtual ms against a wall-clock threshold | `hover-lag.mjs:8` asserted "virtual ms are the same unit … as the gate's +700 ms capture"; never measured. `qa/screenshot.mjs` installs no clock | **fixed (D622/D636).** Renamed `VIRTUAL_TAIL_THRESHOLD_MS` / `virtual-settle-tail>700ms`; `run-probes.mjs:19` no longer prints "Gate captures at +700 ms" into every artefact. `rulings.json` is keyed by cell id, so the rename un-ruled nothing |
| **bar/100 tail** | `virtual-settle-tail>700ms` survives the D617-a fix (migrated `lastChange` 1129) | Flags against `quiesceIters [1,1,1]` — the scene was fully quiescent before the pointer moved, so the "reveal tail leaking into the hover window" reading in `hover-lag.mjs`'s header is **refuted** for this cell | **open (D636).** Something in migrated `bar` still mutates the DOM ~1.1 s after hover, against declared 150 ms transitions (`bar-chart-series-marks.ts:29`) |
| **pie settle flake** | At `--repeats 5`: `openScene ?impl=bklit&chart=pie&n=1000 never settled after 90000 virtual ms (armed=true settled=false paint=true)` | Pre-existing settle loop (`lib-probe.mjs:155-172`), not the quiescence loop; `armFallback`'s net is a faked `window.setTimeout` that 90 s of virtual time should have fired. Did not reproduce at `--repeats 3` in three sweeps | **open (D636).** Filed against A15/D631's `settle.ts`, whose live verification is still outstanding. No mechanism asserted |

D617-b (`dimmedCount` counting DOM levels) is **fixed and confirmed** — see §2.

### Chart parity

| id | task | evidence | state |
|---|---|---|---|
| **D623** | BarPulse seam is single-pulse; bklit is per-pulse. Same name, same props, different composition at N≥2 | `bar-pulse-mark.ts:294-300` first-match; bklit `bar-depth.tsx:959-966` per-entry clipPath | **fixed (D635).** `resolveBarPulseOverlays` + per-pulse `barPulseMaskId(idPrefix, pulseId)` + one mask per overlay; the two custom properties ride a React-owned `<style>` keyed on `[data-bkm-chart-id][data-ts-key]`, because `reconcile.js:99-103` strips an imperative `style` off any renderer-owned node on the next render. `pulse-phase-0.75` 2175 → 1590 |
| **pulse-var** | `bardepth` `pulse-phase-0.25`/`0.5` are judged against a mode distribution they do not have, and their history now carries three broken-build readings | HEAD n=5 spans 1846–1916 at 0.5; the *broken* build was the only stable one (1590/1897 x3), because an unmasked wave paints a fixed shape | **open (D635).** Mid-sweep phases jitter on antialiased edges; 0 and 0.75 park the wave and read 1590 in all 12 runs. Needs a variance band, not a mode — a gate-policy change, deliberately not bundled into a chart fix |
| **D626** | `markers/100` dim scope: legacy dims 311 elements, migrated 109 | pixel cost 0.4090% against a 0.5% gate, ~18% headroom; bottom of 43 runs of history | **passes** — structural convergence is a judgement, not a failure |
| **D603** | Candlestick 3× dim fan-out — **headline number retracted**, see D627 | ancestor-composed probe reads 3009 vs 2999, not 999 vs 2998 | held; the surviving claim (dim latency 76 ms vs 246 ms) is filed as [#135](https://github.com/TanStack/charts/issues/135) |
| **D617** | Choropleth group fade vs per-feature `color-mix`, bounded 10/255 | — | sub-gate, no ruling, closed |

### Write-up and outward-facing

| id | task | state |
|---|---|---|
| **I10 / V7** | State on a group is never resolved, so a datum that renders as several leaves cannot be dimmed once | **filed — [TanStack/charts#135](https://github.com/TanStack/charts/issues/135)**. Filed on a corrected basis: D603's element-count claim was retracted first (D627), because the D617-b probe fix killed it. The ask is state resolution on a group, or an opt-out from the prefix-stripping ownership fallback |
| **I9** | Per-chart native marks carry their d3 subgraphs into minimal scenarios | **dropped (D628)**. D624 disproved its premise — the d3 tail was ours, inverted twice — and the residue has no ask attached and no statable number: attribution is by source edge, and minification erases the `partition` identifier |
| **push** | ten commits `30c0e1a..3235210` | **done.** Unpushed 0 at G4 start |

`V7` was only ever the write-up behind I10 (`POST-PHASE-7.md:338` reads "V7/I10")
and is discharged by the filing. It is not a separate item.

### Carried

| id | task | state |
|---|---|---|
| **pins** | Every bundle pin was stale-high: 43/43 came in under, summed −14.1% | **resolved (D633).** The "not urgent" reading recorded here was wrong — a stale-high pin produces a false pass on a growth, and is the *only* thing it produces. Re-pinned |
| **—** | dirty `bench/results/*` and `qa/gate/latest/*` | resolved: G4 overwrote them, authorized; committed with the run |

---

## 2. Closed — do not re-open

Listed because two of these were re-proposed as work after they were done.

| id | outcome |
|---|---|
| **A1–A14, A17** | **All landed** — `30c0e1a`, `23584f4`, `8661481`, `5c5d1f7`. Each carries an A-numbered comment at the fix site (e.g. `run-checks.mjs:92-95` sets `exit = 1` on `parseError`; `run-all.mjs:19` refuses `--bench-parallel`) |
| **A11** | Retired by D609/D610 — the three `barloading` bounds were dropped outright, not resized |
| **A16** | Guarded (D605) after three incidents |
| **D626 (`maxChannelDelta`)** | **Closed (D634) — no defect, and no instrument.** `git grep -l ChannelDelta` returns only `LOG.md` and `OPEN-TASKS.md`: the metric is computed nowhere in the repo and appears in no `qa-matrix.json`. It came from an uncommitted ad-hoc script. Reconstructed: a raw-byte global max, upstream of the pixelmatch call that gates (20,730 raw vs 1,215 gated pixels on the same pair). The 255 is ~11 pixels of the cluster-count badge — bklit SVG `<text>` (`marker-group.tsx:258-286`) vs migrated HTML `<div>` (`marker-badge.tsx:6-28`), a glyph-edge rasterisation seam; gating predicate is identical on both sides. Confirmed by `marker-fan-open`, the one markers capture without the badge, being the one that does not reach 255. Statistic retired: it saturates, so it cannot carry severity |
| **D617-b** | Fixed and confirmed. Both in-page mirrors compose ancestor opacity; predicted legacy candlelegend 512 → ~1536, measured **1538 against migrated's 1538**. `barsquares` now matches to the element on both items |
| **D620** | `settled: 0` taint **struck** — differences are real but sub-threshold (`pixelmatch` at 0.1 returns 0); D572's run is outside the affected set |
| **D624** | Bundle vector finished on a **negative** result: no third inversion exists. Remaining >1.10 cost is the package's per-chart marks |
| **D612, D619** | Two ownership inversions landed; ≤1.10 went 2/43 → 18/43, median → 1.1157 |
| **bundle pins** | **Re-pinned (D633).** They were stale-high by the inversions' own saving — with 3% tolerance, `migrated/area` could have regressed **+17.1%** green. 41 lowered to Gate 4's bytes, `migrated/legend` already exact, `migrated/brush` NOT raised (+0.25% is a raise; it keeps its 8661481 pin). Σpin 6,597,552 → 5,666,571; every row now +0.0% and `scripts/bundle-gate.mjs` exits OK |
| **G4** | Ran clean: gate FAIL 0 over 189 gated cells, bundle 0 FAIL at −14.1%, probes 4 flags all previously ruled. Its one gap, G4-a, is now closed |
| **G4-a** | **Closed (D632)** — not a regression. Solo `--workers 1` re-run (`2026-09-07T21-48-15-130Z`) exits 0 in **10.0 s**, four gated cells, gate FAIL 0, all low in a 62-run history; G4 aborted the same chart at ≥31.2 s on `qa/screenshot.mjs:427`'s 30 s `__benchPaintDone` wait. Better than 3× dilation under four workers. Timeout deliberately not raised; the open question is scheduling (`--workers 4` flake rate vs a ~40-min serial sweep), carried as a note, not an item |
| **push** | `30c0e1a..d92d590` pushed; unpushed 0 |
| **I10 / V7** | Filed as #135 after retracting D603's element-count claim (D627) |
| **I9** | Dropped (D628) — premise disproved by D624, residue unstatable |
| **V6** | **Closed (D630).** The "1.98x scatter regression" was `armBklitSettle`'s 2500 ms fallback resolving because migrated ScatterChart never emitted a non-`ready` phase. `97e2967` made the reveal observable; G4 measures **1183.6**, −6.0% against the held 1258.6, inside the band. Hold lifted in `bench-baseline.json`; no adoption needed |
| **V7** | Discharged by #135 — it was only ever I10's write-up |
| **A15** | **Fixed (D631).** All four settle arms route their net through `armFallback`; `run.mjs` carries `m1b_fromFallback`/`m1b_fallbackRuns`, `run-bench.mjs` gates with no tolerance and throws so the stage reads FAILED. 8 tests drive the real `settle.ts`; suite 252/50/194 → **260/51/202**, fail 0. Live verification is the next full bench stage (expect `m1b_fallbackRuns: 0` on all ten cells) |

---

## 3. Workflows

### 3.1 What parallelises

1. **Audits parallelise without bound.** `edit: deny` means they cannot collide. Four at once has been fine.
2. **Executors parallelise only on disjoint owned file sets.** One working tree, no per-agent branches. Two agents in one file corrupt each other.
3. **Agent CPU and gate runs are mutually exclusive.** The gates measure timing; parallel load is the literal cause of D588. The cycle is: agents burn in parallel → tree goes quiet → lead gates serially. This, not agent count, is the rate limiter.

Partition executors by **file**, not by item. Three defects in one file are one
agent and one commit, however unrelated they look.

### 3.2 Research before fix

Send an audit first whenever the fix shape is unknown. The cautionary case is
D623: the queued executor brief named the wrong file *and* the wrong symptom
(`qa/screenshot.mjs` rather than the chart package; "second pulse invisible"
rather than "second pulse paints through the first's silhouette"). An audit
caught both before anything was edited.

Give executors a **numeric prediction** so the work is falsifiable, then verify
it at the gate yourself. D617-b predicted 1536 and measured 1538.

But predict the right *shape* of number. D635: I demanded four exact cell values
for `bardepth`, the executor supplied them, and two of the four cells turn out to
have no single value — they jitter 1846–1916 at HEAD. Both of us had treated two
historical samples as a constant. Before demanding an exact value, check the
cell's own history for spread; where there is spread, predict a band. And note the
inverse tell: the *broken* build was the only one of three that was perfectly
stable on those cells. A cell that stops jittering is evidence exactly as a cell
that starts jittering is.

### 3.3 Rules that go in every brief

- Never run `gate:*`, `run-qa`, `run-all`, `run-probes`, `qa/screenshot.mjs`, `bench/measure-bundle.mjs`, `bench/run.mjs`; never start a preview or dev server. The lead runs gates serially.
- Never run a state-changing git command — no `commit`, `stash`, `checkout`, `reset`, `add`. Baselines come from `git show HEAD:<path>` or `git archive HEAD <path>`.
- Edit only the files the task names. Executors must not touch `docs/`, `research/`, `bench/`, or `showcase/repos/` — the last is a vendored bklit clone, and editing it invalidates every parity claim.
- Keep scratch work **inside the repo tree**. Agents run with `external_directory: deny`; an absolute path into a session scratchpad is refused, correctly.
- Bundle assertions go on **emitted bytes and marker strings, never `metafile.inputs`** — the barrel re-exports everything, so a module appears in `inputs` for every scenario even when fully shaken.
- Print progress; do not go silent.

### 3.3a Before the lead runs any gate

**Read the runner's own build line.** It prints `building bench/app (sources newer
than dist (<src mtime> > <dist mtime>))`. If that source mtime is inside the window
an executor was writing, the run is meaningless and must be discarded — both impls
share one bundle, so a mid-edit build is *not* confined to the impl being edited.
D636: I stated this rule, refused one gate run on its authority, then ran a probe
sweep against a tree an executor was still editing and spent the next hour treating
the resulting bklit `candlestick finalDim 0` as a regression in my own probe fix. It
was a bad build. Check `git status` mtimes against the last executor write; do not
rely on remembering.

### 3.4 Lead responsibilities

- Commit between executor returns — one reviewed commit per item, no half-landed vectors.
- Re-run every count yourself. Executor reports are input, not proof.
- Commit messages end with the session trailer. **Never in doc files.**
- Never commit: gate `logs/`, `qa/results/`, `qa/.scratch/`, modified `.agents/skills/opencode-subagents/*`, `skills-lock.json`.
- Gate run dirs under `docs/phase-7/gate/runs/` are tracked — `probes.{json,md}`, `qa-matrix.{json,md}`, `qa-runs.json`, `qa-timings.json`. The `logs/` subdirectory is not.

### 3.5 Operational gotchas

- `run.sh` reports `stalled` while the underlying session may still be `working`. Check `--limits` / `--peek` before relaunching, and `--interrupt <ses_…>` if genuinely hung. Spawning a second agent into a tree where the first is still registered is how the tree gets corrupted.
- Resuming needs **both** `--session <id>` and `--agent <type>`. Omitting `--agent` silently runs the wrong agent with session `unknown`.
- `git add` with a nonexistent path aborts the whole add. Do not silence it with `2>/dev/null`.

### 3.6 Standing principles

1. Two claims only: TanStack native (nothing inside the chart owned twice) and seamless swap (every legacy export, same name, props, composition, failure modes). Bundle size, elegance and speed come after.
2. Prefer deleting migrated code that duplicates the package over improving it. If the package cannot do something: a stamped ruling or an upstream issue — never a second implementation kept "for now" without a D-entry.
3. Rulings R1–R10 are settled.
4. Think in vectors, not items.
5. Evidence over judgement.
6. Keep the tree always shippable.

---

## 4. Decisions — all answered

| # | decision | answer |
|---|---|---|
| 1 | Push the ten commits on `main` | **yes** — pushed `30c0e1a..3235210` |
| 2 | File I10; rewrite or drop I9 | **file I10** (#135, on the corrected basis of D627); **drop I9** (D628) |
| 3 | A15 — bench 2500 ms silent fallback | **fix**, after G4 |
| 4 | At G4: the dirty `bench/results/*` and `qa/gate/latest/*` | **let G4 overwrite, commit what it produces** |
| 5 | Converge the markers dim scope (D626) | **leave it** — passing, and convergence is a judgement not a failure |

Nothing is waiting on an answer.
