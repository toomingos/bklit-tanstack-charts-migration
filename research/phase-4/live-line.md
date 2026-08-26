# live-line — Phase 4 Research Report

**Files:** `showcase/migrated/charts/live-line-chart.tsx`, `showcase/migrated/charts/internal/live-hover-chrome.ts`, `showcase/migrated/charts/internal/live-line-mark.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/live-line-chart.tsx`, `repos/bklit-ui/packages/ui/src/charts/live-line.tsx`, `repos/bklit-ui/packages/ui/src/charts/live-x-axis.tsx`, `repos/bklit-ui/packages/ui/src/charts/live-y-axis.tsx`

## Feature summary

Streaming/push-mode line chart: one continuous rAF loop advances a lerped y-domain (instant expand / exponential contract) and display value, committing to React every 32ms (`startTransition`). Renders area+line marks through a TanStack `defineChart` spec plus a plain-SVG "live tip" chrome (dashed reference line, SMIL pulse ring, glow/solid dot, value badge) and an imperative hover chrome (crosshair, dots, tooltip box, date pill, x/y axis labels) driven directly from the raw tick — no React state in the pointer path. Compositional children (`<LiveLine>`/`<LiveXAxis>`/`<LiveYAxis>`/`<ChartTooltip>`/`<ReferenceArea>`) are extracted by CHART_ROLE markers (D22 precedent: new top-level component, not a LineChart variant).

## Public API

