# Phase 7 — Blocker routes (second pass)

Re-research of the five blockers left open by `00-independent-audit.md`. Method: read the
**pinned** `@tanstack/charts@0.15.0` dist (`bench/app/node_modules/@tanstack/charts/dist`), not
the `repos/tanstack-charts` clone, and look for indirect, multi-part native routes.
All line references are into that dist unless stated.

## 0. Correction to the first audit

`repos/tanstack-charts/packages/charts-core` is **not** the pinned surface. Its exports map has 35
subpaths; the pinned 0.15.0 package has ~110. Subpaths the first audit never examined and that
change the answers below:

| Subpath | What it gives |
|---|---|
| `focus/mark` | `whenFocused(mark, filter)` — an 8-line wrapper that overrides `initialize` to attach a field to any mark (`focus-mark.js:1-11`). The precedent for attaching `states` the same way. |
| `mark-state` (via `cursor/host`) | `resolveMarkStateScene(scene, focus, pointer)` — resolves `states` per scene node, any mark kind (`mark-state.js:6-55`). |
| `cursor`, `cursor/host` | `createChartCursor()` — framework-neutral `{getState, subscribe, setState}` store shared across hosts (`types.d.ts:1060-1066`). |
| `interaction/signal` | `controlledSignal(value, onChange)` — app-owned interaction value. |
| `selection` | `keyedSelection`, `whenSelected`. |
| `view` | `composeViews`, `viewGrid`, `shareX/Y`, `alignX/Y`. |
| `react/core` | `RendererChart` with `onRender`, `onFocusChange`, `onFocusGroupChange`, `onSelect` (`react-charts/dist/RendererChart.d.ts:3-20`). Already the entry the migration uses (5 imports) plus `react/tooltip` (14). |

Also stale: the "5–6× gzip gap vs legacy" from Phase 5. `bench/results/bundle-sizes.json` already
contains bklit rows. Measured today, migrated ÷ bklit gzip per scenario:

| | |
|---|---|
| Pairs | 43 |
| Median ratio | ≈1.04 |
| Over 10 % | 17 (max ×1.28 `arealoading`, ×1.23 `barloading`, ×1.22 `profitloss`) |
| Under bklit | 14 (funnel ×0.51, heatmap ×0.82, composed ×0.94) |
| Upstream-only control | 70–89 kB, so the migration layer costs 30–70 kB per scenario |

## 1. Wipe reveal (nativeness)

**Blocker as stated:** left-to-right reveal has no motion primitive; needs upstream or `onRender`.

**What bklit does:** `chart-reveal-clip.tsx:28-74` grows a `<clipPath>` rect width 0 → full with
`cubic-bezier(0.85,0,0.15,1)`; replays when `revealSignature` changes. Grid is not clipped.

**What the pinned package already emits:**

- `definition.clip: true` (`ChartSpecBase.clip`, `types.d.ts:406`) wraps the marks in a scene
  group with `clip: chart` (`scene.js:223`). Viewport-bearing charts get one anyway
  (`scene.js:361-363`, class `ts-chart__viewport-clip`).
- The SVG renderer serialises that group as `clip-path="url(#…ts-chart-clip-…)"` plus
  `<defs data-ts-key="<key>:clip-defs"><clipPath><rect x y width height/></clipPath></defs>`
  (`svg-renderer.js:76-81`). Guides are outside the group, so the grid stays visible, matching bklit.
- The motion renderer's native path enter is a baseline **stretch** (`matrix(1 0 0 p …)`),
  `motion.js:912-930`, not a wipe. Bars enter by width/height grow (`motion.js:841-875`).

**Route W1 — CSS keyframe on the renderer's own clip rect (zero helpers).** SVG2 geometry
properties (`width`, `x`) are CSS-animatable on `<rect>` in Chrome, Firefox, Safari.

1. Set `clip: true` on the definition (or rely on the viewport clip group).
2. In `styles.css`: `[data-ts-key$=":clip-defs"] rect { animation: ts-wipe 1100ms cubic-bezier(.85,0,.15,1) both }` with `@keyframes ts-wipe { from { width: 0 } }`.
3. Replay on `revealSignature`: alternate two identical keyframe names (`ts-wipe-a` / `ts-wipe-b`) selected by a `data-reveal-epoch` attribute on the chart `className`. Attribute flip restarts the animation without remounting.
4. Reduced motion: `@media (prefers-reduced-motion) { … animation: none }`.

