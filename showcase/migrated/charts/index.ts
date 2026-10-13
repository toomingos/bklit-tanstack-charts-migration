// Public API of bklit-tanstack-charts, in bklit-ui's shape. Exports tagged `@internal` at their declaration are kept for
// bklit-ui compatibility only: they are building blocks of the charts, not part of the documented surface.

// ---------------------------------------------------------------------------
// Cartesian charts
// ---------------------------------------------------------------------------

// Line
export { LineChart } from "./line-chart";
export type { LineChartProps } from "./line-chart";
export { LineChartLoading } from "./line-chart-loading";
export type { LineChartLoadingProps } from "./line-chart-loading";
// Area
export { AreaChart } from "./area-chart";
export type { AreaChartProps } from "./area-chart";
export { AreaChartLoading } from "./area-chart-loading";
export type { AreaChartLoadingProps } from "./area-chart-loading";
// Scatter
export { ScatterChart } from "./scatter-chart";
export type { ScatterChartProps } from "./scatter-chart";
// Bar
export { BarChart } from "./bar-chart";
export type { BarChartProps, BarOrientation } from "./bar-chart";
export { BarChartLoading } from "./bar-chart-loading";
export type { BarChartLoadingProps } from "./bar-chart-loading";
export { BarYAxis } from "./bar/carriers";
export { useBarDepthEntries } from "./bar/depth-entries";
export type { BarDepthEntry } from "./bar/depth-entries";
export type { SquareColumnLayout } from "./bar/geometry";
export { computeSquareColumn, topSquareCenterY } from "./bar/geometry";
export type { BarProps, BarAnimationType, BarLineCap, BarDepthBackProps, BarDepthFrontProps, BarDepthProviderProps, BarDepthSegment, BarPulseProps, BarColumnTrackProps, BarSquaresProps, BarXAxisProps, BarYAxisProps } from "./bar/carriers";
// Candlestick
export { CandlestickChart } from "./candlestick-chart";
export type { CandlestickChartProps, OHLCDataPoint } from "./candlestick-chart";
export type { CandlestickProps } from "./candlestick/carrier";
// Composed
export { ComposedChart } from "./composed-chart";
export type { ComposedChartProps } from "./composed-chart";
export type { SeriesBarProps } from "./composed/series-bar";
// Live line
export { LiveLineChart } from "./live-line-chart";
export { detectMomentum } from "./live-line/momentum";
export type { LiveLineChartProps, LiveLinePoint } from "./live-line-chart";
export type { Momentum } from "./live-line/momentum";
export type { LiveLineConfig as LiveLineProps, LiveXAxisConfig as LiveXAxisProps, LiveYAxisConfig as LiveYAxisProps, MomentumColors } from "./live-line/carriers";

// Cartesian layers, composed as children of the cartesian charts above.
export { Line, Area, PatternArea, Background, Scatter, Bar, BarSquares, BarColumnTrack, BarDepthProvider, BarDepthBack, BarDepthFront, BarPulse, SeriesBar, BarXAxis, Grid, XAxis, ChartTooltip, Candlestick, YAxis, LiveLine, LiveXAxis, LiveYAxis, ProjectionLine, ProjectionLineEndMarker, LineSeriesTerminalMarker, ChartMarkers, ProfitLossLine } from "./children";
export type { ProjectionLineProps, ProjectionLineEndMarkerProps, LineSeriesTerminalMarkerProps, ProfitLossLineProps } from "./children";
export type {
  AreaConfig as AreaProps,
  BackgroundConfig as BackgroundProps,
  ChartMarker,
  ChartMarkersProps,
  GridProps,
  LineConfig as LineProps,
  PatternAreaConfig as PatternAreaProps,
  ScatterConfig as ScatterProps,
  XAxisConfig as XAxisProps,
  YAxisConfig as YAxisProps,
} from "./kit/types";
export { SeriesMarkers, MarkerGroup } from "./children";
export type { SeriesMarkersProps, MarkerGroupProps } from "./children";
export { SeriesPointMarker } from "./series-point-marker";
export type { SeriesPointMarkerProps } from "./series-point-marker";
export type { SeriesPointMarkerStyle } from "./kit/types";
export { ReferenceArea } from "./reference-area";
export type { ReferenceAreaProps, ReferenceAreaStrokeStyle, ReferenceAreaIfOverflow, ReferenceAreaRect } from "./reference-area";
export { SegmentBackground, SegmentLineFrom, SegmentLineTo } from "./segment";
export type { SegmentBackgroundProps, SegmentLineProps, SegmentLineVariant } from "./segment";
export type { IndicatorFadeEdges, ProjectionPoint, ProjectionStrokeStyle, ProjectionLineConfig } from "./kit/types";
export type { ReferenceAreaConfig } from "./kit/cartesian/chart-context";
export { useActiveMarkers } from "./kit/tooltip/use-active-markers";
export { ProfitLossLegend } from "./profit-loss-legend";
export type { ProfitLossLegendProps, ProfitLossSegment } from "./profit-loss-legend";
export { ProfitLossLegendHoverProvider, useProfitLossLegendHover } from "./kit/legend/legend";

