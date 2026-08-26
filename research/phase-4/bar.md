# bar — Phase 4 Research Report

**Files:** `showcase/migrated/charts/bar-chart.tsx`; `showcase/migrated/charts/internal/bar-{column-track-mark,depth-geometry,depth-marks,focus-strategy,hover-chrome,pulse-mark,pulse-overlay,squares-layout,squares-mark,trimmed-mark,x-axis-overlay}.*`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/{bar-chart.tsx,bar.tsx,bar-squares.tsx,bar-squares-layout.ts,bar-depth.tsx,bar-depth-geometry.ts,bar-x-axis.tsx,bar-y-axis.tsx,bar-chart-loading.tsx}`

## Feature summary

Vertical grouped bar chart: per-series `barY()` marks laid out by TanStack's `group({ scale })` over a nested d3 `scaleBand` reproducing bklit's `individualBarWidth`/fixed-4px-group-gap math. Composable child layers — Bar, BarSquares (quantized square columns), BarColumnTrack (full-height underlay track), BarDepth Back/Front/Pulse (3D side/lid/glass surfaces), BarXAxis (HTML label overlay) — plus a 1100ms staggered WAAPI grow-from-baseline mount reveal and a DOM hover chrome (crosshair, dots, box, date pill, per-category-index dimming) driven by a custom band-index TanStack focus strategy. Pilot scope: vertical + grouped only (no stacked/horizontal/barWidth/squareSnap/loading-status branches).

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `BarChart` | component | same | Config-carrier children compiled into `defineChart` spec |
| `data` | `ChartDatum[]` | same | |
| `xDataKey` | `string` (default `"name"`) | same | |
| `animationDuration` | `number` (default 1100) | same | |
| `margin` | `Partial<Margin>` | same | Default `{40,40,40,40}` matches |
| `aspectRatio` | `string` (default `"2 / 1"`) | same | |
| `className` | `string` | same | |
| `barGap` | `number` (default 0.2) | same | Feeds band `padding` |
| `onPhaseChange` | `(phase) => void` | same | revealing→ready lifecycle preserved |
| `children` | `ReactNode` | same | Role-marker extraction replaces displayName sniffing |
| `animationEasing` | `string` | missing | Easing hardcoded to `cubic-bezier(0.85,0,.15,1)` |
| `enterTransition` | `Transition` | missing | Reveal tween is fixed WAAPI |
| `revealSignature` | `string` | missing | Replay keyed by data identity instead |
| `barWidth` | `number` | missing | Out of pilot scope |
| `orientation` | `"vertical" \| "horizontal"` | missing | Vertical only (pilot scope) |
| `stacked` | `boolean` | missing | Out of pilot scope |
| `stackGap` | `number` | missing | Out of pilot scope |
| `squareSnap` | `{squareGap; groupGap?; fit?}` | missing | Out of pilot scope |
| `status` | `ChartStatus` | missing | Loading-skeleton branch not migrated |
| `<Bar>` child | component | same | Props covered below |
| `Bar.dataKey` | `string` | same | |
| `Bar.fill` | `string` (default `var(--chart-line-primary)`) | same | |
| `Bar.stroke` | `string` | same | Dot color = `stroke ?? fill` |
| `Bar.lineCap` | `"round" \| "butt" \| number` | same | radius = `min(barWidth/2, 8)` preserved |
| `Bar.fadedOpacity` | `number` (default 0.3) | same | |
| `Bar.yAxisId` | `string \| number` | missing | Single y scale only |
| `Bar.animate` | `boolean` | missing | Always animated |
| `Bar.animationType` | `"grow" \| "fade"` | missing | Grow only |
| `Bar.staggerDelay` | `number` | missing | Auto-derived (`duration*0.4/count`) |
| `Bar.stackGap` | `number` | missing | |
| `Bar.groupGap` | `number` | missing | Fixed at 4 (`GROUP_GAP`) |
| `Bar.perspective` | `boolean` | missing | Trim applied automatically when depth layers present |
| `Bar.minBarHeight` | `number` | missing | |
| `BarProps` (type) | interface | renamed | Exported as `BarConfig` (pilot subset) |
| `<BarSquares>` child | component | same | 13/14 props: `dataKey, fill, stroke, squareGap(3), squareRadius(0.25), squareFit, useGradient, gradientStops, patternPreset, animate, fadedOpacity(0.3), staggerDelay, groupGap(4)` all same |
| `BarSquares.yAxisId` | `string \| number` | missing | |
| `<BarColumnTrack>` child | component | same | All 7 props same: `fill(var(--chart-grid)), opacity(0.3), squareGap(3), squareRadius(0.25), groupGap(4), squareFit, staggerDelay` |
| `<BarDepthProvider>` child | component | same | `groundShadow` consumed; see Deviations for inert props |
| `BarDepthProvider.groundShadow` | `number` (default 0.26) | same | Drives glass stop lists |
| `BarDepthProvider.segmentsAccessor` | fn | same | Accepted in config; **unused** by host |
| `BarDepthProvider.minBarHeight` | `number` | same | Accepted in config; **unused** by host |
| `<BarDepthBack>` child | component | same | |
| `BarDepthBack.dataKey` | `string` | same | Pairs with sibling Bar |
| `BarDepthBack.color` | `string` | same | Falls back to series fill |
| `BarDepthBack.colorAccessor` | fn | same | Accepted in config; **unused** by host |
| `<BarDepthFront>` child | component | same | |
| `BarDepthFront.dataKey` | `string` | same | |
| `<BarPulse>` child | component | same | |
| `BarPulse.dataKey` / `activeIndex` / `pulsePaused` | — | same | All three forwarded to mark |
| `<BarXAxis>` child | component | same | |
| `BarXAxis.showAllLabels` / `maxLabels(12)` | — | same | Modulo thinning preserved |
| `BarXAxis.tickerHalfWidth` | `number` (default 50) | same | Accepted in config; **not forwarded** (chrome uses token 50) |
| `BarYAxis` | component | missing | No migrated equivalent at all |
| `BarChartLoading` | component | missing | `status="loading"` shortcut not migrated |
| `useBarDepthEntries` | hook | missing | Geometry inlined per-mark instead |
| `computeSquareColumn` / `topSquareCenterY` | util fn | missing | Demoted to `internal/` (still exported via internal barrel; `topSquareCenterY` unconsumed) |
| `BarOrientation` (type) | union | missing | |
| `BarAnimationType` (type) | union | missing | |
| `BarLineCap` (type) | union | missing | Inlined into `BarConfig["lineCap"]` |
| `BarDepthEntry` (type) | interface | missing | |
| `BarDepthSegment` (type) | interface | missing | |
| `GradientStop` (public, bar-squares) | interface | missing | Exists in `internal/types.ts` only |
| `SquareColumnLayout` / `SquareColumnInput` (types) | interface | missing | Internal-only |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `BarChart` host component | component | BKLIT | CUSTOM-ON-TS | maybe | `<Chart>` + `defineChart` spec host; TS-check: native — Chart (react-charts), defineChart (charts-core) |
| `DEFAULT_ANIMATION_DURATION_MS = 1100` | constant | BKLIT | CUSTOM | no | bklit bar-chart default; TS-check: none |
| `REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)"` | constant | BKLIT | CUSTOM | no | `DEFAULT_CHART_ENTER_TRANSITION` easing; TS-check: none |
| `GROUP_GAP = 4` | constant | BKLIT | CUSTOM | no | bklit `BarInner` default `groupGap`; TS-check: none — group({padding}) fractional, not px-gap |
| `DEFAULT_BAR_FILL = "var(--chart-line-primary)"` | constant | BKLIT | CUSTOM | no | Fixed color, not rotating palette; TS-check: none — native default rotates theme.palette |
| `DEFAULT_MARGIN {40,40,40,40}` | constant | BKLIT | CUSTOM | no | TS-check: none |
| `resolveCornerRadius` (`min(bandWidth/2, 8)`) | util fn | BKLIT | CUSTOM | no | butt→0, number passthrough; TS-check: none — barY radius static, no min(w/2,8) helper |
| x/y scale **factories** (C2) | util fn | TANSTACK | TS-NATIVE | yes | TanStack applies margin-inclusive range; TS-check: native — ChartAxisOptions.scale factory (charts-core) |
| `barY(data, {...})` + `layout: group({ scale })` | mark | TANSTACK | TS-NATIVE | yes | One mark per series; TS-check: native — barY + group() (charts-core) |
| `groupScale` nested `scaleBand` paddingInner derivation | util fn | BKLIT | CUSTOM-ON-TS | maybe | Algebraic proof bandwidth == bklit `individualBarWidth`; TS-check: partial — group({padding}) fractional only, fixed-px gap needs custom scale |
| y domain `[0, maxValue*1.1]` + `createNicedYScale` | util fn | BKLIT | CUSTOM-ON-TS | maybe | Pre-domained instance to keep headroom+nice; TS-check: partial — axis nice native (ChartAxisOptions.nice); ×1.1 headroom custom |
| `bandWidth` local ranged-clone measurement | util fn | CUSTOM | CUSTOM | maybe | Workaround: unranged factory has no `.bandwidth()`; TS-check: partial — scene.scales.x.bandwidth exists (onRender), not pre-layout |
| `categoryScaleForOverlay` ranged clone | util fn | CUSTOM | CUSTOM | maybe | Single source of band truth for overlay/anchor; TS-check: partial — scene.scales.x usable post-render; overlay still clones pre-render |
| Mount reveal per-bar WAAPI grow tween | side-effect: WAAPI + DOM | BKLIT | CUSTOM | no | Deferred past paint via `onPostPaint`; height/y keyframes only; TS-check: none — native svgAnimation enter is opacity-fade only |
| Squares cascade reveal (column-major, x-attr bucketing) | side-effect: WAAPI + DOM | BKLIT | CUSTOM | no | Per-rect delay = col·stagger + sq·cascadeStep; TS-check: none — stagger() delays only, no per-rect keyframes |
| Column-track reveal (collapse from baseline) | side-effect: WAAPI | BKLIT | CUSTOM | no | height `baselineH+targetH → targetH` at y=0; TS-check: none — native enter tween is opacity-only |
| `dataset.bkmRevealed` stamp + data-identity ref guard | side-effect: DOM | CUSTOM | CUSTOM | no | Marks-group recreation replay guard (D214); TS-check: none |
| `.ts-chart__marks--revealing` | CSS class | CUSTOM | CUSTOM | no | styles.css: hides marks group until tween setup; TS-check: none — native has ts-chart__marks but no revealing variant |
| Phase lifecycle (phaseRef, unconditional first "revealing", deadline timer) | hook | BKLIT | CUSTOM | no | Deadline = duration + 40% stagger spread; TS-check: none — onRender exists, phase lifecycle is app-owned |
| Unmount teardown (cancel deadline/post-paint/animations) | side-effect | CUSTOM | CUSTOM | no | D205 canonical wording; TS-check: none — app-owned effect cleanup |
| `defineChart(base, { focus, focusRing: false, maxFocusDistance: Infinity })` | util fn | TANSTACK | TS-NATIVE | yes | Custom strategy via public focus API; TS-check: native — defineChart options + ChartFocusStrategy (charts-core) |
| `handleFocusGroupChange` → `BarFocusGroup` adapter | hook | CUSTOM | CUSTOM-ON-TS | maybe | Band-center anchor from clone; per-series dot x from `ChartPoint.x`; TS-check: partial — onFocusGroupChange native (Chart), adapter mapping custom |
| `dateLabelsForPill` inline `toLocaleDateString` | util fn | BKLIT | CUSTOM | maybe | Duplicates `shortDateFmt` (see Deviations); TS-check: none — tooltip formatValue is ISO/locale-number, not short-date |
| squaresDefs hidden `<defs>` svg (`userSpaceOnUse`, y 0→100) | overlay | BKLIT | CUSTOM | no | Per-series linearGradient + optional pattern preset; TS-check: CONTRADICTS no — partial native spec.gradients (ChartLinearGradient) lacks pattern presets |
| depthDefs `<defs>` (objectBoundingBox glass/shade ramps) | overlay | BKLIT | CUSTOM | no | Built once per chart, not per bar; TS-check: CONTRADICTS no — partial native spec.gradients (default objectBoundingBox); id-scoping/pattern wiring custom |
| `svgAnimation: false` spec flag | constant | TANSTACK | TS-NATIVE | yes | Disables TanStack's own svg intro; TS-check: native — svgAnimation option (ChartDefinitionOptions) |
| `createBarFocusStrategy` (band-index division `floor((x−ml)/colWidth)`) | util fn | BKLIT | CUSTOM-ON-TS | maybe | TanStack `ChartFocusStrategy` iface, bklit math inside; TS-check: partial — ChartFocusStrategy native, band math custom (no band preset) |
| `valueKey` / `collectPerGroup` helpers | util fn | CUSTOM | CUSTOM | no | Group dedupe + y-sort; TS-check: none — focus.ts groupPoints does similar internally, unexported |
| Interaction gating via `isChartInteractionPhase(phaseRef)` | hook | BKLIT | CUSTOM | no | Returns [] before "ready"; TS-check: none — no phase concept natively |
| `attachBarHoverChrome` (crosshair/dots/box/pill) | overlay | BKLIT | CUSTOM | no | Appends 4 layers to host; no pointer listeners (C1); TS-check: partial — crosshair() mark + native tooltip cover rule/dots/box; date-pill custom |
| Dim transitions `opacity 0.15s ease-in-out` / `-out` ×3 | constant | BKLIT | CUSTOM | no | Bars/squares/track/depth variants; TS-check: partial — mark states tween opacity natively (ChartMarkState.transition); 0.15s timing custom |
| Per-row dim via `querySelectorAll` + `style.opacity` | side-effect: DOM | BKLIT | CUSTOM | no | Category-index dimming incl. legend-hover sync; TS-check: CONTRADICTS no — partial native ChartMarkState when:{focus:'unmatched'}+opacity; no per-category-index dimming |
| `data-ts-key` regex dim parsing (`:sq:N:`, `:(side\|lid):N`, `:glass:N`) | side-effect: DOM | CUSTOM | CUSTOM | no | Couples mark keys to frozen chrome regexes; TS-check: none |
| tooltip-chrome builders (indicator/dotLayer/box/pill + springs) | overlay | BKLIT | CUSTOM-ON-TS | maybe | Shared internal-interaction modules; TS-check: partial — native tooltip + createChartSpring exist; bklit box/pill layout custom |
| Design tokens: `BOX_OFFSET 16`, `DISCRETE_INTERACTION_THRESHOLD 60`, `TICKER_HALF_WIDTH 50`, `FADE_BUFFER 20`, `TOOLTIP_SPRING {300,30}`, `TOOLTIP_BOX_SPRING {100,20}` | constant | BKLIT | CUSTOM | no | Consumed from design-tokens; TS-check: none — spring params feed native createChartSpring but values are bklit's |
| `toDotConfig` ring sizing (`squareSize/2 · dotScale`) | util fn | BKLIT | CUSTOM | no | Inline gap-4 fallback math; TS-check: partial — crosshair marker radius native; ring sizing custom |
| `resolveDotColor` precedence (rows → dotColor → series) | util fn | BKLIT | CUSTOM | no | TS-check: none — point.color resolved natively, precedence chain is app-side |
| Module-level `let gradientCounter` | constant | CUSTOM | CUSTOM | no | Mutable module state for chrome ids; TS-check: none — Chart idPrefix prop is the native alternative |
| `barColumnTrackMark` (createMark scene rect per datum) | mark | BKLIT | CUSTOM-ON-TS | maybe | Underlay, ariaHidden group; TS-check: partial — rect()/cell() marks cover scene rects; full-height square-quantized track custom |
| `bandWidthForSquares` | util fn | BKLIT | CUSTOM | no | Duplicated in squares-mark + inline in chrome; TS-check: none — ResolvedScale.bandwidth exists but square-band arithmetic is bklit's |
| `ts-chart__bar-y ts-chart__bar-column-track` group classes | CSS class | CUSTOM | CUSTOM | no | Chrome query handles; TS-check: none — native emits `ts-chart__bar-y` but not `-column-track` |
| `barSquaresMark` (quantized rect columns) | mark | BKLIT | CUSTOM-ON-TS | maybe | Emits its own scene nodes + points; TS-check: partial — waffleX/waffleY quantize values to cells, but no band-aligned square columns |
| Gradient/pattern `url(#…)` nesting resolution | util fn | BKLIT | CUSTOM | no | Pattern-over-gradient tinting; TS-check: none — native gradients render flat stop lists only |
| Top-square-center `ChartPoint` emission | mark | CUSTOM | CUSTOM-ON-TS | yes | Native points channel replaces `squareSnap` math; TS-check: native — createMark interaction points (charts-core) |
| `ts-chart__bar-y ts-chart__bar-squares` group classes | CSS class | CUSTOM | CUSTOM | no | TS-check: none — no native squares classes |
| `barTrimmedMark` (perspective trim of bar tops) | mark | BKLIT | CUSTOM-ON-TS | maybe | Used when depth layers present; radius forced 0; TS-check: partial — createMark native, trim geometry custom |
| `groupScale.copy().range([0, totalBandwidth])` local ranging | util fn | CUSTOM | CUSTOM-ON-TS | maybe | Mirrors charts-core resolveGroupScale; TS-check: partial — resolveGroupScale internal (unexported); same math via public group({scale}) |
| `DEFAULT_GROUND_SHADOW 0.26` / `GLASS_TIP_OPACITY 0.2` / `BAR_FADED_OPACITY 0.3` | constant | BKLIT | CUSTOM | no | Verbatim from bar-depth.tsx; TS-check: none |
| `buildPosBarStops` / `buildNegBarStops` | util fn | BKLIT | CUSTOM | no | Glass ramp stop lists, ported verbatim; TS-check: partial — stop lists expressible as spec.gradients stops; builders bklit-specific |
| `barDepthBackMark` (side solid+shade+glass, lid solid+tip+shade — 6 area nodes/bar) | mark | BKLIT | CUSTOM-ON-TS | maybe | Skips bars with depth < 0.5px; TS-check: partial — createMark native; 3D depth surfaces have no native mark |
| `barDepthFrontMark` (per-bar glass rect) | mark | BKLIT | CUSTOM-ON-TS | maybe | TS-check: partial — createMark native; glass overlay custom |
| Depth key suffix contract (`:side:N`, `:lid:N`) | type | CUSTOM | CUSTOM | no | Must stay regex-compatible with frozen chrome; TS-check: none — native keys are `${id}:${group}:${key}`, no suffix slots |
| `ts-chart__bar-depth-back` / `-front` group classes | CSS class | CUSTOM | CUSTOM | no | TS-check: none |
| `PULSE_WAVE_HEIGHT_RATIO 0.55` / `HEIGHT_MIN_PX 36` / `DURATION_S 2.4` / `PEAK_OPACITY 0.85` | constant | BKLIT | CUSTOM | no | Wave constants (motion currently inert in mark); TS-check: none |
| `buildBarSilhouettePath` (front+side+lid union outline) | util fn | BKLIT | CUSTOM | no | Direction-aware parallelogram union; TS-check: none — no polygon-union helper natively |
| `barPulseMark` (static white silhouette node) | mark | BKLIT | CUSTOM-ON-TS | maybe | Renders clip-shape only; no wave animation (see Deviations); TS-check: partial — createMark + SceneGroup.clip native; silhouette path custom |
| `BAR_DEPTH_MAX_PX 7` / `PERSPECTIVE_RATIO 0.45` / `MIN_PX 0.5` | constant | BKLIT | CUSTOM | no | Verbatim; TS-check: none |
| `barDepthMaxDepth` / `barDepthAndRise` | util fn | BKLIT | CUSTOM | no | Shared geometry, verbatim; TS-check: none |
| `computeSquareColumn` / `topSquareCenterY` | util fn | BKLIT | CUSTOM | no | Quantization math, verbatim; latter unconsumed; TS-check: none — waffle quantizes values, not band-column geometry |
| `BarXAxisOverlay` (HTML label overlay) | overlay | BKLIT | CUSTOM | maybe | Deliberately HTML, not SVG axis (K3); TS-check: partial — SVG axis + tickLabels.thin native; HTML-overlay choice is bklit parity |
| Modulo thinning `step = ceil(count/maxLabels)` | util fn | BKLIT | CUSTOM | no | Not x-ticks even-spacing optimizer; TS-check: partial — tickLabels.thin collision-aware natively; modulo scheme is bklit's |
| Label chrome: `bottom: 12`, `fontSize 12`, width-0 flex centering, `opacity 0.4s ease-in-out`, `data-bkm-xlabel`/`data-bkm-x` hooks | constant | BKLIT | CUSTOM | no | Fade driven by shared `applyLabelFade`; TS-check: partial — axis tickLabels opacity/motion natively; HTML chrome custom |
| `barCategoryAccessor` (Date → `shortDateFmt`) | util fn | BKLIT | CUSTOM | no | TS-check: none — band domain accepts Date keys directly; formatting is app-side |
| `BarPulseOverlay` (**orphan**, no importers) | component | BKLIT | CUSTOM | no | Standalone svg overlay duplicating pulse geometry; TS-check: none — dead code |
| Infinite WAAPI `translateY` wave loop | side-effect: WAAPI | BKLIT | CUSTOM | no | Only place the pulse wave actually animates; TS-check: none — no infinite-loop motion channel |
| Own `clipPath` + bell-curve gradient defs per instance | overlay | BKLIT | CUSTOM | no | 11-stop white gradient, peak 0.85; TS-check: partial — spec.gradients covers gradients only, clipPath per-instance custom |
| Contexts/hooks consumed: `useChartConfig`, `useChartLegendHover`, `useChartMargin`, `useContainerWidth` | hook | BKLIT | CUSTOM | no | Provider-based shared state; TS-check: none — React adapter exposes no config/legend-hover context |

