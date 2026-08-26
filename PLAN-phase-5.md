# Plan Phase 5

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

You are the key decision maker and manager. You orchestrate sub agents (explore for research, executor/cmd for bulk work — see `/cmd-executor` skill). Verify gate math independently; agents omit failures. Log every accepted deviation as a `D<next>` entry in `docs/LOG.md`.

---

## Phase 5.0: Upgrade (NEW — the unlock)

### 5.0.1 — Re-vendor

Vendor `@tanstack/charts@<latest stable>` (pin exact); archive the old clone for diffing; update bench aliases + tsconfig paths; LOG entry documenting the pin change (supersedes D238).

### 5.0.2 — Breaking-change sweep

Upstream shipped breaking renames inside minors (v0.7 callback reshape, v0.8 "Harmonize"). Dispatch ONE executor agent: walk every `@tanstack/*` import/subpath in `showcase/migrated/**` against the new version's exports map + changelogs; output a compat matrix (import | status | action) in `research/phase-5/06-upgrade-compat.md`. Fix fallout inline (mechanical renames only — no behavior changes yet).

### 5.0.3 — Baseline

BEFORE any migrated-code behavior changes, capture in `docs/phase-5/` placeholders (create them):

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

## Definition of Done

- All go-to-plan tasks closed or skipped-with-reason (logged, `D` convention)
- Typecheck + build + bench pass; QA parity ≤ recorded baselines everywhere
- D1–D17 ledger reconciled: each marked resolved / reduced / accepted-with-log
- Migrated code imports only `react`, `@tanstack/*`, `d3-*` (+ d3-sankey until Stage 1)
- `research/README.md`, `docs/phase-5/*`, LOG updated
