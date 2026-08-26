<task id="57d5b1a8-44d7-4f18-8c48-cb5720462fb0" state="completed">
<task_result>
All seven items verified read-only. Note: two tiny diff temp files remain in the session scratchpad (`cssA.txt`/`cssB.txt`) — shell deletion was hook-blocked; the scratchpad auto-cleans with the session.

**1. Legacy constant provenance — VERIFIED**
(a) `BAR_DIM_TRANSITION = "opacity 0.12s ease-in-out"` ← `repos/bklit-ui/packages/ui/src/charts/series-bar.tsx:253` `transition={{ opacity: { duration: 0.12 } }}` (framer-motion, seconds). Match.
(b) `MARKER_ACTIVE_SCALE = 1.35` ← `series-markers.tsx:196` `const activeScale = showActiveHighlight ? 1.35 : 1;`. Match.

**2. shortDateFmt — VERIFIED, output-identical**
`internal/formatters.ts:4-7`: `new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"})`. All 5 sites (bar-chart.tsx:647, scatter-chart.tsx:402, candlestick-chart.tsx:567, composed-chart.tsx:967, use-hover-chrome.ts:70) call `toLocaleDateString("en-US",{month:"short",day:"numeric"})` — same locale, same options, no `timeZone` anywhere. Per ECMA-402, `toLocaleDateString` constructs an identical Intl.DateTimeFormat internally → byte-identical output.

**3. styles.css duplicate block — VERIFIED, second is redundant subset**
Block A (846–926) = Block B (928–984) PLUS lines 846–868 which B lacks: the comment banner, `@keyframes ts-bkm-shimmer` (850–853), and the scoped base rule `[data-bkm-chart] .ts-bkm-loading-label` (855–868). Every rule B repeats (`.ts-bkm-loading-label-wrap`, `-text`, `-exiting` selector, `ts-bkm-loading-exit`, `ts-bkm-sweep`, `.ts-bkm-sweep-band`, reduced-motion block) is verbatim identical. Authoritative copy = first (complete; owns the shimmer keyframes). B is safe to delete wholesale.

**4. Bar toDotConfig fallback — VERIFIED, byte-identical**
Canonical: `hover-chrome.ts:104-114` maps 6 fields (variant/size/radiusFraction/scale/strokeWidth/color). Bar: `bar-hover-chrome.ts:81-98` maps the same 6 fields, then a ring-only branch at **91–96** gated on `bandWidth != null && seriesCount != null`. `BarHoverChromeState` (38–51) has no `bandWidth` field and `bar-chart.tsx:651-671` never sets one → phantom read at 382 always `undefined` → branch dead → output exactly canonical. Dead divergent lines: bar-hover-chrome.ts:91–96 (+ groupGap `4` arg at 383, unused when undefined).

**5. bisectDateLeft twins — VERIFIED, equivalent**
Private (`hover-reanchor.ts:16-26`): property-keyed accessor (`d[xDataKey]`, `Date.getTime()`, NaN guard), `lo=0, hi=len`, shift `>> 1`, `< target → lo=mid+1`. Shared (`bisect.ts:2-16`): callback accessor, caller-supplied lo/hi, `>>> 1`, same `<` shift logic. Only diffs: accessor shape, `>>` vs `>>>` (identical for len < 2³¹), who supplies bounds. Leftmost-bisect semantics match → same index for sorted unique timestamps AND for duplicate ties (both return leftmost). No divergent tie case.

**6. EnterTransition survival map — VERIFIED**
| Name | Barrel source | Origin |
|---|---|---|
| CandlestickEnterTransition | `./candlestick-chart` | local interface (candlestick-chart.tsx:91) |
| RadarEnterTransition | `./radar-chart` | local interface (radar-chart.tsx:82) |
| PieEnterTransition | `./pie-chart` | alias ← internal/pie-reveal.ts:29 `= EnterTransition` |
| RingEnterTransition | `./ring-chart` | alias ← internal/ring-reveal.ts:29 `= EnterTransition` |
| GaugeEnterTransition | `./gauge` | alias ← internal/gauge-reveal.ts:49 `= EnterTransition` |
| FunnelEnterTransition | `./funnel-chart` | alias ← internal/funnel-reveal.ts:37 `= EnterTransition` |
| HeatmapEnterTransition | `./heatmap-chart` | internal/heatmap-animation.ts (via heatmap-context.ts:11) |

