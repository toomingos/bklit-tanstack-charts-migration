# Plan Phase 5

> ## ✅ CLOSED — 2026-08-27
>
> All four macro stages executed: **Upgrade (5.0) → Verify (5.1) → Plan (5.2) → Implement (5.3)**.
> Runtime re-platformed onto `@tanstack/charts@0.15.0` (pinned exact, exceeding the `≥0.14` target).
> **23/23 tasks and all D1–D17 dispositioned. 57 log entries, D359–D415.**
>
> | Gate | Result |
> |---|---|
> | QA full matrix | **43/43 runs · 160/160 cells inside historical range** |
> | Typecheck / build | `tsc --noEmit` **exit 0** · `next build` **exit 0** |
> | Bench | `--all` **24/24 combos**, no regression across four full runs |
> | `@visx` in migrated | **0 import sites** (legacy still has 42 files) |
> | Protected harness files | **0 modified** |
>
> **Two known-failing baselines, both one defect.** `choropleth` n=100 hover-30 and `candlestick`
> n=1000 hover-30 are symptoms of a single hover-capture timing race in `qa/screenshot.mjs`
> (D402 → D411 → D413), not parity divergences: the choropleth failure switches *which side* it
> afflicts between runs and re-runs clean 6× at 0.0000%, and every candlestick over-gate run has a
> `settled` cell bit-identical to baseline with only the hover cell moving. This plan's own rule —
> "QA gates are the law; **known-failing baselines are the reference**" — is the provision they are
> recorded under. Root-causing the race requires editing a protected harness file and is **parked
> for the gate author**; D402 §4 already ranked it the highest-value item on that list.
>
> **One item deliberately not done: 5.1.2.** The plan marks it "optional, user-approved only …
> do not file without approval." No approval was given, so nothing was filed. The
> paint-server-resources RFC remains drafted and ready.
>
> Detail: `docs/phase-5/PROGRESS.md` · `docs/phase-5/LOG.md` · `docs/phase-5/captures/5-3-5-final-matrix.md`

## Main Goal (inherited)

Migrate the Bklit UI charts to Tanstack Charts by:

- Exact same frontend design and interactivity
- Make backend tanstack charts native
- Keep same components API (seamless change from Legacy Bklit to tanstack charts)

## Phase 5 Goal

Research is done (`research/phase-5/00–05`): the migrated charts deviate from the claim in **17 catalogued ways (D1–D17)**, and nearly every fix is gated by one fact — our vendored runtime predates the features we need. This plan:

- **Re-platform onto the published runtime** (`@tanstack/charts` ≥0.14) — the prerequisite unlock
- Replace custom subsystems with sanctioned APIs: tooltips, interaction/focus, polar hit-testing, paint resources, sizing, replay, legends/a11y
- Remove foreign deps from migrated code (`@visx/*`) per the staged plan
- Preserve exact design/interactivity/API parity throughout — QA gates are the law; known-failing baselines are the reference

**Explicitly out of scope:** funnel migration (D30/D54 ratified by upstream PR #81), tick pills (custom-mark route documented, no urgency), sunburst label overlay (blocked upstream — no node angles exposed), legend systems (keep-custom, #95 open), loading states (app-owned).

**Macro structure:** Upgrade (5.0) -> Verify (5.1) -> Plan (5.2) -> Implement (5.3)

## How to Work

You are the key decision maker and manager. You orchestrate sonnet sub agents. Always parralize and batch tasks as much as possible. Verify gate math independently; agents omit failures. Log every accepted deviation as a `D<next>` entry in `docs/LOG.md`.

> **Closure note — one deviation from this section's own wording.** `docs/LOG.md` was never created; the phase ledger lives at **`docs/phase-5/LOG.md`**, alongside the phase-4 ledger at `docs/phase-4/LOG.md`. Numbering is continuous with prior phases (this phase runs D359–D415), so no D-number is ambiguous. Everything else in this section was followed: sonnet executors were batched per 5.2.2, and gate math was re-derived independently — which is how D401 (an agent's omitted failure), D402 (three silent T0 gate crossings), and D411 (my own over-stated headroom reading) were each caught.

---

## Phase 5.0: Upgrade (NEW — the unlock)

### 5.0.1 — Re-vendor

Vendor `@tanstack/charts@<latest stable>` (pin exact); archive the old clone for diffing; update bench aliases + tsconfig paths; LOG entry documenting the pin change (supersedes D238).

### 5.0.2 — Breaking-change sweep

Upstream shipped breaking renames inside minors (v0.7 callback reshape, v0.8 "Harmonize"). Dispatch ONE executor agent: walk every `@tanstack/*` import/subpath in `showcase/migrated/**` against the new version's exports map + changelogs; output a compat matrix (import | status | action) in `research/phase-5/06-upgrade-compat.md`. Fix fallout inline (mechanical renames only — no behavior changes yet).

### 5.0.3 — Baseline

BEFORE any migrated-code either port benchmarks from phase 4 (recommended) or capture in `docs/phase-5/` placeholders (create them):