Moving parts: 1 CSS rule, 1 attribute toggle. Deletes `deferred-reveal.ts` (217 lines) and the
`ts-chart__marks--revealing` machinery (`styles.css:145`). The K4 probe reads WAAPI, and CSS
animations are visible to `getAnimations()`, so the probe keeps working; its expected `dur 1800`
and animation count must be re-based.

**Route W2 — fallback if the clip rect must be driven by JS:** `createChartSpring` (`spring`
subpath) driving a `clip: {x, y, width, height}` on a `createMark` group node, re-rendered through
the host. Every piece is public; costs ~66 host updates per reveal. Use only if W1 fails a
browser check.

**Route W3 — bars and dots:** `stagger({each, roles:['bar','dot'], by:'index'})` is a native LTR
entrance for per-datum marks; no clip needed.

Confidence: W1 high (needs one browser check across the three engines), W2 certain.

## 2. Polar `states` (nativeness)

**Blocker as stated:** `radialArc`/`geoShape` have no `states`; dim is baked into colour alpha
(LOG D424).

**Findings:**

- `states` is a field of `InitializedMarkBase` (`types.d.ts:672`), i.e. every initialized mark,
  not an option of Cartesian marks only.
- `scene.js:187-197` wraps **any** mark carrying `states` in a `states:` group with
  `points: presentedPoints`. `polar()`'s container mark returns `points` from `initialize`
  (`polar.js:105-115`), so the wrap applies.
- `resolveMarkStateScene` binds nodes to points by key-prefix ownership
  (`scene-point-ownership-internal.js:10-17`, walking `lastIndexOf(":")`). Polar arc nodes are
  keyed `${id}:${groupKey}` (`polar.js:684, 842`), the same prefix the polar points carry via
  `withPolarFocusGeometry`.
- `markStates(data, definitions)` builds the field (`mark.d.ts:11`); `createMark` is a root export.

**Route P1 — `withStates` wrapper, same shape as `whenFocused`:**

```ts
const withStates = (mark, data, definitions) => ({
  ...mark,
  initialize: (ctx) => ({ ...mark.initialize(ctx), states: markStates(data, definitions) }),
});
```

Apply to the `polar(...)` container (Pie, Ring, Gauge, Radar) and to `geoShape` (Choropleth).
Definitions use `ChartMarkStateStyle` (`fillOpacity`, `opacity`, `stroke`, `r`, `radius`, all
accepting `(context) => value`, `types.d.ts:72-81`), so the legend-dim and hover-lift become
`states: [{ when: { focus: 'other' }, style: { fillOpacity: 0.35 } }]` and alpha leaves the
palette. Transitions come from the resolver's `transition` output, so `motion()` tweens the dim.

Moving parts: one 6-line wrapper in `internal/`, plus a unit test that
`resolveMarkStateScene` returns changed nodes for a polar scene. If the key-prefix binding fails
for `sunburst` (keys `${id}:${group}:${datum}`, `polar.js:1150`) the fallback is `focus`
identity via `whenFocused` on a duplicated overlay layer. Upstream ask remains worthwhile
(expose `states` on polar options) but is no longer a blocker.

Confidence: high.

## 3. Shared provider layer (API compatibility)

**Blocker as stated:** bklit exports `ChartProvider` + `useChart/useChartHover/useChartStable`
and 37 internal files consume them; the migration has no equivalent.

**Findings:** everything the context value needs is emitted by the React host:

| bklit context field | Native source |
|---|---|
| `xScale`, `yScale`, `yScales` | `scene.scales[id]` — `ResolvedScale {map, invert, domain, ticks, bandwidth, viewport}` (`types.d.ts` ResolvedScale) via `onRender({scene})` |
| `width/height/innerWidth/innerHeight/margin` | `scene` extends `ChartSize`, plus `scene.margin`, `scene.chart` bounds |
| `tooltipData` (`point`, `index`, `x`, `yPositions`) | `onFocusGroupChange(points)` — `ChartPoint` carries scene coordinates per series |
| `setTooltipData`, `hoveredBarIndex`, `hoveredCandleIndex` | `interaction.setControlledFocus(point \| resolution \| null)` from `onRender({interaction})` |
| `selection`, `clearSelection` | `keyedSelection` (`selection` subpath) or `brushX` change callback |
| cross-chart hover (legend, linked charts) | `createChartCursor()` store shared by several hosts through the `cursorHost` extension |
| `containerRef` | `onRender({container})` |
| `chartPhase/chartStatus/loading*` | stays app state (it is app state in bklit too) |

