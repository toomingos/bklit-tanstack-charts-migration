# funnel — Phase 4 Research Report

**Files:** `showcase/migrated/charts/funnel-chart.tsx`, `showcase/migrated/charts/internal/funnel-geometry.ts`, `showcase/migrated/charts/internal/funnel-hover-chrome.ts`, `showcase/migrated/charts/internal/funnel-reveal.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/funnel-chart.tsx`

## Feature summary

Horizontal/vertical stage funnel: each stage renders a stack of concentric halo-ring SVG paths (curved or straight Bézier trapezoids) plus an absolutely-positioned label overlay (value / percentage pill / stage name). Interactions: per-stage hover pops that stage's own rings via axis-specific springs (`scaleY` horizontal / `scaleX` vertical), dims non-hovered stages (graphic: 0.15s tween; label overlay: fixed spring), driven by an imperative pie-style hover coordinator with controlled/uncontrolled `hoveredIndex` support. Enter: staggered per-segment scale reveal (WAAPI) + independent label fade-in. Optional grid layer (alternating background bands + gap grid lines). D30 GAP chart — ported as plain SVG/div, no TanStack `defineChart`/`<Chart>` wrapper (FLAGGED FOR FABLE, see Deviations).

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `FunnelChart` | component | same | barrel-exported both sides |
| `FunnelChartProps` | type | same | |
| `FunnelStage` | type | same | `label`, `value`, `displayValue?`, `color?`, `gradient?` |
| `FunnelGradientStop` | type | same | `offset`, `color` |
| `FunnelEnterTransition` | type | extra | migrated-only re-export (narrowed replacement for framer `Transition`) |
| `data` | `FunnelStage[]` | same | required |
| `orientation` | `"horizontal" \| "vertical"` | same | default `"horizontal"` |
| `color` | `string` | same | default `"var(--chart-1)"` |
| `layers` | `number` | same | default 3 |
| `className` | `string` | same | |
| `style` | `CSSProperties` | same | |
| `showPercentage` | `boolean` | same | default true |
| `showValues` | `boolean` | same | default true |
| `showLabels` | `boolean` | same | default true |
| `hoveredIndex` | `number \| null` | same | controlled hover |
| `onHoverChange` | `(index: number \| null) => void` | same | |
| `formatPercentage` | `(pct: number) => string` | same | default `${Math.round(p)}%` |
| `formatValue` | `(value: number) => string` | same | default `intFmt` |
| `staggerDelay` | `number` | same | seconds, default 0.12 |
| `enterTransition` | `FunnelEnterTransition` | renamed | legacy: framer `Transition`; migrated: structural spring\|tween union (framer not a runtime dep) |
| `gap` | `number` | same | px, default 4 |
| `renderPattern` | `(id: string, color: string) => ReactNode` | same | visx pattern bridge, innermost ring fill |
| `edges` | `"curved" \| "straight"` | same | default `"curved"` |
| `labelLayout` | `"spread" \| "grouped"` | same | default `"spread"` |
| `labelOrientation` | `"vertical" \| "horizontal"` | same | grouped layout only |
| `labelAlign` | `"center" \| "start" \| "end"` | same | default `"center"` |
| `grid` | `boolean \| {bands?, bandColor?, lines?, lineColor?, lineOpacity?, lineWidth?}` | same | default false; defaults resolved verbatim |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `FunnelChart` | component | BKLIT | CUSTOM | no | plain SVG/div port; D30 GAP-chart escape clause, no `defineChart`/`<Chart>` (FLAGGED); TS-check: CONTRADICTS no — partial: verified native funnel recipe (areaX trapezoids + text, conformance case 125-sales-funnel) |
| `FunnelSegment` (per stage) | component | BKLIT | CUSTOM | no | merges legacy `HSegment`/`VSegment` + `SegmentLabel` into one component; TS-check: partial — `compositeMark`/`createMark` compose marks, no per-stage React component equivalent |
| `FunnelOrientationContext` | context | CUSTOM | CUSTOM | no | migrated-only orientation plumbing (provided by chart, consumed by segment); TS-check: none — TanStack has no orientation context; marks are axis-transposed instead |
| Controlled/uncontrolled hover split | util fn | BKLIT | CUSTOM | no | `isControlledRef`/`onHoverChangeRef` mirrors bklit `setHoveredIndex` contract; TS-check: CONTRADICTS no — partial: `ControlledSignal` (`interaction/signal`) + `keyedSelection` cover the pattern for marks, not index-hover |
| `createFunnelHoverCoordinator` | util fn | BKLIT | CUSTOM | maybe | alias of `createPieHoverCoordinator` (getHovered/requestHover/requestUnhover/setHovered/subscribe broadcast bus); TS-check: none — no per-index hover bus in TanStack (focus is point/scene-based) |
| `createFunnelSegmentHoverRuntime` | util fn | BKLIT | CUSTOM | no | zero-React-state per-segment paint runtime (`update`/`paint`/`stop`); TS-check: none — closest is `states`+`ChartMarkStateTransition`, no imperative runtime |
| Per-ring hover-pop springs | side effect (rAF springs) | BKLIT | CUSTOM | no | one independent spring per ring layer; AXIS-SPECIFIC `scaleY` (horiz) / `scaleX` (vert); TS-check: partial — `ChartMotionSpringTransition`/`createChartSpring` (`spring`) exist but drive scene attrs, not per-element transforms |
| Label-overlay dim spring `{stiffness:300, damping:24}` | side effect (rAF spring) | BKLIT | CUSTOM | no | fixed params, NOT per-ring scaled; separate instance per segment; TS-check: partial — `ChartMotionSpringTransition` spring params exist, no DOM-overlay spring host |
| Graphic dim transition `opacity 0.15s linear` | constant / CSS | BKLIT | CUSTOM | maybe | plain CSS transition tween (unlike the springs); TS-check: partial — `ChartMotionTweenTransition`/mark `states` tween opacity, but scene-scoped, not CSS-transition on overlay |
| `FUNNEL_FADE_OPACITY = 0.4` | constant | BKLIT | CUSTOM | no | dim target for graphic AND label overlay; TS-check: partial — expressible as `states` `opacity` style value, no named constant |
| z-index scheme 1/10 (graphic), 20 (label hitbox) | constant | BKLIT | CUSTOM | no | preserves stacking incl. grid-lines-over-segments; TS-check: none — TanStack stacking is DOM/mark order, no z-index API |
| WAAPI reveal `.animate()` scale keyframes | side effect (WAAPI) | BKLIT | CUSTOM | maybe | `fill:"backwards"`, onfinish cancel + static `scale(1)`; replay-on-mount / snap-on-update rides React key lifetime; TS-check: CONTRADICTS maybe — partial: `motion()` renderer animates enter via opacity/attr tracks (bar grow, point roll), no scale-reveal track |
| `FUNNEL_TWEEN_FALLBACK` 1100ms cubic-bezier(0.85,0,0.15,1) | constant | BKLIT | CUSTOM | maybe | shared `TWEEN_FALLBACK` re-exported under funnel name; TS-check: CONTRADICTS maybe — native: `motion()` defaultDuration 1100 + defaultEasing cubic-bezier(0.85,0,0.15,1) identical |
| Label fade-in tween 350ms ease-out, delay `i*stagger+0.25s` | constant + WAAPI | BKLIT | CUSTOM | maybe | verified legacy ignores `enterTransition` here; always-tween; TS-check: partial — `ChartMotionTweenTransition` easing 'ease-out' + `stagger()` delay, but no 0.25s offset constant |
| `staggerDelay` default 0.12s (×1000 → ms) | constant | BKLIT | CUSTOM | no | ; TS-check: partial — `stagger({each})` is ms-based with `offset`, no 0.12s default |
| `gap` default 4px | constant | BKLIT | CUSTOM | no | ; TS-check: partial — `waffle` has `gap`, `bandX/Y` have `inset`, no funnel gap |
| `aspectRatio` `"2.2 / 1"` horiz / `"1 / 1.8"` vert | constant | BKLIT | CUSTOM | no | container-level; TS-check: partial — `<Chart aspectRatio>` (number only, react-charts) exists; no orientation-dependent string default |
| `hSegmentPath` / `vSegmentPath` | util fn | BKLIT | CUSTOM | no | verbatim; magic values 0.44 half-height cap, 0.55 control point; TS-check: partial — `d3AreaXCurve`/`d3Curve` wrap d3 curve factories, no custom Bézier-trapezoid factory hook |
| `computeFunnelRings` | util fn | BKLIT | CUSTOM | no | `scale = 1-(l/layers)*0.35`; `opacity = 0.18+(l/(layers-1\|\|1))*0.65`; TS-check: none — no concentric-halo primitive |
| `funnelRingExtraScale` | util fn | BKLIT | CUSTOM | no | `1+(i/max(rings-1,1))*0.12`; TS-check: none — no ring-scale concept |
| `funnelRingSpringParams` | util fn | BKLIT | CUSTOM | no | `stiffness: 300-i*60`, `damping: 24-i*3`; TS-check: partial — `ChartMotionSpringTransition` accepts per-mark stiffness/damping via motion fn, no per-ring formula |
| `funnelSegBox` | util fn | BKLIT | CUSTOM | no | `(segW+gap)*i` floor-tiling; matches qa D39 cell-center probe; TS-check: partial — band scales/bandwidth do this via `scales.x.bandwidth`, no pixel-tiling helper |
| `resolveFunnelGrid` + `FunnelGridConfig`/`FunnelGridProp` | util fn / type | BKLIT | CUSTOM | no | verbatim defaults `var(--color-muted)` / `var(--chart-grid)`; TS-check: none — no grid-config resolver; nearest is `frame()` options |
| Grid bands SVG layer (even-index rects) | mark | BKLIT | TS-NATIVE | no | behind segments; TS-check: CONTRADICTS no — native: `bandX`/`bandY` (index-based, full-span fillOpacity bands) |
| Grid lines SVG layer (n−1 lines at gap midpoints) | mark | BKLIT | TS-NATIVE | no | above segments (DOM order + z-index:auto); TS-check: CONTRADICTS no — native: `ruleX`/`ruleY` at arbitrary values + mark order for layering |
| `<linearGradient>` defs + stop offset %-conversion | mark | BKLIT | TS-NATIVE | no | innermost-ring gradient takes priority over `color`; TS-check: CONTRADICTS no — native: `gradients: ChartLinearGradient[]` on `defineChart` spec (svg.ts renders `<defs>`) |
| `renderPattern` visx pattern bridge | util fn | BKLIT | CUSTOM | no | innermost ring `fill="url(#id)"`, halos stay solid; TS-check: none — gradients only, no pattern-defs API (url() paint passthrough only) |
| `usePositiveChartSize` (ResizeObserver) | hook | BKLIT | TS-NATIVE | maybe | replaces bklit's own measure+RO; TanStack `MarkRenderContext.chart` could supply w/h; TS-check: partial — renderer.ts owns ResizeObserver + `<Chart aspectRatio>`, but no exported size hook |
| `matchMedia("(prefers-reduced-motion: reduce)")` guards ×2 | side effect (listener-less media query) | EXTRA | CUSTOM | yes | legacy funnel path has none; migrated skips reveal/fade — see Deviations; TS-check: native — `motion()`/`ChartMarkStateTransition` `respectReducedMotion` (charts-core) |
| `onPointerEnter`/`onPointerLeave` listeners on label hitbox | side effect (event listeners) | BKLIT | TS-NATIVE | maybe | legacy used `onMouseEnter`/`onMouseLeave` — see Deviations; TS-check: partial — scene pointer focus (`pointer` option, `focusNearestX/Y`) is chart-surface-level, no per-cell hitbox API |
| Direct DOM mutation (`style.transform`/`opacity`/`zIndex` writes) | side effect | BKLIT | CUSTOM | no | imperative paint path, no React state in pointer path (D10); TS-check: none — TanStack writes attrs via motion tracks, no imperative style-write API |
| Segments keyed by `stage.label` | util | BKLIT | TS-NATIVE | no | reproduces bklit replay-vs-snap semantics; TS-check: native — mark `key` channel + `data-ts-key` reconciliation (`reconcile.ts`) |
| `data-bkm-chart="funnel"` attribute | constant | CUSTOM | CUSTOM | no | scopes the styles.css rules below; TS-check: none — TanStack uses `ts-chart__*` classes/data-ts-* keys, no custom attr hook |
| `.ts-bkm-funnel-value` / `-pct` / `-label` | CSS class | CUSTOM | CUSTOM | no | hand-authored replacements for bklit Tailwind literals (byte-identical computed values, incl. Tailwind v4 `shadow-sm`); TS-check: partial — `text()` mark has fontSize/fontWeight/fill options, no pill/chrome styling API |
| `cursor-pointer` class on label hitbox | CSS class | BKLIT | CUSTOM | no | kept literal; qa/screenshot.mjs funnel hover-zone probe selects `#chart-root .cursor-pointer`; TS-check: partial — interactiveColorLegend sets cursor via style, no mark-cursor option |
| `fmtPct` / `fmtVal` (`intFmt`) defaults | util fn | BKLIT | TS-NATIVE | no | `intFmt` from `internal/formatters`; TS-check: partial — tooltip `format`/`formatX/formatY` + tick label formatting, no exported number formatter |

