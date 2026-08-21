# 03 — Stack Comparison: bklit-ui vs. TanStack Charts

Status: research complete (traced against source in `repos/bklit-ui` and `repos/tanstack-charts`).

Purpose: this document exists to answer one question precisely — **where does each stack spend its work, on mount, on data change, and on every pointermove/hover** — so migration decisions in later phases optimize for the right thing. Every claim below is backed by a file path. Line numbers refer to the state of the cloned repos at research time; re-grep if they drift.

All paths below are relative to `/Users/tomasdomingos/bklit-tanstack-charts-migration/`.

---

## 0. TL;DR

| | bklit-ui | TanStack Charts |
|---|---|---|
| Chart body is | a tree of React components emitting real SVG elements (via visx) | an HTML string, generated once per data/size change, diffed against the live DOM by a small keyed reconciler that **React never sees** |
| React re-renders on hover? | Yes — hover state is React state (`useState`/context), read by multiple components | No — hover repaints one `<circle>`'s attributes and a tooltip `<div>`'s text directly; **zero React re-renders** |
| Animation loop touches React? | Yes, in the two hottest paths (line-path morph, y-domain tween): `motion`'s `animate()` calls `setState` every frame | No — attribute tweening is a raw `requestAnimationFrame` loop calling `element.setAttribute()`; React is not involved after mount |
| Margins/ticks | Fixed/prop-driven defaults, hand-tuned tick-layout heuristics in JS | Auto-measured from real text metrics (canvas `measureText`, cached) via a fixed-point layout solver, isomorphic (falls back to a character-width estimator with no DOM) |
| Hit-testing | Per-chart hook does `bisectDate` (binary search) + per-line scale lookups synchronously inside the React event handler, `setState`s a tooltip object on a rAF-deduped scheduler | Per-chart pluggable strategy: linear nearest-point scan (`d3.least`, O(n)) by default, or an opt-in spatial index; result feeds an imperative DOM paint, not React |
| SSR | Effectively client-only: every chart is `"use client"` and gated behind `<ParentSize>` (visx/responsive), which renders nothing until a client-side `ResizeObserver` fires | Isomorphic by construction: `renderChartSvg` is pure string concatenation with no DOM API calls; `prerender()` can run on the server and the client adopts/diffs the same markup |
| React version | React 19 (`peerDependencies: "^18.0.0 \|\| ^19.0.0"`, `packages/ui/package.json`) | React 19 (`peerDependencies: "^19.0.0"`, `packages/react-charts/package.json`) |

The single biggest architectural fact to internalize: **TanStack's React adapter renders a chart's SVG body exactly once** (`React.memo(..., () => true)` on `ChartSurface` — the comparator always returns `true`, i.e. "props are equal," so React skips re-rendering it forever after mount). Every subsequent visual change — new data, resize, hover, focus, animation — happens through an imperative `adapter.update()` call in a `useLayoutEffect`, which touches real DOM directly. bklit-ui, by contrast, keeps the entire chart body as live React state and props, so React's reconciler runs on every hover, drag, and animation frame.

---

## 1. bklit-ui: rendering pipeline (data + props → pixels)

**Path:** `<LineChart>` (React component, `repos/bklit-ui/packages/ui/src/charts/line-chart.tsx`) → `<ParentSize>` (visx/responsive, client-only `ResizeObserver`) → `<ChartInner>` → `<TimeSeriesChartInner>` (`time-series-chart-shell.tsx`) → `<ChartProvider>` (React context, `chart-context.tsx`) → child series components (`<Line>`, `<Area>`, `<Bar>`, …) that call `@visx/shape`'s `<LinePath>`, `<AreaClosed>`, etc., which are themselves plain React components returning `<path>`/`<rect>`/`<circle>` JSX.

Concretely, from `line-chart.tsx`:

```
<ParentSize debounceTime={10}>
  {({ width, height }) => (
    <ChartInner ... width={width} height={height}>{children}</ChartInner>
  )}
</ParentSize>
```

`ParentSize` renders its children **only after** a client `ResizeObserver` has measured the container — there is no meaningful first paint before hydration. Every series component (`line.tsx`, `bar-squares.tsx`, `series-point-marker.tsx`, …) is a normal function component: it computes pixel coordinates from D3/visx scales pulled out of context (`useChartStable`, `useYScale`) and returns JSX SVG elements. There is **no scene graph, no intermediate representation, no reconciliation layer outside React** — the SVG *is* the React tree, and React's own reconciler (fiber diffing) is what turns props into DOM mutations, for every node, every render.

Per-datum fan-out is real, not theoretical: `bar-squares.tsx`'s `<SquareColumn>` (line 142) renders one `<rect>`/`<motion.rect>` per stacked square, once per data row, once per series — `data.map(...)` inside `BarSquaresInner` (line 353) nests a `layout.positions.map(...)` inside `SquareColumn` (line 226). A 50-row, 3-series bar-squares chart with 5 squares per column is on the order of 750 independent SVG elements, each a distinct React element with its own key, each individually diffed by the fiber reconciler on every re-render of `BarSquaresInner`.