All 7 public names survive shim collapse: 4 are pure `= EnterTransition` aliases (one aliases module covers them); candlestick/radar are self-contained interfaces; heatmap doesn't touch the shims.

**7. FD12 missing-barrel enumeration — VERIFIED (script-extracted, spot-checked)**
Single legacy barrel: `repos/bklit-ui/packages/ui/src/charts/index.ts` (503 symbols) vs migrated `showcase/migrated/charts/index.ts` (297). **Missing: 276 — not ~60** (the ~60 estimate is far off; likely counted components only). Migrated additionally has 70 migrated-only additions. No `export default` on either side. Spot-checked false positives: `Background`, `TooltipDot`, `usePie`, `SeriesMarkers`, `DEFAULT_HOVER_OFFSET`, `arcPath`, `MarkerGroup`, `TooltipContent` genuinely absent; `Line/Area/Grid/XAxis/YAxis/Legend/ChartTooltip` correctly not listed.

**COMPONENT (40)** — LinearGradient, RadialGradient, GradientDarkgreenGreen, GradientLightgreenGreen, GradientOrangeRed, GradientPinkBlue, GradientPinkRed, GradientPurpleOrange, GradientPurpleTeal, GradientSteelPurple, GradientTealBlue (11 visx re-exports); AreaChartLoading, Background, BarChartLoading, BarYAxis, ChartBrushLayout, ChartBrushSelectionOverlay, ChartBrushTrackOverlay, ChartLoadingLabel, ChartRevealClip, ChartStatFlow, LineChartLoading, LineLoadingPulseStroke, BarLoadingSkeleton, LineLoadingSweep, MarkerGroup, MarkerTooltipContent, PieCenterShell, SeriesMarkers, SeriesPointMarker, SunburstBreadcrumb, DateTicker, TooltipBox, TooltipContent, TooltipDot, TooltipIndicator, PatternCircles, PatternHexagons, PatternLines, PatternWaves

**TYPE (97)** — AreaProps, AreaChartLoadingProps, BackgroundProps, BarAnimationType, BarLineCap, BarProps, BarOrientation, BarChartLoadingProps, BarDepthBackProps, BarDepthEntry, BarDepthFrontProps, BarDepthProviderProps, BarDepthSegment, BarPulseProps, BarColumnTrackProps, BarSquaresProps, GradientStop, SquareColumnLayout, BarXAxisProps, BarYAxisProps, CandlestickProps, OHLCDataPoint, ChartBrushSelection, ChartBrushLayoutProps, ChartBrushLayoutState, ChartBrushPatternPreset, ChartBrushSelectionOverlayProps, ChartBrushSelectionPattern, ChartBrushTrackOverlayProps, ChartBrushTrackOverlayStyle, ChartContextValue, ChartHoverContextValue, ChartStableContextValue, TooltipData, ChartLoadingLabelProps, LoadingStyle, ChartRevealClipProps, ChartScaleVars, ChartStatFlowFormat, ChartStatFlowProps, ChoroplethTooltipData, GenerateChartSkeletonDataOptions, GridProps, HeatmapWeekRange, IndicatorFadeEdges, LineProps, LineChartLoadingProps, LineLoadingPulseMode, LineLoadingPulseStrokeProps, LiveLineProps, Momentum, LiveXAxisProps, LiveYAxisProps, BarLoadingSkeletonProps, LineLoadingSweepProps, ChartMarkersProps, MarkerGroupProps, MarkerTooltipContentProps, PatternAreaProps, PatternPresetId, PatternPresetOptions, PieCenterShellProps, PieContextValue, ProjectionStrokeStyle, RadarContextValue, ReferenceAreaRect, RingContextValue, SankeyContextValue, SankeyTooltipData, ScatterProps, SeriesBarProps, SeriesMarkersProps, SeriesPointMarkerProps, SeriesPointMarkerStyle, ArcDatum, ArcGeometry, Focus, SunburstEnterTiming, SunburstRevealSchedule, SunburstSegmentEnterDelays, SunburstBreadcrumbItem, SunburstBreadcrumbProps, SunburstCenterProps, SunburstHintContext, SunburstHintProps, ChartTooltipProps, DateTickerProps, IndicatorWidth, TooltipBoxProps, TooltipContentProps, TooltipDotProps, TooltipIndicatorProps, TooltipRow, XAxisProps, YAxisProps, YAxisOrientation, YDomain