## Imports

- `internal/funnel-geometry` — `hSegmentPath`, `vSegmentPath`, `computeFunnelRings`, `funnelSegBox`, `resolveFunnelGrid`, `FunnelSegBox`
- `internal/funnel-hover-chrome` — `createFunnelHoverCoordinator`, `createFunnelSegmentHoverRuntime`, `FunnelHoverCoordinator`
- `internal/funnel-reveal` — `buildProgressKeyframes`, `FUNNEL_TWEEN_FALLBACK`, `resolveEnterTransition`, `revealTiming`, `FunnelEnterTransition`
- `internal/formatters` — `intFmt`
- `internal` barrel — `usePositiveChartSize` (underlying `internal/use-container-size`)
- `styles.css` (side-effect import)
- Transitive via part internals: `internal/pie-hover-chrome` (coordinator re-exported under funnel names), `internal/spring`, `internal/enter-transition`

## Deviations

- **FLAGGED FOR FABLE:** rendered as plain SVG/div WITHOUT the `defineChart({marks:[...]})`/`<Chart>` wrapper D30's binding architecture describes — file invokes D30's own plain-SVG escape clause (same precedent as gauge/ring/pie); all other D30 requirements (explicit cubic-Bézier `path` strings, one node per halo ring, zero ChartPoints, native-listener hover, WAAPI tween reveal) are met verbatim.
- Dead code: `hoverInputsRef` is fully populated every render (funnel-chart.tsx:671–698) but never read anywhere.
- Reduced motion: migrated adds `window.matchMedia("(prefers-reduced-motion: reduce)")` guards skipping the reveal and label fade — the legacy funnel path has no such check (framer handles it globally if at all), so this is a behavior addition; it also re-implements reduced-motion detection inline instead of consuming shared `internal/use-prefers-reduced-motion`.
- Event type change: legacy `onMouseEnter`/`onMouseLeave` → migrated `onPointerEnter`/`onPointerLeave` (pointer events also fire for pen/touch input).
- Mechanism simplification (disclosed in header): `HSegment`/`VSegment`/`SegmentLabel` merged into one `FunnelSegment`; segments absolutely positioned via `funnelSegBox` instead of a flex+gap container — positions claimed numerically identical; label fade-in kept always-tween (matches verified legacy behavior of ignoring `enterTransition` there).
- `enterTransition` type narrowed from framer `Transition` to structural `FunnelEnterTransition` (disclosed; framer-motion not a runtime dependency).
- Label typography: Tailwind utility literals → hand-authored `.ts-bkm-funnel-*` CSS classes (disclosed; bench Tailwind `@source` wouldn't scan migrated code anyway).
- Minor: ring React keys changed (`h-ring-${opacity.toFixed(2)}` → `ring-${ringIndex}`) — no visual impact.
- `internal/funnel-reveal.ts` is a thin re-export shim over `internal/enter-transition` (initiative-1 consolidation) providing only funnel-family aliases + `FUNNEL_TWEEN_FALLBACK`.
