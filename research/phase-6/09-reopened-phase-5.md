# 09 — Reopened Phase-5 task-groups (re-audit against the post-C4 architecture)

**Date:** 2026-09-01 · **Pin:** `@tanstack/charts@0.15.0` + `@tanstack/react-charts@0.15.0` (exact)
· **Tree state at audit:** HEAD = **C4 (`fa18bd9`)**. C5 is **not** in the tree — its executor died
and the partials are parked at `stash@{0}` ("C5 dead-executor partials (non-compiling) —
candlestick/line/scatter/heatmap"). The only C5 artifacts present are three untracked helpers:
`internal/motion-renderer.ts`, `internal/reveal-wipe.ts`, `internal/reveal-easing.ts`. **No chart
passes a `renderer` prop today.**

This file is a re-audit of the **six Phase-5 task-groups that closed with zero code changed** —
B1c (T5), B1d (T1), B2 (T6 T7 T8 T21a), B3 (T9 T10 T11 T12 T21a), B4 (T13), B7 (T20 T15) — plus
T21b, conducted against the **current** tree rather than Phase 5's starting state. Phase 6's C1–C4
commits (`fb8c92e` states+legend, `aea3bea` tooltip, `1323172` hover-geometry, `fa18bd9` axes)
changed the architecture those rulings were made against, and D417's standing rule requires every
"the library can't do X" verdict to be re-tested at the pin. Every route below carries file:line
evidence from the current tree and/or `dist`; where a capability really is missing, §4 gives the
dist proof and the version stamp. Ledger entries **D434–D444** point here.

Out of scope and not re-litigated: funnel migration (D30/D54), sunburst label overlay (D405),
loading states, legend UI (#95), `@visx` package uninstall (D392), protected QA harness files
(D402/D395). Parity with legacy is the law; QA baselines are inherited, not re-run; hover-cell
readings are known-noisy (D402/D403, ±1 device-pixel tooltip quantization).

---

## 1. Verdict table

| # | Verdict | One-line justification | Key evidence |
|---|---|---|---|
| **T13** | **ALREADY DONE** | C2 (`aea3bea`) shipped native `tooltip` ext + `renderTooltipBody` on 9 charts + 4 internals; all five D386 blockers are moot or retired. | `composed-chart.tsx:1440-1456`; `renderTooltipBody` in 9 charts; D426 |
| **T12** | **ALREADY DONE** | C3 (`1323172`) native `crosshair()` with `url(#…)` gradient stroke + `whenFocused` dots; date pill kept as app UI (sanctioned). | `internal/hover-geometry.ts:42`; `line-chart.tsx:1291,1459`; D428 |
| **T9** | **ALREADY DONE** | C3 replaced the raw bisectors: composed resolves via `interaction.clientToScene` + dual raw/decimated bisect → `setControlledFocus(…,{source:'pointer'})`; heatmap same. | `composed-chart.tsx:1686,1698,1703`; `internal/heatmap-components.tsx:766-778` |
| **T5** | **ALREADY DONE** (1 logged residual) | C4 deleted all three HTML axis overlays; charts now declare native `ticks`/`tickLabels` incl. per-tick `opacity` fade. Residual: no per-tick `fill` channel. | `internal/` has no `*-axis-overlay.tsx`; `area-chart.tsx:1021-1060,1367`; `bar-chart.tsx:944-983`; D430/D431 |
| **T10** | **ALREADY DONE** (different mechanism) | The custom `ChartFocusStrategy` D383 refused is unnecessary: sankey now emits real `ChartPoint`s for nodes *and* links and bridges element hover into native focus. | `internal/sankey-mark.ts:308-315,400`; `sankey-chart.tsx:399-408,506-510` |
| **T21a** | **ALREADY DONE** | Colour channel (`color:{scale}`) and declarative `states` both live in the heatmap definition; D381/D382's "nothing populates focus" is retired by C2/C3. | `internal/heatmap-components.tsx:238,477,499,513,718` |
| **T20** | **NOW UNBLOCKED** | The switch is 2 lines/chart: `/tooltip` exports **both** `Chart` (static) and `RendererChart` (`renderer` required). `motion()` also supplies `capabilities.tooltipMotion`, retiring D386(1). | `react-charts/dist/tooltip.d.ts` (both exports); `RendererChart.d.ts:4`; `charts/dist/motion.js:473-494` |
| **T11** | **NOW UNBLOCKED** (pie/ring/sunburst) · **PARTIAL** (radar) | `affinity:'geometry'` is containment-tested *first* and pie already ships a static transparent hitbox twin mark — D254/D258's own standing fix. Radar blocked: polar marks have no `states`. | `dist/nearest.js:47,63-80`; `dist/polar.js:218,230`; `pie-chart.tsx:441-460`; `radar-chart.tsx:436-439` |
| **T21b** | **PARTIAL** — binning half correctly VOID, timing half **NOW UNBLOCKED** | D390 tested only `stagger()`. `ChartMotionTiming.delay` accepts `(ctx)=>number` and `ctx.datum` carries the full row → the Lehmer PRNG on `(column,row)` is directly expressible. | `dist/types.d.ts:412-421,448-452`; `internal/heatmap-animation.ts:51-80` |
| **T6** | **PARTIAL** | Under `motion()` the resources renderer is the **default**, so `gradients:` works everywhere with no `renderSvg` prop. ~11 of ~19 def sites are bbox-expressible; radial/userSpaceOnUse/`<pattern>` are not. | `dist/motion.js:484,488,568,616`; `dist/svg.js:16-23,50` |
| **T8** | **PARTIAL** | Gradient half is a real conversion (link bbox ≡ gradient extent); `<style>` injection is replaceable by `styles.css`; only the `stroke-dashoffset` dash-sweep must stay a sanctioned extension. | `internal/sankey-animation.ts:89-123`; `internal/sankey-mark.ts:444-445`; `dist/motion.js:1315-1336` |
| **T1** | **PARTIAL** (criterion restated) | Native fluid sizing is already adopted where expressible; `use-container-size` has **15 consumers across 14 charts** feeding out-of-scene overlay geometry, not the `<Chart>` size. Consolidation, not deletion. | `internal/use-container-size.ts:31,58,108,165,201` + the 15 call sites in §2.6 |
| **T15** | **ROUTE EXISTS (multi-vector)** | Zoom/drill morph unlocks via the library's `sunburst()` mark (sole carrier of `sceneMotionNode`); replay unlocks via renderer-identity swap; **enter stagger stays absent**. | `dist/hierarchy-sunburst.js:160-168`; `dist/motion.js:1499-1558,1787-1833`; `dist/renderer.js:99-111`; `dist/motion.js:987-1005` |
| **T7** | **GENUINELY ABSENT** (clip) · route exists off-mechanism | Native clip is unconditionally an axis-aligned `<rect>`; the pulse needs a 6-point perspective polygon. Alternative vector = moving-gradient repaint (no clip), app-timed. | `dist/svg.js:26-32`; `dist/svg-renderer.js:76-81`; `dist/types.d.ts:853`; `internal/bar-pulse-mark.ts:177-186` |

---

## 2. Reopening dossiers (leverage order)

### 2.1 T20 — renderer switch (highest leverage; unblocks T15, T21b-timing, T6, T8)

**Correction to D401/D388.** `@tanstack/react-charts/tooltip` exports `Chart`, `RendererChart`
**and** `CanvasChart` (`react-charts/dist/tooltip.d.ts`, last three declarations). Charts today
import the **static** `Chart` from that same subpath (`internal/heatmap-components.tsx:16`,
`composed-chart.tsx`). D401's "`core.d.ts:1` exports `RendererChart` aliased `Chart`" is true of the
`/core` subpath only. The switch is therefore *within one import statement*, not a subpath
migration.

**Route.** Per chart: `Chart` → `RendererChart`, add `renderer={chartMotionRenderer()}`. `renderer`
is **required** (`react-charts/dist/RendererChart.d.ts:4`), so `tsc` enumerates every site.

**Files.** All 14 chart hosts + `internal/heatmap-components.tsx`. `internal/motion-renderer.ts`
is already written and correct — its `initial:"always"` is mandatory (documented in its own header
at `:9-15`) because React's `RendererChart` always injects `prerender()` markup before `mount()`
adopts it.

**Order.** (1) `composed` (already on `RendererChart`) as the pilot; (2) the four stash-partial
charts — recover from `stash@{0}` as a diff source rather than re-authoring, noting it does not
compile; (3) the rest.

**Parity risk.** `dist/motion.js:612` gates animation on
`!reduced && (initial ? motion.initial && (!adoptedRoot || motion.initial==='always') : motion.resize || !resized)`
— every non-resize reconcile animates. D401's real finding (area-chart's immediate-paint policy
would tween at 1100 ms) stands and is the live risk. Mitigation is per-mark `motion: false` on marks
whose legacy update is instant — a definition-local declaration, not a reach-in.

**Falsifier.** If a T0/T1 chart (candlestick/scatter/heatmap) shows tweened *data updates* that
legacy paints instantly and `motion:false` cannot be scoped narrowly enough, revert that chart to
`Chart` and log. The switch is per-chart, not all-or-nothing.

### 2.2 T11 — polar focus adoption (largest reach-in retirement left)

Raw reach-in counts today: radar 32 + ring 31 + sunburst 21 + pie 19 = **103**.

**Correction to D384.** D384 conceded the capability works, then blocked on "the pop/growth is
applied imperatively to the DOM and never to the scene, so 'painted arcs' are not the scene's arcs",
citing D254/D258. But **pie already ships the D254/D258 fix**: `pie-chart.tsx:450-460` declares a
second `radialArc` (`id:"pie-hitbox"`, `fill:"transparent"`, `radiusRatio:1`) alongside the visible
slice inside one `polar()`. The static hitbox twin exists as a **scene mark**; only its consumption
is still a `querySelector` map (`pie-chart.tsx:661-668`).

**Mechanism proof.** `dist/nearest.js:47` runs `findContainingScenePoint` **before** any distance
work; `:65` iterates targets in reverse (last-painted wins → the hitbox, declared after the slice,
wins); `:68` gates on `containsBounds && containsTarget`. `dist/polar.js:218` emits
`points: tracePolarArcBoundary(...)` so containment is real point-in-polygon, and `:230` tags
`affinity:'geometry'`. The `continue` at `dist/nearest.js:33` excludes geometry targets only from
the *nearest-distance* fallback — correct semantics, not a gap.

**Route.**
1. **Pie:** drop `focus: focusDisabled` (`pie-chart.tsx:405,462`); keep both marks; replace the
   `hitboxMap` querySelector block (`:658-668`) with `onFocusChange` → the existing `hoveredIndex`
   state. Visible-slice grow stays a reactive definition (per-datum `radiusRatio`/`inset`), so the
   *animated* geometry is never hit-tested — exactly D254's fix, now enforced structurally rather
   than by convention.
2. **Ring:** identical shape (`ring-chart.tsx:494,577`); add the hitbox twin pie already has.
3. **Sunburst:** drop `focusDisabled` (`sunburst-chart.tsx:656`) for **hover only**; keep
   `internal/sunburst-hit.tsx` for **click/drill**, because D384's `onSelect` objection is real —
   the D32 bench dispatch sends a `MouseEvent` with no `clientX`/`clientY`.
4. **Radar:** **do not attempt** — accepted deviation, see §6.

**Blast radius.** `internal/pie-hover-chrome.ts` and `internal/ring-hover-chrome.ts` die;
`sunburst-chart.tsx:669-803` shrinks.

**Parity risk.** Ring is the gate of record (n=4). Pie carries D254's 3.18% scar. Hit-region *edges*
move from DOM `pointer-events` to scene polygon — `tracePolarArcBoundary` is a chord approximation
of the arc, so sub-pixel disagreement at arc edges is the expected divergence class. Per D402/D403,
treat single-sample hover readings as noisy.

**Falsifier.** If the chord count is coarse enough that a hover 1 px inside the visual arc edge
misses, the twin can be inflated (larger `radiusRatio`) — the same knob legacy's hover offset uses.

### 2.3 T15 — sunburst (decompose into three; two are reachable)

**Correction to D404.** D404 audited only `radialArc`. The library's `sunburst()` mark
(`@tanstack/charts/hierarchy/sunburst`, in the package `exports`) is the **sole attacher** of
`[sceneMotionNode]` metadata — `{path:{values:[startAngle,endAngle,radius1,radius2], project:
projectSunburstSectorPath}, hierarchy:{markId,id,ancestorIds}}` (`dist/hierarchy-sunburst.js:
160-168`). The symbol is declared `unique symbol` in `dist/scene-motion-internal.d.ts:2` with **no
`exports` subpath**, so a `createMark` custom mark can never replicate it. Sunburst declares
`radialArc<SunburstArcRow>(arcRows, …)` at `sunburst-chart.tsx:633` and therefore forfeits the
entire semantic-motion subsystem.

**Vector A — zoom/drill morph: NOW UNBLOCKED.** Adopt `sunburst()`. The update-phase reconcile calls
`addSemanticPathUpdateTrack` (`dist/motion.js:1397`, defined `:1499-1533`, driving
`semanticPathTrack` `:1534-1558`) **per element**, keyed on `data-ts-key`, interpolating
`[startAngle, endAngle, r1, r2]` through `project`, with real per-element timing from
`elementTimingContext(current,'update',scene)`. Enter-from-ancestor morphs come free via
`hierarchyMotionRelation` (`:1787-1833`) reading `hierarchy.ancestorIds`. This is the "keyed geometry
update under motion" `research/phase-6/05-motion-reveals.md` asserted; it deletes
`internal/sunburst-reveal.ts`'s 64/30-sample keyframe generators.

**Vector B — replay: ROUTE EXISTS, cost is ~10 lines.** `dist/renderer.js:99-111`: a changed
`options.renderer` **identity** triggers `surface.destroy(); container.replaceChildren();
renderer.mount(...); hasRendered = false`, and `:628-629` includes it in `layoutChanged`/`needsRender`.
So `renderer={useMemo(() => motion({initial:'always'}), [playKey])}` replays the full initial
choreography **without unmounting the React component** — `internalFocusId`
(`sunburst-chart.tsx:312`), `zoomT` (`:472`), `hoveredArcIndex` all survive. This answers D404's
blocker 3, whose whole force was the state loss a `key` bump causes.

*Verified cost:* `sunburst-chart.tsx:828-840` binds `pointerleave` to
`container.querySelector("svg.ts-chart")` inside a `useLayoutEffect` with deps
`[setHoveredArcIndex]` — a stable callback, so the effect never re-runs and the listener is orphaned
when the svg is replaced. Fix: re-bind inside `handleRender` (`:669`), which already runs on every
render. The same caution applies to any chart adopting this replay hook.

**Vector C — per-arc enter stagger: GENUINELY ABSENT.** `createArcTracks` (`dist/motion.js:987-1005`)
does `root.querySelectorAll("g.ts-chart__arc")`, and `sunburst()` wraps all nodes in **one** such
group (`dist/hierarchy-sunburst.js:171`, `className: classes("ts-chart__arc ts-chart__sunburst", …)`),
so `timingFor` still receives `datumIndex:0, datumCount:1` and paints one whole-chart
`radialSweepClipPath`. The enter path (`dist/motion.js:76-81`) never reaches per-element timing.
**D404's blocker 1 is correct for the enter phase and only the enter phase.**

**Order.** A and B are independent of C. Ship A+B; accept-with-log C (see §4).

**Falsifier for A.** If `sunburst()`'s layout (`value`, `sort`, `ringPadding`, `innerRadius`/
`outerRadius`, `visibleDepth`, `rootId`) cannot reproduce `internal/sunburst-geometry.ts`'s arc
angles bit-for-bit, A is a geometry change on a gated chart and must revert. **Verify angle parity
before touching motion.**

