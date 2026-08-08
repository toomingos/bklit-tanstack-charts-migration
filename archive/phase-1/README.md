# archive/phase-1 — Frozen Phase 1 evidence (2026-08-07)

- `bench-results/manifest.txt` — listing of `bench/results/<timestamp>/` dirs at freeze (438 entries).
- `bench-results/bundle-sizes.json` / `bundle-sizes-phase-1.json` — bundle manifests at freeze.
- `qa-results/manifest.txt` — listing of `qa/results/<chart>/` at freeze.


- `migrated/` — snapshot of `showcase/migrated/` at freeze (Phase 1 charts, 64 internal helpers).
- `packages/` — snapshot of `showcase/packages/` (source-only wrappers `@showcase/bklit-charts`, `@showcase/migrated-charts`).

Raw `bench/results/<timestamp>/results.json` are git-tracked and remain in `bench/results/` (438 files). This manifest plus `docs/BENCHMARKS-phase-1.md` / `docs/phase-1/BENCHMARKS.md` reproduces the frozen report. `qa/results/` are gitignored; re-QA writes to `qa/results/` (live).