- full QA run (all charts) — record results incl. known-failing heatmap/pie/choropleth baselines
- `pnpm bench --all` + typecheck + build status
- showcase visual reference pass per chart

**Gate 5.0:** showcase renders, typecheck/build green, QA parity ≤ pre-upgrade baselines. Fix or roll back before 5.1.

---

## Phase 5.1: Verify

### 5.1.1 — Research drift check

`research/phase-5/01+05` verdicts were verified against `@main`; the pin may differ. Dispatch ONE unbiased agent to re-check every REFUTED/native-capability claim against the actual pinned version; append corrections to the affected files (terse `Pin-check:` notes). Claims already CONFIRMED as gaps need no recheck.

### 5.1.2 — Upstream engagement (optional, user-approved only)

File the drafted feature requests: (a) paint-server resources / documented url(#id) contract + canvas warning; (b) sunburst label channel. Drafts live in session history; do not file without approval.

---

## Phase 5.2: Plan

### 5.2.1 — Go-to-plan

Merge `01`, `02`, `05` (+ drift-check corrections) into `research/phase-5/go-to-plan.md`: one terse task table — `task | deviation | files | acceptance criteria | batch | risk`. Every D1–D17 must appear exactly once as resolved / reduced / accepted-with-log.

Rulings to LOG before implementation starts:

| Ruling | Content |
|---|---|
| Funnel | No-migration stands; PR #81/case-125 recorded as corroboration |
| Pinch | Continuous centroid-anchored replaces visx ±10% steps (justified smoothness deviation) |
| Passthrough | Build on undocumented url(#id) SVG passthrough WITH guards (registry test + renderSvg fallback + solid-fill degradation) |
| Gauge linear | FIX (bring under `<Chart>`) or ACCEPT — decide during planning |
| Heatmap | File-wrapper re-scope onto native binning/color/stagger post-upgrade |

### 5.2.2 — Batch ordering

Dispatch ONE executor agent to sequence the task table into parallelizable batches. Expected shape (adjust freely):

- **B0** upgrade fallout (from 5.0.2 leftovers)
- **B1** mechanical deletions, no visual risk: delete `use-container-size` → fluid sizing/responsive builders · drop redundant resize listener · consolidate matchMedia into one hook · ariaLabel threading + ariaDescription
- **B2** paint resources: scene gradients + idPrefix · group clip · sankey keyframes → declarative motion
- **B3** interaction: focus strategies/bisectors → group-x/y + maxFocusDistance · crosshair/focusGuide replace hover-chrome DOM · polar focusGroupAngle · createChartCursor sync
- **B4** tooltip token migration (highest parity risk — own batch, dedicated QA incl. hover screenshots)
- **B5** renderer-coupling cleanup: dataset flags → stagger/phases · replay via remount-key/renderer-swap/initial:'always' · wipe rects redesign
- **B6** visx removals per `02-visx-removal.md` (pattern port + zoom hook; packages stay installed)
- **B7** animation → `motion()` renderer adoption (after B4/B5 — tooltip motion rides it)
- **B8** deferred items executed only if unlocked upstream (sunburst labels, tick pills)

Dependency rule: nothing enters a batch whose prerequisite batch isn't gated green.

---

## Phase 5.3: Implement

### 5.3.1 — Baseline

Already captured in 5.0.3; per-batch diffs reference it.

### 5.3.2 — Implementation

Batch by batch via executor agents in parallel where 5.2.2 allows.

### 5.3.3 — Gate

After EVERY batch: typecheck + build + QA subset (per `02-visx-removal.md` gate map; hover-sensitive charts get screenshot pairs) + bench smoke vs baseline. Fix or revert before next batch. Tick progress in `docs/phase-5/PROGRESS.md`.

### 5.3.4 — Staleness rule

Once implementation starts, `go-to-plan.md` is the source of truth. Do not re-consult research files for code already touched.

### 5.3.5 — Final pass

Full QA matrix + `bench --all` + parity spot-check ALL charts vs 5.0.3 baseline. Dependency audit: zero `@visx/*` imports in migrated code; census re-run appended to `03-dependencies-and-packaging.md`.

---

## Definition of Done — verified 2026-08-27

- [x] **All go-to-plan tasks closed or skipped-with-reason** (logged, `D` convention) — 23/23 T-ids (T1–T22 incl. T21a/T21b). T22 is ACCEPTED-WITH-LOG (D405): both upstream blockers re-verified as still closed at the 0.15.0 pin, so neither half executed.
- [x] **Typecheck + build + bench pass** — `tsc --noEmit` exit 0, `next build` exit 0, `bench --all` 24/24 with no regression across four full runs. **QA parity is qualified, not absolute:** 160/160 cells sit inside their own historical range, but two are carried as *known-failing baselines* per this plan's rule rather than as clean passes (see the banner above).
- [x] **D1–D17 ledger reconciled** — all 17 rows carry a disposition and a task pointer at `research/phase-5/go-to-plan.md:66-82`: 10 resolved, 5 reduced, 2 accepted-with-log (D1→D364; D16→T22, blocked upstream).
- [~] **Migrated code imports only `react`, `@tanstack/*`, `d3-*` (+ d3-sankey until Stage 1)** — **met in substance, three documented exceptions (D414).** The clause's target is met absolutely: `@visx` appears in 42 legacy chart files and **0** migrated ones. Remaining non-listed imports: `@base-ui/react/progress` (×2) and `@number-flow/react` (×1) are **legacy-shared** — they are what bklit itself renders, so removing them would break the "exact same frontend design" clause that outranks this one; `@use-gesture/react` (×1) is the sanctioned `@visx/zoom` replacement; `geojson` is type-only and elided at build; `react-dom` is `createPortal`. Package *manifests* were deliberately left untouched (D392): `@visx/zoom` still feeds `showcase/repos/bklit-ui`, which is impl-A of every QA comparison, so uninstalling it would break the measuring instrument. Uninstall is Stage 2.
- [x] **`research/README.md`, `docs/phase-5/*`, LOG updated** — LOG at 57 entries; `PROGRESS.md` all 12 rows terminal; `BATCH-ORDER.md` parked list fully dispositioned (3 fixed, 2 blocked on gate-author approval, 2 accepted as debt, 4 declined, 1 resolved as an instrument issue); `captures/5-3-5-final-matrix.md` written; census appended to `research/phase-5/03-dependencies-and-packaging.md`.

---

## Closure — section by section

| § | Outcome |
|---|---|
| **5.0.1** Re-vendor | **DONE (D359).** Pinned exact at `@tanstack/charts@0.15.0` + `@tanstack/react-charts@0.15.0` — above the `≥0.14` target. Supersedes D238. `showcase/node_modules/@tanstack/charts/dist/` is the authority; `showcase/repos/**` is a stale v0.14.0 clone retained only as QA impl-A. |
| **5.0.2** Breaking-change sweep | **DONE (D360).** Compat matrix in `research/phase-5/06-upgrade-compat.md`; zero fallout — 43/43 distinct gates held. |
| **5.0.3** Baseline | **DONE.** `docs/phase-5/BASELINE.md` — the reference every later gate is read against. |
| **Gate 5.0** | **GREEN.** |
| **5.1.1** Research drift check | **DONE (D369).** `research/phase-5/07-pin-check.md`. |
| **5.1.2** Upstream engagement | **NOT DONE — terminal by this plan's own wording (D413).** "Optional, user-approved only … do not file without approval." No approval given, nothing filed. The paint-server-resources RFC is drafted and ready; the sunburst label-channel RFC is moot while D405's blocker stands. |
| **5.2.1** Go-to-plan | **DONE.** 22-task table; all five pre-implementation rulings logged, including the one this document left open — **Gauge linear: FIX (bring under `<Chart>`)**, decided on `research/phase-5/08-gauge-linear.md`, implemented in D363, and gated at a literal `diffPixels: 0` of 960000 on all four probes. |
| **5.2.2** Batch ordering | **DONE (D372**, with **D370/D371** for B0 scope and **D373** for the T13/B4 re-scope). `docs/phase-5/BATCH-ORDER.md` is canonical. The expected B0–B8 shape sketched above was adjusted as the section invited ("adjust freely"); the dependency rule — nothing enters a batch whose prerequisite isn't gated green — held throughout. |
| **5.3.1** Baseline | **DONE** — satisfied by 5.0.3; first used in anger by the B0 gate (D376). |
| **5.3.2** Implementation | **DONE — B0–B8 all closed.** |
| **5.3.3** Gate | **DONE** — every batch gated; full 45-run roster re-gated at 5.3.5 (D407). |
| **5.3.4** Staleness rule | **IN FORCE THROUGHOUT, NOW SPENT.** One deliberate exception, logged: 5.3.5's census *appended to* `research/phase-5/03-dependencies-and-packaging.md` (D406). The rule forbids re-consulting research as a source of truth for already-touched code; it does not forbid updating research to record the end state. |
| **5.3.5** Final pass | **DONE — GREEN (D406–D415).** |

### What is left, and who owns it

| # | Item | Owner |
|---|---|---|
| 1 | **Hover-capture timing race** in `qa/screenshot.mjs` (`HOVER_WAIT_MS = 700`, `:109-111`) — the single root cause behind both known-failing baselines. Fix is to capture on a settled-hover signal instead of a fixed wait. | **Gate author** — protected harness file, never edited here. D402 §4 ranks it highest-value. |
| 2 | **D395** — second `qa/screenshot.mjs` item. | **Gate author** — same protection. |
| 3 | **5.1.2 RFC filing** — paint-server resources / documented `url(#id)` contract. | **User** — explicit approval required by this plan. |
| 4 | **Stage 2 (legacy sunset)** — uninstall `@visx/*` from manifests once `showcase/repos/bklit-ui` is no longer QA impl-A (D392); widen `parse-aspect-ratio.ts:3` to reject a non-positive numerator, which hardens all four height sites at once (D412); tighten `geojson` to `import type` (D414). | **Next phase.** |