### 2.4 T6 + T8 — paint-server resources (one commit; they share the mechanism)

**Correction to D381 (T6).** D381 said the acceptance is already met *and* that no `renderSvg`
wrapper exists. The sharper fact: `motion()` hardcodes `renderChartSvgWithResources` for `prerender`
(`dist/motion.js:484`) and for every update (`:568`, `:616`), and `createMotionSvgChartRenderer`'s
`renderSvg` parameter **defaults** to it (`:495`). So after T20, `gradients:` renders natively on
every chart with **no prop at all**. Gauge is the existing proof (`gauge.tsx:115,683,858`) — it only
needs `renderSvg=` because it is still on static `Chart`.

**Correction to D381 (T8).** "The named artefact does not exist" is wrong on one count.
`internal/sankey-animation.ts:113-123` `injectLabelCssTransitions` injects a live
`<style class="ts-sankey__transitions">` node into the svg. It is CSS `transition:` rules, not
`@keyframes` — but it *is* an injected stylesheet, and its four selectors
(`.ts-sankey__node rect`, `[data-ts-key="sankey:flow"] > path`, `[data-ts-key^="sankey:nlabel:"]`,
`[data-ts-key^="sankey:vlabel:"]`) are static text with no per-render interpolation. It belongs in
`styles.css`, which already carries 26 `ts-chart__` selectors as a documented styling surface
(D418). Deleting the injector is a pure move, not a mechanism change.

