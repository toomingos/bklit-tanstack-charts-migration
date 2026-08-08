# Migration Progress Tracker — Phase 3

> **Phase 1** is frozen — see `docs/phase-1/PROGRESS.md` (17/17 charts approved, tag `phase-1-complete-2026-08-07`). **Phase 2** is frozen — see `docs/phase-2/PROGRESS.md` (15 charts re-gated, tag `phase-2-complete-2026-08-08`). This file tracks **Phase 3** only.

Source of truth for status: this table. Update status/QA/benchmark columns as work proceeds; log decisions and rationale in `docs/phase-3/LOG.md`, not here.

## Phase 3 — (define scope in PLAN-phase-3.md)

_Work not yet scoped. Fill this section when Phase 3 planning begins — link the PLAN doc and list charts or initiatives._

| # | Chart / Initiative | Audit | Plan | Refactor | QA (Q1/Q2) | Benchmarks (G1–G4) | Notes |
|---|---|---|---|---|---|---|---|
| — | _TBD_ | — | — | — | — | — | — |

## Research tracker

| Step | Description | Status | Output |
|---|---|---|---|
| — | _TBD_ | — | — |

## Legend

**Phase 3 status values**: `not started` → `auditing` → `planned` → `refactoring` → `QA` → `benchmarking` → `approved` — or `blocked`.

**QA gates** (research/phase-1/05-qa-and-benchmark-gates.md §QA):
- **Q1 — Visual parity**: ≤ 0.5% differing pixels per screenshot.
- **Q2 — API compatibility**: public props/callbacks typecheck with zero runtime console errors.

**Benchmark gates** (research/phase-1/05-qa-and-benchmark-gates.md §Benchmark gates; `B`=bklit, `T`=native TanStack, `M`=migrated):
- **G1 — Improvement**: `M` beats `B` on M1a/M1c/M2a/M3a/M3c, ≥20% on M1a/M3a/M3c.
- **G2 — Closeness**: `(B−M)/(B−T) ≥ 0.6` on M1a/M3a/M3c (waived if no native `T`).
- **G3 — Steady state**: M2a ≤50% of `B`, within 2× of `T`.
- **G4 — Memory/bundle**: M2b/M2c ≤110% of `B`.

Phase 3 gates are identical to Phase 2 (research/phase-1/05 is frozen ground truth). Waivers require lead ruling in `docs/phase-3/LOG.md`.
