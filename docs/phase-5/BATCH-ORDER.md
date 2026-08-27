# Phase 5 — Batch Ordering (5.2.2)

> Authored by the lead. Sequences the 22-task table in `research/phase-5/go-to-plan.md`
> into B0–B8. Gates are defined by `docs/phase-5/GATE-MAP.md`; diffs are taken against
> `docs/phase-5/BASELINE.md` §1 and nothing else.
>
> **Dependency rule (PLAN-phase-5.md:94):** nothing enters a batch whose prerequisite
> batch isn't gated green.
> **Stacking rule (D362):** no batch may stack two risky changes onto one chart within
> a single gate.

## B0 — Upgrade fallout: the legacy-scale deprecation *(lead ruling, supersedes the D360 deferral)*

D360 measured this deprecation and queued it for "whichever later batch touches those
call sites." At 5.2.2 that deferral is **withdrawn**. B0 is its own batch, first.

**Measured scope (lead, on the pinned 0.15.0 — twice, by two independent parsers):**
**36 keys across 16 files.** Zero files use `scales: {…}` today.

| surface | scope | files |
|---|---|---|
| **1** chart-level `x:`/`y:` → `scales.x`/`scales.y`, inline `defineChart({…})` | **26 keys / 10 files** | `area` `candlestick` `choropleth` `composed` `live-line` `radar` `sankey` `sunburst` (2 each) · `gauge` `internal/heatmap-components` (4 each — two `defineChart` calls per file) |
| **1** same, but `defineChart(specVar)` call form | **8 keys / 3 files** | `bar-chart.tsx:675,676,849,850` (4) · `line-chart.tsx:585,590` (2) · `scatter-chart.tsx:651,656` (2) |
| **1b** insert `scales: { x: null, y: null }` — no keys to move, but `scales === undefined` still trips the guard | **0 keys / 3 files** | `funnel-chart.tsx` `pie-chart.tsx` `ring-chart.tsx` |
| **2** `polar({angle,radius})` → `polar({scales:{angle,radius}})` | **2 keys / 1 file** | `radar-chart.tsx:409–411` |
| **3** resolved-polar `.angle`/`.radius` reads → `.scales.*` (`polar.d.ts:15–17`) | **0 — no work** | — |
| **4** `ChartMarkPointX`/`Y` (`types.d.ts:391,393`) | **0 — no work** | — |

> **Correction to the first count.** An earlier lead pass reported 24 keys / 10 files. That
> pass matched only the inline `defineChart({` call form and so missed `bar`, `line`, and
> `scatter`, which pass a spec **variable** (`defineChart(spec)` / `defineChart(base, {…})`).
> It also missed surface 1b entirely. A **third** pass then found one more pair hidden behind
> a cast — `area-chart.tsx:655–656`, inside `const emptySpec = {…}` passed as
> `defineChart(emptySpec as never)` at `:668`. **The `as never` means the typechecker cannot
> catch a miss there**, so it would have survived a green `tsc` and shipped a live deprecation
> into the loading path. Final figure: **36 keys / 16 files**, and it pulls
> **`scatter` (T1, 0.0490% headroom)** into B0's blast radius.
>
> Also separated during this pass: `internal/*-mark.ts` and several in-chart sites carry
> `x: { scale: "x", values }` — **mark channel declarations returned from `initialize()`**, a
> different and non-deprecated API. Migrating those would have been a real regression. They
> are excluded, and every executor brief names them explicitly.

**Polar charts are safe to migrate** (checked, not assumed): `polar()` carries its **own**
scoped `scales` (`polar.d.ts:85`), separate from the chart-level record, so the chart-level
`collected.keys()` throw at `scene.js:506` does not fire for `angle`/`radius`. Chart-level
`{ x: null, y: null }` is correct for the polar-only specs.

**Why it is a batch and not hygiene — three verified reasons:**

1. **It is a provable runtime no-op.** `@tanstack/charts/dist/scene.js:499` resolves
   `const scales = definition.scales ?? { x: definition.x, y: definition.y }` — pure
   aliasing, identical downstream. Expected pixel movement is **0.0000% on all 45 runs**.
2. **It is forward-compat-mandatory, not optional.** `scene.js:489` warns *"This
   compatibility will be removed when TanStack Charts enters Alpha."* Leaving it costs a
   forced migration later, mid-implementation.
3. **A deprecation warning is firing in the showcase *dev* console today.** Verified by the
   lead, including the limit: the warning is inside a `process.env.NODE_ENV !== "production"`
   guard (`scene.js:486`), and esbuild dead-code-eliminates it from the Vite production
   build — `bench/app/dist/assets/*.js` contains the unconditional throw string
   `"Chart scales must define reserved"` but **zero** occurrences of `deprecated`. So it
   fires under `next dev -p 5200` and **not** in the builds QA and bench measure.

**Type contract** (`dist/types.d.ts:485–496`): the spec is a union of
`CanonicalChartScaleSpec` (requires `scales`, still tolerates deprecated `x?`/`y?`) and
`LegacyChartScaleSpec` (`scales?: undefined`). A spec cannot be half-migrated. `ChartScales`
requires **both** reserved keys; `scene.js:503` throws `"Chart scales must define reserved
\`x\` and \`y\` entries"` otherwise. Polar-only specs take `{ x: null, y: null }`.

**Why first:** B0 is the **gate-harness shakedown**. It is the only change in Phase 5 whose
correct result is known in advance to be zero movement everywhere. Running the full sweep
against a provable no-op validates the harness itself before any batch with real parity risk
leans on it — if a cell goes red in B0, the instrument is wrong, not the code. It also clears
deprecated call sites out of 10 files that B3/B4/B5 will edit anyway.