## 2. TanStack Charts: rendering pipeline (data + props → pixels)

**Path:** `defineChart({...})` (pure data, `repos/tanstack-charts/packages/charts-core/src/scene.ts`) → `<Chart definition={...} />` (React, `repos/tanstack-charts/packages/react-charts/src/Chart.tsx`) → `RendererChartImplementation` (`repos/tanstack-charts/packages/react-charts/src/RendererChart.tsx`) → `createChartRendererAdapter` (`repos/tanstack-charts/packages/charts-core/src/adapter-renderer.ts`) → `mountChartRenderer` (`repos/tanstack-charts/packages/charts-core/src/renderer.ts`) → `createChartScene` (scale/layout/margin solve, `scene.ts`) → `renderChartSvgWithHooks` (pure string builder, `repos/tanstack-charts/packages/charts-core/src/svg-renderer.ts`) → `reconcileChartSvg` (keyed DOM diff, `repos/tanstack-charts/packages/charts-core/src/reconcile.ts`).

The critical fact is in `RendererChart.tsx` (lines 23-38):

```tsx
const ChartSurface = React.memo(
  React.forwardRef<HTMLDivElement, ChartSurfaceProps>(function ChartSurface(
    { markup }, ref,
  ) {
    return (
      <div ref={ref} className="ts-chart-surface" style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: markup }} />
    )
  }),
  () => true,   // <-- always "equal": React never re-renders this component again
)
```

React renders this `<div>` **once**, with `initialMarkupRef.current` (the prerendered SVG string, computed synchronously before mount — `initialMarkupRef.current ??= adapter.prerender()`). All subsequent updates run in a `useLayoutEffect` (lines 177-187) that calls `adapter.update(hostOptions)` — an imperative call into `renderer.ts`'s `mountChartRenderer`, which:

1. Recomputes the scene (`createScene()`, calling `runtime.render(...)` → `createChartScene` → scale/margin/axis solve).
2. Serializes the new scene to an SVG markup **string** via `renderChartSvg` (`svg-renderer.ts` — every node type, `rect`/`path`/`circle`/`text`/`g`, is templated into a string, e.g. line 92: `` `<circle${common} cx="${number(node.x)}" cy="${number(node.y)}" r="${number(node.radius)}"/>` ``).
3. Diffs that string against the **live DOM** via `reconcileChartSvg` (`reconcile.ts`): it parses the new markup into a detached `<template>`, then walks current vs. next elements in lock-step, matching children by an explicit identity (`data-ts-key` attribute, or positional `tag:localName:index` fallback — `identities()`, lines 262-273), patching only attributes/text that changed (`syncAttributes`, lines 109-136), inserting/cloning genuinely new nodes, and removing unmatched ones. **React's reconciler is never invoked for this subtree** — this is a hand-rolled, purpose-built DOM differ, roughly analogous to morphdom, operating directly on `Element` objects.

So the "keyed DOM reconciliation outside React" claim is verified exactly: `@tanstack/react-charts` renders a static host `<div>` via React once; `@tanstack/charts` (framework-agnostic core) owns the actual scene→string→DOM pipeline and mutates that `<div>`'s subtree directly, bypassing React entirely for every subsequent chart update.

---

## 3. Update model: what happens on data change / hover / resize

### bklit-ui

- **Data change**: new `data` prop flows through `<ChartProvider>` context → every consumer of `useChartStable()` (the "cold" slice) re-renders, because the context value's memo dependency array includes `value.data` (`chart-context.tsx`, lines 246-337). This is a real React re-render of the whole series tree — full fiber reconciliation, not a targeted patch, though React's own diffing does limit actual DOM writes to changed attributes.
- **Hover**: `use-chart-interaction.ts`'s `handleMouseMove` (line 169) computes the hovered datum via `bisectDate` (binary search) inside the raw React `onMouseMove` handler, then calls `scheduleTooltip(tooltip)` (`use-scheduled-tooltip.ts`). That scheduler rAF-batches and dedupes by a string key (`${index}:${Math.round(x)}`) before calling `setTooltipData` — **a React `useState` setter**. This triggers a re-render of every component subscribed to `ChartHoverContext` (tooltip, crosshair, highlighted marker, axis label fade). bklit-ui has clearly already optimized this once: `chart-context.tsx` explicitly **splits stable vs. hover context** (lines 220-237: *"Consumers that subscribe via `useChartStable()` skip re-renders on every mouse move"*) so cold consumers (Grid, YAxis ticks that don't need hover, PatternArea) don't re-render — but everything that reads `useChartHover()`/`useChart()` still re-renders through React on every mousemove, rAF-throttled to at most one per frame.
- **Resize**: `<ParentSize>` (visx/responsive) drives `width`/`height` via its own `ResizeObserver` → React state → re-render of the entire `<ChartInner>` subtree (same cost as any prop change).