Legacy public surface: `LiveLineChart`(+props,+`LiveLinePoint`) in live-line-chart.tsx; `LiveLine`(+props,+`MomentumColors`,+`detectMomentum`,+`Momentum`) in live-line.tsx; `LiveXAxis`(+props) in live-x-axis.tsx; `LiveYAxis`(+props) in live-y-axis.tsx. Migrated: `LiveLineChart` from live-line-chart.tsx; `<LiveLine>/<LiveXAxis>/<LiveYAxis>` are config-carrier components in `children.tsx` (CHART_ROLE markers, part of the shared `children` add-on); types re-exported via `charts/index.ts`.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `LiveLineChart` (default+named) | component | same | Same signature; rendering re-plumbed onto TanStack `<Chart>`. |
| `LiveLineChartProps.data` | `LiveLinePoint[]` | same | Push-model array of `{time: unixSeconds, value}`. |
| `LiveLineChartProps.value` | `number` | same | Latest value, smoothly interpolated to. |
| `.dataKey` | `string` (default `"value"`) | same | |
| `.window` | `number` (default 30) | same | Visible time window in seconds. |
| `.numXTicks` | `number` (default 5) | same | Drives leading-offset unit. |
| `.nowOffsetUnits` | `number` (default 0) | same | Leading offset in X-tick units. |
| `.exaggerate` | `boolean` (default false) | same | Tight-Y padding factor 0.03 vs 0.15. |
| `.lerpSpeed` | `number` (default 0.08) | same | |
| `.margin` | `Partial<Margin>` | same | Migrated stabilizes identity via `useChartMargin` (TanStack definition boundary); values identical. |
| `.paused` | `boolean` (default false) | same | Freeze scrolling; lerp continues converging. |
| `.children` | `ReactNode` | same | Optional in migrated (required in legacy) — loosening only. Extraction via CHART_ROLE markers replaces legacy displayName/`dataKey`-in-props sniffing. |
| `.className` | `string` | same | No `cn()` merge (plain pass-through). |
| `.style` | `CSSProperties` | same | Merged over `{height:300, touchAction:"none"}` (+`isolation:isolate`, added). |
| `LiveLinePoint` | type | same | Re-exported from `charts/index.ts`. |
| `LiveLineChartProps` | type | same | Re-exported. |
| `<LiveLine>` | component | renamed (host) | Legacy rendered its own series SVG; migrated carrier returns `null`, rendering happens in `LiveLineChart` (TanStack marks + React/SVG overlay). Props below unchanged. |
| `LiveLineProps.dataKey` | `string` | same | |
| `LiveLineProps.stroke` | `string` (default `var(--chart-line-primary)`) | same | |
| `LiveLineProps.strokeWidth` | `number` (default 2) | same | |
| `LiveLineProps.curve` | `CurveFactory` (default `curveMonotoneX`) | same | Converted with `d3Curve()` for TanStack. |
| `LiveLineProps.fill` | `boolean` (default true) | same | Gradient area fill. |
| `LiveLineProps.pulse` | `boolean` (default true) | same | SMIL pulsing ring. |
| `LiveLineProps.dotSize` | `number` (default 4) | same | |
| `LiveLineProps.badge` | `boolean` (default true) | same | Value badge at live tip. |
| `LiveLineProps.formatValue` | `(v:number)=>string` (default `toFixed(2)`) | same | Also feeds default tooltip rows. |
| `LiveLineProps.momentumColors` | `MomentumColors` | same | Line/fill/dot recolor by momentum; dot recolors even when unset. |
| `<LiveXAxis>` | component | renamed (host) | Carrier; labels/pill painted by `live-hover-chrome`. |
| `LiveXAxisProps.numTicks` | `number` (default 5) | same | Evenly time-spaced labels. |
| `LiveXAxisProps.formatTime` | `(t:number)=>string` (default HH:MM:SS) | same | |
| `<LiveYAxis>` | component | renamed (host) | Carrier; ticks painted by `live-hover-chrome`. |
| `LiveYAxisProps.minGap` | `number` (default 36) | same | Hysteresis interval picker. |
| `LiveYAxisProps.position` | `"left"\|"right"` (default "left") | same (partial) | Prop accepted, but only `"left"` implemented (documented pilot carve-out in `types.ts`); legacy rendered both sides. |
| `LiveYAxisProps.formatValue` | `(v:number)=>string` (default `toFixed(2)`) | same | |
| `LiveYAxisProps.allowDecimals` | `boolean` (default true) | same | |
| `MomentumColors` | type | same | Re-exported from `charts/index.ts`. |
| `detectMomentum` | util fn | missing | Internalized inside live-line-chart.tsx; not exported. |
| `Momentum` | type | missing | Internalized; not exported. |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `LERP_SPEED=0.08` | constant | BKLIT | CUSTOM | no | Default lerp speed.; TS-check: none |
| `DEFAULT_MARGIN {top:24,right:16,bottom:32,left:16}` | constant | BKLIT | CUSTOM | no | Identical to legacy.; TS-check: none — margin caller-supplied, no default constant |
| `LIVE_FRAME_COMMIT_MS=32` | constant | BKLIT | CUSTOM | no | ~30fps React commit throttle.; TS-check: none |
| `PAUSED_FRAME_PIXEL_THRESHOLD=0.25` | constant | CUSTOM | CUSTOM | no | Migrated-only: paused sub-quarter-pixel frames skip commit.; TS-check: none |
| `EDGE_FADE_PX=28` | constant | BKLIT | CUSTOM | no | Y-tick edge fade (legacy live-y-axis).; TS-check: none — no native edge-fade; axis label `opacity` is static |
| `TICK_SPRING {stiffness:180,damping:24}` | constant | BKLIT | CUSTOM | no | live-hover-chrome local; matches legacy `tickSpring`.; TS-check: none — createChartSpring sampler exists, tuning values not |
| `hmsTimeFmt` default time formatter | util fn | BKLIT | TS-NATIVE | yes | From `internal/formatters`; legacy `chart-formatters`.; TS-check: CONTRADICTS yes — Intl.DateTimeFormat platform API, TanStack exports no formatters |
| `v.toFixed(2)` default value format | util fn | BKLIT | CUSTOM | no | Inlined twice (chart + chrome defaults).; TS-check: none — tick `format?: (value)=>string` accepts it, ships none |
| `computeTargetRange` | util fn | BKLIT | CUSTOM | no | Min/max + exaggerate padding (0.03/0.15, fallback pad 0.04/10).; TS-check: none — closest native knob is axis `nice?: boolean\|number` |
| `nextAnimFrame` | util fn | BKLIT | CUSTOM | no | Asymmetric domain lerp (instant expand, 0.08 contract).; TS-check: none |
| `frameChangePixels` | util fn | CUSTOM | CUSTOM | no | Paused pixel-delta gate (migrated-only).; TS-check: none |
| `interpolateAtTime` | util fn | BKLIT | CUSTOM | no | Binary search + linear interpolation.; TS-check: none — d3-array dep has bisector but not re-exported by TanStack |
| `bisectTime` (d3-array `bisector().left`) | util fn | BKLIT | TS-NATIVE | yes | d3-array is also TanStack's own dep.; TS-check: native — d3-array 3.2.4 is a pinned @tanstack/charts dep (bisector itself not re-exported) |
| `detectMomentum` (lookback 20, threshold range*0.12) | util fn | BKLIT | CUSTOM | no | Ported verbatim from legacy live-line.tsx.; TS-check: none — no trend/momentum util in TanStack |
| `pickNiceInterval` | util fn | BKLIT | CUSTOM | no | Divisor sets `[2,2.5,2]…`, hysteresis keep-prev (0.5–3×minGap).; TS-check: none — charts-scales ticks use [1,2,5,10], no hysteresis |
| `edgeOpacity` | util fn | BKLIT | CUSTOM | no | Edge fade over 28px.; TS-check: none |
| `extractLiveLineChildren` (roleOf) | util fn | CUSTOM | TS-NATIVE | maybe | Single-pass CHART_ROLE extraction incl. Fragments; replaces legacy name-sniffing + separate referenceArea extraction.; TS-check: none — no children-extraction API in TanStack (React-adapter only) |
| rAF loop `tick()` (lifetime, self-re-arming) | hook | BKLIT | CUSTOM | no | Advances frame + resolves hover chrome every raw tick; mirrors legacy tick 378–430.; TS-check: none — TanStack has no rAF scheduler export |
| `startTransition` throttled `setFrame` @32ms | hook | BKLIT | TS-NATIVE | yes | Only React commit channel; feeds TanStack definition.; TS-check: CONTRADICTS yes — startTransition is React, no TanStack commit-throttle equivalent |
| `wakeLoopRef` demand re-arm | hook | CUSTOM | CUSTOM | no | Fixes paused-loop dead-end (audit §4 C2); legacy loop never sleeps.; TS-check: none |
| Native `pointermove`/`pointerleave` listeners on container | hook | CUSTOM | TS-NATIVE | no | Ref-only cursor path (D16/D22); deliberately replaces TanStack focus system AND legacy visx `localPoint` onMouseMove.; TS-check: CONTRADICTS no — native ChartCursorBinding/createChartCursor (charts-core/cursor) offers app-owned pointer state |
| `cursorStateRef` canvas-space snapshot | hook | CUSTOM | CUSTOM | no | Avoids 32ms margin-staleness window (audit §4 C3). |
| d3 `scaleTime`/`scaleLinear(.nice())`/`curveMonotoneX` | util fn | TANSTACK | TS-NATIVE | yes | Same libs TanStack builds on.; TS-check: native — d3-scale/d3-shape are pinned deps; charts-scales also ships scaleLinear |
| TanStack `<Chart>` mount | component | TANSTACK | TS-NATIVE | yes | `ariaLabel="Live line chart"` (added vs legacy `aria-hidden` svg).; TS-check: native — Chart (react-charts) with ariaLabel prop |
| `defineChart({marks, x/y guide:false, margin, svgAnimation:false})` | util fn | TANSTACK | TS-NATIVE | yes | `svgAnimation:false` prevents double-animation with the outer lerp loop.; TS-check: native — defineChart + svgAnimation option; note per-axis hide is `axis:false`, not `guide:false` |
| `liveLineMark` (`createMark`: polyline+area sibling scene groups, per-segment keys, non-finite segmentation) | mark | CUSTOM | CUSTOM-ON-TS | maybe | Supported `createMark` API; no direct SVG mutation; hot path skips filter when all-finite.; TS-check: native — createMark (charts-core) supports custom scene nodes |
| Stroke/area linear gradients + horizontal fade mask (`bkm-live-stroke/area/fade-{uid}`) | overlay | BKLIT | CUSTOM | no | React-rendered SVG defs; mask rect y=margin.top−20, h=innerHeight+40.; TS-check: partial — ChartSpec `gradients` renders linearGradients, no mask/edge-fade support |
| `LiveTipChrome` five elements (dashed ref line op .25 dasharray 4,4; SMIL pulse r→dotSize*3.5 dur 1.5s; glow dot r+2 op .1; solid dot stroke var(--chart-background) w2; badge rect rx6 h24 at x+12, width=len*7.5+16, SF Mono 11px) | overlay | BKLIT | CUSTOM | no | React-rendered at committed-frame rate; verbatim port of live-line.tsx 231–317.; TS-check: none — no badge/pulse primitives in TanStack |
| SMIL `<animate>` pulse ring | overlay | BKLIT | CUSTOM | no | Unchanged from bklit (not WAAPI/framer).; TS-check: none — SMIL unsupported by TanStack motion (WAAPI-based) |
| Scrub-dim `opacity .25` via `transition: opacity 300ms ease-in-out` | overlay | BKLIT | CUSTOM | maybe | Replaces legacy `motion.g animate` (framer-motion) with plain CSS transition toggled imperatively.; TS-check: partial — mark `states`+`whenFocused` style opacity, but keyed to focus not scrubbing |
| `useId` namespaced ids (`bkm-live-*-`) | hook | BKLIT | TS-NATIVE | yes | Same pattern as legacy `useId`.; TS-check: CONTRADICTS yes — React useId, not a TanStack export |
| Container attrs/styles: `data-bkm-chart="liveline"`, `height:300`, `touchAction:none`, `isolation:isolate` | constant | BKLIT | CUSTOM | no | `data-bkm-chart` scopes styles.css rules.; TS-check: none — TanStack uses ts-chart-* host classes, no scoping attr export |
| `contextData`: window slice (one-point lookback) + 2 synthetic tip points | util fn | BKLIT | CUSTOM | no | Mirrors legacy 466–500; feeds marks + momentum.; TS-check: none — no window-slice/synthetic-datum helper |
| Committed-frame `xLabels`/`yTicks` memos (incl. ref-area label-color resolve, ±10px cull) | util fn | BKLIT | CUSTOM | no | Legacy computed these inside LiveXAxis/LiveYAxis components.; TS-check: none — TanStack axis ticks are renderer-internal |
| `yIntervalRef` hysteresis carry | hook | BKLIT | CUSTOM | no | Prevents jittery interval flips.; TS-check: none |
| `useChartMargin(marginProp, DEFAULT_MARGIN)` | hook | CUSTOM | TS-NATIVE | yes | Identity-stable margin (shared foundation hook).; TS-check: CONTRADICTS yes — migrated internal hook; TanStack margin is a plain defineChart option |
| `useMeasuredRect(containerRef)` | hook | CUSTOM | TS-NATIVE | maybe | Replaces visx `ParentSize debounceTime={10}`.; TS-check: partial — Chart host auto-resizes via ResizeObserver, but no React measurement-hook export |
| `useChartConfig()` (chart-config-context) | context | CUSTOM | CUSTOM-ON-TS | maybe | Supplies `tooltipSpring`/`tooltipBoxSpring` overrides to chrome.; TS-check: partial — tooltip extension has motion controller hooks, no spring-config React context |
| `chromeConfigRef` get-state callback convention | hook | CUSTOM | CUSTOM | no | Config read fresh on every chrome call; attach once per mount.; TS-check: none |
| `attachLiveHoverChrome` imperative chrome (indicator svg + dotLayer svg + box layer + pill + xlabel/ytick div layers appended to host div) | overlay | BKLIT | CUSTOM-ON-TS | no | Direct DOM mutation replacing legacy React portals (live-x-axis/live-y-axis `createPortal`) + ChartTooltip.; TS-check: none — no imperative-chrome API (tooltip extension is declarative) |
| Crosshair/dot/box reuse of shared `tooltip-chrome` builders (indicator/dot/box configs, `BOX_OFFSET=16` flip, WAAPI `boxFadeAnimation`) | overlay | CUSTOM | CUSTOM-ON-TS | no | Full `ChartTooltip` prop parity forwarded (dot*/indicator*/spring*/box*/rows/content/children).; TS-check: partial — crosshair mark covers rule/marker, not dot-layer/box-flip/WAAPI builders |
| Pill spring (`createSpring` on `left` px) | util fn | BKLIT | CUSTOM-ON-TS | maybe | Matches legacy `useSpring(pillX, {300,30})`; styled by `bkm-date-pill*` classes (legacy Tailwind zinc-900/zinc-100).; TS-check: partial — createChartSpring (@tanstack/charts/spring) is caller-sampled, no self-driving onUpdate |
| Y-tick enter/exit choreography (opacity transitions 220ms/150ms ease-out, `setTimeout` remove @200ms, per-key y-springs) | overlay | BKLIT | CUSTOM | maybe | Replaces framer `AnimatePresence` + `tickSpring`; edgeAlpha applied on rAF after insert.; TS-check: partial — motion enter/exit phases exist for marks, not DOM tick layers |
| X-label proximity fade (hide < `TICKER_HALF_WIDTH=50`, ramp over `FADE_BUFFER=20`) | util fn | BKLIT | CUSTOM | no | Constants from `design-tokens` (legacy inlined in live-x-axis).; TS-check: none — no label-proximity fade in TanStack axis options |
| `registerLiveGroups` scrub-dim (set 0.25 / restore 1) | util fn | BKLIT | CUSTOM | no | Combined multi-series registration (per-series ref callbacks would clobber siblings).; TS-check: none — no scene-group registry; nearest is mark states keyed on focus |
| Module-level `gradientCounter` chrome ids | constant | CUSTOM | CUSTOM | no | Dedupes shared tooltip-chrome ids across mounts.; TS-check: none — TanStack scopes ids via idPrefix internally |
| `defaultRowFormat = intFmt` export | util fn | CUSTOM | TS-NATIVE | no | Migrated-only export (extra vs legacy surface).; TS-check: none — Intl.NumberFormat wrapper, no TanStack formatter exports |
| CSS: `bkm-date-pill-layer/-pill/-inner`, `bkm-live-xlabel-layer/-xlabel`, `bkm-live-ytick-layer/-ytick` | CSS class | BKLIT | CUSTOM | no | From `styles.css` (verified present, lines 289–430); scoped by `[data-bkm-chart]`.; TS-check: none — TanStack ships ts-chart-* classes only |
| `ReferenceAreaLayers` + `createTickColorResolver` integration | overlay | CUSTOM | CUSTOM-ON-TS | maybe | Reference-area children supported (legacy passed children through generically); y-tick label color keyed to ref-area bands.; TS-check: partial — rect mark supports y1/y2 bands, no axis-label-color hook |

