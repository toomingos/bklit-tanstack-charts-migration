export { LineChart } from "./line-chart";
export type { LineChartProps } from "./line-chart";
export { AreaChart } from "./area-chart";
export type { AreaChartProps } from "./area-chart";
export { ScatterChart } from "./scatter-chart";
export type { ScatterChartProps } from "./scatter-chart";
export { BarChart } from "./bar-chart";
export type { BarChartProps, BarOrientation } from "./bar-chart";
export { CandlestickChart } from "./candlestick-chart";
export type { CandlestickChartProps } from "./candlestick-chart";
export { ComposedChart } from "./composed-chart";
export type { ComposedChartProps } from "./composed-chart";
export { LiveLineChart } from "./live-line-chart";
export { detectMomentum } from "./internal/live-momentum";
export type { LiveLineChartProps, LiveLinePoint } from "./live-line-chart";
export type { Momentum } from "./internal/live-momentum";
export { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "./sankey-chart";
export type { SankeyChartProps, SankeyData, SankeyLabelOrientation, SankeyLinkProps, SankeyNodeProps, SankeyTooltipProps } from "./sankey-chart";
export { RadarChart, RadarGrid, RadarAxis, RadarLabels, RadarArea, DEFAULT_RADAR_COLORS as defaultRadarColors } from "./radar-chart";
export type { RadarChartProps, RadarGridProps, RadarAxisProps, RadarLabelsProps, RadarAreaProps, RadarData, RadarMetric } from "./radar-chart";
export { PieChart, DEFAULT_HOVER_OFFSET } from "./pie-chart";
export { PieSlice } from "./internal/pie-slice";
export { defaultPieColors } from "./internal/pie-default-colors";
export type { PieChartProps, PieSliceHoverEffect } from "./pie-chart";
export type { PieSliceProps } from "./internal/pie-slice";
export { PieCenter } from "./internal/pie-center-view";
export { usePieStable } from "./internal/pie-center-hooks";
export type { PieCenterProps, PieData, PieArcData } from "./internal/pie-center";
export { PieCenterShell } from "./internal/pie-center-shell";
export type { PieCenterShellProps } from "./internal/pie-center-shell";
export { RingChart, Ring } from "./ring-chart";
export { defaultRingColors, useRingStable, useRing, useRingHover, RingProvider } from "./internal/ring-context";
export type { RingChartProps, RingProps, RingData, RingLineCap, RingContextValue } from "./ring-chart";
export { RingCenter } from "./internal/ring-center";
export type { RingCenterProps } from "./internal/ring-center";
export { Gauge } from "./gauge";
export type { GaugeProps, GaugeOrientation, GaugeLabelAlign, GaugeLabelPlacement } from "./gauge";
export { FunnelChart } from "./funnel-chart";
export type { FunnelChartProps, FunnelStage, FunnelGradientStop } from "./funnel-chart";
export { AreaChartLoading } from "./area-chart-loading";
export type { AreaChartLoadingProps } from "./area-chart-loading";
export { BarChartLoading } from "./bar-chart-loading";
export type { BarChartLoadingProps } from "./bar-chart-loading";
export { resolveLineLoadingPulseMode } from "./internal/loading-chrome";
export type { LineLoadingPulseMode } from "./internal/loading-chrome";
export { HeatmapChart, HeatmapChartLoading, HeatmapCells, HeatmapXAxis, HeatmapYAxis, HeatmapTooltip, HeatmapLegend, HeatmapSeparator, HeatmapInteractionProvider, HeatmapInteractionBoundary, useHeatmap, HEATMAP_LEGEND_LEVELS, HEATMAP_DEFAULT_LEVEL_COLORS, HEATMAP_DEFAULT_LEVEL_STYLES, HEATMAP_DAY_LABELS } from "./heatmap-chart";
export type { HeatmapChartProps, HeatmapChartLoadingProps, HeatmapCellsProps, HeatmapXAxisProps, HeatmapYAxisProps, HeatmapTooltipProps, HeatmapLegendProps, HeatmapLegendVariant, HeatmapSeparatorProps, HeatmapContextValue, HeatmapLayout, HeatmapBin, HeatmapColumn, HeatmapWeekStartDay, HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter, HeatmapLevelColors, HeatmapLevelStyle, HeatmapLevelStyles, HeatmapLevelFillMode } from "./heatmap-chart";
export { SunburstChart, SunburstSegment, SunburstCenter, SunburstLabels, SunburstHint, SunburstBreadcrumb } from "./sunburst-chart";
export type { SunburstChartProps, SunburstSegmentProps, SunburstLabelsProps, SunburstHintContext, SunburstHintProps, SunburstBreadcrumbItem, SunburstBreadcrumbProps } from "./sunburst-chart";
export { sumValues, buildArcs, ringOptions, geometryFor, geomCentroidAngle, geomCentroidRadius, clockwiseFraction, arcPath, transitionGeometry, defaultSunburstGrowPadding, lerpGeometry } from "./internal/parity/sunburst-geometry";
export { useSunburstBreadcrumbItems } from "./internal/sunburst-breadcrumb-items";
export type { SunburstNode, ArcDatum, ArcGeometry, Focus } from "./internal/parity/sunburst-geometry";
export { ChoroplethChart, ChoroplethFeatureComponent, ChoroplethTooltip, ChoroplethGraticule, useChoroplethZoom, useChoropleth, ChoroplethProvider } from "./choropleth-chart";
export type { ChoroplethChartProps, ChoroplethFeatureProps, ChoroplethTooltipProps, ChoroplethGraticuleProps, ChoroplethContextValue, ChoroplethFeature, ChoroplethFeatureProperties } from "./choropleth-chart";
export type { TransformMatrix } from "./internal/choropleth-zoom-types";
export { ChartConfigProvider } from "./internal/chart-config-provider";
export { useChartConfig } from "./internal/use-chart-config";
export { DEFAULT_CHART_CONFIG } from "./internal/chart-config-context";
export { resolveTooltipBoxMotion } from "./internal/tooltip-box-motion";
export type { ChartConfigProviderProps, ChartConfigValue, SpringConfig } from "./internal/chart-config-context";
export { Line, Area, PatternArea, Scatter, Bar, BarSquares, BarColumnTrack, BarDepthProvider, BarDepthBack, BarDepthFront, BarPulse, SeriesBar, BarXAxis, Grid, XAxis, ChartTooltip, Candlestick, YAxis, LiveLine, LiveXAxis, LiveYAxis, ProjectionLine, ProjectionLineEndMarker, LineSeriesTerminalMarker, ChartMarkers, ProfitLossLine } from "./children";
export { CHART_CLIP_PASSTHROUGH } from "./internal/children-extract";
export type { ProjectionLineProps, ProjectionLineEndMarkerProps, LineSeriesTerminalMarkerProps, ProfitLossLineProps } from "./children";
export type { ChartMarker, ChartPhase, ChartStatus, MomentumColors, SeriesPointMarkerStyle, GradientStop, BarYAxisProps, BarDepthProviderProps, IndicatorWidth, TooltipRow } from "./internal/types";
export type { ChartMarkersProps } from "./internal/chart-markers";
export { buildProjectionPath, computeProjectionAnchorTangentSlope, buildHorizontalTangentBezierPath, projectionValueExtents, projectionDateExtents } from "./internal/projection-utils";
export type { ProjectionMode, ProjectionAutoMethod, ProjectionCurveKind, ProjectionPathDensity, ProjectionPoint, BuildProjectionPathOptions } from "./internal/projection-utils";
export { extractProjectionLineConfigs, mergeProjectionYDomain, mergeProjectionXDomainMax } from "./internal/projection-config";
export type { ProjectionLineConfig } from "./internal/projection-config";
export { legendCssVars, useLegend, useLegendItem } from "./internal/legend-context";
export type { LegendItemData, LegendContextValue, LegendItemContextValue } from "./internal/legend-context";
export { Legend, LegendItem as LegendItemComponent, LegendMarker, LegendLabel, LegendValue, LegendProgress } from "./internal/legend";
export type { LegendProps, LegendItemProps, LegendMarkerProps, LegendLabelProps, LegendValueProps, LegendProgressProps } from "./internal/legend";
export { ChartLegend } from "./internal/chart-legend";
export type { ChartLegendProps } from "./internal/chart-legend";
export { ChartLegendHoverProvider } from "./internal/chart-legend-hover";
export { useChartLegendHover } from "./internal/chart-legend-hover-context";
export { splitProfitLossSegments } from "./internal/profit-loss-segments";
export type { ProfitLossSegment } from "./internal/profit-loss-segments";
export { PROFIT_LOSS_POSITIVE_COLOR, PROFIT_LOSS_NEGATIVE_COLOR, profitLossColor, PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK, resolveProfitLossTooltipLabel } from "./internal/profit-loss-config";
export { ProfitLossLegend, PROFIT_LOSS_LEGEND_ITEMS } from "./internal/profit-loss-legend";
export type { ProfitLossLegendProps } from "./internal/profit-loss-legend";
export { ProfitLossLegendHoverProvider } from "./internal/profit-loss-legend-hover";
export { useProfitLossLegendHover } from "./internal/profit-loss-legend-hover-context";
export { ReferenceArea } from "./reference-area";
export type { ReferenceAreaProps, ReferenceAreaStrokeStyle, ReferenceAreaIfOverflow } from "./reference-area";
export { SegmentBackground, SegmentLineFrom, SegmentLineTo } from "./segment";
export type { SegmentBackgroundProps, SegmentLineProps, SegmentLineVariant } from "./segment";
export { ChartSelectionContext } from "./internal/chart-selection";

export { BrushLayout, BrushLayout as ChartBrushLayout } from "./internal/brush-layout";
export { ChartBrush } from "./internal/chart-brush";
export type { ChartBrushProps } from "./internal/chart-brush";
export { Background } from "./internal/background";
export type { BackgroundProps } from "./internal/background";
export type { GridProps } from "./internal/grid-child";
export { computeSquareColumn, topSquareCenterY } from "./internal/bar-squares-layout";
export type { SquareColumnLayout } from "./internal/bar-squares-layout";
export { HEATMAP_MONTHS_ONE_YEAR, HEATMAP_MONTHS_SIX, HEATMAP_WEEKS_ONE_YEAR, buildHeatmapLegendGradient, buildHeatmapRowOpacity, filterHeatmapColumns, formatHeatmapContributionLabel, formatHeatmapTooltipDate, formatHeatmapTooltipWeekday, formatHeatmapYAxisLabel, getHeatmapCalendarRangeStart, getHeatmapColumnMonthAnchor, getHeatmapDayLabels, getHeatmapSeparatorColumnIndices, getHeatmapTimeExtent, getHeatmapWeekCount, getHeatmapWeekStartAlignedToRange, getHeatmapWeekStartSunday, getHeatmapYearStartMonth, inferHeatmapCalendarRangeStart, resolveHeatmapWeekRange, shouldShowHeatmapYAxisTick } from "./internal/heatmap-utils";
export type { HeatmapWeekRange } from "./internal/heatmap-utils";
export { indicatorFadeGradientStops, resolveVerticalFadeSides } from "./internal/fade-mask";
export type { IndicatorFadeEdges } from "./internal/fade-mask";
export { MarkerTooltipContent } from "./internal/marker-tooltip";
export { useActiveMarkers } from "./internal/active-markers-store";
export type { MarkerTooltipContentProps } from "./internal/marker-tooltip";
export { PatternCircles, PatternHexagons, PatternLines, PatternWaves } from "./internal/pattern-preset";
export { isCirclePattern, isCirclesPattern, patternPresetTileSize, PATTERN_PRESET_IDS } from "./internal/pattern-preset-helpers";
export { renderPatternPreset } from "./internal/pattern-preset-render";
export type { PatternPresetId, PatternPresetOptions } from "./internal/pattern-preset";
export { computeReferenceAreaRect } from "./internal/reference-area-geometry";
export type { ReferenceAreaRect } from "./internal/reference-area-geometry";
export { DEFAULT_CHART_LIFECYCLE, DEFAULT_CHART_STATUS, DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase, resolveRestingChartPhase } from "./internal/chart-phase";
export { sunburstCssVars, defaultSunburstColors, opacityForRelativeDepth } from "./internal/sunburst-colors";
export { CHART_SCALE_VARS, chartScaleCssVars, choroplethCssVars, defaultChoroplethColors, heatmapCssVars, pieCssVars, radarCssVars, ringCssVars, sankeyCssVars } from "./internal/css-var-maps"; // oxlint-disable-line typescript/no-deprecated -- parity: bklit deprecates and still exports it
export type { ChartScaleVars } from "./internal/css-var-maps";
export { Y_AXIS_DEFAULT_TICK_COUNT, Y_AXIS_MAX_TICK_COUNT, Y_AXIS_MIN_TICK_COUNT, resolveYAxisTickCount } from "./internal/y-axis-ticks";
export { buildHeatmapColorScale, buildHeatmapColorScaleFromStyles, buildHeatmapFillScale, defaultHeatmapColorScale, defaultHeatmapFillScale, heatmapLevelPatternId, isHeatmapLevelPattern, levelStylesFromColors, resolveHeatmapLevelStyles } from "./internal/heatmap-colors";
export { ChartRevealClip } from "./internal/chart-reveal-clip";
export type { ChartRevealClipProps } from "./internal/chart-reveal-clip";
export { CenterStat as ChartStatFlow, defaultCenterStatFormat as defaultChartStatFlowFormat } from "./internal/center-stat";
export type { CenterStatProps as ChartStatFlowProps, CenterStatFormat as ChartStatFlowFormat } from "./internal/center-stat";
export { DEFAULT_ANIMATION_DURATION_MS, DEFAULT_ANIMATION_EASING } from "./internal/animation-defaults";
export { getPrimaryYScale, isYDomainTweenPhase } from "./internal/y-domain";
export type { YDomain } from "./internal/y-domain";
export { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
export type { YAxisOrientation } from "./internal/y-axis-id";
export { getMarkerVisualExtent as getSeriesMarkerVisualExtent } from "./internal/series-marker-mark";
export { DateTicker, TooltipBox, TooltipContent, TooltipDot, TooltipIndicator } from "./internal/tooltip-components";
export type { ChartTooltipProps, DateTickerProps, TooltipBoxProps, TooltipContentProps, TooltipDotProps, TooltipIndicatorProps } from "./internal/tooltip-components";
export { ChartHost } from "./internal/chart-host";
export type { ChartHostProps } from "./internal/chart-host";
export {
  ChartProvider,
  chartCssVars,
  defaultScatterColors,
  useChart,
  useChartHover,
  useChartStable,
  useYScale,
} from "./internal/chart-context";
export type {
  ChartContextValue,
  ChartHoverContextValue,
  ChartStableContextValue,
  LineConfig,
  Margin,
  TooltipData,
} from "./internal/chart-context";
export { useChartInteraction } from "./internal/use-chart-interaction";
export type { ChartSelection } from "./internal/use-chart-interaction";
export { StaticChartPreviewProvider, useStaticChartPreview } from "./internal/static-chart-preview";
export type { ChartMargin } from "./internal/use-chart-margin";
export {
  DEFAULT_CHART_ENTER_TRANSITION,
  clipRevealTransition,
  transitionWithDelay,
  useAnimatedYDomains,
} from "./internal/parity/animation";
export type { ChartEnterTransition } from "./internal/parity/animation";
export {
  chartCenterContainerClassName,
  chartCenterLabelClassName,
  chartCenterValueClassName,
} from "./internal/parity/typography";
export {
  computeYDomainsByAxis,
  isLoadingChromePhase,
  mergeYDomainRecords,
  niceYDomain,
  shouldTweenYDomain,
} from "./internal/parity/y-domain";
export { levelColorsFromStyles } from "./internal/parity/heatmap";
export type {
  ChoroplethTooltipData,
  SankeyLinkDatum,
  SankeyNodeDatum,
  SankeyTooltipData,
} from "./internal/parity/heatmap";
export type { OHLCDataPoint } from "./internal/parity/candlestick";
export type { LegendItem } from "./internal/parity/legend";
export type {
  BrushSelection,
  ChartBrushLayoutProps,
  ChartBrushLayoutState,
  ChartBrushPatternPreset,
  ChartBrushSelection,
  ChartBrushSelectionOverlayProps,
  ChartBrushSelectionPattern,
  ChartBrushTrackOverlayProps,
  ChartBrushTrackOverlayStyle,
} from "./internal/parity/brush";
export type {
  BarAnimationType,
  BarColumnTrackProps,
  BarDepthBackProps,
  BarDepthEntry,
  BarDepthFrontProps,
  BarDepthSegment,
  BarPulseProps,
  BarSquaresProps,
} from "./internal/parity/bar";
export type {
  AreaProps,
  BarProps,
  BarXAxisProps,
  CandlestickProps,
  LineProps,
  LiveLineProps,
  LiveXAxisProps,
  LiveYAxisProps,
  PatternAreaProps,
  ProjectionStrokeStyle,
  ScatterProps,
  SeriesBarProps,
  XAxisProps,
  YAxisProps,
} from "./internal/parity/child-props";
export {
  buildRevealDelays,
  buildRevealSchedule,
  buildSunburstEnterTiming,
  centroidAngle,
  localProgress,
  segmentRevealFromRingSweep,
} from "./internal/parity/sunburst";
export type {
  SunburstCenterProps,
  SunburstEnterTiming,
  SunburstRevealSchedule,
  SunburstSegmentEnterDelays,
} from "./internal/parity/sunburst";
// V3.7-B
export type { LoadingStyle } from "./internal/chart-phase";
export type { BarLineCap } from "./internal/bar-child";
export { BarYAxis } from "./internal/bar-y-axis-child";
export { useBarDepthEntries } from "./internal/use-bar-depth-entries";
export { MarkerGroup, type MarkerGroupProps } from "./internal/marker-group";
export { SeriesMarkers, type SeriesMarkersProps } from "./internal/series-markers";
export { SeriesPointMarker, type SeriesPointMarkerProps } from "./internal/series-point-marker";
// V3.7-C
export { HeatmapProvider } from "./internal/heatmap-context";
export { PieProvider, usePie, usePieHover } from "./internal/pie-context";
export type { PieContextValue } from "./internal/pie-context";
export { RadarProvider, useRadar, useRadarHover, useRadarStable } from "./internal/radar-context";
export type { RadarContextValue } from "./internal/radar-context";
export { useSunburstHover, useSunburstStable } from "./internal/sunburst-context";
// V3.4b
export {
  GradientDarkgreenGreen,
  GradientLightgreenGreen,
  GradientOrangeRed,
  GradientPinkBlue,
  GradientPinkRed,
  GradientPurpleOrange,
  GradientPurpleTeal,
  GradientSteelPurple,
  GradientTealBlue,
  LinearGradient,
  RadialGradient,
} from "./internal/gradient-entries";
export { generateChartSkeletonData, getSkeletonHeights } from "./internal/skeleton-data";
export type { GenerateChartSkeletonDataOptions } from "./internal/skeleton-data";
export {
  BarLoadingSkeleton,
  ChartLoadingLabel,
  LineLoadingPulseStroke,
  LineLoadingSweep,
} from "./internal/loading-entries";
export type {
  BarLoadingSkeletonProps,
  ChartLoadingLabelProps,
  LineLoadingPulseStrokeProps,
  LineLoadingSweepProps,
} from "./internal/loading-entries";
export { LineChartLoading } from "./line-chart-loading";
export type { LineChartLoadingProps } from "./line-chart-loading";
export { ChartBrushSelectionOverlay, ChartBrushTrackOverlay } from "./internal/brush-overlays";
// V3.5 (one animation owner): useAnimatedYDomains rides the merged export.
// Implementation lives in internal/parity/animation.

// V3.9 (skeleton as a chart): placeholder definitions and sweep paint stay internal.
// Nothing outside the package consumes them, and legacy exports none of them.
