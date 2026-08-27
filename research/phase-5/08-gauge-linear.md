# 08 — Gauge linear orientation (D3)

Researches ledger.md Section A, D3: "Gauge linear orientation: no TanStack
container at all — third full bypass"
(`showcase/migrated/charts/gauge.tsx:33-45`, current lines — the ledger's own
citation of `gauge.tsx:10-32` is now stale/wrong: that range is the **arc**
orientation's dev-log paragraph in the current file; the linear paragraph
moved to `33-45` after a header rewrite. Content is otherwise consistent with
what the ledger describes.) PLAN-phase-5.md:77 leaves the ruling open: "FIX
(bring under `<Chart>`) or ACCEPT — decide during planning." This doc supplies
the missing research for that decision, against the pinned, published
`@tanstack/charts@0.15.0` runtime installed at `showcase/node_modules/@tanstack/charts/`.

## 1. What the linear-orientation gauge renders

Source of truth: `repos/bklit-ui/packages/ui/src/charts/gauge.tsx` (original,
738 lines) + `notch-gauge-shared.ts` (218 lines) + `gauge-label-layout.tsx`
(164 lines), all read in full. Migrated port: `showcase/migrated/charts/gauge.tsx`
(1246 lines, read in full) + `internal/gauge-notch.ts` (456 lines) +
`internal/gauge-center.tsx` (263 lines).

**It is not a bar/track-with-fill gauge.** It is a **segmented notch strip**:
a horizontal row of up to `totalNotches` (default 40) independently-drawn
quadrilaterals, laid out and filled exactly like the arc orientation's notch
ring, just unrolled onto a line instead of a circle. There is no continuous
rect, no scale, no axis, no ticks, no gridlines, and no needle/pointer of any
kind (bklit design ruling D28, restated in the migrated header comment,
`gauge.tsx:6`).

