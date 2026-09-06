# Post-phase-7 task list

Written 2026-09-06 at `f3e4f38`, after the 7.5 gate re-run at `3e8092d` (D588).

Phase 7 is closed: 57 item rows read `merged`/`done`, no G row (G1–G33) carries `open`, and
the six-stage gate exits 0. Nothing below is unfinished phase-7 work — every entry is either
deferred by a stamped ruling, outward-facing and gated on the repository owner, or an upstream
gap. This file is the ordered plan for what comes next, and the reasoning for the order.

## 0. Verification snapshot (this document's premise)

Re-measured at `f3e4f38`, not carried from an earlier report:

| Check | Result |
|---|---|
| Working tree | clean apart from the never-commit paths (`.agents/skills/opencode-subagents/*`, `skills-lock.json`, untracked `.agents/skills/ponytail/`) |
| Showcase chart implementation | 27/27 imports resolve to `@showcase/migrated-charts`; zero `bklit-ui` or `@tanstack/react-charts` imports under `showcase/app` or `showcase/components` |
| `npx tsc --noEmit` (showcase) | exit 0 |
| `npx oxlint showcase/migrated showcase/packages` | 0 diagnostics |
| `pnpm test` | tests 240, pass 182, fail 0, todo 58 |
| `npx next build` | exit 0, 28 routes, all prerendered static |
| Barrel | 172 exports from `showcase/migrated/charts/index.ts`, roster-checked by `qa/api-compat` |

`showcase/.next` had been stale since 2026-09-04 (before G18/G33 landed) and was rebuilt for
this snapshot. The build is the only one of these checks that had not been run since the last
code commit.

## 1. The open items

| # | Item | Why it is not phase-7 work | Reference | Gate |
|---|---|---|---|---|
| 1 | `main` has never been pushed — 137 commits ahead of `origin/main` (`7d60a7f`) | outward-facing | — | repository owner |
| 2 | File I7 — height-aware resize: `createChartScene` derives `height` from `width / aspectRatio` (`renderer.js:720`) and its ResizeObserver re-renders on width only (`:187-191`), so a container sized by CSS height never updates the scene | the research doc gates it on "after the phase-7 host lands", which has now happened | `research/phase-7/07-upstream-issues.md` I7; evidence D541 | owner's GitHub account |
| 3 | File I8 — focus-aware axis tick-label opacity, and mark states for point-less area marks | "same gate as I7" | `07-upstream-issues.md` I8; evidence D587 | owner's GitHub account |
| 4 | Bundle-gate ordering defect: `scripts/bundle-gate.mjs` reads `bench/results/bundle-sizes.json`, which the bundle stage rewrites, while the checks stage runs first — checks therefore always read the previous run's leftovers | diagnosed and stamped, no owner assigned in phase 7 | D585 | phase 8 |
| 5 | QA loading-cell scheduling: loading cells run against three siblings, which is what made `arealoading/1000 hover-50` read 24,407 px in the gate and 427 px isolated | deliberately left unruled so the band cannot blind the gate | D588 | phase 8 |
| 6 | G4 — make `showcase/migrated` a workspace package consumed as a package, then drop `@tanstack/charts` / `@tanstack/react-charts` from the showcase root | folded into V5.3, deferred under R7 | PROGRESS G4, D517 | phase 8 |
| 7 | Adopt a fresh bench baseline — `qa/gate/bench-baseline.json` still holds the phase-5 close medians of 2026-08-27 | regeneration is a formal D-entry by the file's own note | BASELINE.md, D584 | phase 8 |
| 8 | Re-pin the 30 stale bundle pins in `bench/results/bundle-gate.json` (stamped 2026-09-05 at `61d6179`, pre-V3.9) | same: a pin change is a D-entry | D585 | phase 8 |
| 9 | Bundle ≤1.10 parity: 41 of 43 cells over | routed to phase 8 under R7 | V5.2 row | phase 8 |
| 10 | G8, G9, G10, G13 — spatialIndex bypassed after mark-state paint; arc state geometry; sunburst focus geometry; `text()` baseline option | stamped UPSTREAM; the package cannot express them at 0.16.0 | D534, D535, D536 | upstream |
| 11 | 58 `todo` tests | their subject exports were deleted because the package took ownership; the todos are the record, not a gap | — | correct as-is |

## 2. Serial order, and why

Dependency order, not size order:

1. **Push `main`.** Everything else references it, and it is the only item where delay carries
   real risk: 137 commits exist on one disk.
2. **File I7, then I8.** After the push, so both repros can cite public commits. I7 first — it
   is the larger gap, and I8's area-mark half reads as a sibling to it.
