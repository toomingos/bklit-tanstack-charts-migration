# area — Phase 4 Research Report

**Files:** `showcase/migrated/charts/area-chart.tsx`, `showcase/migrated/charts/internal/pattern-area-mark.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/area-chart.tsx`, `area.tsx`, `pattern-area.tsx`, `area-gradient-defs.tsx`, `area-chart-loading.tsx`, `time-series-chart-shell.tsx`

## Feature summary

Time-series area chart: per-series vertical-gradient filled areas with boundary strokes, hover chrome (dim 0.6, dots, crosshair, date pill, tooltip), clip-reveal entrance (1100ms), y-domain tween on data change, optional pattern-filled areas, plus the shared time-series shell features (brush/xDomain, reference areas, projection lines, terminal markers, dash tails, point markers, segments, axes overlays). Migrated as two TanStack marks per series (`areaFill`/`patternAreaMark` fill under a `lineY` boundary with the same mark id convention as Line).

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `AreaChart` (named export) | component | same | Default export from legacy (`export default AreaChart`) is **missing** — migrated is named-only |
| `AreaChartProps` | type | same | |
| `data` | `ChartDatum[]` | same | |
| `xDataKey` | `string` = `"date"` | same | |
| `status` | `ChartStatus` = `"ready"` | same | |
| `animationDuration` | `number` = `1100` | same | |
| `animationEasing` | `string` | same | Accepted but **ignored**: reveal always uses fixed `REVEAL_EASING` const |
| `margin` | `Partial<Margin>` | same | Same `{40,40,40,40}` default |
| `aspectRatio` | `string` = `"2 / 1"` | same | |
| `className` | `string` | same | |
| `loadingLabel` | `string` | same | Rendered via shared `LoadingLabel` |
| `onPhaseChange` | `(phase) => void` | same | |
| `style` | `CSSProperties` | same | |
| `children` | `ReactNode` | same | Config-carrier children (`<Area>`, `<Grid>`, …) via `extractChildren` |
| `yDomainTween` | `boolean` = `true` | same | Also accepts numeric ms (shell behavior) |
| `yDomainTweenDuration` | `number` = `500` | same | |
| `xDomain` | `[Date, Date]` | same | Brush viewport; drives visible slice + clip |
| `xDomainSlotCount` | `number` | same | Accepted for parity, unused (no line/area consumer in legacy either) |
| `tweenYDomainOnXDomainChange` | `boolean` = `false` | same | Shell `tweenOnTargetChange` logic ported |
| `enterTransition` | `Transition` (motion/react) | missing | Dropped; no motion/react equivalent in migrated |
| `revealSignature` | `string` | missing | Orchestrator called with `revealSignature: ""` hardcoded |
| `Area` re-export + `AreaProps` (from legacy `area-chart.tsx`) | component/type | renamed | Moved to `children.tsx` null config carrier (children add-on part) |
| `<Area> dataKey/fill/fillOpacity/stroke/strokeWidth/curve/yAxisId/showHighlight/dashFromIndex/dashArray/fadeEdges` | props | same | Defaults verified identical (fillOpacity 0.4, strokeWidth 2, curveMonotoneX, fadeEdges false) |
| `<Area> showMarkers` / `markers` | props | same | Consumed via **untyped casts** — absent from `AreaConfig` type (see Deviations) |
| `<Area> animate` | `boolean` | missing | No path-morph machinery exists for Area in either impl |
| `<Area> showLine` | `boolean` | missing | Boundary lineY always rendered |
| `<Area> gradientToOpacity` / `gradientSpan` | `number` | missing | Defaults (0 / 1) collapse legacy 2–3-stop gradient to the 2 stops always emitted |
| `<Area> loadingStroke/loadingStrokeOpacity/loading/loadingPulseMode/loadingStyle` | props | missing | Loading pulse/sweep chrome not ported; loading state = empty grid + label |
| `PatternArea` re-export (legacy `charts/index.ts`) | component | renamed | `children.tsx` config carrier |
| `<PatternArea> dataKey/fill/curve` | props | same | |
| `<PatternArea> patternPreset` / `patternColor` | props | extra | Plan §10 ruling 1 convenience shape over legacy raw `url(#id)` fill |
| `<PatternArea> animate` | `boolean` | missing | Deprecated no-op in legacy |
| `AreaChartLoading` + props (legacy `charts/index.ts`) | component | missing | Skeleton-data loading preset not migrated |
| `patternAreaMark` / `PatternAreaMarkOptions` (internal export) | mark factory | extra | New `createMark`-based fill mark replacing visx `AreaClosed` |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_ANIMATION_DURATION_MS = 1100` | constant | BKLIT | CUSTOM | no | bklit animation.ts reveal duration; TS-check: CONTRADICTS no — motion() renderer defaultDuration=1_100 (`@tanstack/charts/motion`) |
| `REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)"` | constant | BKLIT | CUSTOM | no | Clip-reveal easing; TS-check: CONTRADICTS no — motion.ts defaultEasing=cubicBezier(0.85,0,0.15,1), identical curve |
| `DATA_TWEEN_MS = 500` | constant | BKLIT | TS-NATIVE | yes | Feeds `svgAnimation.duration`; TS-check: native — svgAnimation ChartAnimationOptions.duration (charts-core) |
| `AREA_DIM_OPACITY = "0.6"` | constant | BKLIT | CUSTOM | no | Area's hover dim (Line uses 0.3); TS-check: partial — areaY `states` focus-selector opacity expresses dim; const stays app-side |
| `DEFAULT_MARGIN {40,40,40,40}` | constant | BKLIT | CUSTOM | no | TS-check: none — defineChart margin option exists; 40s are bklit-specific default |
| Series defaults (fill `var(--chart-line-primary)`, strokeWidth 2, fillOpacity 0.4, curveMonotoneX, fadeEdges false, showHighlight true) | constant | BKLIT | CUSTOM | no | Ported from `area.tsx`; TS-check: none — fill/strokeWidth/curve options exist natively, values bklit-specific |
| Fill gradient stops 0%→`fillOpacity`, 100%→0 | constant | BKLIT | CUSTOM | no | In sibling 0×0 `<svg>`; url() resolves document-wide; TS-check: CONTRADICTS no — native `gradients` def option + ChartLinearGradient stops (charts-core) |
| Marker reveal: 500ms, `blur(2px)`→0, delay = leadingEdge/innerWidth × duration, highlightPad = radius×0.35, visualExtent = radius+ring+outline+pad+2 | constant | BKLIT | CUSTOM | no | Per-circle WAAPI stagger; TS-check: partial — stagger()/mark motion delay covers per-dot timing; no blur-filter support |
| Dash tail defaults `"6,4"` | constant | BKLIT | CUSTOM | no | Via `resolveDashTailBounds`/`DashTailOverlay`; TS-check: partial — strokeDasharray native on lineY/SceneStyle; tail-region masking stays custom |
| Terminal-marker defaults (radius 5, ringGap 0, strokeWidth 1.5, stroke `var(--chart-1)`); projection end marker (stroke `var(--chart-3)`, radius 5, edgePadding radius+1) | constant | BKLIT | CUSTOM | no | Anchor math inline in area-chart.tsx; TS-check: none — dot r/stroke/strokeWidth options exist; ring+anchor math custom |
| Projection defaults (stroke `var(--chart-3)`, gradientEnd `var(--chart-5)`, strokeWidth 2, dasharray `"6,4"`, endpointRadius 5, class `chart-projection-line`) | constant | BKLIT | CUSTOM | no | TS-check: partial — ruleX/ruleY take stroke/strokeWidth/strokeDasharray; gradient stroke + class need custom mark |
| Marks-group clip-reveal | side effect | BKLIT | CUSTOM | maybe | WAAPI `marks.animate()` inset clip-path on `.ts-chart__marks`; `data-bkmRevealed` guard; TS-check: none — motion entrances are baseline-grow (cartesian paths) / arc sweep, no inset-wipe reveal |
| Per-marker WAAPI opacity+blur reveal | side effect | BKLIT | CUSTOM | no | Double-rAF + setTimeout deferral; anim cancel refs; cleanup on unmount; TS-check: partial — motion stagger/keyed enter covers timing+opacity; blur unsupported |
| Direct DOM mutation/query | side effect | BKLIT | CUSTOM | no | `dataset.bkmRevealed`, `style.clipPath`, `querySelector(".ts-chart__marks")`, `.ts-chart__dot[data-ts-key]` circles; TS-check: none — onRender exposes svg but no mutation chrome API |
| `prefers-reduced-motion` checks | side effect | BKLIT | CUSTOM | yes | One-shot `matchMedia` in handleRender + effect (shared hook exists: `use-prefers-reduced-motion`); TS-check: native — respectReducedMotion (motion renderer, ChartMarkStateTransition, svgAnimation) |
| Pointer listeners (hover/selection/brush) | side effect | BKLIT | CUSTOM-ON-TS | maybe | Encapsulated in `use-hover-chrome` / `chart-selection` / `brush-drag`; TS-check: partial — built-in pointer focus + crosshair + brushX/interaction subpaths cover most; chrome visuals custom |
| `chromeStateRef` imperative assignment | side effect | CUSTOM | CUSTOM | no | Per-render ref write feeding hover-chrome; avoids re-render per pointer move; TS-check: none |
| `ChartSelectionContext` provided | context | BKLIT | CUSTOM-ON-TS | no | Wraps whole tree; consumed by `SegmentOverlay`; TS-check: partial — keyedSelection/whenSelected on `@tanstack/charts/selection` subpath; React context wiring app-side |
| `BrushHostContext` provided | context | BKLIT | CUSTOM-ON-TS | no | Only when brushes present; TS-check: partial — brushX on `@tanstack/charts/interaction/brush` subpath computes ranges; host plumbing app-side |
| `useChartLegendHover` consumed | hook | BKLIT | CUSTOM | no | Legend-hover → hover-chrome sync; TS-check: none — interactiveColorLegend (`/legend` subpath) toggles visibility only, no hover-sync |
| `useChartPhaseOrchestrator` / `useNicedYDomainChanged` / `useChartMargin` / `useMeasuredRect` / `React.useId`×5 | hooks | BKLIT/CUSTOM | CUSTOM | no | Phase orchestration owns reveal/tween epochs; TS-check: none |
| `focus: "group-x"`, `focusRing: false`, `maxFocusDistance: Infinity` | constant | BKLIT | TS-NATIVE | yes | TanStack spec options; Infinity = hover anywhere (bklit behavior); TS-check: native — all three ChartDefinitionOptions fields (types.ts) |
| `svgAnimation` conditional domain tween | util fn | BKLIT | TS-NATIVE | yes | `{duration, easing: bezierEasing}` when final y-domain moved, else `false`; TS-check: native — svgAnimation boolean|{duration,easing,respectReducedMotion} consumed by renderer |
| `lineY` boundary mark (id = dataKey, `z` for series identity) | mark | TANSTACK | TS-NATIVE | yes | Documented area+line layering pattern; TS-check: native — lineY with z + strokeDasharray (charts-core line.ts) |
| `areaFill` fill mark | mark | CUSTOM | CUSTOM-ON-TS | maybe | Replaces `areaY`: no retained polygon arrays (G4 heap −19%); lives in internal-foundation; TS-check: native — areaY (AreaYOptions) covers fill/NaN-split/includeZero/z; avoided deliberately for G4 |
| `patternAreaMark` | mark | BKLIT | CUSTOM-ON-TS | maybe | `createMark` scene node, `kind:"area"`, NaN-split segments, baseline at y(0), `includeZero`; TS-check: none — zero pattern/hatch support in v0.14.0 source (createMark scaffolding aside) |
| Pattern tile phase-shift `translate(margin)` | util fn | CUSTOM | CUSTOM | no | bklit anchors tiles at margin origin; TanStack bakes margins into paths; TS-check: none — no pattern system at all |
| `decimateTimeSeries` / `maxRenderPointsForWidth` | util fn | BKLIT | CUSTOM | no | LTTB-style decimation pre-TanStack; TS-check: none — no LTTB/decimation utility anywhere in repo (grep clean) |
| `resolveTimeSeriesYDomain` + nice | util fn | BKLIT | CUSTOM | maybe | Shared y-domain policy ([0,max×1.1] / ±5% pad / [0,100]); TS-check: partial — axis `nice: boolean|number` option nicens resolved domain; ×1.1/±5% policy custom |
| `xForIndex` / `xScaleForReanchor` linear time→px mapping | util fn | BKLIT | CUSTOM | no | Custom invertible scale for hover re-anchor (D4 fix); TS-check: partial — ResolvedScale.invert maps px→value natively; index-based re-anchor math custom |
| Manual projection-tail x-scale (`scaleUtc` wrapper in spec) | util fn | BKLIT | CUSTOM-ON-TS | maybe | Custom `ChartScale.resolve` only when projections present; TS-check: native — passing configured scale instance to spec `x.scale` is documented usage |
| `XAxisOverlay` / `YAxisOverlay` | overlay | BKLIT | CUSTOM | maybe | HTML overlays positioned off measured rect; TS-check: partial — native axis tickLabels (format/rotate/dx/dy/thinning) cover SVG labeling; HTML-overlay positioning custom |
| `ReferenceAreaLayers` / tick-color resolver | overlay | BKLIT | CUSTOM-ON-TS | no | TS-check: partial — rect x1/x2/y1/y2 mark covers reference bands; bracket/mask/pattern extras custom |
| `SegmentOverlay` | overlay | BKLIT | CUSTOM-ON-TS | no | Consumes selection context; TS-check: partial — link mark draws styled dashed/curved segments; selection-driven gradient variant custom |
| `ProjectionMarkerOverlay` (+ phase port ref) | overlay | BKLIT | CUSTOM | no | Imperative phase consumption; TS-check: partial — dot mark covers endpoint markers; phase-port consumption custom |
| `DashTailOverlay` | overlay | BKLIT | CUSTOM | no | TS-check: none — no native tail-region construct; strokeDasharray alone insufficient |
| `ChartMarkersOverlay` | overlay | BKLIT | CUSTOM | no | Uses d3 `scaleUtc` ref for x positions; TS-check: partial — dot mark + dodge layouts cover placed markers; HTML fan layout custom |
| `LoadingLabel` | component | BKLIT | CUSTOM | no | Shimmer label while loading; TS-check: none — no loading/skeleton concept in source |
| Empty-spec loading definition (no marks, grid guide only) | component | BKLIT | TS-NATIVE | yes | `defineChart` with empty marks during loading; TS-check: native — defineChart({marks:[]}) valid; guides render independently |
| `data-bkm-chart="area"` | CSS class | BKLIT | CUSTOM | no | Container attribute scoping styles.css; TS-check: none — app scoping convention; Chart className/style props exist but attribute is app-side |
| `data-bkm-fade-edges` (+ `-left`/`-right`) | CSS class | BKLIT | CUSTOM | maybe | Mask-image edge fade; set only when ALL areas fadeEdges===true; TS-check: none — no mask-image/filter hook in scene/renderers (grep clean) |
| `.ts-chart__marks` / `.ts-chart__dot[data-ts-key]` / `.ts-chart__area` | CSS class | TANSTACK | CUSTOM | no | Queried for reveal; `.ts-chart__area` emitted by patternAreaMark; TS-check: CONTRADICTS no — all three natively emitted (scene.ts:461, dot.ts:230, area.ts:233) |
| `.chart-projection-line` | CSS class | BKLIT | CUSTOM | no | Projection path styling; TS-check: partial — SceneNode.className lets custom marks emit arbitrary classes |
| `.ts-bkm-loading-label*` | CSS class | BKLIT | CUSTOM | no | Via LoadingLabel; TS-check: none |
| `[data-bkm-chart] .ts-chart__grid line` styling | CSS class | BKLIT | CUSTOM | no | Grid guide stroke/dash; TS-check: partial — x.grid/y.grid emit `.ts-chart__grid` (scene.ts:1114) + theme.grid color; per-line dash styling still CSS-side |

