# internal-interaction — Phase 4 Research Report

**Files:** `showcase/migrated/charts/internal/hover-chrome.ts`, `use-hover-chrome.ts`, `tooltip-chrome.ts`, `tooltip-scheduler.ts`, `hover-reanchor.ts`, `bisect.ts`, `chart-selection.ts`, `pie-hover-chrome.ts`, `segment-visuals.tsx`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/use-chart-interaction.ts`, `use-scheduled-tooltip.ts`, `tooltip/` (`chart-tooltip.tsx`, `tooltip-box.tsx`, `tooltip-indicator.tsx`, `tooltip-dot.tsx`, `tooltip-content.tsx`, `date-ticker.tsx`), `series-hover-dim.tsx`, `series-highlight-layer.tsx` + `highlight-segment-bounds.ts`, `series-point-marker.tsx` / `series-markers.tsx`, `x-axis.tsx` (label fade), `segment.tsx` + `use-highlight-segment.ts`, `pie-slice.tsx` + `pie-context.tsx`

## Feature summary

Shared imperative hover/tooltip/selection machinery consumed by line, area, bar, composed, scatter, candlestick, live-line and the pie family (pie/ring/funnel). Ports bklit's declarative React tooltip stack (crosshair indicator, focus dots, floating box, date pill/ticker, series dim, highlight band, marker active highlight) into a zero-React-state `attachHoverChrome` overlay driven by springs + direct DOM/WAAPI writes; plus drag/two-finger segment selection, x-domain-aware focus gating, re-anchor-on-data-change, and pie slice hover (translate/grow/fade). Segment visuals render the drag-selection band + boundary lines for the `segment` add-on.

## Public API

Shared internal group — no public chart API; table covers the group's exported surface, parity vs the legacy modules listed above.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `attachHoverChrome` | fn | renamed | Imperative factory porting the whole declarative stack (use-chart-interaction + tooltip/* + SeriesHoverDim + SeriesHighlightLayer + point-marker active highlight); behavior-preserving |
| `HoverChrome` | interface | extra | Factory handle: `onFocusGroupChange` / `reanchor` / `syncDim` / `detach` |
| `HoverChromeState` | interface | extra | Per-frame state bag replacing legacy React props/context reads |
| `HoverChromeSeries` | interface | renamed | Legacy `LineConfig` subset (dataKey/color/strokeWidth/showHighlight/marker) |
| `FocusPoint` | interface | renamed | Legacy `TooltipData` point entry (markId/datum/datumIndex/x/y/color) |
| `HoverReanchor` | type | extra | `() => void` type alias (D4) |
| `HoverChromeOptions` | interface | extra | dimOpacity + spring overrides (`tooltipBoxSpring` accepted but ignored — see Deviations) |
| `useHoverChrome` | hook | same | Ports use-chart-interaction wiring: drag suppression, reanchor-on-change effect, syncDim-on-legend effect, phase gating, xDomain clamp |
| `UseHoverChromeOptions` | interface | extra | Incl. line-only `onFocusPoints` sign-flip hook |
| `UseHoverChromeResult` | interface | extra | Refs + `dateLabelsForPill` + gated focus handler |
| `HoverChromeFocusPoint` | type | renamed | `ChartPoint<ChartDatum, Date, number>` (TanStack) ≈ legacy `TooltipData` |
| `resolveIndicatorWidth` | fn | renamed | = legacy `resolveWidth` in tooltip-indicator.tsx (line 1/thin 2/medium 4/thick 8) |
| `resolveIndicatorPixelWidth` | fn | same | = legacy inline `span*columnWidth ?? resolveWidth` |
| `IndicatorWidth` | type | same | Same union as legacy tooltip-indicator.tsx |
| `DotVariant` | type | same | `"dot" \| "ring"` (legacy inline prop union) |
| `TooltipRow` | interface | same | = legacy tooltip-content.tsx `TooltipRow` |
| `IndicatorConfig` | interface | extra | Config bag extracted from legacy `ChartTooltipProps` subset |
| `DotConfig` | interface | extra | ditto |
| `BoxConfig` | interface | extra | ditto |
| `resolveBoxSpring` | fn | same | = legacy `boxMotion` memo in chart-tooltip.tsx (boxSpringConfig → matchCrosshair → resolveTooltipBoxMotion) |
| `SharedTooltipChromeOptions` | interface | extra | Aggregates the three config bags |
| `IndicatorBuild` | interface | extra | Build handle |
| `buildIndicator` | fn | same | Ports TooltipIndicator (dashed line / solid rect / fade-gradient rect + x springs) |
| `positionIndicator` | fn | extra | Y/height placement split out (legacy did it via render props) |
| `DotLayer` | interface | extra | Build handle |
| `buildDotLayer` | fn | extra | SVG layer + per-key element/spring maps |
| `ensureDot` | fn | same | Ports TooltipDot create/update (circle or rounded-square ring) |
| `updateDotPosition` | fn | same | Spring set/jump (dots always spring, per legacy) |
| `hideDot` | fn | extra | Display toggle split out |
| `BoxBuild` | interface | extra | Build handle |
| `buildBox` | fn | same | Ports TooltipBox DOM + entrance spring + content/children React roots |
| `positionBox` | fn | same | Ports flip-at-right-edge + top/bottom clamp + fallback 180×80 |
| `applyBoxContent` | fn | same | Ports TooltipContent row diffing + custom `content`/`children` renders (scheduler-coalesced) |
| `hideBoxContent` | fn | extra | Content clear split out |
| `PillBuild` | interface | extra | Build handle |
| `buildPill` | fn | same | Ports DatePillTracker + DateTicker mount (incl. month/day ticker) |
| `applyLabelFade` | fn | same | Ports x-axis.tsx x-label fade (distance-based opacity) |
| `resetLabelFade` | fn | extra | Restore-all split out |
| `TooltipSchedulerOptions` | interface | extra | `{ commit }` callback shape (legacy committed via setState) |
| `TooltipScheduler` | interface | extra | schedule/clear/resetDedupe/dispose |
| `createTooltipScheduler` | fn | same | Ports useScheduledTooltip rAF coalesce + dedupe, render-free |
| `ReanchorOptions` | interface | extra | Pure-fn param bag (legacy: hook closure) |
| `reanchorHoverChrome` | fn | same | Ports use-chart-interaction re-anchor effect (invert lastX → bisect → nearest → resolve/clear) |
| `bisectDateLeft` | fn | renamed | Legacy used visx `bisector(...).left` injected as param; now an owned generic |
| `resolveNearestIndex` | fn | same | Ports `resolveTooltipFromX`/`resolveIndexFromX` nearest-datum strict-`>` tie-break |
| `ChartSelection` | interface | same | Same shape as legacy use-chart-interaction.ts `ChartSelection` |
| `useSegmentVisibility` | hook | renamed | = legacy private `useSegmentVisibility` in segment.tsx (>5px) |
| `useChartSelection` | hook | same | Ports drag/touch selection branch of use-chart-interaction (pointer + 2-finger touch) |
| `ChartSelectionContext` | context | extra | Legacy selection flowed through chart-context |
| `useChartSelectionContext` | hook | extra | ditto |
| `SegmentComponent` | interface | extra | Compiled children add-on descriptor (duplicated in segment-visuals.tsx — see Deviations) |
| `extractSegmentComponents` | fn | extra | Legacy rendered `SegmentBackground/LineFrom/LineTo` declaratively; migrated compiles CHART_ROLE-marked children |
| `PieSliceHoverEffect` | type | same | `"translate" \| "grow" \| "none"` = legacy pie-slice.tsx |
| `FADE_OPACITY` | constant | same | 0.4 = legacy `isFaded ? 0.4 : 1` |
| `PieHoverCoordinator` | interface | extra | Pub/sub handle |
| `createPieHoverCoordinator` | fn | renamed | Ports pie-context `PieHoverContext` controlled/uncontrolled split (isControlled ? onHoverChange : set+notify) |
| `PieSliceHoverConfig` | interface | extra | Per-slice geometry/effect bag |
| `PieSliceHoverRuntime` | interface | extra | update/paint/stop handle |
| `createPieSliceHoverRuntime` | fn | same | Ports pie-slice.tsx motion.path hover: translate x/y springs {400,25}, grow radius spring regenerating `d`, fade 0.4/0.15s, glow dead-code parity |
| `SegmentLineVariant` | type | same | `"dashed" \| "solid" \| "gradient"` = legacy segment.tsx |
| `SegmentComponent` | interface | extra | Duplicate of chart-selection.ts's (see Deviations) |
| `SegmentOverlay` | component | renamed | Ports SegmentBackground + SegmentLineFrom + SegmentLineTo as one overlay |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `attachHoverChrome` overlay factory | util fn | BKLIT | CUSTOM-ON-TS | maybe | One imperative owner replacing ~8 legacy declarative components; TS-check: partial — compose crosshair()/tooltip/mark-states; no single factory |
| Highlight band (clipPath rect + per-series cloned paths + x/width springs) | overlay | BKLIT (SeriesHighlightLayer/HighlightSegment) | CUSTOM-ON-TS | no | Band = x(idx−1)..x(idx+1) clamped; 400ms WAAPI fade-in on show; highlightSpring {180,28}; TS-check: partial — crosshair().x.band lacks per-series clones/clipPath |
| Marker-active layer (scaled marker clones) | overlay | BKLIT (SeriesPointMarker active highlight) | CUSTOM-ON-TS | no | scale 1.35; outline/fill/ring circle stack mirrors MarkerCircles; TS-check: partial — crosshair().marker / dot-state r lack scaled clones |
| Series path/area/dash-tail dim | side effect (direct DOM style) | BKLIT (SeriesHoverDim) | CUSTOM-ON-TS | no | opacity 0.3 (area 0.6), 0.4s ease-in-out; queries `.ts-chart__line`/`__area`/`[data-bkm-dash-tail]`; TS-check: CONTRADICTS no — native mark states when.focus:"unmatched" opacity |
| Marker dim (opacity + blur) | side effect | BKLIT (series-markers fadeOnHover) | CUSTOM-ON-TS | no | 0.5 opacity, blur 2px, 0.15s; TS-check: partial — states cover opacity; blur/filter unsupported |
| Bar row dim | side effect | BKLIT (series-bar.tsx:127-137 bar-only index space) | CUSTOM-ON-TS | no | per-rect opacity w/ 0.12s transition; rect cache invalidated on group identity change; TS-check: CONTRADICTS no — native bar states opacity per datum |
| Crosshair indicator (dashed/solid/fade-gradient + springs) | overlay | BKLIT (TooltipIndicator) | CUSTOM-ON-TS | no | jump on show or discrete (>60 pts); fadeLength 10; `var(--chart-crosshair)`; TS-check: partial — crosshair() dashed/solid+motion lacks fade-gradient |
| Focus dots (circle / rounded-square ring + x/y springs) | overlay | BKLIT (TooltipDot) | CUSTOM-ON-TS | no | always springs (bklit never passes discrete to TooltipDot); stroke `var(--chart-background)`; TS-check: partial — focusRing/crosshair().marker lack square-ring springs |
| Tooltip box (panel + rows + flip/clamp + entrance) | overlay | BKLIT (TooltipBox + TooltipContent) | CUSTOM-ON-TS | no | flip at right edge; clamp with offset 16; entrance translateX ±20, scale 0.85→1, spring {300,25}; 100ms WAAPI fade; TS-check: CONTRADICTS no — native tooltip ext rows/placement-auto/motion |
| Custom `content`/`children` React roots | side effect (createRoot portals) | BKLIT (createPortal) | CUSTOM-ON-TS | no | commits coalesced through tooltip-scheduler; dedupe key `index:JSON(point)`; TS-check: CONTRADICTS no — native tooltip.content + React renderTooltipBody |
| Date pill + month/day ticker | overlay | BKLIT (DatePillTracker + DateTicker) | CUSTOM-ON-TS | no | compact mode >60 labels; stacks springs {400,35}; item height 24px; TS-check: none |
| X-label fade | side effect | BKLIT (x-axis.tsx) | CUSTOM-ON-TS | no | `[data-bkm-xlabel]` opacity by distance; half-width 50, buffer 20; TS-check: none |
| Reanchor flow (lastX → invert → bisect → nearest → resolvePoints) | util fn | BKLIT (use-chart-interaction re-anchor effect) | CUSTOM-ON-TS | maybe | no-op unless chart populates reanchor fields (D4); phase+loaded gated; TS-check: partial — controlled-focus retarget + focusNearestX; no re-anchor API |
| Dot color resolution chain (rows color → dotColor fn/str → series/point) | util fn | BKLIT (ChartTooltip resolveDotColor) | TS-NATIVE | maybe | private in hover-chrome.ts; TS-check: partial — point.color/channels lack dotColor-fn override chain |
| `DIM_OPACITY "0.3"` | constant | BKLIT (line.tsx `dimOpacity={0.3}`) | CUSTOM | no | overridable via options/state; TS-check: none — value authored by caller, states carry it |
| Area dim 0.6 (caller `AREA_DIM_OPACITY`) | constant | BKLIT (area.tsx `dimOpacity={0.6}`) | CUSTOM | no | lives in area-chart.tsx, passed via useHoverChrome; TS-check: none |
| `DIM_TRANSITION 0.4s` / `BAR_DIM_TRANSITION 0.12s` / `MARKER_DIM_TRANSITION 0.15s` | constant | BKLIT | CUSTOM | no | ease-in-out; 0.12s bar value not re-verified in legacy source; TS-check: partial — states accept spring/tween transition, not per-value CSS durations |
| `MARKER_DIM_OPACITY 0.5` / `MARKER_DIM_BLUR_PX 2` / `MARKER_ACTIVE_SCALE 1.35` | constant | BKLIT (inactiveOpacity 0.5, inactiveBlur 2 defaults; 1.35 not re-verified) | CUSTOM | no | TS-check: partial — opacity via states; blur/scale unsupported |
| WAAPI fades: highlight 400ms ease-in-out, box 100ms | constant | BKLIT (motion initial/animate fades) | CUSTOM | no | `fill: "both"`, cancelled on hide; TS-check: partial — motion tweens cover fades; no WAAPI fill-both control |
| `TOOLTIP_SPRING {300,30}` / `HIGHLIGHT_SPRING {180,28}` | constant | BKLIT (ChartConfigProvider defaults) | CUSTOM | no | imported from design-tokens; TS-check: partial — ChartMotionSpringTransition stiffness/damping, different token source |
| `BOX_OFFSET 16` / `BOX_FALLBACK_WIDTH 180` / `BOX_FALLBACK_HEIGHT 80` | constant | BKLIT (TooltipBox offset 16, width/height refs 180/80) | CUSTOM | no | TS-check: partial — tooltip.offset exists; no measured-size fallbacks needed natively |
| `ENTRANCE_SPRING {300,25}` + entrance offsets ±20 / scale 0.85 | constant | BKLIT (TooltipBox inner spring 300/25, initial x ±20 scale 0.85) | CUSTOM | no | transformOrigin flips left/right top; TS-check: none |
| `TICKER_ITEM_HEIGHT 24` + ticker springs {400,35} + compact threshold 60 | constant | BKLIT (DateTicker constants) | CUSTOM | no | month/day split by " "; TS-check: none |
| Dot defaults: size 5, strokeWidth 2 (ring 1.5), radiusFraction 0.25 | constant | BKLIT (TooltipDot defaults) | CUSTOM | no | ring corner = side × clamp(fraction, 0..0.5); TS-check: partial — focus-guide marker radius 5/stroke 1.5 near-miss |
| Indicator fadeLength 10; `var(--chart-crosshair)` / `var(--chart-background)` colors | constant | BKLIT | CUSTOM | no | TS-check: partial — crosshair() theme.foreground/background vars; no fadeLength |
| `DISCRETE_INTERACTION_THRESHOLD 60` | constant | BKLIT (`dateLabels.length > 60`) | CUSTOM | no | jump-instead-of-spring above threshold; TS-check: none |
| DOM query contract: `.ts-chart__marks`, `.ts-chart__line[data-ts-key^=k:]`, `.ts-chart__area[k__fill]`, `.ts-chart__dot[k__marker]`, `.ts-chart__bar-y[k]`, `[data-bkm-dash-tail]` | CSS class | CUSTOM (TanStack mark DOM contract) | CUSTOM | no | dataKey `"` escaped in selectors; tight coupling to mark DOM shape; TS-check: native — classes emitted by charts-core/d3 line.ts,area.ts,dot.ts,bar.ts |
| styles.css classes: `bkm-hover-layer`, `bkm-tooltip-layer/panel/content/title/rows/row/row-label/swatch/series/value`, `bkm-date-pill-layer/pill/inner` | CSS class | BKLIT (Tailwind equivalents) | CUSTOM | no | styles.css 201–323 port legacy Tailwind utility classes; TS-check: none |
| `gradientCounter` module-global id | constant | CUSTOM | CUSTOM | no | unique `bkm-highlight-clip-{n}` / gradient ids per chrome; TS-check: none |
| `void options.tooltipBoxSpring` | constant | CUSTOM | CUSTOM | no | option accepted but unused (deviation); TS-check: none |
| `useHoverChrome` | hook | BKLIT (use-chart-interaction wiring) | CUSTOM-ON-TS | maybe | owns refs, attach useLayoutEffect, reanchor + syncDim effects, phase gate, xDomain clamp; TS-check: none — no React hook layer for chrome |
| `dragSelectionActiveRef` hover suppression | hook state | BKLIT (mousedown clears tooltip) | CUSTOM-ON-TS | no | caller sets it from useChartSelection's onDragStart; TS-check: partial — brushX emits preview/cancel, no auto tooltip suppression |
| `focusOutsideXDomain` clamp | util fn | BKLIT (documented divergence: legacy bisects visiblePlotData) | CUSTOM-ON-TS | no | migrated bisects full data + explicit inclusive-domain clamp; TS-check: none |
| `dateLabelsForPill` memo | util fn | BKLIT (chart-context dateLabels) | CUSTOM-ON-TS | maybe | en-US short month/day via toLocaleDateString; TS-check: none — only ad-hoc toLocaleDateString in crosshair/brush defaults |
| `resolveIndicatorWidth` / `resolveIndicatorPixelWidth` | util fn | BKLIT (resolveWidth) | TS-NATIVE | maybe | pure; TS-check: none — no width-token resolver in TanStack |
| `resolveBoxSpring` | util fn | BKLIT (boxMotion memo) | TS-NATIVE | maybe | pure; uses resolveTooltipBoxMotion from chart-config-context; TS-check: partial — tooltip.motion accepts ChartMotionSpringTransition directly |
| `ringCornerRadius` | util fn | BKLIT (same-named fn in tooltip-dot.tsx) | TS-NATIVE | maybe | pure; TS-check: none |
| `createTooltipScheduler` | util fn | BKLIT (useScheduledTooltip) | CUSTOM-ON-TS | maybe | rAF coalesce + last-write-wins + dedupe; commit thunk instead of setState; TS-check: partial — native tooltip paints per-frame internally, no exposed scheduler |
| `defaultDedupeKey` | util fn | BKLIT (identical fn) | TS-NATIVE | maybe | `${index}:${round(x)}`; TS-check: none |
| `reanchorHoverChrome` | util fn | BKLIT (re-anchor effect) | CUSTOM-ON-TS | maybe | pure-ish (callbacks in/out); TS-check: partial — controlled focus retargets natively; no re-anchor fn |
| Private `bisectDateLeft` in hover-reanchor.ts | util fn | BKLIT | TS-NATIVE | maybe | near-duplicate of `./bisect` export (deviation); TS-check: none — no bisect helper in TanStack; TS-NATIVE impl wrong |
| `bisectDateLeft` (bisect.ts) | util fn | BKLIT (visx/d3 bisector.left) | TS-NATIVE | yes | standard leftmost bisect; TS-check: CONTRADICTS yes — no bisect/bisector export in TanStack |
| `resolveNearestIndex` | util fn | BKLIT (resolveTooltipFromX tie-break) | TS-NATIVE | yes | strict `>` toward earlier point; TS-check: native — findNearestPoint (@tanstack/charts/scene) |
| `useChartSelection` | hook | BKLIT (drag/touch branch of use-chart-interaction) | CUSTOM-ON-TS | maybe | pointerdown/move/up on element+window, setPointerCapture; 2-finger touch `{passive:false}` + preventDefault; TS-check: partial — brushX covers drag range, lacks 2-finger segment gesture |
| `useSegmentVisibility` | hook | BKLIT (segment.tsx) | TS-NATIVE | maybe | `active && |endX−startX| > 5`; TS-check: none |
| `ChartSelectionContext` + `useChartSelectionContext` | context | CUSTOM (legacy: chart-context field) | CUSTOM-ON-TS | no | provided by consuming charts; TS-check: none — keyedSelection is controller-based, not React context |
| `extractSegmentComponents` | util fn | CUSTOM (children add-on compile step) | CUSTOM | no | recursive `Symbol.for("migrated.chartRole")` walk; TS-check: none |
| `SegmentOverlay` | component | BKLIT (segment.tsx) | CUSTOM-ON-TS | maybe | single overlay vs three components; absolute svg at margin origin; TS-check: partial — bandX/bandY render static bands, not drag-linked overlays |
| Segment gradient stops 0/10/90/100% + dashed `"4,4"` + 150ms ease-out | constant | BKLIT (identical stops/dash/duration) | CUSTOM | no | TS-check: partial — ChartGradientStop + strokeDasharray supported, values caller-owned |
| prefers-reduced-motion branch in SegmentOverlay | side effect | CUSTOM | CUSTOM-ON-TS | no | legacy always tweens 150ms; migrated drops transition under reduced motion; TS-check: CONTRADICTS no — native respectReducedMotion (motion.ts, mark-state-transition.ts) |
| `createPieHoverCoordinator` | util fn | BKLIT (pie-context PieHoverContext split) | CUSTOM-ON-TS | maybe | controlled/uncontrolled; plain pub/sub, not React context (identity-stable via ref); TS-check: partial — controlledSignal generic controlled state; no hover coordinator |
| `createPieSliceHoverRuntime` | util fn | BKLIT (pie-slice.tsx motion.path hover) | CUSTOM-ON-TS | no | translate x/y springs + grow radius spring regenerating `d` per frame; per-slice instance, coordinator-subscribed; TS-check: none — states don't transform arc geometry |
| `HOVER_SPRING {400,25}` | constant | BKLIT (transition springs 400/25) | CUSTOM | no | TS-check: none — value caller-owned |
| `FADE_OPACITY 0.4` / `OPACITY_TRANSITION 0.15s ease-in-out` | constant | BKLIT (`isFaded ? 0.4 : 1`, duration 0.15) | CUSTOM | no | TS-check: none — value caller-owned |
| Glow dead-code port (`filter: "none"`) | constant | BKLIT observed pixels (D49: legacy framer filter frozen at mount) | CUSTOM | no | restore snippet kept in comment; TS-check: none — SceneStyle lacks filter |
| `growInitialized` first-paint jump | util | CUSTOM (anti-artifact guard) | CUSTOM | no | settles radius spring at rest to avoid radius-0 grow-in; TS-check: none |
| Per-frame direct style/DOM writes (`style.transform`, `setAttribute("d")`, opacity) | side effect | BKLIT (framer-motion MotionValues) | CUSTOM-ON-TS | no | springs drive attribute writes; TS-check: CONTRADICTS no — native motion.ts spring renderer writes attributes per-frame |

