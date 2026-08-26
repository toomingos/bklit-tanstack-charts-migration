# Phase 4.2.1.4 Synthesis — TanStack-native refactor opportunities

Date: 2026-08-21 · Source: 25 part reports (`research/phase-4/*.md`), TS-check verdicts authoritative (verified against pinned v0.14.0 `showcase/repos/tanstack-charts/`). ★ = opportunity exists only because a CONTRADICTS correction upgraded the original gate guess. Excluded: rows where the current impl is already TanStack-native (`<Chart>`, `defineChart`, `cell()`, `geoShape`, `onRender`, `polar`/`radialArc` hosts, `createMark*`) — those are confirmations, not work.

Totals: **44 rows — 19 full-native / 24 partial / 1 verified absence** (row 40, kept in-table for visibility). 18 rows ★ originate from CONTRADICTS upgrades: 12 full-native / 6 partial. **41 confirmed no-native-path items** (grouped to 25 rows below).

Parity rule applied: a partial swap that changes rendered visuals or interactivity is **NOT eligible** without a compensating layer; such rows say so explicitly.

## Main table — native refactor list

| # | Item/pattern | Part(s) | Current impl (module/file) | Native export (exact) | Coverage | Gap if partial | Payoff (parts / LOC) |
|---|---|---|---|---|---|---|---|
| 1★ | Reveal duration/easing constants (1100 ms, cubic-bezier(0.85,0,0.15,1)) | line, area, composed, pie, funnel, ring, internal-animation | `design-tokens` REVEAL_*, `enter-transition` TWEEN_FALLBACK + 4 byte-equivalent re-export shims (`pie-reveal`/`ring-reveal`/`funnel-reveal`/`radar-reveal`) | `motion()` defaults — `defaultDuration=1_100`, `defaultEasing=cubicBezier(0.85,0,0.15,1)` (`@tanstack/charts/motion`, charts-core `motion.ts:207-209`) | native | — | 7 parts; ~150 LOC constants + shim family |
| 2★ | Per-index enter stagger (delay formulas) | pie, ring, sunburst, candlestick, internal-legend-markers, gauge, sankey, heatmap, composed | hand-rolled delay math + setTimeout chains | `stagger({each, offset})` (`@tanstack/charts/motion/definition`) | partial | linear `offset+each·i` native; non-linear formulas (gauge clamp [0.25,2.5], sankey 0.2/0.8 windows, heatmap spread fraction) stay as delay fns | 9 parts; ~120 LOC |
| 3★ | Grid guides + highlight rows | line, internal-axes-grid, internal-legend-markers | `grid.ts`, `grid-highlight-mark.ts`, `resolveGridGuide` | `axis.grid` + `axis.ticks.count` + `ruleY` (`@tanstack/charts`, `./rule`) | native | tick-count clamp (1–10) stays app-side | 3 parts; ~110 LOC |
| 4★ | Funnel grid bands + separator lines | funnel | SVG band/line layers | `bandX`/`bandY` + `ruleX`/`ruleY` (`@tanstack/charts`) | native | — | 1 part; ~40 LOC |
| 5★ | Linear gradient defs (fill ramps, segment/gauge gradients, crosshair fade) | area, composed, segment, gauge, internal-animation (`fade-mask`), bar*, line-PL*, live-line* | hidden 0×0 defs SVGs, `injectGradientDefs` | `spec.gradients: ChartLinearGradient[]` + `renderChartSvgWithResources` (`@tanstack/charts/svg/resources`) | partial | objectBoundingBox %-stop ramps native; **no userSpaceOnUse** (PL fade x1=0→innerWidth), no patterns, no masks → keep custom defs for starred parts | 5 parts full; ~190 LOC (`fade-mask` 190) |
| 6★ | Focus/chrome suppression + FOCUS_DISABLED constants | gauge, pie, ring, sunburst, radar, internal-foundation | `focus-disabled.ts`, styles.css `.ts-chart__axes`/focus-ring suppression rules | `focusDisabled` (`@tanstack/charts/focus/disabled`); `defineChart(d, {focus:false})`; `axis:false` | native | — | 6 parts; ~40 LOC + CSS rules |
| 7★ | rAF damped-spring integrator | internal-animation (`spring.ts`), candlestick, funnel, heatmap, internal-interaction, live-line, ring | `spring.ts` semi-implicit Euler rAF loop | `createChartSpring` (`@tanstack/charts/spring`, `spring.ts:42`) | native | duration/bounce→params solver (`candle-spring` 217) + settle estimator (`radar-spring`) stay custom (partial) | 6 parts; ~107 LOC direct |
| 8★ | Sunburst layout + geometry + reveal + zoom | sunburst | `sunburst-geometry.ts` (503), `sunburst-reveal.ts` (165), `buildArcs`/`layoutNode`/`focusById`, ZOOM/TWEEN d-keyframes | `sunburst()` (`@tanstack/charts/hierarchy/sunburst`) + `motion()` enter sweep + `path:'morph'` on keyed updates | native | drill-hub scaling constants partial (`innerRadius` PolarLength); labels overlay separate (row 28) | 1 part; ~550 LOC |
| 9★ | Sankey graph layout | sankey | `sankey-layout.ts` (137) `computeSankeyLayout` (d3-sankey wrap, extent, clone) | `sankeyDiagram()` (`@tanstack/charts/network/sankey`; align/size/inset/extent) | native | category-based display value stays custom | 1 part; ~100 LOC |
| 10★ | Brush drag/selection/border chrome | internal-brush, line, area | `brush-drag.ts` (354), `brush-selection.ts` (175), `BrushBorderChrome`, `DEFAULT_SELECTED_BOX_STYLE`, `HANDLE_HIT_PX`, pointer+resize listeners | `brushX` control (`@tanstack/charts/interaction/brush`; `selectionStyle`, `handleSize`) | partial | rect handles only — pill knob + `ew-resize` cursor not expressible → thin handle-chrome compensating layer; 2-finger touch gesture stays custom | 3 parts; ~450 LOC |
| 11★ | Brush layout flex wrapper | internal-brush | `brush-layout.tsx` (88, orphan) | `view` grid fixed-size row + `alignX` (`@tanstack/charts/view`) | native | — | 1 orphan; 88 LOC |
| 12★ | Brush clipPath rect | line | `style.clipPath: url(#id)` | `spec.clip` (charts-core) | native | — | 1 part; ~15 LOC |
| 13 | Brush domain filter | internal-brush, line, area | `filterDataByXDomain` | `axis.viewport` | partial | row-filtering app-owned (docs pattern) | 3 parts; ~20 LOC |
| 14 | Nearest-point resolution | internal-interaction, composed | `resolveNearestIndex`, `bisect.ts` | `findNearestPoint` (`@tanstack/charts` scene) | native | composed's RAW+decimated dual-index split stays custom | 2 parts; ~60 LOC |
| 15 | y-domain tween | line, area, composed | `DATA_TWEEN_MS` + custom WAAPI tween + `useNicedYDomainChanged` | `svgAnimation {duration, easing}` (ChartAnimationOptions) | native | skip-threshold heuristic stays app-side | 3 parts; ~60 LOC |
| 16★ | Reduced-motion matchMedia checks | line, area, composed, funnel, internal-legend-markers, reference-area, segment, sunburst, gauge, heatmap, internal-axes-grid | ad-hoc `matchMedia` reads + `use-prefers-reduced-motion` | `motion({respectReducedMotion})` + `ChartMarkStateTransition` auto-check | partial | no exported React hook — DOM-overlay branches keep the hook | 11 parts; ~50 LOC |
| 17★ | Pie/ring arc path math | internal-foundation (`pie-geometry`), ring | `pieArcPath` d3-arc builder (67 LOC, 3 importers) | `radialArc` (+`resolvePolarSector`, `cornerRadius`) (`@tanstack/charts/polar`) | native | no standalone path-gen export (`sunburst-geometry` twin merges into mark) | 3 parts; ~70 LOC |
| 18★ | Default palettes (`var(--chart-1..5)`) | pie, scatter, sankey, choropleth, sunburst | per-chart `DEFAULT_*_COLORS` | `defaultChartTheme.palette` + color scale | partial | tokens `--ts-chart-N` ≠ `--chart-N` → compensating 1-line CSS alias block required, else colors change | 5 parts; ~60 LOC |
| 19★ | Tooltip box/panel/portal/scheduler | internal-interaction, scatter, bar, candlestick, live-line, heatmap, choropleth | `tooltip-chrome.ts` (632) `buildBox`/`positionBox`/`createRoot`, `tooltip-scheduler.ts` (67), cloned mappers in 5 `*-hover-chrome` modules | native `tooltip` option: `placement:'auto'` flip, `offset`, `motion`, `renderTooltipBody` content portal | partial | bklit date-pill, square-ring focus dot, fade-gradient indicator, custom chrome classes not native → keep those pieces | 6 parts; ~400–600 LOC retireable |
| 20★ | Series/row hover dim (opacity) | line, area, composed, bar, sankey, sunburst | `attachHoverChrome` DOM writes, `querySelectorAll` + `style.opacity` | mark `states` `when:{focus:'unmatched'}` opacity + `transition` | native | blur/scale dims (scatter/heatmap) not covered — those stay custom (rows in no-native table) | 6 parts; ~150 LOC |
| 21 | Crosshair indicator + focus dots | internal-interaction, scatter, candlestick, live-line | `buildIndicator`/`buildDot` spring overlays | `crosshair()` mark (rule, dash, marker, motion) | partial | fade-gradient stroke, square-ring springs, per-series dot clones stay custom — adopt only where parity-safe | 4 parts; ~200 LOC if adopted |
| 22 | Controlled hover/selection plumbing | segment, area, funnel, radar, ring, internal-legend-markers | `ChartSelectionContext`, `isControlledRef` mirrors, hover coordinators | `controlledSignal` (`@tanstack/charts/interaction/signal`) + `keyedSelection`/`whenSelected` (`/selection`) | partial | no React context, no uncontrolled fallback, no index-hover bridge → thin adapters | 6 parts; ~100 LOC |
| 23 | Chart host sizing | 14 parts | `use-container-size.ts` (225) + `useMeasuredRect`/`usePositiveChartSize` variants | `<Chart aspectRatio width>` + host ResizeObserver | partial | no exported measurement hook; HTML overlays still need a rect → keep thin rect hook as compensating layer | 14 parts; ~100 LOC net |
| 24 | Duplicate scale clones | bar, candlestick, scatter, area | `bandWidth` local ranging, `yScaleForChrome`, `xScaleCandleSel`, `yAxisTicks` | `onRender(ctx)` → `ctx.scene.scales.x/y` (+`invert`/`bandwidth`) | partial | post-render only — pre-render layout math stays | 4 parts; ~80 LOC |
| 25 | Date bucketing | internal-legend-markers | `toDateString` Map | `binTimeX`/`binTimeY` (`@tanstack/charts/transform/bin-time`) | partial | buckets by d3 interval; no arbitrary-item grouping | 1 part; ~15 LOC |
| 26 | Projection regression slope | internal-animation | `projection-utils` linreg | `linearRegressionRowsY/X` (`@tanstack/charts/regression`) | partial | no extrapolation past data extremes | 1 part; ~20 LOC |
| 27 | Radar long-format reshape | radar | `RadarRow` Z-pad | `fold` (`@tanstack/charts/transform/fold`) | partial | series-id Z-pad stays custom | 1 part; ~20 LOC |
| 28 | Sunburst labels overlay | sunburst | `SunburstLabelsOverlay` (halo text, paintOrder) | `text()` mark | partial | **no stroke-halo/paint-order → visual parity break**; keep overlay | 1 part |
| 29 | Sankey labels | sankey | SceneLabel rotate/anchor/font | `text()` rotate+anchor+font | native | margin reservation needs `layoutLabels` | 1 part; ~40 LOC |
| 30 | Sankey link rendering | sankey | `kind:'area'` paths, width-as-stroke | `link()` strokeWidth channel | partial | renderer hardcodes `non-scaling-stroke` → keep `vector-effect:none` CSS override | 1 part |
| 31 | Sankey per-link gradients | sankey | `gradientDataRef` + `injectGradientDefs` (userSpace x1/x2 per link) | `spec.gradients` | partial | %-coords frozen at definition ≠ per-link geometry → **parity break**; keep custom | 1 part |
| 32 | Funnel native recipe | funnel | custom Bézier-trapezoid `hSegmentPath`/`vSegmentPath` (0.44/0.55 magic) | `areaX` trapezoids + `text()` (conformance case 125-sales-funnel) | partial | **visual parity break** — trapezoid ≠ bklit Bézier segment; NOT eligible without design ruling | 1 part; ~160 LOC if accepted |
| 33 | Composed bars via barY+group | composed | `series-bar-mark` custom widths | `barY` + `group({scale})` | partial | bandwidth ×0.8 vs bklit slot×0.88 (ME-16) → **parity break**; not eligible | 1 part |
| 34 | Area fill via areaY | area, composed | `area-fill-mark` custom mark | `areaY` | partial | +19% G4 heap (documented, deliberate) → not eligible | 2 parts |
| 35 | Bar squares via waffle | bar | `bar-squares-mark` | `waffleX`/`waffleY` | partial | no band-aligned square columns → **parity break**; not eligible | 1 part |
| 36 | Legend hover-sync | 5+ parts | `chart-legend-hover` context + `onMouseEnter` | `interactiveColorLegend` (`@tanstack/charts/legend`) | partial | toggle-visibility only, **no hover-dim → interactivity parity break**; keep custom | 5 parts |
| 37 | Gauge center readout | gauge | `GaugeCenterOverlay` NumberFlow digit-roll | `radialText` | partial | static readout only, **no digit-roll intro (M1b design feature)** → keep overlay | 1 part |
| 38 | X-tick thinning | bar, internal-axes-grid | modulo `ceil(count/maxLabels)`, `selectEvenlySpacedIndices` | `tickLabels.thin` (minGap) | partial | different algorithms → **label-placement drift**; not eligible without visual sign-off | 2 parts |
| 39★ | Heatmap tooltip entrance/offset | heatmap | `createSpring` rAF panel + `HEATMAP_TOOLTIP_DEFAULT_OFFSET` | native tooltip motion (presence+spring) + `tooltip.offset:16` | native | — | 1 part; ~40 LOC |
| 40 | Y-tick recolor inside reference bands | internal-axes-grid, reference-area, live-line | `createTickColorResolver` | — | none | `ChartAxisTickLabelOptions` (types.ts:343–353) has **no color/fill field** — verified; line.md's CONTRADICTS note claiming "tickLabels.color fn" is wrong | 3 parts; stays custom |
| 41 | Date coercion | internal-foundation (`coerce-date`), internal-animation | `toDate`/`isValidDate` | `ChartValue` Date/number channels | native | non-chart call sites keep helper | 4 parts; ~20 LOC |
| 42 | Funnel stage keys | funnel | `stage.label` keys | mark `key` channel + reconcile | native | — | 1 part; ~10 LOC |
| 43 | Sunburst hit-test order | sunburst | `sortedArcs` DOM sort | resolver reverse paint order (topmost primitive) | native | — | 1 part; ~15 LOC |
| 44 | Sunburst d3-arc accessor stubs | sunburst | `Object.assign` stubs for `WrappedArc` | `RadialArcOptions.generator` (configured d3 `arc` needs no stubs) | native | — | 1 part; ~20 LOC |