**Route — gradients, per site.**

*Expressible today (objectBoundingBox fractions):*
- **Sankey links** (`internal/sankey-animation.ts:102`; coords built at
  `internal/sankey-mark.ts:438-445`): `x1 = srcNode.x1`, `x2 = tgtNode.x0`, `y1 = y2 = 0` — exactly
  the link path's horizontal bbox extent, so `{x1:0, y1:0, x2:1, y2:0}` is geometrically identical
  output. Delete `injectGradientDefs` entirely.
- Crosshair fades already declared `gradientUnits="objectBoundingBox"`: `area-chart.tsx:1535`,
  `line-chart.tsx:1459`, `composed-chart.tsx:2035`.
- Already percentage-based: `internal/background.tsx:87,99`,
  `internal/segment-visuals.tsx:63,97`, `internal/reference-area-layer.tsx:274`,
  `live-line-chart.tsx:865,869,873`.
- Projection lines (`line-chart.tsx:1435`, `area-chart.tsx:1553`, `composed-chart.tsx:1990`): the
  path is `M startX,startY L visibleEndX,endY` or a horizontal-tangent bezier between the same two
  points (`internal/projection-line-mark.ts:50-52`); either way the path bbox corners *are* the
  gradient endpoints, so bbox fractions are exact.

*Not expressible at 0.15.0 — see §4:* all four `<radialGradient>` sites (`area-chart.tsx:1559`,
`scatter-chart.tsx:1518`, `line-chart.tsx:1487`, `internal/gradients.tsx:130`); scatter's per-point
vertical y-gradient (`scatter-chart.tsx:1547`, applied to circles whose bbox is a few px);
crosshair fades on zero-bbox vertical lines (`bar-chart.tsx:1869`, `candlestick-chart.tsx:1662`,
`scatter-chart.tsx:1561` — the reason is stated correctly at `bar-chart.tsx:784`); profit-loss
segment gradients (`internal/profit-loss-line-mark.ts:158,164` span `0 → innerWidth`, not the
segment bbox); `internal/fade-mask.ts:66`; `internal/loading-chrome.tsx:254`;
`internal/heatmap-components.tsx:1121`; every `<pattern>` (`internal/pattern-preset.tsx:28`, gauge's
children-as-defs escape hatch `gauge.tsx:237`).

