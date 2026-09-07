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

| # | Item | Why it is not phase-7 work | Reference | Gate | State |
|---|---|---|---|---|---|
| 1 | `main` has never been pushed — 137 commits ahead of `origin/main` (`7d60a7f`) | outward-facing | — | repository owner | **done `e9286ed`** — 150 commits pushed, `7d60a7f..e9286ed` |
| 2 | File I7 — height-aware resize: `createChartScene` derives `height` from `width / aspectRatio` (`renderer.js:720`) and its ResizeObserver re-renders on width only (`:187-191`), so a container sized by CSS height never updates the scene | the research doc gates it on "after the phase-7 host lands", which has now happened | `research/phase-7/07-upstream-issues.md` I7; evidence D541 | owner's GitHub account | **done — [#133](https://github.com/TanStack/charts/issues/133)** |
| 3 | File I8 — focus-aware axis tick-label opacity, and mark states for point-less area marks | "same gate as I7" | `07-upstream-issues.md` I8; evidence D587 | owner's GitHub account | **done — [#134](https://github.com/TanStack/charts/issues/134)** |
| 4 | Bundle-gate ordering defect: `scripts/bundle-gate.mjs` reads `bench/results/bundle-sizes.json`, which the bundle stage rewrites, while the checks stage runs first — checks therefore always read the previous run's leftovers | diagnosed and stamped, no owner assigned in phase 7 | D585 | phase 8 | **done `bfb072b`** |
| 5 | QA loading-cell scheduling: loading cells run against three siblings, which is what made `arealoading/1000 hover-50` read 24,407 px in the gate and 427 px isolated | deliberately left unruled so the band cannot blind the gate | D588 | phase 8 | **done `c252229`** |
| 6 | G4 — make `showcase/migrated` a workspace package consumed as a package, then drop `@tanstack/charts` / `@tanstack/react-charts` from the showcase root | folded into V5.3, deferred under R7 | PROGRESS G4, D517 | phase 8 | **done `8d615fa`** |
| 7 | Adopt a fresh bench baseline — `qa/gate/bench-baseline.json` still holds the phase-5 close medians of 2026-08-27 | regeneration is a formal D-entry by the file's own note | BASELINE.md, D584 | phase 8 | **done `c7d52d0`** — adopted from the 7.6 run (D596); gated flags 9 → 1. `migrated/scatter/1000.m1b` held at the old value: it is a live 1.98× regression (D595), not drift |
| 8 | Re-pin the 30 stale bundle pins in `bench/results/bundle-gate.json` (stamped 2026-09-05 at `61d6179`, pre-V3.9) | same: a pin change is a D-entry | D585 | phase 8 | **done `c7d52d0`** — all 43 pins moved, bundle gate 30 FAIL → 0 (D596). `migrated/barloading` had been pinned at 2449 bytes, a broken measurement rather than a stale one |
| 9 | Bundle ≤1.10 parity: 41 of 43 cells over | routed to phase 8 under R7 | V5.2 row | phase 8 | **done `14f17e5`** — measured at 41/43 against re-pinned values, which is what §5 asks. Target stamped **unreachable at 0.16.0**: the gap is a fixed ~15.9kB gzip d3 tail the package pulls into every chart, and deleting all of it still leaves pie at 1.194 (D597, upstream draft I9) |
| 10 | G8, G9, G10, G13 — spatialIndex bypassed after mark-state paint; arc state geometry; sunburst focus geometry; `text()` baseline option | stamped UPSTREAM; the package cannot express them at 0.16.0 | D534, D535, D536 | upstream | open |
| 11 | 58 `todo` tests | their subject exports were deleted because the package took ownership; the todos are the record, not a gap | — | correct as-is | open |
| 12 | Gate instrument defects — 13 findings from the 2026-09-06 read-only audit of `gate:all`, four of them verdicts that can be wrong rather than slow | items 4 and 5 were two instances; the audit found the rest of the class | §7 below | phase 8, before Gate 1 where noted | open |

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
| `A3 g4-workspace-pkg` | `showcase/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.mjs`, `showcase/migrated/package.json`, deletes `showcase/packages/migrated-charts/`, plus `qa/unit/lib/render.mjs`, `qa/unit/resolver.test.mjs`, `qa/unit/scene.test.mjs`, `qa/curve-parity.mjs`, `qa/gate/run-checks.mjs` line 67 | item 6 |
| `A1 bundle-gate-order` | `scripts/bundle-gate.mjs`, `qa/gate/run-all.mjs`, `run-checks.mjs`, `summarize.mjs` | item 4 |
| `A2 qa-loading-schedule` | `qa/gate/run-qa.mjs`, `qa/gate/lib.mjs` | item 5 |

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

