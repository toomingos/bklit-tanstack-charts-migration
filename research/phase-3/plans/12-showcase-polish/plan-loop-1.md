# Initiative 12 — Showcase build + remaining type-debt + shell polish (plan-loop-1)

Status: FINAL — lead rulings recorded in §10 (D236)

This plan treats the prior read-only inventory report as ground truth for build-probe
output, the D208 defect register, debt greps, and demo-coverage gaps (not re-quoted
verbatim here; cited by claim). All other claims below are freshly file:line-verified
this loop unless marked UNVERIFIED.

## 1. Scope + non-goals

**In scope** (per lead ruling, frozen): (1) showcase production build green
(`npm run build` exit 0, no `ignoreBuildErrors`/`ignoreDuringBuilds`); (2) type + lint
gates green (`check-types`, `lint --max-warnings 0`); (3) demo coverage — wire the 3
orphaned demo files + build 5 net-new demos (brush, markers, patternarea, barsquares,
bardepth); (4) fix-or-waive every open D208 register item; (5) debt cleanup (dead code,
`.bak` file, `any`/`as unknown as` triage); (6) sidebar responsive shell polish.

**Out of scope**: bulk `as unknown as` elimination (188 casts — accepted debt); the
`profitloss`/`legendhover` showcase **routes** (see below); any edit to frozen
`scatter-chart.tsx`/`composed-chart.tsx` render logic except the narrow D208-8 keyframe
question, which is flagged as a lead-ruling ask (§9 Q1), not applied directly; `bench/`,
`qa/`, `repos/`, `docs/`, `research/` (beyond this one plan file); no new chart features.

