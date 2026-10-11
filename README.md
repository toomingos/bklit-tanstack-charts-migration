# bklit-ui → TanStack Charts Migration

Proof-of-concept: [bklit-ui](https://github.com/bklit/bklit-ui) chart components reimplemented natively on [TanStack Charts](https://github.com/TanStack/charts) 1.1, keeping bklit's public compound-component API, visual design, animation timing, hover, focus and keyboard behaviour.

**Live Showcase: https://bklit-tanstack-charts-migration.vercel.app**

## Status

Phase 8 (native rewrite on TanStack Charts 1.1) is functionally complete. Every chart is built from `defineChart` compositions of built-in marks, layouts, `states`, `motion()` and the native interaction controller. Custom machinery is limited to what the docs and source show 1.1 cannot express; those cases are written up in [docs/phase-8/UPSTREAM-GAPS.md](docs/phase-8/UPSTREAM-GAPS.md).

- Per-chart status and wave board: [docs/phase-8/PROGRESS.md](docs/phase-8/PROGRESS.md)
- Decision log: [docs/phase-8/LOG.md](docs/phase-8/LOG.md)
- Rules for fixers and agents: [docs/phase-8/FIXER-RULES.md](docs/phase-8/FIXER-RULES.md)

QA is done by observing the charts in Chrome (side-by-side bklit and migrated at 1440 and 390 px, light and dark, hover, keyboard focus, resize). Performance is read from the **Live Perf panel** under every chart on the showcase (load, entrance, settle, React render cost, hover and interaction latency, steady-state cost), measured live in the viewer's browser for both implementations.

## Layout

```
bklit-tanstack-charts-migration/
├── showcase/                  # Next.js 15 app (port 5200): every route renders bklit and migrated side by side
│   ├── app/charts/<route>/    # one page per chart
│   ├── components/demos/      # per-chart demo configs, dual-rendered
│   ├── components/live-perf/  # Live Perf panel (collector, probe, panel)
│   ├── migrated/charts/       # the migrated charts (@showcase/migrated-charts)
│   │   └── kit/               # shared kit (cartesian, polar, motion, entrance, size, tooltip, legend, loading, pattern); one folder per chart family beside it
│   ├── packages/bklit-charts/ # re-export of bklit's own charts (@showcase/bklit-charts)
│   └── repos/                 # gitignored clones: bklit-ui (read-only reference)
├── docs/phase-8/              # PROGRESS.md, LOG.md, UPSTREAM-GAPS.md, FIXER-RULES.md
└── scripts/                   # clone-repos.sh, vercel-build.sh
```

`showcase/migrated/charts/index.ts` exports bklit's public chart API only. `@tanstack/charts` and `@tanstack/react-charts` are pinned to 1.1.0.

## Getting started

Requires Node ≥ 20 and pnpm.

```bash
git clone https://github.com/<you>/bklit-tanstack-charts-migration.git
cd bklit-tanstack-charts-migration/showcase
bash scripts/clone-repos.sh      # clones bklit-ui into showcase/repos (required)
pnpm install
pnpm dev                         # http://localhost:5200
npx tsc --noEmit -p .            # type check
pnpm build                       # production build
```

Open any `/charts/<route>`; the Live Perf panel under the charts compares the two implementations.

## What this is NOT

- NOT a PR against [bklit/bklit-ui](https://github.com/bklit/bklit-ui)
- NOT an official bklit product
- NOT a replacement for the bklit Studio (proprietary)
- IS an independent exploration of TanStack Charts as a rendering backend for bklit's chart API

## License

MIT — see [LICENSE](LICENSE). Original bklit chart components are MIT licensed; migration code is original work also MIT licensed.
