Original Goal and Fundamental principles:
"Migrate bklit ui charts to tanstack charts
I want to migrate bklit ui charts to tanstack charts with the following critical rules:
- Same desing, animations and components api
- 1st: Start with the Tanstack chart. 2nd: Add bklit-ui design on top of Tanstack chart native backend. 3rd: Add bklit-ui interactivity features
- Migrate with identical compoennt bklit ui charts API/Prop strucuture
- Gains should me measured in performance gains:
  - Time to render
  - Runtime load
  - Onchange and interactivity load/speed"

For research use context7 mcp, fallback to web search tool

# PHASE 3 GOALS

- Harden migrated charts; close ALL remaining bklit utility gaps on TanStack-native backend.
- Design, animations, API 1:1 — no missing props, no silent drops.
- shadcn dynamic: thin bklit design layer over headless TanStack backend (radix/base-ui model).
- One standardized impl per utility, one import path, zero per-chart forks.
- Scope: 12 initiatives in `docs/phase-3/PROGRESS.md` — that table is the source of truth.

# ARCHITECTURE CONTRACT

- Design layer uses only TanStack public API — never internals, deep imports, rendered-DOM patching.
- One design-tokens module owns all magic values (springs, `1100ms bezier`, `FAN_ANGLE 160°`, offsets).
- Migrated prop types `satisfies` bklit's verbatim; shared fixtures render on both backends.
- Pin TanStack version; upgrades = version bump + gate run.
- Contract lives in `research/phase-3/00-layer-contract.md`; every plan doc must respect it.

# GATES — frozen, run ONCE per initiative, cross-chart

Order cheap→expensive; stop at first failure:
1. **Q3 boundary**: lint/dep-cruiser — no deep imports, no DOM reach-ins. Seconds.
2. **Type-parity**: prop types `satisfies` bklit verbatim; `tsc` clean.
3. **Q2 API**: dual-backend fixtures run, zero console errors.
4. **Q1 visual**: `qa/screenshot.mjs`, ≤0.5% pixels, ALL affected charts.
5. **G1–G4 benchmarks**: `bench/run.mjs`, affected charts only; reuse frozen B/T baselines, re-measure M only.

Definitions frozen in `research/phase-1/05-qa-and-benchmark-gates.md` (G1≥20% M1a/M3a/M3c, G2≥0.6, G3≤50%B/≤2×T, G4≤110%). Waivers: lead ruling D200+ in `docs/phase-3/LOG.md`. M1b parity 1100ms; D73/D12/D16 waiver classes carry.

# PHASE 0 — RESEARCH (orchestrator delegates, sub-agents execute)

- 0.0 ✅ docs scaffolding (`PROGRESS/BENCHMARKS/LOG` D200+).
- 0.1 Bash-copy `research/phase-2/inventory/01-04` → `research/phase-3/inventory/` verbatim; append D137–D146 post-freeze delta note.
- 0.2 One sub-agent: catalog consolidated internals + deferred chrome families → `inventory/05-06`. Write layer contract doc yourself.
- 0.3 Launch 12 audit sub-agents IN PARALLEL (one per initiative, single message). Each flags:
  - Non-native patterns with direct TanStack equivalent (`focus`, `guides`, `colorLegend`, `spatialIndex`, `renderTooltipBody`).
  - Wrappers/extra steps with native equivalent (manual ResizeObserver, sibling gradient svg, duplicated springs).
  - Broken/unreliable flows (stale hover deps, StrictMode WAAPI cancel, xForIndex drift).
  - Design/animation mismatches vs bklit — must be 1:1 (Q1 0.5%).
  - **Contract violations**: internals reach-ins, deep imports, rendered-DOM queries.
  - Sources: phase-3 inventories, `research/phase-2/bklitui-native` + `tanstack-native`, migrated code; legacy repos to verify.

# PHASE 1 — LOOP, one initiative at a time

Order foundations-first (1 tokens/internals → 2 sizing/contexts → 3 grid/reveal → 4 tooltip → 5–12) so later work never re-touches gated utilities.

- 1.1 Pick next open initiative in `PROGRESS.md`; set todos.
- 1.2 **Synthesize** (you): audits → `research/phase-3/plans/<initiative>/plan-loop-N.md`. Verify unknowns via context7 (`.commandcode/skills/find-docs/SKILL.md`) or sub-agent scripts with honest-output instructions. NEVER ASSUME.
- 1.3 **Implement** (one sub-agent, detailed instructions): build the single utility AND propagate to every consumer, deleting per-chart forks — one task, one diff.
- 1.4 **Review** (you): read the diff; agents find loopholes — verify work, don't trust reports.
- 1.5 **Gate** once, cross-chart, in gate order above.
  - Pass: log keys-to-success D200+ in `LOG.md`, mark approved, go to 1.1.
  - Fail: quick fixes allowed; if exhausted, log learnings, return to 1.2. Never skip ahead.

# ORCHESTRATION RULES

- You synthesize, review, gate. Sub-agents audit, implement, script-verify.
- Batch independent sub-agents in one parallel launch; sequential only when dependent.
- Tests run once at the gate, never per sub-step; re-run failures only.
- Explore agents for codebase questions; never re-derive what audits already established.
