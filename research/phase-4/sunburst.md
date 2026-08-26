# sunburst — Phase 4 Research Report

**Files:** `showcase/migrated/charts/sunburst-chart.tsx`, `showcase/migrated/charts/internal/sunburst-center.tsx`, `internal/sunburst-colors.ts`, `internal/sunburst-geometry.ts`, `internal/sunburst-hint.tsx`, `internal/sunburst-labels.tsx`, `internal/sunburst-reveal.ts`, `internal/sunburst-types.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/sunburst-chart.tsx`, `sunburst.ts`, `sunburst-context.tsx`, `sunburst-data.ts`, `sunburst-segment.tsx`, `sunburst-center.tsx`, `sunburst-labels.tsx`, `sunburst-hint.tsx`, `sunburst-breadcrumb.tsx`

## Feature summary

Drill-down sunburst: nested ring segments rendered as ONE TanStack `polar()` + `radialArc()` mark with a custom d3-style `arc()` generator; bklit's `geometryFor`/`ringOptions` layout is verbatim. Click-to-zoom (750ms WAAPI d-morph, focus commits after animation), hover grow through the TanStack reconcile pipeline + CSS opacity dim, ring-staggered 1100ms angular-sweep WAAPI reveal, SVG label overlay, HTML center zoom-out overlay, aria-live hint. Config-carrier children (`SunburstSegment/Center/Labels/Hint`) classified by displayName.

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `SunburstChart` | component | same | displayName kept; split into outer + `SunburstChartInner` (rules-of-hooks) |
| `SunburstChartProps.data` | `SunburstNode` | same | |
| `.size` | number (default 520) | same | |
| `.playKey` | number | same | accepted but ignored — reveal guarded once per mount via `data-bkm-revealed`, no replay |
| `.className` | string | same | on outer div |
| `.focusId` | string | same | controlled drill-down focus |
| `.onFocusChange` | `(focusId: string) => void` | same | |
| `.hoveredIndex` | number \| null | same | controlled hover |
| `.onHoverChange` | `(index: number \| null) => void` | same | |
| `.hoverPop` | number (default 8) | same | legacy `DEFAULT_HOVER_POP = 8` inlined |
| `.padding` | number | same | defaults from `defaultSunburstGrowPadding` |
| `.enterTransition` | Transition | missing | dropped; hardcoded 1100ms tween, `cubic-bezier(0.85,0,0.15,1)` |
| `.enterStaggerScale` | number | missing | dropped; stagger constants inlined in `buildRevealTiming` |
| `.onPhaseChange` | `(phase: "loading"\|"revealing"\|"ready") => void` | extra | bench settle detection (deadline timer) |
| `.children` | ReactNode | same | carriers classified by displayName (legacy: rendered as SVG children) |
| `SunburstSegment` | component | same | config carrier, returns null (legacy rendered paths) |
| `SunburstSegmentProps.index` | number | same | |
| `.color` | string | same | override, honored via `getFill` |
| `.fill` | string | same | pattern/gradient override, honored |
| `.fillOpacity` | number | same | honored; else depth opacity baked into fill |
| `SunburstCenter` | component | same | carrier (legacy rendered SVG `<circle>`) |
| `SunburstCenterProps.className` | string | same | accepted, ignored |
| `SunburstLabels` | component | same | carrier |
| `SunburstLabelsProps.fontSize/fill/stroke/strokeWidth/className` | — | same | accepted but ignored; overlay hardcodes legacy defaults (11 / `var(--chart-label)` / `var(--chart-background)` / 2.5) |
| `SunburstHint` | component | same | carrier |
| `SunburstHintProps.children` (render-prop with context) | function child | missing | hint text is fixed internally |
| `SunburstHintContext` | type | missing | `{hintText, hoveredArc, focus}` render-prop payload dropped |
| `ArcDatum` | type | same | re-exported from `internal/sunburst-types` |
| `Focus` | type | same | re-exported |
| `SunburstNode` | type | same | re-exported |
| `ArcGeometry` | type | missing | internal-only (`internal/sunburst-geometry`), not re-exported |
| `SunburstProvider` / `SunburstContextValue` (+ Stable/Hover variants) | context | missing | whole context architecture removed |
| `useSunburstStable` | hook | missing | replaced by props into inner component |
| `useSunburstHover` | hook | missing | replaced by direct React state |
| `sunburstCssVars` | constant | missing | internalized in `internal/sunburst-colors`, not exported |
| `defaultSunburstColors` | constant | missing | internalized (`var(--chart-1..5)`) |
| `opacityForRelativeDepth` | util fn | missing | internalized (step 0.15, floor 0.45) |
| `SunburstBreadcrumb` / `SunburstBreadcrumbProps` / `SunburstBreadcrumbItem` | component | missing | no breadcrumb in migrated |
| `useSunburstBreadcrumbItems` | hook | missing | |
| `arcPath`, `buildArcs`, `clockwiseFraction`, `defaultSunburstGrowPadding`, `geomCentroidAngle`, `geomCentroidRadius`, `geometryFor`, `ringOptions`, `sumValues`, `transitionGeometry` | util fns | missing | all internalized in `internal/sunburst-geometry` (verbatim) |
| `buildSunburstEnterTiming` / `SunburstEnterTiming` / `SunburstSegmentEnterDelays` | util fn / types | renamed | → `buildRevealTiming` / `ArcRevealTiming` (internal, ms instead of s) |
| `buildRevealDelays`, `buildRevealSchedule`, `SunburstRevealSchedule`, `segmentRevealFromRingSweep`, `localProgress`, `centroidAngle` | util fns / types | missing | deprecated in legacy; dropped. **These six (with `buildSunburstEnterTiming` from row above) are the retired set routed to P5.3's ACCEPT ledger (D301 §2 / D312).** |
| `lerpGeometry` | util fn | **exported** | ⚠ **CORRECTED 2026-08-25 (D312).** This row previously grouped `lerpGeometry` with the dropped set as "private inside `transitionGeometry`". That was true until P5.1 added the `export` keyword at its definition site in `internal/sunburst-geometry.ts` and a barrel line for it. **It is public API now — do NOT file it as retired.** |
| `SunburstCenterOverlay`, `SunburstLabelsOverlay`, `SunburstHintDisplay`, `LabelItem`, overlay props types | components / types | extra | internal-only render counterparts |
| `buildRevealTiming`, `maxRevealDelayMs`, `buildRevealKeyframes`, `buildZoomKeyframes` | util fns | extra | internal-only WAAPI helpers |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `polar({radiusRatio:1})` container | mark | TANSTACK | TS-NATIVE | yes | single polar container; TS-check: native — `polar(radiusRatio)` (`@tanstack/charts/polar`) |
| `radialArc` mark, id `"sunburst-arcs"`, key per arcIndex | mark | TANSTACK | TS-NATIVE | yes | one mark, custom generator; TS-check: native — `radialArc(id/key/generator)` (`@tanstack/charts/polar`) |
| `focusDisabled`, `tooltip:false`, `guides:false`, `x/y:null` | config | TANSTACK | TS-NATIVE | yes | definition flags; TS-check: native — `focusDisabled` (`/focus/disabled`), `tooltip:false`/`guides`/`x`,`y:null` spec opts |
| d3 `arc()` generator + `Object.assign` accessor stubs | util fn | CUSTOM | CUSTOM-ON-TS | maybe | type-compat workaround for TanStack's `WrappedArc` accessors; TS-check: native — `RadialArcOptions.generator` hook; configured d3 arc needs no stubs |
| `buildArcs`/`layoutNode`/`sumValues` flat layout + `focusById` | util fn | BKLIT | CUSTOM | no | verbatim from legacy `sunburst.ts`; TS-check: CONTRADICTS no — native `sunburst()` (`@tanstack/charts/hierarchy/sunburst`): partition+rings+`rootId` |
| `TOP=-π/2`, `TWO_PI`, `ID_SEP=" / "` | constant | BKLIT | CUSTOM | no | geometry constants; TS-check: CONTRADICTS no — partial: `polar` startAngle/endAngle; ID_SEP custom |
| `DRILL_CENTER_SCALE=0.65`, `DRILL_CENTER_DEPTH_SHRINK=0.08`, floor 0.45 | constant | BKLIT | CUSTOM | no | `ringOptions` center hub; TS-check: CONTRADICTS no — partial: `innerRadius` PolarLength expresses hub scaling |
| `HOVER_GROW_RING_BUDGET=0.28`, `HOVER_GROW_SEGMENT_CAP=0.1` | constant | BKLIT | CUSTOM | no | grow budget math; TS-check: none — mark states restyle only, no arc-geometry grow primitive |
| `geometryFor` angle remap / `arcPath` d-string / `transitionGeometry`+lerp+pointGeometry | util fn | BKLIT | CUSTOM | no | verbatim; `pointGeometry` pin `radius*0.12`; TS-check: CONTRADICTS no — partial: sunburst mark generates+morphs sector paths natively |
| depth opacity `OPACITY_STEP=0.15`, `OPACITY_FLOOR=0.45` | constant | BKLIT | CUSTOM | no | baked into fill (radialArc fillOpacity is number-only); TS-check: none — no per-datum opacity channel on radialArc/sunburst |
| `applyAlphaToColor` → `color-mix(in srgb, …)` | util fn | CUSTOM | CUSTOM | maybe | exists only because per-datum opacity channel is absent; TS-check: partial — radialArc/sunburst fillOpacity is scalar only |
| `defaultSunburstColors` = `var(--chart-1..5)` | constant | BKLIT | CUSTOM | no | category color cycle; TS-check: CONTRADICTS no — native `defaultChartTheme.palette` cycle + color scale |
| ring separators: stroke `var(--chart-background)`, width 1 | constant | BKLIT | CUSTOM-ON-TS | yes | radialArc stroke props; TS-check: native — `stroke`/`strokeWidth` opts (`@tanstack/charts/polar`) |
| hover grow via `arcRows` → definition → reconcile | hook | CUSTOM | CUSTOM-ON-TS | yes | geometry through TanStack pipeline (legacy: motion animate on growRef); TS-check: native — keyed update + `motion` tween morphs arc geometry (`@tanstack/charts/motion`) |
| hover dim: `pathEl.style.opacity = "0.25"` | side-effect (DOM) | BKLIT | CUSTOM | no | imperative, re-applied in handleRender after reconcile; TS-check: CONTRADICTS no — native mark `states` when/style incl per-datum opacity (`ChartMarkState`) |
| `[data-bkm-chart="sunburst"] .ts-chart__marks path { transition: opacity 160ms ease-out }` | CSS class | BKLIT | CUSTOM | no | styles.css; parity of legacy `HOVER_DIM_TRANSITION` 0.16s easeOut; TS-check: CONTRADICTS no — native state `transition` tween/spring (`ChartMarkStateTransition`) |
| per-path `pointerenter/leave/click` listeners | side-effect (listeners) | BKLIT | CUSTOM | maybe | added in useLayoutEffect on cached path refs; TS-check: CONTRADICTS maybe — native pointer focus + `onFocusChange`/`onSelect`, or selection controller |
| zoom driver: rAF loop, 750ms, `cubic-bezier(0.22,1,0.36,1)` | side-effect (rAF) | BKLIT | CUSTOM | maybe | legacy used motion `animate(0,1)`; focus commits after completion; TS-check: CONTRADICTS maybe — native tween transition w/ custom easing fn (`ChartMotionTransition`) |
| zoom WAAPI d-keyframes, 30 samples (`ZOOM_SAMPLES`) | side-effect (WAAPI) | CUSTOM | CUSTOM | no | `buildZoomKeyframes` via `transitionGeometry`; TS-check: CONTRADICTS no — native `path:'morph'` command interpolation on keyed updates (`motion()`) |
| reveal WAAPI d-keyframes, 64 samples (`TWEEN_SAMPLES`), 1100ms, `cubic-bezier(0.85,0,0.15,1)` | side-effect (WAAPI) | BKLIT | CUSTOM | no | angular sweep, `fill:"backwards"`; 64 samples avoid `d` discrete-interpolation bugs; TS-check: CONTRADICTS no — native motion entrance "arcs sweep through their authored angle", default 1100ms tween |
| ring stagger `ringIndex*0.12 + index*0.08`, scale floor 0.25 | constant | BKLIT | CUSTOM | no | `buildRevealTiming` (legacy `buildSunburstEnterTiming`, s→ms); TS-check: CONTRADICTS no — native `stagger()` + motion delay fn (`@tanstack/charts/motion/definition`) |
| `data-bkm-revealed="1"` dataset guard | side-effect (DOM) | CUSTOM | CUSTOM | no | prevents re-animation on focus/data change; TS-check: CONTRADICTS no — native motion entrance plays once per mount (SSR adopt w/o replay) |
| reveal deadline `1100 + maxDelay + 935` → `setPhase("ready")` | constant + side-effect (timer) | CUSTOM | CUSTOM | no | bench settle detection via `setRevealDeadline`; TS-check: none — no public motion-settle/onFinish callback |
| `onPostPaint` deferred reveal scheduling | side-effect (rAF) | CUSTOM | CUSTOM | maybe | from shared `internal/deferred-reveal`; TS-check: none — afterPaint is tooltip-motion-internal only |
| double-rAF fallback if `onRender` never fired | side-effect (rAF) | CUSTOM | CUSTOM | no | checks `getAnimations()` on paths; TS-check: none |
| `.ts-chart__marks--revealing` class (opacity 0) | CSS class | CUSTOM | CUSTOM | no | styles.css; hides group until WAAPI takes over; TS-check: none |
| `.ts-chart__marks` group + `path[data-ts-key^="sunburst-arcs:"]` queries | CSS class / selector | TANSTACK | CUSTOM | maybe | TanStack DOM contract relied upon for path caching; TS-check: native — stable contract `g.ts-chart__marks` / `[data-ts-key]` (svg-surface.ts) |
| depth-descending DOM order (`sortedArcs`) | util fn | BKLIT | CUSTOM-ON-TS | yes | parity of legacy `sortSunburstSegments` hit-testing; TS-check: native — resolver picks topmost primitive via reverse paint order (no sort needed) |
| `usePrefersReducedMotion` | hook | CUSTOM | CUSTOM | yes | shared internal; legacy read matchMedia ad hoc; TS-check: native — motion `respectReducedMotion` snaps transitions |
| `SunburstCenterOverlay` (HTML div circle, `liveCenterR-2` inset) | component | BKLIT | CUSTOM | maybe | adds role=button/tabIndex/Enter-Space keydown (legacy: plain SVG circle); TS-check: none — no HTML overlay/button primitive |
| center color: `var(--chart-background)` at root else category color | constant | BKLIT | CUSTOM | no | ; TS-check: none — app styling choice |
| `SunburstLabelsOverlay` (SVG text layer, viewBox `-fullRadius`) | component | BKLIT | CUSTOM-ON-TS | maybe | font 11/600, halo stroke 2.5, `paintOrder:stroke`; TS-check: partial — native `text()` mark lacks stroke halo/paint-order |
| label culls: `angleSpan*r < 26` or thickness `< 16` | constant | BKLIT | CUSTOM | no | verbatim thresholds; TS-check: none — no native label culling/collision |
| label dim 0.25 + `transition: opacity 160ms ease-out` (inline) | constant / CSS | BKLIT | CUSTOM | no | deviation: legacy culls unrelated labels instead; TS-check: CONTRADICTS no — native text mark `states` opacity + transition |
| label reveal WAAPI opacity, delay `maxDelay + 1100*0.85`, cleanup `+30ms` | side-effect (WAAPI + timer) | BKLIT | CUSTOM | no | parity of legacy `labelsDelay = maxDelay + duration*0.85`; TS-check: CONTRADICTS no — native motion delay fn (enter phase) on text mark |
| `data-bkm-labels-revealed` dataset guard | side-effect (DOM) | CUSTOM | CUSTOM | no | once per mount; TS-check: CONTRADICTS no — native entrance once-per-mount semantics |
| `SunburstHintDisplay` (aria-live, marginTop 12, minHeight 20, 14px, `var(--chart-foreground-muted, #888)`) | component | BKLIT | CUSTOM | no | legacy used Tailwind classes; TS-check: partial — tooltip is role=status/aria-live but transient, not fixed hint line |
| hint text: trail join `"  ›  "` + two fixed strings | constant | BKLIT | CUSTOM | no | verbatim copy; TS-check: none |
| contexts provided | context | — | — | — | none (legacy `SunburstProvider` removed); TS-check: none — TanStack is props/callbacks, no provider context |

