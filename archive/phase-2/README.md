# archive/phase-2 — Frozen Phase 2 evidence (2026-08-08)

- `bench-results/manifest.txt` — listing of `bench/results/<timestamp>/` dirs at freeze (459 entries, tag `phase-2-complete-2026-08-08`).
- `bench-results/bundle-sizes.json` / `bundle-sizes-phase-1.json` / `bundle-sizes-phase-2.json` — bundle manifests at freeze.
- `qa-results/manifest.txt` — listing of `qa/results/<chart>/` at freeze (per-chart image + json).
- `migrated/` — snapshot of `showcase/migrated/` at freeze (Phase 2 charts, 67 internal helpers: +bar/candlestick/scatter FocusStrategy).
- `packages/` — snapshot of `showcase/packages/` (source-only wrappers).
- `docs/` — snapshot of `docs/BENCHMARKS.md` + `docs/PROGRESS.md` + `docs/LOG.md` at freeze (also `docs/phase-2/` + `docs/BENCHMARKS-phase-2.md` etc).

Raw `bench/results/<timestamp>/results.json` are git-tracked and remain in `bench/results/` (459 files). This manifest plus `docs/BENCHMARKS-phase-2.md` / `docs/phase-2/BENCHMARKS.md` reproduces the frozen report.