**Route A1 — `ChartProvider` as a thin React context fed by host callbacks.**

1. `ChartProvider` renders `RendererChart` and stores the latest `onRender` context and
   `onFocusGroupChange` points in a `useSyncExternalStore`-backed store (or the cursor store).
2. `useChartStable()` returns scales/bounds; `useChartHover()` returns the focus points and a
   `setTooltipData` that calls `setControlledFocus`; `useChart()` merges both. Same split as
   bklit, so re-render characteristics match.
3. The visx `ScaleTime`/`ScaleLinear` shape is met by a 10-line adapter: callable `map`, plus
   `.domain()`, `.range()` (from `scene.chart`), `.invert()`, `.ticks()`. Export the visx types
   as aliases for source compatibility.
4. Sub-charts that bklit implemented as context consumers (`ReferenceArea`, `Segment`,
   `ProjectionLine`, markers, brush overlays) become marks pushed into the parent definition via
   a `useChartMarks()` registration hook on the same context. That is how bklit's children compose
   today; the definition just becomes the aggregation point.

Moving parts: one context module (~150 lines), one scale adapter. No renderer reach-in.
Confidence: high for hooks and scales; medium for child-registration ordering (marks must be
registered before the parent builds its definition, solved with a layout-effect pass).

## 4. Parity evidence (Q2 fixtures, committed tree)

**Blocker as stated:** 15 fixtures cover only top-level charts; gate ran on an uncommitted tree.

**Route E1 — generate one exhaustive type-parity fixture instead of hand-writing per export.**
bklit's `charts/index.ts` has 105 export lines. A small generator emits `qa/api-compat/all.ts`:

```ts
import type * as B from '@bklitui/ui/charts'; import type * as M from '../../showcase/migrated/charts';
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const _LineChart: Eq<Parameters<typeof B.LineChart>[0], Parameters<typeof M.LineChart>[0]> = true;
// … one line per value export; `type X = M.Foo` per type export
```

Every export becomes a line, every gap becomes a red line with a name. The 27 interface diffs the
Sonnet audit found appear automatically, and the fixture doubles as the P0–P2 fix checklist.

**Route E2 — run the gate on a worktree, not the working tree.** `git worktree add …/gate HEAD`
gives a clean committed checkout without stashing 303 modified files; the gate scripts take a
root path. Once the refactor is committed, run it once there and record the SHA in `SUMMARY.md`.

Confidence: high; both are tooling.

## 5. Bundle claim

**Blocker as stated:** G4 compares to the migration's own pin, not to bklit.

**Findings:** `bench/measure-bundle.mjs` already measures `bklit/*`, `tanstack/*`, `migrated/*`
(104 bundles). `scripts/bundle-gate.mjs` (not a protected file) only reads `migrated/*` pins from
`bench/results/bundle-gate.json` with `tolerancePct: 3`.

**Route B1 — second verdict column, same script.** Add `bklitTolerancePct: 10` to
`bundle-gate.json` and a second comparison in `bundle-gate.mjs` against the `bklit/<scenario>` row
of `bundle-sizes.json` where one exists (43 pairs). Result today: 17 FAIL. The README G4 line then
reads from the gate instead of asserting it.

**Route B2 — make the 17 pass by finishing sections 1–3.** The overshoot is concentrated in the
line/area family (+19 kB) and loading variants (+16–25 kB), which is where
`internal/{motion-renderer,enter-transition,deferred-reveal,hover-geometry,native-tooltip}`
(923 lines) and the loading helpers live. `internal/` gzips to ~180 kB concatenated; the chart
files themselves to ~150 kB. The upstream-only controls sit at 70–89 kB, so parity with bklit
(118–147 kB) leaves ~40–60 kB for the migration layer per scenario — achievable once the
re-implemented motion, hover, and reveal paths are removed.

Confidence: B1 certain; B2 medium-high (depends on sections 1–3 landing).

## 6. Maintainability

Follows from the above. Helpers that become deletable and the native replacement:

