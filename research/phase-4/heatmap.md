# heatmap — Phase 4 Research Report

**Files:** `showcase/migrated/charts/heatmap-chart.tsx`; `showcase/migrated/charts/internal/heatmap-{animation,colors,components,context,hover-chrome,interaction,legend,lifecycle,utils}.*`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/heatmap/` — `index.ts`, `heatmap-chart.tsx`, `heatmap-cells.tsx`, `heatmap-x-axis.tsx`, `heatmap-y-axis.tsx`, `heatmap-tooltip.tsx`, `heatmap-separator.tsx`, `heatmap-resolve-separator.ts`, `heatmap-legend.tsx`, `heatmap-legend-swatch.tsx`, `heatmap-legend-gradient.tsx`, `heatmap-pattern-defs.tsx`, `heatmap-colors.ts`, `heatmap-context.tsx`, `heatmap-animation.ts`, `heatmap-utils.ts`, `heatmap-chart-loading.tsx`, `generate-heatmap-skeleton-data.ts`, `use-delayed-tooltip-data.ts`

## Feature summary

GitHub-style contribution heatmap: week columns × 7 day-row bins, discrete 5-level color scale, seeded-PRNG staggered enter reveal (1600 ms wave), loading skeleton/conceal lifecycle, cell + legend cross-highlight dimming, light-DOM tooltip, quarter/every column separators with optional labels. Migrated render path is a TanStack `defineChart` + `cell()` mark with imperative WAAPI/DOM hover-and-reveal chrome around it; bklit used `@visx/heatmap` + framer-motion.

## Public API

Legacy surface = `repos/.../heatmap/index.ts` (19 modules). Migrated consolidates into `heatmap-chart.tsx` re-exports.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `HeatmapChart` | component | same | Rebuilt on TanStack `defineChart`/`cell()`; size via `usePositiveChartSize` (was `@visx/responsive` `ParentSize`) |
| `HeatmapChartProps` core 19 props: `data, xDomain, sizingColumnCount, layout, margin, binSize, gap, levelColors, levelStyles, aspectRatio, className, status, loadingLabel, animationDuration, revealSignature, enterStaggerScale, animate, showLoadingCells, children` | props | same | Names, defaults, semantics preserved |
| `.colorScale` | prop | same | Signature narrowed `(count: number\|null\|undefined)=>string` → `(count: number)=>string` |
| `.enterTransition` | prop | renamed | Type `motion/react Transition` → local `HeatmapEnterTransition` (structural subset: tween/spring/duration/ease/bounce/stiffness/damping/mass/delay) |
| `.columnSeparators` | prop | renamed | Type `HeatmapSeparatorParsedConfig` → `HeatmapColumnSeparatorsConfig` (same shape) |
| `.loadingOpacity, .loadingCellMaxOpacity, .loadingCellRandomness` | props | same | Defaults follow runtime constants; bklit JSDoc ("0.5"/"0.65") is stale there too |
| `HeatmapLayout` | type | same | `"fluid" \| "fill"` |
| `HeatmapChartLoading` | component | same | Same skeleton composition (`HeatmapCells interactive={false}` + axes) |
| `HeatmapChartLoadingProps` | type | same | |
| `generateHeatmapSkeletonFromTarget` | fn | same | Verbatim |
| `HeatmapCells` | component | same | Rebuilt on TanStack `cell()`; ghost bins painted transparent (level −1) instead of removed from DOM |
| `HeatmapCellsProps` | type | same | `colorScale` prop accepted but ignored (`void _colorScaleProp`) |
| `HeatmapXAxis` | component | same | Month-anchor labels; portal target is dedicated `htmlLayerEl` (was `containerRef`) |
| `HeatmapXAxisProps` | type | same | |
| `HeatmapYAxis` | component | same | Day labels; `right: 4` CSS positioning vs bklit `left: 4; width: margin.left−12` flex box |
| `HeatmapYAxisProps` | type | same | |
| `HeatmapTooltip` | component | same | Shared `TooltipBox` replaced by local flip-aware panel + spring entrance |
| `HeatmapTooltipProps` | type | same | All 7 props preserved, same defaults (showDelay 0, hideDelay 120) |
| `HeatmapSeparator` | component | same | All 16 props preserved; gradient id is static string (no `useId` collision guard) |
| `HeatmapSeparatorProps` | type | same | `stroke` default `var(--border)` → `var(--chart-grid-line, currentColor)` |
| `HeatmapLegend` | component | same | Swatches/gradient variants, cross-highlight via coordinator |
| `HeatmapLegendProps` | type | same | Avoids bklit's `as unknown` cast when deriving levelStyles from colorScale |
| `HeatmapLegendVariant` | type | same | |
| `HEATMAP_LEGEND_LEVELS` | const | same | `[0,1,2,3,4]` |
| `HeatmapLegendSwatch` | component | extra | Internal module in legacy (not in index.ts); pattern branch cut, solid-only |
| `HeatmapLegendSwatchProps` | type | extra | |
| `HeatmapLegendGradient` | component | extra | Internal module in legacy; CSS-transition dimming instead of `motion.div` |
| `HeatmapLegendGradientProps` | type | extra | |
| `useHeatmap` | hook | same | Error message text differs |
| `HeatmapContext` | context | extra | Module-private in legacy |
| `HeatmapContextValue` | type | same | `timeXScale`/`brushYScale` plain fns (were visx scale objects); adds `containerRef`, `htmlLayerEl`; `margin` typed `HeatmapMargin` |
| `HeatmapMargin` | type | extra | Replaces shared `Margin` from chart-context |
| `HeatmapBin`, `HeatmapColumn` | types | same | Relocated from context module to utils module |
| `HeatmapProvider` | component | missing | Provider folded into `HeatmapChartInner` (context never manually provided) |
| `heatmapCssVars` | const | missing | Deprecated in bklit; dropped |
| `useHeatmapInteraction` | hook | same | |
| `useHeatmapInteractionOptional` | hook | same | Backed by coordinator store, not React state |
| `HeatmapInteractionProvider` | component | same | Adds optional injected `coordinator` prop |
| `HeatmapInteractionBoundary` | component | same | Adds `style` prop; drops bklit's `cn("size-full min-h-0 min-w-0")` base class |
| `HeatmapInteractionRoot` | component | same | Always nests a provider (bklit nested only when none upstream) |
| `HeatmapInteractionProviderProps`, `HeatmapInteractionBoundaryProps`, `HeatmapInteractionRootProps` | types | extra | Legacy components had inline prop types |
| `HeatmapRevealMode` | type | same | `"enter" \| "fromLoading" \| null` |
| `HeatmapChartPhase` | type | extra | Chart-local `"loading"\|"revealing"\|"ready"\|"exitingReady"` replaces shared `ChartPhase` |
| `HeatmapTooltipData` | type | extra | Defined but unexported in legacy index |
| `HeatmapHoveredCell` | type | extra | Inline `{column,row}` in legacy |
| `HEATMAP_DEFAULT_LEVEL_COLORS`, `HEATMAP_DEFAULT_LEVEL_STYLES` | consts | same | CSS vars `--chart-scale-01..05` |
| `HeatmapLevelColors`, `HeatmapLevelFillMode`, `HeatmapLevelStyle`, `HeatmapLevelStyles` | types | same | All `pattern*` fields kept for API compat although pattern rendering is cut |
| `buildHeatmapColorScale`, `buildHeatmapColorScaleFromStyles`, `buildHeatmapFillScale`, `defaultHeatmapColorScale`, `defaultHeatmapFillScale`, `heatmapLevelPatternId`, `isHeatmapLevelPattern`, `resolveHeatmapLevelStyles` | fns | missing | Ported internally, not re-exported from the public module |
| `levelColorsFromStyles` | fn | missing | Not ported anywhere |
| `levelStylesFromColors` | fn | missing | Private helper inside internal colors module |
| `HEATMAP_DEFAULT_ENTER_DURATION_MS`, `HEATMAP_DEFAULT_ENTER_EASE`, `HEATMAP_DEFAULT_ENTER_TRANSITION`, `HEATMAP_LOADING_CHART_OPACITY`, `HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY`, `HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS`, `HEATMAP_ENTER_STAGGER_SPREAD`, `HEATMAP_LOADING_BASE_CELL_OPACITY`, `HEATMAP_LOADING_CONCEAL_MS` | consts | missing | Verbatim internally; not re-exported |
| `computeHeatmapEnterFadeDelayMs`, `resolveHeatmapEnterFadeDurationSec`, `heatmapLoadingCellParticipates` | fns | missing | Internally ported; `heatmapLoadingCellParticipates` is dead code after shimmer cut |
| `HeatmapLevelRange` | type | same | |
| `computeHeatmapLevelRange` | fn | same | Empty-data fallback `{min:0,max:4}` verified against bklit |
| `HEATMAP_INACTIVE_OPACITY` | const | extra | Module-private in legacy (0.3) |
| `HEATMAP_DAY_LABELS` | const | same | |
| `HeatmapSeparatorGroupBy`, `HeatmapSeparatorStrokeStyle`, `HeatmapSeparatorGradient`, `HeatmapWeekStartDay`, `HeatmapYAxisLabelFormat`, `HeatmapYAxisTickFilter` | types | same | |
| `HeatmapSeparatorParsedConfig` | type | renamed | → `HeatmapColumnSeparatorsConfig` |
| `HeatmapDisplayRange`, `HeatmapHoverStyleParams`, `HeatmapSeparatorGradientStop`, `HeatmapSeparatorGroup`, `HeatmapSeparatorLayout`, `HeatmapWeekRange` | types | missing | Exist internally, not re-exported |
| ~44 `heatmap-utils` pure fns (`getHeatmapContributionLevel`, `formatHeatmapTooltipDate/Weekday/ContributionLabel/YAxisLabel`, `getHeatmapDayLabels/MonthAnchor/QuarterAnchor/TimeExtent/ColumnXOffset/Separator*/Week*/YearStartMonth/CalendarRangeStart/PlotInnerWidth/MonthLabelColumnIndex`, `filterHeatmapColumns`, `rotateHeatmapColumnBins`, `shouldShowHeatmapYAxisTick`, `isHeatmapGhostBin`, `inferHeatmapCalendarRangeStart`, `resolveHeatmapDisplayRange/WeekRange/HoverStyle/InactiveStyle/RowOpacity/SeparatorLayout/SeparatorStrokeDasharray`, `buildHeatmapLegendGradient/QuarterSeparatorGroups/RowOpacity/SeparatorGradientStops`, `findHeatmapColumnIndexForDate`, `getCalendarQuarter`, `getCalendarQuarterStartDatesBetween`, `countHeatmapWeekDaysOnOrAfter`, `isHeatmapHoverEffectEnabled`, `isHeatmapInactiveEffectEnabled`) + consts `HEATMAP_MONTHS_ONE_YEAR/SIX`, `HEATMAP_WEEKS_ONE_YEAR` | fns/consts | missing | Ported verbatim into `internal/heatmap-utils.ts`; not re-exported publicly |
| `resolveHeatmapSeparatorConfig`, `resolveHeatmapSeparatorConfigWithData` | fns | missing | Child-scan inlined in `heatmap-chart.tsx`; normalize + layout-resolve split across chart/utils |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `HEATMAP_DEFAULT_ENTER_DURATION_MS = 1600` | constant | BKLIT | CUSTOM | maybe | Enter window; drives stagger spread; TS-check: none — motion() default is 1100 ms, value custom |
| `HEATMAP_DEFAULT_ENTER_EASE = [0.85, 0, 0.916, 0.282]` | constant | BKLIT | CUSTOM | maybe | Emitted as `cubic-bezier(...)` into WAAPI easing; TS-check: partial — tween easing accepts cubic-bezier fn (motion) |
| `HEATMAP_DEFAULT_ENTER_TRANSITION {type:"tween", duration:1.6}` | constant | BKLIT | CUSTOM | maybe | TS-check: partial — ChartMotionTweenTransition same shape, values custom |
| `HEATMAP_LOADING_CHART_OPACITY = 1` | constant | BKLIT | CUSTOM | no | Runtime value 1 (bklit JSDoc says 0.5 — stale there too); TS-check: none |
| `HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY = 0.85` | constant | BKLIT | CUSTOM | no | Plumbed through context; unused after shimmer cut; TS-check: none |
| `HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS = 1` | constant | BKLIT | CUSTOM | no | Same; TS-check: none |
| `HEATMAP_LOADING_BASE_CELL_OPACITY = 0.2` | constant | BKLIT | CUSTOM | no | Dead — shimmer layer not ported; TS-check: none |
| `HEATMAP_LOADING_CONCEAL_MS = 450` | constant | BKLIT | CUSTOM | maybe | ready→loading conceal timer; TS-check: none — no chart status/lifecycle API |
| `HEATMAP_ENTER_STAGGER_SPREAD = 0.6` | constant | BKLIT | CUSTOM | maybe | Fraction of enter window used for random delays; TS-check: partial — stagger() each/offset; spread-fraction custom |
| Lehmer/Park–Miller `seededRandom` (mod 2_147_483_647, ×16_807) | util fn | BKLIT | CUSTOM | maybe | Deterministic per-cell delays (bench-critical); TS-check: none |
| Cell seeds: `col*1009 + row*9176`, epoch `×524_287`, shimmer `+73_133` | constant | BKLIT | CUSTOM | no | Magic multipliers, verbatim; TS-check: none |
| `HEATMAP_INACTIVE_OPACITY = 0.3` | constant | BKLIT | CUSTOM | maybe | Default hover-dim opacity; TS-check: none — value custom; states mechanism applies it |
| `HEATMAP_INACTIVE_TRANSITION_CSS = "0.22s cubic-bezier(0.4, 0, 0.2, 1)"` | constant | BKLIT | CUSTOM | maybe | bklit's motion tween `{duration:0.22, ease:[0.4,0,0.2,1]}` as CSS; TS-check: partial — ChartMarkStateTransition tween+easing equivalent |
| `DEFAULT_MARGIN {top:28, right:16, bottom:0, left:40}` | constant | BKLIT | CUSTOM | no | TS-check: none — ChartSpec margin option exists, not these defaults |
| `HEATMAP_TOOLTIP_DEFAULT_OFFSET = 16` px | constant | BKLIT | CUSTOM | no | Tooltip cursor offset; TS-check: CONTRADICTS no — partial: ChartTooltipOptions.offset |
| Tooltip estimated size refs `180×80` px | constant | CUSTOM | CUSTOM | no | Seed values for flip/clamp math before first measure; TS-check: none — placement measures real size |
| Highlight ring: geo ±1 px, `rx+1`, strokeWidth 1.5, strokeOpacity 0.5 | constant | CUSTOM | CUSTOM | no | Migrated-added outline (bklit only scales hovered cell); TS-check: partial — focusRing draws primary-point ring |
| Dim overlay fill `var(--color-background, white)` | constant | CUSTOM | CUSTOM | no | Overlay-rect dim mechanism; TS-check: none — value custom |
| Tooltip spring entrance: opacity 0→1, scale 0.85→1, translateX ∓20 px, `createSpring(0,300,25)` | constant | CUSTOM | CUSTOM | no | Replaces `TooltipBox` motion entrance; TS-check: CONTRADICTS no — native: motion() tooltip presence+spring controller |
| Container `minHeight: 160` fallback (no aspectRatio, h=0) | constant | CUSTOM | CUSTOM | no | TS-check: none |
| Ready gate `width >= 10 && height >= 10` | constant | BKLIT | CUSTOM | no | bklit: `chartWidth < 10 \|\| height < 10 → null`; TS-check: none |
| Dasharray default `"4,4"`; legend defaults cellSize 11 / gap 2 / radius 2 / gradientSpan 5 | constant | BKLIT | CUSTOM | no | TS-check: none |
| `HEATMAP_LEVEL_CSS_VARS` = `var(--chart-scale-01..05)` | constant | BKLIT | CUSTOM | maybe | Inlines bklit's `CHART_SCALE_VARS` dependency; TS-check: none — theme tokens differ |
| Contribution-level thresholds (`<=0→0, 1→1, 2→2, 3→3, else 4`) | util fn | BKLIT | CUSTOM | no | Discrete scale, NOT continuous (D31); TS-check: CONTRADICTS no — partial: d3 threshold scale via color.scale |
| TanStack `Chart` + `defineChart` + `cell()` mark (`inset:1`, `radius`, key `${col}-${row}`) | mark | TANSTACK | TS-NATIVE | yes | Replaces `@visx/heatmap` `HeatmapRect` + `Group`; TS-check: native — Chart (@tanstack/react-charts), defineChart/cell (@tanstack/charts) |
| d3-scale `scaleBand`/`scaleOrdinal` feeding TanStack x/y/color encodings | util | TANSTACK | TS-NATIVE | yes | Ordinal range slot 0 = `"transparent"` for ghost level −1; TS-check: native — ChartScaleInput/color.scale accept d3 scales |
| Ghost cells as level −1 transparent rects | mark strategy | CUSTOM | CUSTOM-ON-TS | maybe | bklit unmounts ghosts; migrated keeps them invisible so keying stays stable; TS-check: none — strategy custom on cell() |
| Hover dim overlay SVG layer (per-cell background rects + highlight ring) | overlay | CUSTOM | CUSTOM-ON-TS | maybe | Sits above chart host; opacity fades carry the dim; TS-check: partial — mark states fillOpacity-on-unmatched dims natively; ring ≈ focusRing |
| Per-cell scale/row-opacity painted onto TanStack rects (`transform-box: fill-box`) | overlay | BKLIT | CUSTOM-ON-TS | no | Replaces bklit per-cell `motion.g` scale wrapper; TS-check: partial — states style fillOpacity only, no rect scale/dx-dy on rect center |
| Separator SVG layer (line, paddingX hit-band, vertical gradient defs, Q labels) | mark | BKLIT | CUSTOM | maybe | Rendered in own absolutely-positioned svg above children; TS-check: partial — ruleX/ruleY/text marks exist, lacks gradient-stroke + hit-band |
| HTML axis/label layers via `createPortal` into `htmlLayerEl` | overlay | CUSTOM | CUSTOM | maybe | Replaces bklit portals into `containerRef`; TS-check: none — portal extension covers tooltip element only |
| `HeatmapContext` (~33-field value) + `useHeatmap` | context | BKLIT | CUSTOM | maybe | Provided by `HeatmapChartInner`; TS-check: none |
| `HeatmapInteractionContext` + required/optional hooks | context | BKLIT | CUSTOM-ON-TS | maybe | Carries coordinator ref instead of state; TS-check: none — focus callbacks exist, no hover-state context |
| `HeatmapHoverCoordinator` external store (hoveredCell, hoveredLegendLevel, tooltipData; subscribe/notify) | util | CUSTOM | CUSTOM | maybe | Replaces bklit triple `useState` context; avoids grid-wide re-render per pointermove; TS-check: none |
| `useSyncExternalStore` bridges (cells, legend, tooltip, interaction hooks) | hook | CUSTOM | TS-NATIVE | yes | React-native store subscription; TS-check: native — React built-in (not TanStack API) |
| `useHeatmapChartLifecycle` phase machine (`loading/revealing/ready/exitingReady`, `revealEpoch`, conceal/finish timers) | hook | BKLIT | CUSTOM | maybe | Port of bklit's inline `useHeatmapChartLifecycle`; TS-check: none — no status/lifecycle API |
| `useDelayedHeatmapTooltipData` (show/hide grace timers) | hook | BKLIT | CUSTOM | maybe | Inlined copy of legacy `use-delayed-tooltip-data.ts`; TS-check: none — ChartTooltipOptions lacks show/hide delays |
| `usePrefersReducedMotion` (foundation) | hook | BKLIT | TS-NATIVE | yes | Replaces `motion/react` `useReducedMotion`; TS-check: native — respectReducedMotion in motion()/ChartAnimationOptions |
| `usePositiveChartSize` (foundation barrel) | hook | TANSTACK-era infra | TS-NATIVE | yes | Replaces `@visx/responsive` `ParentSize`; TS-check: partial — renderer.ts ResizeObserver + width/aspectRatio/initialWidth props |
| `useHeatmapChartDefinition` (memoized `defineChart` spec; empty marks while loading) | hook | CUSTOM-ON-TS | CUSTOM-ON-TS | yes | `svgAnimation: false` — reveal owned by WAAPI layer; TS-check: native — defineChart + svgAnimation option (@tanstack/charts) |
| Plain-fn `buildHeatmapTimeXScale`/`buildHeatmapBrushYScale` | util | BKLIT | CUSTOM | maybe | Reproduce d3 `scaleTime`/`scaleLinear` mapping without visx dep; TS-check: partial — scaleTime accepted via ChartScaleInput; plain-fn form custom |
| WAAPI reveal: `rect.animate([{opacity:0},{opacity:1}], {duration, delay, easing, fill:"backwards"})`, cancel-on-finish | WAAPI anims | BKLIT (behavior) | CUSTOM-ON-TS | no | Per-cell seeded delays; bklit used motion `animate()` on opacity MotionValues; TS-check: CONTRADICTS no — native enter opacity tracks + delay fn (motion) |
| `runDeferredReveal` orchestrator (epoch guard, deadline, post-paint, `bkmRevealed` stamp) | util fn | CUSTOM | CUSTOM-ON-TS | no | Shared deferred-reveal module; TS-check: none — no epoch/replay API |
| Double-rAF retry when TanStack marks land after layout effects | rAF loop | CUSTOM | CUSTOM | no | Fallback reveal trigger in `HeatmapCells`; TS-check: none — onRender covers this natively (migrated also uses it) |
| `paintCellStyles` direct DOM writes on `rect[data-ts-key]` (transformOrigin/transform/transition/fillOpacity) | DOM mutation | CUSTOM | CUSTOM-ON-TS | no | Key parsing: slice after last `:` of `data-ts-key`; TS-check: partial — states cover fillOpacity, not transform/CSS-transition writes |
| `pointermove`/`pointerleave` listeners + manual column/row hit-testing on container | event listeners | CUSTOM | CUSTOM-ON-TS | maybe | Replaces bklit per-rect React pointer handlers; TS-check: none — focus resolution is point-based, no rect hit-test API |
| `window.setTimeout` timers: conceal 450 ms, reveal finish, tooltip show/hide | timers | BKLIT | CUSTOM | no | All cleaned up on unmount; TS-check: none |
| `createSpring` rAF integrator driving tooltip panel transform/opacity | rAF spring | CUSTOM | CUSTOM | no | Foundation `spring.ts`; TS-check: CONTRADICTS no — native: createChartSpring (@tanstack/charts/spring) + motion() tooltip spring |
| `ts-bkm-heatmap-svg`, `-separator-svg`, `-hover-svg`, `-html-layer` | CSS class | CUSTOM | CUSTOM | no | Layer stack in styles.css (~681–700); TS-check: none — ts-chart classes only |
| `ts-bkm-heatmap-axis-layer`, `-axis-label`, `-axis-label--y`, `-separator-label` | CSS class | CUSTOM | CUSTOM | no | Carry bklit's `text-chart-label text-xs` typography; TS-check: none — axis labels are SVG text marks |
| `ts-bkm-heatmap-tooltip-date/weekday/divider/value` | CSS class | BKLIT (visuals) | CUSTOM | no | Replace bklit Tailwind utility markup; TS-check: partial — tooltip content callback renders custom JSX |
| `ts-bkm-heatmap-legend`, `-legend-label`, `-legend-swatches`, `-legend-swatch-wrap`, `-legend-swatch`, `-legend-gradient`, `-legend-gradient-bar`, `-legend-gradient-segment` | CSS class | BKLIT (visuals) | CUSTOM | no | TS-check: partial — colorLegend/colorGradientLegend render stepped/gradient legends as SVG scene nodes |
| `ts-bkm-heatmap-loading-label`, `--exiting` | CSS class | BKLIT (visuals) | CUSTOM | no | Replaces `ChartLoadingLabel` component; TS-check: none |
| `bkm-tooltip-layer`, `bkm-tooltip-panel`, `bkm-tooltip-content`, `bkm-tooltip-value` | CSS class | BKLIT | CUSTOM | no | Shared tooltip chrome classes; TS-check: partial — tooltip className + portal; markup custom |
| `data-bkm-chart="heatmap"` attribute scoping | CSS class/attr | CUSTOM | CUSTOM | no | Scopes all `[data-bkm-chart="heatmap"]` rules; TS-check: none — idPrefix is TanStack's only scoping hook |
| Seeded staggered enter reveal (1600 ms wave, epoch-replayable) | behavior | BKLIT | CUSTOM-ON-TS | no | M1b-style intentional reveal; TS-check: partial — motion() delay fn + stagger() cover stagger, not seeded PRNG/epoch replay |
| Loading shimmer pulse (random per-cell opacity loop) — **not ported** | gap | BKLIT | — | no | Skeleton renders statically; see Deviations; TS-check: none |
| Pattern fills (`pattern-preset` generator, `HeatmapPatternDefs`) — **not ported** | gap | BKLIT | — | no | Disclosed scope cut; solid fallback always; TS-check: none — no pattern-fill support in marks/scales |
| Separator child detection via `child.type === HeatmapSeparator` | util | BKLIT | CUSTOM | no | Replaces `HEATMAP_SEPARATOR_MARKER` + displayName + `resolveChartChildElement` heuristics; TS-check: none |

## Imports

Part-internal (`internal/heatmap-*`):
- `heatmap-context` (HeatmapContext, useHeatmap, HeatmapContextValue, HeatmapMargin, HeatmapLayout, DEFAULT_MARGIN)
- `heatmap-lifecycle` (useHeatmapChartLifecycle, HeatmapChartPhase, HeatmapRevealMode)
- `heatmap-interaction` (provider/hooks/coordinator hook)
- `heatmap-hover-chrome` (coordinator factory, HEATMAP_INACTIVE_*, tooltip/hovered types)
- `heatmap-utils` (calendar/grid/format/separator/hover helpers + types)
- `heatmap-colors` (level styles, scales, defaults)
- `heatmap-animation` (constants, PRNG, delay math, level range)
- `heatmap-components` (HeatmapCells/XAxis/YAxis/Tooltip/Separator)

Cross-group internals:
- `internal/spring` (createSpring — tooltip panel entrance)
- `internal/deferred-reveal` (runDeferredReveal, RevealHandle)
- `internal/use-prefers-reduced-motion`
- `internal/types` (ChartStatus)
- `internal` barrel (`usePositiveChartSize`)
- `internal/styles.css` (side-effect import)

External: `@tanstack/react-charts` (Chart), `@tanstack/charts` (defineChart, cell), `d3-scale` (scaleBand, scaleOrdinal), `react-dom` (createPortal).

## Deviations

- **Loading shimmer cut:** bklit's per-cell random pulse loop (`pulseOpacity`, `syncHeatmapCellLayerOpacities`, `heatmapLoadingCellParticipates`, `HEATMAP_LOADING_BASE_CELL_OPACITY`) is not ported; loading state renders a static skeleton. Dead constants/functions retained for API compat.
- **Pattern-fill cut (disclosed):** `buildHeatmapFillScale` always returns the level's solid `color`; `HeatmapPatternDefs`/`renderPatternPreset` not ported; `heatmapLevelCellFillOpacity` hardcoded to 1 (fixes a latent bug where `patternOpacity` would dim solid fallback cells). Full `pattern*` prop surface kept for typecheck compat.
- **Ghost-cell strategy:** bklit removes ghost bins from the DOM; migrated renders them as level −1 transparent rects (skipped by hit-testing and hover painting) to keep TanStack keys stable.
- **`HeatmapCells.colorScale` prop accepted but ignored** (`void _colorScaleProp`) — fill comes from context `fillScale`/ordinal encoding.
- **Highlight ring added:** migrated draws a 1.5 px stroke outline on the hovered cell; bklit only scales/dims. Dim-overlay + background-fill approach differs mechanically from bklit's per-cell opacity composition.
- **Tooltip reimplemented:** shared `TooltipBox` replaced by local panel with spring entrance, edge-flip, and an `instant` path that clamps using fixed 180×80 estimates; tooltip content JSX is duplicated between instant and animated paths.
- **`HeatmapInteractionRoot` always nests a provider** (bklit skipped nesting when one existed upstream); boundary drops bklit's `size-full min-h-0 min-w-0` base classes.
- **Separator gradient id is a static string** (`heatmap-separator-gradient`) without bklit's `useId`-derived uniqueness — collision-prone if multiple separators render gradients in one document.
- **Lifecycle timing equal but restructured:** conceal timer moved inside the status-transition effect; `finishReveal`/`beginReveal` callbacks inlined. `computeHeatmapDimensions` takes `binSize: number | undefined` (bklit: `number`).
- **Axis label geometry differs:** X/Y labels positioned via dedicated axis-layer spans (Y: `right:4`, top-centered on bin) vs bklit's flex boxes (`left:4`, `width: margin.left−12`, translateY −50%).
- **Suspicious duplication:** the 5-entry solid levelStyles literal is constructed in three places (colors module, legend fallback, `levelStylesFromColors`); tooltip date/weekday/divider/value markup appears twice in `heatmap-components.tsx`.
- **File consolidation:** 19 legacy files → 10 migrated files; `use-delayed-tooltip-data.ts` inlined into components, `heatmap-resolve-separator.ts` split between chart (child scan) and utils (normalize/layout), legend swatch/gradient merged into `heatmap-legend.tsx`.
