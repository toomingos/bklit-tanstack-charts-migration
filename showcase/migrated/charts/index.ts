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
export { detectMomentum } from "./live-line/momentum";
export type { LiveLineChartProps, LiveLinePoint } from "./live-line-chart";
export type { Momentum } from "./live-line/momentum";
export { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "./sankey-chart";
export type { SankeyChartProps, SankeyData, SankeyLabelOrientation, SankeyLinkProps, SankeyNodeProps, SankeyTooltipProps } from "./sankey-chart";
export { RadarChart, RadarGrid, RadarAxis, RadarLabels, RadarArea, DEFAULT_RADAR_COLORS as defaultRadarColors } from "./radar-chart";
export type { RadarChartProps, RadarGridProps, RadarAxisProps, RadarLabelsProps, RadarAreaProps, RadarData, RadarMetric } from "./radar-chart";
export { PieChart, DEFAULT_HOVER_OFFSET } from "./pie-chart";
export { PieSlice, defaultPieColors, usePieStable, PieProvider, usePie, usePieHover } from "./pie/model";
export type { PieChartProps, PieSliceHoverEffect } from "./pie-chart";
export type { PieSliceProps, PieData, PieArcData, PieContextValue } from "./pie/model";
export { PieCenter, PieCenterShell } from "./pie/center";
export type { PieCenterProps, PieCenterShellProps } from "./pie/center";
export { RingChart, Ring } from "./ring-chart";
export { defaultRingColors, useRingStable, useRing, useRingHover, RingProvider } from "./ring/model";
export type { RingChartProps, RingProps, RingData, RingLineCap, RingContextValue } from "./ring-chart";
export { RingCenter } from "./ring/center";
export type { RingCenterProps } from "./ring/center";
export { Gauge } from "./gauge";
export type { GaugeProps, GaugeOrientation, GaugeLabelAlign, GaugeLabelPlacement } from "./gauge";
export { FunnelChart } from "./funnel-chart";
export type { FunnelChartProps, FunnelStage, FunnelGradientStop } from "./funnel-chart";
export { AreaChartLoading } from "./area-chart-loading";
export type { AreaChartLoadingProps } from "./area-chart-loading";
export { BarChartLoading } from "./bar-chart-loading";
export type { BarChartLoadingProps } from "./bar-chart-loading";
export { HeatmapChart, HeatmapChartLoading, HeatmapCells, HeatmapXAxis, HeatmapYAxis, HeatmapTooltip, HeatmapLegend, HeatmapSeparator, HeatmapInteractionProvider, HeatmapInteractionBoundary, useHeatmap, HEATMAP_LEGEND_LEVELS, HEATMAP_DEFAULT_LEVEL_COLORS, HEATMAP_DEFAULT_LEVEL_STYLES, HEATMAP_DAY_LABELS } from "./heatmap-chart";
export type { HeatmapChartProps, HeatmapChartLoadingProps, HeatmapCellsProps, HeatmapXAxisProps, HeatmapYAxisProps, HeatmapTooltipProps, HeatmapLegendProps, HeatmapLegendVariant, HeatmapSeparatorProps, HeatmapContextValue, HeatmapLayout, HeatmapBin, HeatmapColumn, HeatmapWeekStartDay, HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter, HeatmapLevelColors, HeatmapLevelStyle, HeatmapLevelStyles, HeatmapLevelFillMode } from "./heatmap-chart";
export { SunburstChart, SunburstSegment, SunburstCenter, SunburstLabels, SunburstHint, SunburstBreadcrumb } from "./sunburst-chart";
export type { SunburstChartProps, SunburstSegmentProps, SunburstCenterProps, SunburstLabelsProps, SunburstHintContext, SunburstHintProps, SunburstBreadcrumbItem, SunburstBreadcrumbProps, SunburstEnterTransition } from "./sunburst-chart";
export { sumValues, buildArcs, ringOptions, clockwiseFraction, defaultSunburstGrowPadding, useSunburstBreadcrumbItems } from "./sunburst-chart";
export type { SunburstNode, ArcDatum, Focus } from "./sunburst-chart";
export { ChoroplethChart, ChoroplethFeatureComponent, ChoroplethTooltip, ChoroplethGraticule, useChoroplethZoom, useChoropleth, ChoroplethProvider } from "./choropleth-chart";
export type { ChoroplethChartProps, ChoroplethFeatureProps, ChoroplethTooltipProps, ChoroplethGraticuleProps, ChoroplethContextValue, ChoroplethFeature, ChoroplethFeatureProperties, ChoroplethTooltipData } from "./choropleth-chart";
export type { TransformMatrix } from "./choropleth/zoom";
export { Line, Area, PatternArea, Background, Scatter, Bar, BarSquares, BarColumnTrack, BarDepthProvider, BarDepthBack, BarDepthFront, BarPulse, SeriesBar, BarXAxis, Grid, XAxis, ChartTooltip, Candlestick, YAxis, LiveLine, LiveXAxis, LiveYAxis, ProjectionLine, ProjectionLineEndMarker, LineSeriesTerminalMarker, ChartMarkers, ProfitLossLine } from "./children";
export type { ProjectionLineProps, ProjectionLineEndMarkerProps, LineSeriesTerminalMarkerProps, ProfitLossLineProps } from "./children";
export { ChartLegendHoverProvider } from "./kit/legend/legend";
export { useChartLegendHover } from "./kit/legend/legend";
export { ReferenceArea } from "./reference-area";
export type { ReferenceAreaProps, ReferenceAreaStrokeStyle, ReferenceAreaIfOverflow, ReferenceAreaRect } from "./reference-area";
export { SegmentBackground, SegmentLineFrom, SegmentLineTo } from "./segment";
export type { SegmentBackgroundProps, SegmentLineProps, SegmentLineVariant } from "./segment";

export { HEATMAP_MONTHS_ONE_YEAR, HEATMAP_MONTHS_SIX, HEATMAP_WEEKS_ONE_YEAR, getHeatmapCalendarRangeStart, getHeatmapWeekCount, getHeatmapWeekStartAlignedToRange, getHeatmapWeekStartSunday, getHeatmapYearStartMonth, resolveHeatmapWeekRange } from "./heatmap/calendar";
export { filterHeatmapColumns, getHeatmapColumnMonthAnchor, getHeatmapTimeExtent, inferHeatmapCalendarRangeStart } from "./heatmap/columns";
export { formatHeatmapYAxisLabel, getHeatmapDayLabels, shouldShowHeatmapYAxisTick } from "./heatmap/day-labels";
export { formatHeatmapContributionLabel, formatHeatmapTooltipDate, formatHeatmapTooltipWeekday } from "./heatmap/format";
export { buildHeatmapRowOpacity } from "./heatmap/hover-style";
export { buildHeatmapLegendGradient } from "./heatmap/legend-gradient";
export { getHeatmapSeparatorColumnIndices } from "./heatmap/separators";
export type { HeatmapWeekRange } from "./heatmap/calendar";
export { sunburstCssVars, defaultSunburstColors, opacityForRelativeDepth } from "./sunburst-chart";
export { buildHeatmapColorScale, buildHeatmapColorScaleFromStyles, buildHeatmapFillScale, defaultHeatmapColorScale, defaultHeatmapFillScale, heatmapLevelPatternId, isHeatmapLevelPattern, levelStylesFromColors, resolveHeatmapLevelStyles } from "./heatmap/colors";
export { BarYAxis } from "./bar/carriers";
export { HeatmapProvider } from "./heatmap/context";
export { RadarProvider, radarCssVars, useRadar, useRadarHover, useRadarStable } from "./radar/context";
export type { RadarContextValue } from "./radar/context";
export { useSunburstHover, useSunburstStable } from "./sunburst-chart";
export { LineChartLoading } from "./line-chart-loading";
export type { LineChartLoadingProps } from "./line-chart-loading";

// Shared (kit): patterns, brush, phase, config types.
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
export { CirclesImpl as PatternCircles } from "./kit/pattern/pattern-circles";
export { PatternHexagons } from "./kit/pattern/pattern-public-hexagons";
export { PatternLines } from "./kit/pattern/pattern-lines-view";
export { WavesImpl as PatternWaves } from "./kit/pattern/pattern-waves";
export { isCirclePattern, isCirclesPattern, patternPresetTileSize, PATTERN_PRESET_IDS } from "./kit/pattern/pattern-preset-helpers";
export { renderPatternPreset } from "./kit/pattern/pattern-preset-render";
export type { PatternPresetId, PatternPresetOptions } from "./kit/pattern/pattern-preset-helpers";
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
export type {
  AreaConfig as AreaProps,
  BackgroundConfig as BackgroundProps,
  ChartMarker,
  ChartMarkersProps,
  ChartSelection,
  ChartTooltipProps,
  GridProps,
  IndicatorFadeEdges,
  IndicatorWidth,
  LineConfig as LineProps,
  PatternAreaConfig as PatternAreaProps,
  ProjectionPoint,
  ProjectionStrokeStyle,
  ScatterConfig as ScatterProps,
  SeriesPointMarkerStyle,
  SpringConfig,
  XAxisConfig as XAxisProps,
  YAxisConfig as YAxisProps,
} from "./kit/types";
export { ChartLegend } from "./kit/legend/chart-legend";
export type { ChartLegendProps, LegendItem } from "./kit/legend/chart-legend";
export { buildProjectionPath, computeProjectionAnchorTangentSlope, buildHorizontalTangentBezierPath, projectionValueExtents, projectionDateExtents } from "./kit/projection-utils";
export type { ProjectionMode, ProjectionAutoMethod, ProjectionCurveKind, ProjectionPathDensity, BuildProjectionPathOptions } from "./kit/projection-utils";
export type { LiveLineConfig as LiveLineProps, LiveXAxisConfig as LiveXAxisProps, LiveYAxisConfig as LiveYAxisProps, MomentumColors } from "./live-line/carriers";

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
export {
  PROFIT_LOSS_LEGEND_ITEMS,
  PROFIT_LOSS_NEGATIVE_COLOR,
  PROFIT_LOSS_POSITIVE_COLOR,
  PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK,
  ProfitLossLegend,
  profitLossColor,
  resolveProfitLossTooltipLabel,
} from "./profit-loss-legend";
export type { ProfitLossLegendProps, ProfitLossSegment } from "./profit-loss-legend";
export { ProfitLossLegendHoverProvider, useProfitLossLegendHover } from "./kit/legend/legend";
export {
  ChartStatFlow,
  chartCenterContainerClassName,
  chartCenterLabelClassName,
  chartCenterValueClassName,
  defaultChartStatFlowFormat,
} from "./chart-stat-flow";
export type { ChartStatFlowFormat, ChartStatFlowProps } from "./chart-stat-flow";

export { DateTicker, MarkerTooltipContent, TooltipBox, TooltipContent } from "./kit/tooltip/tooltip-primitives";
export type { DateTickerProps, MarkerTooltipContentProps, TooltipBoxProps, TooltipContentProps, TooltipRow } from "./kit/tooltip/tooltip-primitives";
export { TooltipDot, TooltipIndicator } from "./kit/tooltip/tooltip-carriers";
export type { TooltipDotProps, TooltipIndicatorProps } from "./kit/tooltip/tooltip-carriers";
export { useActiveMarkers } from "./kit/tooltip/use-active-markers";
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
export {
  ChartProvider,
  chartCssVars,
  defaultScatterColors,
  useChart,
  useChartHover,
  useChartStable,
  useYScale,
} from "./kit/cartesian/chart-context";
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
export type {
  ChartContextValue,
  ChartHoverContextValue,
  ChartStableContextValue,
  LineConfig,
  Margin,
  TooltipData,
} from "./kit/cartesian/chart-context";
export {
  ChartConfigProvider,
  DEFAULT_CHART_CONFIG,
  StaticChartPreviewProvider,
  useChartConfig,
  useStaticChartPreview,
} from "./kit/cartesian/chart-config";
export type { ChartConfigProviderProps, ChartConfigValue } from "./kit/cartesian/chart-config";
export type { OHLCDataPoint } from "./candlestick-chart";
export {
  CHART_SCALE_VARS,
  chartScaleCssVars,
  choroplethCssVars,
  defaultChoroplethColors,
  pieCssVars,
  ringCssVars,
  sankeyCssVars,
} from "./kit/css-vars";
export type { ChartScaleVars } from "./kit/css-vars";
export { heatmapCssVars, levelColorsFromStyles } from "./heatmap/css-vars";
export type { BarProps, BarAnimationType, BarLineCap, BarDepthBackProps, BarDepthFrontProps, BarDepthProviderProps, BarDepthSegment, BarPulseProps, BarColumnTrackProps, BarSquaresProps, BarXAxisProps, BarYAxisProps } from "./bar/carriers";
export { useBarDepthEntries } from "./bar/depth-entries";
export type { BarDepthEntry } from "./bar/depth-entries";
export type { SquareColumnLayout } from "./bar/geometry";
export type { CandlestickProps } from "./candlestick/carrier";
export type { SeriesBarProps } from "./composed/series-bar";
export type { ProjectionLineConfig } from "./kit/types";
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
export { SeriesMarkers, MarkerGroup } from "./children";
export type { SeriesMarkersProps, MarkerGroupProps } from "./children";
export { SeriesPointMarker } from "./series-point-marker";
export type { SeriesPointMarkerProps } from "./series-point-marker";
export { ChartBrushSelectionOverlay, ChartBrushTrackOverlay } from "./kit/brush";
export type { ChartBrushSelectionOverlayProps, ChartBrushTrackOverlayProps } from "./kit/brush";
export { SankeyProvider, useSankey } from "./sankey/context";
export type { SankeyContextValue, SankeyTooltipData } from "./sankey/context";
export type { SankeyLinkDatum, SankeyNodeDatum } from "./sankey/types";
export type { ReferenceAreaConfig } from "./kit/cartesian/chart-context";