**Blast radius:** touches **all three** tightest-headroom charts — `candlestick` (**T0**,
0.0047), `scatter` (**T1**, 0.0490), `heatmap` (**T1**, 0.0723) → pre+post captures required
on each despite the no-op expectation, per GATE-MAP policy ("in every batch that touches it,
whether or not it owns the change").

**Gate:** full **45-run** sweep + typecheck + build.
**Exit criteria:**
- typecheck EXIT=0 both apps; both builds green;
- 45/45 rows reconciled, with the movement ceiling **split by determinism class (amended at
  D376 — the original flat 0.01% ceiling is below this harness's resolution on hover captures
  and was never measurable there)**:
  - **settled** cells — deterministic (`--self-test` returns 0.0000% on every one) — hold the
    **0.01pp** ceiling. *Measured at B0: 42 cells, max |Δ| 0.0047pp.*
  - **hover-30/50/70** cells — noise-dominated — are bounded by **the measured `--self-test`
    floor of the same chart**, not by a flat number. *Measured at B0: 114 cells, max |Δ|
    0.1177pp against a same-chart self-test noise reading of 0.1162pp.*
  - the 3 ruled-non-parity rows (`candletween`, `ring` n=1000, `barloading`) are excluded from
    both, per BASELINE §1;
  - **Run `--self-test` before ruling any single red cell a regression.** B0 demonstrated the
    need: a control run produced `area` settled **9.4121%** on *pristine* code recorded at
    0.0003% (a capture against a partially-rebuilt bundle after the stale-build guard tripped),
    which returned to 0.0003% on re-measure.
- **the legacy-scale deprecation warning no longer appears on any of the 26 showcase routes
  — checked against the `next dev -p 5200` DEV server.** Binary, non-pixel, and the real proof
  the migration is complete. **Checking this against a production build is a false pass:** the
  warning is compiled out there (see reason 3), so a dev-server run is mandatory and a
  `vite preview` / `next start` run does not satisfy this criterion;
- zero `Object.hasOwn` scale TypeErrors at runtime.

**Revert policy:** any movement beyond the class ceilings above = revert. There is no
fix-forward case for a no-op. **Attribute before reverting (D376):** a flagged cell must be
reproduced against the reverted tree before it is charged to the batch — at B0, 41 of 168 cells
flagged against the flat ceiling and *every one* proved to be either 5.0.1's v0.14.0→0.15.0
upgrade drift (`scattermultiaxis` hover-50 read 0.0779 identically with **and** without the
change) or instrument noise (`composed` hover-30 read 0.0808 **reverted** vs 0.0000 applied —
the reverted tree moving further from baseline than the migrated one).

## Batch → task assignment

Carried from `go-to-plan.md`'s `batch` column; B0 added above.

| batch | tasks | theme |
|---|---|---|
| B0 | *(legacy-scale deprecation — above)* | upgrade fallout |
| B1 | T1 T2 T3 T4 T5 | mechanical deletions |
| B2 | T6 T7 T8 T21a | paint resources |
| B3 | T9 T10 T11 T12 | interaction / focus |
| B4 | T13 | tooltip token migration |
| B5 | T14 T15 T16 T17 T21b | renderer-coupling cleanup |
| B6 | T18 T19 | visx removal — **CLOSED, GREEN.** T18 (D396) incl. the folded-in `@visx/gradient` removal; T19 (D398) local port keeping `@use-gesture/react`, gate built D395. Zero `@visx/*` statements left in `migrated/**` |
| B7 | T20 | `motion()` renderer — **CLOSED, T20 NOT ADOPTED (D401).** Renderer switch works and is pixel-neutral, but the WAAPI-retirement clause is unachievable (`radialSweepClipPath` is the only group clip) and `motion()` animates every data update. Pilot reverted. See **D402**/**D403** for the gate-variance finding it surfaced. **T15 (re-sequenced here by D388) then audited and refused too — D404**: `polar.js` emits one `<g class="ts-chart__arc">` for the whole sunburst, so `motion.js:987-1005` gives one wedge at `datumCount: 1` against a per-arc ring-staggered reveal; plus the same every-reconcile animation problem and no caller-facing replay hook. **B7 closed, both tasks refused, zero code changed** |
| B8 | T22 | deferred / upstream-gated — **CLOSED, ACCEPTED-WITH-LOG (D405).** Both blockers still closed at 0.15.0: no label channel on `RadialArcOptions`, no angle field on `ChartPoint`, no `fill`/`background` on `ChartAxisTickLabelOptions`. No code, no gate |

## Dependency graph

*(cited edges only; see `research/phase-5/09-batch-collisions.md` part C for the
file-level collision evidence)*

- **B0 → all.** Every later batch edits at least one of B0's 10 files; landing the rename
  first keeps it out of every subsequent diff.
- **T21a → T21b** — "Gates **only after T21a is green**" (D368, `go-to-plan.md:57`).
  This is why the heatmap halves sit in B2 and B5, two gates apart.
- **B3 → B4** — T13 configures `focus:'group-x'`, the same native focus surface T9 adopts.
  The tooltip cannot be re-anchored onto a focus model that isn't in place yet.
- **B4, B5 → B7** — "after B4/B5 — tooltip motion rides it" (`PLAN-phase-5.md:91`).
  Reinforced by pin-check #5: tooltip motion is **opt-in via `motion()`**, not automatic,
  so T13 must not expect it and T20 must supply it afterwards.
- **T12 → T14** — both edit `hover-chrome.ts` (T12 replaces its DOM, T14 rewrites its
  dataset reads at `:404`). Ordering follows B3 → B5.
- **B2 → B7** — T8 introduces per-mark `motion:` declarations that T20's renderer adoption
  then generalises.

## Corrections to `go-to-plan.md` forced by the collision analysis

Verified on disk by the lead, not accepted as agent-reported.

| task | plan says | reality | effect |
|---|---|---|---|
| **T13** | edits `renderer.ts:66–85` | **No `renderer.ts` exists under `showcase/migrated/charts`.** The only one in the repo is vendored library source (`repos/tanstack-charts/.../charts-core/src/renderer.ts`) — a **protected path we must not edit**. | Drop from T13. This is the **4th** phantom citation, after `adapter-shared.ts`, `tooltip-scheduler.ts`, `visx-pattern-bridge.tsx`. |
| **T13** | blast radius is line/area/bar/scatter/composed/candlestick/live/**sankey**/**heatmap** | Traced by importer: `tooltip-chrome.ts` is reached by bar, candlestick, choropleth, live-line, scatter directly; area + composed via `hover-chrome.ts`; line via `use-hover-chrome.ts → hover-chrome.ts`. **`sankey-hover-chrome.ts` and `heatmap-hover-chrome.ts` import it zero times** — both own independent tooltip stacks. | **B4 loses `sankey` and `heatmap`, gains `choropleth`.** Heatmap (**T1**) is *not* in the highest-risk batch — a real risk reduction. |
| **T4** | `line-chart.tsx:1018` | `ariaLabel="Line chart"` is at **`:1059`** | line drift |
| **T15** | `sunburst-chart.tsx:956–986` | `handleRender` logic is at `:651`, `:920`, `:1059–1138` | wrong section cited |
| **T16** | `loading-chrome.ts:71` | file is **`.tsx`**; the unscoped `getElementById` is at **`:200`** | wrong extension + line |
| **T19** | barrel `index.ts:184–192` | that range is sunburst-breadcrumb exports; the `@visx/zoom` export is at **`:223`** (as the plan's own corrections section already said) | self-inconsistent |
| **T18** | 8 pattern call sites | all 8 real, line numbers drifted up to **+249** | re-locate by symbol, not line |

**Not a contradiction (agent misread):** the collision report flagged T13 (B4) preceding T20
(B7) as "backwards". It is correct as written. Tooltip motion is *opt-in* via `motion()`
(pin-check #5), so T13 must ship **without** it and T20 supplies it afterwards — that is
precisely what "after B4/B5 — tooltip motion rides it" (`PLAN-phase-5.md:91`) specifies.

## B1 is not gateable as specified — split ruling

`PLAN-phase-5.md` labels B1 "mechanical deletions, **no visual risk**". Tracing the fan-outs
the collision pass left open shows that is false:

- **T5** (axis overlays) fans out to `area`, `bar`, **`candlestick` (T0)**, `composed`, `line`,
  **`scatter` (T1)** — via `internal/x-axis-overlay.tsx` importers.
- **T3** (reduced-motion consolidation) reaches **`candlestick` (T0)** transitively:
  `internal/segment-visuals.tsx:5,26` calls `usePrefersReducedMotion`, and
  `candlestick-chart.tsx:56` imports `SegmentOverlay` from it.
- **T1** touches all 14 `<Chart>` hosts — the widest single change in Phase 5.

Three tasks reaching the T0 chart in one gate directly violates the D362 stacking rule.
**B1 splits into four sequential gates**, each isolating at most one T0-touching change:

| sub-batch | tasks | T0/T1 reach | rationale |
|---|---|---|---|
| **B1a** | T2 ∥ T4 (parallel) | none | `brush-drag.ts` and `line-chart.tsx` aria props are disjoint and touch no risk-tier chart |
| **B1b** | T3 | candlestick (T0) | low intrinsic risk — no pixel movement expected outside reduced-motion — but isolated so a candlestick move is attributable |
| **B1c** | T5 | candlestick (T0), scatter (T1) | genuinely pixel-affecting (axis rendering); the highest-risk item in B1 |
| **B1d** | T1 | whole board | isolated last, so the cheap wins are already banked and any movement is unambiguously sizing |

## Parallelism

Batches are **strictly sequential**. Parallelism is *within* a batch, across provably
disjoint file **and** chart sets:

| batch | parallel groups | serialized |
|---|---|---|
| B0 | split by file into 3 disjoint groups (inline-spec / spec-variable / polar + `1b` insertions) | — |
| B1a | **T2 ∥ T4** | — |
| B1b–B1d | — | T3, then T5, then T1 |
| B2 | **T7 ∥ T21a** (`bar-pulse-mark.ts` vs heatmap — disjoint files and charts) | T6, T8 |
| B3 | — | T9, T10, T11, T12 all serialized (T10/T8 share `sankey`; T11 shares `sunburst-chart.tsx` with T15/T22; T9 shares `heatmap-components.tsx`) |
| B4 | — | T13 alone (owns the batch) |
| B5 | **T17 ∥ T16** (`gauge.tsx` vs `loading-chrome.tsx` → `arealoading`/`barloading`/`area`/`bar`/`line`; disjoint) | T14, T15, T21b |
| B6 | — | T18, then T19 |
| B7 | — | T20 alone (all 45 by definition) |
| B8 | — | T22, only if unlocked upstream |

**Serialize-always list (wide blast radius):** T1, T3, T5, T13, T14, T18, T20 — 7 of 22 tasks.
**T17 additionally demands isolation** by its own acceptance text ("zero gate upside; any
movement = revert"), so its pairing with T16 above is the only concession, justified by their
having no file or chart in common.

## Serialization ruling

B0…B8 (with B1a–B1d) each gate green before the next opens. Reason: every candidate
cross-batch pair shares either a file or a risk-tier chart, so concurrent batches would make
an attributable gate failure unattributable — which is exactly what the revert-first policy
depends on.

## Per-batch gate subsets

Every batch gets typecheck + build. QA scope below; **every batch that touches a T0/T1 chart
takes pre+post captures of it regardless of which task owns the change** (GATE-MAP policy).

| batch | QA scope | T0/T1 pre+post required |
|---|---|---|
| B0 | **full 45-run**, split ceiling (settled 0.01pp / hover ≤ self-test floor, **D376**) + dev-console warning check on `next dev -p 5200` | candlestick, scatter, heatmap |
| B1a | `brush`, `line`, `legend*` | none |
| B1b | reduced-motion-sensitive set + `candlestick` | candlestick |
| B1c | `area` `bar` `candlestick` `composed` `line` `scatter` + `*multiaxis` | candlestick, scatter |
| B1d | **full 45-run** (all 14 hosts resize) | candlestick, scatter, heatmap |
| B2 | `scatter` `pie` `gauge` `bar` `sankey` `heatmap` | scatter, heatmap |
| B3 | `composed*` `liveline` `heatmap` `sankey` `pie` `ring` n=4 `radar` `sunburst`×2 `markers` | heatmap |
| B4 | `line` `area` `bar` `scatter` `composed` `candlestick` `liveline` `choropleth` + hover pairs | **candlestick (T0)**, scatter |
| B5 | `line` `composed` `candlestick` `scatter` `choropleth` `sunburst`×2 `arealoading` `gaugelinear` `heatmap` | candlestick, scatter, heatmap |
| B6 | `patternarea` `heatmap` `choropleth` + the 8 pattern call-site charts | heatmap, candlestick |
| B7 | **full 45-run** | all three |
| B8 | `sunburst`×2 `sunchrome` | none |

### Standing baseline drift — do not charge these to your batch (D376, D378)

Two cells in `BASELINE.md` §1 have been **measured** to sit above their recorded value on the
current pin with the batch under test reverted. They are inherited from 5.0.1's v0.14.0→0.15.0
upgrade, not from any B-batch, and a batch that gates these charts must not attribute them to
itself:

| chart | cell | baseline | measured floor on current pin | evidence |
|---|---|---|---|---|
| `scattermultiaxis` | hover-50 | 0.0000 | **0.0779** | reads 0.0779 identically with and without B0 (**D376**) |
| `sankey` | hover-70 | 0.1323 | **~0.1834** | reads 0.1834 with T3 reverted, solo (**D378**) |

**Inheriting batches:** `sankey` is gated by **B2** and **B3**; `scattermultiaxis` by **B1c**.

### `candlestick` — first-FAIL protocol (D378)

`candlestick` hover-30 has **0.0047pp** of headroom and is **not a stable cell**. Six
observations at n=1000 span **[0.4801, 0.5082]** — a ±~0.015pp spread around a baseline of
0.4953 that is itself only 0.0047pp from the gate. One of those readings (0.5082) is a FAIL,
and it did not reproduce in four subsequent runs including both arms of an A/B. **The
consequence is structural: this cell will read FAIL from time to time no matter what any
batch does, and its recorded baseline should be read as the centre of a distribution, not as
a point value.** **A single FAIL on
that cell is not sufficient evidence to revert a batch.** Before reverting: (1) `--self-test`
the chart, (2) re-run it solo, (3) re-run solo with the batch reverted. Revert only if the
applied arm reproduces and the reverted arm does not. This refines — it does not repeal — the
T0 revert-first policy: revert-first still governs a *reproducible* move.

## `<Chart>` host census — the "14 hosts" figure is wrong (D380)

Several task descriptions (T1, T4) say "all 14 `<Chart>` hosts". There *are* 14 `<Chart>`
render sites and 14 sizing-hook call sites, but **they are not the same 14**. Any batch that
inherits the figure should use this table instead.

**14 `<Chart>` render sites** (`grep -c '^\s*<Chart\s*$'`, one per file):
`area` `bar` `candlestick` `choropleth` `composed` `gauge`(arc only, `:853`)
`internal/heatmap-components`(`:664`) `line` `pie` `radar` `ring` `sankey` `scatter` `sunburst`

**Sizing props actually passed:**

| hosts | props | native ResizeObserver |
|---|---|---|
| `area` `bar` `candlestick` `choropleth` `composed` `line` `sankey` `scatter` | `aspectRatio` (+`height` on area/line) — **no `width`** | **installed** — already natively fluid |
| `pie` `radar` `ring` `sunburst` `gauge`-arc `heatmap-components` | explicit `width`+`height` | **not installed** (`renderer.js:184` skips it when `width` is defined) |

The second group is deliberate: `pie`/`ring`/`radar` derive `size = fixedSize ?? Math.min(width, height)`
for square aspect, which native cannot express (`aspectRatio={1}` gives width×width).

**Mismatches between the two sets of 14:**

- Render a `<Chart>` but consume **no sizing hook**: `sankey`, `sunburst`.
- Consume a sizing hook but render **no `<Chart>`**: `GaugeLinear` (`gauge.tsx:993`),
  `funnel-chart.tsx:647`, `live-line-chart.tsx:354`.
- `heatmap-chart.tsx:109` consumes a hook and hosts a `<Chart>` only *indirectly*, through
  `heatmap-context` → `internal/heatmap-components.tsx:664`. An audit that greps only
  `heatmap-chart.tsx` will conclude — wrongly — that heatmap has no `<Chart>`.

**Carry-forward for T4's follow-up batch:** its "other 14 hosts still hardcode `ariaLabel`"
(D377) is a *render-site* count, so it is the first list above, minus `line` (already threaded)
= **13**, and it does not include `funnel`/`live-line`/`GaugeLinear`.

## Dependency-graph correction: T21a → T9 (D381)

**The graph above is missing an edge.** It records `B3 → B4` because T13 needs the focus
model T9 installs — but **T21a has the identical dependency for the identical reason**, and
was scheduled a batch *earlier* than the thing it depends on.

T21a's declarative focus styling (`states` + `when:{focus:'unmatched'}`) is resolved against
TanStack's own focus state (`mark-state.js:104`). Nothing populates that state for heatmap
today: the dim is driven by a hand-rolled `pointermove` listener
(`internal/heatmap-components.tsx:414`) feeding a custom `HeatmapHoverCoordinator`, and the
`<Chart>` at `:660-668` is passed no focus or interaction handler at all. Replacing that
listener is **T9's** deliverable — T9's own citation is `internal/heatmap-components.tsx:410`,
the same effect.

- **New edge: T9 → T21a.** T21a runs inside B3, serialized after T9.
- **T21a → T21b (D368) is unaffected** — T21b is in B5, still downstream of B3.
- The "paint only" label is what disguised this: re-basing a dim onto native focus is an
  interaction change, not a paint change.

**Generalisable check for the remaining batches:** any task whose acceptance mentions
`focus:`, `states`, `when:`, or `whenFocused` is implicitly downstream of T9/T10/T11 for
whichever chart it touches, because those are what install the focus model such a task reads.

## B3 close: the focus model is never installed (D382-D385)

**All four B3 tasks are skipped, so the "focus model" that four later tasks were sequenced
behind does not exist and will not exist at this pin.** The generalisable check written
directly above — *any task whose acceptance mentions `focus:`, `states`, `when:` or
`whenFocused` is downstream of T9/T10/T11* — now resolves the other way: those tasks are not
*waiting on* B3, they are **void with it**, unless they can be re-scoped to something that
does not read TanStack focus state.

Consequences to carry forward:

- **T21a stays skipped (D381), permanently.** Its colour half was already satisfied; its
  `states` half needed T9's listener migration, which D382 rules out.
- **T13 (B4) was re-audited and is now SKIPPED (D386) — but NOT because focus is missing.**
  Correcting the line first drafted here: `focus:'group-x'` is **already configured and live**
  on `line` (`:602`) and `area` (`:664`, `:829`), both with `maxFocusDistance: Infinity`, and
  `bar` (`:687`, `:864`), `scatter` (`:676`) and `candlestick` (`:536`) run **custom
  `ChartFocusStrategy` objects** with `focusRing: false` — all five consume the result through
  `<Chart onFocusGroupChange>` with no container pointer listeners at all. Native focus is
  adopted on five of T13's eight charts today. D382 rules out *migrating the remaining
  bisectors onto it*; it does not void T13's premise. The one T13 chart where it genuinely is
  void is `composed`, which configures `group-x` for consistency but leaves the callback
  **deliberately inert** (`:53-56`, `:1250-1253`) because of the dual raw/decimated
  resolution — and there `resolveChartPointerFocus` compounds it: painted containment runs
  **first** for all four built-in presets, so a bar rect under the pointer beats the group-x
  scan.
- **T12's cursor finding survives B3.** `crosshair-resolver.js:8` accepts an app-supplied
  cursor when focus is undefined, so `createChartCursor` -> `crosshair()` is reachable
  *without* native focus. It is unusable for the hover chrome (D385) but is the one live
  native surface B3 leaves behind.

**Task-row census corrections (plan errors, not agent errors), from the T9 and T12 audits:**

| task row cites | what is actually there |
|---|---|
| `composed-chart.tsx:1053` "pointermove bisector" | a min/max time loop |
| `composed-chart.tsx:1212` "pointermove bisector" | a series config object |
| `live-line-chart.tsx:500` "bisector" | a cursor-x tracker; `bisectTime` (`:207`) is used only for windowing (`:545`, `:656`) |
| (T9's real subject, uncited) | `composed-chart.tsx:1259-1345` — the dual raw/decimated bisector, listener attached at `:1342-1346` |
| T12: `internal/marker-tooltip.tsx` | paints no chrome at all — React tooltip *content*, an `ActiveMarkersStore`, a provider and two hooks. All the chrome is in `hover-chrome.ts` (`:227`) |


## B4 close: the native tooltip is adopted nowhere, and five blockers keep it that way (D386)

T13 was B4's only task, so **B4 closes with zero code changed — the fifth consecutive no-op
batch** (B1c, B1d, B2, B3, B4). Unlike B3, where every named export existed and the tasks
failed app-side, T13 fails on **both** sides at once.

**The starting state the row does not record.** T13 is written as a *token migration* — swap
our tooltip tokens for the native ones. But the native tooltip is not configured on a single
migrated chart: no `defineChart` call passes a `tooltip` option (every `tooltip:` under
`showcase/migrated/charts` threads the app's own `ChartTooltipConfig`), `pie`/`ring`/`radar`/
`sunburst` pass `tooltip:false` explicitly, `renderTooltipBody` is imported nowhere in
`showcase/` or `bench/app/src`, and the class `ts-chart-tooltip` appears nowhere in migrated
output. T13 is a **from-zero adoption across 8 charts**, which is why its acceptance criteria
do not survive contact.

| # | Blocker | Lifted by T20/B7? |
|---|---|---|
| 1 | **The two acceptance clauses are mutually exclusive.** `BATCH-ORDER.md:162-165` accepts shipping without motion; the row demands "every hover probe within baseline" on a set containing a **T0** chart. `renderer.js:810` gates the motion controller on `surface.renderer.capabilities?.tooltipMotion` and `grep -c capabilities` is **0** in `svg-renderer.js`/`svg-surface.js`, so the native tooltip snaps with no animation — not even a CSS transition — against a box carrying three springs and a 100 ms WAAPI fade | **yes, this one only** |
| 2 | **Five springing siblings stay put.** The box is 1 of 6 layers on one host (`hover-chrome.ts:227`); highlight runs `{180,28}` + a 400 ms fade, indicator/dots/pill run `{300,30}`. A snapping tooltip among them is an interactivity regression, not a pixel delta | no |
| 3 | **API parity.** `types.ts:398-426` is 27 fields, commented "full bklit `ChartTooltipProps` parity". `panelStyle`, `backgroundColor`, `boxSpringConfig`, `damping`, `matchCrosshair`, `springConfig`, `columnWidth` and the `indicator*`/`dot*` families have no native counterpart | no |
| 4 | **Focus-gating drops 3 of 8 charts.** `paintTooltip` has exactly one caller, the tail of `paintFocus` — `composed` leaves `onFocusGroupChange` deliberately inert (D382), and `live-line`/`choropleth` configure no `focus` at all | no |
| 5 | **It flips the QA gate's detection branch.** `qa/screenshot.mjs:199-212` tries `.ts-chart-tooltip` first, falling through to a text-length heuristic only when absent. All 8 charts use the fallback today; adoption silently moves them onto the selector branch mid-phase, on a file `AGENTS.md` protects | no |

**Re-sequencing T13 behind B7 does not work.** T20 supplies a motion protocol to the native
tooltip; it does not supply our three-way-resolved spring configs, the missing 20-odd public
props, native focus on `composed`/`live-line`/`choropleth`, or a stable QA measurement branch.

**One finding worth keeping for T20.** The box has **no outbound coupling**: `update()`
computes it last (`hover-chrome.ts:605-619`), no other layer reads its position, flip state or
DOM, and `prevFlip` (`:233`, `:617-618`) never leaves the box block. Whatever eventually
replaces the box breaks nothing else, provided the shared `visible`/`showing` bookkeeping is
reproduced — the dot-spring jump-vs-set branch (`:330`) and the marker/legend dim (`:503-551`)
read the same flags.

Two by-products parked for 5.3.5 beside the four stale comments — defects, not deliverables:
`tooltip-chrome.ts:403` declares `transition:"opacity 200ms ease-out"` on `childrenWrap` while
nothing ever writes `childrenWrap.style.opacity` (only `display` is toggled at `:560,562`, which
does not fire it), and `ChartTooltipConfig.children` is a live type-checked field with **zero**
consumers repo-wide, against `content`'s four (all `LiveLineChart`).


## B5: four rulings and the phase's first clean task (D387-D390)

B5 is the first batch since B1b where something is actually being built — but four of its
five tasks were ruled out first.

| task | disposition | the one-line reason |
|---|---|---|
| **T14** | SKIPPED (D387) | **`stagger()` is already adopted.** `internal/native-stagger.ts` has imported the real `stagger()` since 24 Aug, with 12 live call sites. It returns a delay *number*; it cannot remove a state machine. |
| **T15** | **RE-SEQUENCED to B7** (D388) | All three mechanisms are gated on the `<Chart>` -> `<RendererChart>` switch that **is** T20. Not a premise error — a genuine ordering bug in the plan. |
| **T16** | SKIPPED (D389) | Both named mechanisms are absent from the runtime, and the acceptance criterion gates a scenario that cannot regress from the code it names. |
| **T21b** | **VOID** (D390) | Nothing to bin, a stagger formula that cannot express the shipped effect, and a precondition ("after T21a is green") that will never hold. |
| **T17** | **DONE — GREEN (D391)** | The first task in six batches to survive audit intact, and the first since B1b to ship code. Ported via `createMark` + `ScenePolyline.path`; `gaugelinear` gated at `diffPixels: 0` of 960000 on all four probes, arc `gauge` bit-identical at 0.0064 x4. Three out-of-gate risks accepted and logged (a11y svg-root shape, literal-px host sizing, D52's one-frame mount flash). |

**The T14 finding is the sharpest of the phase.** Every earlier skip said *the native API cannot
do what we need*. T14 says the opposite: the native API was adopted a week ago, on purpose, in
the only form that fits. `native-stagger.ts`'s own header explains why it wraps `stagger()` as a
pure delay calculator with a synthetic `ChartMotionContext` — because *"none of this package's
enter-reveal choreography is wired into TanStack's own motion pipeline"*. A task row proposing
to adopt it is proposing work that is both already done and, in the form written, impossible.

**T15 is the first re-sequencing, not a skip**, and it exposes a missing edge in the dependency
graph. `PLAN-phase-5.md:91` places T20 "after B4/B5 — tooltip motion rides it". But T15 needs
the *same* renderer switch, so B5 -> B7 is a real dependency the graph never recorded. T13's
motion gap (D386) was the first symptom; T15 is the second. **Anything touching motion or
replay is downstream of T20, and the plan sequences T20 last.**

### The count of misdescribed task rows is now nine

T14 contributes eight wrong citations in one row (`line-chart.tsx:643` is a numeric compare,
`composed-chart.tsx:1221` a tick-pill comment, `deferred-reveal.ts:43` a bare `//`); T21b
contributes a premise — that its files contain a binning algorithm — that is simply false.
Against that, **T16 produced the phase's first exactly-correct citation**: `loading-chrome.tsx:200`
is verbatim what the row claims. It was still unimplementable. Correct citations and
implementable tasks turn out to be independent properties.

### Parked for 5.3.5, now eight items

The four stale in-repo comments, D386's two tooltip defects (the dead `childrenWrap` opacity
transition; `ChartTooltipConfig.children` with zero consumers), and now two more: T14's
`bkmRevealed`-stamp-to-`useRef` swap (declined — storage churn across 9 charts including a T0,
for zero sanctioned-API surface) and T16's lone `document.getElementById` (declined — latent
only, and app hygiene rather than native adoption).

## Stale in-repo comments found while auditing (fix in 5.3.5, not mid-batch)

All four were found to contradict the 0.15.0 pin or the code beside them.

**Status (2026-08-27, D408): three of the four are FIXED**, the fourth stays parked.
The three fixed are comment/whitespace-only — zero emitted bytes change, `tsc --noEmit` clean —
so the "costs a full gate run" objection that parked them does not apply to them.
`candlestick-chart.tsx` is the exception: it is the **T0** chart and the item is a real code
inconsistency, not a comment, so it stays parked under revert-first.

| file:line | what it claims | actual | status |
|---|---|---|---|
| `internal/bar-pulse-mark.ts:176` | "TanStack's SVG layer has no clipPath scene node" | False at this pin — `SceneGroup.clip` exists and emits a real `<clipPath>`. The comment's *second* reason (the reconciler wipes injected nodes) still holds, and the real blocker is rect-vs-polygon shape (D381) | **FIXED** — comment now states that `SceneGroup.clip` exists (`types.d.ts:853`) and emits a real `<defs><clipPath><rect>` (`svg-renderer.js:81`), that the clip is **rect-only** while the wave needs the bar silhouette polygon (D381), and keeps the reconciler reason |
| `styles.css:776-777` | an unclosed `/*` comment describing a "default resting opacity for cell rects" rule that "lives HERE" | No such rule follows; it also names a class `.ts-bkm-heatmap-rect` (again at `:887`) that exists nowhere — the runtime gives the wrapping `<g>` `ts-chart__rect` and the `<rect>` nodes no class at all (`rect.js:145-146`) | **FIXED** — stale sentence deleted; the stray `/*` is gone (comment opens/closes now balance 85/85) and the `.ts-bkm-heatmap-rect` back-reference at `:887` is removed too |
| `candlestick-chart.tsx:1008-1009` | — | `heightPxCandle` guards on `width > 0` while the sibling `heightPx` guards on `ratio > 0`; flagged in D380's audit, not adjudicated | **STILL PARKED** — T0 chart, and this is a code inconsistency rather than a comment; adjudicating it means touching `candlestick`, which runs at 4771/4800 px on h30 (D407) |
| `radar-chart.tsx:7` | "Hover uses `focus:\"nearest\"` + useLayoutEffect DOM walk" | `:459` sets `focus: focusDisabled`; hover is element-level `pointerenter`/`pointerleave` bound to the area `path`s and dot `circle`s (`:779`, `:800`), gated on `pendingRevealRef`. Found in the B3/T11 audit (D384) | **FIXED** — header now says hover does *not* use the focus subsystem, cites `focus: focusDisabled` at `:459` and the element-level `pointerenter`/`pointerleave` on the area `path`s (`:779`) and dot `circle`s (`:800`) |

## 5.3.5 — highest-value parked item: root-cause the QA gate's run-to-run race (D402)

Parked list is now **12 items**; this one is ranked first because it currently decides **T0**
pass/fail by luck.

A sweep of `qa/results/**` since 2026-08-20, counting cells that return to a previously
abandoned value, found **71 gate cells across ~30 (chart, density) buckets flip-flopping between
runs** with no code change in between. Magnitudes are discrete and stable per cell — one element
racing in or out of the capture — e.g. `line` h50 `0 x13 / 518 x29`, `scatter` h50 `0 x8 / 748 x22`,
`area` h50 `1 x14 / 537 x27`, `bar` (n=100) h50 `0 x7 / 727 x25`.

**`candlestick` (T0) is under-provisioned against its own variance.** GATE-MAP records 0.0047%
headroom (45 px) on h30; the measured in-window spread of that cell is **4609-4953 px, 344 px
wide — 7.6x the headroom**. Three runs crossed the 4800 px gate and were recorded as FAIL, none
of them surfaced at the time: `2026-08-20T04-08-24` (0.5159%), `2026-08-24T08-15-33` (0.5093%),
`2026-08-26T22-16-06` (0.5082%).

**Diagnosis is DONE (D403) — the racing element is identified.** Cross-correlating impl A against
impl B over each diff's bounding box shows the whole difference is a **+/-1 device-pixel horizontal
offset of the tooltip panel**: `line` h50 aligns at dx=+1 with residual SAD 0.000 (vs 20.71 at
dx=0), `scatter` h50 at dx=-1 SAD 0.018, `composed` h30 at dx=-1 SAD 0.001, `area` h50 at dx=-1
SAD 0.233. Identical content, offset by one pixel — panel left edge x=564 in A, x=563 in B. The
direction varies by chart, so it is a rounding race on a position resting near a half-pixel
boundary, not a systematic layout difference. **These cells are measurement noise, not a parity
defect** — a sub-pixel tooltip placement difference is imperceptible.

**`candlestick` (T0) is a different and real problem.** Its FAIL run vs a PASS run shares 4611 px
of inherent divergence; the 342 px unique to the failure are spread across a 953x384 box clustered
at the hover locus (columns ~334-398), i.e. the hovered-candle highlight/crosshair, not the tooltip.
The chart sits inherently at **0.480-0.496% against a 0.5% gate**, so any settle excursion tips it.
Widening that margin is a fidelity question for `candlestick`, not a harness question.

Remaining work is the fix, not the diagnosis. Note `qa/screenshot.mjs` is a **protected harness
file** — any settle-condition change needs gate-author approval, as with D395's entrypoint-guard debt.

Until then: hover-cell readings are judged against the mode distribution in
`qa/results/<chart>/*/report.json`, never a single BASELINE sample. Settled cells are unaffected
and remain the primary attribution signal.


## 5.3.5 — disposition of all 12 parked items

Ranked by consequence. **3 fixed, 1 needs a chart-level decision, 2 declined on cost/benefit,
2 declined earlier and re-affirmed, 2 accepted as debt, 2 blocked on gate-author approval.**

| # | item | disposition |
|---|---|---|
| 1 | **QA gate run-to-run race (D402/D403)** | **BLOCKED — needs gate-author approval.** Diagnosis complete: ±1 device-pixel tooltip-panel quantization, direction varies by chart, so measurement noise not divergence. The fix is a settle condition in `qa/screenshot.mjs`, a protected file. Re-confirmed live in the 5.3.5 matrix — `choropleth` h30 failed on the **bklit** side this time (D407). |
| 2 | **`candlestick` headroom** (`candlestick-chart.tsx:1008-1009` guard mismatch) | **RESOLVED (D411 + D412) — the two halves of this item are unrelated and neither needs a chart edit.** The *headroom* half is an instrument defect, not a chart defect: the cell straddles the gate (9/58 runs over) with `settled` bit-identical in every over-gate run, so it is recorded as a known-failing baseline alongside `choropleth` (D411, D413). The *guard* half inverts on survey — `area-chart.tsx:504` and `line-chart.tsx:177` use the same `width > 0` form, so `:1008` follows the convention and the sibling is the lone (safer) outlier; the exposure needs `aspectRatio` parsing to <= 0, which no gate exercises and which has no legacy counterpart to match. One-line Stage-2 fix identified at `parse-aspect-ratio.ts:3` (D412). Superseded note: T0 chart running 4771/4800 px on h30 (D407). `heightPxCandle` guards `width > 0` where the sibling `heightPx` guards `ratio > 0`. Adjudicating it means touching T0 under revert-first; the real question D403 raised — that the chart sits inherently at 0.480-0.496% of a 0.5% gate — is a fidelity question that deserves its own decision, not a drive-by. |
| 3 | **`internal/bar-pulse-mark.ts:176` stale comment** | **FIXED.** |
| 4 | **`styles.css:776-777` stale comment + stray `/*`** | **FIXED.** Comment delimiters now balance 85/85. |
| 5 | **`radar-chart.tsx:7` stale comment** | **FIXED.** |
| 6 | **D395 — `screenshot.mjs` entrypoint-guard debt** | **BLOCKED — needs gate-author approval** (same protected file as #1). |
| 7 | **T18's unguarded surfaces** (`complement`, custom `radius`/`dotFill`/`tileBackground`, `PatternHexagons`/`PatternWaves`, all 11 gradient components) | **ACCEPTED AS DEBT.** These are API surfaces with no gate coverage, not defects. Adding gates for them is new gate authorship, which is out of 5.3's scope and would change the 45-run roster mid-phase. |
| 8 | **D398 — `containerRef`/`useGesture` timing race** (choropleth zoom) | **ACCEPTED AS DEBT.** Latent; `choropleth` gates clean on settled/h50/h70 and its h30 failure is #1's race, not this. Fixing it means re-architecting the T19 zoom port's ref handoff for a race no gate has ever caught. |
| 9 | **D386 — dead `childrenWrap` opacity transition** (`tooltip-chrome.ts:403`) | **DECLINED.** The declaration cannot fire (only `display` is toggled, `:560,562`), so it has no pixel effect and removing it has no user-visible gain. `tooltip-chrome.ts` is imported by 8 charts including T0 `candlestick`; that blast radius is not worth spending on a no-op declaration. |
| 10 | **D386 — `ChartTooltipConfig.children` with zero consumers** | **DECLINED — and deliberately so.** It is part of the 27-field bklit `ChartTooltipProps` parity surface (`internal/types.ts:398-426`). Removing an unused *public* field is an API break, against the goal's third clause ("same components API"). Zero internal consumers is the expected state for a compatibility field. |
| 11 | **T14's `bkmRevealed`-stamp → `useRef` swap** | **DECLINED (re-affirmed, D387).** Storage churn across 9 charts including a T0 for zero sanctioned-API surface. |
| 12 | **T16's lone `document.getElementById`** | **DECLINED (re-affirmed, D389).** Latent only, and app hygiene rather than native adoption. |

**Nothing on this list is a parity defect.** Items 1 and 6 are instrument debt on a file this
role may not edit; 2 is a real decision deferred to its owner; 7, 8 are coverage debt; 9-12 are
declines with reasons. The three fixed items were comment-only.
