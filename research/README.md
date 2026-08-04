# Research folder — bklit-ui → TanStack Charts migration

Structure (set by Fable, filled by research agents):

- `01-bklit-ui-inventory.md` — every chart in bklit-ui, its inner components, interactivity features, and full public component API (props, types, defaults) for backwards compatibility post-migration.
- `02-tanstack-charts-inventory.md` — TanStack Charts equivalents: marks, chart grammar, adapters (react-charts), components and their APIs; mapping table bklit chart → TanStack primitives; gaps where no equivalent exists.
- `03-stack-comparison.md` — deep map of both stacks: rendering pipeline, reactivity/update model, animation model, interaction/hit-testing model, scale/layout ownership. Core principles of each.
- `04-metrics-and-baselines.md` — metric definitions (time to render, runtime load, onchange/interactivity load & speed), harness design, and baseline numbers for bklit-ui charts and native TanStack charts.
- `05-qa-and-benchmark-gates.md` — deterministic QA spec (bklit-ui 1:1 design parity, headless where possible) and benchmark pass/fail gates per metric for approving a migration.

Sibling folders:

- `../docs/PROGRESS.md` — per-component migration status.
- `../docs/BENCHMARKS.md` — per-component benchmark results vs baselines.
- `../docs/LOG.md` — key decisions, insights, deviations.
- `../bench/` — rerunnable benchmark scripts.
- `../qa/` — rerunnable QA scripts.
- `../repos/` — cloned `bklit-ui` and `tanstack-charts` sources (read-only reference).
