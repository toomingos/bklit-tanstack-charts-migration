# Phase 6 — Progress

- [ ] 6.1 Research (orchestrator-led)
  - [x] 01 focus styling / hover-dim
  - [x] 02 tooltip
  - [x] 03 hover geometry
  - [x] 04 axes
  - [x] 05 motion / reveals
  - [x] 06 brush + zoom
  - [x] 07 legend coupling
  - [x] 08 reach-in census — 259 sites baseline
  - [x] 00 seed map corrected (polar-states caveat, wipe-not-dash gap, blur channel, per-tick color)
- [x] 6.2 Map (`research/phase-6/go-to-plan.md`; D417-D419 logged; 6-commit ladder)
- [ ] 6.3 Implement (one commit per subsystem)
  - [x] C1 states+legend (D421, D424, D425)
  - [x] C2 tooltip (D426, D427)
  - [x] C3 hover-geometry (D428, D429)
  - [x] C4 axes (D430, D431)
  - [x] C5 motion+reveals (renderer switch, class rename) — D432, D433
    - [x] C5b riders — T21b timing (`ChartMotionTiming.delay` callback, D438) and the T8
          `<style class="ts-sankey__transitions">` move into `styles.css` (D443); **already
          dispatched to executor D**
  - [x] **C5c polar focus (T11, D435)** — D447, D448 — pie / ring / sunburst-*hover* drop `focus: focusDisabled`
        and consume `onFocusChange` against the existing static hitbox twin
        (`pie-chart.tsx:441-460`); ring needs the twin added. Kills `internal/pie-hover-chrome.ts`
        and `internal/ring-hover-chrome.ts`. Sunburst keeps `internal/sunburst-hit.tsx` for
        click/drill (D384's `onSelect` objection is upheld — the D32 bench dispatch carries no
        `clientX`/`clientY`). **Radar excluded, logged as an accepted deviation (D445)**, and its 32
        reach-in sites therefore retire under C5b's reveal work, not here. Largest census
        retirement left.
  - [x] **C5d sunburst semantic motion (T15 A+B, D436/D437)** — D449, D450, D451 — `radialArc` → `sunburst()`
        (`@tanstack/charts/hierarchy/sunburst`, sole carrier of `[sceneMotionNode]`), **angle parity
        vs `internal/sunburst-geometry.ts` verified BEFORE any motion change**; then the keyed zoom
        morph (`addSemanticPathUpdateTrack`) and renderer-identity replay
        (`renderer={useMemo(() => motion({initial:'always'}), [playKey])}`), including the ~10-line
        `pointerleave` re-bind inside `handleRender` (`sunburst-chart.tsx:669`, orphaned listener at
        `:828-840`). Per-arc *enter* stagger stays absent (D446).
  - [x] C6 brush+zoom+selection — D452–D458
- [ ] 6.4 Refactor (explore -> triage -> one refactor commit)
  - [ ] Riders from the Phase-5 re-audit: T6's expressible gradient set (~11 of ~19 def sites,
        mechanical once the renderer switch lands, D442) · T1's observer consolidation — one
        implementation, five thin wrappers, no second observer in `internal/brush-drag.ts:151`
        (D444) · reclassify `internal/y-axis-ticks.ts` as a **survivor** with three consumers
        (`candlestick-chart.tsx:71`, `internal/axis-ticks.ts:13`, `index.ts:458,505`), not a missed
        deletion (consistent with D431 item 7)
- [ ] 6.5 Gate (QA + bench + bundle M2c + census=0 + CI guard)

**Gate-scheduling constraint (from `research/phase-6/09-reopened-phase-5.md` §3).** T0/T1 exposure
order: candlestick + scatter in C5a, heatmap in C5b, pie + ring in C5c. **Do not stack C5b and C5c
on heatmap/ring inside one gate window** — a movement on either would be unattributable. Hover-cell
readings stay judged against the mode distribution, not a single sample (D402/D403).

**Provenance.** C5c and C5d are new rungs added 2026-09-01 from the Phase-5 re-audit
(`research/phase-6/09-reopened-phase-5.md`; ledger D434–D446). They were not in the 6.2 six-commit
ladder because the tasks they carry were closed as not-implementable in Phase 5 (D384, D404).

**Amendment 2026-09-01 (orchestrator) — C5a/C5b are merged, and the split is by chart group.**
`09-reopened-phase-5.md` §3 recommends the renderer switch land alone in a C5a commit, for a clean
bisect point against `dist/motion.js:612`'s tween-every-reconcile risk. That recommendation is
**noted and deliberately not taken.** The C5 dispatch was already in flight when the re-audit
landed, scoped by chart group rather than by rung — A line/area/composed · B bar/candlestick/scatter
· C polar · D sankey/heatmap/choropleth · E live-line — so switch and motion land together per
chart. Accepted cost: coarser bisect granularity within C5. Accepted because the switch is
**per-chart, not all-or-nothing** (D434), so a regression reverts one chart rather than bisecting a
monolith. Read every "C5a" and "C5b" above and in `go-to-plan.md`'s T20/T8/T21b rows as **C5**.