### TanStack Charts

- **Data change**: a new `definition` prop → `RendererChartImplementation`'s `useLayoutEffect` sees `hostOptions` changed → `adapter.update()` → `renderer.ts`'s `update()` (lines 371-412) diffs the *options*, not the DOM: it compares `definitionChanged`, `sizeChanged`, etc., and only calls `render()` (full scene recompute + re-serialize + `reconcileChartSvg`) if something that actually needs a new scene changed. `render()` always recomputes the whole scene (there's no partial scene diff), but the **DOM patch is minimal** because `reconcileChartSvg` only touches attributes/nodes whose serialized string differs.
- **Hover/focus**: `renderer.ts`'s `handlePointerMove` (line 265) → `pointsAtPointer` → `resolvePointerFocus` (linear scan or spatial index over `scene.points`, already computed) → `updateFocus` (line 215), which **short-circuits on identity** (`samePointIdentity`, line 856) and, if changed, calls `paintFocus` — which calls `surface.paintFocus(point, points)`. That resolves to `paintSvgFocus` in `svg-surface.ts` (lines 81-92): it does exactly two `setAttribute` calls on the single pre-existing `<circle data-ts-chart-focus>` node created once in the initial markup (`svg-renderer.ts` line 48), plus a text/DOM update on the tooltip element (`paintTooltip`, `renderer.ts` line 481, using `textContent`/`replaceChildren`, not React). **No scene recompute, no re-serialization, no DOM diff, no React render** happens on hover — it's O(1) attribute writes on nodes already known by reference.
- **Resize**: a `ResizeObserver` (`configureObserver`, `renderer.ts` line 147) schedules `render()` via rAF only if width actually changed — full scene recompute (margins, scales, ticks) but still hits the same string+diff path, not React.

**Net effect:** in bklit-ui, hover cost = React state update + re-render of hover-subscribed subtree (bounded by the stable/hover context split, but still real fiber work). In TanStack, hover cost = linear/spatial point lookup + two attribute writes. This is the single largest steady-state interactivity cost difference between the stacks.

---

## 4. Interaction / hit-testing

### bklit-ui — `use-chart-interaction.ts`

- `resolveTooltipFromX` (line 78): `xScale.invert(pixelX)` → `bisectDate(data, x0, 1)` (binary search, O(log n)) → picks nearer of two neighbors → loops `for (const line of lines)` to compute a y-pixel position per series (O(series count) per move).
- Runs synchronously inside the native `onMouseMove` React handler (no rAF gate on the *computation*, only on the resulting `setState` via `useScheduledTooltip`'s rAF dedupe, `use-scheduled-tooltip.ts`).
- Bar/scatter/candlestick charts have their own parallel hooks (`use-scatter-chart-interaction.ts`, plus ad hoc `hoveredBarIndex`/`hoveredCandleIndex` state in `chart-context.tsx`) — hit-testing logic is duplicated per chart type, not shared through one strategy abstraction.
- Cost per pointermove: O(log n) bisect + O(series) scale lookups + (throttled) `setState` → React re-render of hover-subscribing components.

### TanStack Charts — `focus.ts` / `nearest.ts` / `renderer.ts`

- Default strategy (`'nearest'`, i.e. no named focus mode) uses `nearestPoint` (`nearest.ts`): `d3.least(points, ...)` — a **linear scan**, O(n) over `scene.points`, using squared Euclidean distance, gated by `maxFocusDistance` (default 48px, `renderer.ts` line 262).
- Named strategies (`focusX`/`focusY`/`focusNearestX`/`focusNearestY`, `focus.ts`) are also linear scans along one axis, then group by matching value (`groupPoints`).
- An **opt-in spatial index** exists (`options.definition.spatialIndex?.(scene.points)`, computed once per `render()` in `renderer.ts` line 122) — the core explicitly documents this trade-off in `charts-core-d3/docs/bundle-and-performance.md`: *"Use the built-in linear nearest-point scan for ordinary charts. For dense interactive scenes, pass `spatialIndex={createGridPointIndex}`."* This is a single pluggable strategy point, not per-chart-type duplicated logic.
- Cost per pointermove: O(n) (or O(1)-ish with spatial index) point lookup + `samePointIdentity` check (cheap key comparison) +, only if the identity changed, two `setAttribute` calls + tooltip DOM text update. No React involved at any point.

---

## 5. Animation model

### bklit-ui — `motion` (Framer Motion) used in two different ways

1. **Declarative motion components** (~76 files import `from "motion/react"`, e.g. `series-point-marker.tsx`'s `<motion.g>`, `bar-squares.tsx`'s `<motion.rect>`): each animated element is its own `motion.*` React component with `initial`/`animate`/`variants`. Framer Motion drives these via its own internal RAF loop mutating the DOM node's style/attributes directly (not through React state), so *per-frame* work bypasses React — but each animated node is still a distinct mounted React component (with mount/unmount cost on data changes, since arrays of markers are keyed and Framer needs a whole `motion.*` instance per element).
2. **Imperative `animate()` driving `setState`** (the hot path to be careful of): `use-animated-series-path.ts` (line 111) and `use-animated-y-domains.ts` (line 88) call `animate(0, 1, { onUpdate: (progress) => { ...; setAnimatedPoints(next) } })`. This is Framer Motion's *value* driver, not a component — its `onUpdate` callback runs on every animation frame and calls a **React `setState`**, which triggers a full React re-render of the consuming component (recomputing `pathD` via `useMemo`, re-rendering the `<path>`/`<LinePath>`) on every frame for the duration of the transition (`durationMs`, typically ~500-1100ms). This is a genuine per-frame React re-render loop — the single clearest "framer-motion causing React renders in the hot path" instance in the codebase, and it drives the line-path morph and the y-domain rescale tween, both very common operations (data update, brush zoom, loading→ready transition).
3. `motion-utils.ts` converts declarative `Transition` props (spring/tween) into raw spring constants (`springOptionsFromTransition`) for hooks that need to hand-roll a tween, indicating the codebase already works around Framer's declarative API where precise control over path/domain interpolation is needed — but the workaround still routes through `setState`.

### TanStack Charts — interruptible attribute tweening, no React, no persistent RAF

- `reconcile.ts`'s `reconcileChartSvg` (called on every `render()`) builds a list of `AttributeTween`s (line 3) while diffing: any attribute in `interpolatedAttributes` (`cx`, `cy`, `d`, `height`, `opacity`, `r`, `transform`, `width`, `x`, `y1`, etc. — line 11) whose old and new values are both present gets numeric-interpolated (`interpolateAttribute`, line 217, using a `#`-skeleton match on all numeric substrings — this is what lets a `d` path string tween smoothly even though it's not a single number).
- `runTweens` (line 168) starts **one `requestAnimationFrame` loop for the whole reconciliation pass** (not one per element, not one per animated value) that calls `tween.element.setAttribute(...)` directly for every tween each frame, and self-cancels when `progress >= 1` or when a new render supersedes it (`cancelAnimation()` in `svg-surface.ts` line 40 — this is the "interruptible" part: a new data update cancels any in-flight tween cleanly).
- Enter/exit get synthesized opacity tweens (`addEnterTween`/`addExitTween`, lines 138-166) so new/removed keyed nodes fade rather than pop.
- Animation is opt-in and reason-gated: `resolveAnimation` (`renderer.ts` line 958) **skips animation entirely on `'layout'`-reason renders**, only animates `'resize'` if explicitly configured (`configured.resize === true`), and respects `prefers-reduced-motion` by default.
- **No React setState anywhere in this path.** The RAF loop is pure DOM attribute mutation; React is uninvolved both in driving it and in observing its result.

**Implication:** bklit-ui's animation cost during a transition is "N mounted Framer components each doing their own DOM writes" (cheap per-frame) *plus*, in the two identified hot-path hooks, "one `setState` + one React re-render per frame for the whole transition duration" (expensive, and it's exactly the operations — line morph, y-domain rescale — that run on every data refresh). TanStack's cost during a transition is "one RAF loop doing N `setAttribute` calls," full stop, regardless of how the transition was triggered.