## 6. Execution record — Wave A

Updated 2026-09-06. Wave A is complete. Items 4, 5 and 6 are landed and the tree is green at
`8d615fa`: tsc exit 0, `next build` exit 0 across 28 routes, `pnpm test` 240 / 182 / 0 / 58,
oxlint 0 problems over 428 files.

| Item | Commit | Result |
|---|---|---|
| 4 | `bfb072b` | `run-all` passes `skip:"bundle-gate"` to the checks stage; the bundle stage's fresh measurement is the single verdict. `summarize.mjs` needed no change — `checksIssues` already continued on skipped entries. Standalone `gate:checks` keeps the step and now prints the sizes file's mtime, so a stale read is visible rather than silent. No pin touched. |
| 5 | `c252229` | `runPool` gained an optional exclusivity barrier; loading cells drain alone after the shared phase, roster order preserved, `workers <= 1` byte-identical to before. Measured cost: 2 of 43 jobs, ~13 s on a 174 s stage. |
| 6 | `8d615fa` | `showcase/migrated` is the package, `showcase` is a pnpm workspace, both TanStack deps are gone from the app manifest. Route table unmoved, shared chunk hashes byte-identical. |
| 6 (residue) | `0b82505` | The post-move sweep: three duplicated dependencies dropped from the app, the two d3 `@types` co-located with the runtime deps they describe, and the dead oxlint override, tsconfig pin, `__pack-smoke` directory and `showcase/node_modules/@tanstack` paths removed. |

### Three premises in this document were wrong, and the corrections matter more than the items

**§3's Wave A file table was wrong twice.** Item 5's defect is scheduling, and the scheduler is `runPool`
in `qa/gate/lib.mjs` called from `run-qa.mjs` — `qa/screenshot.mjs` is the per-cell worker and is innocent.
Item 4 needed `run-checks.mjs`, where the stale read actually happens, not just `run-all.mjs`. The table
above is corrected to what was dispatched.

**Item 6 was one instance of a defect that had three.** G4 was described as "the showcase declares
dependencies only the migrated charts use". Two more of the same shape surfaced while landing it:

- Four QA files — `qa/unit/lib/render.mjs`, `resolver.test.mjs`, `scene.test.mjs`, `qa/curve-parity.mjs` —
  reached into `showcase/node_modules/@tanstack/charts/dist/*.js` by relative path, silently relying on the
  app declaring a dependency only the package uses. They now share one `chartsDistUrl` helper.
- `qa/gate/run-checks.mjs` linted `packages/migrated-charts`, the directory G4 deletes. Fixing that exposed
  a worse one: **oxlint given a path that does not exist prints "No files found to lint" and exits 0 with
  `number_of_files` 0**, and `summarizeOxlint` read only the diagnostics array — so a stale target reported
  `0 errors, 0 warnings, ok`. The step now records the file count and fails at zero. This is D585's failure
  mode one seam over: an instrument reading green for the wrong reason. It catches an all-targets-missing
  case only; a surviving target still masks a stale sibling, which is why the dead argument was removed
  rather than left in place.

**`file:./migrated` cannot work, and hoisting must not be used to make it.** pnpm puts a `file:` package's
dependencies only in the hashed virtual store, while tsc and webpack resolve from the source files'
realpath — 399 `TS2307`s. A real `pnpm-workspace.yaml` with `workspace:*` gives the package its own
`node_modules` and resolution succeeds. `.npmrc` hoisting would also have silenced the errors, and was
refused: it lets a package resolve dependencies it does not declare, which is the defect G4 exists to
remove.

### Process notes

The first G4 attempt was reverted, not committed. It did the work correctly and stopped at the two
blockers it had been fenced out of, which is the right outcome, but it left tsc at 399 errors and the
tests at 43 / 0 / 27 / 16. Half a vector is not shippable (principle 6), so its diff was saved, `showcase/`
was restored, `pnpm install` put the deps back, the baseline was re-verified, and items 4 and 5 were
committed against a green tree before G4 was re-dispatched with the blockers named and ownership widened.

Executor verification was treated as input, not proof (principle 5): tsc, `next build`, `pnpm test`, the
lint file count and the empty-target guard were all re-run by the lead before each commit. Three partial
gate run-dirs and an overwritten `qa/gate/latest/` produced by executor verification runs were removed
before committing — a checks-only run must not be committed as if it were a gate.

### The residue sweep, and the one thing it nearly got wrong

