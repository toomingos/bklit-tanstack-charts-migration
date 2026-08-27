# Phase 5.1.1 — Research Drift Check: Pin `@tanstack/charts@0.15.0`

> Re-verifies every Section B native-capability claim in `ledger.md` (30 claims + the 8 `01:72–81` corrections) against the actual PUBLISHED pin `@tanstack/charts@0.15.0` / `@tanstack/react-charts@0.15.0` (`showcase/node_modules/@tanstack/charts/`), not the `@main` snapshot `01`/`05` were written against. Ground truth priority: `dist/*.d.ts` (and `.js` for runtime defaults) → `docs/` → `skills/` → `local_cache/tanstack-charts-a285ce7-v0.14.0/…/src/*.ts` (diff-only).
>
> Method: dispatched 9 independent research passes against the pinned typings/docs (several claims cross-checked twice by separate passes; the tooltip, focus/polar, and passthrough/zoom/ticks clusters each got two independent verifications that agreed). Coordinator (this document's author) additionally spot-verified the highest-stakes findings directly: tooltip options shape, `renderTooltipBody` location, `idPrefix` as a React prop, and the `renderChartSvgWithHooks` export status.

**Verdict counts (30 claims):** CONFIRMED — 18 · CONFIRMED-BUT-DIFFERENT — 11 · REFUTED — 1 · UNVERIFIABLE — 0

**Corrections (8, from `01:72–81`):** CONFIRMED — 7 · UNVERIFIABLE — 1 (historical PR-review intent, not a typings/docs question)

No claim flipped from CONFIRMED to fully REFUTED. One claim (#23, the D10 escape hatch) is a clean REFUTED at the public-API level — this is the one finding that should change a research file's confidence, not just its footnote.

---

## Verdict table — Section B claims

| # | Claim (short) | Research verdict | 0.15.0 verdict | Evidence | Impact if changed |
|---|---|---|---|---|---|
| 1 | Binning transforms (`binTimeX/Y`, `binX/Y`, `binXY`) | REFUTED-the-gap (i.e. capability exists) | **CONFIRMED** | `dist/transform-bin-time.d.ts:29,33`; `dist/transform-bin.d.ts:31–34`; `dist/transform-bin-xy.d.ts:26` — all five exported exactly as named | None — D2/heatmap stands |
| 2 | `RectOptions.color?: Channel` | REFUTED-the-gap | **CONFIRMED** | `dist/rect.d.ts:11` — `color?: Channel<TDatum, ChartKey \| null \| undefined>`, verbatim | None |
| 3 | Generic `stagger()`, `by:'datum'\|'series'`, `roles`, needs `motion()` | REFUTED-the-gap | **CONFIRMED** | `dist/motion-definition.d.ts:2–15` — `ChartMotionStaggerOptions{by?, each, offset?, phase?, roles?}`; re-exported `dist/motion.d.ts:4` | None |
| 4 | Declarative focus styling (`states`, `when:{focus:'unmatched'}`, `whenFocused()`, `keyedSelection`, `whenSelected`) | REFUTED-the-gap | **CONFIRMED** | `dist/rect.d.ts:19`; `dist/types.d.ts:95–98` (`ChartMarkStateSelector{focus: ChartFocusMatch \| 'unmatched', …}`); `dist/focus-mark.d.ts:2`; `dist/selection.d.ts:27,29` — literal `'unmatched'` string confirmed | None |
| 5 | Tooltip tweening already built-in, don't rebuild ("WAAPI + rAF springs") | CONFIRMED (as stated) | **CONFIRMED-BUT-DIFFERENT** | `dist/tooltip.js` calls an injected `tooltipMotion` controller (`beforePaint`/`afterPaint`/`hide`) implemented by the `motion()` renderer (`dist/motion.js`, WAAPI for tweens + `createChartSpring`/rAF for springs). **Opt-in, not automatic**: `extensionContext.motion` is `undefined` unless the app mounts the `motion()` renderer — without it tooltip transitions are instant. `docs/guides/tooltips-and-focus.md` §"Tooltip motion" | Low — plan already assumes `motion()` renderer for mark motion (D4), so the dependency is already paid for |
| 6 | Spring defaults `{stiffness:170, damping:26, mass:1}` | CONFIRMED | **CONFIRMED** | `dist/spring.js:2–7` — `defaultSpringOptions = {stiffness:170, damping:26, mass:1, restSpeed:0.01, restDelta:0.005}` | None, but see docs-trap note below |
| 7 | Motion defaults `1100ms`, `cubicBezier(0.85,0,.15,1)` | CONFIRMED | **CONFIRMED** | `dist/motion.js:23–25` — `defaultDuration=1100`, `defaultEasing=cubicBezier(0.85,0,0.15,1)` | None |
| 8 | Case-90 `zoomX` wraps first-party `d3-zoom@3.0.0` | CONFIRMED | **CONFIRMED** | `dist/interaction-zoom.js:2` — `import { zoom as createD3Zoom, zoomIdentity } from "d3-zoom"`; `package.json` deps pin `"d3-zoom": "3.0.0"`; `dist/interaction-zoom.d.ts` exports `zoomX<TValue>(options): ChartControl<…>` | None |
| 9 | `url(#id)` passthrough, verified verbatim, undocumented | CONFIRMED (undocumented) | **CONFIRMED-BUT-DIFFERENT** | Logic lives in `dist/svg.js:9–13` (`resolvePaint`): non-declared `url(#id)` returned unchanged on SVG; `dist/canvas.js:1062` explicitly nulls it. The **declared-gradient** happy path is now documented in 3 places (`docs/reference/chart-spec.md:165–168`, `docs/guides/themes-and-styling.md:169–171`, `docs/reference/rendering-and-export.md:270–274`) — but none of the three states what happens for an *undeclared* id. The specific passthrough-of-foreign-ids behavior the research flagged remains undocumented. See dedicated section below. | **Changes the Passthrough ruling's risk framing** — narrows "undocumented" to "the happy path is now documented; the escape-hatch case is not" |
| 10 | Tick format/values/rotation/hiding native | CONFIRMED | **CONFIRMED** | `dist/types.d.ts:165–186` `ChartAxisTickOptions.values`/`.format`; `ChartAxisTickLabelOptions.rotate`/`.thin` (collision-based hiding: `minGap`/`priority`/`keep`); `ticks:false`/`tickLabels:false` for full hiding | None |
| 11 | Reference rules / flat bands native (`ruleX/Y` null-skipping, ranged `rect`/`areaY`) | CONFIRMED | **CONFIRMED** | `dist/rule.d.ts` — `y?: Channel<TDatum, ChartValue \| null \| undefined>`; `dist/rule.js:16–24` drops invalid rows silently (`if (!isChartValue(yValue)) return;`); `docs/examples/annotations-and-overlays.md:57–70` | None |
| 12 | No *arbitrary* z-index, declaration-order deterministic; fixed groups grid→marks→axes→legend; focus-guide `placement:'under'\|'over'` | CONFIRMED | **CONFIRMED** | `dist/scene.js:216–263` builds nodes in exactly that order (grid unshifted under marks, axes pushed after marks, legend pushed last); no z-index property anywhere in `dist/`; `docs/concepts/marks-and-layering.md:34–53` ("Layer order is declaration order"); `placement` at `dist/types.d.ts:813`, `focus-layer.d.ts:11`, `svg-renderer.d.ts:12` | None |
| 13 | Marker/hover bands & pill labels covered by `crosshair`/`focusGuideX/Y` | CONFIRMED | **CONFIRMED-BUT-DIFFERENT (richer)** | `dist/crosshair.d.ts`: independent `x`/`y` toggles, each `boolean \| CrosshairAxisOptions` with categorical `band` + halo label (`stroke: "var(--ts-chart-crosshair-label-halo, Canvas)"`, `dist/crosshair.js:97`) + intersection `marker`. `dist/focus-guide.d.ts`: `focusGuideX/Y` are full data-bound marks with independent `xRule`/`yRule`/`marker`/`xLabel`/`yLabel` (pill `background`/`radius`/`paddingX`/`paddingY`) | None — capability is stronger than assumed, no downside |
| 14 | Tooltip content native-config via `@tanstack/charts/tooltip` token; `items`/`sort`/`anchor`/`placement`/`content`/`format`/`sticky`/`visibility:'pinned'`; `renderTooltipBody` | CONFIRMED | **CONFIRMED-BUT-DIFFERENT (renderTooltipBody only)** | `./tooltip` is a real subpath (`package.json` exports → `dist/tooltip.d.ts`, `export const tooltip: ChartTooltipExtension`). `ChartTooltipOptions` (`dist/types.d.ts:961–976`, full interface below) has all 8 named keys verbatim. **`renderTooltipBody` is NOT one of them** — it's a React-adapter render prop living only on `@tanstack/charts/react/tooltip` (equivalently `@tanstack/react-charts/tooltip`, the actually-installed package), not on the plain `./react` / default `Chart` import, and not a core spec key. See dedicated section below. | **High** — D7/B4 task sheet must import `Chart` from the `/tooltip` subpath, not the default adapter entry, wherever custom tooltip body content is needed |
| 15 | Label-position tweens need motion renderer, else "inert policy" | CONFIRMED | **CONFIRMED, verbatim** | `docs/reference/motion.md` §"Definition-local motion": *"`motion` on a definition, mark, axis, tick collection, tick-label collection, or axis label is **inert policy**. The optional renderer consumes it."* — exact phrase match | None |
| 16 | Tooltip token + motion sketch (`tooltip:{use:tooltip,anchor:'group-center',sort:'color-domain',portal}`, `focus:'group-x'`, `motion({transition:{type:'spring'}})`, `tooltip.motion`) | CONFIRMED | **CONFIRMED** | `anchor:'group-center'` valid (`ChartTooltipAnchor`, `dist/types.d.ts:1143`); `sort:'color-domain'` valid (`ChartTooltipSort`, `types.d.ts:1144`); `{use,...}` matches `ChartExtensionInput` (`types.d.ts:977`); `ChartFocusPreset` includes `'group-x'`; `tooltip.motion?: false \| ChartMotionTransition` (`types.d.ts:963–964`); all four elements appear near-verbatim in `docs/guides/tooltips-and-focus.md` | None — D7's proposed spec typechecks as written |
| 17 | Built-in/custom focus strategies (`group-x`/`group-y`, `maxFocusDistance`, `ChartFocusStrategy{resolve,group,navigation}`) | CONFIRMED | **CONFIRMED** | `dist/types.d.ts:1186–1200` — `ChartFocusStrategy<TDatum,TXValue,TYValue>{resolve,group,navigation}`; `ChartFocusPreset='nearest'\|'nearest-x'\|'nearest-y'\|'group-x'\|'group-y'`; `maxFocusDistance` at `types.d.ts:515,533`. `/focus` is a real subpath (`focusGroupX`,`focusGroupY`,`focusNearestX`,`focusNearestY`, `dist/focus.d.ts`). `docs/reference/focus-and-interaction.md:139–141` | None |
| 18 | Geometry-backed default nearest + `focusGroupAngle` (`/polar`), `onFocusGroupChange`, `onSelect(ChartPoint)`, `keyedSelection` | CONFIRMED | **CONFIRMED, one nuance** | `focusGroupAngle` real, `/polar` real subpath, same `{resolve,group,navigation}` shape (`polar-focus-internal.d.ts:6–11`). `onFocusGroupChange`/`onSelect` verbatim in `dist/dom-types.d.ts:180–181,193–194`; `onSelect: (point: ChartPoint\|null) => void`. `keyedSelection` at `dist/selection.d.ts:27`. Geometry-backing independently confirmed: `resolvePolarSector`/`tracePolarArcBoundary` (`polar-sector-internal.d.ts`) sample the *painted* arc boundary into a polygon for true point-in-shape hit testing (not centroid-distance) — `docs/reference/focus-and-interaction.md:145–146` states this explicitly. **Nuance:** the geometry-backed default nearest and `focusGroupAngle` are two related-but-separate mechanisms (default applies to painted arcs; `focusGroupAngle` is a distinct opt-in strategy for angular grouping across radial series, e.g. radar) — the original claim conflates them as one | Low — both mechanisms exist and cover D9, just attribute correctly in the write-up |
| 19 | Cross-chart linked cursors via `createChartCursor`+`cursorHost` | CONFIRMED | **CONFIRMED** | `dist/cursor.d.ts:5,7`; public re-export `dist/cursor-public.d.ts:1` (subpath `./cursor`); worked cross-chart example `docs/reference/focus-and-interaction.md:313–465` | None |
| 20 | Scene-level `gradients:[{id,x1..y2,stops}]` + `idPrefix` on `<Chart>` | CONFIRMED | **CONFIRMED** | `dist/types.d.ts:405` `gradients?: readonly ChartLinearGradient[]` on `ChartSpecBase`; shape `{id,x1?,y1?,x2?,y2?,stops}` matches (`types.d.ts:368–375`). `idPrefix` **is** a real React `<Chart idPrefix?: string>` prop, auto-defaulted from `useId()` (`dist/react/Chart.d.ts:13`; `docs/framework/react/reference/chart.md:145`) — one pass initially flagged this as render-option-only, but the React adapter surfaces it directly | None — fully usable as the plan assumes |
| 21 | Group-level clip `{kind:'group', clip:{x,y,w,h}}`, `spec.clip:true` | CONFIRMED (gap noted) | **CONFIRMED-BUT-DIFFERENT** | `spec.clip?: boolean` (`types.d.ts:406`, `docs/reference/chart-spec.md:17,38–39,150`) is a **whole-marks-group toggle**, not per-group-addressable and not shaped `{kind:'group',clip:{...}}`. The internal `SceneGroup.clip?: ChartBounds` (`types.d.ts:853`) is `{x,y,width,height}` (full field names, not `w`/`h`) via `ChartBounds extends ChartSize{width,height}` (`types.d.ts:108–114`) — scene-internal output, not an authoring-time field a custom mark sets directly | Low-medium — D10's bar-pulse-mark clipPath replacement is still coverable via `spec.clip:true`, but "target one group precisely" framing needs correcting to "toggle clip for the whole marks group" |
| 22 | Sankey keyframes → declarative per-mark `motion:`, precedent `network-sankey.ts:234` | CONFIRMED | **CONFIRMED, citation fixed** | `SankeyDiagramOptions extends ChartMarkMotionOptions<…>` (`dist/network-sankey.d.ts`); `docs/reference/marks/sankey.md:120` documents `motion: ChartMotionDefinition`. The line-numbered `.ts` citation doesn't resolve at this pin (dist ships bundled `.js`/`.d.ts`, no numbered source) — cite `.d.ts` + docs instead | None functionally; citation-path only |
| 23 | Escape hatch `ChartSvgRenderHooks{renderDefinitions?,renderGroup?,resolvePaint?}` via `renderChartSvgWithHooks`, in a "charts-core-d3 subpackage" | CONFIRMED (with caveat "not re-exported by main index") | **REFUTED (as a reachable public escape hatch)** | Both types exist verbatim in `dist/svg-renderer.d.ts:2–11`. Confirmed independently: **no `charts-core-d3` package exists anywhere** under `showcase/node_modules/@tanstack/` (only `@tanstack/charts` and `@tanstack/react-charts`). `svg-renderer.d.ts` has **zero package.json export entry** — the `./svg/renderer` subpath that *does* exist maps to a different file (`dist/svg-surface.d.ts`, exposing `createSvgChartRenderer`/`svgChartRenderer` instead), and the public `./svg` subpath exposes only plain `renderChartSvg`, not the hooked variant. Zero mentions in `docs/` or `skills/`. Consumed only internally by `svg.js`/`svg-surface.js`/`motion.js`. | **High** — weakens the D10/passthrough safety net; see "Still blocked" below. Note the *related* `createSvgChartRenderer(renderSvg?)` custom-renderer boundary (`./svg/renderer`) IS real and reachable — the fallback isn't zero, just narrower than claimed |
| 24 | `data-ts-key` + root `svg.ts-chart` documented public; `.ts-chart__*` internal-but-stable, pinned by unit tests | CONFIRMED | **CONFIRMED-BUT-DIFFERENT** | `data-ts-key`/`svg.ts-chart` ARE documented public contract (`docs/reference/rendering-and-export.md:113,126,301,405,760`; `docs/guides/custom-marks-and-renderers.md:402`). `.ts-chart__*` classes (60+ hits in `dist/*.js`) are actually **named in shipped per-mark reference docs** (`docs/reference/marks/polar.md:42`, `geo.md:52`) — stronger than "internal," they're documented, just not exhaustively. "Pinned by charts-core's own unit tests" is **UNVERIFIABLE at 0.15.0** — the published npm package ships only `dist/`+`docs/`, no test sources; only the older `local_cache` v0.14.0 clone has such tests | Low — the DOM contract is more discoverable than claimed, not less |
| 25 | `onRender(context{container,svg,scene,interaction})`, same-def/same-size update is documented no-op | CONFIRMED | **CONFIRMED-BUT-DIFFERENT** | `onRender` exists exactly as named (`dist/dom-types.d.ts:182`). Actual `ChartRenderContext` (`dom-types.d.ts:167–173`) is `{container,svg,scene,surface,interaction}` — **5 fields, claim omitted `surface`**. No literal "no-op" language found anywhere (`docs/reference/dom-host.md`, `adapter-controller.md` grepped for no-op/noop — nothing). Actual documented behavior is broader/differently framed: `docs/reference/dom-host.md:220–226` — `update` "renders synchronously when definition identity, size, accessibility, renderer, keyboard, ID, or text measurement changes," while interaction/tooltip/focus/animation/spatial-index "can update without rebuilding the scene" | Low-medium — the underlying behavior (cheap repeat-update) holds, but "documented no-op" overstates it; reframe as "renders on a documented trigger list, not on every call" |
| 26 | Fluid sizing native, host owns RO when `width` undefined; responsive builders; `initialWidth` for SSR; `height`/`aspectRatio` | CONFIRMED | **CONFIRMED** | `docs/guides/responsive-charts.md:15–30`: "Omit `width`… The shared DOM host observes the container" — library owns the ResizeObserver. `initialWidth` confirmed for SSR (`dist/adapter-shared.d.ts:5,10`; `dist/dom-types.d.ts:178,191`; docs:150–165). Responsive-builder form `defineChart(({width,height})=>({...}))` live in 5 separate doc pages. `height`/`aspectRatio` policy at responsive-charts.md:39–47 | None |
| 27 | x-range drag-select → `brushX`+`controlledSignal`+`whenSelected` | CONFIRMED | **CONFIRMED-BUT-DIFFERENT** | `brushX` (`dist/interaction-brush.d.ts:36–37`, subpath `/interaction/brush`) and `controlledSignal` (`dist/interaction-signal.d.ts:12`, subpath `/interaction/signal`) are both real and correctly paired — `brushX`'s `range` option is exactly `ControlledSignal<BrushRange<TValue>, BrushXChange<TValue>>`. **`whenSelected` does not pair with `brushX` at all.** Its only counterpart is `keyedSelection` (`dist/selection.d.ts:5,27,29`) — a *point-key* selection controller, unrelated to brush ranges (`KeyedSelection<TDatum,TKey,…>`, selects one semantic key, not a range). `docs/reference/focus-and-interaction.md` documents these under two separate, non-cross-referencing sections: "Controlled keyed selection" (`whenSelected`+`keyedSelection`, ~lines 466–508) and "Horizontal brush" (`brushX`, ~lines 560–585). The brush section states explicitly: *"the application still owns fixed-window expansion, validation, linked-view layout, status text, persistence, and any native semantic control."* There is no native mechanism to filter/highlight marks by brush range — that responsibility is entirely application-owned | **Medium** — if any D-item's plan sketch calls `whenSelected(mark, brushRangeSignal)` or similar, that composition does not typecheck. Range-driven mark filtering (e.g. dimming points outside a brushed x-window) must be hand-rolled from the brush's committed range value, not composed from a native primitive |
| 28 | `interactiveColorLegend`/`colorGradientLegend` exist, aria-pressed | CONFIRMED | **CONFIRMED** | `dist/interactive-legend.d.ts`: `interactiveColorLegend<TValue>(options): ChartColorLegend`; `dist/legend-static.d.ts`: `colorGradientLegend(options?): ChartColorLegend`. `aria-pressed` confirmed at runtime: `dist/interactive-legend.js:265` — `button.setAttribute("aria-pressed", String(item.visible))` | None |
| 29 | `radialText` mark exists but insufficient alone for sunburst (missing node angle/radius, no cross-mark transform graphs) | CONFIRMED (partial) | **CONFIRMED** | `radialText<TDatum>(source, options?): PolarMark<…>` (`dist/polar.d.ts`) is generic — takes its own `angle`/`radius`/`radiusOffset`/`anchor`/`rotate`/`dx`/`dy` channels, geometry-blind to sunburst. `SunburstNode<TDatum>` (`dist/hierarchy-sunburst.d.ts`) fully enumerated (`id`,`parentId`,`ancestorIds`,`branchId`,`name`,`data`,`depth`,`height`,`internal`,`external`,`value`,`source`,`sourceIndexes`) — **no angle/radius field**, confirmed by `docs/reference/marks/sunburst.md` §"Nodes and lineage." `dist/hierarchy-sunburst.js` computes per-sector `startAngle`/`endAngle`/`innerRadius`/`outerRadius` internally but never attaches them to the returned node or exposes them to callbacks. No cross-mark data channel exists (`PolarOptions.marks` composes independent `PolarMark` entries with no shared-geometry read access) | See "Still blocked" — D16 remains genuinely blocked, not a research gap |
| 30 | `layoutLabels(context)` participates in margin calc | CONFIRMED | **CONFIRMED** | `dist/types.d.ts:678,691` — `layoutLabels?: (context: MarkRenderContext) => readonly SceneLabel[]`; `docs/reference/custom-extensions.md:186–188` — "If a custom mark emits labels that should participate in automatic margins, return the same positioned labels from `layoutLabels`" | None |

---

## Tooltip options — full interface as shipped (0.15.0)

```ts
// dist/types.d.ts:961-976
export interface ChartTooltipOptions<TDatum = unknown, TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue> {
    className?: string;
    motion?: false | ChartMotionTransition;   // overrides active-renderer motion; false = immediate
    portal?: ChartTooltipPortalInput;
    items?: readonly ChartTooltipItem<TDatum, TXValue, TYValue>[];
    sort?: ChartTooltipSort<TDatum, TXValue, TYValue>;       // 'visual' | 'color-domain' | 'focus' | fn
    anchor?: ChartTooltipAnchor<TDatum, TXValue, TYValue>;   // 'point' | 'pointer' | 'group-center' | axis-anchor | fn
    placement?: 'auto' | ChartTooltipPlacement | readonly ChartTooltipPlacement[];
    offset?: number;
    content?: (points, context) => ChartTooltipContent;
    format?: (point, context) => string;
    formatGroup?: (points, context) => string;
    sticky?: boolean;
    visibility?: 'focus' | 'pinned';
}
```

`renderTooltipBody` is **not** in this interface — it lives only in the React adapter's `/tooltip` subpath:

```ts
// dist/react/tooltip.d.ts (or @tanstack/react-charts/tooltip, the package actually installed)
export interface ChartTooltipBodyRenderProps<TDatum, TXValue, TYValue> {
    renderTooltipBody?: (context: ChartTooltipBodyRenderContext<TDatum, TXValue, TYValue>) => React.ReactNode;
}
```

`ChartTooltipBodyRenderContext extends ChartTooltipBodyContext{points, content, pinned, dismiss}` plus `defaultBody: React.ReactNode`. The React reference doc is explicit: *"Import the drop-in component from the optional tooltip entry to use `renderTooltipBody`… Existing users of this prop should move `Chart` from `@tanstack/charts/react` to `@tanstack/charts/react/tooltip`."* Per-framework equivalents differ further: Vue uses a `#tooltipBody` scoped slot, Svelte a `tooltipBody` snippet prop, Angular a `[tanstackChartTooltipBody]` directive, Lit/Alpine an `options.renderTooltipBody` field.

**Practical consequence for D7/B4:** wherever bklit needs custom tooltip body content, `Chart` must be imported from `@tanstack/react-charts/tooltip` (the installed package's tooltip subpath), not the default `@tanstack/react-charts` export — it is not achievable by adding a prop to the standard import, and it is not a `defineChart`/spec-level key.

---

## `url(#id)` documentation status — dedicated finding (claim #9)

The **declared-gradient** happy path is now documented in three places:
- `docs/reference/chart-spec.md:165–168` — "Reference a declared gradient from a mark paint as `url(#revenue)`. `idPrefix` scopes generated resource IDs when multiple charts share a document."
- `docs/guides/themes-and-styling.md:169–171` — "Use `url(#revenue-fill)` as the mark paint. Default SVG hosts emit and scope the resource…"
- `docs/reference/rendering-and-export.md:270–274` — states the SVG renderer "rewrite[s] matching `url(#gradient-id)` paints."

None of the three states what happens when the id does **not** match a declared gradient. A full-tree grep for `url(#`, `passthrough`, `pass-through`, `pass through`, `foreign` across `docs/` returns only these three passages. The undeclared-id fallback (`dist/svg.js:9–13`: return the value unchanged if the id isn't in `gradientIds`) is visible only in shipped source, never in prose. **Canvas explicitly nulls** the same case (`dist/canvas.js:1062`).

**Risk-calculus impact on the Passthrough ruling (Section D):** the underlying behavior is unchanged and still verified verbatim from source — nothing here weakens the technical case. But the framing "undocumented" should narrow to **"the general gradient-reference mechanism is now documented; the specific undeclared-id passthrough escape hatch that patterns/foreign-defs would rely on is still not documented anywhere."** The guards PLAN-phase-5.md:76 already specifies (registry test + `renderSvg` fallback + solid-fill degradation) remain exactly as necessary as the original research assumed — arguably more necessary now, since claim #23 (see below) shows the sanctioned `ChartSvgRenderHooks` escape hatch is not publicly reachable, narrowing the fallback options to `createSvgChartRenderer`/`renderSvg` only.

---

## Corrections to append

For each claim/correction whose verdict changed materially (i.e. more than a citation-path fix), the terse note to append to the affected research file, quoting the line it corrects:

**Append to `01-deviation-native-paths.md`, near `01:52` / `01:65` / `01:68`:**

> **Pin-check (0.15.0):** `01:52` — "verified verbatim, undocumented" now needs narrowing: the *general* `url(#id)` gradient-reference mechanism is documented (`docs/reference/chart-spec.md:165–168`, `docs/guides/themes-and-styling.md:169–171`, `docs/reference/rendering-and-export.md:270–274`), but the specific case this research relies on — passthrough of an **undeclared** id — remains undocumented in prose (confirmed only in `dist/svg.js:9–13`). Guards from PLAN-phase-5.md:76 stay mandatory.

> **Pin-check (0.15.0):** `01:65` — `renderTooltipBody` is real but is NOT a key of `ChartTooltipOptions`/the `@tanstack/charts/tooltip` extension token. It is a React-adapter-only render prop requiring `Chart` to be imported from `@tanstack/charts/react/tooltip` (`@tanstack/react-charts/tooltip` for the installed package), per `dist/react/tooltip.d.ts`. All other listed keys (`items`/`sort`/`anchor`/`placement`/`content`/`format`/`sticky`/`visibility:'pinned'`) are confirmed verbatim on `ChartTooltipOptions` (`dist/types.d.ts:961–976`).

> **Pin-check (0.15.0):** `01:34` (spring defaults) — confirmed `{stiffness:170, damping:26, mass:1}` at `dist/spring.js:2–7`, but flag a doc trap: `docs/reference/motion.md`'s own illustrative code example writes `damping:18` as a chosen override, not the default. Anyone copying that snippet believing it's the default will silently diverge from the shipped default.

**Append to `02-visx-removal.md`, near `02:53–57`:**

> **Pin-check (0.15.0):** `02:53` — same narrowing as `01:52` above. Additionally, the sanctioned fallback set (`02:54`) needs correcting: `ChartSvgRenderHooks`/`renderChartSvgWithHooks` (what `05:26` cited as the escape hatch) is **not publicly reachable** at this pin — no package.json export path, no `charts-core-d3` package exists. The reachable fallback is narrower: `createSvgChartRenderer(renderSvg?)` via the real `./svg/renderer` subpath (→ `dist/svg-surface.d.ts`) only.

**Append to `05-native-paths-ii.md`, near `05:11` / `05:13` / `05:22` / `05:23` / `05:26` / `05:30` / `05:31` / `05:57`:**

> **Pin-check (0.15.0):** `05:11`/`05:65` (tooltip sketch) — CONFIRMED as written; typechecks against `ChartTooltipOptions`/`ChartExtensionInput`. See the `renderTooltipBody` correction above for the one piece needing a different import path.

> **Pin-check (0.15.0):** `05:13` — `focusGroupAngle` and the geometry-backed default nearest are two separate mechanisms, not one: default nearest already does arc/sector containment for painted `radialArc`/pie geometry (`polar-sector-internal.d.ts`'s `resolvePolarSector`/`tracePolarArcBoundary`); `focusGroupAngle` is a distinct opt-in strategy for angular grouping across radial series (radar/polar-line/radial-dot), layered on top, not the same code path.

> **Pin-check (0.15.0):** `05:22` — `idPrefix` is confirmed as a genuine React `<Chart idPrefix?: string>` prop (`dist/react/Chart.d.ts:13`), auto-defaulted via `useId()` — stronger than "render-option only," fully usable as originally sketched.

> **Pin-check (0.15.0):** `05:23` — `spec.clip` is a whole-marks-group boolean toggle (`types.d.ts:406`), not a per-group-addressable `{kind:'group',clip:{x,y,w,h}}` field as described; the internal `SceneGroup.clip: ChartBounds` uses `{x,y,width,height}` (not `w`/`h`) and is scene-output only, not an authoring-time field.

> **Pin-check (0.15.0):** `05:26` — REFUTED as a reachable public API. `ChartSvgRenderHooks`/`renderChartSvgWithHooks` exist in `dist/svg-renderer.d.ts` but have zero package.json export entry and no `charts-core-d3` package exists to house them; they're internal-only, consumed by `svg.js`/`svg-surface.js`/`motion.js`. Do not cite this as an available fallback without forking/patching. The separate `createSvgChartRenderer`/`renderSvg` boundary (`./svg/renderer`) remains genuinely reachable.

> **Pin-check (0.15.0):** `05:30` — the "pinned by charts-core's own unit tests" claim is UNVERIFIABLE at this pin: the published npm package ships no test sources (only `dist/`+`docs/`). The DOM contract itself (`data-ts-key`, `svg.ts-chart`, and even several `.ts-chart__*` classes) is documented, more so than the research assumed.

> **Pin-check (0.15.0):** `05:31` — no literal "no-op" language exists in shipped docs for `onRender`. Actual behavior is documented as a trigger list (`docs/reference/dom-host.md:220–226`): synchronous re-render on definition identity/size/accessibility/renderer/keyboard/ID/text-measurement change; interaction/tooltip/focus/animation/spatial-index updates "can update without rebuilding the scene." Also: `ChartRenderContext` has 5 fields (`container,svg,scene,surface,interaction`), not 4 — `surface` was omitted from the original citation.

> **Pin-check (0.15.0):** `05:57` — CONFIRMED as written, no change. `radialText` is real but geometry-blind to sunburst; `SunburstNode` exposes zero angle/radius fields even though they're computed internally (`dist/hierarchy-sunburst.js`); no cross-mark transform graph exists. D16 stays blocked, not merely under-researched.

> **Pin-check (0.15.0):** claim #27 (x-range drag-select) — `whenSelected` does not compose with `brushX`. It pairs only with `keyedSelection` (`dist/selection.d.ts:5,27,29`), a point-key selection controller unrelated to `BrushRange`. `brushX`+`controlledSignal` are correctly paired and confirmed real (`dist/interaction-brush.d.ts:36–37`), but any plan sketch that calls `whenSelected(mark, brushRangeSignal)` does not typecheck — docs (`docs/reference/focus-and-interaction.md`, "Horizontal brush" section) confirm range-driven mark filtering/highlighting is entirely application-owned, with no native primitive for it.

---

## Newly unlocked

Capabilities present in 0.15.0 that the research did not know about at all, bearing on D1–D17:

1. **Custom legends extension point — `ChartColorLegend`.** `docs/reference/scales-guides-and-color.md` §"Custom legends":
   ```ts
   interface ChartColorLegend {
     height(itemCount: number, context: ChartColorLegendContext): number
     placement?: 'top' | 'bottom'
     render(context: ChartColorLegendContext): SceneNode
   }
   ```
   This is the interface `interactiveColorLegend`/`colorGradientLegend` (claim #28) are themselves built on. It means D15's custom legend components could be wired into the chart's own layout system (reserved height + placement) via `render()` returning a keyed scene node, rather than staying a fully separate sibling DOM tree — a middle path between "full native adoption" and "keep-custom" that `05:55`'s verdict didn't consider. Doesn't remove the upstream-issue-#95 blocker on built-in legend *styling*, but changes the shape of what "keep-custom" can mean: custom-rendered content that still participates in native chart layout.

2. **`./svg/renderer` subpath (`createSvgChartRenderer`/`svgChartRenderer`).** Confirmed real and reachable (unlike `ChartSvgRenderHooks`) — this is the actual sanctioned custom-renderer boundary for D10/Passthrough fallback, distinct from what `05:26` cited.

3. **`.ts-chart__*` classes are more documented than assumed.** Several per-mark classes (`ts-chart__polar`, `ts-chart__sunburst`, `ts-chart__bar`, etc.) are named directly in shipped per-mark reference docs (`docs/reference/marks/polar.md:42`, `geo.md:52`), not merely "internal-but-stable" as `05:30` characterized them. Slightly derisks D11's reliance on `.ts-chart__dot` etc.

Checked and found **not** newly unlocked (confirms existing "Still blocked" status, no drift):
- Axis `tickLabels` options (`fontSize`,`fontWeight`,`opacity`,`anchor`,`dx`,`dy`,`thin`) still have **no `fill`/`background`/color accessor** — per-value colored tick pills (D6) remain unreachable via native tick config, exactly as `01:59–65` found.
- Funnel: `docs/examples/stacked-and-composition.md:168–172` still shows only the composition-only `areaX` trapezoid pattern (case `125-sales-funnel`), no dedicated funnel mark, no explicit refusal statement anywhere in shipped docs. D1/Section-D "Funnel" ruling is unaffected — confirms `01:74`'s "structural, not explicit" framing, UNVERIFIABLE as a historical-intent question but the *current* state is unchanged.

---

## Still blocked

Claims that remain genuine gaps at 0.15.0, with what upstream would have to ship:

- **D16 / claim #29 — Sunburst radial labels.** `SunburstNode` exposes zero angle/radius geometry despite computing it internally; `radialText` is generic and geometry-blind; no cross-mark data channel exists to bridge a hierarchy mark's resolved geometry to a sibling label mark. Upstream would need to either (a) add angle/radius fields to `SunburstNode` (cheap, the values already exist in `hierarchy-sunburst.js`), or (b) ship a sunburst-aware label channel/composite mark, or (c) add a general cross-mark geometry-read API. Until then: keep the overlay (`internal/sunburst-labels.tsx`), matching the existing PLAN-phase-5.md:20 out-of-scope ruling — this is not unblocked.

- **D10 / claim #23 — Paint-resource injection escape hatch.** `ChartSvgRenderHooks`/`renderChartSvgWithHooks` exist but are unreachable from application code (no export path, no housing package). Upstream would need to add a `./svg/render-hooks` (or similar) export entry to make this a supported extension point. Until then, any paint-resource need beyond declared `gradients`+`clip:true` and the `createSvgChartRenderer`/`renderSvg` boundary requires forking/patching `svg.js`, not composing.

- **D6 tick pills — unchanged gap.** `ChartAxisTickLabelOptions` has no fill/background accessor; per-value colored tick pills stay a custom-mark-in-scene or overlay concern. Upstream would need a `background`/`fill` field on tick-label options (or a dedicated tick-label mark) to close this.

- **D6 patterned/faded reference areas, edge fades, `ifOverflow`, corner markers — unchanged gap.** Nothing in the 0.15.0 typings/docs search surfaced upstream equivalents; these remain stays-as-overlay per the original `01:62,66,67` findings, unaffected by this pin-check (out of scope for this pass's 30-claim list, but worth noting no drift was found).

- **Legend full styling hooks (upstream issue #95).** Still open per the original research's characterization (this pin-check did not re-check issue-tracker state — GitHub issue status is not settleable from shipped typings/docs; recommend a live issue-tracker check if the lead wants this re-confirmed, separately from this pin-check's scope).