## Confirmed NO native path (do not chase in 4.3)

| Item | Why custom must stay |
|---|---|
| LTTB decimation + width-based point budget (`decimate.ts`, `maxRenderPointsForWidth`) | Zero downsampling/point-budgeting anywhere in v0.14.0; bench conventions require bklit's LTTB strategy |
| Multi-axis ids (`yAxisId`, `normalizeYAxisId`) | Single x/y axis model; no axis-id concept |
| Reference areas as first-class feature | Only generic `decorative()` mark; no reference-area API |
| Rect overflow clamp/discard modes | `rect()` maps x1/x2/y1/y2 via scales; no clamp/discard |
| `<mask>` / edge-fade masks | Gradients spec only; no mask support in marks/renderers |
| SVG pattern fills (all `pattern-preset` consumers) | No pattern/tile fill anywhere; `url()` paint passthrough only |
| `strokeDashoffset` / `getTotalLength` dash-draw | Absent from TanStack (incl. motion); sankey uses `pathLength="1"` trick app-side |
| `springFromBounce` (duration/bounce → stiffness/damping) | `ChartMotionSpringTransition` takes stiffness/damping directly; no bounce derivation |
| Tick-label color / band recolor | `ChartAxisTickLabelOptions` has no color field (verified types.ts:343–353) |
| Skeleton/loading data staging | Charts consume final data; no skeleton lifecycle |
| Blur/filter mark styling (`blur(2px)` reveals, group blur-dim) | `states` style covers opacity only; no filter channel |
| Per-element scale/transform states (heatmap cell pop, radar glow/scale, marker ×1.35) | `states` lacks transform/dx-dy on rect center |
| Radial gradients (scatter disc+ring, legend rings) | `ChartLinearGradient` is linear-only |
| userSpaceOnUse gradient coords (PL fade, sankey per-link) | %-coords (objectBoundingBox) only, frozen at definition |
| Exported measurement hooks (`useMeasuredRect`/`usePositiveChartSize`) | ResizeObserver internal to Chart host; no hook export |
| Exported React reduced-motion hook | matchMedia checked internally; no hook export |
| Debounced container sizing (10 ms ParentSize parity) | Host RO has no debounce |
| Fixed-px group gap (`DEFAULT_BAR_GAP=4`) | `group({padding})` is ratio-only |
| bklit bar-width ratios (slot×0.88, maxGroup ×0.92, ME-16) | `barY` inferBandwidth ×0.8/maxThickness; different math |
| Children-composition API (`CHART_ROLE` carriers, `extractChildren`) | Definition-prop API only; no children concept |
| 8-value ChartPhase lifecycle orchestration | Native phases are enter/update/exit only; no status machine, no external reveal-deadline hook |
| Seeded-PRNG / epoch-replayable stagger (heatmap 1600 ms wave) | `stagger()`/delay fns not seedable |
| WAAPI group-level reveal + post-paint deadline (`onPostPaint`, `setRevealDeadline`) | No post-paint primitive or deadline API; `onRender` is post-render only |
| Hover-dim styling on `geoShape` | geo marks lack `states` dim styling |
| `sankeyLinkHorizontal` export | Approximate via `link(curve)`/`d3Curve`; no exported generator |
| Category-based flow aggregation (`getSankeyDisplayValue`) | `SankeyNode.value` aggregates flow; category variant custom |
| Compact K/M number formatter | Only locale `formatChartTooltipValue` (toLocaleString) — swapping changes tooltip text |
| `parseAspectRatio` string `"2/1"` | `aspectRatio` prop is number-only |
| `startTransition` commit-throttle (live-line) | React API; no TanStack equivalent |
| Identity-stable margin hook (`useChartMargin`) | Margin is a plain `defineChart` option; no identity hook |
| 2-finger touch drag gesture | `brushX` covers single-pointer range drag only |
| Tooltip exit-retention hook (200 ms) | `tooltip.motion hide()` exit-fade is internal; no React retention hook |
| `text()` stroke halo / `paint-order` (sunburst labels) | Text mark has font/anchor only |
| Per-cell hitbox pointer API (funnel labels) | Pointer focus is chart-surface-level; no per-mark hitbox API |
| `cursor:pointer` on marks | No mark-cursor option |
| HTML overlay axis chrome (`bottom:12` pills, left-orientation Y) | Native tickLabels are SVG; HTML-overlay positioning is app-side |
| Interpolated domain ticks (projection horizon) | `ticks.values` takes candidates; no interpolation |
| 1–10 tick-count clamp | `ticks.count` is a hint, no clamp |
| bklit CSS vars as theme tokens (`--chart-marker-*`, `--chart-brush-border`, `--chart-segment-*`) | TanStack theme reads `--ts-*` vars only |
| Legend/label hover-dim via CSS (`:has([data-hovered])`, metric-label `:hover`) | Native legends toggle visibility; hover-dim is app-side CSS |
| `vector-effect` override | svg-renderer hardcodes `non-scaling-stroke` on paths; CSS override still required |
| Per-grid-line dasharray styling (`--chart-grid` 4 4) | `theme.grid` is a color token; dasharray not configurable |
| Brush pill knob handles + portal chrome | `brushX` handles are rects; host controls mount own chrome, no React portal |
| Per-category-index dimming (legend→bar sync) | `states` keyed to focus, not category index |
| Granular-scale spring rest tiers (D51) | `ChartSpringOptions` has flat restSpeed/restDelta; no tiers |
| Domain-tween skip threshold (0.02) | No dedicated domain-tween knob |