## Imports

From `live-line-chart.tsx`: `internal/reference-area-layer` (ReferenceAreaLayers), `internal/reference-area-geometry` (createTickColorResolver), `internal/formatters` (hmsTimeFmt), `internal/live-line-mark`, `internal/index` barrel (`useChartMargin`, `useMeasuredRect`), `internal/live-hover-chrome` (attachLiveHoverChrome + types), `internal/chart-config-context` (useChartConfig), `internal/types` (ChartDatum, ChartTooltipConfig, LiveLineConfig, LiveXAxisConfig, LiveYAxisConfig, MomentumColors), `./styles.css`; plus `./children` (roleOf) and external `@tanstack/react-charts` (Chart), `@tanstack/charts` (d3Curve, defineChart, ChartMark, createMark via mark module), d3-array/d3-scale/d3-shape.

From `internal/live-hover-chrome.ts`: `internal/formatters` (intFmt, shortDateFmt), `internal/spring` (createSpring), `internal/design-tokens` (BOX_OFFSET, FADE_BUFFER, TICKER_HALF_WIDTH, TOOLTIP_SPRING, TOOLTIP_BOX_SPRING), `internal/tooltip-chrome` (applyBoxContent, buildBox, buildDotLayer, buildIndicator, ensureDot, hideBoxContent, hideDot, positionBox, updateDotPosition + BoxConfig/DotConfig/IndicatorConfig), `internal/types` (ChartTooltipPoint).