**Order.** T20 → declare `gradients:` for the expressible set → delete `injectGradientDefs` +
`injectLabelCssTransitions` → leave the `stroke-dashoffset` sweep as sankey's single sanctioned
extension.

**Parity risk.** Low for sankey (identical geometry, same stops). The one real hazard is ID scoping:
`dist/svg.js:8-12` `resolvePaint` rewrites `url(#id)` → `url(#<idPrefix>-<id>)` **only** for ids
present in `scene.gradients`, so a def must be *fully* moved, never half-moved, or its reference
breaks silently.

**Falsifier.** If any converted gradient is referenced from an app-owned sibling overlay svg (not a
scene mark), the scoping rewrite will not reach it and the reference dies. Grep each `url(#`
consumer before converting.

### 2.5 T21b — heatmap reveal timing

**Correction to D390.** "`stagger()` is `offset + each*index` off one flat index … a linear function
of one index cannot express a pseudo-random function of two" is true of `stagger()` and false of the
native surface. `dist/types.d.ts:449`:
`delay?: number | ((context: ChartMotionContext<TDatum>) => number | undefined)`, and
`ChartMotionContext` (`:412-421`) carries `datum: TDatum | undefined` plus `point`. The heatmap's
seed is `column*1009 + row*9176` then `state*16807 % 2147483647`
(`internal/heatmap-animation.ts:51-80`) — a pure function of two fields that both live on
`CellDatum`. So:

