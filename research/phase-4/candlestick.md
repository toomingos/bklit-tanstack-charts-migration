# candlestick — Phase 4 Research Report

**Files:** `showcase/migrated/charts/candlestick-chart.tsx`, `showcase/migrated/charts/internal/candlestick-focus-strategy.ts`, `showcase/migrated/charts/internal/candlestick-hover-chrome.ts`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/candlestick-chart.tsx`, `repos/bklit-ui/packages/ui/src/charts/candlestick.tsx`

## Feature summary

OHLC candlestick chart: wick + body `<rect>`s rendered by two custom TanStack `createMark` marks over raw, non-decimated data (D19 — legacy `decimateOhlcData` is dead code), with a staggered scaleY reveal (framer spring ported to WAAPI, plus a CSS `@keyframes` fast path) ending at a flat `animationDuration` deadline. Hover = TanStack-native `ChartFocusStrategy` (bisect-epoch, strict `>` tie-break) driving an imperative hover chrome (crosshair indicator, dot, tooltip box, date pill, group dim + highlight overlay). Neither impl exposes `onPhaseChange`/`status` — reveal completion stays internal (verified bklit parity).

## Public API

### `CandlestickChart` (`candlestick-chart.tsx`)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `CandlestickChart` | named export component | same | legacy also has a default export (see below) |
| `data` | `ChartDatum[]` | same | legacy `OHLCDataPoint[]`; migrated takes generic record |
| `xDataKey` | `string` = `"date"` | same | |
| `margin` | `Partial<Margin>` | same | default `{40,40,40,40}` both |
| `animationDuration` | `number` = `1100` | same | legacy doc comment says 1500, legacy code default is 1100 |
| `enterTransition` | `CandlestickEnterTransition` | same | type narrowed to spring subset `{duration?, bounce?}`; framer `Transition` (tween) dropped |
| `revealSignature` | `unknown` | same | legacy `string` → widened |
| `aspectRatio` | `string` = `"2 / 1"` | same | |
| `className` | `string` | same | |
| `style` | `React.CSSProperties` | same | migrated adds `isolation: isolate` |
| `candleGap` | `number` = `0.2` | same | |
| `candleWidth` | `number` | same | `min(raw, slotWidth)` formula identical |
| `xDomain` | `[Date, Date]` | missing | brush shared-scale support not migrated |
| `xDomainSlotCount` | `number` | missing | |
| `children` | `ReactNode` | same | compiled via `extractChildren` role markers |
| `CandlestickChartProps` | type export | same | |
| `CandlestickEnterTransition` | type export | extra | migrated-only spring-subset type |
| `OHLCDataPoint` | type export | missing | replaced by generic `ChartDatum` (`internal/types.ts`) |
| default export | export | missing | named export only |

### `<Candlestick>` child (config carrier — component lives in `children.tsx`, type in `internal/types.ts`; both out-of-part files)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `<Candlestick>` | child component | renamed | renders `null`; `CHART_ROLE` marker compiled into `defineChart` spec (legacy renders candles via `ChartProvider` context) |
| `animate` | `boolean` = `true` | same | accepted but inert — legacy gates reveal rendering on it |
| `positiveFill` | `string` | same | legacy default `url(#candlestick-positive)` gradient (both stops = solid emerald) vs migrated solid `var(--color-emerald-500)` — visually identical |
| `negativeFill` | `string` | same | same gradient-vs-solid note (red) |
| `bodyPatternPositive` | `string` | missing | pattern-overlay render path absent |
| `bodyPatternNegative` | `string` | missing | |
| `insideStrokeWidth` | `number` = `0` | same | prop resolved (line 178) but never consumed — inner inset stroke rect not rendered (see Deviations) |
| `fadedOpacity` | `number` = `0.3` | same | |
| `showHoverFade` | `boolean` = `true` | same | |

### Internal module exports (no legacy counterpart — bklit implements inline)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `createCandlestickFocusStrategy` + `CandlestickFocusStrategyArgs` | fn + type | extra | `ChartFocusStrategy` reproducing legacy `bisectDateLeft`/`resolveNearestIndex` strict `>` tie-break |
| `attachCandlestickHoverChrome` + `CandlestickHoverChromeOptions` | fn | extra | imperative chrome replacing legacy `useChartInteraction` + `ChartTooltip` + highlight re-render |
| `CandlestickHoverChrome` / `CandlestickHoverChromeState` / `CandlestickFocusPoint` / `CandleRectGeometry` | type exports | extra | |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `DEFAULT_ANIMATION_DURATION_MS` = 1100 | constant | BKLIT | CUSTOM | no | reveal deadline; TS-check: none as gate — note native motion defaultDuration is also 1100 (motion.ts) |
| `SOLID_POSITIVE` / `SOLID_NEGATIVE` (`var(--color-emerald-500)` / `var(--color-red-500)`) | constant | BKLIT | CUSTOM | no | also default wick/body fill; TS-check: none |
| `WICK_WIDTH_PX` = 1.5 | constant | BKLIT | CUSTOM | no | rect width, ported as-is; TS-check: none |
| `DEFAULT_ENTER_DURATION_SEC` = 0.8, `DEFAULT_ENTER_BOUNCE` = 0.15 | constant | BKLIT | CUSTOM | no | legacy `defaultEnter` spring; TS-check: partial — native spring transition uses stiffness/damping, no duration/bounce |
| `OPACITY_TWEEN_MS` = 150 | constant | BKLIT | CUSTOM | no | undelayed opacity fade, all candles; TS-check: CONTRADICTS no — partial; generic enter-opacity track exists but shares element timing |
| `DEFAULT_MARGIN` {40×4} | constant | BKLIT | CUSTOM | no | ; TS-check: partial — defineChart margin option native; 40px default is bklit-specific |
| `candleGap` default 0.2 | constant | BKLIT | CUSTOM | no | ; TS-check: none (padding exists only on band scales, not time slots) |
| yDomain pad 5% (flat 1 fallback) + `.nice()` at scale | constant | BKLIT | CUSTOM | no | low/high min/max; TS-check: CONTRADICTS no — partial; axis `nice` option native (scale-input.ts), 5% pad custom |
| `staggerBaseMs` = `duration*0.6/n` | constant | BKLIT | CUSTOM | no | per-candle delay; TS-check: CONTRADICTS no — partial; native `stagger({each})` gives per-datum delay, 0.6 ratio caller-side |
| body rect `rx=1` + self-stroke `strokeWidth 1` | constant | BKLIT | CUSTOM | no | ; TS-check: none (radius/stroke are native SceneRect props) |
| CSS fast-path tolerance `\|bounce−0.15\| < 1e-6` | constant | CUSTOM | CUSTOM | no | gates keyframes path; TS-check: none |
| spring keyframe sampling = 60 points | constant | CUSTOM | CUSTOM | no | WAAPI fallback curve; TS-check: none (native motion samples springs per-frame, no keyframe pre-sampling) |
| `data-bkm-chart="candlestick"` container attr | constant | CUSTOM | CUSTOM | no | chrome container lookup; TS-check: none |
| `SVG_NS` + module-level `chromeCounter` | constant | CUSTOM | CUSTOM | no | hover-chrome module; TS-check: none |
| `DIM_TRANSITION` `"opacity 0.15s ease-in-out"` | constant | BKLIT | CUSTOM | no | group dim transition; TS-check: none (native dimming is per-mark state styles, not a shared CSS transition) |
| hover dot: r=5, fill `var(--chart-line-primary)`, stroke `var(--chart-background)` w=2 | constant | BKLIT | CUSTOM | no | single circle, not per-series; TS-check: CONTRADICTS no — partial; native `crosshair` marker option draws focused-point dot |
| reveal deadline `setTimeout(animationDuration)` + epoch guard | side-effect | BKLIT | CUSTOM | maybe | forces end state, enables interaction; TS-check: none — native motion has no completion callback; svgAnimation:false skips motion |
| WAAPI reveal fallback `rect.animate(scaleY keyframes)` + `.cancel()` at deadline/unmount | side-effect | BKLIT | CUSTOM | no | used when bounce ≠ 0.15; TS-check: none — native motion animates attrs/opacity, never scaleY transforms |
| CSS fast path: inline `animation-*` writes → `ts-candle-reveal`; cleared via `animationName="none"` | side-effect | CUSTOM | CUSTOM | no | avoids ~20k WAAPI objects at n=10000; TS-check: none |
| rAF phase-2 opacity flip (0 → 1 next frame) | side-effect | BKLIT | CUSTOM | no | shared 150ms CSS transition; TS-check: none |
| `onPostPaint` deferred reveal (2×rAF + macrotask past commit) | side-effect | CUSTOM | CUSTOM | maybe | shared `deferred-reveal`; TS-check: none — no post-commit paint hook exported |
| `dataset.bkmRevealed` guard on `.ts-chart__marks` + `--revealing` class toggle | side-effect | CUSTOM | CUSTOM | no | D218 replay-guard workaround; TS-check: none |
| per-rect `transformOrigin` / `opacity` inline style writes | side-effect | BKLIT | CUSTOM | no | TS-check: none |
| hover chrome imperative DOM (append layers, `setAttribute` geometry, display toggles) | side-effect | BKLIT | CUSTOM | no | no React for default chrome; TS-check: none — native tooltip is its own extension; chrome visuals (pill, box) not offered |
| `createSpring` rAF springs (dot x/y, indicator, box, pill) | side-effect | BKLIT | CUSTOM | no | shared `spring.ts`; TS-check: CONTRADICTS no — partial; native `createChartSpring` (@tanstack/charts/spring) is same analytic damped oscillator |
| `useChartSelection` + drag listeners (`onDragStart/End` suppress chrome) | side-effect | BKLIT | CUSTOM-ON-TS | maybe | mirrors legacy `use-chart-interaction`; TS-check: partial — native `brushX` control (@tanstack/charts/interaction/brush) covers drag-range, lacks per-candle snap + chrome suppression |
| TanStack `<Chart onRender>` → `handleRender` reveal setup | side-effect | TANSTACK | TS-NATIVE | yes | already native channel; TS-check: native — confirmed `onRender` in react-charts ChartCommonProps |
| TanStack `<Chart onFocusGroupChange>` → chrome adapter | side-effect | TANSTACK | TS-NATIVE | yes | replaces legacy pointermove/bisect listener; TS-check: native — confirmed `onFocusGroupChange` prop |
| `ChartSelectionContext.Provider` | context | BKLIT | CUSTOM-ON-TS | maybe | wraps whole chart; TS-check: none — native selection is `keyedSelection` controller, not React context |
| `useChartConfig` (tooltip springs) | context | CUSTOM | CUSTOM | maybe | `chart-config-context`; TS-check: none — springs passed natively via tooltip motion transition, no config context |
| `useChartLegendHover` | hook | BKLIT | CUSTOM | maybe | legend index → wick/body dim; TS-check: CONTRADICTS maybe — no; native `interactiveColorLegend` only toggles visibility, never hover-dim |
| `useChartMargin` + `useContainerWidth` (internal barrel) | hook | BKLIT | CUSTOM | maybe | replaces `ParentSize`; TS-check: none — react-charts measures internally, exposes no width callback |
| `canInteractRef` boolean gate | hook | BKLIT | CUSTOM | maybe | plain boolean vs legacy ChartPhase/isLoaded; TS-check: none |
| `wicksMark` — custom `createMark`, per-candle rect (low→high, w=1.5) | mark | BKLIT | CUSTOM-ON-TS | no | D85.1: stock `link()` reverted; TS-check: none — nearest stock marks (`rect()`, `ruleY()`) can't emit fixed-px wick rect with candle fill logic |
| `bodiesMark` — custom `createMark`, per-candle rect (open→close, rx 1) | mark | BKLIT | CUSTOM-ON-TS | no | D85.1 revert rationale; TS-check: none — stock `rect()` defaults inset 0.75 and lacks open/close conditional fill |
| custom x `ChartScale` — `scaleUtc`, `resolve()` insets range by `slotWidth/2` | util fn | BKLIT | CUSTOM-ON-TS | no | D110 escape hatch; TS-check: none — native scales re-range to full plot width; no slot-inset/padding option |
| y `ChartScale` — `scaleLinear().domain(yDomain).nice()` in `resolve()` | util fn | BKLIT | TS-NATIVE | yes | native custom-scale API; TS-check: native — custom `ChartScale` object + `@tanstack/charts/scales/linear` scaleLinear (has `.nice()`) |
| `yScaleForChrome` — duplicate local scale for focus-point y px | util fn | CUSTOM | CUSTOM | maybe | no d3 ref stashed; TS-check: partial — `onRender` context exposes `scene.scales.y` for direct mapping |
| `xScaleCandleSel` — duplicate `scaleUtc` for selection invert | util fn | CUSTOM | CUSTOM | maybe | TS-check: partial — resolved scales carry `invert`; reachable via `onRender` scene |
| `yAxisTicks` — third duplicate scale + `resolveYAxisTickCount` clamp | util fn | BKLIT | CUSTOM | maybe | "independently exact" pattern; TS-check: partial — axis ticks rendered natively from scale.ticks; bklit HTML-overlay styling not offered |
| `timeExtent` / `timeExtentCandle` — duplicated min/max epoch computation | util fn | BKLIT | CUSTOM | maybe | two copies in one file; TS-check: none — domain inference internal to resolveScaleInput, not exported |
| `XAxisOverlay` | overlay | BKLIT | CUSTOM | maybe | slot-inset range, HTML; TS-check: partial — native axis guides render tick labels; no HTML overlay or slot-inset positioning |
| `YAxisOverlay` | overlay | BKLIT | CUSTOM | maybe | left-orientation HTML; TS-check: partial — native y-axis labels exist; left-orientation HTML overlay not offered |
| `ReferenceAreaLayers` | overlay | BKLIT | CUSTOM-ON-TS | maybe | `isCandlestickXScale` geom flag; TS-check: partial — no reference-area feature; generic `decorative()` mark (@tanstack/charts/mark/decorative) only |
| `SegmentOverlay` | overlay | BKLIT | CUSTOM-ON-TS | maybe | drag-selection visuals; TS-check: partial — `brushX` control paints selection rect + handles natively; per-segment React visuals not offered |
| hover-chrome overlay host div (`pointer-events:none`) | overlay | CUSTOM | CUSTOM | no | mounted only when tooltip enabled; TS-check: none |
| `candlestick-focus-strategy` (resolve/group/navigation) | util fn | BKLIT | CUSTOM-ON-TS | yes | already on native `ChartFocusStrategy` API; TS-check: native — ChartFocusStrategy + focusGroupX/focusNearestX presets (@tanstack/charts/focus); strict-> bisect stays custom |
| `svgAnimation:false`, `focusRing:false`, `maxFocusDistance:∞` | constant | CUSTOM | TS-NATIVE | yes | native `defineChart` options; TS-check: native — all three confirmed in types.ts ChartDefinitionOptions |
| `.ts-chart__marks--revealing` (group hidden pre-paint) | CSS class | CUSTOM | CUSTOM | no | `styles.css`; TS-check: none |
| `@keyframes ts-candle-reveal` (60-sample scaleY curve) | CSS class | CUSTOM | CUSTOM | no | `styles.css`; TS-check: none |
| `[data-bkm-chart="candlestick"] .ts-chart__candle rect { transition: opacity 150ms }` | CSS class | BKLIT | CUSTOM | no | `styles.css`; TS-check: none |
| `.chart-candle-cell` (per-rect opacity transition; legend dim rides it) | CSS class | BKLIT | CUSTOM | no | `styles.css`, D224; TS-check: none |
| `.ts-chart__candle` group class + `[data-ts-key="wicks"\|"bodies"]` selectors | CSS class | CUSTOM | CUSTOM | no | query hooks for reveal + dim; TS-check: partial — svg-renderer emits data-ts-key attrs natively; class names authored by custom marks |
| `.ts-chart__marks` (reveal query target; fade-edges rules also apply) | CSS class | CUSTOM | CUSTOM | no | `styles.css`; TS-check: CONTRADICTS no — class emitted natively by scene.ts marks group |
| `.bkm-hover-layer` (chrome svg layers) | CSS class | BKLIT | CUSTOM | no | shared chrome convention; TS-check: none |

## Imports

`internal/` modules imported by the part's files:

- **In-part:** `internal/candlestick-focus-strategy.ts`, `internal/candlestick-hover-chrome.ts`
- **internal-animation:** `candle-spring` (`sampleSpringKeyframes` — reassigned to shared group, not in this part's scope), `deferred-reveal` (`onPostPaint`), `spring` (`createSpring`, via hover chrome)
- **internal-interaction:** `chart-selection` (`ChartSelectionContext`, `extractSegmentComponents`, `useChartSelection`), `segment-visuals` (`SegmentOverlay`), `tooltip-chrome` (`buildBox`/`buildPill`/`buildIndicator`/`positionBox`/`applyBoxContent`/`applyLabelFade`/`hideBoxContent`/`resetLabelFade` + types)
- **internal-axes-grid:** `reference-area-layer`, `reference-area-config`, `x-axis-overlay`, `y-axis-overlay`, `y-axis-ticks` (`resolveYAxisTickCount`), `use-chart-margin` + `use-container-size` (via `internal/index.ts` barrel)
- **internal-legend-markers:** `chart-legend-hover` (`useChartLegendHover`)
- **internal-foundation:** `chart-config-context` (`useChartConfig`), `design-tokens` (`BOX_OFFSET`, `DISCRETE_INTERACTION_THRESHOLD`, `FADE_BUFFER`, `TICKER_HALF_WIDTH`, `TOOLTIP_SPRING`, `TOOLTIP_BOX_SPRING`), `types` (`ChartDatum`, `ChartTooltipConfig`), `formatters` (`shortDateFmt`, `weekdayDateFmt`), `parse-aspect-ratio`, `styles.css`

Non-internal: `./children` (`extractChildren`), `@tanstack/react-charts` (`Chart`), `@tanstack/charts` (`defineChart`, `createMark` + types), `d3-scale`.

## Deviations

- `insideStrokeWidth` is resolved from config but never consumed — legacy's inner inset stroke rect (drawn when > 0) is not rendered.
- `bodyPatternPositive`/`bodyPatternNegative` have no migrated equivalent (pattern-overlay body path absent).
- `xDomain`/`xDomainSlotCount` dropped — brush shared-scale scenario unsupported.
- No default exports (legacy has them for both modules); `OHLCDataPoint` replaced by generic `ChartDatum`.
- `<Candlestick animate>` accepted but inert (legacy gates the reveal render path on it).
- `enterTransition` narrowed to spring `{duration, bounce}` — framer tween transitions unsupported.
- Hover dim restructured: group-level dim of both mark groups + overlay highlight rects, vs legacy per-candle `<g>` opacity + re-rendered highlight body on top.
- Reveal replay guard is a DOM `dataset.bkmRevealed` + data-identity ref workaround (D218) for TanStack recreating the marks group on legend hover.
- Dual reveal code path: CSS `@keyframes` fast path only valid at bounce = 0.15 (1e-6 tolerance); WAAPI fallback otherwise.
- Scale math duplicated 4× (definition `yScale`, `yScaleForChrome`, `yAxisTicks`, `xScaleCandleSel` vs x `resolve`) — deliberate "independently exact" pattern, flagged as suspicious duplication.
- `dateLabelsForPill` uses `toLocaleDateString("en-US")` while the chrome's fallback pill label uses shared `shortDateFmt` — two date-format paths for the same pill.
- `_tooltipBoxSpring` accepted then `void`ed in `attachCandlestickHoverChrome` — dead option.
- Legacy doc comment claims `animationDuration` default 1500; legacy code default is 1100 (doc bug — migrated matches the code).
- D85.1: stock TanStack `link()` marks tried and reverted (round caps protrude past flat rect ends at both n=100 and n=1000) — custom marks justified per PLAN 1.2.