Removing a duplicated dependency is only safe against a named importer, so every entry in
`showcase/package.json` was checked against the app, the bklit control and the migrated package
separately. Three had no importer outside `migrated/charts/internal/choropleth-zoom*.ts` and were
dropped: `@use-gesture/react`, `d3-selection`, `d3-zoom`. Everything else stayed with a named importer.

The rule that decided most of the table: **the bklit control has no manifest of its own.** It resolves
out of `showcase/repos/bklit-ui/` through `showcase/node_modules` and the webpack `resolve.modules` entry
in `next.config.mjs`, so its dependencies — the `@visx/*` set, `d3-array`, `d3-scale`, `d3-shape`,
`motion`, `react-use-measure` — must remain declared by the app even though the app itself does not
import them. Breaking the control invalidates every parity claim in the phase, so uncertainty resolves
toward keeping. The near-miss was `motion`: its only app-side occurrence is the string
`"Updated motion to v12"` in `docs-data.ts`, not an import — and 87 bklit files import it for real.

`@types/d3-selection` and `@types/d3-zoom` are the case worth remembering. Removing them from the root
alone gives `TS7016` x4, and the first reading of that was "the root is their only source, leave them".
It is not: nothing declared them beside the one file that needs them, and the package manifest already
carried `@types/geojson` as the precedent. They moved into the package. Left at the root they would have
kept G4 half-applied on its own axis — the package owning a runtime dependency while the app still owned
its types.

Nothing under `docs/` or `research/` was touched. A reference to `packages/migrated-charts` in a D-entry
is correct history, not stale code. The tracked `qa/gate/latest/` files still quote the old lint command
from the 2026-09-05 run; that is a run record, and it refreshes at Gate 1 rather than by hand.

### Still open