---

## 6. Scale / layout ownership

### bklit-ui

- Margins are **static**: `LineChart`'s `DEFAULT_MARGIN = { top: 40, right: 40, bottom: 40, left: 40 }` (`line-chart.tsx` line 68), merged with a caller-supplied partial override. There is no automatic measurement of tick-label size to grow the margin — callers are expected to pass margins that fit their labels.
- Tick *placement* (not margin) is computed with real effort: `x-axis.tsx` implements a combinatorial "most evenly spaced ticks" search (`selectEvenlySpacedIndices`, line 315 — tries `targetCount ± 1`, enumerates gap layouts up to `MAX_GAP_LAYOUTS = 400` via `composePositiveSum`, scores each layout for spread/symmetry). This runs inside a `useMemo` keyed on data/scale/margin, so it's not repeated on hover, but it is real CPU work (combinatorial, bounded) on every data/domain change.
- Scales (`xScale`, `yScale`, `yScales` per-axis) are D3 scales (`@visx/scale` wrapping `d3-scale`) constructed by the chart-shell layer and passed down via context — application/library code owns domain computation (e.g. `y-domain-utils.ts`), not a shared "auto-nice" solver.
- Chart dimensions come from `<ParentSize>`'s client-side `ResizeObserver` measurement — layout is inherently a two-pass, client-only affair (unmeasured → measured → render).

### TanStack Charts