**profitloss/legendhover disposition**: searched `docs/phase-3/LOG.md` D224/D226/D228/
D230 tails for an explicit "showcase route deferred to init 12" quote naming these two.
Found the pattern for brush ("showcase brush demo deferred to init 12", D228 tail) and
markers ("showcase markers/brush demos deferred to init 12", D230 tail), but **no
equivalent quote exists for profitloss or legendhover** — both exist only as permanent
bench/QA scenario pairs (D224 ruling 6: "ONE `profitloss` bench pair + ONE `legend`
QA-only pair"; D226: new `legendhover` bench/QA pair). Per the lead's own default
("OUT of scope unless an explicit deferral quote is found"), both stay **out of scope**
this initiative. Flagged as §9 Q10 in case this reading is wrong.

### Stale-audit corrections (disclosed)

`research/phase-3/audits/12-showcase-polish.md` (5 lines) makes four claims; three are
stale or partially stale:

1. **"`next.config.mjs` sets `typescript.ignoreBuildErrors` and
   `eslint.ignoreDuringBuilds` to true"** — **STALE.** Full read of
   `showcase/next.config.mjs` (66 lines) shows neither key present anywhere in the file.
2. **"Remaining `any` assertions occur in candlestick/sunburst code"** — **STALE.** A
   broad grep for `: any` / `as any` (excluding `as unknown as`, which is accepted debt)
   across `showcase/migrated/charts/**` returns exactly one hit outside the accepted-debt
   class: `internal/fade-mask.ts:28`, `any: boolean;` — a boolean-typed **property named
   `any`**, not a TypeScript `any` type (confirmed by reading the surrounding object
   shape at `fade-mask.ts:28,33,36,39,41`, all boolean flags). No genuine `any` usage
   found in candlestick or sunburst files.
3. **"skeleton/decimation parity is incomplete"** — **PARTIALLY STALE.** Decimation is
   fully implemented for the three time-series charts: `line-chart.tsx:14-16,146,204`,
   `area-chart.tsx:35-37,294`, `composed-chart.tsx:78-80,483` all call
   `decimateTimeSeries` from `internal/decimate.ts`. Bar and candlestick intentionally
   skip decimation as documented bklit-parity, not a gap: `bar-chart.tsx:187` ("bklit
   bar-chart.tsx: no decimation — every raw row renders as a bar"),
   `candlestick-chart.tsx:3,159` (citing D19: "bklit's own `decimateOhlcData` is dead
   code"). What genuinely remains open is D218's own explicit deferral (`docs/phase-3/
   LOG.md:36`): "gridTween phases snap + immediate `notifyYDomainTweenComplete` —
   y-domain tween itself stays initiative 12." Traced this to source: the
   `yDomainTween`/`yDomainTweenDuration` **props are already fully wired** in all three
   time-series charts (`line-chart.tsx:102-128`, `area-chart.tsx:112-167`,
   `composed-chart.tsx:326`) — the visual tween feature is not missing. What's missing is
   that the phase orchestrator's completion signal is a snap, not a real gate: e.g.
   `area-chart.tsx:194-198`
   ```
   React.useEffect(() => {
     if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
       notifyYDomainTweenComplete();
     }
   }, [chartPhase, notifyYDomainTweenComplete]);
   ```
   fires `notifyYDomainTweenComplete()` **immediately** on phase entry, in the same
   effect, rather than on the actual tween's real completion (matching pattern present
   at `composed-chart.tsx:358-364` and `line-chart.tsx:180-186`, same shape). This is an
   internal phase-bookkeeping gap, not a visible parity defect — see §6 for the spec.
4. **"sidebar fixed at `w-64` with unconditional `ml-64`"** — **CONFIRMED TRUE, not
   stale.** `showcase-layout.tsx:26` (`<aside className="fixed top-14 bottom-0 w-64
   ...">`) and `:52` (`<main className="ml-64 flex-1">`). See §6.

Not independently re-verified this loop: the audit's implicit "no shared migrated
chart-defs/chart-child-passthrough module" framing. `docs/phase-3/LOG.md` (D224)
references a `CHART_CHILD_PASSTHROUGH` Symbol marker already in use
(`ProfitLossLegendHoverProvider via CHART_CHILD_PASSTHROUGH Symbol marker + single-level
unwrap`), which suggests this claim is also stale, but the module itself was not opened
this loop — marked **UNVERIFIED**, not asserted as a correction.

## 2. Build-failure diagnosis

Reusing the inventory's verbatim Probe A/B results (not re-run this loop, per
instruction). Two symptoms: (a) `@tailwindcss/postcss` + `typescript` missing at build
time; (b) `Module not found: Can't resolve '@/components/chart-detail'`.

**Root cause, symptom (a)**: `showcase/package.json:7`
```
"prebuild": "bash scripts/clone-repos.sh && pnpm install --no-frozen-lockfile",
```
runs under `NODE_ENV=production` (set by Next's own production build environment /
Vercel). `@tailwindcss/postcss` (`postcss.config.mjs`'s sole plugin) and `typescript`
are both listed under `devDependencies` in `package.json` (confirmed by direct read).
The inventory's Probe B log itself carried pnpm's own diagnostic naming this exact
skip-devDependencies-under-NODE_ENV=production behavior. Context7 (`/websites/pnpm_io`,
`pnpm install` docs) confirms the exclude mechanism: `--prod` is the flag that drops
devDependencies (default installs both prod+dev) — consistent with pnpm's
environment-sniffing auto-applying the same effect when `NODE_ENV=production` is set and
no explicit flag overrides it.

Live corroboration this loop (no repo writes): `node_modules/.bin/eslint` and `.bin/tsc`
are both **missing** on disk right now; the packages exist only in the pnpm virtual
store (`node_modules/.pnpm/eslint@9.39.5.../`, `.pnpm/typescript@5.8.2/`). Invoking the
store's `eslint.js` directly failed with `ERR_MODULE_NOT_FOUND: Cannot find package
'eslint'` when resolving from `showcase/eslint.config.js`'s own directory — i.e. the
on-disk linking is broken in exactly the shape this diagnosis predicts (eslint itself is
almost certainly a devDependency too, though not directly grepped this loop).

**Proposed fix** (`package.json:7`):
```
"prebuild": "bash scripts/clone-repos.sh && NODE_ENV=development pnpm install --no-frozen-lockfile",
```
Context7 did not surface an explicit "NODE_ENV overrides pnpm's exclude behavior" doc
page (only the `--prod` flag semantics), so this exact syntax needs dispatch-time
empirical verification (`npm run build` is forbidden to this planning loop). Fallback
if the `NODE_ENV` override doesn't fully suppress the skip: add `--prod=false`
explicitly to the same install invocation. Flagged as §9 Q9.

**Root cause, symptom (b)**: `showcase/components/chart-detail.tsx` **exists** on disk
(508 lines, read in full). `showcase/tsconfig.json`'s `paths["@/*"]` resolves to
`["./*", "./repos/bklit-ui/packages/ui/src/*"]` (`baseUrl: "."`), which should map
`@/components/chart-detail` → `./components/chart-detail.tsx` correctly.
`next.config.mjs`'s `webpack()` function only adds `@showcase/*` and tanstack aliases and
spreads (preserves) the existing `config.resolve.alias` — no conflicting override for
`@/*` exists anywhere in the file. `app/charts/area/page.tsx:1-7` confirms the exact
`import { ChartDetailPage } from "@/components/chart-detail";` pattern that fails in the
build probe. **Working hypothesis** (not provable without running the build): symptom
(b) is a **downstream symptom of symptom (a)** — a build that fails early because
`typescript`/other devDependency packages are absent from `node_modules` can leave
webpack's module-resolution pass in a corrupted or incomplete state, cascading into
spurious "module not found" errors for otherwise-valid `@/*`-aliased imports that would
resolve fine on a clean install. Needs dispatch-time re-verification: apply the WP1 fix,
run `npm run build`, confirm **both** symptoms clear together before concluding this
hypothesis holds. If symptom (b) persists after (a) is fixed, it needs its own
standalone diagnosis (not currently speced — flag back to lead if this branch is hit).

## 3. Lint state + fix classes

Attempted a fresh live run twice this loop, per instruction ("running is allowed, it
modifies nothing"): `cd showcase && npx eslint . --max-warnings 0` →
`sh: eslint: command not found` both times. This is the same broken-linking symptom
diagnosed in §2 (eslint binary absent from `node_modules/.bin`), so **a current live
count could not be obtained without first applying the §2 install fix**, which this loop
is not permitted to do (no repo writes).

**Falling back to the last known-good figure**: per `docs/phase-3/LOG.md` D204, **138
lint problems (58 errors / 80 warnings)**, confined to `showcase/migrated/charts/**`.
This number **predates initiatives 8–11** (legend/profitloss, brush, markers,
patternarea/barsquares/bardepth), which added substantial new code, so it should be
treated as stale/approximate, not authoritative. `eslint.config.js:44-48` shows the only
two custom-configured rules are both `"warn"` severity:
`@typescript-eslint/no-unused-vars` (with `^_` ignore pattern) and
`@typescript-eslint/no-explicit-any`. The 58-error bucket in D204's count is therefore
not explained by these two rules and most likely comes from
`eslint.configs.recommended` / `tseslint.configs.recommended` / Next's
`core-web-vitals` defaults (not classified further this loop — no live run available).

**Proposed fix classes** (mechanical, apply without lead ruling, per D204 precedent
"lint clean under `--max-warnings 0`, no eslint-disable needed" as the house style):
unused-vars → prefix with `_` or delete; explicit-any → replace with a concrete type or
`unknown` + narrowing. **Order dependency**: WP1 (build/install fix) must land first —
it is the only way to get a fresh, accurate live count and classify the current 12
initiatives' worth of accumulated code, several of which (8–11) closed with "lint PASS"
individually but have never been measured together against the full `--max-warnings 0`
gate in one combined run since D204.

## 4. Demo coverage

**Standard wiring pattern** (confirmed via `components/demos/bar.tsx` (24 lines) +
`components/chart-stage.tsx` (60 lines) + `lib/chart-data.ts` (459 lines) +
`app/charts/area/page.tsx` (7 lines)):

1. `showcase/components/demos/{route}.tsx` — **one default export**, shaped
   `({impl, n}: {impl: "bklit" | "migrated"; n: number})`, switching between the
   `BklitCharts.X` / `MigratedCharts.X` namespaces on `impl`. For fixed-data demos (no
   size-dependent generation), alias `n` to `_n` unused, per `bar.tsx`'s own precedent
   (`{impl, n: _n}`).
2. `showcase/components/chart-stage.tsx` — add one
   `dynamic(() => import("./demos/{route}"), {ssr:false})` declaration (top of file,
   16 existing examples) + one `registry["{route}"] = ...` entry in the hardcoded
   `Record<string, DemoComponent>` object.
3. `showcase/lib/chart-data.ts` — add one `ChartInfo` entry to the `allCharts` array
   (route, name, status, tanstackExpression, notes, docRefs, defaultN, aggregateM1a,
   qaResult, benchG4, waivers, waiverDetails, gap). This single array feeds **both** the
   sidebar nav (`showcase-layout.tsx:10-16`, `navigation = allCharts.map(...)`) and
   `ChartDetailPage`'s registry lookup (`chart-detail.tsx:396`,
   `allCharts.find((c) => c.route === route)`) — no separate nav-list edit needed.
4. `showcase/app/charts/{route}/page.tsx` — thin route file, `ChartDetailPage`
   import + render, per `area/page.tsx`'s 7-line pattern exactly.

### 4.1 Three orphaned demo files — architectural mismatch found

`components/demos/reference-area.tsx` (82 lines) and `segment.tsx` (74 lines) each
export **multiple named functions** (`ReferenceAreaBandDemo`, `ReferenceAreaPatternDemo`,
`ReferenceAreaMarkersDemo`, `ReferenceAreaAreaDemo`, `ReferenceAreaBarDemo`,
`ReferenceAreaComposedDemo`; `SegmentLineDemo`, `SegmentAreaDemo`), each taking
**zero/minimal props** and rendering **`MigratedCharts` only — no bklit-side branch at
all**. `projection.tsx` (57 lines) is closer — exports `ProjectionDemo1`/
`ProjectionDemo2`, each taking `{impl}` and switching Bklit/Migrated — but still lacks
`n` and still has multiple named exports instead of one default. **None of the three
fit the registry's single-default-export `{impl,n}` dual-render contract**:
`ChartDetailPage` unconditionally renders **both**
`<ChartPreview impl="bklit" .../>` and `<ChartPreview impl="migrated" .../>` side by
side (`chart-detail.tsx:452-453`), and `chart-stage.tsx`'s registry has exactly one
component per route.

Investigated `showcase/app/charts/verify-props/page.tsx` (89 lines, untracked) as a
possible existing template for hosting multi-variant demos — its own header comment
(line 1) reads: **"THROWAWAY verification page — deleted immediately after smoke
test"** for gauge/radar/heatmap prop smoke-testing. It is unrelated to reference-area/
segment/projection and is **not a usable wiring precedent**; no existing convention in
the repo solves the multi-variant/migrated-only mismatch.

**Proposed wiring approach**: for each of the 3 features, write **one new** default-export
`{impl,n}`-shaped wrapper component (new file or an added default export in the existing
file) that picks one representative canonical variant (e.g. `ReferenceAreaBandDemo`'s
band+markers config for reference-area; `SegmentLineDemo` for segment; `ProjectionDemo1`
for projection) — with a genuine bklit-vs-migrated branch, since the existing functions
render migrated only. This requires confirming `BklitCharts` exports an equivalent
reference-area/segment component for the bklit-side column — **UNVERIFIED this loop**
(not checked; flagged as §9 Q3, a dispatch-time prerequisite before committing to this
shape).

### 4.2 Five fully-missing demos — deferred features

All five have **confirmed public exports** in `showcase/migrated/charts/index.ts`:
`PatternArea` (:203), `BarSquares` (:206), `BarDepthProvider`/`BarDepthBack`/
`BarDepthFront` (:208-210), `ChartMarkers` (:225, + `ChartMarkersOverlay`/types),
`BrushLayout`/`ChartBrush` (:333-348). All five are explicitly deferred to init 12 in
`docs/phase-3/LOG.md`: D228 tail ("showcase brush demo deferred to init 12"), D230 tail
("MarkerTooltipContent + showcase markers/brush demos deferred to init 12"), and the
initiative-11 tail note (`PROGRESS.md` row 11: "Initiative-12 candidates recorded").

Reference usage exists in bench scenarios — `bench/app/src/scenarios/migrated-brush.tsx`
(142 lines, read in full: `BrushLayout` + `ChartBrush` composition, `brushStripMargin`,
`selectionPattern={{color, preset:"diagonal"}}`, `tweenYDomainOnXDomainChange`,
`yDomainTween`) and `migrated-markers.tsx` (125 lines, read in full: `ChartMarkers`
cluster/single-date marker items, `dashFromIndex`, `ChartLegendHoverProvider` +
`ChartLegend` pairing) — but these use `{n}` / `{n, state}` **single-impl** props (no
`impl` switch; bench scenarios are migrated-only by design) and are **not directly
reusable** as showcase demo files, only as composition references. **UNVERIFIED this
loop**: whether `BklitCharts` exports equivalent brush/markers/patternarea/barsquares/
bardepth components for the required bklit-side comparison column — flagged as §9 Q4,
a dispatch-time prerequisite for all 5.

## 5. D208 register dispositions

Full register text read from `docs/phase-3/LOG.md:17` (original 7 items) plus later
additions found via `grep -n "D208-[0-9]"` across the whole log (D209, D218 tail, D220
tail, D221, D235-class tail).

1. **bar settled 17.8045%** — **FIXED** (D209: grouped-layout `group({scale})` fix,
   independently re-verified 0.0000% settled). No action.
2. **pie hover-30** (drift 2.64% → 3.11% → 3.18%) — **OPEN DEFECT**, per D221's explicit
   correction ("D208-2 is an OPEN DEFECT, never a waiver; LOG language corrected
   henceforth"). D221 already ruled out a code-diff cause ("dim formula is bklit-identical
   with zero uncommitted diff"); working theory is a `hoveredIndex` hit-test mismatch at
   high (n=1000) density. `pie-chart.tsx`'s hover coordinator
   (`hoveredIndex`/`onHoverChange`/`coordinatorRef`, lines 201,233,246-247,261-264) is
   commented "unchanged from D49" (line 246 area) — consistent with the defect being in
   angle/index hit-test geometry, not the dim-application code, but the actual
   pointer→angle→index mapping module was not traced this loop. **Propose FIX**: (a)
   read the hit-test/coordinator source in full (`createPieHoverCoordinator` /
   `createPieSliceHoverRuntime`, not yet opened), (b) diff against bklit's pie hit-test
   at n=1000, (c) reproduce via a bench pie n=1000 hover probe, (d) fix + Q1 re-verify.
   Estimated risk: MEDIUM (touches interaction code, not render structure; should stay
   D210-class-safe for bench, but needs a real Q1 hover re-run, not a waiver).
3. **ring hover ~1.6–1.7%** — original registration text: "same class as (2)" — never
   independently re-disposed in any later LOG entry found this loop (unlike pie, which
   D221 explicitly re-ruled). `ring-chart.tsx`'s hover-coordinator plumbing is
   near-identical in shape to pie's (lines 209,249,263-264,278-281 vs pie's
   201,233,246-247,261-264). **Propose FIX**: dispatch together with item 2 — same
   root-cause investigation, likely the same fix. Same MEDIUM risk estimate.
4. **choropleth hover-30 tooltip absent** — **WAIVED** (D208 original: "intentional
   divergence... RULING: WAIVED as intentional improvement"). No action, record
   disposition only.
5. **heatmap hovers 0.5006–0.5069%** (marginal vs 0.5% gate) — registered "re-evaluate
   after initiative 4," but never formally re-disposed afterward; D218 and D221 both
   continued citing the same ~0.50–0.59% band, unchanged, across unrelated render-path
   work. **Propose formal WAIVE**: the band has sat at the gate edge, essentially static,
   through at least 3 initiatives of unrelated changes (D214: 0.5197–0.5945; D218:
   0.52–0.59; D221: cited again) — evidence of a structural sub-pixel characteristic
   rather than a real defect, the same "gate-edge stability" class already accepted for
   candlestick n=1000 (item 10 below). Flagged for confirmation at §9 Q6.
6. **liveline m1c +38% / idle M2a 7.5ms vs frozen 0.0** — original disposition:
   "post-freeze main drift, origin commit unbisected." No later LOG entry re-checks or
   re-disposes this item. **Propose**: a cheap prerequisite check (one fresh liveline
   bench run vs same-day bklit) before formalizing a WAIVE — if the drift is unchanged
   from its original registration, waive as pre-existing/unattributed; if it has grown,
   flag for investigation instead. Flagged at §9 Q7.
7. **sankey idle M2a 1.83ms vs 0.03** — original disposition: "fix when sankey is next
   touched." `git log` shows sankey **has** been touched since registration (`5a2c444
   fix(sankey): TanStack-native link reveal + correct link widths`, `3d99823
   feat(sankey): enter-transition API + reveal replay fix`), but no LOG entry
   documenting a post-touch idle-timer re-check was found in the D207–D230-tail range
   read this loop (these commits may belong to an initiative whose LOG entry sits outside
   the range covered, or may not yet be logged). **Propose**: the "fix when touched"
   trigger has now fired — dispatch a single fresh sankey idle-M2a bench probe before
   writing any disposition; if already near 0.03ms (fixed as a byproduct of the reveal
   rewrite), just record it; otherwise it's a small standalone fix per the original
   "lingering rAF/timer" hypothesis. Flagged at §9 Q5.
8. **bar/composed/legendhover WAAPI unitless-keyframe warnings** — bar: **FIXED**
   (already landed; `bar-chart.tsx:840-841,865-866,898-899,921-922` all confirmed
   `px`-suffixed on disk, matching the barsquares-fix pattern cited in the LOG tail:
   "Lead fix bar-chart.tsx: `px` units on all four height-keyframe sites"). composed:
   **root cause found, NOT fixed** — `composed-chart.tsx:1172-1173` still passes unitless
   `height:"0"` / `height:String(targetHeight)` values into a `rectEl.animate([...], {...})`
   WAAPI call (full call spans lines 1170-1181). legendhover: its 100 warnings almost
   certainly come **solely** from its embedded `ComposedChart` — confirmed by reading
   `bench/app/src/scenarios/migrated-legendhover.tsx` (179 lines) in full: it renders
   both a `<ComposedChart>` (SeriesBar+Area+Line) **and** a separate `<BarChart>` under
   one `ChartLegendHoverProvider`; since BarChart's keyframes are already fixed,
   legendhover's residual warnings can only originate from the ComposedChart child. **One
   fix** at `composed-chart.tsx:1172-1173` (same `px`-suffix pattern as the 4 already-
   fixed bar-chart.tsx sites) would resolve both composed's 200 and legendhover's 100
   warnings. **BUT**: `composed-chart.tsx` is a frozen file per this initiative's own
   out-of-scope carve-out, and the task brief is explicit — "if the fix would require
   editing composed-chart.tsx itself, flag it as a lead ruling question instead." Root
   sits directly in the frozen file, not a shared internal module. **Flagged as §9 Q1** —
   not applied without authorization.
9. **composed m2a_idleTask band 38–46ms** — noted "not gated" repeatedly (D218, D221),
   disposition on record: "fix when composed enter animation is next audited" (D220
   tail). No standalone fix dispatched since. **Propose formal WAIVE** for this
   initiative: root cause sits in composed-chart.tsx's enter-animation internals, beyond
   the narrow D208-8 keyframe question and outside the frozen-file carve-out — record as
   a deferred item pending a future dedicated composed-chart audit initiative, not
   silently dropped.
10. **candlestick n=1000 hover off-by-one** — already diagnosed BENIGN by D221 (adjacent-
    candle selection at ~1.1px pitch, nearest-scan vs `bisectDateLeft` mismatch,
    "sat at the gate edge for weeks"). **Propose formal WAIVE** (already characterized,
    stable, benign). Separately, D221 noted an unactioned process gap ("formalize an
    n=1000 baseline table") — flagged at §9 Q8 (in scope for init 12, or defer further).

## 6. Debt + shell polish

**`void squareSizeForMarks` dead code** (`bar-chart.tsx:449-450`):
```
449:    const squareSizeForMarks = totalN > 0 ? (bandWidth - (totalN > 1 ? GROUP_GAP : 0) * (totalN - 1)) / totalN : 0;
450:    void squareSizeForMarks;
```
Repo-wide grep for `squareSizeForMarks` across `showcase/**/*.ts*` (excluding
node_modules) returns **only these two lines** — confirmed genuinely dead, safe to
delete both.

**`internal/tooltip-chrome.ts.bak`**: per D218's own note ("Leftover
`internal/tooltip-chrome.ts.bak` (prior executor's backup) left in place per no-delete
rule — cleanup deferred to initiative 12"), the inventory's read-only sweep found this
file **already absent on disk**. Record as a ruling note only — no action needed, close
the deferred item.

**188 `as unknown as` casts** — accepted debt per lead ruling, no bulk elimination this
initiative. No provably-wrong or lint-blocking instance was identified this loop
(`no-explicit-any` does not flag `as unknown as X`, since neither side of the cast is
literally `any`). Propose leaving the count as-is; note for future initiatives if a
specific instance surfaces as a genuine problem.

**Candlestick/sunburst `any`** — confirmed stale per §1; no action.

**Sidebar shell polish** (`showcase-layout.tsx:26,52`):
```
26:      <aside className="fixed top-14 bottom-0 w-64 ...">
...
52:        <main className="ml-64 flex-1">
```
Fixed-width sidebar, no responsive collapse — narrow viewports get a permanently
visible 256px sidebar plus a permanently-offset main column. **Propose minimal
treatment**: hide the sidebar below a breakpoint and gate the margin the same way —
`className="fixed top-14 bottom-0 w-64 hidden md:block ..."` on the `<aside>`,
`className="md:ml-64 flex-1"` on the `<main>` (drop the unconditional `ml-64`, apply it
only at `md:` and up). This avoids a broken double-margin/no-nav layout on narrow
viewports without building a full mobile hamburger/drawer nav, which would be a
larger feature than "polish." Flagged at §9 Q2 for confirmation that this minimal
treatment (vs. a real mobile nav) is what the lead wants.

**Responsive route-verification checklist** (spec only — no browser tooling exercised
this loop): after the class change, verify at ≥3 viewport widths (375 / 768 / 1280px,
i.e. below/at/above the `md` breakpoint) on at least the overview page and one chart
detail page: (a) sidebar fully hidden, not clipped, below `md`; (b) main content fills
full width with no dead `ml-64` gap below `md`; (c) sidebar+content render unchanged at/
above `md` (no desktop regression); (d) no horizontal scrollbar introduced at any width.

## 7. Execution order — dispatchable work packages

1. **WP1 — Build fix**: apply the `NODE_ENV` override to `package.json:7`'s `prebuild`
   script (§2); run `npm run build`; confirm both symptoms (a) and (b) clear together.
   Blocks WP2 (need a working install to get a live lint count).
2. **WP2 — Lint sweep**: fresh `eslint . --max-warnings 0` post-WP1; classify current
   problems; apply mechanical fixes (unused-vars, explicit-any); re-run to green or
   explicitly documented per-rule waivers.
3. **WP3 — D208-8 composed/legendhover keyframes**: gated on §9 Q1's answer. If
   authorized, apply the `px`-suffix fix at `composed-chart.tsx:1172-1173`; re-run
   `console-errors.mjs` on composed + legendhover, confirm zero WAAPI warnings.
4. **WP4 — D208-2/D208-3 pie/ring hover hit-test**: investigate + fix + Q1 re-verify
   for both charts together.
5. **WP5 — D208-5/6/7/9/10 dispositions**: apply waivers as proposed in §5; D208-7
   needs one cheap sankey bench probe first (§9 Q5); D208-6 needs one cheap liveline
   bench probe first (§9 Q7).
6. **WP6 — Debt cleanup**: delete the dead `squareSizeForMarks` lines
   (`bar-chart.tsx:449-450`); record `.bak` file as already-absent (docs update, outside
   this plan's write scope — dispatch executor's normal closure step).
7. **WP7 — Shell polish**: apply the responsive sidebar class changes (§6); execute the
   responsive-verification checklist.
8. **WP8 — Missing-feature demo wiring**: brush, markers, patternarea, barsquares,
   bardepth — gated on §9 Q4 (bklit-side component availability check first), then
   apply the standard 4-step wiring pattern (§4) to each.
9. **WP9 — Orphaned demo wiring**: reference-area, segment, projection — gated on §9 Q3
   (bklit-side equivalent availability), then apply the proposed adapter-wrapper
   approach (§4.1).
10. **WP10 — Final gate pass**: full `check-types` + `lint` + `npm run build` green;
    `console-errors.mjs` across all routes including new ones; Q1 screenshot compares
    scoped to whichever of pie/ring (WP4) and composed/legendhover (WP3) actually
    landed; G1–G4 — D210-class waiver proposal for anything that's demo-wiring-only, a
    narrow same-day spot-check sweep (not a full 16-run sweep) for anything that touched
    render/interaction code (WP3/WP4), per the D220/D221 precedent for narrow-scope
    changes.

## 8. Gate plan

- `cd showcase && pnpm run check-types` — exit 0.
- `cd showcase && pnpm run lint` (`eslint . --max-warnings 0`) — exit 0, or explicit
  documented waivers.
- `cd showcase && npm run build` — exit 0. No `typescript.ignoreBuildErrors`, no
  `eslint.ignoreDuringBuilds`.
- `node qa/console-errors.mjs` (or per-route invocation) — zero console errors across
  all routes, **including** every route added by WP8/WP9. D208-8 warnings excluded from
  the gate only if WP3 is **not** authorized/landed; if WP3 lands, composed/legendhover
  must show zero warnings too, same as bar today.
- Q1 `qa/screenshot.mjs` — scoped narrowly: pie + ring (if WP4 lands), composed +
  legendhover (if WP3 lands). No other chart's render path changes this initiative, so
  no full 17-scenario re-sweep is warranted — D210-class narrow-scope justification, per
  precedent (D220/D221 both scoped Q1 to only the touched charts).
- G1–G4 bench — D210-class waiver proposed for the whole initiative by default (demo
  wiring adds new routes but no render-path change to existing charts; debt cleanup and
  shell polish are non-perf-affecting). If WP3 or WP4 land, a narrow same-day spot-check
  sweep (not the full 16-run sweep) suffices per the D220/D221 precedent ("same-day
  spot-check... no render-path change" evidence pattern).
- Q3 boundary check — grep every new/edited internal module for forbidden patterns (raw
  `"ready"` strings outside comments/docstrings, deep `@tanstack/*/src` imports,
  scheduler forks), replicating the D218/D220 Q3 methodology.

## 9. Open questions for lead ruling

**Q1.** D208-8: authorize a narrow, mechanical, behavior-neutral edit to
`composed-chart.tsx:1172-1173` (add `"px"` suffixes to two WAAPI keyframe values,
identical in kind to the already-approved bar-chart.tsx fix)? This is the only way to
close composed's 200 and legendhover's 100 console warnings; the fix's root sits
directly in the frozen file, not a shared internal module, so it falls outside the
current scope rules without explicit authorization.

**Q2.** Shell polish: is the minimal "hide sidebar below `md`, gate `ml-64` the same
way" treatment sufficient, or does the lead want a real mobile hamburger/drawer nav
instead? The minimal treatment is proposed in §6 as in-scope for "polish"; a full mobile
nav is a larger feature.

**Q3.** Orphaned demos (reference-area/segment/projection): do `BklitCharts` equivalents
exist for these components, enabling the standard dual-column bklit-vs-migrated demo
shape? If not, should `ChartDetailPage`/`ChartPreview` gain a migrated-only single-column
preview mode for these three routes, or should they stay deferred beyond init 12?

**Q4.** Missing-feature demos (brush/markers/patternarea/barsquares/bardepth): same
bklit-side-availability question as Q3 — confirmed migrated-side exports exist
(`migrated/charts/index.ts`), bklit-side was not checked this loop.

**Q5.** D208-7 (sankey idle M2a): the "fix when touched" trigger appears to have fired
(`5a2c444`, `3d99823` sankey commits post-date the registration), but no LOG entry
documenting a post-touch re-check was found in the range read this loop. Should WP5
include a fresh bench probe before writing any disposition, or does the lead already
know the current idle-M2a number from work outside this loop's LOG read range?

**Q6.** D208-5 (heatmap hover marginal-fail, 0.50–0.59% vs 0.5% gate): confirm or
override the proposed formal WAIVE (gate-edge stability across 3+ initiatives).

**Q7.** D208-6 (liveline m1c/idle drift): confirm or override the proposed
"cheap-recheck-then-waive" plan, or supply a more recent liveline bench result if one
exists outside this loop's LOG read range.

**Q8.** D221's noted-but-unactioned process gap ("formalize an n=1000 baseline table or
snap harness hover-x to marks at high density") — in scope for this initiative, or
defer further as a process/tooling item unrelated to a specific chart defect?

**Q9.** Build fix syntax: Context7 confirmed `pnpm install`'s `--prod` flag semantics
(excludes devDependencies) but did not surface an explicit "`NODE_ENV=production`
auto-triggers the same exclusion" doc page. Should dispatch try the proposed
`NODE_ENV=development pnpm install --no-frozen-lockfile` override first and empirically
verify, or does the lead prefer the more explicit `--prod=false` flag from the start?

**Q10.** profitloss/legendhover: confirmed no explicit "showcase route deferred to init
12" quote exists for either (unlike brush/markers, which have one each). Confirm this
reading is correct — both stay out of scope as showcase **routes** this initiative
(their bench/QA scenario pairs are unaffected either way) — or does "showcase build
green" implicitly require giving every bench-only scenario a showcase route eventually,
starting now?

## 10. Lead rulings (D236)

**Q1 — AUTHORIZED, and already applied by lead.** The composed-chart.tsx freeze is a
process guard protecting gated render baselines, and the px-suffix keyframe fix is the
identical behavior-neutral pattern already applied (and QA-0-diff-proven) on the equally
gated bar-chart.tsx. Lead applied the 2-line edit at `composed-chart.tsx:1172-1173`
directly (height values only — `y` stays unitless, exactly mirroring the bar-chart.tsx
:840-841 fix shape). Mandatory verification in WP10: Q1 composed compare (expect
pass-class, visual no-op) + `console-errors.mjs` showing composed AND legendhover at 0
warnings. No other line of composed-chart.tsx may be touched; the freeze stands.

**Q2 — Minimal treatment confirmed.** `hidden md:block` on the aside + `md:ml-64` on
main. A mobile drawer/hamburger nav is explicitly out of scope.

**Q3 + Q4 — RESOLVED, dual-column achievable for ALL 8 demos.** Lead verified:
`@showcase/bklit-charts` is `export * from showcase/repos/bklit-ui/packages/ui/src/charts/index`
(`showcase/packages/bklit-charts/index.ts:3`), and that index exports `ReferenceArea`
(:468), `SegmentBackground`/`SegmentLineFrom`/`SegmentLineTo` (:514-522), `ProjectionLine`
+ `ProjectionLineEndMarker` (:429-435), `ChartBrush` + `ChartBrushLayout` + overlays
(:79-97), `ChartMarkers` (:354), `PatternArea` (:362), `BarSquares` (:61), and
`BarDepthProvider`/`BarDepthBack`/`BarDepthFront` (:46-56). All 8 demos use the standard
single-default-export `{impl, n}` dual-column shape; the orphaned files get an added
default-export wrapper picking the canonical variant per §4.1. Bench scenario pairs
(`bench/app/src/scenarios/{bklit,migrated}-*.tsx`) are the composition reference for
both columns.

**Q5 — Probe first.** WP5 includes one fresh sankey bench run (idle M2a is the number
of interest); disposition written from the measured value: near-baseline → record
fixed-as-byproduct of `5a2c444`/`3d99823`; unchanged → waive at negligible duty
(~0.04%) with "fix when next touched" carried forward. No fix dispatched from this
initiative unless the probe shows growth.

**Q6 — WAIVE confirmed** (D208-5): gate-edge stability across 3+ initiatives of
unrelated render-path work is structural sub-pixel characteristic, same class as
D208-10.

**Q7 — Recheck-then-waive confirmed** (D208-6): one fresh liveline bench probe in the
same WP5 batch as sankey's; unchanged-or-better → waive as pre-existing/unattributed
drift; grown → escalate to lead before any disposition.

**Q8 — DEFERRED.** The n=1000 baseline table is process/tooling, not a chart defect;
out of scope for initiative 12. Recorded in D236 as an open process item.

**Q9 — `--prod=false` first.** Use the documented flag:
`pnpm install --prod=false --no-frozen-lockfile` in prebuild. The `NODE_ENV=development`
override is the fallback if the flag alone doesn't defeat the env sniffing; dispatch
verifies empirically with a full `npm run build`.

**Q10 — Confirmed out of scope.** profitloss/legendhover have no deferral quote and
stay bench/QA-only; "showcase build green" carries no implicit
every-scenario-gets-a-route requirement.

**Execution channel ruling:** WP1+WP2+WP6+WP7 → one cmd-executor dispatch (mechanical,
exactly spec'd). WP4 (pie/ring hit-test) → Sonnet agent after the mechanical batch
lands (avoids concurrent edits with the lint sweep). WP8+WP9 (8 demos) → Sonnet agent
(composition quality). WP3 already landed (lead, above). WP5 probes + WP10 gates →
final cmd-executor suite dispatch (never parallel with another suite dispatch).
