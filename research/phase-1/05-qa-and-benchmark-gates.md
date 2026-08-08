# 05 — QA & Benchmark Gates

Status: **spec authored (Fable)** — scripts to be implemented by agents, reviewed by Fable.

## QA: design parity (bklit-ui 1:1)

Headless, deterministic, scriptable:

### Q1 — Visual parity (pixel diff)

- Reuses the bench app: render `impl=bklit` and `impl=migrated` for the same chart/n/seed at 1200×800, dpr 1, headless Chromium.
- Screenshot at **settled** state (after `__benchSettled`), plus interaction states: hover at 3 fixed plot coordinates (tooltip visible), legend-hover dim state, brush mid-drag where applicable.
- Compare with `pixelmatch` (threshold 0.1, `includeAA: false`).
- **Gate: ≤ 0.5 % differing pixels per screenshot** (fonts/AA tolerance). Diff images written to `qa/results/<chart>/` for human review on failure.
- Animation feel: capture 6 frames at fixed timestamps during the mount reveal (0/100/250/500/750/1000 ms via CDP screencast) — compared loosely (≤ 5 % differing pixels per frame) to confirm reveal direction/ordering matches; exact motion curves are reviewed by eye, not gated.

### Q2 — API compatibility (headless, type-level)

- `qa/api-compat/`: one TSX fixture per chart exercising the documented public props from research/01 (all props, callbacks, composition children).
- The fixture must typecheck against the **migrated** component with `tsc --noEmit`. Runtime smoke: fixture renders without errors/warnings in jsdom (or the bench page).
- **Gate: typecheck passes with zero errors; zero runtime console errors.**

## Benchmark gates (per chart, per data size)

Let `B` = bklit baseline, `T` = native TanStack baseline (performance ceiling), `M` = migrated, for each metric (lower is better; for M3b FPS, higher is better — invert).

- **G1 (improvement)**: `M` beats `B` on every metric: M1a, M1c, M2a, M3a, M3c. Required improvement ≥ 20 % on at least M1a, M3a and M3c (the north stars), and no metric regresses vs `B` by more than 5 % (noise band).
- **G2 (closeness, when `T` exists)**: gap-closure ratio `(B − M) / (B − T) ≥ 0.6` on M1a, M3a, M3c — i.e. the migration closes at least 60 % of the bklit→TanStack gap. If `M` beats `T`, ratio counts as 1.
- **G3 (steady state)**: M2a idle CPU ≤ 50 % of `B`'s (bklit's always-on animation loops are a known cost; migrated charts must be near-quiet at rest, within 2× of `T`).
- **G4 (memory/bundle)**: M2b and M2c must not exceed `B` by more than 10 %.
- Charts with **no native TanStack equivalent** (custom marks): G2 waived; G1 + G3 + G4 still apply, and Fable logs a rationale in docs/LOG.md.

**A migration is approved only when Q1 + Q2 + G1–G4 all pass, from scripts, on the same run.** Failures loop back per PLAN Phase 2 steps 2.4/2.5.

## Runner entry points (to implement)

- `pnpm bench <chart> [--impl ...] [--n ...]` → JSON + table row
- `pnpm qa <chart>` → parity screenshots + diff report + api-compat typecheck
- `pnpm gate <chart>` → evaluates gates from latest bench+qa results, prints PASS/FAIL per gate