**Geometry** (`internal/gauge-notch.ts:370-455`, `computeLinearNotches`,
verbatim port of the original's inline layout math):
- `centerY = height / 2`.
- `depthFactor = clamp(notchLengthPercent, 5, 100) / 100`; `outerOffset = (height/2) * depthFactor`.
- `taperRatio = 28/42` (the same 0.28/0.42 ratio arc uses for inner/outer radius).
- `innerOffset = uniformWidth ? outerOffset : outerOffset * taperRatio`.
- `notchDepth = uniformWidth ? outerOffset*2 : outerOffset - innerOffset`.
- `activeNotches = round(value/100 * totalNotches)`.
- `availableWidth = width * (1 - spacing/100)`; `slotWidth = availableWidth / totalNotches`; `gapWidth` fills the remaining `spacing%` evenly between slots.
- Each notch's center: `xCenter = i*(slotWidth+gapWidth) + slotWidth/2`.
- **`uniformWidth = true`** (the default, `GaugeProps.uniformWidth`, `gauge.tsx:217`): each notch is an **axis-aligned rectangle** — `x1..x4` at `xCenter ± halfWidth`, `y1..y4` at `centerY ± notchDepth/2` (`gauge-notch.ts:416-425`).
- **`uniformWidth = false`**: each notch is a **trapezoid** — outer edge (`y = centerY - outerOffset`) full `halfWidth`, inner edge (`y = centerY + outerOffset`) narrowed to `halfWidth * innerOffset/outerOffset` (`gauge-notch.ts:426-436`).
- Every notch is then run through `createNotchPath(points, notchCornerRadius, cornerVerticalDepth)` (`gauge-notch.ts:116-…`, ~identical to the arc path's call), which is **not** a plain 4-line polygon: it's a bespoke quadratic-Bézier corner-fillet path generator (ported verbatim from `notch-gauge-shared.ts`) that rounds each of the quad's 4 corners by `notchCornerRadius` px (default `0`, but the frozen QA scenario sets it to `3` — see §4).

**Fill / paint** — two full passes over the notch set, same as arc:
- **Background/track pass**: every notch, `fillOpacity = resolveGaugeBgFill(...)` (solid `var(--chart-background)` in linear mode, or a caller override, or a gradient-interpolated color) at `DEFAULT_INACTIVE_FILL_OPACITY = 0.8` unless overridden.
- **Active overlay pass**: only notches with `index < activeNotches`, `fillOpacity` via `resolveGaugeActiveFill(...)` (solid `var(--chart-1)`, a caller override, a two-stop linear-interpolated gradient across notch index, or a theme-palette `url(#gauge-theme-active-…)` gradient ref) at `DEFAULT_ACTIVE_FILL_OPACITY = 1` unless overridden.
- Both resolvers, `interpolateGaugeHex`, and the theme-gradient `<linearGradient>` construction are shared verbatim with arc via `internal/gauge-notch.ts` (ported from `notch-gauge-shared.ts`).
- `children`-as-defs escape hatch: caller-supplied `<linearGradient>`/`<pattern>` JSX is collected via `collectGaugeDefsElements(children)` and mounted in a `<defs>` inside the same `<svg>` (`gauge.tsx:1169-1179`).

**Value readout** (`internal/gauge-center.tsx:90-147`, `GaugeLabelStat`): when
`centerValue` is supplied, a plain, **un-animated** number/label stack
(`CenterStat`, shared with arc's `CenterShell`) is composed around the track
via `GaugeLabelLayout` (`gauge-center.tsx:174-262`, 4-placement ×
3-alignment flexbox layout — `top`/`bottom`/`left`/`right` ×
`start`/`center`/`end`), driven by `labelPlacement`/`labelAlign` props. This
is a **documented, deliberate divergence from arc**: arc's `GaugeCenterOverlay`
mirrors bklit's `PieCenterShell` 0→value mount-entrance "roll-in" trick
(double-`requestAnimationFrame`, `gauge-center.tsx:7-16`); linear's
`GaugeLabelStat` has no entrance trick at all — it feeds `centerValue`
straight through (`gauge-center.tsx:17-22`, confirmed against
`gauge-label-layout.tsx:35-70` in the bklit original, which calls
`ChartStatFlow` directly with no intro state machine). This divergence is
orthogonal to D3 — it lives entirely in `gauge-center.tsx`/`CenterStat` and
does not depend on whether the notch strip itself sits under `<Chart>`.

**Animation** (`internal/gauge-reveal.ts`, shared with arc): WAAPI-only,
key-diffed by `data-bkm-key` per notch (`bg-{i}` / `active-{i}`). Mount reveal
+ D28's value-update idiom (increase = spring-pop only newly-active notches;
decrease = instant vanish). `notchLengthPercent`, `notchWidthPercent`,
`enterTransition`, `enterStaggerScale`, `geometryScrubbing` all feed this,
identically to arc.

**Interaction**: none — no hover, no tooltip, no focus ring (bklit D28,
restated `gauge.tsx:6`).

**Public props actually reaching the linear path** (`GaugeLinearProps =
Omit<GaugeProps, "orientation"|"startAngle"|"endAngle">`, `gauge.tsx:939`,
full `GaugeProps` at `gauge.tsx:206-255`): `value`, `totalNotches`, `spacing`,
`notchCornerRadius`, `uniformWidth`, `useGradient`, `activeGradient`,
`inactiveGradient`, `centerValue`, `defaultLabel`, `prefix`, `suffix`,
`formatOptions`, `labelPlacement`, `labelAlign`, `inactiveFill`, `activeFill`,
`inactiveFillOpacity`, `activeFillOpacity`, `children` (defs), `className`,
`width`, `height`, `minWidth`, `notchLengthPercent`, `notchWidthPercent`
(linear-only), `linearHeight` (linear-only, default 24px,
`DEFAULT_LINEAR_GAUGE_HEIGHT`), `enterTransition`, `enterStaggerScale`,
`geometryScrubbing`, `style`.

## 2. What it currently does — the bypass, quantified

Both orientations dispatch from one public `Gauge` component
(`gauge.tsx:1239-1246`). They are **not equally bypassed**:

- **Arc is fully on-pipeline.** `GaugeArc` (`gauge.tsx:336-934`, ~598 lines)
  uses `<Chart>` unconditionally. Default (`uniformWidth=false`): stock
  `polar()` + `radialArc` × 2 (`gauge.tsx:704-757`). `uniformWidth=true`: a
  **custom `PolarMark<unknown>`** (`gauge.tsx:598-671`, 74 lines) nested
  inside `polar()`, whose `render()` hand-emits `SceneNode` groups
  (`kind:"group"`, `key:"gauge-bg"/"gauge-active"`) of `kind:"polyline"`
  nodes carrying an explicit `path` string built by the *same*
  `createNotchPath` used by linear — i.e. arc already ships a working
  example of bypassing every built-in polar geometry helper while staying
  under `<Chart>`. Both branches: `defineChart({ marks:[polar({...})], x:null,
  y:null, guides:false, focus:focusDisabled, gradients:[...] })`
  (`gauge.tsx:673-699`, `704-757`). Reveal wiring is a `<Chart onRender=
  {handleRender}>` callback (`gauge.tsx:794-862`) that queries
  `[data-ts-key="gauge-bg"]`/`[data-ts-key="gauge-active"]` (the native
  group-key→`data-ts-key` DOM attribute the SVG renderer produces for any
  `kind:"group"` SceneNode) then `querySelectorAll("path")` inside each.

- **Linear is a ~294-line plain-SVG island with zero `<Chart>` usage.**
  `GaugeLinear` spans `gauge.tsx:941-1234`. Nothing in it imports or calls
  `defineChart`, `<Chart>`, `polar`, `rect`, or any other `@tanstack/charts`
  primitive — confirmed against the file's own import block
  (`gauge.tsx:110-160`, which imports `Chart`/`defineChart`/`focusDisabled`/
  `polar`/`radialArc`/`renderChartSvgWithResources` at module scope, all used
  only by `GaugeArc`). Specifically:
  - `gauge.tsx:1160-1203` (44 lines): a raw hand-authored `<svg viewBox=…>`
    with a manual `<defs>` and a `<g ref={groupRef}>` of `<path>` elements,
    keyed by a bespoke `data-bkm-key="bg-{i}"`/`"active-{i}"` scheme (not
    TanStack's `data-ts-key`).
  - `gauge.tsx:1091-1146` (56 lines): a `useLayoutEffect` that does raw DOM
    queries against that scheme (`groupEl.querySelectorAll('[data-bkm-key^=
    "bg-"]')` etc., `gauge.tsx:1107,1116`) to drive the WAAPI reveal — the
    same *reconciler* (`reconcileGaugeReveal`) arc uses, but wired by hand
    instead of via a `<Chart onRender>` callback.
  - The rest (`942-1090`, `1148-1234`, ~185 lines) is prop destructuring,
    `useGaugeFillState`, `computeLinearNotches` invocation, the
    `GaugeLabelStat`/`GaugeLabelLayout` composition, and responsive-width
    container plumbing — none of it TanStack-specific either way.

  The file's own header comment concedes this explicitly: "Linear: plain
  hand-rolled `<svg>` (NO `@tanstack/charts` container at all) — same
  fallback precedent already established by ring-chart.tsx/pie-chart.tsx"
  (`gauge.tsx:33-35`), and argues inline that "a `cartesian()` custom mark
  would gain nothing over plain SVG here" (`gauge.tsx:41-42`) — a claim this
  research directly evaluates in §3.

**Net: 100 of 294 GaugeLinear lines (the `<svg>` block + the reveal
`useLayoutEffect`) are the actual bypass; the geometry math itself
(`gauge-notch.ts`) is already orientation-agnostic and shared with arc.**

## 3. Can 0.15.0 host it?

**Yes — but not via any stock mark. Via the same general-purpose custom-mark
escape hatch (`createMark`) arc's own `uniformWidth=true` case already uses,
placed at the top level of `marks:[...]` instead of nested in `polar()`.**
Every claim below is checked against the installed `0.15.0` `dist/*.d.ts`
and `docs/`.

**a) `defineChart` imposes no polar/cartesian wrapper requirement.**
`showcase/node_modules/@tanstack/charts/dist/scene.d.ts:16-18` (`defineChart`
overload used by both `gauge.tsx` calls today) types `marks: TMarks` as
`readonly ChartMark<any,any,any,any,any,any,any>[]` — nothing requires a
`polar()`/`cartesian()` container; any `ChartMark` can sit at the top level.
First-party doc precedent for exactly this "flat custom composition, no
scale-driven positioning" pattern:
`docs/examples/networks-and-hierarchies.md` (basic-sankey example, lines
~70-104) composes `link`, `rect(layoutNodes, {x1:'x0',x2:'x1',y1:'y0',
y2:'y1',key:'key',inset:0})`, and `text(...)` directly under `scales:{x:null,
y:null}, guides:false, margin:0` — i.e. a chart whose marks consume
pre-computed literal coordinates rather than a data-driven domain, no
positional wrapper. `gauge.tsx` itself already sets `x:null, y:null,
guides:false` for **both** arc branches (`673-699`, `704-757`) — the same
recipe, just with `polar()` as the (optional, not required) sole top-level
mark today.

**b) `createMark` is the documented, sanctioned extension boundary for
exactly this case.** `dist/mark.d.ts:7`: `createMark<TDatum,TXValue,TYValue,
TXScaleId,TYScaleId>(initialize, motion?, renderer?): ChartMark<...>`.
`docs/guides/custom-marks-and-renderers.md` (first ~140 lines): "the normal
extension boundary" when a visualization isn't expressible via built-in
composition, with the canonical example consuming `chart.x`/`chart.width`
straight from the render context. `dist/types.d.ts:622`,
`MarkRenderContext { markIndex, surface, chart: ChartBounds, scales, theme,
color, colors, layout }`; `ChartBounds` (`types.d.ts:112`) is `ChartSize &
{x,y}` — the exact plot-area pixel rect a linear notch strip needs, and with
`x:null,y:null,margin:0` (the sankey precedent) that rect equals the full
`width×height` passed to `computeLinearNotches` today, so **no coordinate
translation is needed at all** — unlike arc's custom mark, which must
subtract `layout.centerX/centerY` (`gauge.tsx:608-609,613-620`) because
`computeArcNotches`' points are chart-relative, not layout-origin-relative.

**c) The stock `rect` mark cannot fully substitute — two independent, citable
reasons — so the FIX must be a custom mark, not `rect`:**
1. **Shape**: `dist/rect.d.ts` (`RectOptions<TDatum>`) only expresses
   axis-aligned rectangles (`x1/x2/y1/y2` or `x/z`+width channels) — it has
   no facility for the 4 independent corner points a trapezoid needs. Linear
   notches are trapezoids whenever `uniformWidth=false` (`gauge-notch.ts:
   426-436`) — `rect` cannot draw that case at all, in either scale-driven or
   `x:null/y:null` literal-pixel mode (confirmed by the sankey example itself:
   even there, `rect` only ever receives 2 opposite corners, never 4
   independent ones).
