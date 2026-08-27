# Plan Phase 6

## Main Goal (inherited)

Migrate the Bklit UI charts to Tanstack Charts by:

- Exact same frontend design and interactivity
- Make backend tanstack charts native
- Keep same components API (seamless change from Legacy Bklit to tanstack charts)

## Phase 6 Goal

Retire the parallel chrome layer. Phase 5 re-platformed onto `@tanstack/charts@0.15.0` and its own
pin-check **confirmed** the native capabilities exist (`research/phase-5/07-pin-check.md` row 4:
`states` / `when:{focus:'unmatched'}` CONFIRMED) — but the five big custom subsystems survived it:
hover-chrome (18 `querySelector`s into `.ts-chart__*`), tooltip-chrome, HTML axis-label overlays,
the custom spring/rAF family, and brush/zoom. Native `crosshair`, `whenFocused`, `focusGuideX/Y`,
`tooltip`/`renderTooltipBody`, `tickLabels.thin`, `controls: brushX`, `zoomX`, and mark `states`
grep to **zero usages** in `showcase/migrated/**` today.

End state: every subsystem is native, a sanctioned extension (`createMark`, app-owned pointer via
`pointer:false` + `host.interaction`), or accepted-with-log — and **zero renderer DOM reach-ins**,
enforced by a CI grep guard so it stays zero.