- Margins are **auto-computed by default** via a fixed-point solver: `compileSceneLayout` (`scene.ts`, referenced from `createChartSceneWithScaleResolver`, lines 138-320) iterates margin ⇄ measured-guide-bounds until stable (`marginsEqual` check, line 308), using `measureSceneLabelBounds`/`estimateSceneText` (`guide-layout.ts`) for label extents. Explicit `margin` values on the definition act as locks (`resolveMarginLocks`) that pin one or more sides.
- Text measurement is **real** when a DOM is available: `dom-text.ts`'s `createDomTextMeasurer` uses an off-screen `<canvas>` 2D context's `measureText`, cached by a signature key (font family/style/weight + text), invalidated on font-load events (`renderer.ts`'s `handleFontLoad`, wired to `document.fonts`'s `loadingdone`). When no DOM/canvas exists (SSR), it falls back to `estimateSceneText`'s character-width table — same code path, isomorphic, just less precise.
- Scales are **explicitly the application's D3 scales** — `defineChart({ x: { scale: scaleUtc }, y: { scale: scaleLinear().domain([0, 50]).nice() } })` (`docs/overview.md`) — TanStack does not hide or reimplement D3; it resolves/configures the scale's range against the computed inner bounds (`configured-scale.ts`) and that's the extent of its ownership. This mirrors bklit-ui's approach (both delegate domain semantics to the app/D3), but TanStack additionally **owns the margin that makes the resolved range correct**, recomputed automatically whenever text metrics or container size change.
- Size comes from `ResizeObserver` too, but the *initial* render is deterministic and DOM-independent: `initialWidth` (default 640, `RendererChart.tsx` line 105) drives `prerender()` before any mount/measurement, so first paint (including SSR) doesn't require a client resize pass.

---

## 7. Performance-relevant observations (hot spots)

**Expected bklit-ui hot spots**, in descending order of how often they fire:

1. **Hover/pointermove React re-renders.** Even with the stable/hover context split (`chart-context.tsx`), every consumer of `useChartHover()`/`useChart()` re-renders on every rAF-throttled mousemove. On charts with many hover-reactive elements (tooltip, crosshair, per-series highlight, faded/dimmed series, axis label fade in `x-axis.tsx`), this is fan-out React work 60x/sec while dragging.
2. **Per-frame `setState` during transitions.** `use-animated-series-path.ts` and `use-animated-y-domains.ts` call `setState` inside Framer Motion's `onUpdate`, meaning line-path morphs and y-domain rescales — triggered on *every data refresh, not just mount* — cost one full React re-render per animation frame for ~0.5-1.1s each time.
3. **Per-datum component fan-out.** `bar-squares.tsx`, `series-markers.tsx`, `series-point-marker.tsx` etc. mount one React component (often a `motion.*` component with its own Framer Motion controller) per data point per series. Reconciling/mounting thousands of these on a data-shape change (row count changes, not just values) is real fiber work, independent of the per-frame animation cost above.
4. **Client-only first paint.** `<ParentSize>` (visx/responsive) means no chart pixels exist until a client `ResizeObserver` fires post-hydration — this is a *time-to-render* (M1a/M1b) cost, not a runtime-load cost, but it's structural (present on every chart, `line-chart.tsx`, `area-chart.tsx`, `bar-chart.tsx`, and 11 others per the earlier `grep`).
5. **Tick-layout search.** `selectEvenlySpacedIndices` (`x-axis.tsx`) is combinatorial (bounded at 400 layouts) — memoized per data/scale change, so not a hover cost, but a nontrivial one-time cost per data update on top of the re-render itself.

**What TanStack's architecture does differently, concretely:**