*Consequences for the gate-scheduling constraint.* The T0/T1 exposure order restates as: candlestick
+ scatter (executor B) and heatmap (executor D) now share **one** gate window inside C5. This does
not violate the constraint as written — that forbids stacking heatmap with **ring**, and ring is
C5c, a later window. It does mean a candlestick or scatter movement and a heatmap movement surface
together; attribute them by chart, not by rung. D402/D403's mode-distribution rule still governs.

*Rider ownership is asserted, not verified.* Line 20's "already dispatched to executor D" holds for
the `<style class="ts-sankey__transitions">` move (D443) — that correction was sent to D mid-flight,
scoped as **report, do not edit**, because `styles.css` is a shared file the orchestrator applies at
consolidation. It is **unverified for the T21b `ChartMotionTiming.delay` rider (D438)**: D's brief is
sankey/heatmap/choropleth *motion*, which may or may not have carried the seeded-PRNG delay route
explicitly. Resolve from D's actual report at C5 consolidation; if unowned, it becomes a C5c-window
rider, not a lost one. **The T6/T8 *gradient* conversion (~11 of ~19 sites, D442) was never D's** —
it remains a 6.4 rider as recorded at line 40.

**Resolved 2026-09-01 at C5 consolidation (D432, D433) — supersedes the paragraph above.** The
T21b `ChartMotionTiming.delay` rider (D438) **was** executor D's and is done (per-cell seeded-PRNG
delay ported verbatim from `heatmap-animation.ts:73-80`). The D443 `<style>` move landed as four
static rules in `styles.css`. The gradient rider (D442) is unchanged: 6.4.

**Also corrected at consolidation:** the C5 plan's orphan-deletion branch is void. An importer
sweep found `enter-transition.ts` (18 importers), `deferred-reveal.ts` (8), `native-stagger.ts`
(5), `heatmap-animation.ts` (4), `radar-spring.ts` (2) and each `*-reveal.ts` (1 apiece) all
**live**. Only `internal/live-hover-chrome.ts` was deleted (0 importers). The recorded
`ChartRevealClip` ↔ `enter-transition.ts` collision therefore **does not exist** — see D433.

**6.3 CLOSED 2026-09-01 (commits `4e5b237` C5c+C5d, C6 following).** All six rungs land; typecheck
exit 0. Two decisions are deliberately left **open for the user or the 6.5 gate**, not silently
absorbed:

1. **`hoverPop` is now an inert public prop (D450).** Sunburst's radial hover pop-out was live at
   HEAD and is not expressible on native `sunburst()` at 0.15.0 (no per-datum radius channel).
   Hover *dim* is preserved. Either mark the prop deprecated-inert or rebuild the pop-out as a
   `createMark` overlay. Reverting C5d is one commit.
2. **Uncontrolled `<ChartBrush>` no longer works (D455).** Native `brushX` needs a fully
   round-tripped controlled value. Inert today (all usage goes through `useBrushSelection`), but
   it narrows a public contract.

**Corrections that change 6.5's expectations — do not budget from the research docs alone:**
- `internal/zoom-engine.tsx` **survives unchanged at 663 LOC** (D457); `research/phase-6/06`'s
  Deletions line retires nothing for the zoom half. Correction appended to that doc.
- Choropleth census is **10 → 9**, not a module deletion. Six raw query sites survive there and
  must be counted, including the structural `:868` fallback.
- CI grep-guard named exceptions now also include: sunburst's D384 click/drill layer
  (`querySelectorAll('path[data-ts-key^="sunburst-arcs:"]')` + its `addEventListener("click")`)
  and sunburst's SB15 whole-stage 350ms mount fade (`container.querySelector("svg.ts-chart")`,
  same class as the accepted choropleth group fade, D433). Sunburst's
  `svg.ts-bkm-sunburst-labels` queries are **app-owned markup**, not reach-ins (D418).
- Dead but still barrel-exported after C5d: `buildHoverGrowTargets` / `applyHoverGrow` /
  `maxHoverSegmentThickness` (`internal/index.ts:30-32`) — 6.4 cleanup, gated on decision 1.
- `unprojectPoint` is dead public API kept deliberately (D458) — 6.4 revisit.

**6.5 gate item added by C5c (D448):** confirm sunburst's keyboard focus path and its pointer
overlay path cannot drive hover into conflicting states.