## Imports

Internal modules imported by `area-chart.tsx`: `area-fill-mark`, `pattern-preset`, `decimate`, `use-hover-chrome`, `reference-area-layer`, `reference-area-config`, `reference-area-geometry`, `chart-selection`, `segment-visuals`, `projection-config`, `projection-line-mark`, `terminal-marker`, `coerce-date`, `x-axis-overlay`, `y-axis-overlay`, `types`, `chart-phase`, `parse-aspect-ratio`, `bezier-easing`, `grid`, `loading-chrome`, `chart-legend-hover`, `internal` barrel (`useChartMargin`, `useMeasuredRect`), `y-domain`, `use-chart-phase-orchestrator`, `brush-selection`, `brush-drag`, `dash-tail`, `series-marker-mark`, `chart-markers`, `styles.css`.
Imported by `pattern-area-mark.ts`: `types`.
Non-internal: `./children` (children add-on part; supplies `extractChildren`). Note: `area-fill-mark`, `pattern-preset` are owned by internal-foundation per taxonomy but consumed here.

## Deviations

- `animationEasing` prop accepted but silently ignored (fixed `REVEAL_EASING` used for both clip-reveal and marker stagger).
- `showMarkers`/`markers` read through untyped casts in `resolvedAreas`; not declared on `AreaConfig` in `internal/types.ts` — works but is type-unsafe.
- `fadeEdges: "left" | "right"` accepted but never applied: container only sets `data-bkm-fade-edges` when every area has `fadeEdges === true` (D13c precedent); directional CSS rules exist but are unreachable from this chart.
- Legacy `touchAction: "none"` on the container is not reproduced (only live-line/choropleth set it in migrated).
- Loading pulse/sweep chrome (`LineLoadingPulseStroke`, `LineLoadingSweep`, `LINE_LOADING_LOOP_PAUSE_MS`) intentionally not ported; loading renders an empty grid + shimmer label.
- `areaFill` custom mark replaces TanStack `areaY` — documented G4 workaround (heap 19% over bklit at n=1000 due to duplicate focus geometry).
- Comment flags the D4 parity fix: `xScaleForReanchor` was previously missing, silently no-op'ing hover re-anchor.
- `enterTransition`/`revealSignature` dropped; orchestrator hardcodes `revealSignature: ""`.
- Heavy inline duplication of projection/terminal-anchor math (also present in line/composed charts) — candidate for shared extraction, noted for the usage-matrix.