```ts
motion: {
  delay: ({ datum }) => (datum ? heatmapCellDelay(datum.column, datum.row) : 0),
  transition: { /* … */ },
}
```

is a direct, native, definition-local expression. **The binning half of D390 stands** —
`HeatmapChartProps.data: HeatmapColumn[]` is pre-binned; there is nothing to migrate.

**Files.** `internal/heatmap-components.tsx` (add `motion:` to the cell rect mark),
`internal/heatmap-animation.ts` (keep the PRNG, drop the WAAPI driver).

**Parity risk.** heatmap is **T1** (0.0723% headroom) and this is explicitly the half that can
retime the reveal. Gate the reveal frame, not just the settled frame.

**Falsifier.** If the reveal's per-cell animation is opacity-only, `motionAttributes`
(`dist/motion.js:1315-1336`) covers `opacity` and this works; if it also animates a transform origin
or another non-allowlisted attribute, the native path drops it silently.

### 2.6 T1 — container measurement (acceptance criterion restated)

**Correction to D380's census.** The exported surface is five hooks with **15 live consumers**, all
inside chart components (D380's "3 consumers render no `<Chart>`" refers to the funnel/heatmap/gauge
shells, which do render one):

| hook | `internal/use-container-size.ts` | consumers |
|---|---|---|
| `useContainerWidth` | `:31` | `bar-chart.tsx`, `candlestick-chart.tsx`, `scatter-chart.tsx`, `choropleth-chart.tsx` |
| `useDebouncedContainerWidth` | `:58` | `composed-chart.tsx:497`, `gauge.tsx:993` |
| `useDebouncedContainerSize` | `:108` | `line-chart.tsx:200`, `pie-chart.tsx:281`, `ring-chart.tsx:350`, `radar-chart.tsx:251`, `gauge.tsx:388` |
| `useMeasuredRect` | `:165` | `area-chart.tsx:230`, `live-line-chart.tsx:354` |
| `usePositiveChartSize` | `:201` | `funnel-chart.tsx:647`, `heatmap-chart.tsx:109` |

