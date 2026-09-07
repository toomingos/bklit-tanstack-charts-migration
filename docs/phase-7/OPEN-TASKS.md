# Phase 7 — open tasks and working agreements

Current as of commit `05579bc`, branch `main`, 36 commits unpushed.

Two things this document exists to prevent. First, the open list living only in
conversation, where V6 and V7 currently do — they appear in exactly one line of
`POST-PHASE-7.md` and are defined nowhere in the repo. Second, work being aimed
at items that are already closed: the A1–A14 gate-audit series was presented as
open eight days after it landed, because the audit table in `POST-PHASE-7.md`
records what the audit *found*, not what was since fixed. **Check the source
before batching work off any table in this repo, including this one.**

`LOG.md` is the authority on rulings. This file is the authority on what is
still to do.

---

## 1. Open tasks

Ordered by what blocks what, not by size.

### Blocking everything

| id | task | why it blocks | owner |
|---|---|---|---|
| **G4** | Run the full gate (`node --run gate:all`, serial) | Ten commits of changes are unvalidated. Every remaining ruling would rest on it. Needs a quiet tree — no agents running. | lead |

**Sequencing that matters:** G4 runs *before* any further harness change. The
gate's verdicts are compared against 43 runs of per-cell history; changing the
instrument first makes that history incomparable. Measure against the known
instrument, then change it, then re-measure.

### Probe instrument — one file, therefore one agent

`qa/gate/probes/lib-probe.mjs` and `hover-lag.mjs` hold both remaining probe
defects. They cannot be parallelised against each other.

| id | task | evidence | state |
|---|---|---|---|
| **D617-a** | `openScene`'s virtual clock does not advance legacy's framer-motion mount, so scenes are sampled mid-mount while reporting settled | `lib-probe.mjs:129` `page.clock.install()` before `goto`; choropleth composed opacity read 0.0046 then 0.0462 minutes apart | open — **fix shape unknown, research first** |
| **D622** | `settles-after-700ms-capture` compares virtual ms against a wall-clock threshold | `hover-lag.mjs:8` asserts "virtual ms are the same unit … as the gate's +700 ms capture"; never measured. `qa/screenshot.mjs` installs no clock | open — **fix shape unknown, research first** |
| **D626** | `maxChannelDelta` 255 on markers `settled` *and* legend-hover captures | measured; unattributed | open loose end — forensic audit |

D617-b (`dimmedCount` counting DOM levels) is **fixed and confirmed** — see §2.

### Chart parity

| id | task | evidence | state |
|---|---|---|---|
| **D623** | BarPulse seam is single-pulse; bklit is per-pulse. Same name, same props, different composition at N≥2 | `bar-pulse-mark.ts:294-300` first-match; bklit `bar-depth.tsx:959-966` per-entry clipPath | open, **spec'd**, in-repo reachability **0** — queued behind G4 |
| **D626** | `markers/100` dim scope: legacy dims 311 elements, migrated 109 | pixel cost 0.4090% against a 0.5% gate, ~18% headroom; bottom of 43 runs of history | **passes** — structural convergence is a judgement, not a failure |
| **D603** | Candlestick 3× dim fan-out | — | held |
| **D617** | Choropleth group fade vs per-feature `color-mix`, bounded 10/255 | — | sub-gate, no ruling, closed |

### Write-up and outward-facing — all need authorization

| id | task | state |
|---|---|---|
| **I9** | Rewrite against D624's premise, or drop. The original argued from the d3 tail; the d3 tail was our code, which we proved by fixing it twice | unblocked, **not written**. New claim is narrower: per-chart native marks carry their d3 subgraphs into minimal scenarios. Attribution is by source edge, not bytes — minification erases the `partition` identifier, so the package's share of +27.2k is **not** a number we can state |
| **I10** | Drafted, deliberately not filed | needs authorization |
| **V7** | Needs writing up before filing | **definition exists only in session context, not the repo** |
| **push** | 36 commits on `main` | needs authorization |

### Carried, low priority

| id | task | state |
|---|---|---|
| **V6** | Retire the `migrated/scatter/1000` m1b hold; a held audit on `tanstack/scatter/100 m1b_settleMs +31.4%` was never launched | **definition exists only in session context, not the repo** |
| **A15** | Bench 2500 ms fallback substitutes silently | user's call |
| **—** | `bench/results/css-sizes.json`, `latest.json` dirty from runs predating current work; `qa/gate/latest/*` dirty from this session's gate runs | decide at G4 — commit or revert, not silently either |

---

## 2. Closed — do not re-open

Listed because two of these were re-proposed as work after they were done.

| id | outcome |
|---|---|
| **A1–A14, A17** | **All landed** — `30c0e1a`, `23584f4`, `8661481`, `5c5d1f7`. Each carries an A-numbered comment at the fix site (e.g. `run-checks.mjs:92-95` sets `exit = 1` on `parseError`; `run-all.mjs:19` refuses `--bench-parallel`) |
| **A11** | Retired by D609/D610 — the three `barloading` bounds were dropped outright, not resized |
| **A16** | Guarded (D605) after three incidents |
| **D617-b** | Fixed and confirmed. Both in-page mirrors compose ancestor opacity; predicted legacy candlelegend 512 → ~1536, measured **1538 against migrated's 1538**. `barsquares` now matches to the element on both items |
| **D620** | `settled: 0` taint **struck** — differences are real but sub-threshold (`pixelmatch` at 0.1 returns 0); D572's run is outside the affected set |
| **D624** | Bundle vector finished on a **negative** result: no third inversion exists. Remaining >1.10 cost is the package's per-chart marks |
| **D612, D619** | Two ownership inversions landed; ≤1.10 went 2/43 → 18/43, median → 1.1157 |

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

### 3.3 Rules that go in every brief

- Never run `gate:*`, `run-qa`, `run-all`, `run-probes`, `qa/screenshot.mjs`, `bench/measure-bundle.mjs`, `bench/run.mjs`; never start a preview or dev server. The lead runs gates serially.
- Never run a state-changing git command — no `commit`, `stash`, `checkout`, `reset`, `add`. Baselines come from `git show HEAD:<path>` or `git archive HEAD <path>`.
- Edit only the files the task names. Executors must not touch `docs/`, `research/`, `bench/`, or `showcase/repos/` — the last is a vendored bklit clone, and editing it invalidates every parity claim.
- Keep scratch work **inside the repo tree**. Agents run with `external_directory: deny`; an absolute path into a session scratchpad is refused, correctly.
- Bundle assertions go on **emitted bytes and marker strings, never `metafile.inputs`** — the barrel re-exports everything, so a module appears in `inputs` for every scenario even when fully shaken.
- Print progress; do not go silent.

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

## 4. Decisions needed

| # | decision |
|---|---|
| 1 | Authorize the push of 36 commits on `main` |
| 2 | Authorize filing I10, and I9 if the rewrite is wanted rather than a drop |
| 3 | A15 — bench 2500 ms silent fallback |
| 4 | At G4: commit or revert the dirty `bench/results/*` and `qa/gate/latest/*` |
| 5 | Whether to converge the markers dim scope (D626) — a parity judgement, currently passing |