## Imports

From `bar-chart.tsx` (part entry):
- `internal/bar-hover-chrome` (attachBarHoverChrome, BarFocusGroup/Point, BarHoverChrome(State))
- `internal/reference-area-layer`, `internal/reference-area-config`
- `internal/chart-config-context` (useChartConfig)
- `internal/chart-legend-hover` (useChartLegendHover)
- `internal/bar-x-axis-overlay` (BarXAxisOverlay, barCategoryAccessor)
- `internal/bar-focus-strategy` (createBarFocusStrategy)
- `internal/bar-squares-mark`, `internal/bar-column-track-mark`
- `internal/bar-depth-marks` (barDepthBackMark/FrontMark, buildPos/NegBarStops, DEFAULT_GROUND_SHADOW, BarDepthGradientIds)
- `internal/bar-pulse-mark`, `internal/bar-trimmed-mark`
- `internal/pattern-preset` (renderPatternPreset), `internal/types`, `internal/parse-aspect-ratio`
- `internal/deferred-reveal` (onPostPaint, setRevealDeadline)
- `internal` barrel (useChartMargin, useContainerWidth), `internal/y-domain` (createNicedYScale)
- `./styles.css`; `./children` (extractChildren — role-marker configs, outside `internal/`)

Internal-to-internal (within the part's modules):
- `bar-squares-layout` ← bar-column-track-mark, bar-squares-mark
- `bar-depth-geometry` ← bar-depth-marks, bar-pulse-mark, bar-trimmed-mark, bar-pulse-overlay
- `chart-phase` ← bar-focus-strategy
- `design-tokens`, `tooltip-chrome`, `types` ← bar-hover-chrome
- `formatters` ← bar-x-axis-overlay

## Deviations

- **Pilot scope cuts (documented):** `orientation="horizontal"`, `stacked`, `stackGap`, `barWidth`, `squareSnap`, `status="loading"` (skeleton), `animationEasing`, `enterTransition`, `revealSignature`, per-series `yAxisId` all unsupported; `isHorizontalOrStacked` is hardcoded `false`.
- **Inert accepted props:** `BarDepthProvider.segmentsAccessor`/`minBarHeight` and `BarDepthBack.colorAccessor` are typed but ignored by the host; `BarXAxis.tickerHalfWidth` is accepted but never forwarded (chrome hardcodes token 50).
- **Split-brain pulse:** `barPulseMark` emits only a static white silhouette (its wave constants are `void`-ed); the animated wave lives solely in the orphan `bar-pulse-overlay.tsx`, which nothing imports.
- **Dead code in `barTrimmedMark`:** five options destructured then `void`-ed, plus `void barDepthAndRise; void barDepthMaxDepth;` statements that no-op references to imports actually used later in `render`.
- **Phantom read in `bar-hover-chrome`:** `(state as {bandWidth?}).bandWidth` is never populated → ring-dot sizing always takes the gap-4 fallback path.
- **Duplicated formatter:** `dateLabelsForPill` in bar-chart.tsx hand-rolls `toLocaleDateString("en-US", {month:"short", day:"numeric"})` instead of the shared `shortDateFmt`.
- **Triplicated helper:** `bandWidthForSquares` exists in bar-squares-mark.ts, bar-column-track-mark.ts, and inline again in `toDotConfig`.
- **Frozen-key coupling:** depth/back mark keys must keep `:side:N`/`:lid:N` substrings to satisfy bar-hover-chrome's dim regexes (comment says chrome file is frozen).
- **Module-level mutable state:** `gradientCounter` in bar-hover-chrome.
- **Leftover scaffolding in `animateSquaresCascade`:** `columns` array built from x-buckets then discarded (`void columns`); duplicate x-rounding logic.
- **Reveal replay guard complexity:** DOM `dataset.bkmRevealed` stamp + data-identity ref needed because TanStack recreates the marks group on unrelated re-renders (legend hover), which bklit's state-keyed reveal never replayed.