**The acceptance criterion must be restated, not just re-verdicted.** "No `ResizeObserver` left in
migrated code" is **unachievable**: measurements feed decimation targets, tick-count selection,
margin policy and out-of-scene overlay geometry — all *definition inputs* — so reading them back
from `onRender(scene)` is genuinely circular (the definition cannot depend on the render it
produces). D380 is right that deletion is blocked; it is wrong to leave the row with no achievable
target.

**Restated criterion:** *one observer implementation, five thin wrappers, and no second observer in
`internal/brush-drag.ts:151`.* Today there are six independent `ResizeObserver` constructions —
`use-container-size.ts:41,81,135,175,220` plus `brush-drag.ts:151` — over largely the same elements.
This is storage/lifecycle hygiene with zero pixel surface; it retires nothing from the reach-in
census. **Schedule it in 6.4, not as a rung.**

---

## 3. Sequencing against Phase 6's remaining rungs

Census pressure is now concentrated exactly where the six reopened groups live. Raw per-file counts
(same grep shape as D418, unfiltered — comment prose included, so not directly comparable to D418's
filtered 259):

```
radar 32 · ring 31 · gauge 23 · candlestick 23 · sunburst 21 · pie 19
sankey-animation 18 · bar 18 · scatter 16 · choropleth 15 · bar-pulse 12
```

The polar/hierarchy family (T11 + T15) plus B2's T7/T8 is the dominant residual mass, and **C5 as
scoped does not retire it** — T11's focus adoption does.

**Recommended ladder:**

1. **C5a — renderer switch only (T20).** `Chart` → `RendererChart` + `renderer=` across all hosts.
   Recover `stash@{0}` for candlestick/line/scatter/heatmap as a diff source (it is non-compiling,
   so treat it as a source, not a merge). Nothing else in the same commit — it is the dependency for
   everything below and must bisect cleanly.
2. **C5b — motion + reveals as planned**, with two riders now proven cheap:
   - **T21b-timing** (`ChartMotionTiming.delay` callback) — pure rider, same commit as the heatmap
     reveal.
   - **T8 `<style>` → `styles.css`** — pure move, no mechanism change.
3. **C5c — NEW rung: polar focus (T11).** Pie, ring, sunburst-hover. The single largest census
   retirement left, and **not currently on the ladder**. Must land after C5a (states/transitions snap
   until the motion renderer is in) and before 6.4, since it deletes three chrome files the refactor
   would otherwise have to carry. Radar excluded and logged (§6).
4. **C5d — NEW rung: sunburst semantic motion (T15 vectors A+B).** `radialArc` → `sunburst()`,
   **angle parity verified first**, then keyed zoom morph + renderer-identity replay. Depends on C5c
   only for the hover half.
5. **C6 — brush/zoom/selection, unchanged.** No collision with the above.
6. **6.4 refactor riders:** T6's expressible gradient set (mechanical once T20 lands), T1's observer
   consolidation, and `internal/y-axis-ticks.ts` — C4 planned its deletion, but it survives with
   three consumers (`candlestick-chart.tsx:71`, `internal/axis-ticks.ts:13`, `index.ts:458,505`), so
   reclassify it as a survivor rather than a missed deletion (consistent with D431 item 7).
7. **6.5 gate** unchanged.

**Gate-scheduling constraint.** T0/T1 order of exposure: candlestick and scatter are touched in C5a;
heatmap in C5b; pie/ring in C5c. **Do not stack C5b and C5c on heatmap/ring in one gate window** —
a movement on either would be unattributable.

---

## 4. Genuinely absent

All stamped **`@tanstack/charts@0.15.0`**; per D417 each expires at the next pin bump unless
re-verified.

