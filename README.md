# bklit-ui → TanStack Charts Migration

Proof-of-concept: all 17 bklit-ui chart components reimplemented using [TanStack Charts](https://github.com/TanStack/charts) as the rendering backend, with 1:1 API compatibility, visual parity (≤0.5% pixel diff), and substantial performance gains.

## Quick Results

| Metric | Result |
|---|---|
| Charts migrated | 17 / 17 |
| Visual QA (Q1) | All PASS (≤0.5% pixel diff) |
| API compatibility (Q2) | All PASS |
| Avg mount time improvement | ~2.2× faster than bklit |
| Avg heap reduction | ~25% less memory |
| Benchmark gates (G1–G4) | All PASS (gap count: 0) |

[Full per-chart status →](docs/PROGRESS.md) | [Benchmark tables →](docs/BENCHMARKS.md) | [Decision log →](docs/LOG.md)

## What is this?

An independent migration harness that reimplements every bklit-ui chart component using TanStack Charts. The goal: prove that TanStack Charts can serve as a drop-in rendering backend while preserving bklit's API surface, visual design, and interactivity — with better performance.

## Architecture

```
bklit-tanstack-charts-migration/
├── migrated/charts/      # 17 migrated chart implementations (TypeScript)
│   └── internal/         # 64 shared helper modules
├── packages/             # Source-only wrapper packages (bklit-charts, migrated-charts)
├── bench/                # Benchmark harness (Playwright + Vite)
│   └── app/src/scenarios/  # One scenario per chart per impl
├── qa/                   # Visual parity QA pipeline (pixelmatch screenshots)
├── showcase/             # Side-by-side live demo app (Next.js, port 5200)
├── research/             # Phase 0: chart inventories, stack comparison, gate definitions
└── docs/                 # PROGRESS.md, LOG.md, BENCHMARKS.md
```

**repos/** (gitignored) — read-only clones of `bklit/bklit-ui` and `TanStack/charts` used as implementation reference.

## Getting Started

Requires **Node ≥ 18** and **pnpm ≥ 9**.

```bash
git clone https://github.com/<you>/bklit-tanstack-charts-migration.git
cd bklit-tanstack-charts-migration

# Clone reference repos (required)
bash scripts/clone-repos.sh

# Install root tooling (Playwright, pixelmatch, esbuild)
pnpm install

# Install benchmark app dependencies
pnpm --dir bench/app install

# Run all benchmarks
pnpm bench -- --all

# Run all visual QA tests
pnpm qa -- --all

# Launch showcase app (requires showcase/ deps — see showcase/README)
cd showcase && npm run dev
```

## Gate Definitions

| Gate | Description | Threshold |
|---|---|---|
| Q1 | Visual parity (pixelmatch) | ≤ 0.5% differing pixels |
| Q2 | API compatibility | Zero type errors + zero console errors |
| G1 | Performance improvement | ≥ 20% on M1a/M3a/M3c |
| G2 | Closeness to native TanStack | Gap-closure ratio ≥ 0.6 |
| G3 | Steady state (idle CPU) | ≤ 50% of bklit, within 2× of native |
| G4 | Memory/bundle | ≤ 10% over bklit |

Full gate specifications: [research/05-qa-and-benchmark-gates.md](research/05-qa-and-benchmark-gates.md)

## What this is NOT

- NOT a PR against [bklit/bklit-ui](https://github.com/bklit/bklit-ui)
- NOT an official bklit product
- NOT a replacement for the bklit Studio (proprietary)
- IS an independent exploration of TanStack Charts as a rendering backend for bklit's chart API

## License

MIT — see [LICENSE](LICENSE). Original bklit chart components are MIT licensed; migration code is original work also MIT licensed.
