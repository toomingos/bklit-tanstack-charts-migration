# Phase 6 — Decision log

Numbering continues from Phase 5 (last: D415).

| # | Decision | Context |
|---|---|---|
| D416 | **Baseline inherited, not re-run.** Phase 6 references `docs/phase-5/BASELINE.md`, the final QA matrix `docs/phase-5/captures/5-3-5-final-matrix.md`, and `bench/results/latest.json` as-is. No measurement happens until 6.5 (single end gate). | PLAN-phase-6.md "Baseline: inherited". Saves the multi-hour bench/QA cycle that per-batch gating cost in phase 5. |
| D417 | **Standing rule: every "library can't do X" ruling carries a version stamp and expires at the next pin bump unless re-verified.** All phase-5 dead rulings were true at v0.14 and false at 0.15. Applies retroactively: `brush-drag.ts:1-36` NON-VIABLE (2026-08-24, v0.14) is hereby obsoleted at 0.15 — its three arguments are each answered (strip host, `clientToScene`, two-host overview+detail = conformance case 83). | PLAN-phase-6.md §How to Work; research/phase-6/06. |
| D418 | **Census scope ruling.** Reach-in = JS/TS code addressing renderer-owned DOM (queries, `ts-chart__`/`data-ts-key` literals, mutations on renderer nodes incl. elementMap-mediated ones). Baseline = 259 sites (research/phase-6/08). CSS in `styles.css` targeting `ts-chart__*` is a sanctioned styling surface (themes-and-styling.md) and excluded; authored custom marks stop aliasing `ts-chart__*` names (renamed `bkm-chart__*` in C5) so the CI grep guard can be a clean zero over `*.ts,*.tsx`. Named exceptions (D420, conditional choropleth fallback) are grep-guard-excluded by exact path. | research/phase-6/08 census. |
| D419 | **S7 folded into commit C1.** Legend coupling and mark states are one mechanism (focus-driven styling); S1's deletions remove the exact functions legend effects call, so a separate S7 commit cannot typecheck. Ladder is 6 commits. | research/phase-6/go-to-plan.md collision check. |