| Capability | Dist proof | Upstream ask |
|---|---|---|
| Radial gradients | `dist/types.d.ts:363-375` — `ChartLinearGradient {id,x1,y1,x2,y2,stops}` is the only gradient type; `dist/svg.js:17-23` `renderGradients` emits `<linearGradient>` unconditionally | `ChartRadialGradient` resource type |
| `gradientUnits="userSpaceOnUse"` | `dist/svg.js:50` — `percent(v) => Math.max(0,Math.min(1,v))*100 + "%"`; coords are clamped to bbox fractions with no unit escape | `gradientUnits` field on `ChartLinearGradient` |
| `<pattern>` paint servers | zero occurrences of `pattern` in `dist/svg.js` and `dist/types.d.ts` | `ChartPattern` resource type |
| Non-rect clip | `dist/svg.js:26-32` and `dist/svg-renderer.js:76-81` both emit a literal `<clipPath><rect>`; `dist/types.d.ts:853` `clip?: ChartBounds`, `:406` spec-level `clip?: boolean` | `clip?: ChartBounds \| {path: string}` on `SceneGroup` |
| `stroke-dashoffset` / `stroke-dasharray` motion | `dist/motion.js:1315-1336` — the 20-entry `motionAttributes` allowlist omits both | add both, or a `ChartMotionPath.reveal:'dash'` |
| Per-arc **enter** timing for polar/hierarchy marks | `dist/motion.js:987-1005` `createArcTracks` groups by `g.ts-chart__arc` and calls `timingFor({… datumIndex:0, datumCount:1})`; `dist/hierarchy-sunburst.js:171` wraps all nodes in one such group | route hierarchy/polar enter through the per-element track builder |
| `states` on polar marks | `radialArea`/`radialDot` options carry no `states`; their `fillOpacity`/`strokeWidth`/`opacity` are per-call numbers, not per-datum accessors (documented at `radar-chart.tsx:436-447`) | `states` on the polar marks' `ChartMarkMotionOptions` |
| `sceneMotionNode` for authored marks | `dist/scene-motion-internal.d.ts:2` `export declare const sceneMotionNode: unique symbol`; referenced only by `scene-motion-internal`, `hierarchy-sunburst.js`, `motion.js`; no `exports` subpath maps to it | public semantic-path metadata channel on `createMark` |
| Enter wipe (`clipPath` inset sweep) | `motion.js`'s only group-level clip is `radialSweepClipPath` | `motion.enter:'wipe'` — already logged D420 |
| Per-tick label `fill` | no fill/colour accessor on `ChartAxisTickLabelOptions` | already logged D431 |

---

## 5. Corrections — Phase-5 rulings that are factually wrong

Ledger entries **D434–D444**, ordered by leverage.