3. **Fix the instrument (items 4 and 5).** First of the phase-8 work and non-negotiably first.
   Every number produced downstream today is measured through those two defects; re-pinning or
   optimising against a broken instrument bakes the defect into the pins.
4. **G4 (item 6).** Before any measurement, because it changes the module graph the bundle stage
   measures. After re-pinning would mean re-pinning twice.
5. **Adopt both baselines (items 7 and 8) in one D-entry.** Now the harness is honest and the
   graph is final. Stamping a baseline before steps 3 and 4 produces one that must be discarded.
6. **Bundle parity (item 9).** Last, because it is the only genuine optimisation rather than
   instrumentation, and it wants pins that can be trusted.

Items 10 and 11 sit outside this chain. Upstream items move when TanStack moves; the rulings
already say what happens meanwhile.

## 3. Parallel execution plan

The chain above is serial because of *measurement*, not because of the work. The code work
fans out; the gate cannot. All executor and audit work is dispatched through the
`opencode-subagents` skill, `run_in_background: true`, one `run.sh` call per agent, all calls
in the same message.

### Standing constraints on delegation

- Executors never run `gate:probes`, `run-qa`, `run-all`, or start preview servers. Gates are
  lead-only, serial, in a frozen worktree. Parallel machine load is exactly what produced D588.
- Agents own disjoint files (principle 6). No two concurrent agents may touch the same path.
- The watchdog ends a run at 45 minutes total, or 15 minutes without output. Scope tasks under it.
- Run `run.sh --limits` before each batch. A provider 429 does not end a run — it retries every
  15 minutes silently, and G24b was lost to one. If anything is listed as waiting, wait for the
  stated next-try time rather than queuing more agents behind the same limit.
- One reviewed commit per item, lead-reviewed. No half-landed vectors.

### Wave 0 — lead, foreground, owner-gated

Items 1, 2, 3. Not delegable and not blocking: agents work locally, so Wave A launches
concurrently with this.

### Wave A — 3 agents in parallel

| Agent | Owned files | Task |
|---|---|---|
| `A3 g4-workspace-pkg` | `showcase/package.json`, `showcase/tsconfig.json`, `showcase/next.config.mjs`, `qa/unit/lib/render.mjs`, new package manifest | item 6 |
| `A1 bundle-gate-order` | `scripts/bundle-gate.mjs`, `qa/gate/run-all.mjs` | item 4 |
| `A2 qa-loading-schedule` | `qa/screenshot.mjs` | item 5 |

No shared path between the three. A3 is the long pole and the riskiest; launch it first within
the batch so it takes the head start. A1 and A2 are small.

Lead, while they run: review and commit each as it lands. No gate yet — gating before A3 lands
means gating twice.

### Gate 1 — lead only, serial

`pnpm gate:all -- --bench all --probes --issues` in a frozen worktree, nothing else running on
the machine. The bare `pnpm gate:all` defaults to `--bench paired` with no probes and is not
the 7.5 gate. This is the first measurement taken through a fixed instrument on the final
module graph.

### Wave B — lead only

Items 7 and 8, adopted together in one D-entry from Gate 1's numbers. Not delegated: principle 5
puts the count re-run and the stamp with the lead.

### Wave C — 4 executors plus 1 auditor, in parallel

Item 9, partitioned so no two agents share a file:

| Agent | Families |
|---|---|
| `C1` | area, line, bar, composed |
| `C2` | pie, ring, radar, gauge, sunburst |
| `C3` | heatmap, sankey, choropleth, funnel |
| `C4` | candlestick, scatter, live-line, loading variants |

Each proves its change with a local esbuild measure of its own modules. No gate, no server.

Alongside them, one read-only audit agent re-censuses what G4 actually removed. Audits never
conflict — they only read. The expectation to test is that the 41/43 count drops sharply once
the showcase stops pulling the package in twice; that expectation must be measured before four
agents spend an hour optimising cells that may already pass.

### Gate 2 — lead only, serial. Close.

## 4. Shape of the result

Three batched dispatches and two gates, against six serial items. The gates are the floor: they
do not compress, and compressing them is the whole content of D588.

## 5. Definition of done

- Items 1–3: `origin/main` at the pushed head; two issue numbers recorded in
  `research/phase-7/07-upstream-issues.md` beside I1–I6.
- Items 4–5: the checks stage reads measurements from the run it belongs to, and
  `arealoading/1000 hover-50` reads its isolated value under a full parallel gate.
- Item 6: `showcase/package.json` carries neither `@tanstack/charts` nor
  `@tanstack/react-charts`, and a clean `pnpm install` followed by `next build` exits 0.
- Items 7–8: both baseline files regenerated, each with a D-entry naming the run.
- Item 9: the bundle stage reports the surviving over-1.10 count, whatever it is, against
  re-pinned values — a measured number, not a target.