1. Hover/focus is **DOM-attribute-only** (`svg-surface.ts`'s `paintSvgFocus`, `renderer.ts`'s `paintTooltip`) — no React involvement, no scene recompute, no string re-serialization. This is architecturally guaranteed to be cheaper than any React-state-based hover model at scale, because it doesn't grow with the number of hover-reactive components — it's always "two attribute writes + a tooltip DOM patch."
2. Animation is **one shared RAF loop doing raw attribute writes** (`reconcile.ts`'s `runTweens`), decoupled entirely from whatever triggered the update (data change, resize, focus restore) and from React. It cannot cause React re-renders because React isn't in the loop.
3. Data updates recompute the whole scene but patch the DOM **minimally** via keyed diffing (`reconcile.ts`) — comparable in spirit to how React's own reconciler minimizes DOM writes, but operating on a purpose-built string/DOM representation instead of a full component tree, so there's no fiber bookkeeping, no component instances to allocate/GC, no context re-subscription overhead.
4. The published (admittedly "directional, POC") benchmark table in `charts-core-d3/docs/bundle-and-performance.md` claims a **native line scene at 10,000 points renders in ~1.78ms median** and a **keyed host update in ~1.66ms median**, versus ~3-4.75ms for a comparable Observable-Plot-based path — small numbers, but they's a signal that the scene→string→diff pipeline is not inherently more expensive than direct DOM/canvas approaches, and is designed to stay flat as point count grows (the linear nearest-point scan is the one place that explicitly does *not* stay flat, hence the opt-in spatial index escape hatch).
5. First paint does not require the client: `prerender()`/`renderChartSvg` are pure functions with no DOM calls, so SSR output is a real, complete `<svg>`, not an empty measurement placeholder.

---

## 8. Implications for migration (principles)

These are the load-bearing rules for every subsequent migration decision:

1. **Do not rebuild bklit-ui's hover/tooltip state machine in React state on top of TanStack.** TanStack already solves this with `focus`/`nearest`/`spatialIndex` + the imperative paint path (`renderer.ts`, `svg-surface.ts`). Wiring bklit-ui-style `onMouseMove` → `setState` → context → re-render on top of (or instead of) TanStack's native focus system would reintroduce exactly the cost this migration exists to remove. Use `definition.focus`, `definition.tooltip`, `onFocusChange`/`onFocusGroupChange` callbacks — treat React state as a place to *read* the current focused point for out-of-chart UI (e.g., a legend highlighting), not as the mechanism that drives the chart's own crosshair/tooltip.
2. **Do not port `use-animated-series-path.ts` / `use-animated-y-domains.ts`'s `animate()` + `setState` pattern.** These are the two clearest per-frame-React-render offenders. TanStack's equivalent is declarative: set `animate: true` (or `{ duration, easing }`) on the chart definition and let `reconcile.ts`'s attribute tweening handle path/domain interpolation via `interpolateAttribute`'s numeric-skeleton matching — it already handles `d`, `transform`, `cx`/`cy`/`r`, etc. If a bklit visual effect has no direct TanStack equivalent (e.g. the specific loading-pulse sweep), implement it as CSS (`@keyframes`/`transition`) on stable DOM nodes, or as a small custom renderer hook (`renderSvg`/`ChartSvgRenderHooks` in `svg-renderer.ts`) — not as a React-state-driven per-frame loop.
3. **Do not mount one React component per data point for series markers.** bklit-ui's `<SeriesPointMarker>`/`<SquareColumn>` pattern (one `motion.*` element per row per series) is idiomatic React-SVG but fights TanStack's model, where marks are declared once (`dotY(...)`, `lineY(...)`) and the *scene* fans out to individual SVG nodes only at the string-serialization step — never as React components. When a bklit feature needs "one visual element per datum with per-datum styling," express it as a mark/channel mapping (color, opacity, radius scales) rather than a per-datum React subtree.
4. **Treat `ChartSurface`'s `React.memo(..., () => true)` pattern as the model, not an anti-pattern.** If custom React chrome must wrap a TanStack chart (legends, custom tooltip bodies via `renderTooltipBody`), keep that chrome's re-render surface as small as possible and don't let its state (e.g. legend hover) force a re-render of the chart surface itself — pass such state through `definition`/callbacks that TanStack consumes imperatively, or through the tooltip-body portal (`RendererChart.tsx`'s `createPortal(..., tooltipBodyTarget.element)`), which is designed exactly for "let React own this one DOM subtree while the rest stays imperative."
5. **Margins/ticks: stop hand-passing fixed margins; let TanStack measure.** bklit-ui's fixed `DEFAULT_MARGIN` plus the bespoke `selectEvenlySpacedIndices` tick-search in `x-axis.tsx` can very likely be dropped in favor of TanStack's automatic margin solver (`compileSceneLayout`) and its own guide/tick layout, which is measured (via `dom-text.ts`) rather than heuristic, and is part of the scene-recompute path already being paid for on data change — not an extra cost layered on top.
6. **SSR: design new chart routes to render real markup server-side.** Since `renderChartSvg`/`prerender()` need no DOM, a genuine performance win over bklit-ui's `<ParentSize>`-gated client-only rendering is to server-render the initial SVG (with `initialWidth`) and let the client adopt/diff it, eliminating the "blank until measured" phase entirely. This is a first-paint (M1a) win independent of everything else in this document, and it's not available to bklit-ui's current architecture without removing `<ParentSize>` and passing explicit dimensions.
7. **What will fight TanStack, listed explicitly, so it's recognized when someone tries it:**
   - Subscribing chart-body rendering to a React context that changes on every pointermove (recreates the exact cost TanStack's imperative host was built to avoid).
   - Driving any per-frame visual change through `setState`/`useState` (Framer's `animate()`-with-`onUpdate` idiom) instead of the definition's `animate` option or CSS.
   - Rendering per-datum React components for marks that TanStack expresses as a single mark declaration with vectorized channels.
   - Re-deriving margins/ticks in application code when the scene's auto-margin/guide-layout solver already does it as part of the render TanStack is performing anyway.
   - Wrapping the entire `<Chart>` in a component that re-renders on hover/focus state "just to be safe" — this defeats the `React.memo(..., () => true)` surface and forces React to re-diff a subtree it was designed to never touch again after mount.

---

## 9. React version & rendering notes

- **React 19 on both sides.** bklit-ui: `repos/bklit-ui/packages/ui/package.json` — `"peerDependencies": { "react": "^18.0.0 || ^19.0.0", "react-dom": "^18.0.0 || ^19.0.0" }`, but its own `"dependencies"` pin `"react": "^19.2.0"`. TanStack: `repos/tanstack-charts/packages/react-charts/package.json` — `"peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }` (React 19 only, no React 18 fallback). This means the migration target is React-19-only for the chart layer even though bklit-ui's published peer range is wider — worth flagging if any consuming app is still on React 18.
- **SSR — bklit-ui:** every chart entry point is `"use client"` (136 of 204 files under `packages/ui/src/charts` carry the directive per repo grep) and is gated behind `<ParentSize>` (visx/responsive), which needs a browser `ResizeObserver` to produce nonzero dimensions before it renders children at all. There is no server-renderable chart markup today; SSR of a page containing these charts server-renders an empty/measuring shell, and the real chart appears only after client-side measurement + hydration.
- **SSR — TanStack:** the core (`@tanstack/charts`) has no framework or DOM dependency in its render path — `renderChartSvg` (`svg.ts`/`svg-renderer.ts`) is string templating, and `estimateSceneText` (`guide-layout.ts`) provides a DOM-free text-metric fallback for margin computation when no canvas is available. The React adapter's `RendererChartImplementation` explicitly separates `prerender()` (called synchronously, safe on the server) from `mount()`/`update()` (client-only, called from `useLayoutEffect`). Sibling framework docs (`packages/charts-core/docs/framework/{vue,svelte,solid,preact}/adapter.md`) explicitly describe SSR emitting "the complete `.ts-chart-host`, `.ts-chart-surface`, and … server geometry," confirming this isn't incidental — it's a designed capability, not yet written up for the React adapter specifically but present in the same shared core the React adapter uses.
- **Hydration cost:** bklit-ui hydration is "normal React hydration" of a large SVG tree once client measurement completes — no special mismatch risk, but the tree is large per the fan-out noted in §7. TanStack's hydration model (per the Vue/Svelte docs, and inferable from the React adapter's `dangerouslySetInnerHTML` + memo-forever pattern) is closer to "adopt existing DOM, do not re-render it" — React's hydration of the single `ChartSurface` div only needs to reconcile one static `<div>` wrapper, not the SVG internals, since `dangerouslySetInnerHTML` content isn't diffed node-by-node by React in the first place.

---

## Appendix: file index (primary evidence)

**bklit-ui** (`repos/bklit-ui/packages/ui/src/charts/`):
`chart-context.tsx`, `use-chart-interaction.ts`, `use-scheduled-tooltip.ts`, `use-animated-series-path.ts`, `use-animated-y-domains.ts`, `animation.ts`, `motion-utils.ts`, `line-chart.tsx`, `line.tsx`, `bar-squares.tsx`, `series-point-marker.tsx`, `x-axis.tsx`, `decimate-time-series.ts`, `chart-scale.ts`, `packages/ui/package.json`.

**TanStack Charts** (`repos/tanstack-charts/packages/`):
`charts-core/src/{scene,renderer,adapter,adapter-renderer,adapter-shared,runtime,reconcile,svg,svg-renderer,svg-surface,dom,dom-text,guide-layout,focus,nearest,configured-scale}.ts`, `charts-core/docs/{overview,quick-start}.md`, `charts-core-d3/docs/bundle-and-performance.md`, `react-charts/src/{Chart,RendererChart}.tsx`, `react-charts/package.json`, `charts-core/package.json`.

---

## Phase 3 delta note — D137–D146 post-freeze changes

> Appended 2026-08-18 per PLAN-phase-3.md 0.1. This file is a **verbatim copy** of the Phase 2 freeze state (tag `phase-2-complete-2026-08-08`); nothing above this line was edited. This appendix records what changed in the D137–D146 window *after* the Phase 2 freeze, so Phase 3 readers know where the copied inventory is stale. Source: `docs/phase-2/LOG.md` for D137–D141; git commit messages for D142–D146.

| Delta | Subject | What changed post-freeze | Source |
|---|---|---|---|
| D137 | RingChart reveal | `migrated/charts/ring-chart.tsx`: WAAPI stolen by StrictMode teardown + deferred-paint stall. Fixes: `isMountedRef+setTimeout(0)`; hover defer gated on `pendingExpandAnimsRef.has(i) && !seenRingRevealedRef.has(i)`; `ringConfigs` memoized by content key (not `children` identity); reveal moved to `onPostPaint` (2×rAF+setTimeout 0); `data-bkm-revealed` on `<svg.ts-chart>` root; stale `style.transform="scale(1)"` cleared before WAAPI so `fill:backwards` paints `scale(0)` correctly | LOG.md D137 |
| D138 | GaugeChart reveal | `gauge.tsx`: ARC target selector mismatch (`.ts-chart__radial-arc` stale vs live `[data-ts-key="gauge-bg"]`/`[data-ts-key="gauge-active"]` — 7× 0-target false-alarms) + `radar-spring.ts` `createSpringResolver(...,0,0)` `initialDelta=0` flatline → fixed to `0,1`; `transformOrigin:"0px 0px"` delegated to `styles.css` | LOG.md D138 |
| D139 | Critique sweep | Removed dead `runDeferredReveal`/`createDeferredRevealGuard` from `deferred-reveal.ts` (live primitives `onPostPaint`+`setRevealDeadline` kept); flagged 5× cloned `springFromBounce/resolveEnterTransition/revealTiming/buildProgressKeyframes` (keep per-family precedent) + duplicated `TOOLTIP_SPRING`/`BOX_OFFSET` hover constants; `.ts-bkm-heatmap-rect` retired (`#if 0`'d) | LOG.md D139 |
| D140 | RadarChart reveal + hover | `radar-chart.tsx`: same spring `0,0` flatline fix (D138 root); `focus:"nearest"` never hits `polar/radialArea` centroids via spatial index → `focusDisabled` + imperative `pointerenter/leave` on `radial-area path`/`radial-dot circle` groups; `onPostPaint` scale `0→1` reveal about polar center; `seenRevealedRef:Set`+`pendingRevealRef:Map` gate blocks hover `scale(1.05)` during reveal; `setRevealDeadline` cleanup | LOG.md D140 |
| D141 | HeatmapChart reveal + hover | `heatmap-components.tsx`: reintroduced deferred reveal (`revealInputsRef`+`seenRevealEpochRef`+`onPostPaint`) with single-pass `Map<key,delayMs>` (`computeHeatmapEnterFadeDelayMs`/`resolveHeatmapEnterFadeDurationSec`/`HEATMAP_DEFAULT_ENTER_EASE`, default `delay:0 dur:1600 cubic-bezier(0.85,0,0.916,0.282) fill:backwards`); hover darkening fixed via two load-bearing separate guards (`seen===epoch` and `dataset.bkmRevealed==="1"`) | LOG.md D141 |
| D142–D143 | SunburstChart hover/zoom + debt | commit `4df1aff`: WAAPI reveal with `bkmRevealed` guard + `setRevealDeadline` + `onPostPaint` keyed by `data-ts-key`; labels morph via `transitionGeometry` with hover dimming (no remount); zoom dims unrelated labels (0.25) instead of culling (`isRelatedArc`); **deleted orphaned `internal/sunburst-hover-chrome.ts` (112 lines)**; deduped `getSunburstPathMap` (4 sites) + `isRelatedArc` (3 sites); `applyAlphaToColor` → `color-mix`; removed `d3 arc()` wrapper; `usePrefersReducedMotion` hook; `pendingReveal` Map→Set | ⚠️ commit message only, NOT in LOG.md |
| D144 | ChoroplethChart native zoom | commit `490aeba`: replaced hand-rolled `ProvidedZoom` (`createProvidedZoom`/`useZoomState`, ~260 lines) with bklit's native `<Zoom>`; svg is gesture target via `containerRef`; single `<g.transform>` drives marks+graticule; pinch/wheel share focal+compose+clamp; removed dead `featureByTsKeyFallback` + `isMountedRef` dance; extracted `applyZoomToGroups`; graticule single outer `<g>` via `graticuleGRef` | ⚠️ commit message only, NOT in LOG.md |
| D145 | ChoroplethChart tooltip clear | commit `6a05c09`: country→ocean left `hoveredKey` live so tooltip stuck at `opacity:0` through 200ms exit timer; `handleLeave`/`handleRootLeave` consolidated into `clearHover()`; `svg:mousemove/leave/pointerleave` clear when event target has no `data-ts-key` ancestor; re-wire on reconnect so TanStack re-renders don't drop the listener | ⚠️ commit message only, NOT in LOG.md |
| D146 | Showcase build | commit `692fc28`: `showcase/tsconfig.json` paths `../repos/...` → `./repos/...` (Vercel Root Directory = `showcase/`, `clone-repos.sh` places repos at `showcase/repos`); webpack+turbopack aliases for `@tanstack/*` generated from `package.json` exports (like `bench/app/vite.config.ts`); `globals.css` source includes showcase-relative paths | ⚠️ commit message only, NOT in LOG.md |

**Impact on this file (03 — stack comparison):** none on the stack analysis itself — both stacks' rendering/update/animation models are unchanged post-freeze. D146 touched harness bundler aliases only; no claim in this document is invalidated.