## Imports

- `internal/sunburst-geometry` (chart + reveal: geometry/layout/hover-grow fns, `ArcDatum`/`Focus` types)
- `internal/sunburst-colors`
- `internal/sunburst-types`
- `internal/sunburst-reveal`
- `internal/sunburst-center`
- `internal/sunburst-labels`
- `internal/sunburst-hint`
- `internal/deferred-reveal` (shared: internal-animation — `onPostPaint`, `setRevealDeadline`)
- `internal/use-prefers-reduced-motion` (shared: internal-foundation)
- `./children` (add-on part — `displayNameOf`)
- `./styles.css` (side-effect import)

## Deviations

- `playKey` accepted but ignored — reveal runs once per mount (`data-bkm-revealed`); no replay on data/playKey change (legacy replayed via `useMountProgress` keys).
- `enterTransition` / `enterStaggerScale` props dropped; 1100ms + `cubic-bezier(0.85,0,0.15,1)` hardcoded (legacy default was `DEFAULT_ANIMATION_DURATION_MS` tween, same easing).
- Legacy `SunburstProvider`/`useSunburstStable`/`useSunburstHover` context architecture removed entirely; children are inert config carriers classified by displayName.
- Labels: legacy culls unrelated arcs on hover (`!isRelated → null`); migrated keeps all labels and dims them (opacity 0.25). `sunburst-labels.tsx` header comment claims cull parity — comment/impl mismatch.
- Center circle does not interpolate radius during zoom (legacy: `centerR*zoomT + prevCenterR*(1-zoomT)`); migrated computes from current focus only, so it snaps at commit.
- Hover grow moved from motion-driven `growRef` ticks to TanStack reconcile — a React re-render per hover state change (perf profile differs from legacy).
- Zoom commits focus only after the 750ms animation; legacy committed immediately and animated `zoomT` (rapid-click midpoint-snapshot logic added in migrated).
- Legacy svg fade-in (`motion.svg` opacity 0→1, 350ms) and svg-level `onPointerLeave` hover-clear not reproduced (per-path pointerleave only).
- `SunburstCenter` is an HTML div overlay with added button semantics (role/tabIndex/keydown) instead of a bare SVG circle; no ring stroke on center.
- d3 generator accessors stubbed via `Object.assign` to satisfy TanStack `WrappedArc` typing — fragile workaround.
- `maxRevealDelayMs` exported from `sunburst-reveal` but chart recomputes the max inline from `buildRevealTiming` — duplication.
- Legacy `SunburstBreadcrumb` family has no migrated counterpart.