2. **Corner rounding is a different curve.** `RectOptions.radius?: number`
   (`dist/rect.d.ts`) is a single scalar passed straight through
   (`dist/rect.js:132`, `radius: options.radius`) to the SVG renderer, which
   emits it as literal SVG `rx`:
   `showcase/node_modules/@tanstack/charts/dist/svg-renderer.js:56`:
   ```
   return `<rect${common} x="${number(node.x)}" y="${number(node.y)}" width="${number(node.width)}" height="${number(node.height)}"${node.radius === void 0 ? "" : ` rx="${number(node.radius)}"`}/>`;
   ```
   `rx` is a **circular-arc** corner (SVG native). bklit's own
   `createNotchPath` (`notch-gauge-shared.ts`, ported to `gauge-notch.ts:
   116-…`) is a **quadratic-Bézier** corner fillet — a different curve family,
   not a re-parameterization of the same shape. `rect`'s `radius` and bklit's
   `notchCornerRadius` are **not interchangeable**, geometrically, whenever
   `notchCornerRadius > 0`. This matters concretely because the frozen QA
   scenario **does** exercise a non-zero radius (`notchCornerRadius={3}` in
   `bench/app/src/scenarios/bklit-gaugelinear.tsx`) — a `rect`-based port
   would very likely visibly diverge from the currently-perfect
   (0.0000%-diff) gate the moment it's screenshotted.

   `rect`'s `radius` is adequate **only** for the `uniformWidth=true &&
   notchCornerRadius===0` special case, which is not what's gate-tested.

**d) The right shape of the fix, concretely, by direct analogy to arc's own
shipped `uniformWidth=true` custom mark** (`gauge.tsx:598-671`): a
top-level `createMark`-based `ChartMark` whose `render()` calls
`createNotchPath(notch.points, notchCornerRadius, geometry.cornerVerticalDepth)`
— **the exact same function, unmodified** — once per notch, and emits the
same `kind:"group"`/`kind:"polyline"` `SceneNode` shape arc's `quadMark`
already emits (`gauge.tsx:625-668`), grouped under `key:"gauge-bg"`/
`"gauge-active"` so the *already-shipped* `handleRender`/`onRender` pattern
(`gauge.tsx:794-848`, querying `[data-ts-key="gauge-bg"]` +
`querySelectorAll("path")`) can drive the reveal — **replacing**, not
extending, the bespoke `data-bkm-key` DOM-query scheme linear invents today
(`gauge.tsx:1107,1116`). Because `computeLinearNotches` already outputs
absolute local-pixel points (no `tx`/`ty` translation needed, per (b)
above), this custom mark is *simpler* than arc's, not harder. Both
`uniformWidth` cases (rectangle and trapezoid) are handled identically by
this route since `createNotchPath` already branches on the point set it's
given — no `rect`/`radialArc`-style split is needed on the mark side at all.

**e) Ancillary pieces are already proven, or explicitly out of scope:**
- Gradients / theme-palette fill: `gradients?: readonly ChartLinearGradient[]`
  (`dist/types.d.ts:405`) + `idPrefix?: string` (`dist/types.d.ts:951`) —
  arc already uses this exact mechanism (`gauge.tsx:684-698`) for its
  `useThemePaletteGradient` case; directly reusable, zero new research needed.
- `ariaLabel` on `<Chart>` is **required**, not optional
  (`dist/react/Chart.d.ts`, `ChartCommonProps.ariaLabel: string`) — arc
  already supplies `"Gauge chart"` (`gauge.tsx:856`); linear would need the
  same, which is a non-issue (was already implicitly "aria-hidden" as a raw
  `<svg aria-hidden="true">`, `gauge.tsx:1163` — `<Chart>` has no
  `ariaHidden` prop, only `ariaLabel`, but this is the same contract arc
  already lives under, not a new class of risk).
- `stagger()`/`motion()` (`dist/motion.d.ts:4`) — the native animation
  renderer — is **not required** for this fix. D4 (native `motion()`
  migration) is a separate, later-sequenced ledger item (batch B7); the FIX
  proposed here keeps the existing WAAPI `reconcileGaugeReveal` mechanism
  (already shared with arc) untouched, same as arc does today.
- No other native mark (`waffleX/Y`, `boxX/Y`, `tickX/Y`) is closer-fitting
  than a custom mark — none of them support 4-independent-point quads or a
  Bézier corner fillet either.

**Verdict: 0.15.0 can host the linear gauge under `<Chart>`, fully, via a
custom top-level `createMark` mark that calls `createNotchPath`/
`computeLinearNotches` verbatim — the identical pattern, at lower
implementation complexity, to arc's own already-shipped, already-QA-passing
`uniformWidth=true` custom `PolarMark`. This directly refutes the file's own
inline claim (`gauge.tsx:41-42`) that a custom mark "would gain nothing over
plain SVG here" — the claim conflates "no `cartesian()` wrapper exists or is
needed" (true) with "`<Chart>` can't be used at all" (false: `createMark` at
the top level, with no wrapper, is exactly what's needed and is precedented
both by arc's own code and by the first-party sankey doc example).**

## 4. Cost the two branches honestly

**QA stakes**: `qa/results/gaugelinear/2026-08-25T16-08-43-932Z/report.json`
— all four probes (`settled`, `hover-30`, `hover-50`, `hover-70`) currently
read `diffPercent:0, pass:true, overallPass:true` at `gate:0.005`. This is a
**perfect** score today — any visual change is a regression, not an
improvement-with-noise. The frozen scenario
(`bench/app/src/scenarios/bklit-gaugelinear.tsx`) sets `notchCornerRadius={3}`
(exercises the Bézier fillet) but does **not** vary `uniformWidth` (stays
default `true` — the rectangle case only; `bench/data.ts:558-587`,
`generateGauge`/`generateGaugeUpdate`, confirms `uniformWidth`/
`notchCornerRadius` are fixed scenario props, never randomized per seed).
So the gate exercises the rounded-rectangle case but never the trapezoid
case — a real gap in bench coverage independent of this ruling, worth
flagging but not blocking either branch.

### FIX — bring linear under `<Chart>`

**Shape of the change** (§3d): remove the raw `<svg>` block
(`gauge.tsx:1160-1203`, 44 lines) and the bespoke reveal `useLayoutEffect`
(`gauge.tsx:1091-1146`, 56 lines); add (i) a `createMark`-based `ChartMark`
building the same `kind:"group"`/`"polyline"` `SceneNode`s arc's `quadMark`
already builds (structurally ~60-90 lines, *simpler* than arc's 74-line
`quadMark` at `gauge.tsx:598-671` since no origin translation is needed);
(ii) a `defineChart({ marks:[customMark], x:null, y:null, guides:false,
gradients:[...] })` call (~20-25 lines, near-identical to `gauge.tsx:
673-699`); (iii) a `<Chart ariaLabel="Gauge chart" definition={definition}
onRender={handleRender} renderSvg={renderChartSvgWithResources} .../>` JSX
block (~15-20 lines, lighter than arc's `852-880` since linear's
`centerValue` overlay is already handled by the separate `GaugeLabelLayout`/
`GaugeLabelStat` composition, not inline); (iv) an adapted `handleRender`
reusing arc's exact `[data-ts-key="gauge-bg"]`+`querySelectorAll("path")`
pattern (`gauge.tsx:794-848`, ~50-55 lines, near copy-paste with `"arc"` →
some new stagger-hint string swapped).

**LOC estimate**: ~180-220 lines touched/added in `gauge.tsx`, net delta
roughly **+60 to +90 lines** (replacing ~100 removed lines with ~150-190
added, since the `<Chart>`/`onRender` plumbing costs more lines than the raw
`useLayoutEffect` it replaces — same asymmetry already visible in arc's own
code, where its 336-934-line span is proportionally larger than linear's
942-1234). `internal/gauge-notch.ts` and `internal/gauge-reveal.ts` need
**zero** changes — every geometry/fill/reveal function is reused verbatim,
already orientation-agnostic.

**Parity risk**: real but bounded and precedented. The dominant risk is the
`rect`-`rx`-vs-Bézier mismatch (§3c) — but the recommended custom-mark route
sidesteps it entirely by calling `createNotchPath` directly, so this risk
only materializes if a *future* implementer takes the `rect` shortcut
instead of following this research's recommended shape. Secondary risk: the
`data-ts-key` group-selector reveal wiring is a genuinely new code path for
linear (today's `data-bkm-key` scheme is bespoke to it) — but it is *not*
new to the codebase; it is arc's exact, already-shipped, already-passing
mechanism, being reused rather than invented. Given the gate is at 0.0000%
today, any implementation would need a full local pixel-diff re-run before
merge regardless of branch chosen (standard practice for this repo, not a
special cost of FIX).

**What it buys**: eliminates the "third full bypass," makes gauge fully
consistent with pie/ring/sunburst/radar/arc's own already-completed
native-container migration; makes linear eligible for D4's eventual
`motion()`/`stagger()` renderer migration (currently blocked for anything
still using raw WAAPI outside `<Chart>`); replaces a bespoke DOM-query reveal
scheme with the same `onRender`/`data-ts-key` idiom used everywhere else in
the codebase, reducing bespoke-pattern surface area.

### ACCEPT — leave linear as a plain-SVG island

**DoD check — the load-bearing, non-obvious finding**: the Definition of
Done's import allowlist ("migrated code imports only react/@tanstack/*/
d3-*") is checked against `gauge.tsx`'s import block
(`gauge.tsx:110-160`), confirmed exhaustively: `react`, `@tanstack/react-charts`,
`@tanstack/charts`, `@tanstack/charts/focus/disabled`,
`@tanstack/charts/polar`, `@tanstack/charts/svg/resources`, and a series of
local `./internal/*` and `./styles.css` imports. **There is no foreign
package import anywhere in the file, including inside `GaugeLinear`.** The
linear bypass uses plain React/JSX/SVG — not `@visx/*`, not `motion/react`,
not any other library the original bklit file used. So ACCEPT does **not**
literally violate the DoD's import-allowlist wording today, and would not
newly violate it going forward either — the cost of ACCEPT is entirely
architectural/philosophical (a permanent hole in "make backend tanstack
charts native," the project's stated main goal), not a DoD technicality.

**What stays non-native under ACCEPT**: the 100-line raw-`<svg>` +
raw-DOM-query core identified in §2, permanently; linear stays ineligible
for D4's `motion()` migration indefinitely (or requires a separate one-off
WAAPI-to-native translation later, whenever D4 lands, that this same
research would have already solved half of); the codebase keeps 3 total
`<Chart>`-bypass sites (ring, pie via their own precedent, linear) instead
of 2, undermining the "same fallback precedent" argument the file's own
comment uses to justify itself (`gauge.tsx:34-35`) — precedent that gets
weaker, not stronger, the longer it's cited without being revisited.

## 5. Recommendation

**FIX.** The evidence clearly favors it:

1. **0.15.0 can host it, cleanly**, via a mechanism (`createMark` at the top
   level of `marks:[...]`, no polar/cartesian wrapper) that is both
   documented first-party (custom-marks-and-renderers.md,
   networks-and-hierarchies.md's sankey example) and **already shipped and
   QA-passing in this exact codebase** for the structurally harder polar
   case (arc's `uniformWidth=true` custom `PolarMark`, `gauge.tsx:598-671`).
   This is not speculative architecture — it is the same trick, applied to
   an easier coordinate space (no origin translation needed).
2. **The LOC cost is bounded and comparable to work already merged.** ~180-220
   touched lines, net +60-90, zero changes to the shared geometry/reveal
   internals. This is smaller than the arc `uniformWidth=true` branch that
   already exists in this file.
3. **The single real parity risk (`rect`'s `rx` vs. bklit's Bézier fillet)
   is avoidable by construction** — the recommended approach never uses
   stock `rect`, so it cannot regress the QA gate on that axis. The
   remaining risk (new `data-ts-key` reveal wiring) is a straight reuse of
   arc's already-verified pattern, not new engineering.
4. **The file's own stated reason not to do this
   (`gauge.tsx:41-42`, "a `cartesian()` custom mark would gain nothing")
   is answered by evidence, not assumption**: no `cartesian()` wrapper is
   needed or was ever required; a plain top-level custom mark is the
   sanctioned, precedented, and *simpler-here-than-in-arc* route.
5. **ACCEPT's only real cost/benefit tradeoff is philosophical, not
   technical** — since the DoD import-allowlist is already satisfied either
   way, ACCEPT doesn't buy safety it doesn't already have; it only defers a
   bounded, low-risk, already-precedented piece of work while leaving the
   project's central goal ("native tanstack backend") permanently unmet at
   this one site for no remaining technical obstacle.

If the lead's ruling is ACCEPT despite this, the ledger entry should be
amended to say so explicitly with the DoD-satisfaction caveat above (so a
future reader doesn't mistake "no research" for "researched and rejected" —
which was exactly the gap ledger.md flagged this doc to close).