From `internal/live-line-mark.ts`: `@tanstack/charts` (createMark, ChartCurve, ChartMark, SceneNode), `internal/types` (ChartDatum).

## Deviations

- `LiveYAxisConfig.position` accepts `"right"` but only `"left"` is implemented (documented pilot-scope carve-out in `internal/types.ts`); legacy live-y-axis rendered both sides.
- `PAUSED_FRAME_PIXEL_THRESHOLD=0.25` commit gate is a migrated-only behavior (legacy commits on the 32ms clock alone while paused).
- Wake-loop re-arm workaround (comment "audit §4 C2 stall") — fixes a paused-loop dead-end that bklit's never-sleeping loop masked; both `if (!shouldWake)` branches call `wakeLoopRef.current?.()`, making the branch redundant as written (suspicious duplication).
- `cursorStateRef` canvas-space margin snapshot (comment "audit §4 C3") — works around 32ms staleness between prop margin and chrome config.
- Chrome overlay host `<div>` intentionally rendered outside the `definition` conditional — first-commit width=0 otherwise leaves the chrome unmounted (documented attach-order bug workaround).
- Hover/tooltip resolution fully off React state — purer application of D16 than bklit's own hybrid (which still `setState`s `tooltipData`); visual parity preserved, but the legacy `shouldCommitLiveUpdates`/tooltip-key dedupe path has no counterpart.
- framer-motion usage eliminated: scrub-dim → CSS transition; LiveXAxis pill/labels & LiveYAxis ticks → custom springs + `styles.css` classes (legacy Tailwind zinc/date-label classes gone).
- `detectMomentum`/`Momentum` no longer exported (legacy public exports); `<LiveLine>` etc. became `null`-rendering carriers in `children.tsx`.
- Minor smells: `void input.width` dead param in `updateFrame`; trailing incomplete comment in live-hover-chrome ("Rebuild box springs… for live we keep that"); `buildBox(..., false)` 4th arg undocumented at call site.
- Legacy `extractLiveLineConfigs` matched children by `displayName === "LiveLine"` OR presence of `dataKey` prop — any child with a `dataKey` was treated as a line; migrated requires explicit CHART_ROLE (stricter; behavioral difference only for ad-hoc duck-typed children).