**HELPER-FN (91)** — computeSquareColumn, topSquareCenterY, chartCenterContainerClassName, chartCenterLabelClassName, chartCenterValueClassName, resolveTooltipBoxMotion, chartCssVars, defaultScatterColors, isChartInteractionPhase, resolveRestingChartPhase, chartScaleCssVars, defaultChartStatFlowFormat, choroplethCssVars, defaultChoroplethColors, generateChartSkeletonData, buildHeatmapColorScale, buildHeatmapColorScaleFromStyles, buildHeatmapFillScale, buildHeatmapLegendGradient, buildHeatmapRowOpacity, defaultHeatmapColorScale, defaultHeatmapFillScale, filterHeatmapColumns, formatHeatmapContributionLabel, formatHeatmapTooltipDate, formatHeatmapTooltipWeekday, formatHeatmapYAxisLabel, getHeatmapCalendarRangeStart, getHeatmapColumnMonthAnchor, getHeatmapDayLabels, getHeatmapSeparatorColumnIndices, getHeatmapTimeExtent, getHeatmapWeekCount, getHeatmapWeekStartAlignedToRange, getHeatmapWeekStartSunday, getHeatmapYearStartMonth, heatmapCssVars, heatmapLevelPatternId, inferHeatmapCalendarRangeStart, isHeatmapLevelPattern, levelColorsFromStyles, levelStylesFromColors, resolveHeatmapLevelStyles, resolveHeatmapWeekRange, shouldShowHeatmapYAxisTick, indicatorFadeGradientStops, resolveVerticalFadeSides, resolveLineLoadingPulseMode, detectMomentum, getSkeletonHeights, isCirclePattern, isCirclesPattern, patternPresetTileSize, renderPatternPreset, defaultPieColors, pieCssVars, defaultRadarColors, radarCssVars, computeReferenceAreaRect, defaultRingColors, ringCssVars, sankeyCssVars, getSeriesMarkerVisualExtent, arcPath, buildArcs, buildRevealDelays, buildRevealSchedule, buildSunburstEnterTiming, centroidAngle, clockwiseFraction, defaultSunburstGrowPadding, geomCentroidAngle, geomCentroidRadius, geometryFor, lerpGeometry, localProgress, ringOptions, segmentRevealFromRingSweep, sumValues, transitionGeometry, defaultSunburstColors, opacityForRelativeDepth, sunburstCssVars, getPrimaryYScale, resolveYAxisTickCount, computeYDomainsByAxis, isLoadingChromePhase, isYDomainTweenPhase, mergeYDomainRecords, niceYDomain, shouldTweenYDomain

**HOOK (22)** — useBarDepthEntries, useChart, useChartHover, useChartStable, useYScale, useActiveMarkers, usePie, usePieHover, usePieStable, useRadar, useRadarHover, useRadarStable, useRing, useRingHover, useRingStable, useSankey, useStaticChartPreview, useSunburstBreadcrumbItems, useSunburstHover, useSunburstStable, useAnimatedYDomains, useChartInteraction

**CONST (18)** — DEFAULT_ANIMATION_DURATION_MS, DEFAULT_ANIMATION_EASING, DEFAULT_CHART_ENTER_TRANSITION, CHART_CLIP_PASSTHROUGH, DEFAULT_CHART_CONFIG, DEFAULT_CHART_LIFECYCLE, DEFAULT_CHART_STATUS, DEFAULT_Y_DOMAIN_TWEEN_MS, CHART_SCALE_VARS, HEATMAP_MONTHS_ONE_YEAR, HEATMAP_MONTHS_SIX, HEATMAP_WEEKS_ONE_YEAR, PATTERN_PRESET_IDS, DEFAULT_HOVER_OFFSET, DEFAULT_Y_AXIS_ID, Y_AXIS_DEFAULT_TICK_COUNT, Y_AXIS_MAX_TICK_COUNT, Y_AXIS_MIN_TICK_COUNT

**CONTEXT-PROVIDER (8)** — ChartProvider, ChoroplethProvider, HeatmapProvider, PieProvider, RadarProvider, RingProvider, SankeyProvider, StaticChartPreviewProvider

**DEFAULT-EXPORT (0)** — neither barrel has one.
</task_result>
</task>

[exited with code 0]