// Selection and brush
export type { ChartSelection } from "./kit/types";
export { ChartBrush, BrushLayout as ChartBrushLayout } from "./kit/brush";
export type {
  ChartBrushLayoutProps,
  ChartBrushLayoutState,
  ChartBrushPatternPreset,
  ChartBrushProps,
  ChartBrushSelection,
  ChartBrushSelectionPattern,
  ChartBrushTrackOverlayStyle,
} from "./kit/brush";
export { ChartBrushSelectionOverlay, ChartBrushTrackOverlay } from "./kit/brush";
export type { ChartBrushSelectionOverlayProps, ChartBrushTrackOverlayProps } from "./kit/brush";

// ---------------------------------------------------------------------------
// Polar and other chart families
// ---------------------------------------------------------------------------

// Pie
export { PieChart, DEFAULT_HOVER_OFFSET } from "./pie-chart";
export { PieSlice, defaultPieColors, usePieStable, PieProvider, usePie, usePieHover } from "./pie/model";
export type { PieChartProps, PieSliceHoverEffect } from "./pie-chart";
export type { PieSliceProps, PieData, PieArcData, PieContextValue } from "./pie/model";
export { PieCenter, PieCenterShell } from "./pie/center";
export type { PieCenterProps, PieCenterShellProps } from "./pie/center";
// Ring
export { RingChart, Ring } from "./ring-chart";
export { defaultRingColors, useRingStable, useRing, useRingHover, RingProvider } from "./ring/model";
export type { RingChartProps, RingProps, RingData, RingLineCap, RingContextValue } from "./ring-chart";
export { RingCenter } from "./ring/center";
export type { RingCenterProps } from "./ring/center";
// Radar
export { RadarChart, RadarGrid, RadarAxis, RadarLabels, RadarArea, DEFAULT_RADAR_COLORS as defaultRadarColors } from "./radar-chart";
export type { RadarChartProps, RadarGridProps, RadarAxisProps, RadarLabelsProps, RadarAreaProps, RadarData, RadarMetric } from "./radar-chart";
export { RadarProvider, radarCssVars, useRadar, useRadarHover, useRadarStable } from "./radar/context";
export type { RadarContextValue } from "./radar/context";
// Gauge
export { Gauge } from "./gauge";
export type { GaugeProps, GaugeOrientation, GaugeLabelAlign, GaugeLabelPlacement } from "./gauge";
// Funnel
export { FunnelChart } from "./funnel-chart";
export type { FunnelChartProps, FunnelStage, FunnelGradientStop } from "./funnel-chart";
// Heatmap
export { HeatmapChart, HeatmapChartLoading, HeatmapCells, HeatmapXAxis, HeatmapYAxis, HeatmapTooltip, HeatmapLegend, HeatmapSeparator, HeatmapInteractionProvider, HeatmapInteractionBoundary, useHeatmap, HEATMAP_LEGEND_LEVELS, HEATMAP_DEFAULT_LEVEL_COLORS, HEATMAP_DEFAULT_LEVEL_STYLES, HEATMAP_DAY_LABELS } from "./heatmap-chart";
export type { HeatmapChartProps, HeatmapChartLoadingProps, HeatmapCellsProps, HeatmapXAxisProps, HeatmapYAxisProps, HeatmapTooltipProps, HeatmapLegendProps, HeatmapLegendVariant, HeatmapSeparatorProps, HeatmapContextValue, HeatmapLayout, HeatmapBin, HeatmapColumn, HeatmapWeekStartDay, HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter, HeatmapLevelColors, HeatmapLevelStyle, HeatmapLevelStyles, HeatmapLevelFillMode } from "./heatmap-chart";
export { HEATMAP_MONTHS_ONE_YEAR, HEATMAP_MONTHS_SIX, HEATMAP_WEEKS_ONE_YEAR, getHeatmapCalendarRangeStart, getHeatmapWeekCount, getHeatmapWeekStartAlignedToRange, getHeatmapWeekStartSunday, getHeatmapYearStartMonth, resolveHeatmapWeekRange } from "./heatmap/calendar";
export { filterHeatmapColumns, getHeatmapColumnMonthAnchor, getHeatmapTimeExtent, inferHeatmapCalendarRangeStart } from "./heatmap/columns";
export { formatHeatmapYAxisLabel, getHeatmapDayLabels, shouldShowHeatmapYAxisTick } from "./heatmap/day-labels";
export { formatHeatmapContributionLabel, formatHeatmapTooltipDate, formatHeatmapTooltipWeekday } from "./heatmap/format";
export { buildHeatmapRowOpacity } from "./heatmap/hover-style";
export { buildHeatmapLegendGradient } from "./heatmap/legend-gradient";
export { getHeatmapSeparatorColumnIndices } from "./heatmap/separators";
export type { HeatmapWeekRange } from "./heatmap/calendar";
export { buildHeatmapColorScale, buildHeatmapColorScaleFromStyles, buildHeatmapFillScale, defaultHeatmapColorScale, defaultHeatmapFillScale, heatmapLevelPatternId, isHeatmapLevelPattern, levelStylesFromColors, resolveHeatmapLevelStyles } from "./heatmap/colors";
export { HeatmapProvider } from "./heatmap/context";
export { heatmapCssVars, levelColorsFromStyles } from "./heatmap/css-vars";
// Sunburst
export { SunburstChart, SunburstSegment, SunburstCenter, SunburstLabels, SunburstHint, SunburstBreadcrumb } from "./sunburst-chart";
export type { SunburstChartProps, SunburstSegmentProps, SunburstCenterProps, SunburstLabelsProps, SunburstHintContext, SunburstHintProps, SunburstBreadcrumbItem, SunburstBreadcrumbProps, SunburstEnterTransition } from "./sunburst-chart";
export { sumValues, buildArcs, ringOptions, clockwiseFraction, defaultSunburstGrowPadding, useSunburstBreadcrumbItems } from "./sunburst-chart";
export type { SunburstNode, ArcDatum, Focus } from "./sunburst-chart";
export { sunburstCssVars, defaultSunburstColors, opacityForRelativeDepth } from "./sunburst-chart";
export { useSunburstHover, useSunburstStable } from "./sunburst-chart";
export { geometryFor, lerpGeometry, transitionGeometry, arcPath, centroidAngle, geomCentroidAngle, geomCentroidRadius, localProgress, buildSunburstEnterTiming, buildRevealSchedule, segmentRevealFromRingSweep, buildRevealDelays } from "./helpers";
export type { ArcGeometry, SunburstEnterTiming, SunburstRevealSchedule, SunburstSegmentEnterDelays } from "./helpers";
// Sankey
export { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "./sankey-chart";
export type { SankeyChartProps, SankeyData, SankeyLabelOrientation, SankeyLinkProps, SankeyNodeProps, SankeyTooltipProps } from "./sankey-chart";
export { SankeyProvider, useSankey } from "./sankey/context";
export type { SankeyContextValue, SankeyTooltipData } from "./sankey/context";
export type { SankeyLinkDatum, SankeyNodeDatum } from "./sankey/types";
// Choropleth
export { ChoroplethChart, ChoroplethFeatureComponent, ChoroplethTooltip, ChoroplethGraticule, useChoroplethZoom, useChoropleth, ChoroplethProvider } from "./choropleth-chart";
export type { ChoroplethChartProps, ChoroplethFeatureProps, ChoroplethTooltipProps, ChoroplethGraticuleProps, ChoroplethContextValue, ChoroplethFeature, ChoroplethFeatureProperties, ChoroplethTooltipData } from "./choropleth-chart";
export type { TransformMatrix } from "./choropleth/zoom";
export { choroplethCssVars, defaultChoroplethColors, pieCssVars, ringCssVars, sankeyCssVars } from "./kit/css-vars";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

// Tooltip
export type { ChartTooltipProps, IndicatorWidth } from "./kit/types";
export { DateTicker, MarkerTooltipContent, TooltipBox, TooltipContent } from "./kit/tooltip/tooltip-primitives";
export type { DateTickerProps, MarkerTooltipContentProps, MarkerTooltipItem, TooltipBoxProps, TooltipContentProps, TooltipRow } from "./kit/tooltip/tooltip-primitives";
export { TooltipDot, TooltipIndicator } from "./kit/tooltip/tooltip-carriers";
export type { TooltipDotProps, TooltipIndicatorProps } from "./kit/tooltip/tooltip-carriers";
// Legend
export { ChartLegend } from "./kit/legend/chart-legend";
export type { ChartLegendProps, LegendItem } from "./kit/legend/chart-legend";
export { ChartLegendHoverProvider, useChartLegendHover } from "./kit/legend/legend";
export {
  Legend,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  LegendProgress,
  LegendValue,
  legendCssVars,
  useLegend,
  useLegendItem,
} from "./kit/legend/legend-compose";
export type {
  LegendContextValue,
  LegendItemContextValue,
  LegendItemData,
  LegendItemProps,
  LegendLabelProps,
  LegendMarkerProps,
  LegendProgressProps,
  LegendProps,
  LegendValueProps,
} from "./kit/legend/legend-compose";
// Fills: gradients and patterns
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
} from "./kit/gradients";
export type { GradientStop, LinearGradientProps, RadialGradientProps } from "./kit/gradients";
export { CirclesImpl as PatternCircles } from "./kit/pattern/pattern-circles";
export { PatternHexagons } from "./kit/pattern/pattern-public-hexagons";
export { PatternLines } from "./kit/pattern/pattern-lines-view";
export { WavesImpl as PatternWaves } from "./kit/pattern/pattern-waves";
export { isCirclePattern, isCirclesPattern, patternPresetTileSize, PATTERN_PRESET_IDS } from "./kit/pattern/pattern-preset-helpers";
export { renderPatternPreset } from "./kit/pattern/pattern-preset-render";
export type { PatternPresetId, PatternPresetOptions } from "./kit/pattern/pattern-preset-helpers";
// Centre statistic
export {
  ChartStatFlow,
  chartCenterContainerClassName,
  chartCenterLabelClassName,
  chartCenterValueClassName,
  defaultChartStatFlowFormat,
} from "./chart-stat-flow";
export type { ChartStatFlowFormat, ChartStatFlowProps } from "./chart-stat-flow";
// Loading and entrance
export { LineLoadingSweep, BarLoadingSkeleton } from "./loading-sweep";
export type { LineLoadingSweepProps, BarLoadingSkeletonProps } from "./loading-sweep";
export { LineLoadingPulseStroke } from "./line-loading-pulse";
export type { LineLoadingPulseStrokeProps, LineLoadingPulseMode } from "./line-loading-pulse";
export { ChartLoadingLabel } from "./chart-loading-label";
export type { ChartLoadingLabelProps } from "./chart-loading-label";
export { ChartRevealClip } from "./chart-reveal-clip";
export type { ChartRevealClipProps } from "./chart-reveal-clip";
export { generateChartSkeletonData } from "./generate-chart-skeleton-data";
export type { GenerateChartSkeletonDataOptions } from "./generate-chart-skeleton-data";
// Configuration and lifecycle
export {
  ChartConfigProvider,
  DEFAULT_CHART_CONFIG,
  StaticChartPreviewProvider,
  useChartConfig,
  useStaticChartPreview,
} from "./kit/cartesian/chart-config";
export type { ChartConfigProviderProps, ChartConfigValue } from "./kit/cartesian/chart-config";
export type { SpringConfig } from "./kit/types";
export {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
  DEFAULT_CHART_ENTER_TRANSITION,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  Y_AXIS_DEFAULT_TICK_COUNT,
  Y_AXIS_MAX_TICK_COUNT,
  Y_AXIS_MIN_TICK_COUNT,
  isChartInteractionPhase,
  resolveRestingChartPhase,
  resolveYAxisTickCount,
} from "./kit/motion/phase";
export type { ChartPhase, ChartStatus, LoadingStyle, YAxisOrientation } from "./kit/motion/phase";