## Open questions for 4.3

1. **tickLabels color conflict** — line.md's CONTRADICTS note claims native `tickLabels.color`; v0.14.0 `types.ts:343–353` has no color field. Ruling: y-tick recolor stays custom (`createTickColorResolver`). Confirm no other report relied on the phantom option.
2. **Palette alias layer** — is a one-line CSS alias (`--ts-chart-N → var(--chart-N)`) an acceptable compensating layer to make row 18 a full-native swap across 5 parts?
3. **brushX handles** — design ruling needed: are rect handles acceptable for bklit pill knobs, or does the thin handle-chrome layer (row 10) stay permanently?
4. **Native tooltip cutover** — how much of `tooltip-chrome` (632 LOC) + the 5 `*-hover-chrome` modules retires once pill/date-pill/square-ring stay custom? Run QA pixel gates per part before deleting.
5. **sunburst() parity** — does native enter sweep + `path:'morph'` match the 64-sample WAAPI d-interpolation within the 0.5% gate (especially drill-down zoom)?
6. **sankeyDiagram()** — confirm `layoutLabels` margin reservation reproduces bklit label margins; keep `vector-effect:none` override for width-as-stroke links.
7. **svgAnimation domain tween** — does it reproduce bklit's gated tween (fire only when niced domain moved) incl. reduced-motion snap, within M1b parity?
8. **stagger() mapping** — verify per-part formulas (pie `(0.1+i·0.08)·scale`, ring `0.08i` / `0.6+0.1i`, sunburst `ringIndex·0.12+index·0.08`) fit `{offset, each}`; non-linear ones keep delay fns (row 2 gap).
9. **use-container-size retirement** — which of the 14 consumer parts can drop it entirely vs still need a rect for HTML overlays? Propose an `onRender`-context-fed rect hook as the compensating layer.
10. **Funnel recipe** — native `areaX`-trapezoid recipe (conformance case 125) is a visual parity break vs bklit Bézier trapezoids; needs explicit waiver ruling before any swap.
11. **createChartSpring equivalence** — does the analytic sampler match `spring.ts`'s semi-implicit Euler within visual tolerance for the `{300,30}`/`{180,28}` tooltip/pill springs?
12. **spec.gradients limits** — userSpaceOnUse (PL fade) and per-link sankey gradients confirmed unsupported at v0.14.0; custom defs stay. Re-check only if the pin moves.
