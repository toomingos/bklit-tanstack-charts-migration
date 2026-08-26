# ring — Phase 4 Research Report

**Files:** `showcase/migrated/charts/ring-chart.tsx`; `showcase/migrated/charts/internal/ring-center.tsx` (orphan — barrel re-export only); `showcase/migrated/charts/internal/ring-hover-chrome.ts`; `showcase/migrated/charts/internal/ring-reveal.ts`

**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/ring-chart.tsx`; `repos/bklit-ui/packages/ui/src/charts/ring.tsx`; `repos/bklit-ui/packages/ui/src/charts/ring-context.tsx`; `repos/bklit-ui/packages/ui/src/charts/ring-center.tsx`

## Feature summary

Composable concentric progress-ring chart: each `<Ring>` datum draws a grey track + colored progress arc, with a two-phase enter reveal (track scale-pop, then angular sweep), spring-driven hover scale (1.03 hovered / 1.02 pushed-out), and a `<RingCenter>` HTML overlay with NumberFlow digit-roll. TanStack-native redo (D76): rings are baked into `polar()` + `radialArc` marks via `defineChart`; `<Ring>` children are classified by displayName and never rendered as React components. Includes a `geometryScrubbing` mode that bypasses TanStack marks with plain SVG paths.

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `RingChart` | component | same | TanStack `defineChart`/`<Chart>` pipeline replaces visx `ParentSize`/`Group` |
| `RingChartProps.data` | `RingData[]` | same | |
| `RingChartProps.size` | `number?` | same | fixed size; else measured via `useMeasuredRect` (was `ParentSize`) |
| `RingChartProps.strokeWidth` | `number?` | same | default 12 both |
| `RingChartProps.ringGap` | `number?` | same | default 6 both |
| `RingChartProps.baseInnerRadius` | `number?` | same | default 60 both |
| `RingChartProps.animationDuration` | `number?` | same | dead prop in BOTH (declared, never read) |
| `RingChartProps.className` | `string?` | same | |
| `RingChartProps.style` | `CSSProperties?` | extra | migrated-only; legacy sizes via className/grid only |
| `RingChartProps.hoveredIndex` | `number \| null?` | same | controlled hover |
| `RingChartProps.onHoverChange` | `(i: number \| null) => void?` | same | |
| `RingChartProps.startAngle` | `number?` | same | default −π/2 |
| `RingChartProps.endAngle` | `number?` | same | default 3π/2 |
| `RingChartProps.enterTransition` | `RingEnterTransition?` | same | type narrowed: motion/react `Transition` → internal `EnterTransition` union |
| `RingChartProps.enterStaggerScale` | `number?` | same | default 1 |
| `RingChartProps.geometryScrubbing` | `boolean?` | same | default false |
| `RingChartProps.children` | `ReactNode` | same | `<Ring>`/`<RingCenter>` compositional API |
| `Ring` | component | same | repurposed: returns `null`, config carrier only; props extracted in `classifyChildren`, never rendered |
| `RingProps.index` | `number` | same | |
| `RingProps.color` | `string?` | same | |
| `RingProps.animate` | `boolean?` | same | default true |
| `RingProps.showGlow` | `boolean?` | same | default true; glow itself dead-at-runtime in both (see Deviations) |
| `RingProps.lineCap` | `"round" \| "butt"?` | same | default round |
| `RingLineCap` | type | same | was exported from legacy `ring.tsx`; now from `ring-chart.tsx` |
| `RingData` | type | same | `label/value/maxValue/color?`; moved from legacy `ring-context.tsx` |
| `useRingStable()` | hook | same | same name; payload reduced — no `hoveredIndex`/`setHoveredIndex`/`animationKey`/`isLoaded`/`containerRef` |
| `useRingHoverCoordinator()` | hook | renamed | from legacy `useRingHover`; returns imperative coordinator store (`getHovered/requestHover/requestUnhover/setHovered/subscribe`), not React-context `{hoveredIndex, setHoveredIndex}` |
| `RingCenter` | component | same | orphan file; rendered via classification, exported via `charts/index.ts` barrel |
| `RingCenterProps.defaultLabel` | `string?` | same | default "Total" |
| `RingCenterProps.formatOptions` | `CenterStatFormat?` | same | type renamed: `ChartStatFlowFormat` → `CenterStatFormat` (same Intl subset) |
| `RingCenterProps.children` | render fn | same | same signature `{value, label, isHovered, data}` |
| `RingCenterProps.className` | `string?` | same | |
| `RingCenterProps.valueClassName` | `string?` | same | default `centerStatValueClassName` (was `chartCenterValueClassName`) |
| `RingCenterProps.labelClassName` | `string?` | same | default `centerStatLabelClassName` (was `chartCenterLabelClassName`) |
| `RingCenterProps.prefix` | `string?` | same | |
| `RingCenterProps.suffix` | `string?` | same | |
| `RingCenterRenderProps` | type | extra | legacy had this shape inline/anonymous; migrated names + exports it |
| `RingEnterTransition` | type | extra | named alias for internal `EnterTransition` (legacy used motion `Transition` directly) |
| `useRing()` | hook | missing | legacy stable+hover convenience combiner; not ported |
| `RingProvider` | component | missing | replaced by inline providers inside `RingChart` |
| `ringCssVars` | const | missing | legacy CSS-var map (`--chart-background`, `--border`, …); migrated inlines `RING_BACKGROUND` privately |
| `defaultRingColors` | const | missing | as export; same values inlined privately in `ring-chart.tsx` |
| `RingContextValue` / `RingStableContextValue` / `RingHoverContextValue` | types | missing | replaced by unexported `RingStableValue` interface |
| default exports (`RingChart`/`Ring`/`RingCenter`/context) | exports | missing | migrated is named-exports only |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `RING_BACKGROUND = "var(--border)"` | constant | BKLIT | CUSTOM | no | track + scrub bg fill; legacy `ringCssVars.ringBackground`; TS-check: none |
| `defaultRingColors` (`--chart-1..5`) | constant | BKLIT | CUSTOM | no | inlined, unexported; TS-check: none |
| Prop defaults 12/6/60; angles −π/2→3π/2 | constant | BKLIT | CUSTOM | no | identical to legacy; TS-check: none (polar's own angle default is 0→2π) |
| `padding = 8`; `availableRadius = center − 8` | constant | BKLIT | CUSTOM | maybe | edge padding; feeds `polar` inset; TS-check: CONTRADICTS maybe — native `PolarOptions.inset` = min(w,h)/2 − inset (@tanstack/charts/polar) |
| `designOuterRadius` / `renderScale = min(1, avail/design)` | util fn | BKLIT | CUSTOM | maybe | fit-to-box downscale of stroke/gap/radii; TS-check: partial — `PolarLength` callbacks give responsive radii; design-outer/min-clamp math custom |
| Progress clamp + 0.01 rad empty-sweep epsilon | util fn | BKLIT | CUSTOM | no | progress mark skipped when ≤0.001; path "" below epsilon; TS-check: partial — radialArc drops empty paths natively; 0.01 epsilon tuning custom |
| `cornerRadius = (outer−inner)/2` when lineCap round | constant | BKLIT | CUSTOM | no | butt → 0; TS-check: partial — applied via `RadialArcOptions.cornerRadius`; (outer−inner)/2 formula custom |
| radius→ratio channel accessors (÷ `availableRadius`) | util fn | BKLIT | CUSTOM-ON-TS | yes | maps bklit px geometry onto `radialArc`'s `({radius})` accessors; TS-check: native — `PolarLength` callback `({radius})` (@tanstack/charts/polar) |
| `polar({inset: 8, radiusRatio: 1})` | mark | TANSTACK | TS-NATIVE | yes | container; empty marks array in scrub mode; TS-check: native — `polar` (@tanstack/charts/polar) |
| `radialArc` ×2 per ring (track + progress) | mark | TANSTACK | TS-NATIVE | yes | ids `ring-{i}-track` / `ring-{i}-progress`; queried later by `data-ts-key`; TS-check: native — `radialArc`, key = mark id (`data-ts-key`) |
| `defineChart({guides:false, x:null, y:null, tooltip:false})` | util fn | TANSTACK | TS-NATIVE | yes | all chrome off; TS-check: native — `defineChart` (@tanstack/charts) |
| `focusDisabled` (`@tanstack/charts/focus/disabled`) | util fn | TANSTACK | TS-NATIVE | yes | suppresses TanStack pointer handling; custom hover owns surface; TS-check: native — `focusDisabled` (@tanstack/charts/focus/disabled) |
| `<Chart onRender={handleRender}>` | mark | TANSTACK | TS-NATIVE | yes | WAAPI reveal driven off TanStack render callback; TS-check: native — `onRender` w/ `container` (@tanstack/react-charts) |
| Scrub-mode static SVG path layers | overlay | BKLIT | CUSTOM | maybe | bypasses TanStack marks entirely (high-frequency scrub); TS-check: none — no native bypass; nearest is `radialArc({motion:false})` static paint |
| `classifyChildren` / `isRingElement` / `isRingCenterElement` | util fn | BKLIT | CUSTOM | no | displayName matching via `children.tsx` `displayNameOf`; TS-check: none — React children API, not chart concern |
| `Ring` config carrier (returns `null`) | component | BKLIT | CUSTOM | no | JSX-compilable prop bag; never mounted; TS-check: none |
| `RingStableContext` (provided) | context | BKLIT | CUSTOM | no | geometry+data; sole consumer RingCenter; TS-check: none — no chart-context primitive in TS |
| `RingHoverCoordinatorContext` (provided) | context | BKLIT | CUSTOM | no | imperative coordinator; TS-check: partial — `setControlledFocus` via `onRender` interaction covers controlled hover state, not a subscribable store |
| `useRingStable` / `useRingHoverCoordinator` | hook | BKLIT | CUSTOM | no | throw outside provider; TS-check: none — no equivalent hooks exported by react-charts |
| `createRingHoverCoordinator` (re-export of pie's) | util fn | BKLIT | CUSTOM | no | controlled/uncontrolled dispatch, verbatim pie reuse; TS-check: partial — `ChartProps.hoveredIndex`-style control exists as `setControlledFocus` (imperative), no store/subscribe |
| Two-phase WAAPI reveal (`handleRender`) | util fn | BKLIT | CUSTOM | no | WAAPI: track `scale()` keyframes + progress `d: path('…')` sweep; deferred via `onPostPaint`; live `data-ts-key` DOM queries; TS-check: CONTRADICTS no — partial: `motion()` renderer sweeps `ts-chart__arc` on enter; two-phase choreography not expressible |
| Stagger delays `0.08·i` s / `(0.6+0.1·i)` s × `enterStaggerScale` | constant | BKLIT | CUSTOM | no | expand vs progress phase delays; TS-check: CONTRADICTS no — native `stagger({each, offset})` delay (@tanstack/charts/motion) |
| Per-index seen-set reveal guard | util fn | BKLIT | CUSTOM | no | growth n=2→4 re-reveals only new indices; TS-check: none — keyed enter motion covers new keys, but guard semantics differ |
| `.ts-chart__marks--revealing` | CSS class | CUSTOM | CUSTOM | no | `opacity: 0` until post-paint (styles.css L67, scoped `[data-bkm-chart]`); TS-check: none |
| `data-bkm-revealed` SVG attribute | util fn | CUSTOM | CUSTOM | no | once-guard written to `svg.ts-chart` (direct DOM mutation); TS-check: none |
| Hover spring runtime (`createRingHoverRuntime`) | util fn | BKLIT | CUSTOM | no | rAF spring (`spring.ts`) {stiffness:400, damping:25}; scale 1.03/1.02/1; writes `style.transform` to both sibling groups; TS-check: partial — `createChartSpring` solver (@tanstack/charts/spring); DOM-write/push-out logic custom |
| `settleAtRest()` two-writer gate | util fn | CUSTOM | CUSTOM | no | WAAPI owns `transform` until expand `onfinish` hands off to spring; TS-check: none |
| Dead fade port (`FADE_OPACITY = 0.35`, `opacity 0.15s ease-in-out`) | constant | BKLIT | CUSTOM | no | bklit fade dead at runtime; full opacity written, constants kept for restore; TS-check: partial — mark-state focus styles cover fill/opacity transitions, not this parity port |
| Dead glow port (`drop-shadow(0 0 12px ${color})`) | constant | BKLIT | CUSTOM | no | `filter: "none"` written; formula kept in comments; TS-check: none — no filter channel in mark state styles |
| Pointer listeners on track+progress groups | util fn | BKLIT | CUSTOM | no | `pointerenter`/`pointerleave` addEventListener; `cursor: pointer`; progress group+path `pointer-events: none` (direct DOM mutation); TS-check: partial — TS owns pointer focus internally (`pointer: true`), but no exported per-mark listener API |
| `transform-origin: 0px 0px` | CSS class | BKLIT | CUSTOM | no | inline style + styles.css L599 rule (`[data-bkm-chart="ring"] [data-ts-key^="ring-"]`); off-center pivot fix (D208-3); TS-check: none |
| Deferred center mount | util fn | CUSTOM | CUSTOM | no | `setTimeout(0)` past M1a doubleRaf clock (D75); TS-check: none |
| Center overlay positioning div | overlay | BKLIT | CUSTOM | maybe | absolute inset-0 flex; replaces legacy CSS-grid stacking; TS-check: partial — `radialText` renders donut-center values as SVG text, not HTML overlay |
| Unmount cleanup (StrictMode-safe) | util fn | CUSTOM | CUSTOM | no | `setTimeout(0)` + `isMountedRef`; cancels WAAPI anims, springs, reveal deadline; TS-check: none |
| size<10 guard + double-rAF retry | util fn | BKLIT | CUSTOM | no | retry probes `getAnimations()` per ring if `onRender` never fired; TS-check: none |
| `useMeasuredRect` (barrel → `use-container-size`) | hook | CUSTOM | CUSTOM | maybe | replaces `@visx/responsive` `ParentSize` (debounce 10); TS-check: partial — `<Chart width>` undefined + built-in ResizeObserver re-renders responsively; no measured-size hook exported |
| `pieArcPath` (`internal/pie-geometry`) | util fn | BKLIT | CUSTOM | no | d3-arc-compatible path gen; replaces `@visx/shape` `arc`; TS-check: partial — `RadialArcOptions.generator` exposes D3 `arc` inside marks; standalone path-gen export absent |
| `ring-reveal` re-exports + `RING_TWEEN_FALLBACK` | util fn | BKLIT | CUSTOM | maybe | thin re-export of `enter-transition`; fallback tween 1100ms cubic-bezier(0.85,0,0.15,1); TS-check: CONTRADICTS maybe — native default transition identical (1100ms cubic-bezier(0.85,0,0.15,1), motion.ts) |
| `centerSize = baseInnerRadius·2 − 16` | constant | BKLIT | CUSTOM | no | 16px center padding, RingCenter; TS-check: none |
| `CenterStat` + real `NumberFlow` digit-roll | component | BKLIT | CUSTOM | no | `@number-flow/react`; sanctioned D10 exception; TS-check: none |
| `useCenterStatHover` | hook | CUSTOM | CUSTOM | no | `useSyncExternalStore` bound to hover coordinator; TS-check: none |
| `ts-bkm-center-stat` / `-value` / `-label` | CSS class | BKLIT | CUSTOM | no | styles.css L495–532; ports legacy `chart-center-typography` clamp() typography; TS-check: none |
| `RingEnterTransition` / `RingResolvedTiming` / `RingRevealTiming` | type | BKLIT | CUSTOM | no | aliases of `enter-transition` types; TS-check: partial — `ChartMotionTransition`/`ChartMotionTiming` are the native analogues |

## Imports

`internal/` modules imported by this part's files:

- `internal/pie-geometry` — `pieArcPath` (ring-chart.tsx)
- `internal/ring-hover-chrome` — `createRingHoverCoordinator`, `createRingHoverRuntime`, types (ring-chart.tsx)
- `internal/ring-reveal` — `buildProgressKeyframes`, `RING_TWEEN_FALLBACK`, `resolveEnterTransition`, `revealTiming`, `RingEnterTransition` (ring-chart.tsx)
- `internal/deferred-reveal` — `onPostPaint`, `setRevealDeadline` (ring-chart.tsx)
- `internal` (barrel) — `useMeasuredRect` → resolves to `internal/use-container-size` (ring-chart.tsx)
- `internal/center-stat` — `CenterStat`, class-name consts, `defaultCenterStatFormat`, `useCenterStatHover`, `CenterStatFormat` (ring-center.tsx)
- `internal/spring` — `createSpring` (ring-hover-chrome.ts)
- `internal/pie-hover-chrome` — `createPieHoverCoordinator` re-exported under Ring names (ring-hover-chrome.ts)
- `internal/enter-transition` — `TWEEN_FALLBACK` + re-exports (ring-reveal.ts)
- `./styles.css` — side-effect import (ring-chart.tsx)

Non-internal: `./children` (`displayNameOf`, ring-chart.tsx); `../ring-chart` (contexts/hooks, ring-center.tsx).

## Deviations

- **Orphan `ring-center.tsx`:** `ring-chart.tsx` classifies `RingCenter` children purely by the `displayName === "RingCenter"` string and never imports the module; the only reference is the `charts/index.ts` barrel re-export (facade). No import edge couples the two files — display-name drift would silently break classification.
- **Deprecated shim:** `RingHoverConfig.groupEl` is marked `@deprecated "kept for backwards compat with HEAD"` — legacy single-group caller support with no caller in this part.
- **Fake Animation seeding:** `handleRender` inserts a `{ cancel() {} } as unknown as Animation` placeholder into `pendingExpandAnimsRef` before the real post-paint animation exists — type-laundering workaround for the two-writer gate.
- **StrictMode teardown dance:** unmount cleanup is deferred through `setTimeout(0)` + `isMountedRef`; `cleanupMap` registers the progressGroup listener cleanup twice (composite key under trackGroup + its own key) — benign duplication.
- **Missed-render retry:** double-rAF effect re-fires `handleRender` if `onRender` never fired (size crossing the <10 threshold) — workaround, probes `getAnimations()` per ring.
- **Deliberate dead-code parity:** fade (0.35) and glow (drop-shadow 12px) ported as observed pixels, not source intent (D19/D49 precedent); `animationDuration` stays a dead prop in both codebases; legacy dead `isLoaded`/`animationKey` state dropped entirely.
- **API surface losses vs legacy deep imports:** `useRing`, `RingProvider`, `ringCssVars`, `defaultRingColors`, the `Ring*ContextValue` types, and all default exports are not ported.
- **Type narrowing:** `enterTransition` goes from motion/react `Transition` to the internal `EnterTransition` union.
- **Scrub mode exits the TanStack pipeline:** plain React SVG paths instead of marks (deliberate high-frequency-scrub choice, documented in header).
