# composed — Phase 4 Research Report

**Files:** `showcase/migrated/charts/composed-chart.tsx`, `showcase/migrated/charts/internal/series-bar-layout.ts`, `showcase/migrated/charts/internal/series-bar-mark.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/composed-chart.tsx`, `repos/bklit-ui/packages/ui/src/charts/series-bar.tsx`, `repos/bklit-ui/packages/ui/src/charts/series-bar-layout.ts`

## Feature summary

Time-axis composed chart combining SeriesBar rects (RAW data), Area fills+boundaries and Line strokes (both LTTB-decimated `renderData`) in one shared x/y frame, layer order bars UNDER area UNDER line. Child-config API (`<SeriesBar>/<Area>/<Line>/<Grid>/<XAxis>/<Tooltip>/…`) extracted in document order with bklit's upsert-per-dataKey merge. Reveal is double: shared percentage clip-path wipe plus an independent per-bar WAAPI grow-from-baseline stagger; hover replicates bklit's `resolveTooltipFromX` double bisector driving the shared imperative hover chrome.

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `ComposedChart` | component | same | No `displayName` set (legacy sets `"ComposedChart"`). |
| `ComposedChartProps` | type export | same | Local `Margin` shape `{top,right,bottom,left}` matches legacy. |
| default export | — | missing | Legacy `export default ComposedChart`; migrated has named export only. |
| `data` | `ChartDatum[]` | same | |
| `xDataKey` | `string?` | same | Default `"date"` both sides. |
| `margin` | `Partial<Margin>?` | same | Default `{40,40,40,40}` both sides. |
| `animationDuration` | `number?` | same | Default 1100 both sides. |
| `animationEasing` | `string?` | missing | Legacy prop; migrated hardcodes `REVEAL_EASING`. |
| `enterTransition` | `Transition?` | missing | Legacy motion/react transition passthrough. |
| `revealSignature` | `string?` | missing | Legacy reveal-replay trigger; migrated wires `""` into orchestrator. |
| `aspectRatio` | `string?` | same | Default `"2 / 1"` both sides. |
| `className` | `string?` | same | Legacy merges via `cn("relative w-full", …)`; migrated applies verbatim + inline styles. |
| `onPhaseChange` | `(phase)=>void?` | same | External "ready" held back until bars stagger deadline (`duration*1.4`). |
| `barSize` | `number?` | same | Target bar width px. |
| `maxBarSize` | `number?` | same | Width clamp. |
| `barGap` | `number?` | same | Default 4 both sides. |
| `stacked` | `boolean?` | same | Accepted for surface parity; ALWAYS renders unstacked (documented pilot deviation). |
| `stackGap` | `number?` | missing | File header claims accepted-for-parity but the interface omits it entirely. |
| `children` | `ReactNode` | same | Config-carrier children (roles extracted, not rendered). |
| `computeSeriesBarWidth` | fn (`internal/series-bar-layout`) | same | Verbatim port of legacy `series-bar-layout.ts`. |
| `computeSeriesBarRevealClipPadding` | fn (`internal/series-bar-layout`) | same | Verbatim port; kept for docs/parity, unused at runtime. |
| `seriesBarMark` | fn (`internal/series-bar-mark`) | renamed | Custom TanStack mark replacing legacy `<SeriesBar>` render path (stock `barY` bandwidth formula diverges). |
| `SeriesBarMarkOptions.id/xAccessor/yAccessor` | options | renamed | From legacy `dataKey`; accessors injected by parent instead of context. |
| `SeriesBarMarkOptions.fill` | option | same | Same fallback chain upstream (`fill ?? DEFAULT_COLOR`). |
| `SeriesBarMarkOptions.radius` | option | same | Default 0 both sides. |
| `SeriesBarProps.stroke` | legacy prop | missing | Mark emits `fill` only; tooltip-dot color concept dropped (chrome derives color from merged series stroke). |
| `SeriesBarProps.animate` | legacy prop | missing | Reveal handled by WAAPI stagger in `composed-chart.tsx handleRender`. |
| `SeriesBarProps.fadedOpacity` | legacy prop | renamed | Surfaced via chrome state `bars[].fadedOpacity` (hover-chrome), not per-rect motion opacity. |
| `groupDataKeys/seriesIndex/barGap/barSize/maxBarSize` options | options | extra | Injected from `ComposedChart` props; legacy read equivalents from chart context. |
| `SeriesBarMarkOptions` | type export | extra | No legacy type counterpart (legacy `SeriesBarProps` is the analogue). |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_ANIMATION_DURATION_MS = 1100` | constant | BKLIT | CUSTOM | no | bklit animation.ts reveal duration.; TS-check: CONTRADICTS no — native defaultDuration 1100 (charts-core motion.ts). |
| `REVEAL_EASING` cubic-bezier(0.85, 0, 0.15, 1) | constant | BKLIT | CUSTOM | no | WAAPI easing string.; TS-check: CONTRADICTS no — native defaultEasing cubicBezier(.85,0,.15,1) (motion.ts). |
| `DATA_TWEEN_MS = 500` | constant | BKLIT | CUSTOM | no | bklit chart-phase DEFAULT_Y_DOMAIN_TWEEN_MS; drives `svgAnimation.duration`.; TS-check: none |
| `DEFAULT_COLOR = var(--chart-line-primary)` | constant | BKLIT | CUSTOM | no | Bottom of every role's stroke/fill chain.; TS-check: none |
| `DEFAULT_BAR_GAP = 4` | constant | BKLIT | CUSTOM | no | ; TS-check: partial — group({padding}) is ratio-based, lacks fixed-px gap |
| `DEFAULT_MARGIN {40,40,40,40}` | constant | BKLIT | CUSTOM | no | ; TS-check: none — spec.margin exists but no 40px default |
| Role stroke-fallback chains + width defaults | constant | BKLIT | CUSTOM | no | Bar: `stroke‖fill‖DEF`, sw 0; Area: sw 2, fillOpacity 0.4; Line: `stroke‖DEF` (no fill fallback), sw 2.5; bar fadedOpacity 0.3.; TS-check: none |
| Bar-width ratios `slot×0.88`, `maxGroup slot×0.92`, clamps min 2 / min 4 | constant | BKLIT | CUSTOM | no | In `series-bar-layout.ts`; exact bklit math (D82, ME-16).; TS-check: partial — barY inferBandwidth ×0.8/maxThickness lacks bklit ratios |
| Stagger math: spread=`dur×0.4`, deadline=`dur×1.4`, delay=spread/1000/n | constant | BKLIT | CUSTOM | no | Mirrors bar-chart.tsx formulas; drives settle contract.; TS-check: CONTRADICTS no — native auto-delay dur×0.4×i/n (motion.ts) + stagger() |
| Clip wipe `inset(0 100% 0 0)` → `inset(0 0 0 0)` | constant | BKLIT | CUSTOM | no | Percentage clip reproduces padded bar-overhang reveal without a padded clip-rect.; TS-check: none — native motion grows bars/paths, no clip wipe |
| Area gradient stops 0%@fillOpacity → 100%@0 | constant | BKLIT | CUSTOM | no | Same technique/defaults as area-chart.tsx; mark `fillOpacity` forced to 1.; TS-check: CONTRADICTS no — native spec.gradients ChartLinearGradient stops+opacity |
| Terminal-marker defaults r=5, strokeWidth=1.5, ringGap=0, `--chart-1` | constant | BKLIT | CUSTOM | no | In `composedTerminalAnchors`.; TS-check: partial — crosshair marker/dot mark lack ring-gap defaults |
| Projection-end defaults r=5, edge pad r+1, `--chart-3`, gradientEnd `--chart-5`, dash `"6,4"` | constant | BKLIT | CUSTOM | no | In `composedEndAnchors` / projection defs.; TS-check: none |
| `useChartPhaseOrchestrator` | hook | BKLIT | CUSTOM | no | Phase state machine (loading→revealing→ready→tweens); `chartStatus` fixed `"ready"`, `revealSignature:""`.; TS-check: none |
| `useChartMargin` + `useDebouncedContainerWidth` | hook | TANSTACK | CUSTOM-ON-TS | maybe | Container sizing replaces visx `ParentSize debounceTime={10}`.; TS-check: partial — Chart auto-sizes via ResizeObserver (renderer.ts), lacks debounce |
| `useChartConfig` | hook | BKLIT | CUSTOM | no | Consumes ChartConfigContext for tooltip springs.; TS-check: none — native tooltip motion is renderer-internal, no spring config API |
| `useChartLegendHover` | hook | BKLIT | CUSTOM | no | Legend-hover dimming index.; TS-check: none — interactiveColorLegend toggles visibility, no hover-dim index |
| `ChartSelectionContext.Provider` + `useChartSelection` | context | BKLIT | CUSTOM | no | Drag-brush selection provided to SegmentOverlay.; TS-check: CONTRADICTS no — native brushX (@tanstack/charts/interaction/brush) drag selection |
| `resolveTimeSeriesYDomain` + `useNicedYDomainChanged` | util fn + hook | BKLIT | CUSTOM | maybe | Scans ALL merged series (incl. bar shim) over RAW data; niced base then projection merge (left-merge, fabricated [0,100] union).; TS-check: partial — scale-input nice()/axis.domain cover nicening, lack multi-series+projection merge |
| `React.useId` sanitized | hook | TANSTACK | TS-NATIVE | yes | Gradient/projection gradient id bases.; TS-check: native — React.useId; TanStack idPrefix does same sanitize (RendererChart.tsx) |
| `matchMedia("(prefers-reduced-motion: reduce)")` reads | util fn | BKLIT | CUSTOM | maybe | One-shot reads (×2 sites), no listener.; TS-check: native — motion respectReducedMotion reads same media query (motion.ts) |
| WAAPI `marks.animate` clip-path wipe | overlay | BKLIT | CUSTOM | no | Fired once, gated `chartPhase==="revealing"` && !revealed && dur>0 (D-composed-settle-regression).; TS-check: none — native motion animates geometry/transform, never clipPath wipe |
| WAAPI per-rect grow-from-baseline stagger | overlay | BKLIT | CUSTOM | no | `rectEl.animate({height,y})` with delay `i*staggerDelaySec`, `fill:"backwards"`; animations tracked + cancelled on unmount.; TS-check: CONTRADICTS no — native createBarTracks grows y/height from baseline w/ auto-stagger (motion.ts) |
| Direct DOM mutation `dataset.bkmRevealed`, `style.clipPath` | util fn | BKLIT | CUSTOM | no | Idempotent-reveal guard on `.ts-chart__marks`.; TS-check: none |
| DOM queries `.ts-chart__marks`, `.ts-chart__bar-y[data-ts-key="…"]`, `querySelectorAll("rect")` | util fn | BKLIT | CUSTOM | no | Selector contract into TanStack-rendered scene.; TS-check: native — selectors target TanStack's own emitted classes/data-ts-key |
| `pointermove`/`pointerleave` listeners on container | util fn | BKLIT | CUSTOM | no | Deliberate replacement of TanStack focus system (scatter pattern); drag-suppression via ref.; TS-check: partial — focus system + onFocusGroupChange cover hover natively; drag-suppression is custom |
| `svg.getBoundingClientRect()` per move | util fn | BKLIT | CUSTOM | no | Pixel→time inversion input.; TS-check: partial — surface.clientToScene does this natively (svg-coordinates) |
| `onPostPaint` + `setRevealDeadline` timer | util fn | BKLIT | CUSTOM | no | deferred-reveal; deadline cancels anims and releases held-back external "ready".; TS-check: partial — motion runTracks exposes finish/data-ts-motion-state, lacks external deadline hook |
| `projectionPhasePortRef.setPhase` imperative port | util fn | BKLIT | CUSTOM-ON-TS | no | Overlay mirrors orchestrator phase.; TS-check: none |
| `seriesBarMark` | mark | BKLIT | CUSTOM-ON-TS | maybe | `createMark` emitting `kind:'rect'` SceneNodes + ChartPoints; bklit width/group layout, not stock `barY`.; TS-check: partial — barY+group()/maxThickness close but bandwidth ×0.8 ≠ slot×0.88 (ME-16) |
| `areaFill` mark | mark | TANSTACK | TS-NATIVE | yes | Fill layer emitted before boundary (layering rule).; TS-check: partial — areaY is native but allocates per-datum ChartPoints (G4); custom mark avoids it |
| `lineY` marks | mark | TANSTACK | TS-NATIVE | yes | Area boundaries reuse Line mark ids for hover-chrome lookups.; TS-check: native — lineY export with stroke/strokeWidth/curve/dash options |
| Custom `ChartScale` x (`scaleUtc`, full range, no inset) | util fn | BKLIT | CUSTOM-ON-TS | yes | Linear-scan min/max perf rewrite; ISO-string tick labels; d3 instance stashed in ref for bisector (D110).; TS-check: partial — axis type 'time'/'utc' + format option native, lacks projection-extended domain + invert stash |
| Custom `ChartScale` y (`scaleLinear` over niced+merged domain) | util fn | BKLIT | CUSTOM-ON-TS | yes | Tick count falls back to `resolveGridGuide(grid).ticks`.; TS-check: partial — axis domain+nice native (@tanstack/charts scales/linear), lacks merged multi-series domain |
| `defineChart` opts: `focus:"group-x"` (inert callback), `focusRing:false`, `maxFocusDistance:Infinity`, `svgAnimation:{500ms,bezierEasing}` gated on yDomain change | util fn | BKLIT | CUSTOM-ON-TS | yes | Phase/isLoaded read via refs, excluded from memo deps (pixel mandate).; TS-check: native — focus:'group-x'/focusRing/maxFocusDistance/svgAnimation all defineChart options |
| `decimateTimeSeries`/`maxRenderPointsForWidth` | util fn | BKLIT | CUSTOM | no | LTTB; asymmetry preserved: bars RAW, area/line decimated with FULL merged valueKeys.; TS-check: none — no decimation/downsampling anywhere in v0.14.0 |
| `extractComposed` + `upsertComposedSeries` | util fn | BKLIT | CUSTOM | no | Role walker (via `roleOf` from `children.tsx`); one upserted entry per dataKey; Fragment-recursing (legacy `Children.forEach` is flat).; TS-check: none |
| Double bisect `resolveNearestIndex` | util fn | BKLIT | CUSTOM | maybe | Per move: RAW (tooltip/bar fade) + decimated (highlight band `datumIndex`); indices intentionally diverge.; TS-check: partial — focusGroupX/createInteractionAxis bisect natively, lack RAW+decimated dual-index split |
| `projectionLineMark` + `resolveProjectionGradientDef` + `ProjectionMarkerOverlay` | mark + overlay | BKLIT | CUSTOM-ON-TS | no | Extended x-domain anchors computed manually; defs SVG rendered after `<Chart>`.; TS-check: partial — spec.gradients userSpaceOnUse-style stops native, but projection math/edge-clamped markers custom |
| `XAxisOverlay` / `ReferenceAreaLayers` / `SegmentOverlay` | overlay | BKLIT | CUSTOM | no | Conditional on extracted child configs.; TS-check: partial — native axes/ticks, bandX/bandY rects, brushX selection cover each overlay's core |
| `attachHoverChrome` imperative overlay | overlay | BKLIT | CUSTOM | no | Shared with Line/Area; single chart-wide dimOpacity (Line's 0.3).; TS-check: partial — mark states ({focus:'group',opacity}) + crosshair cover dimming/guides, not bklit chrome DOM |
| `data-bkm-chart="composed"` attribute | CSS class | BKLIT | CUSTOM | no | Styles.css scope root.; TS-check: none |
| `.ts-chart__marks` selector | CSS class | TANSTACK | TS-NATIVE | yes | Wipe target; also `--revealing` variant styled in styles.css.; TS-check: native — emitted by svg-renderer for marks group |
| `.ts-chart__bar ts-chart__bar-y` group classNames + `[data-ts-key]` | CSS class | TANSTACK | CUSTOM-ON-TS | yes | Emitted by seriesBarMark so the stagger finds rects.; TS-check: native — stock barY emits same classes (bar.ts); data-ts-key from node key |
| `.chart-projection-line` class | CSS class | BKLIT | CUSTOM | no | Styled at styles.css:1030.; TS-check: none |
| Local types `ComposedSeriesEntry`/`ExtractedComposed`/`Resolved{Bar,Area,Line}` | type | BKLIT | CUSTOM | no | Extraction/resolution shapes mirroring legacy `lines`+`barDataKeys`.; TS-check: none |

## Imports

`internal/` modules imported by the part's files:

- `internal/area-fill-mark`
- `internal/series-bar-mark` (part-internal) → itself imports `internal/series-bar-layout` (part-internal) + `internal/types`
- `internal/decimate`
- `internal/hover-chrome`
- `internal/reference-area-layer`, `internal/reference-area-config`
- `internal/chart-selection`, `internal/segment-visuals`
- `internal/chart-config-context`
- `internal/chart-legend-hover`
- `internal/x-axis-overlay`
- `internal/projection-config`, `internal/projection-line-mark`, `internal/terminal-marker`
- `internal/types`
- `internal/chart-phase`
- `internal/parse-aspect-ratio`
- `internal/bezier-easing`
- `internal/deferred-reveal`
- `internal/index.ts` barrel (`useChartMargin`, `useDebouncedContainerWidth`)
- `internal/y-domain`
- `internal/bisect`
- `internal/coerce-date`
- `internal/grid`
- `internal/use-chart-phase-orchestrator`
- Non-internal: `./children` (`roleOf`), `./styles.css` (side-effect import)

## Deviations

- `stacked` accepted but ALWAYS rendered unstacked — legacy `computeComposedYScaleDomainMax` stacked-sum branch never invoked (documented pilot scope).
- `stackGap` absent from `ComposedChartProps` even though the file header claims "stacked/stackGap are accepted for prop-surface parity" — comment/interface mismatch.
- Missing legacy props: `animationEasing`, `enterTransition`, `revealSignature`; missing default export; no `displayName`.
- `dimOpacity` is chart-wide in hover chrome; legacy hardcodes 0.6 (Area) vs 0.3 (Line) per-series — keeps Line's 0.3.
- Composed's `<Area>` ignores `fadeEdges`.
- `computeSeriesBarRevealClipPadding` is dead code at runtime (kept for parity/documentation).
- `onFocusGroupChange` deliberately inert; hover driven by own pointermove listeners.
- `definition` memo reads phase/isLoaded via refs, not deps (pixel-settle regression fix); external `onPhaseChange("ready")` deferred to `duration×1.4` bars deadline.
- Legacy stored `yAxisId` per line entry during extraction; migrated drops it (projections handled via separate role extraction).
- Suspicious duplication: terminal-anchor/end-anchor/gradient-def memos hand-roll the same extended-x pixel mapping (`xForDate`) three times.