## Imports

Internal modules consumed from other groups:

- `./formatters` (shortDateFmt, weekdayDateFmt, intFmt) — internal-foundation
- `./spring` (createSpring, Spring) — internal-animation
- `./design-tokens` (BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, FADE_BUFFER, TICKER_HALF_WIDTH, BOX_FALLBACK_WIDTH, BOX_FALLBACK_HEIGHT, ENTRANCE_SPRING, TICKER_ITEM_HEIGHT, TOOLTIP_SPRING, HIGHLIGHT_SPRING) — internal-foundation
- `./types` (ChartTooltipConfig, ChartTooltipPoint, ChartDatum) — internal-foundation
- `./chart-phase` (isChartInteractionPhase, ChartPhase) — internal-animation
- `./chart-config-context` (useChartConfig, resolveTooltipBoxMotion, SpringConfig) — internal-foundation
- `./fade-mask` (indicatorFadeGradientStops, resolveVerticalFadeSides, IndicatorFadeEdges) — internal-animation
- `./pie-geometry` (pieArcPath, sliceMidOffset) — internal-foundation
- External type: `ChartPoint` from `@tanstack/charts` (use-hover-chrome.ts)

## Deviations

- `attachHoverChrome` accepts `options.tooltipBoxSpring` but discards it (`void options.tooltipBoxSpring;`, hover-chrome.ts:170) — dead parameter; box spring resolution happens inside tooltip-chrome via config.
- `hover-reanchor.ts` carries a private inline `bisectDateLeft` (lines 16–26) that near-duplicates the exported `./bisect.ts` `bisectDateLeft` (differs only in accessor shape/shift operator).
- `SegmentComponent` interface is defined twice — chart-selection.ts:178 and segment-visuals.tsx:8 (structurally identical).
- `.bkm-marker-active-layer` class is set on the marker-active SVG but has no matching rule in styles.css; the element is styled inline (position/inset/pointer-events).
- `SegmentOverlay` checks `window.matchMedia("(prefers-reduced-motion: reduce)")` per render and drops the 150ms transition; legacy segment.tsx always tweens.
- Event surface differs from legacy: `useChartSelection` binds `pointermove`/`pointerup` on `window` + `setPointerCapture`, legacy used React mouse/touch handlers on the SVG (`localPoint` from @visx/event); same behavior, different plumbing.
- Documented intentional divergence (use-hover-chrome.ts:100): legacy bisects only `visiblePlotData` (focus stack over full data can resolve off-viewport points under domain-clamp); migrated bisects full data and explicitly clears focus outside the inclusive xDomain.
- Legacy scheduler commits via React state (`setTooltipData` → re-render); migrated scheduler is render-free (commit thunk invoked inside the imperative chrome) — architectural, intended.
- Pie glow intentionally not rendered: bklit's `showGlow` drop-shadow is dead code at runtime (framer freezes filter at mount, D49); migrated ports observed pixels and keeps a verbatim restore snippet.
- `createPieSliceHoverRuntime` adds a `growInitialized` first-paint jump absent from legacy (prevents visible radius-0 grow-in when `animate={false}`); documented in-file as correctness, not a behavior change.
- Legacy ChartTooltip has horizontal-orientation branches (bar titles via `barXAccessor`, `yWithMargin`, dots hidden when horizontal); this group's hover-chrome has no horizontal branch — horizontal/bar chrome lives in `bar-hover-chrome.ts` (different taxonomy part), not a gap here.
- Constants `BAR_DIM_TRANSITION 0.12s` and `MARKER_ACTIVE_SCALE 1.35` were not traced to an exact legacy constant during this read (legacy dim/active-highlight behavior confirmed, exact tween values not re-verified).