// ---------------------------------------------------------------------------
// Hooks and context
// ---------------------------------------------------------------------------

export {
  ChartProvider,
  chartCssVars,
  defaultScatterColors,
  useChart,
  useChartHover,
  useChartStable,
  useYScale,
} from "./kit/cartesian/chart-context";
export type {
  ChartContextValue,
  ChartHoverContextValue,
  ChartStableContextValue,
  LineConfig,
  Margin,
  TooltipData,
} from "./kit/cartesian/chart-context";

// ---------------------------------------------------------------------------
// Utilities (scales, projections, bklit-ui helper functions)
// ---------------------------------------------------------------------------

export {
  CHART_SCALE_VARS,
  chartScaleCssVars,
} from "./kit/css-vars";
export type { ChartScaleVars } from "./kit/css-vars";
export {
  computeYDomainsByAxis,
  getPrimaryYScale,
  isLoadingChromePhase,
  isYDomainTweenPhase,
  mergeYDomainRecords,
  niceYDomain,
  shouldTweenYDomain,
} from "./kit/cartesian/y-domain-utils";
export type { YDomain } from "./kit/cartesian/y-domain-utils";
export { DEFAULT_Y_AXIS_ID } from "./kit/cartesian/series";
export { buildProjectionPath, computeProjectionAnchorTangentSlope, buildHorizontalTangentBezierPath, projectionValueExtents, projectionDateExtents } from "./kit/projection-utils";
export type { ProjectionMode, ProjectionAutoMethod, ProjectionCurveKind, ProjectionPathDensity, BuildProjectionPathOptions } from "./kit/projection-utils";
export {
  PROFIT_LOSS_LEGEND_ITEMS,
  PROFIT_LOSS_NEGATIVE_COLOR,
  PROFIT_LOSS_POSITIVE_COLOR,
  PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK,
  profitLossColor,
  resolveProfitLossTooltipLabel,
} from "./profit-loss-legend";
export {
  DEFAULT_CHART_LIFECYCLE,
  computeReferenceAreaRect,
  getSeriesMarkerVisualExtent,
  indicatorFadeGradientStops,
  mergeProjectionXDomainMax,
  mergeProjectionYDomain,
  resolveLineLoadingPulseMode,
  resolveTooltipBoxMotion,
  resolveVerticalFadeSides,
  splitProfitLossSegments,
} from "./helpers";
export type { ComputeReferenceAreaRectOptions, IndicatorFadeGradientStop, VerticalFadeSides } from "./helpers";
export { getSkeletonHeights } from "./kit/loading/sweep-mask";