| Ruling | Claim | Correct fact | Ledger |
|---|---|---|---|
| **D401/D388** (T20) | "`core.d.ts:1` exports `RendererChart` aliased `Chart`" / "`<RendererChart>` appears nowhere" | True of `/core` only. `@tanstack/react-charts/tooltip` — the subpath the migration actually imports — exports `Chart` (static), `RendererChart`, and `CanvasChart` as three distinct symbols. The switch is a symbol swap inside the existing import, and `renderer` is a **required** prop (`RendererChart.d.ts:4`), so tsc enumerates every site. | D434 |
| **D384** (T11) | "'painted arcs' are not the scene's arcs … D254/D258 fixed this with static hitbox twins" | The static hitbox twin already exists as a **scene mark**: `pie-chart.tsx:450-460`. Native containment (`dist/nearest.js:47,63-80`) hit-tests it, never the animated slice — D254's fix is structurally satisfied, not violated. | D435 |
| **D404** (T15) | "NOT IMPLEMENTABLE … sunburst declares one `radialArc` mark and `polar.js` wraps every row in a single `<g class="ts-chart__arc">`" | Audited only `radialArc`. `sunburst()` (`exports: "./hierarchy/sunburst"`) is the sole carrier of `[sceneMotionNode]` semantic-path + `hierarchy.ancestorIds` metadata (`dist/hierarchy-sunburst.js:160-168`), unlocking per-element keyed zoom morphs (`dist/motion.js:1499-1558, 1787-1833`). Blocker 1 is correct **only for the enter phase**. | D436 |
| **D404** (T15, blocker 3) | "no caller-facing replay hook … only a `key` bump remains" | A changed `renderer` **identity** is one (`dist/renderer.js:99-111, 628-629`): it replays initial choreography without unmounting React, so `internalFocusId`/`zoomT`/`hoveredArcIndex` survive — the exact loss the ruling rested on. Residual cost: `sunburst-chart.tsx:828-840` binds `pointerleave` in an effect that never re-runs, so the listener orphans; ~10-line fix inside the existing `handleRender`. | D437 |
| **D390** (T21b) | "`stagger()` is `offset + each*index` off one flat index … a linear function of one index cannot express a pseudo-random function of two" | Evaluated the wrong API. `ChartMotionTiming.delay` accepts `(ctx: ChartMotionContext<TDatum>) => number` and `ctx.datum` carries the row (`dist/types.d.ts:412-421,449`). The 2-D Lehmer PRNG is directly expressible. Timing half **implementable**; binning half correctly void. | D438 |
| **D383** (T10) | "`internal/sankey-mark.ts` emits zero `interaction:` targets" | True at Phase 5; false now. `sankey-mark.ts:308-315` emits one `ChartPoint` per node and `:400` resolves link points; `sankey-chart.tsx:399-408` bridges hover through `setControlledFocus(point,{source:'pointer'})`. No custom `ChartFocusStrategy` was ever needed. | D439 |
| **D382** (T9) | "composed resolves TWO point sets … and native focus resolves only the scene's" | An app-side data-flow choice, not a library limit. C3 kept both bisectors app-owned and made only the pointer plumbing native: `composed-chart.tsx:1686` `clientToScene`, `:1698`/`:1703` dual raw+decimated resolve, then `setControlledFocus(…,{source:'pointer'})`. The same pattern retired heatmap's cell-boundary objection (`internal/heatmap-components.tsx:766-778`). | D440 |
| **D386** (T13, blocker 1) | "`capabilities` has 0 hits in `svg-renderer.js`/`svg-surface.js`, so the native tooltip snaps" | Correct for the static renderer; retired by `motion()`, which returns `capabilities.tooltipMotion {protocol:1, createController}` (`dist/motion.js:473-494`) — exactly what `dist/renderer.js:810` reads. Moot in practice: C2 shipped the tooltip. | D441 |
| **D381** (T6) | "no custom `renderSvg` wrapper exists, so the acceptance is already met" | Understates it. `gauge.tsx:115,858` *does* pass `renderSvg={renderChartSvgWithResources}` because it is on static `Chart`; under `motion()` that renderer is the hardcoded default for prerender and every update (`dist/motion.js:484,488,568,616`), so after T20 `gradients:` works everywhere with no prop. Also: the sankey link gradients D381 called inexpressible **are** expressible — their `userSpaceOnUse` extent (`internal/sankey-mark.ts:444-445`, `srcNode.x1 → tgtNode.x0`) is exactly the link path's bbox. | D442 |
| **D381** (T8) | "The named artefact does not exist. No `@keyframes` anywhere in `sankey-animation.ts`" | Right about `@keyframes`, wrong about the artefact. `internal/sankey-animation.ts:113-123` injects a live `<style class="ts-sankey__transitions">` node with four static selectors — an injected stylesheet, replaceable verbatim by `styles.css`. | D443 |
| **D380** (T1) | acceptance "no ResizeObserver left in migrated code" left unrestated after the skip | The criterion is unachievable (measurements are definition inputs; `onRender(scene)` readback is circular) and must be **restated**, not merely failed: one observer implementation, five thin wrappers, no second observer in `internal/brush-drag.ts:151`. Census correction: five hooks, 15 consumers, six observer constructions. | D444 |

Also superseded, without a dedicated correction entry because Phase 6 already logged the fact:
**D379** (T5) — superseded by C4/`fa18bd9` + D430/D431; only the per-tick `fill` channel remains
absent (`area-chart.tsx:1367`). **D381** (T21a) — superseded by C1–C3; `color:{scale}` and `states`
both live in the heatmap definition today (`internal/heatmap-components.tsx:238,477,499,513`).

---

## 6. Accepted deviation — radar excluded from T11

**Ruling:** radar keeps `focus: focusDisabled` (`radar-chart.tsx:503`) and its reactive-`fill` dim.
This is an **accepted deviation**, not an omission.

`radialArea`/`radialDot` (`@tanstack/charts/polar`, **v0.15.0**) carry **no `states` option** —
unlike cartesian `dot`/`area` — and their `fillOpacity`/`strokeWidth`/`opacity` channels are
per-call numbers, not per-datum accessors; only `fill` (both marks) and `stroke` (area only) accept
a row accessor. The file states this at `radar-chart.tsx:436-447`. Radar's hover dim is therefore
already the correct native expression: alpha baked into `fill`/`stroke` via `color-mix`, evaluated
per z-group on every definition rebuild, which React re-runs when `hoveredIndex` changes.

Consequently dropped rather than reintroduced via direct-DOM writes: stroke-width hover-pop, the
dot's stroke-ring dim, and the legacy glow/scale-pop flourish (no filter/transform channel exists on
any mark). This is a **paint** deviation only; hit-testing and dim/undim timing are unaffected.

Radar's 32 raw reach-in sites therefore do **not** retire at C5c. They belong to S5 (reveal —
radar stamps `data-bkm-revealed` on the svg root itself, predating the `deferred-reveal`
centralization) and are addressed by C5b's reveal work, not by focus adoption. Expires at the next
pin bump per D417.