**Explicitly out of scope (inherited rulings — do not re-litigate):** funnel (D30/D54, PR #81),
sunburst labels (upstream-blocked, D405), loading states (app-owned), legend *UI* stays custom
(#95) — only its chart coupling is refitted here. Protected QA harness files stay with the gate
author (D402/D395). Stage-2 legacy sunset (visx uninstall) stays parked: `repos/bklit-ui` is still
QA impl-A (D392).

**Baseline: inherited, not re-run.** `docs/phase-5/BASELINE.md` + the phase-5 final QA matrix
(`docs/phase-5/captures/5-3-5-final-matrix.md`) + `bench/results/latest.json` are the reference.
Log the inheritance as the first D-entry. Nothing is measured again until 6.5.

**Macro structure:** Research (6.1) -> Map (6.2) -> Implement (6.3) -> Refactor (6.4) -> Gate (6.5)

## How to Work

**Research and decision-making are done by the orchestrator (you) directly — not delegated.**
You read the library source/docs, resolve open questions, and make every FIX / REPLACE /
ACCEPT-WITH-LOG ruling yourself. Sonnet sub-agents are for **execution only**: mechanical code
changes, file-by-file application of a mapping you already decided, and read-only exploration
scans that report back for your decision. Parallelize and batch executor dispatches as much as
possible. Verify gate math independently; agents omit failures. Log every accepted deviation as a
`D<next>` entry in `docs/phase-6/LOG.md` (numbering continues from D416).

Standing rule (log it at 6.2): **every "library can't do X" ruling carries a version stamp and
expires at the next pin bump unless re-verified.** All of phase 5's dead rulings were true at
v0.14 and false at 0.15; nobody re-audited. This rule is the process fix.

---

## Phase 6.1: Research (orchestrator-led, one subsystem at a time)

Seed evidence: `research/phase-6/00-native-map.md` — session-verified native mechanisms with
`dist/*.d.ts` + docs file:line cites. Start from it; do not re-derive what it already proves.

For each subsystem below, YOU research and write `research/phase-6/<n>-<subsystem>.md`
(phase-4 report shape — tables, terse). Explore agents may gather inventory (files, LOC,
reach-in sites, legacy behavior notes) and report back, but the mapping verdicts are yours.

| # | Subsystem | Custom today (delete target) | Native mechanism (from 00-native-map) |
|---|---|---|---|
| 1 | Focus styling / hover-dim | `hover-chrome.ts` dim paths + per-chart focus strategies | mark `states: [{when:{focus:'unmatched'},style,transition}]` |
| 2 | Tooltip | `tooltip-chrome.ts`, `marker-tooltip.tsx`, `tooltip-components.tsx` | `tooltip` ext + `renderTooltipBody` + `portal`/anchor/pinning |
| 3 | Hover geometry | remaining `hover-chrome.ts`, `grid-highlight-mark`, date pills | `crosshair`, `whenFocused(bandX/…)`, `focusGuideX/Y` |
| 4 | Axes | `x-axis-overlay`, `y-axis-overlay`, `bar-x-axis-overlay`, dup d3 scales | `axis.ticks{count,spacing,values,format}` + `tickLabels{rotate,thin}` |
| 5 | Motion / reveals | `spring.ts` family, rAF loops, reveal clips, live-line streaming | `motion()` phases/stagger/per-state transitions; rolling path contract |
| 6 | Brush + zoom | `brush-*`, `chart-brush`, `zoom-engine` (DOM-transform half) | `controls:[brushX]`, `zoomX`; choropleth keeps gesture input, applies pan/zoom via projection params in the definition |
| 7 | Legend coupling | legend hover -> DOM pokes | legend UI kept; focus injected via `host.interaction` / `onRender` controller |

Each report contains: current implementation inventory (incl. every `.ts-chart__`/`data-ts-key`
reach-in it owns) · bklit behavioral requirement from legacy source · native mechanism with
file:line evidence · custom->native mapping table with per-chart applicability · open questions
**resolved in-pass** (read library source, or prove with a throwaway scenario render); anything
unprovable is marked ACCEPT-WITH-LOG candidate with the evidence of the attempt.

Known risk concentrations to resolve during research, not implementation: axis typography parity
(native SVG tick labels vs HTML overlays — likeliest ACCEPT-WITH-LOG candidate), pie hover-expand
via arc `states`/channel retarget (replaces per-frame `d` rewriting), dash-sweep line reveal
(native enter is baseline-growth; likely stays a sanctioned `createMark`), candlestick T0 headroom
(revert-first, per D373).

### 6.1.8 — Reach-in census

One Explore agent: every `querySelector` / `.ts-chart__` / `data-ts-key` site in
`showcase/migrated/**`, mapped to the subsystem that replaces it ->
`research/phase-6/08-reach-in-census.md`. Census = 0 is the phase's headline metric.

---

## Phase 6.2: Map

Merge 6.1 into `research/phase-6/go-to-plan.md` (you write it): per-chart x subsystem matrix ·
full deletion list (each replacement names the internal files it kills) · commit sequencing with a
collision check a la `research/phase-5/09-batch-collisions.md` — all seven subsystems touch the
same chart files, so this ordering sequences *commits*, not gates. Every subsystem appears exactly
once as REPLACE / SANCTIONED-EXTENSION / ACCEPT-WITH-LOG. Log the standing rule and the baseline
inheritance.

---

## Phase 6.3: Implement (big-bang, single branch, no intermediate QA/bench)

Sonnet executor agents apply the go-to-plan, parallelized where the collision map allows. Two
disciplines, both free:

- **One commit per subsystem**, in map order (expected: states -> tooltip -> hover geometry ->
  axes -> motion -> brush/zoom -> legend). This is the bisect ladder replacing the per-batch gates
  we are skipping.
- Typecheck + build continuously (seconds; catches mechanical breakage early — this is not the
  benchmark we are saving).

Deletions land inside each subsystem's commit — replacing without deleting fails the task.

---

## Phase 6.4: Refactor

After all subsystem commits land, dispatch **Explore agents (read-only, parallel)** over the
post-change `showcase/migrated/**` to report back to you:

- dead code (orphaned internals, unused exports, stale CSS classes in `styles.css`)
- duplicated logic that can be centralized (the phase-4 SHARED-vs-UNIQUE lens, re-run on the new
  shape)
- leftover scaffolding: adapters, `// TODO`, compat shims, re-export indirection made pointless by
  the deletions
- import hygiene: granular `@tanstack/charts/*` subpath imports for bundle size

YOU triage the findings into refactor tasks (terse table in `research/phase-6/10-refactor.md`),
then sonnet executors apply them as one final `refactor` commit. No behavior changes in this step
— anything behavioral goes back to 6.3 or gets a D-entry.

---

## Phase 6.5: Gate (once, at the end)

- Full QA matrix vs inherited baselines (known-failing baselines are the reference, per phase-5
  rule)
- `pnpm bench --all` vs `bench/results/latest.json` — no regression
- **Bundle-size measurement — M2c finally owned.** The `internal/` mass deletion is its fix; this
  run is where the ~5-6x gzip gap vs legacy must move. Record per-scenario gzip in
  `docs/phase-6/BENCHMARKS.md` and add the bundle channel to the standing gate set.
- Reach-in census re-run = 0, then add the CI grep guard so it stays 0.

**Failure protocol:** bisect by subsystem commit, fix forward, re-run only the failing scenarios —
not the whole matrix. Tick progress in `docs/phase-6/PROGRESS.md`.

**Staleness rule:** once 6.3 starts, `go-to-plan.md` is the source of truth; do not re-consult 6.1
reports for code already touched. 6.4 findings describe post-change state and may be appended to
research files as end-state records.

---

## Definition of Done

- [ ] Reach-in census = 0, CI grep guard in place
- [ ] No parallel custom system where research proved the native path; every subsystem
      dispositioned REPLACE / SANCTIONED-EXTENSION / ACCEPT-WITH-LOG in the ledger
- [ ] Full QA matrix within inherited known baselines; typecheck + build green
- [ ] `bench --all` no regression vs phase-5 latest
- [ ] Bundle gzip per scenario recorded, materially down, and gated going forward
- [ ] 6.4 refactor pass executed: dead-code/duplication findings triaged and applied or D-logged
- [ ] `docs/phase-6/LOG.md`, `PROGRESS.md`, `BENCHMARKS.md` updated; D-numbering continuous from
      D416
