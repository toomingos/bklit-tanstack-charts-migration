# internal-foundation — Phase 4 Research Report

**Files:** `showcase/migrated/charts/internal/{chart-config-context.tsx, design-tokens.ts, types.ts, formatters.ts, coerce-date.ts, parse-aspect-ratio.ts, use-container-size.ts, use-prefers-reduced-motion.ts, loading-chrome.tsx, center-stat.tsx, area-fill-mark.ts, pattern-preset.tsx, visx-pattern-bridge.tsx, pie-geometry.ts, index.ts}`, `showcase/migrated/charts/index.ts`, `showcase/migrated/charts/styles.css`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/{index.ts, chart-config-context.tsx, chart-formatters.ts, line-loading-timing.ts, chart-loading-label.tsx, line-loading-pulse.tsx, loading-sweep.tsx, generate-chart-skeleton-data.ts, chart-stat-flow.tsx, chart-center-typography.ts, pattern-preset.tsx, visx-pattern.tsx, pie-chart.tsx, pie-slice.tsx, ring.tsx}` + the per-component prop surfaces mirrored by `internal/types.ts` (line/area/scatter/grid/x-axis/bar/bar-squares/bar-depth/series-bar/bar-x-axis/candlestick/y-axis/live-*/projection-*/markers/*/pattern-area) + `globals.css` legend-dim rules

## Feature summary

Shared foundation layer: spring/config React context, centralized design tokens, the child-config type contract for all compositional charts, shared Intl formatters, date coercion, aspect-ratio parsing, five ResizeObserver measurement hooks, reduced-motion detection, loading chrome (pulse/sweep/skeletons/label), the NumberFlow center-stat island, the area-fill TanStack mark, the visx pattern-preset engine, pie/ring arc geometry, and the two barrels + the presentation stylesheet. Mostly infrastructure — no direct visuals except loading chrome and center stats.

## Public API

Per layout: shared internal group → table covers the group's exported surface, parity vs the corresponding legacy module. `charts/index.ts` is the package's public barrel → covered explicitly vs the legacy package barrel.

### internal/chart-config-context.tsx (vs `chart-config-context.tsx`)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `SpringConfig` | interface | same | `{stiffness, damping}` |
| `ChartConfigValue` | interface | same | 3 spring slots |
| `DEFAULT_CHART_CONFIG` | const | same | values now sourced from design-tokens |
| `ChartConfigProvider` (`value?: Partial<ChartConfigValue>`, `children`) | component | same | useMemo merge |
| `useChartConfig` | hook | same | falls back to defaults |
| `resolveTooltipBoxMotion` | util fn | same | damping-slider → spring mapping, verbatim |

### internal/design-tokens.ts (values vs their bklit origin sites)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| Reveal/entrance set: `REVEAL_DURATION_MS`=1100, `REVEAL_EASE_CSS`=`cubic-bezier(0.85,0,0.15,1)`, `REVEAL_EASE_POINTS`, `ENTRANCE_SPRING`={300,25} | constant | extra | tokenized bklit magic values (M1b 1100ms reveal) |
| Spring set: `TOOLTIP_SPRING`={300,30}, `TOOLTIP_BOX_SPRING`={100,20}, `HIGHLIGHT_SPRING`={180,28} | constant | same | were inline literals in legacy `chart-config-context.tsx` |
| Box/ticker set: `BOX_OFFSET`=16, `DISCRETE_INTERACTION_THRESHOLD`=60, `BOX_FALLBACK_WIDTH`=180, `BOX_FALLBACK_HEIGHT`=80, `TICKER_HALF_WIDTH`=50, `FADE_BUFFER`=20, `TICKER_ITEM_HEIGHT`=24 | constant | extra | extracted from hover-chrome call sites |
| Grid/bg/loading set: `DEFAULT_SHIMMER_LENGTH_PX`=140, `DEFAULT_SHIMMER_SPEED`=1, `DEFAULT_SHIMMER_STROKE` (color-mix oklch 68%), `BACKGROUND_ENTER_FADE_MS`=420, `LINE_LOADING_PULSE_CYCLE_S`=2.2, `LINE_LOADING_LOOP_PAUSE_MS`=280, `LOADING_LABEL_EXIT_S`=0.45, `LOADING_LABEL_EXIT_Y_PX`=30 | constant | same | grid.tsx / background.tsx / line-loading-timing.ts values |
| Legend/ProfitLoss set: `LEGEND_ITEM_HOVER_TRANSITION_MS`=150 + `..._EASING`="ease-out", `LEGEND_HOVER_DIM_OPACITY`=0.5, `CHART_LEGEND_FADED_OPACITY_CLASS`="opacity-40", `LEGEND_PROGRESS_TRANSITION_MS`=500, `PROFIT_LOSS_LEGEND_DIM_OPACITY`=0.25, `PROFIT_LOSS_LEGEND_DIM_TRANSITION`, `PROFIT_LOSS_LEGEND_DIM_DURATION_MS`=200 | constant | same | globals.css:126-132 / legend-item / chart-legend / legend-progress / profit-loss-line values; faded-class is a documented dead-code port |

### internal/types.ts (child-config contract vs legacy per-component props)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `ChartDatum` | type | same | `Record<string, unknown>` row contract |
| chart-phase re-export block: `ChartStatus`, `ChartPhase`, `DEFAULT_CHART_STATUS`, `DEFAULT_Y_DOMAIN_TWEEN_MS`, `Y_DOMAIN_TWEEN_SKIP_THRESHOLD`, `resolveRestingChartPhase`, `isChartInteractionPhase`, `DEFAULT_CHART_LIFECYCLE` | type/const | same | legacy `chart-phase.ts`; `LoadingStyle` not re-exported |
| `SeriesPointMarkerStyle` | interface | same | series-point-marker.tsx contract |
| `LineConfig` | interface | same | line.tsx LineProps pilot subset (fadeEdges/showHighlight/markers/dash*/loading*) |
| `AreaConfig` | interface | same | area.tsx AreaProps subset; documented default deltas (strokeWidth 2, curveMonotoneX, dim 0.6) |
| `PatternAreaConfig` | interface | renamed | deliberate convenience child-config reshape of pattern-area.tsx props (plan §10 ruling 1) |
| `ScatterConfig` | interface | same | scatter.tsx / series-markers.tsx subset |
| `GridConfig` | interface | same | grid.tsx full surface incl. highlight-row/shimmer/fade/hide-edge fields |
| `XAxisConfig` | interface | same | numTicks + formatValue subset |
| `GradientStop` | interface | same | legacy exports same name from bar-squares |
| Bar family: `BarConfig`, `BarSquaresConfig`, `BarColumnTrackConfig`, `BarDepthBackConfig`, `BarDepthFrontConfig`, `BarPulseConfig`, `BarDepthProviderConfig` | interface | same | bar.tsx / bar-squares.tsx / bar-depth.tsx pilot subsets |
| `SeriesBarConfig`, `BarXAxisConfig` | interface | same | series-bar.tsx / bar-x-axis.tsx subsets |
| Tooltip set: `ChartTooltipPoint`, `DotVariant`, `IndicatorWidth`, `TooltipRow`, `ChartTooltipConfig` (21 props) | interface/type | same | chart-tooltip.tsx TooltipRenderProps + full ChartTooltipProps parity |
| `CandlestickConfig`, `YAxisConfig` | interface | same | candlestick.tsx / y-axis.tsx subsets (left-orientation only) |
| Live set: `MomentumColors`, `LiveLineConfig`, `LiveXAxisConfig`, `LiveYAxisConfig` | interface | same | live-line/live-x-axis/live-y-axis subsets |
| Projection/markers set: `ProjectionLineChildConfig`, `ProjectionLineEndMarkerChildConfig`, `TerminalMarkerChildConfig`, `ProfitLossLineChildConfig`, `ChartMarker`, `ChartMarkersConfig` | type/interface | same | projection-line*.tsx / line-series-terminal-marker.tsx / profit-loss-line.tsx / markers/* shapes |
| `BrushChildConfig` (= `ReactNode`) | type | extra | elements kept as elements (host re-renders them under BrushHostContext) |
| `ExtractedChildren` | interface | extra | internal ordered-child extraction aggregate |

### remaining single-module surfaces

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `shortDateFmt`, `weekdayDateFmt`, `hmsTimeFmt`, `intFmt` (formatters.ts) | const | same | chart-formatters.ts verbatim |
| `isValidDate`, `toDate`, `numericValue` (coerce-date.ts) | util fn | extra | TanStack charts-core-d3 guard port + bklit-compat ISO-string fallback (documented deviation inherited by design) |
| `parseAspectRatio` (parse-aspect-ratio.ts) | util fn | extra | legacy passes `aspectRatio` CSS string straight through; migrated parses "w/h" → number (fallback 2) |
| `ChartSize` + `useContainerWidth`, `useDebouncedContainerWidth`, `useDebouncedContainerSize`, `useMeasuredRect`, `usePositiveChartSize` (use-container-size.ts) | hook | extra | consolidation of per-chart ResizeObserver patterns; bklit ParentSize debounce parity (10ms, 0.5px epsilon) |
| `usePrefersReducedMotion` (use-prefers-reduced-motion.ts) | hook | extra | legacy used motion/react `useReducedMotion` + one raw matchMedia (sunburst-chart.tsx); no shared hook existed |
| `getSkeletonHeights(count, seed)` (loading-chrome.tsx) | util fn | same | loading-sweep.tsx version with min/max params dropped (fixed 20–80 range) |
| `LoadingLabel({text, exiting})` (loading-chrome.tsx) | component | renamed | ChartLoadingLabel; motion/react + ShimmeringText → CSS classes + `data-bkm-loading-exiting`; `className` prop dropped |
| `LineLoadingPulse({pathD,width,height,stroke,strokeOpacity,strokeWidth,mode,loopEpoch,onCycleComplete})` | component | renamed | LineLoadingPulseStroke minus "Stroke"; width/height props replace chart-context reads; rAF replaces framer tween |
| `resolveLineLoadingPulseMode`, `LineLoadingPulseMode` | — | missing | phase→mode mapper not ported into loading-chrome |
| `LineLoadingSweep({width,height,stroke,...,seed})` | component | same | context dims → props; +seed; silhouette re-roll via seed not tick; **zero importers** |
| `BarLoadingSkeleton({innerWidth,innerHeight,...,seed})` | component | same | +seed; signs array dropped; **zero importers** |
| `generateChartSkeletonData(opts)` | util fn | same | options flattened; `generateChartSkeletonFromTarget`, `GenerateChartSkeletonDataOptions`, `DEFAULT_SKELETON_*` not ported; **zero importers** |
| `CenterStatFormat` | interface | renamed | ChartStatFlowFormat verbatim fields |
| `defaultCenterStatFormat` | const | renamed | defaultChartStatFlowFormat value |
| `CenterStat({value,label,formatOptions,prefix,suffix,valueClassName,labelClassName,icon})` | component | renamed | ChartStatFlow ported verbatim; Tailwind wrapper classes → styles.css `.ts-bkm-center-stat*` |
| `centerStat{Container,Value,Label,Icon}ClassName` (4 consts) | constant | extra | CSS-port naming bridge |
| `CenterStatHoverSource` | interface | extra | generic pub/sub contract for imperative hover coordinators |
| `useCenterStatHover(source)` | hook | extra | useSyncExternalStore binding onto coordinator |
| `AreaFillOptions` (area-fill-mark.ts) | interface | extra | `{id,x,y,fill,curve}` |
| `areaFill(data, options)` | mark | extra | createMark replacement for areaY fill layer (G4 heap fix); emits `kind:'area'` nodes with precomputed path, empty points |
| `PATTERN_PRESET_IDS`, `PatternPresetId` (pattern-preset.tsx) | const/type | same | 8 ids: none/diagonal/horizontal/vertical/cross/dots/circles/accent |
| `PatternPresetOptions` | interface | same | doc comment on `dotFill` dropped, fields identical |
| `isCirclePattern`, `isCirclesPattern`, `patternPresetTileSize`, `renderPatternPreset` | util fn | same | verbatim; deprecation tag dropped on isCirclesPattern |
| `PatternLines` (visx-pattern-bridge.tsx) | component | same | @visx/pattern passthrough |
| `PatternCircles` (visx-pattern-bridge.tsx) | component | same | @visx/pattern passthrough |
| `PatternWaves`, `PatternHexagons` | — | missing | legacy visx-pattern.tsx exported them; no preset uses them |
| `pieArcPath(inner,outer,start,end,corner,pad)` (pie-geometry.ts) | util fn | same | single port of bklit's duplicated generatePieArcPath (pie-chart.tsx) / generateArcPath (pie-slice.tsx, ring.tsx) |
| `SliceOffset` | interface | extra | return shape formalized |
| `sliceMidOffset(start,end,distance)` | util fn | renamed | bklit `getSliceOffset` verbatim, renamed for clarity |
| internal/index.ts facade (~60 symbols from ~25 modules) | barrel | extra | migrated-only aggregation; re-exports cross-group internals incl. orphaned legend/brush modules |

### charts/index.ts (public package barrel vs legacy `charts/index.ts`)

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| LineChart, AreaChart, ScatterChart, BarChart, CandlestickChart, ComposedChart (+ Props types, CandlestickEnterTransition, LiveLineChart/LiveLinePoint) | component | same | names + props types align |
| Pie family (PieChart, PieSlice, PieCenter, PieData/ArcData, PieEnterTransition, PieSliceHoverEffect), Ring family (RingChart, Ring, RingCenter, …), Gauge, FunnelChart | component | same | PieCenterFormat alias extra |
| Sankey family (SankeyChart/Link/Node/Tooltip + data types + Margin), Radar family (RadarChart/Grid/Axis/Labels/Area + data types + RadarEnterTransition), Sunburst family (SunburstChart/Segment/Center/Labels/Hint + SunburstArcDatum/Focus aliases) | component | same | aliases `SunburstArcDatum`/`SunburstFocus` extra |
| Heatmap mega-block (HeatmapChart + cells/axes/tooltip/legend/interaction components/hooks + consts HEATMAP_* + ~35 types incl. computeHeatmapLevelRange, HEATMAP_INACTIVE_OPACITY) | component | same | expanded vs legacy; see missing row for legacy-only helper fns |
| Choropleth family (ChoroplethChart/FeatureComponent/Tooltip/Graticule + ZoomContext/hooks/types) | component | same | ChoroplethZoomContext exported (legacy keeps it internal to choropleth/) |
| Children shims: Line, Area, PatternArea, Scatter, Bar, BarSquares, BarColumnTrack, BarDepthProvider/Back/Front, BarPulse, SeriesBar, BarXAxis, Grid, XAxis, ChartTooltip, Candlestick, YAxis, LiveLine, LiveXAxis, LiveYAxis, ProjectionLine, ProjectionLineEndMarker, LineSeriesTerminalMarker, ChartMarkers, ProfitLossLine, CHART_CHILD_PASSTHROUGH | component | renamed | legacy CHART_CLIP_PASSTHROUGH renamed; child-element API replaces flat props components |
| Add-ons: ReferenceArea (+StrokeStyle/IfOverflow types), SegmentBackground/SegmentLineFrom/SegmentLineTo | component | same | IfOverflow type extra |
| Config re-exports: ChartConfigProvider, useChartConfig, ChartConfigProviderProps, ChartConfigValue, SpringConfig | const | same | DEFAULT_CHART_CONFIG / resolveTooltipBoxMotion not re-exported publicly |
| Projection re-exports: buildProjectionPath … projectionDateExtents, extractProjectionLineConfigs, mergeProjection*/resolveVisibleEndX, ProjectionLineConfig | util fn | same | matches legacy projection-config/utils surface |
| Legend re-exports: legendCssVars, LegendProvider/ItemProvider, useLegend/useLegendItem, Legend…, ChartLegend, ChartLegendHoverProvider/useChartLegendHover, LegendItem (plain + as LegendItemComponent) | component | same | dual LegendItem export shape extra |
| ProfitLoss re-exports: colors, profitLossColor, segments, legend, hover provider, tooltip-label resolver | const | same | normalizeProfitLossConfig/extractProfitLossHoveredIndex stay internal-only |
| Selection/brush re-exports: ChartSelectionContext, BrushLayout, ChartBrush (+ pattern/box-style/host types), useBrushSelection, filterDataByXDomain, resolveBrushTrackXExtent | component/hook | same | legacy ChartBrushSelectionOverlay/TrackOverlay not ported; useChartInteraction → ChartSelectionContext |
| Missing from migrated barrel | — | missing | AreaChartLoading, LineChartLoading, BarChartLoading, Background, ChartRevealClip, ChartStatFlow, chartCenter*ClassName trio, PieCenterShell, DateTicker/TooltipBox/TooltipContent/TooltipDot/TooltipIndicator, MarkerGroup/MarkerTooltipContent/useActiveMarkers, SeriesMarkers, SeriesPointMarker + extent getter, StaticChartPreviewProvider/useStaticChartPreview, BarYAxis, detectMomentum/Momentum, LineLoadingPulseStroke/resolveLineLoadingPulseMode, getSkeletonHeights, generateChartSkeletonData/FromTarget + options type, DEFAULT_ANIMATION_DURATION_MS/EASING, DEFAULT_CHART_ENTER_TRANSITION, DEFAULT_HOVER_OFFSET, OHLCDataPoint, BarOrientation, CHART_CLIP_PASSTHROUGH (renamed), @visx/gradient re-export block (11), top-level Pattern* re-exports, CHART_SCALE_VARS/chartScaleCssVars, indicatorFade*/resolveVerticalFadeSides, useAnimatedYDomains, useChartInteraction (→ ChartSelectionContext), y-axis-scales/y-axis-ticks/y-domain-utils helper block, computeSquareColumn/topSquareCenterY (internal-barrel only), reference-area-geometry helpers, heatmap helper-fn block (buildHeatmap*/formatHeatmap*/getHeatmap*/resolveHeatmap*/levelColorsFromStyles/…), sunburst math block (buildRevealDelays/buildRevealSchedule/centroidAngle/lerpGeometry/localProgress/segmentRevealFromRingSweep/sumValues + timing types), SunburstBreadcrumb family, pie/ring/radar/sunburst/sankey context providers + cssVars fns (architecture: contexts are imperative coordinators now) |
| Extra in migrated barrel | — | extra | TransformMatrix re-export from @visx/zoom, per-chart EnterTransition types (Pie/Ring/Gauge/Funnel/Heatmap/Radar/Candlestick), Heatmap expanded consts (HEATMAP_INACTIVE_OPACITY, HEATMAP_DAY_LABELS, computeHeatmapLevelRange…), ChoroplethZoomContext, ChartMarkersOverlay, ChartMarker/ChartMarkersConfig type re-export, ReferenceAreaIfOverflow, ChartSelectionContext, BrushLayoutState, BrushHost, BrushSelectionPattern, ChartBrushSelectedBoxStyle |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| ChartConfigContext + Provider + useChartConfig | context | BKLIT | CUSTOM | no | React context; only context provided by this group; TS-check: none |
| useContainerWidth | hook | BKLIT | CUSTOM | no | 1 ResizeObserver; 0.5px epsilon; `enabled` gate; initial getBoundingClientRect commit; TS-check: partial — controller ResizeObserver (@plot-poc/host-core); no React hook/epsilon/gate |
| useDebouncedContainerWidth | hook | BKLIT | CUSTOM | no | 10ms debounce timer (ParentSize parity) prevents definition churn; TS-check: none |
| useDebouncedContainerSize | hook | BKLIT | CUSTOM | no | width+height in one debounced update; explicit-height mode (brush strip); TS-check: none |
| useMeasuredRect | hook | BKLIT | CUSTOM | no | polar/square charts; ungated initial commit; `enabled` gate; TS-check: none |
| usePositiveChartSize | hook | BKLIT | CUSTOM | no | heatmap/funnel positive-only commit pattern; TS-check: none |
| usePrefersReducedMotion | hook | BKLIT | CUSTOM | maybe | matchMedia listener via useSyncExternalStore; styles.css media block already handles CSS-side cases; TS-check: partial — motion() respectReducedMotion + controller preference re-render; no hook |
| useCenterStatHover | hook | CUSTOM | CUSTOM | no | scoped React re-render island (D10 concession); TS-check: none |
| useNumberFlowElementReady (private) | hook | BKLIT | CUSTOM | no | customElements.whenDefined("number-flow-react") gate; TS-check: none |
| isValidDate / toDate / numericValue | util fn | TANSTACK | TS-NATIVE | no | charts-core-d3 guard + ISO fallback; TS-check: none |
| parseAspectRatio | util fn | CUSTOM | TS-NATIVE | no | "/" split, NaN/0 guard → default 2; TS-check: CONTRADICTS no — native ChartProps.aspectRatio + ChartSizing.aspectRatio (@tanstack/react-charts, @plot-poc/host-core) |
| shortDateFmt / weekdayDateFmt / hmsTimeFmt / intFmt | constant | BKLIT | TS-NATIVE | no | en-US Intl formatters; TS-check: none |
| resolveTooltipBoxMotion | util fn | BKLIT | CUSTOM | no | ±400/−85 stiffness mapping, floor 12; TS-check: CONTRADICTS no — native spring system: createChartSpring (@tanstack/charts/spring) + ChartMotionSpringTransition stiffness/damping |
| design-tokens constants (see Public API rows for values) | constant | BKLIT | CUSTOM | no | durations/easings/springs/offsets/opacities; single-source rule; TS-check: partial — springs covered by ChartMotionSpringTransition; durations/easings/offsets not tokenized natively |
| getSkeletonHeights + hashFract | util fn | BKLIT | CUSTOM | no | deterministic sin-hash; SSR-safe; TS-check: none |
| generateChartSkeletonData | util fn | BKLIT | CUSTOM | no | sine placeholder series (110±36+9i, base 2025-01-01); TS-check: none |
| CLIP_PADDING=10, DEFAULT_SWEEP_DURATION_S=2, SWEEP_ANGLE_DEG=25 (loading-chrome locals) | constant | BKLIT | CUSTOM | no | legacy loading-sweep.tsx values; SWEEP_START/END_X replaced by CSS keyframe translateX(0→3); TS-check: none |
| LineLoadingPulse rAF loop | util fn | BKLIT | CUSTOM | no | side-effect channel: requestAnimationFrame progress driver + window.setTimeout(280ms loop pause) + document.getElementById on clip rect; eslint-disable exhaustive-deps; TS-check: none |
| LoadingLabel | component | BKLIT | CUSTOM | no | CSS shimmer/exit keyframes + `aria-live`/`role=status`; exits via `data-bkm-loading-exiting`; TS-check: none |
| LineLoadingSweep | component | BKLIT | CUSTOM | no | d3-scale/d3-shape skeleton + SVG pattern mask; band animated by `.ts-bkm-sweep-band` CSS class; orphaned; TS-check: none |
| BarLoadingSkeleton | component | BKLIT | CUSTOM | no | masked seeded bars; orphaned; TS-check: none |
| CenterStat | component | BKLIT | CUSTOM | no | @number-flow/react digit roll; Intl static fallback pre-hydration; TS-check: none |
| areaFill | mark | CUSTOM | TS-NATIVE | yes | createMark on @tanstack/charts; channels x/y with includeZero; renders `kind:'area'` group `.ts-chart__area` ariaHidden; TS-check: native — createMark (@tanstack/charts) |
| patternPresetTileSize / renderPatternPreset / isCirclePattern(s) | util fn | BKLIT | CUSTOM | no | tile sizes 6/8/10px, radius formulas, accent #e879f9 hardcoded (same as legacy); TS-check: none |
| PatternLines / PatternCircles bridge | component | BKLIT | CUSTOM | no | thin @visx/pattern passthrough; SVG `<defs>` output; TS-check: none |
| pieArcPath / sliceMidOffset | util fn | BKLIT | TS-NATIVE | no | d3-shape arc() (not @visx/shape wrapper) — byte-identical paths; sin/−cos mid-angle offset; TS-check: CONTRADICTS no — native radialArc + pie + resolvePolarSector cornerRadius (@tanstack/charts/polar) |
| internal/index.ts | barrel | CUSTOM | CUSTOM | no | facade over ~25 cross-group modules; TS-check: none |
| charts/index.ts | barrel | BKLIT | CUSTOM | no | public surface; see Public API missing/extra rows; TS-check: none |
| CSS: `:root`/`.dark` `--chart-marker-*`, `--chart-brush-border` vars | CSS class | BKLIT | CUSTOM | no | consumed by chart-markers / brush parts; TS-check: partial — theme reads --ts-plot-* vars (@plot-poc/host-core); custom vars unsupported |
| CSS: `[data-bkm-chart] .ts-chart__grid line` | CSS class | BKLIT | CUSTOM | no | stroke var(--chart-grid), 4 4 dash — grid part; TS-check: partial — theme.grid token (@plot-poc/host-core); dasharray not configurable |
| CSS: `[data-bkm-fade-edges]`, `-left`, `-right` masks | CSS class | BKLIT | CUSTOM | no | line/area/composed edge fade (0/15/85/100% stops); TS-check: partial — scene.gradients → native linearGradient defs (@tanstack/charts/svg), no edge-fade mask helper |
| CSS: `.ts-chart__marks--revealing { opacity:0 }` | CSS class | CUSTOM | CUSTOM | no | scatter mount pre-hide before per-circle WAAPI tweens; TS-check: none |
| CSS: candlestick reveal block (`.ts-chart__candle rect` 150ms transition + `@keyframes ts-candle-reveal` 60-sample scaleY curve) | CSS class | BKLIT | CUSTOM | no | replaces 20k WAAPI objects at n=10000; bounce-invariance baked; TS-check: none |
| CSS: suppression rules (`.ts-chart__axes`, `[data-ts-chart-focus]`, `svg:focus:not(:focus-visible)`) | CSS class | BKLIT | CUSTOM | no | hides TanStack axes/focus ring; keyboard focus kept; TS-check: CONTRADICTS no — native axis:false (ChartAxisOptions) + focus:false → focusDisabled (@tanstack/charts) |
| CSS: hover chrome set `.bkm-hover-layer`, `.bkm-tooltip-{layer,panel,content,title,rows,row,row-label,swatch,series,value}` | CSS class | BKLIT | CUSTOM | no | Tailwind v4 values resolved; consumed by internal-interaction group; TS-check: partial — tooltip.tsx native chrome (@tanstack/charts), no bklit-style panel classes |
| CSS: date pill set `.bkm-date-pill{-layer,-inner}` + dark variant | CSS class | BKLIT | CUSTOM | no | zinc-900/100 oklch; tooltip-chrome + live-hover-chrome; TS-check: none |
| CSS: radar/gauge/ring transform rules (`[data-ts-key^=…]` transform-origin/view-box, radar area/dot transitions 0.15s/0.35s) | CSS class | BKLIT | CUSTOM | no | radar/gauge/ring parts; TS-check: none |
| CSS: sunburst dim (`.ts-chart__marks path` 160ms ease-out) | CSS class | BKLIT | CUSTOM | no | sunburst part; TS-check: partial — native focus dimming via resolveFocusPresentation (@tanstack/charts), not CSS-transition-based |
| CSS: live overlays `.bkm-live-xlabel{-layer}`, `.bkm-live-ytick{-layer}` | CSS class | BKLIT | CUSTOM | no | live-line part; per-frame JS writes position/opacity; TS-check: none |
| CSS: center typography `.ts-bkm-pie-center*`, `.ts-bkm-center-stat*`, `.ts-bkm-gauge-linear-stat-*` | CSS class | BKLIT | CUSTOM | no | clamp(22cqw/9cqw) container-query ports; observed dead-class behaviors preserved (line-height 1.5; gauge inherit); TS-check: none |
| CSS: funnel labels `.ts-bkm-funnel-{value,pct,label}` | CSS class | BKLIT | CUSTOM | no | literal Tailwind port incl. v4 shadow-sm; TS-check: none |
| CSS: heatmap set `.ts-bkm-heatmap-*` (~18 classes; legend trio unscoped) | CSS class | BKLIT | CUSTOM | no | heatmap part; z-index layering svg/html/tooltip; TS-check: none |
| CSS: generic loading set (`@keyframes ts-bkm-shimmer/ts-bkm-loading-exit/ts-bkm-sweep`, `.ts-bkm-loading-label{-wrap,-text}`, `.ts-bkm-sweep-band`, prefers-reduced-motion block) | CSS class | BKLIT | CUSTOM | no | line/heatmap loading chrome; **block duplicated verbatim twice in file**; TS-check: none |
| CSS: legend hover dim `.legend-container:has([data-hovered])` rules (unscoped) | CSS class | BKLIT | CUSTOM | no | legend family renders outside [data-bkm-chart]; TS-check: partial — interactiveColorLegend toggle (@tanstack/charts/legend), no hover-dim equivalent |
| CSS: transition carriers `.chart-profit-loss-segment`, `.chart-candle-cell` | CSS class | BKLIT | CUSTOM | no | renderer drops transition attributes (D224); TS-check: none |
| CSS: vector-effect fixes `.ts-sankey__link`, `.chart-projection-line path` | CSS class | CUSTOM | CUSTOM | no | hiDPI non-scaling-stroke hazard workaround; TS-check: partial — svg-renderer hardcodes vector-effect="non-scaling-stroke" on paths; CSS override still needed |

## Imports

- `./design-tokens` ← chart-config-context, loading-chrome
- `./fade-mask` ← types (type `IndicatorFadeEdges`), loading-chrome (`fadeGradientStops`, `resolveFadeSides`, `viewportFadeGradientAttrs`)
- `./chart-phase` ← types (8-symbol re-export)
- `./pattern-preset` ↔ `./visx-pattern-bridge` (intra-group pair); types.ts references pattern-preset/projection-utils/fade-mask types
- External: `@tanstack/charts` (createMark — area-fill-mark), `d3-shape` (pie-geometry, loading-chrome), `d3-scale` (loading-chrome), `@visx/pattern` (bridge), `@number-flow/react` (center-stat), `react`
- internal/index.ts re-exports from other groups: bezier-easing, bisect, decimate, focus-disabled, use-chart-margin, sunburst-types/geometry/colors, heatmap-context/lifecycle/interaction/components/legend, legend/legend-context/chart-legend/chart-legend-hover, profit-loss-{segments,config,line-mark,legend,legend-hover}, fade-mask, chart-brush, pattern-area-mark, bar-{squares-layout,squares-mark,column-track-mark,depth-geometry,depth-marks,pulse-mark,trimmed-mark}, brush-{layout,selection,drag}
- charts/index.ts additionally pulls from `./children`, `./internal/{pie-center, ring-center, chart-markers, projection-utils, projection-config, chart-selection, types}`

## Deviations

- **styles.css duplication**: the generic loading-label/sweep block (wrap/text rules, `ts-bkm-loading-exit` + `ts-bkm-sweep` keyframes, reduced-motion override) appears **twice verbatim** (lines ~846–926 and ~928–984). Harmless but suspicious — likely a merge artifact.
- **Orphaned loading surface**: `LineLoadingSweep`, `BarLoadingSkeleton`, `getSkeletonHeights`, `generateChartSkeletonData` are exported with **zero importers** anywhere under `showcase/migrated/charts`. Legacy wired these via `loadingStyle="sweep"` / `status="loading"`; migrated charts render empty-grid + shimmer-label loading instead (consistent with research/phase-4/area.md's "pulse/sweep chrome intentionally not ported").
- Not ported from legacy loading modules: `resolveLineLoadingPulseMode`/`LineLoadingPulseMode`, `generateChartSkeletonFromTarget`, `GenerateChartSkeletonDataOptions`, `DEFAULT_SKELETON_*`.
- visx-pattern-bridge drops `PatternWaves`/`PatternHexagons` (no preset consumes them).
- `LoadingLabel` drops legacy `className` prop; motion/react + ShimmeringText replaced by CSS classes + exit data-attribute.
- pie-geometry calls d3-shape `arc()` directly instead of `@visx/shape` (bare-specifier resolution constraint outside bench/app root) — disclosed, byte-identical output.
- center-stat is the one sanctioned React re-render island (NumberFlow digit roll has no imperative retarget); Tailwind arbitrary-value classes hand-ported to styles.css because migrated/charts sits outside bench/app's Tailwind `@source`; observed dead-class behaviors preserved (tailwind-merge kills `leading-tight` → line-height 1.5; gauge linear stat inherits font-size from bklit's invalid color-var font-size — D52).
- `CHART_LEGEND_FADED_OPACITY_CLASS` ports bklit's dead `opacity-40` class byte-for-byte (documented dead code under the CSS dim rule).
- types.ts `PatternAreaConfig` is a deliberate reshape of pattern-area props (plan §10 ruling 1); brush children kept as elements, not extracted props.
- `CHART_CHILD_PASSTHROUGH` renames legacy `CHART_CLIP_PASSTHROUGH`.
- LineLoadingPulse effect carries an `eslint-disable react-hooks/exhaustive-deps` (deps limited to width/loopEpoch/mode).