Wave 0 (items 1–3) is closed. `main` is pushed at `e9286ed` (150 commits, `7d60a7f..e9286ed`);
I7 is [TanStack/charts#133](https://github.com/TanStack/charts/issues/133) and I8 is
[#134](https://github.com/TanStack/charts/issues/134), both citing the now-public commits.

Gate 1 ran at `4ee2ef6` (`docs/phase-7/gate/runs/2026-09-06T23-56-04-812Z`, exit 0, 47m44s) and
found one real regression — the pulse area painting its wash — fixed and re-shot in `e9286ed`.
Everything else it reported is pre-existing or harness noise; the attribution is D593.

**Since Gate 2, three vectors have landed and one premise in §1 has been corrected.**

- **Brush layer inversion** (`425a1c6`, D612). `ChartHost` imported `BrushLayer` statically behind a
  runtime gate, so every host-mounting chart shipped `d3-brush` and its d3-transition/selection/
  drag/dispatch/timer graph. `ChartBrush` now owns the layer. Measured over the full 104-combo
  sweep: 41 of 43 migrated scenarios drop ~21 kB gzip, `migrated/brush` pays +446 bytes, no
  `bklit/*` or `tanstack/*` combo moves.
- **Probe dim fidelity** (`e627113`, D614). Multi-channel dim predicate and a union scope, plus a
  pre-hover baseline in `legend-hover-dim`. Flagged rows 4 → 2 there; in `hover-lag` the `sankey`
  and `liveline` presence mismatches resolve into real detection. Probe-side only, no chart change.
- **Item 9's reasoning is withdrawn** (D613). D597 blamed the package for the unconditional d3 tail
  and drafted I9 on that basis. Both of its named examples were **our own importers**: `d3-brush`
  came in through `chart-host.tsx:31`, and `d3-time-format` still comes in through
  `chart-host-store.ts:1` (`scaleTime`), called unconditionally at `chart-host.tsx:229`. The ≤1.10
  count moved 2/43 → **16/43** on the brush fix alone, so D597's "no arrangement of the consuming
  code closes this gap" is disproved. The **ruling** stands — 27 of 43 are still over, sunburst at
  1.3696 — but the row above must be read with D613's reasoning, not D597's. **I9 is withdrawn as
  drafted and was never filed**, which is the only reason this cost nothing outward-facing.
  Rewriting it requires landing the `buildTimeScale` fix first and then re-measuring what is left.

**Two further items closed since, both by measurement rather than argument.**

- **`choropleth/100` is not a parity defect** (D617). It was the last open dim flag and the one
  candidate for a genuine chart difference. A live DOM read on both impls found two *instrument*
  defects instead: under `openScene`'s virtual clock legacy's framer-motion mount barely advances,
  so all 177 bklit feature paths sit at composed opacity **0.046** while the probe reports settled;
  and `dimmedCount` never composes ancestor opacity, so it scored those invisible paths as undimmed
  and 177 fully-visible migrated paths as dimmed. Re-read under real time, bklit composes to 0.850
  against migrated's baked-in 0.85 and the max channel delta falls **109 → 10**. The residual is a
  real compositing difference — legacy fades the group, migrated bakes alpha per feature via
  `withAlpha` at `choropleth-chart.tsx:232` — but bounded at 10/255, which is why the pixel gate
  passes on its own terms. No ruling; the two instrument defects are the actionable part.
- **The `MarkerLayer` inversion is rejected** (D618). It looked like `425a1c6` one layer down, and
  the motivating claim was that one constant import drags ~14 modules (reachable count 27 → 13).
  Measured upper bound — import deleted outright, which no design can beat — is **−860 gzip on pie**,
  −727 gauge, −805 choropleth, −781 ring. The premise was false: esbuild shakes per declaration and
  `sideEffects` is CSS-only, so the 14 modules are in the graph and emit nothing. 27 → 13 was a
  module-graph count, not bytes — the same `metafile.inputs` error D612 warned about, one level up.
  A leaf-constant split moved raw bytes by **0** on three of five scenarios. Closed, nothing landed.

Still open: the `buildTimeScale` removal — now scoped by measurement to **+14,741 raw / +4,473 gzip
on 18 of 43 scenarios**, not all of them, because 25 already pull the identical `d3-time` graph via
`scaleUtc` in their own definition modules (marginal saving there: 32 bytes); the `markers/100`
legend-hover-dim and `candlelegend` magnitude flags; V6, V7/I10; and a full Gate 4. Wave B and
Wave C as written above are otherwise next.

## 7. Gate audit — 2026-09-06, read-only

An audit agent read the ~4,000 lines of the gate surface (`qa/gate/*`, `qa/gate/probes/*`,
`qa/screenshot.mjs`, `bench/run.mjs`, `bench/measure-*.mjs`, `bench/report.mjs`,
`scripts/bundle-gate.mjs`) plus D585 and D588, ran no gate and started no server, and reported
against three questions: what is redundant, what is dead time, and what is unsound. The framing
that produced the useful half was the fourth instruction — D585 was a stage reading a file a later
stage rewrites, so find the rest of that shape.

It found three more instances of it. That is the finding: item 4 was not a defect, it was a class.

### Correctness — a verdict that can be wrong

The first four were re-verified by the lead against the source before this was written; they are
not taken on the agent's word.

| # | Defect | Evidence | Consequence |
|---|---|---|---|
| A1 | Bench M2c reads the previous run's bundle sizes | `bench/run.mjs:40-43` loads `bench/results/bundle-sizes.json` at module load; `run-all.mjs` runs bench (stage 4) before the bundle stage rewrites that file (`run-bundle.mjs:102`) | every M2c cell in `bench.json` is judged against stale bytes, silently — the D585 shape, one stage later |
| A2 | The CSS column is never measured in-gate | nothing under `qa/gate/` invokes `bench/measure-css.mjs`; `run-bundle.mjs:110` reads `css-sizes.json` with a `null` fallback | the CSS table is whatever file happens to be on disk, or absent — a permanent stale read |
| A3 | `pnpm gate:bundle` exits 0 with holes in the table | `run-bundle.mjs:146` fails on `gateExit`/`fail`/`ratioOver` only; `summary.missing` and `summary.measureFailed` do not reach the exit code | a bundle run that measured nothing reports green standalone |
| A4 | `--skip-checks` gives bench and probes an unknown dist | `run-all.mjs:44,48` force `noBuild: true`; only QA honours `--no-build` and rebuilds when stale (`lib.mjs:205-217`) | with checks skipped no build ever runs, and the freshness check is skipped too |
| A5 | `--bench-parallel` runs bench beside QA under one lock | `run-all.mjs:46,49` starts the bench stage before awaiting QA; `lib.mjs:369-373` makes the second `acquireQaLock` a re-entrant depth counter rather than an exclusion | bench claims CPU purity in the same comment that the flag violates — D588-class corruption by construction |
| A6 | Standalone `gate:bench` takes no lock | `run-bench.mjs:164` calls `waitForQuietProcessTable` and never `acquireQaLock`, unlike `run-qa.mjs:45` and `run-probes.mjs:44`; the pgrep pattern (`lib.mjs:99`) does not match a probe run | two harness runs can overlap undetected |
| A7 | The stale-lock breaker watches one port | `lib.mjs:384` breaks the lock when the owner is gone and nothing listens on `QA_PORT`; bench's 5199 preview is invisible to it | a live bench run can have its lock broken underneath it |
| A8 | Dist changing mid-pass is warning-only | `run-qa.mjs:113-115` logs the fingerprint move and still builds the matrix from cells that straddle two builds | a mixed-build verdict is presented as a single-build verdict |
| A9 | Unparsable lint output passes | `run-checks.mjs:20-26` returns `{parseError: true}`; the `files === 0` guard added this morning never fires on `null` | the same green-for-the-wrong-reason mode the guard was written to close, one branch over |
| A10 | Failed bench cells vanish from the report | `run-bench.mjs:196` drops non-zero cells from the rows while counting them in `summary.failedInvocations` | `bench.md` reads as fewer cells rather than failed cells |
| A11 | One ruling bound is wide enough to blind its cell | `rulings.json:10` rules `barloading/100/hover-30` under 161,310 px — 16.8% of the viewport | D588 refused a 24,407 px bound for `arealoading` for exactly this reason; this one predates it and stands |
| A12 | A failed stage renders as "not run" | `run-all.mjs:22-34` records `ok:false` and returns `null`; `summarize.mjs:113-123` renders the missing artefact as "not run" with no issue | the exit code is right, `SUMMARY.md` alone can be misread as clean |
| A13 | A harness that errored but wrote PNGs does not fail | `compare-qa.mjs:198-213` counts `runsNonZeroExit` and excludes it from `gateFail` | a crashed sweep can produce a passing matrix |
| A14 | An asymmetric hover capture destroys the whole cell | `screenshot.mjs:1137` indexes `capB.hovers` by `capA`'s length; bklit/bardepth wires `__qaSetBarPulsePhase` and migrated cannot (D590), so the loop throws | `bardepth/100` produced no report at all — settled comparison included (**fixed, D595**) |

A1–A4 and A9 are cheap and should land before Gate 1, so the first measurement through the fixed
instrument is not itself stale. A11 needs a D-entry, not a patch.

A1–A4, A9 and A11 landed in D594; A14 was found by the re-run itself and fixed in D595. Gate 1 has
been repeated through the fixed instrument (D595), which unblocks items 7 and 8 — with
`migrated/scatter/1000` m1b held out of item 7, since it is a live 1.98× regression against the
in-run bklit control rather than baseline drift. A5–A8, A10, A12 and A13 remain.

### Waste — where the 67m44s goes

Stages: checks 20.7s, QA 2m54s, probes 19m38s, bench 44m39s, bundle 11.9s, summary 40ms.

The redundant-build hypothesis was wrong. `buildDistOnce` holds: checks builds once, QA reuses it
via the freshness check, bench and probes skip. There is no duplicate build inside the gate. The
duplication that exists is latent — `measure-bundle.mjs` and `measure-css.mjs` are ~230 near-identical
lines differing only in whether CSS is stubbed, and each standalone `gate:qa`/`gate:bench`/`gate:probes`
rebuilds and boots its own preview.

What the time actually is, is fixed constants:

- Bench: `IDLE_MS = 5000` per run x 8 runs x 29 cells is ~19m20s of the 44m39s, plus ~4m of hover
  cadence and tooltip settles. Roughly half the gate is one guessed number.
- Probes: `POST_SETTLE_MS = 3000` per scene is ~5m of the 19m38s, plus fixed 1.7s and 1.2s waits.
- QA: ~4-5s of fixed hover and settle waits per cell, divided by 4 workers.

These are arithmetic from the constants, not measurements — an instrumented run is needed to hold
them. None should be shortened without evidence: they are the reason the numbers are stable.

### Parallelism — and where it would buy a wrong number

- Checks fan out safely (tsc, lint, bench-tsc, census share nothing) and save ~10s of 4,064s.
  Worth doing only alongside another checks edit.
- Bundle measurement can overlap the bench tail, but only after A1 is fixed — today the overlap
  would rewrite the file bench is reading.
- Probes must not overlap QA or bench. They assert timing-adjacent quantities through coarse bands,
  which makes tolerance plausible and unproven. D588 showed load moving a pixel count by two orders
  of magnitude. The evidence that would settle it: probes 3x isolated against 3x under bench load,
  identical flag sets and lag medians within band.
- Bench must not be parallelised at all. The timings are the product. A5 is the existing violation.
- QA at 4 workers is already the D588 compromise, with the loading cells serialised behind the
  exclusivity barrier.

The audit was asked to say loudly where parallelism would corrupt a measurement, and it did: the
44m39s and the 19m38s are, correctly, not available for parallelisation. The gate is slow because
the measurements are serial by nature, not because the pipeline is badly built. The real finding is
not in the time column at all — it is the thirteen ways a stage can report the wrong thing.
