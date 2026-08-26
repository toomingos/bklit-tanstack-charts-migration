# internal-animation — Phase 4 Research Report

**Files:** `showcase/migrated/charts/internal/{spring,bezier-easing,enter-transition,deferred-reveal,dash-tail,fade-mask,chart-phase,use-chart-phase-orchestrator,decimate,candle-spring,radar-spring,projection-config,projection-line-mark,projection-utils,terminal-marker.tsx}`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/{animation.ts,use-mount-progress.ts,motion-utils.ts,chart-phase.ts,use-chart-phase-orchestrator.ts,fade-edges.ts,indicator-fade.ts,decimate-time-series.ts,series-dash-tail-overlay.tsx,dash-tail-stroke.tsx,path-stroke-utils.ts,projection-config.ts,projection-utils.ts,projection-line.tsx,projection-line-end-marker.tsx,line-series-terminal-marker.tsx}` + the per-family reveal clones absorbed from `{pie,ring,funnel,gauge}-reveal` / `radar-reveal` internals (structurally identical `resolveEnterTransition`/`revealTiming`/`buildProgressKeyframes` sets).

## Feature summary

Shared animation/lifecycle machinery for every migrated chart family: spring physics (a rAF damped-spring integrator plus verbatim motion-dom/framer math ports), the consolidated WAAPI enter/reveal engine (tween + spring keyframe sampling), the loading↔ready phase state machine and its orchestrator hook, deferred post-paint reveal scheduling with guards/deadlines, dash-tail and terminal/projection-end marker overlays, LTTB decimation, edge/crosshair fade-stop math, and projection path/domain/mark geometry. All side-effectful work runs through WAAPI, rAF, timers, and direct DOM/class mutations — no framer-motion and no React state in animation/pointer hot paths (D10/D19/D51).

## Public API

Group exported surface (no public API); parity vs the corresponding legacy modules listed above.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `createSpring` (spring.ts) | util fn | extra | framer `useSpring` replacement: rAF damped-spring integrator driving imperative style writes |
| `Spring` (spring.ts) | type | extra | `set`/`jump`/`stop` handle |
| `bezierEasing` (bezier-easing.ts) | util fn | extra | JS solver for bklit's CSS `cubic-bezier(0.85,0,0.15,1)`; feeds TanStack scene `animation.easing` |
| `EnterTransition` (enter-transition.ts) | type | renamed | mirrors motion/react `Transition` subset (type/duration/ease/bounce/stiffness/damping/mass) |
| `ResolvedTiming` (enter-transition.ts) | type | extra | normalized `{kind:"tween"|"spring", …}` timing |
| `TWEEN_FALLBACK` (enter-transition.ts) | constant | renamed | = legacy `DEFAULT_CHART_ENTER_TRANSITION` (1100ms, cubic-bezier(.85,0,.15,1)); values sourced from design-tokens |
| `springFromBounce` (enter-transition.ts) | util fn | renamed | verbatim bounce formula from legacy motion-utils `springOptionsFromTransition` |
| `resolveEnterTransition` (enter-transition.ts) | util fn | renamed | mirrors `useMountProgress` dispatch (explicit caller transition wins outright; else fallback) |
| `RevealTiming` (enter-transition.ts) | type | extra | durationMs + easing + ALWAYS-non-null pre-sampled progress |
| `revealTiming` (enter-transition.ts) | util fn | extra | consolidates the per-family `revealTiming` clones (pie/ring/funnel/gauge/radar) |
| `buildProgressKeyframes` (enter-transition.ts) | util fn | extra | consolidates the per-family `buildProgressKeyframes` clones |
| `onPostPaint` (deferred-reveal.ts) | util fn | extra | rAF×2 + macrotask; matches bklit's pre-commit framer `initial` timing; returns cancel |
| `checkRevealGuard` (deferred-reveal.ts) | util fn | extra | one-shot reveal guard via `data-bkm-revealed` stamp on `.ts-chart__marks` |
| `setRevealDeadline` (deferred-reveal.ts) | util fn | extra | deadline timer; cancels tracked WAAPI animations on expiry |
| `RevealHandle` (deferred-reveal.ts) | type | extra | `cancel()` teardown handle |
| `DeferredRevealConfig` (deferred-reveal.ts) | type | extra | stagger, epoch guard, per-element animator, cleanup hooks |
| `runDeferredReveal` (deferred-reveal.ts) | util fn | extra | full pipeline: guard → revealing class → post-paint anims → deadline |
| `createDeferredRevealGuard` (deferred-reveal.ts) | util fn | extra | guard-only variant |
| `resolveDashTailBounds` (dash-tail.ts) | util fn | same | verbatim from legacy path-stroke-utils.ts |
| `resolveDashStartX` (dash-tail.ts) | util fn | same | verbatim from legacy path-stroke-utils.ts |
| `DashTailSeries` (dash-tail.ts) | type | extra | multi-series input (legacy overlay was single-series) |
| `DashTailOverlayProps` (dash-tail.ts) | type | extra | — |
| `DashTailOverlay` (dash-tail.ts) | component | renamed | merges legacy `SeriesDashTailOverlay` + `DashTailStroke`; self-measures host paths via DOM |
| `FadeEdges` (fade-mask.ts) | type | same | fade-edges.ts |
| `FadeSides` (fade-mask.ts) | type | same | fade-edges.ts |
| `resolveFadeSides` (fade-mask.ts) | util fn | same | fade-edges.ts |
| `FadeGradientStop` (fade-mask.ts) | type | same | fade-edges.ts |
| `fadeGradientStops` (fade-mask.ts) | util fn | same | 0/15/85/100 stops |
| `viewportFadeGradientAttrs` (fade-mask.ts) | util fn | same | userSpaceOnUse 0..innerWidth |
| `IndicatorFadeEdges` (fade-mask.ts) | type | same | indicator-fade.ts |
| `VerticalFadeSides` (fade-mask.ts) | type | same | indicator-fade.ts |
| `resolveVerticalFadeSides` (fade-mask.ts) | util fn | same | indicator-fade.ts |
| `IndicatorFadeGradientStop` (fade-mask.ts) | type | same | indicator-fade.ts |
| `indicatorFadeGradientStops` (fade-mask.ts) | util fn | same | clamp 2–40%, default 10% |
| `crosshairFadeStops` (fade-mask.ts) | util fn | extra | both@10 default; single source replacing the stops loop inlined in 5 hover-chrome forks |
| `clampFadeLength` (fade-mask.ts) | util fn | extra | clamp 0–45 |
| `edgeFadeMaskStops` (fade-mask.ts) | util fn | extra | symmetric mask stops (background, reference-area-layer) |
| `FadeEdgesMaskAttrs` (fade-mask.ts) | type | extra | `data-bkm-fade-edges(-left/-right)` attribute bag |
| `resolveFadeEdgesMask` (fade-mask.ts) | util fn | extra | reproduces legacy line-chart.tsx attribute computation; drives styles.css mask rules |
| `ChartStatus` (chart-phase.ts) | type | same | |
| `ChartPhase` (chart-phase.ts) | type | same | 8-phase union identical |
| `DEFAULT_CHART_STATUS` (chart-phase.ts) | constant | same | |
| `DEFAULT_Y_DOMAIN_TWEEN_MS` (chart-phase.ts) | constant | same | 500 |
| `Y_DOMAIN_TWEEN_SKIP_THRESHOLD` (chart-phase.ts) | constant | same | 0.02 |
| `resolveRestingChartPhase` (chart-phase.ts) | util fn | same | |
| `isChartInteractionPhase` (chart-phase.ts) | util fn | same | |
| `DEFAULT_CHART_LIFECYCLE` (chart-phase.ts) | constant | same | yDomain skeleton/target `[0,100]` |
| `LoadingStyle` (legacy chart-phase.ts) | type | missing | legacy-only `"pulse"\|"sweep"`; loading style handled by loading-chrome (internal-foundation) |
| `UseChartPhaseOrchestratorOptions` (use-chart-phase-orchestrator.ts) | type | same | |
| `useChartPhaseOrchestrator` (use-chart-phase-orchestrator.ts) | hook | same | near-verbatim port (only biome-ignore comments dropped) |
| `decimateTimeSeries` (decimate.ts) | util fn | same | LTTB verbatim |
| `maxRenderPointsForWidth` (decimate.ts) | util fn | same | |
| `decimateOhlcData` (legacy decimate-time-series.ts) | util fn | missing | dead code in legacy (D19); intentionally not ported |
| `SpringPhysics` (candle-spring.ts) | type | extra | |
| `findSpringStiffnessDamping` (candle-spring.ts) | util fn | extra | verbatim motion-dom `findSpring` port (incl. its derivative quirk) |
| `createSpringResolver` (candle-spring.ts) | util fn | extra | verbatim motion-dom closed-form `resolveSpring(tMs)` |
| `sampleSpringKeyframes` (candle-spring.ts) | util fn | extra | sampled once per chart; snaps to target at t≥durationMs |
| `estimateSpringSettleMs` (radar-spring.ts) | util fn | extra | 60fps-step settle detection (WAAPI needs an explicit duration; framer computed it internally) |
| `sampleSpringProgress` (radar-spring.ts) | util fn | extra | clamped samples, forced final 1 |
| `ProjectionLineConfig` (projection-config.ts) | type | same | |
| `extractProjectionLineConfigs` (projection-config.ts) | util fn | same | same signature; child detection via CHART_ROLE `roleOf` instead of displayName sniffing |
| `mergeProjectionYDomain` (projection-config.ts) | util fn | same | ×1.1 positive-domain cap, 5% padding |
| `mergeProjectionXDomainMax` (projection-config.ts) | util fn | same | |
| `resolveVisibleEndX` (projection-config.ts) | util fn | extra | promoted from private helper in legacy projection-line.tsx; adds `showEndMarker` param |
| `ProjectionLineMarkOptions` (projection-line-mark.ts) | type | extra | full mark options bag (scales/translate passed in by host) |
| `projectionLineMark` (projection-line-mark.ts) | util fn | renamed | legacy `ProjectionLine` component → TanStack `createMark` factory |
| `ProjectionGradientDef` (projection-line-mark.ts) | type | extra | gradient geometry handed to host for `<defs>` |
| `resolveProjectionGradientDef` (projection-line-mark.ts) | util fn | extra | extracts gradient endpoints (host renders the `<linearGradient>`) |
| `TerminalMarkerAnchor` (terminal-marker.tsx) | type | extra | anchor data supplied by host (legacy component read chart context itself) |
| `ProjectionEndMarkerAnchor` (terminal-marker.tsx) | type | extra | |
| `ProjectionPhaseHandle` (terminal-marker.tsx) | type | extra | imperative `setPhase` port (ref-based, no re-render) |
| `ProjectionMarkerOverlay` (terminal-marker.tsx) | component | renamed | merges legacy `LineSeriesTerminalMarker` + `ProjectionLineEndMarker` into one WAAPI overlay |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| spring.ts — rAF damped-spring integrator (semi-implicit Euler, F=−kx−cv) | util fn | BKLIT | CUSTOM | no | framer `useSpring` physics parity; imperative style writes only (D10); TS-check: CONTRADICTS no — partial `createChartSpring` (@tanstack/charts/spring) analytic sampler |
| spring.ts — rest tiers: GRANULAR_SCALE_MAX_DELTA=5, REST_DELTA 0.005/0.5, REST_SPEED 0.01/2 | constant | BKLIT | CUSTOM | no | mirrors framer `isGranularScale`; fixes D51 ring-hover instant-snap bug; TS-check: partial — `ChartSpringOptions` restSpeed/restDelta defaults (0.01/0.005); no granular tiers |
| spring.ts — clock-time integration: MAX_STALL_MS=10_000, SUBSTEP_S=1/120 | constant | BKLIT | CUSTOM | no | no per-frame dt cap (old 64ms cap put springs in slow motion under jank); TS-check: none — `createChartSpring` analytic sampling is frame-rate-independent |
| spring.ts — side-effect channel: rAF loop + consumer style writes | side-effect | BKLIT | CUSTOM | no | no React state, no framer in pointer path; TS-check: none — motion() rAF tracks are internal, no consumer spring-write channel |
| bezier-easing.ts — cubic-bezier(0.85,0,0.15,1) control points | constant | BKLIT | CUSTOM | yes | bklit `DEFAULT_ANIMATION_EASING` as a JS fn; TS-check: native — motion() defaultEasing `cubicBezier(0.85,0,0.15,1)` |
| bezier-easing.ts — Newton-iteration solver (6 iters, 1e-5 tol) | util fn | CUSTOM | CUSTOM | yes | feeds TanStack scene `animation.easing` (used by line/area/composed); TS-check: native slot — `ChartMotionTweenTransition.easing` accepts `(progress)=>number` |
| enter-transition.ts — TWEEN_SAMPLES=64 uniform progress array | constant | CUSTOM | CUSTOM | no | chord-vs-arc <0.3px at pie/ring radii; sidesteps CSS `d` discrete interpolation (D51); TS-check: none — analogous internal `tooltipMotionSamples` uses 31 uniform offsets |
| enter-transition.ts — reveal defaults REVEAL_DURATION_MS=1100 / REVEAL_EASE_CSS=cubic-bezier(.85,0,.15,1) | constant | BKLIT | CUSTOM | maybe | imported from design-tokens (internal-foundation); = legacy animation.ts values; TS-check: native — motion() defaults are exactly 1100ms tween + cubic-bezier(0.85,0,0.15,1) |
| enter-transition.ts — springFromBounce: stiffness clamp 80–400 (×(1+bounce·0.35)), damping ≥8 (×(1−bounce·0.25)) | constant | BKLIT | CUSTOM | yes | verbatim motion-utils math; TS-check: CONTRADICTS yes — `ChartMotionSpringTransition` takes stiffness/damping directly; no bounce derivation |
| enter-transition.ts — tween-fallback spring base {stiffness:100, damping:15}, mass default 1 | constant | CUSTOM | CUSTOM | no | used when caller requests a spring without k/c over the tween fallback; TS-check: none — `ChartSpring` defaults are stiffness 170/damping 26/mass 1 |
| enter-transition.ts — WAAPI sampling strategy: uniform keyframes + animation-level easing; springs → linear easing over sampled curve | util fn | CUSTOM | CUSTOM-ON-TS | maybe | empirically verified timing-level bezier mapping; `d:` discrete-flip workaround; TS-check: partial — motion.ts `tooltipMotionSamples` builds linear-eased WAAPI keyframes from springs |
| deferred-reveal.ts — onPostPaint rAF×2 + setTimeout(0) chain | side-effect | BKLIT | CUSTOM | maybe | matches framer pre-commit `initial` paint timing; cancellable; TS-check: partial — tooltip controller `beforePaint`/`afterPaint` hooks; no mark-level scheduler |
| deferred-reveal.ts — `data-bkm-revealed` one-shot guard (dataset stamp) | side-effect | CUSTOM | CUSTOM-ON-TS | maybe | prevents double reveal of `.ts-chart__marks`; TS-check: none |
| deferred-reveal.ts — `.ts-chart__marks--revealing` class toggle | CSS class | CUSTOM | CUSTOM-ON-TS | maybe | styles.css:67 `opacity:0` until tweens are armed (scatter-style first-paint hiding); TS-check: none — TanStack hides enters via inline opacity attr, no class |
| deferred-reveal.ts — deadline timer (duration + maxStagger) cancelling tracked Animations | side-effect | CUSTOM | CUSTOM-ON-TS | maybe | optional per-anim `cleanupAnimation` hook; TS-check: partial — motion `runTracks` safetyLimit force-completes overdue tracks (internal) |
| deferred-reveal.ts — heatmap epoch guard (revealEpoch + seenEpochRef) | util fn | CUSTOM | CUSTOM | no | consumed by heatmap-components; TS-check: none |
| deferred-reveal.ts — stagger scan (max delay over elements extends deadline) | util fn | CUSTOM | CUSTOM | no | —; TS-check: none — `stagger()` emits delays only; deadline scan stays app-side |
| dash-tail.ts — default dashArray "6,4" | constant | BKLIT | CUSTOM | yes | matches legacy ProjectionLine `strokeDasharray` default; TS-check: native — `LineX/LineYOptions.strokeDasharray` |
| dash-tail.ts — index-proportional dashStartLength `(idx/(n−1))·len` | util fn | BKLIT | CUSTOM-ON-TS | yes | legacy dropped exact `findPathLengthAtX` binary search (~40ms/series) for this approximation; TS-check: CONTRADICTS yes — no strokeDashoffset/getTotalLength anywhere in TanStack |
| dash-tail.ts — self-measuring rAF retry loop (≤120 attempts; reads `getAttribute("d")`/`getTotalLength`) | side-effect | CUSTOM | CUSTOM-ON-TS | no | multi-series; skips setState when unchanged (React #185 livelock note); TS-check: none |
| dash-tail.ts — margin-baked absolute coordinate space (no translate wrapper on overlay svg) | impl detail | TANSTACK | CUSTOM-ON-TS | no | TanStack host bakes margin.left/top into scale ranges (verified live); TS-check: none — confirmed host coordinate contract |
| dash-tail.ts — emits `[data-bkm-dash-tail]` groups + clipPath rects | DOM/CSS hook | CUSTOM | CUSTOM-ON-TS | maybe | hover-chrome dash-tail sync queries these; TS-check: none — app-owned attrs; plain SVG clipPath |
| dash-tail.ts — queries `.ts-chart__marks`, `.ts-chart__line[data-ts-key^="…"]` | CSS class | TANSTACK | CUSTOM-ON-TS | no | TanStack-rendered DOM contract; TS-check: none — selectors target TanStack-emitted DOM (`g.ts-chart__line`/`__marks`, `data-ts-key`) |
| fade-mask.ts — horizontal fade stops 0%/15%/85%/100% | constant | BKLIT | CUSTOM | yes | historic pattern, verbatim; TS-check: native — `ChartLinearGradient.stops` via `defineChart.gradients` |
| fade-mask.ts — indicator fade clamp 2–40%, default fadeLength 10% | constant | BKLIT | CUSTOM | yes | crosshair vertical gradient; TS-check: native — `ChartLinearGradient.stops` via `defineChart.gradients` |
| fade-mask.ts — clampFadeLength 0–45 | constant | CUSTOM | CUSTOM | yes | edgeFadeMaskStops helper; TS-check: native — `ChartLinearGradient.stops`; clamp itself app-side |
| fade-mask.ts — crosshairFadeStops() = both@10 | constant | BKLIT | CUSTOM | yes | single definition site for the crosshair gradient; TS-check: partial — `ChartLinearGradient` defs native; cursor rules take flat stroke colors |
| fade-mask.ts — `data-bkm-fade-edges(-left/-right)` attrs + styles.css mask-image rules | CSS class | CUSTOM | CUSTOM-ON-TS | maybe | CSS mask replaces bklit's SVG linearGradient masks (styles.css:34–52); TS-check: none — TanStack core styles.css has no mask rules (.ts-plot tokens only) |
| fade-mask.ts — resolveFadeEdgesMask aggregation (any/left/right across series) | util fn | BKLIT | CUSTOM-ON-TS | yes | reproduces legacy line-chart.tsx computation exactly; TS-check: partial — rendering via `ChartLinearGradient`; aggregation app-side |
| chart-phase.ts — DEFAULT_Y_DOMAIN_TWEEN_MS=500 | constant | BKLIT | CUSTOM | yes | ; TS-check: partial — motion() update transition animates y changes; no dedicated domain-tween duration |
| chart-phase.ts — Y_DOMAIN_TWEEN_SKIP_THRESHOLD=0.02 | constant | BKLIT | CUSTOM | yes | ; TS-check: partial — `ChartRollingPathMotion` y:'reproject' tweens domain changes affinely |
| chart-phase.ts — DEFAULT_CHART_LIFECYCLE (yDomain skeleton/target `[0,100]`) | constant | BKLIT | CUSTOM | yes | ; TS-check: none — no skeleton/loading lifecycle in TanStack |
| chart-phase.ts — 8-value ChartPhase vocabulary | type | BKLIT | CUSTOM | yes | identical enum; TS-check: partial — native phases only `ChartMotionPhase` enter/update/exit |
| use-chart-phase-orchestrator.ts — status-transition effect machine (branching on animationDuration/yDomainTweenDuration) | hook | BKLIT | CUSTOM-ON-TS | yes | near-verbatim port; TS-check: partial — nearest: `onRender(context)` + svg `data-ts-motion-state`; no status machine |
| use-chart-phase-orchestrator.ts — reveal settle via window.setTimeout(animationDuration); bumps revealEpoch | side-effect | BKLIT | CUSTOM-ON-TS | yes | setIsLoaded on settle; TS-check: partial — motion `runTracks` sets `data-ts-motion-state="finished"` on settle |
| use-chart-phase-orchestrator.ts — plotData switch (skeleton vs target per phase) | hook | BKLIT | CUSTOM-ON-TS | yes | feeds TanStack chart data props; TS-check: CONTRADICTS yes — charts consume final data; no skeleton/target staging |
| decimate.ts — LTTB decimateTimeSeries (first/last kept, triangle-area pick) | util fn | BKLIT | CUSTOM | yes | bklit's own decimation strategy, required by bench conventions; TS-check: CONTRADICTS yes — no LTTB/downsampling anywhere in TanStack |
| decimate.ts — maxRenderPointsForWidth: ceil(w·1.5), floor 64 | constant | BKLIT | CUSTOM | yes | ~1.5 points/px; TS-check: CONTRADICTS yes — no width-based point budgeting in TanStack |
| candle-spring.ts — motion-dom `findSpring` port (Newton 12 iters, `approximateRoot`) | util fn | BKLIT | CUSTOM | maybe | bit-for-bit framer parity (read from node_modules/motion-dom); TS-check: partial — `createChartSpring` samples k/c springs; no duration/bounce→params solver |
| candle-spring.ts — derivative quirk `calcAngularFreq(undampedFreq**2, …)` preserved | constant | BKLIT | CUSTOM | maybe | copied verbatim, deliberately unfixed; TS-check: none |
| candle-spring.ts — clamps: SAFE_MIN .001, dampingRatio .05–1, duration .01–10s; NaN fallback {100,10,1} | constant | BKLIT | CUSTOM | maybe | motion-dom defaults; TS-check: partial — `createChartSpring` resolves/clamps positive stiffness/mass, non-negative damping |
| candle-spring.ts — closed-form resolver: under/critical/overdamped branches, sinh arg cap 300 | util fn | BKLIT | CUSTOM | maybe | t in milliseconds; TS-check: native — `createChartSpring.sampleSpring` under/critical/overdamped analytic branches |
| candle-spring.ts — sampleSpringKeyframes: 60 samples, snap-to-target at t≥durationMs | util fn | BKLIT | CUSTOM | maybe | sampled ONCE per chart; styles.css also bakes it as a static @keyframes rule for huge n; TS-check: partial — `tooltipMotionSamples` samples springs to WAAPI keyframes at 16ms steps |
| radar-spring.ts — estimateSpringSettleMs: 1000/60 steps, threshold .001, 8 settled frames, cap 6000 frames | util fn | CUSTOM | CUSTOM | maybe | WAAPI needs explicit duration; framer computed settle internally; TS-check: partial — `tooltipMotionSamples` detects `sample.done` within a 2000ms cap |
| radar-spring.ts — sampleSpringProgress: clamp 0–1, force last=1 | util fn | CUSTOM | CUSTOM | maybe | —; TS-check: partial — `tooltipMotionSamples` normalizes offsets, forces final value 1 |
| projection-config.ts — positive-domain cap `[0, max·1.1]`; else ±5% padding (\|\|1) | constant | BKLIT | CUSTOM | yes | mergeProjectionYDomain; TS-check: none — pass computed domain via scale instance; no padding helper |
| projection-config.ts — edgePadding = (marker ? endpointRadius : 0) + strokeWidth·0.5 + 1 | constant | BKLIT | CUSTOM | yes | showEndMarker-gated (legacy always padded); TS-check: none — compute domain yourself |
| projection-config.ts — child detection via `roleOf(child.type)==="projectionLine"` | util fn | CUSTOM | CUSTOM-ON-TS | maybe | CHART_ROLE marker replaces legacy `displayName==="ProjectionLine"` sniffing; walks Fragments + children; TS-check: none — composite marks declare children statically |
| projection-config.ts — normalizeYAxisId (null/""→"left") | util fn | BKLIT | CUSTOM | yes | legacy imported it from y-axis-scales; TS-check: none — single x/y axis model, no axis ids |
| projection-utils.ts — interval fallback 86_400_000 ms (1 day) | constant | BKLIT | CUSTOM | yes | resolveIntervalMs last resort; TS-check: partial — `binTime` transforms take `TimeIntervalLike` (d3 intervals); no auto-fallback constant |
| projection-utils.ts — linear-regression slope (denom ε 1e-12) + lastSegment slope | util fn | BKLIT | CUSTOM | yes | auto mode; TS-check: partial — `linearRegressionRowsY/X` fit least-squares slope natively; no extrapolation past data extremes |
| projection-utils.ts — buildHorizontalTangentBezierPath tension 0.45, clamp 0.05–0.5 | constant | BKLIT | CUSTOM | yes | price-target S-curve; TS-check: native — `curve` option + `d3Curve(CurveFactory)` |
| projection-utils.ts — horizonPoints default 6; deprecated `stepped` density retained in types | constant | BKLIT | CUSTOM | yes | pathDensity default "endpoints"; TS-check: none |
| projection-utils.ts — readDate coercion (Date/number/string → Date) | util fn | BKLIT | CUSTOM | yes | —; TS-check: native — `ChartValue` accepts Date/number channels |
| projection-line-mark.ts — TanStack `createMark` scene graph (group → polyline with raw `path`, empty x/y channels) | mark | TANSTACK | TS-NATIVE | yes | replaces visx `LinePath`; render-time node tree; TS-check: native — `createMark` (@tanstack/charts) |
| projection-line-mark.ts — gradient stroke `url(#id)`; stroke "transparent" when phase-hidden | util fn | BKLIT | TS-NATIVE | yes | defs resolved separately for host `<linearGradient>`; TS-check: native — `defineChart.gradients` renders `<linearGradient>` (idPrefix-scoped) |
| projection-line-mark.ts — depends on styles.css `.chart-projection-line path { vector-effect: none }` | CSS class | TANSTACK | CUSTOM-ON-TS | maybe | renderer hardcodes non-scaling-stroke on polyline paths; breaks dashes on hiDPI Chromium; TS-check: confirmed — svg-renderer.ts hardcodes `vector-effect="non-scaling-stroke"` on path nodes |
| terminal-marker.tsx — TERMINAL_MARKER_FADE_DURATION_MS=280, easing cubic-bezier(0.22,1,0.36,1) | constant | BKLIT | CUSTOM | yes | legacy fadeTransition default `{duration:0.28, ease:[0.22,1,0.36,1]}`; TS-check: native — `ChartMotionTweenTransition` duration/easing |
| terminal-marker.tsx — hidden scale(0.55)/opacity 0 ↔ visible scale(1) | constant | BKLIT | CUSTOM | yes | framer animate values; TS-check: partial — tooltip presence animates opacity/scale natively; markers stay app-owned |
| terminal-marker.tsx — projection dot r = radius·0.85 | constant | BKLIT | CUSTOM | yes | ProjectionLineEndMarker parity; TS-check: none — dot mark takes explicit r; ratio app-side |
| terminal-marker.tsx — WAAPI per-marker `animate()` + onfinish/oncancel + runningAnimsRef bookkeeping | side-effect | BKLIT | CUSTOM-ON-TS | maybe | framer `animate` replacement; cancels stale anims per retarget; TS-check: partial — tooltip controller does cancel/retarget/onfinish bookkeeping (internal) |
| terminal-marker.tsx — phasePort imperative handle (applyPhase via ref) | pattern | CUSTOM | CUSTOM-ON-TS | no | orchestrator pushes phases; zero React re-renders on phase change; TS-check: none |
| terminal-marker.tsx — reduced-motion instant snap (skips tweens) | hook consumed | CUSTOM | CUSTOM-ON-TS | maybe | `usePrefersReducedMotion` (internal-foundation); TS-check: native — `motion({respectReducedMotion})` snaps on prefers-reduced-motion |
| terminal-marker.tsx — transformBox fill-box + transformOrigin cx,cy | constant | BKLIT | CUSTOM | yes | scale around the anchor point; TS-check: none — plain SVG presentation attributes |

## Imports

`internal/` modules this group imports **from other groups**:

- `design-tokens` (REVEAL_DURATION_MS, REVEAL_EASE_CSS) ← enter-transition.ts — internal-foundation
- `use-prefers-reduced-motion` ← terminal-marker.tsx — internal-foundation
- `types` (ChartDatum) ← projection-line-mark.ts — internal-foundation
- `../children` (`roleOf`) ← projection-config.ts — the `children` add-on part

Intra-group wiring: enter-transition → radar-spring; radar-spring → candle-spring; use-chart-phase-orchestrator → chart-phase; projection-config → projection-utils; projection-line-mark → projection-utils + projection-config; terminal-marker → chart-phase + enter-transition.

## Deviations

- Consolidation by design: enter-transition.ts absorbs five structurally identical per-family clone sets (phase-3 plan D2); gauge-reveal.ts re-exports `resolveEnterTransition`/`revealTiming` for local compatibility. No behavioral fork between families — differing defaults flow through the `fallback` argument.
- candle-spring.ts copies motion-dom math verbatim, including the `calcAngularFreq(undampedFreq**2, …)` derivative quirk — deliberately unfixed for bit-for-bit framer parity.
- spring.ts documents a fixed prior bug: flat REST_DELTA=0.05 exceeded RingChart's entire hover amplitude (scale 1→1.03), degenerating springs into instant snaps (D51); tiered thresholds now mirror framer's `isGranularScale`.
- dash-tail overlay is multi-series and self-measuring (DOM query + `getTotalLength`, ≤120-frame rAF retry), whereas legacy was single-series fed by host-measured metrics (`usePathStrokeMetrics`). Legacy's exact `findPathLengthAtX` binary search is not ported — the index-proportional approximation is kept, matching legacy's own perf rationale.
- `decimateOhlcData` intentionally not ported (dead code in legacy, D19); legacy `LoadingStyle` type not ported (loading style lives in loading-chrome, internal-foundation).
- `extractProjectionLineConfigs` detects ProjectionLine children via the CHART_ROLE marker (`roleOf`) instead of legacy `displayName === "ProjectionLine"` sniffing.
- `resolveVisibleEndX` promoted from a private helper to an exported util and gains a `showEndMarker` parameter (legacy always padded for the marker).
- terminal-marker merges two legacy post-overlay components into one overlay driven imperatively via a `phasePort` ref (no React state churn); adds a reduced-motion instant-snap path absent in legacy.
- Legacy framer plumbing with no counterpart: animation.ts `clipRevealTransition`/`transitionWithDelay` and motion-utils' tween-duration→spring branch (`280/duration`, `18+duration·4`) — replaced by WAAPI keyframe sampling.
- styles.css interplay: fade-mask attrs drive the `mask-image` rules; `.ts-chart__marks--revealing` hides marks during deferred tween setup; `.chart-projection-line path` overrides the renderer's hardcoded `vector-effect: non-scaling-stroke` (dashes break on hiDPI Chromium otherwise); candlestick reveal additionally bakes the candle-spring curve as a static `@keyframes` rule at huge n.