| Helper | Lines | Replacement |
|---|---|---|
| `deferred-reveal.ts` | 217 | Route W1 (CSS on the renderer's clip rect) |
| `enter-transition.ts` + `motion-renderer.ts` | 201 | `motion({transition})` + `stagger` + `createChartSpring` options mapping |
| `hover-geometry.ts` | 315 | `crosshair({x:{label:true}})` + `focusGuideY` |
| `native-tooltip.tsx` | 190 | `react/tooltip` + `tooltip/portal` |
| alpha-baked polar palettes | scattered | Route P1 |
| zero-size `<svg><defs>` | ~200 | `clip: true` (clips) + `svg/resources` gradients + one `decorative` pattern mark |

## 7. Updated scores

| Aspect | Before | Achievable | What changed |
|---|---|---|---|
| TanStack nativeness | 6.5 → **9.5** | Wipe and polar states both have in-package routes (W1, P1); no upstream dependency left. |
| API compatibility | 7 → **9.5** | Provider layer maps 1:1 onto `onRender`/`onFocusGroupChange`/`setControlledFocus` (A1). |
| Parity evidence | 6 → **9** | Exhaustive generated type fixture (E1) + worktree gate run (E2). |
| Bundle claim | 3 → **8** | Gate already has bklit numbers; add the comparison (B1). Today 26/43 pass at 10 %; the rest fall out of sections 1–3. |
| Maintainability | 5 → **8** | ~1,100 helper lines and the defs SVG have named native replacements. |

## 8. Verification checklist before committing to the routes

1. W1: a 20-line HTML check that `width` keyframes animate a `<clipPath><rect>` in Chrome, Firefox, Safari, and that flipping `animation-name` restarts it.
2. P1: unit test — build a `polar([radialArc(...)])` scene with `withStates`, call `resolveMarkStateScene(scene, focus)` and assert a changed `fillOpacity` on the focused arc node.
3. A1: one chart (Line) wrapped in the new `ChartProvider` with `ReferenceArea` as a registered child; Q1 diff unchanged.
4. B1: run `node scripts/bundle-gate.mjs` and confirm the second column lists 17 FAIL before any deletion.

## 9. Residual gaps with no route yet

> Superseded by `02-residual-routes.md` (third pass): routes exist for every item below except radial gradients, lossy keyframe arrays, and the two CSS keyframe rules; several items were factual errors, corrected there in §0.

Items marked *unverified* have a paper route that rests on an assumption not confirmed from the dist.

**Nativeness**
- Funnel hover scale-up: no transform/scale channel in `ChartMarkStateStyle`.
- `<pattern>` fills: no scene node lands in `<defs>`; `svg/resources` covers gradients and clips only.
- Bar depth 3D: per-bar side-face clip paths and glass overlay have no mark equivalent.
- Blur channel, 2-D geo zoom: absent upstream.
- Loading skeletons / pulse sweep: animated gradient stops or masks are not scene resources.
- Live-line edge fade: gradient stroke paint fades the line but not dots or area fill.
- Legend hover dim stays app-owned focus, not a legend primitive.
- *Unverified:* CSS keyframes on the clip rect in all three engines; state-key binding for sunburst's three-segment keys.

**API compatibility**
- visx scale identity: `ResolvedScale` adapter covers map/invert/domain/range/ticks; `nice`, `copy`, `tickFormat` etc. need `d3-scale`.
- `@visx/gradient` re-exports: no equivalent component.
- `enterTransition` as framer `Transition`: keyframe arrays, per-property transitions, cubic-bezier arrays have no mapping.
- Required `styles.css` import: no zero-change swap without an import or runtime injection.
- `host`, `xDomainSlotCount`: inert, no semantic to map to.

**Parity evidence**
- No gate for transients beyond K4 (hover, tooltip motion, legend dim, polar state transitions).
- 11 hand-ruled non-regressions and 5 out-of-range cells remain rulings.
- M1a void and two unexplained bench speed-ups.
- Generated type-equality fixture can misjudge generic/function-typed props; manual review is unmeasured.

**Bundle**
- Loading-only scenarios: bklit never mounts the engine; migrated does. ≤10 % unproven there.
- Sunburst: upstream control ≈ bklit size; little headroom.
- CSS not in the measurement on either side; comparison fidelity unknown.

**Maintainability**
- Helper deletion removes ~1,100 of ~38,000 lines; the 157-module `internal/` surface and 600–1,400-line chart files have no shrink route short of restructure.
- Chart-specific runtime workarounds (e.g. D472 cardinality-gated renderer) have no native replacement.
- Lint-driven code (`asUndefined`) is a config decision not yet made.
