export { LineChart, type LineChartProps } from "./line-chart";
export { AreaChart, type AreaChartProps } from "./area-chart";
export { ScatterChart, type ScatterChartProps } from "./scatter-chart";
export { BarChart, type BarChartProps } from "./bar-chart";
export {
  CandlestickChart,
  type CandlestickChartProps,
  type CandlestickEnterTransition,
} from "./candlestick-chart";
export { ComposedChart, type ComposedChartProps } from "./composed-chart";
export {
  LiveLineChart,
  type LiveLineChartProps,
  type LiveLinePoint,
} from "./live-line-chart";
export {
  SankeyChart,
  type SankeyChartProps,
  type SankeyData,
  type SankeyNodeDatum,
  type SankeyLinkDatum,
  type Margin,
  type SankeyLabelOrientation,
  SankeyLink,
  type SankeyLinkProps,
  SankeyNode,
  type SankeyNodeProps,
  SankeyTooltip,
  type SankeyTooltipProps,
} from "./sankey-chart";
export {
  RadarChart,
  type RadarChartProps,
  RadarGrid,
  type RadarGridProps,
  RadarAxis,
  type RadarAxisProps,
  RadarLabels,
  type RadarLabelsProps,
  RadarArea,
  type RadarAreaProps,
  type RadarData,
  type RadarMetric,
  type RadarEnterTransition,
} from "./radar-chart";
export {
  PieChart,
  type PieChartProps,
  PieSlice,
  type PieSliceProps,
  type PieData,
  type PieArcData,
  type PieEnterTransition,
  type PieSliceHoverEffect,
} from "./pie-chart";
export {
  PieCenter,
  type PieCenterProps,
  type PieCenterRenderProps,
  type PieCenterFormat,
} from "./internal/pie-center";
export {
  RingChart,
  type RingChartProps,
  Ring,
  type RingProps,
  type RingData,
  type RingLineCap,
  type RingEnterTransition,
} from "./ring-chart";
export {
  RingCenter,
  type RingCenterProps,
  type RingCenterRenderProps,
} from "./internal/ring-center";
export {
  Gauge,
  type GaugeProps,
  type GaugeOrientation,
  type GaugeEnterTransition,
  type GaugeLabelAlign,
  type GaugeLabelPlacement,
} from "./gauge";
export {
  FunnelChart,
  type FunnelChartProps,
  type FunnelStage,
  type FunnelGradientStop,
  type FunnelEnterTransition,
} from "./funnel-chart";
export {
  HeatmapChart,
  type HeatmapChartProps,
  HeatmapChartLoading,
  type HeatmapChartLoadingProps,
  generateHeatmapSkeletonFromTarget,
  HeatmapCells,
  type HeatmapCellsProps,
  HeatmapXAxis,
  type HeatmapXAxisProps,
  HeatmapYAxis,
  type HeatmapYAxisProps,
  HeatmapTooltip,
  type HeatmapTooltipProps,
  HeatmapLegend,
  type HeatmapLegendProps,
  type HeatmapLegendVariant,
  HeatmapLegendSwatch,
  type HeatmapLegendSwatchProps,
  HeatmapLegendGradient,
  type HeatmapLegendGradientProps,
  HeatmapSeparator,
  type HeatmapSeparatorProps,
  HeatmapInteractionProvider,
  type HeatmapInteractionProviderProps,
  HeatmapInteractionBoundary,
  type HeatmapInteractionBoundaryProps,
  HeatmapInteractionRoot,
  type HeatmapInteractionRootProps,
  useHeatmap,
  useHeatmapInteraction,
  useHeatmapInteractionOptional,
  type HeatmapContextValue,
  type HeatmapInteractionContextValue,
  HEATMAP_LEGEND_LEVELS,
  HEATMAP_DEFAULT_LEVEL_COLORS,
  HEATMAP_DEFAULT_LEVEL_STYLES,
  HEATMAP_DAY_LABELS,
  HEATMAP_INACTIVE_OPACITY,
  computeHeatmapLevelRange,
  type HeatmapLayout,
  type HeatmapMargin,
  type HeatmapChartPhase,
  type HeatmapRevealMode,
  type HeatmapBin,
  type HeatmapColumn,
  type HeatmapColumnSeparatorsConfig,
  type HeatmapSeparatorGroupBy,
  type HeatmapSeparatorStrokeStyle,
  type HeatmapSeparatorGradient,
  type HeatmapWeekStartDay,
  type HeatmapYAxisLabelFormat,
  type HeatmapYAxisTickFilter,
  type HeatmapEnterTransition,
  type HeatmapLevelColors,
  type HeatmapLevelStyle,
  type HeatmapLevelStyles,
  type HeatmapLevelFillMode,
  type HeatmapTooltipData,
  type HeatmapHoveredCell,
  type HeatmapLevelRange,
} from "./heatmap-chart";
export {
  SunburstChart,
  type SunburstChartProps,
  SunburstSegment,
  type SunburstSegmentProps,
  SunburstCenter,
  SunburstLabels,
  type SunburstLabelsProps,
  SunburstHint,
} from "./sunburst-chart";
export type {
  ArcDatum as SunburstArcDatum,
  Focus as SunburstFocus,
} from "./internal/sunburst-geometry";
export type { SunburstNode } from "./internal/sunburst-types";
export {
  ChoroplethChart,
  type ChoroplethChartProps,
} from "./choropleth-chart";
export {
  ChoroplethFeatureComponent,
  type ChoroplethFeatureProps,
} from "./choropleth-chart";
export {
  ChoroplethTooltip,
  type ChoroplethTooltipProps,
} from "./choropleth-chart";
export {
  ChoroplethGraticule,
  type ChoroplethGraticuleProps,
} from "./choropleth-chart";
export {
  ChoroplethZoomContext,
  useChoroplethZoom,
  useChoropleth,
  type ChoroplethContextValue,
  type ChoroplethFeature,
  type ChoroplethFeatureProperties,
} from "./choropleth-chart";
export type { TransformMatrix } from "@visx/zoom";
export {
  ChartConfigProvider,
  useChartConfig,
  type ChartConfigProviderProps,
  type ChartConfigValue,
  type SpringConfig,
} from "./internal/chart-config-context";
export {
  Line,
  Area,
  PatternArea,
  Scatter,
  Bar,
  BarSquares,
  BarColumnTrack,
  BarDepthProvider,
  BarDepthBack,
  BarDepthFront,
  BarPulse,
  SeriesBar,
  BarXAxis,
  Grid,
  XAxis,
  ChartTooltip,
  Candlestick,
  YAxis,
  LiveLine,
  LiveXAxis,
  LiveYAxis,
  ProjectionLine,
  ProjectionLineEndMarker,
  LineSeriesTerminalMarker,
  ChartMarkers,
  type ProjectionLineProps,
  type ProjectionLineEndMarkerProps,
  type LineSeriesTerminalMarkerProps,
  type ChartMarkersChildProps,
} from "./children";
export type { ChartMarker, ChartMarkersConfig } from "./internal/types";
export { ChartMarkersOverlay } from "./internal/chart-markers";
export {
  buildProjectionPath,
  computeProjectionAnchorTangentSlope,
  buildHorizontalTangentBezierPath,
  projectionValueExtents,
  projectionDateExtents,
  type ProjectionMode,
  type ProjectionAutoMethod,
  type ProjectionCurveKind,
  type ProjectionPathDensity,
  type ProjectionPoint,
  type BuildProjectionPathOptions,
} from "./internal/projection-utils";
export type { ProjectionLineConfig } from "./internal/projection-config";
export {
  legendCssVars,
  type LegendItemData,
  type LegendContextValue,
  type LegendItemContextValue,
  LegendProvider,
  LegendItemProvider,
  useLegend,
  useLegendItem,
} from "./internal/legend-context";
export {
  Legend,
  LegendItem as LegendItemComponent,
  LegendMarker,
  LegendLabel,
  LegendValue,
  LegendProgress,
  type LegendProps,
  type LegendItemProps,
  type LegendMarkerProps,
  type LegendLabelProps,
  type LegendValueProps,
  type LegendProgressProps,
} from "./internal/legend";
export { LegendItem } from "./internal/legend";
export {
  ChartLegend,
  type ChartLegendProps,
  type LegendItem as ChartLegendLegendItem,
} from "./internal/chart-legend";
export {
  ChartLegendHoverProvider,
  useChartLegendHover,
} from "./internal/chart-legend-hover";
export {
  splitProfitLossSegments,
  type ProfitLossSegment,
} from "./internal/profit-loss-segments";
export {
  PROFIT_LOSS_POSITIVE_COLOR,
  PROFIT_LOSS_NEGATIVE_COLOR,
  profitLossColor,
  PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK,
  resolveProfitLossTooltipLabel,
  type ProfitLossLineConfig,
} from "./internal/profit-loss-config";
export {
  ProfitLossLegend,
  PROFIT_LOSS_LEGEND_ITEMS,
  type ProfitLossLegendProps,
} from "./internal/profit-loss-legend";
export {
  ProfitLossLegendHoverProvider,
  useProfitLossLegendHover,
} from "./internal/profit-loss-legend-hover";
export { CHART_CHILD_PASSTHROUGH } from "./children";
export {
  ProfitLossLine,
  type ProfitLossLineProps,
} from "./children";
export { extractProjectionLineConfigs, mergeProjectionYDomain, mergeProjectionXDomainMax, resolveVisibleEndX } from "./internal/projection-config";
export { ReferenceArea, type ReferenceAreaProps, type ReferenceAreaStrokeStyle, type ReferenceAreaIfOverflow } from "./reference-area";
export { SegmentBackground, SegmentLineFrom, SegmentLineTo, type SegmentBackgroundProps, type SegmentLineProps, type SegmentLineVariant } from "./segment";
export { ChartSelectionContext, type ChartSelection } from "./internal/chart-selection";
export type {
  ChartPhase,
  ChartStatus,
  LineConfig,
  AreaConfig,
  PatternAreaConfig,
  ScatterConfig,
  BarConfig,
  SeriesBarConfig,
  BarXAxisConfig,
  GridConfig,
  XAxisConfig,
  CandlestickConfig,
  YAxisConfig,
  LiveLineConfig,
  LiveXAxisConfig,
  LiveYAxisConfig,
  MomentumColors,
} from "./internal/types";

// Initiative 9 (D227): chart brush — layout/state owner + strip brush child.
export {
  BrushLayout,
  type BrushLayoutProps,
  type BrushLayoutState,
} from "./internal/brush-layout";
export {
  ChartBrush,
  type ChartBrushProps,
  type BrushSelectionPattern,
  type ChartBrushSelectedBoxStyle,
  type BrushHost,
} from "./internal/chart-brush";
export {
  useBrushSelection,
  filterDataByXDomain,
  resolveBrushTrackXExtent,
  type BrushSelection,
} from "./internal/brush-selection";
