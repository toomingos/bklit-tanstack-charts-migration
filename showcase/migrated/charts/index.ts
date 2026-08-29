export { LineChart, type LineChartProps } from "./line-chart";
export { AreaChart, type AreaChartProps } from "./area-chart";
export { ScatterChart, type ScatterChartProps } from "./scatter-chart";
export { BarChart, type BarChartProps, type BarOrientation } from "./bar-chart";
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
// P5.6 Strand 4 — bklit ships `PieCenterShell` as public surface
// (`packages/ui/src/charts/pie-center-shell.tsx`); migrated had no equivalent.
export {
  PieCenterShell,
  type PieCenterShellProps,
} from "./internal/pie-center-shell";
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
// P5.7 Strand 1 (A10/B14) — bklit ships these as public loading presets
// (`area-chart-loading.tsx`, `bar-chart-loading.tsx`); both were absent from
// migrated entirely. Composed from existing parts, per `HeatmapChartLoading`.
export { AreaChartLoading, type AreaChartLoadingProps } from "./area-chart-loading";
export { BarChartLoading, type BarChartLoadingProps } from "./bar-chart-loading";

// P5.7 Strand 4 (FD6) — bklit `index.ts:319,322`. Absent from migrated, and a
// real implementation gap rather than a barrel-wiring one: the pulse's mode
// union was inlined on the component and the phase->mode resolver did not exist.
export {
  resolveLineLoadingPulseMode,
  type LineLoadingPulseMode,
} from "./internal/loading-chrome";

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
  type SunburstHintContext,
  type SunburstHintProps,
  // P5.5 SB8 — bklit's `sunburst-breadcrumb.tsx` surface, minus its context.
  buildSunburstBreadcrumbItems,
  SunburstBreadcrumb,
  type SunburstBreadcrumbItem,
  type SunburstBreadcrumbProps,
  useSunburstBreadcrumbItems,
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
  // P5.6 CP10 — legacy's `ZoomInstance` (`choropleth-context.tsx:24`).
  type ChoroplethZoomInstance,
  type ChoroplethZoomContextValue,
  type ChoroplethFeature,
  type ChoroplethFeatureProperties,
} from "./choropleth-chart";
export type { TransformMatrix } from "./internal/zoom-engine";
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
  Background,
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
// Restored by lead (D296). P4.4 ruled this module DEAD from a grep scoped to
// showcase/ alone, but `bench/app/src/scenarios/migrated-profitloss.tsx:14`
// consumes both names through this barrel, and its bklit counterpart imports
// the identical names from legacy — so this is public API-parity surface
// (MAIN GOAL (c)), not dead code. Do not un-wire without checking consumers
// outside showcase/.
export {
  ProfitLossLegendHoverProvider,
  useProfitLossLegendHover,
} from "./internal/profit-loss-legend-hover";
// P5.6 CH2 — `CHART_CLIP_PASSTHROUGH` is bklit's name AND bklit's value for
// the same marker (a string key, not migrated's Symbol); `isChartClipPassthrough`
// is bklit's own predicate, which now accepts either key. See `children.tsx`.
export {
  CHART_CHILD_PASSTHROUGH,
  CHART_CLIP_PASSTHROUGH,
  isChartClipPassthrough,
} from "./children";
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
  BackgroundConfig,
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

// ---------------------------------------------------------------------------
// P5.1 T-E1a — mechanical barrel restore (TYPE tier). Pure re-exports of
// already-implemented symbols; pixel-inert. See research/phase-4/wave-tasks/P5-01.md.
// ---------------------------------------------------------------------------

// bklit prop-type survivors with same-name backings.
export type { BackgroundProps } from "./internal/background";
export { ChartBackground } from "./internal/background";
export type {
  SeriesPointMarkerStyle,
  GradientStop,
} from "./internal/types";
export type { SquareColumnLayout } from "./internal/bar-squares-layout";
export type { HeatmapWeekRange } from "./internal/heatmap-utils";
export type { IndicatorFadeEdges } from "./internal/fade-mask";
export type { ChartMarkersProps } from "./internal/chart-markers";
// P5.6 Strand 5 (LM7) — the TYPE was already exported here; the COMPONENT it
// types was not, so the public surface named a props type for a component
// callers could not reach. `useActiveMarkers` stays P5.2's to export.
export {
  MarkerTooltipContent,
  type MarkerTooltipContentProps,
} from "./internal/marker-tooltip";
export type {
  PatternPresetId,
  PatternPresetOptions,
} from "./internal/pattern-preset";
export type { ReferenceAreaRect } from "./internal/reference-area-geometry";

// `internal/types.ts` owns both. P5-01 found byte-identical copies in
// tooltip-chrome.ts; P4 also found a THIRD `TooltipRow` in tooltip-components.tsx.
// All collapsed toward types.ts — it is the lower-level module (tooltip-chrome
// already imports ChartTooltipPoint from it, so the reverse would be a cycle).
export type { IndicatorWidth, TooltipRow } from "./internal/types";

// Sunburst geometry types (already re-exported through internal/sunburst-geometry).
export type { ArcDatum, ArcGeometry, Focus } from "./internal/sunburst-types";

// Live-line momentum contract (export keyword added at definition this pass).
export type { Momentum } from "./live-line-chart";

// P5.1 T-E1a — CONST tier. Runtime values, same pixel-inert re-export rules.
export {
  DEFAULT_CHART_CONFIG,
} from "./internal/chart-config-context";
export {
  DEFAULT_CHART_LIFECYCLE,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
} from "./internal/chart-phase";
export {
  HEATMAP_MONTHS_ONE_YEAR,
  HEATMAP_MONTHS_SIX,
  HEATMAP_WEEKS_ONE_YEAR,
} from "./internal/heatmap-utils";
export { PATTERN_PRESET_IDS } from "./internal/pattern-preset";
export { DEFAULT_HOVER_OFFSET } from "./pie-chart";
export {
  Y_AXIS_DEFAULT_TICK_COUNT,
  Y_AXIS_MAX_TICK_COUNT,
  Y_AXIS_MIN_TICK_COUNT,
} from "./internal/y-axis-ticks";

// P5.1 T-E1a — HELPER-FN tier. Sunburst block released post-P3.6 (D276 split
// outcome); lerpGeometry + detectMomentum got definition-site export keywords.
// Sunburst geometry helpers (verbatim bklit math, survived the P3.6 swap).
export {
  sumValues,
  buildArcs,
  ringOptions,
  geometryFor,
  geomCentroidAngle,
  geomCentroidRadius,
  clockwiseFraction,
  arcPath,
  transitionGeometry,
  defaultSunburstGrowPadding,
  lerpGeometry,
} from "./internal/sunburst-geometry";
export {
  sunburstCssVars,
  defaultSunburstColors,
  opacityForRelativeDepth,
} from "./internal/sunburst-colors";
export { detectMomentum } from "./live-line-chart";
export { defaultPieColors } from "./pie-chart";
export { defaultRingColors } from "./ring-chart";
export { DEFAULT_RADAR_COLORS as defaultRadarColors } from "./radar-chart";
export { DEFAULT_SCATTER_COLORS as defaultScatterColors } from "./scatter-chart";
// P6.3 / CH17 Bucket 2 (D355) — the `*CssVars` maps. The ledger flagged these
// as "ACCEPTED under a doctrine not yet written down"; the lead ruling is
// RESTORE, because the premise ("legacy generated CSS custom properties,
// migrated declares them in styles.css") is wrong on both halves. See the
// module header for the evidence. Pure data, zero behaviour, no rewiring.
export {
  CHART_SCALE_VARS,
  type ChartScaleVars,
  chartScaleCssVars,
  choroplethCssVars,
  defaultChoroplethColors,
  heatmapCssVars,
  pieCssVars,
  radarCssVars,
  ringCssVars,
  sankeyCssVars,
} from "./internal/css-var-maps";
export { computeSquareColumn, topSquareCenterY } from "./internal/bar-squares-layout";
export { computeReferenceAreaRect } from "./internal/reference-area-geometry";
export { resolveYAxisTickCount } from "./internal/y-axis-ticks";
export {
  buildHeatmapColorScale,
  buildHeatmapColorScaleFromStyles,
  buildHeatmapFillScale,
  defaultHeatmapColorScale,
  defaultHeatmapFillScale,
  heatmapLevelPatternId,
  isHeatmapLevelPattern,
  levelStylesFromColors,
  resolveHeatmapLevelStyles,
} from "./internal/heatmap-colors";
export {
  buildHeatmapLegendGradient,
  buildHeatmapRowOpacity,
  filterHeatmapColumns,
  formatHeatmapContributionLabel,
  formatHeatmapTooltipDate,
  formatHeatmapTooltipWeekday,
  formatHeatmapYAxisLabel,
  getHeatmapCalendarRangeStart,
  getHeatmapColumnMonthAnchor,
  getHeatmapDayLabels,
  getHeatmapSeparatorColumnIndices,
  getHeatmapTimeExtent,
  getHeatmapWeekCount,
  getHeatmapWeekStartAlignedToRange,
  getHeatmapWeekStartSunday,
  getHeatmapYearStartMonth,
  inferHeatmapCalendarRangeStart,
  resolveHeatmapWeekRange,
  shouldShowHeatmapYAxisTick,
} from "./internal/heatmap-utils";
export {
  indicatorFadeGradientStops,
  resolveVerticalFadeSides,
} from "./internal/fade-mask";
export {
  isCirclePattern,
  isCirclesPattern,
  patternPresetTileSize,
  renderPatternPreset,
} from "./internal/pattern-preset";
export {
  isChartInteractionPhase,
  resolveRestingChartPhase,
} from "./internal/chart-phase";
export {
  resolveTooltipBoxMotion,
} from "./internal/chart-config-context";

// P5.2 T-E1b — visx passthrough wrappers (legacy ./visx-pattern re-export tier).
export {
  PatternCircles,
  PatternHexagons,
  PatternLines,
  PatternWaves,
} from "./internal/pattern-preset";
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
} from "./internal/gradients";

// P5.2 T-E1b — hook tier (current migrated names; throw contracts preserved
// verbatim — see ring-chart.tsx:125/135 + internal/pie-center.tsx:41/47).
export { useRingStable, useRingHoverCoordinator } from "./ring-chart";
// P5.6 R3/R4 — legacy's own hook names and payload types
// (`repos/bklit-ui/.../ring-context.tsx:47,92,173,184`).
export {
  useRing,
  useRingHover,
  type RingContextValue,
  type RingHoverValue,
  type RingStableValue,
} from "./ring-chart";
export { usePieStable, usePieHoverCoordinator } from "./internal/pie-center";

// P5.2 T-E1b — Tooltip* + DateTicker public ports (thin adapters over
// internal/tooltip-chrome.ts primitives; no framer-motion).
export {
  DateTicker,
  type DateTickerProps,
  TooltipBox,
  type TooltipBoxProps,
  TooltipContent,
  // P6.3 / CH17 Bucket 3 (D355) — the ledger flagged `TooltipContentProps` as
  // "same name, different scope, exporting it as-is could be wrong", pointing
  // at the sankey-local one. That flag is stale: P5.2 already landed a
  // TooltipContentProps here that is byte-identical to bklit's
  // (`tooltip/tooltip-content.tsx:12` — `title?`, `rows: TooltipRow[]`,
  // `children?`), and the sankey-local one is already disambiguated above as
  // `SankeyTooltipContentProps`. There is no collision left to rule on; the
  // only real gap was that the barrel shipped the component and not its props
  // type, which legacy exports (`index.ts:598`).
  type TooltipContentProps,
  TooltipDot,
  type TooltipDotProps,
  TooltipIndicator,
  type TooltipIndicatorProps,
} from "./internal/tooltip-components";
// Legacy getSeriesMarkerVisualExtent (bklit barrel :526) — migrated twin is
// getMarkerVisualExtent, identical math (internal/series-marker-mark.ts:14).
export { getMarkerVisualExtent as getSeriesMarkerVisualExtent } from "./internal/series-marker-mark";

// P5.2 T-E1b Step 5b — final component tier.
// ChartRevealClip: genuine port over the shared WAAPI reveal engine
// (resolveEnterTransition/revealTiming/buildProgressKeyframes), framer-free.
export {
  ChartRevealClip,
  type ChartRevealClipProps,
  type ChartRevealClipMode,
} from "./internal/chart-reveal-clip";
// ChartStatFlow: correction-7 — bklit chart-stat-flow.tsx was already ported
// verbatim as CenterStat (internal/center-stat.tsx:161); name aliases only.
// ChartStatFlowFormat / defaultChartStatFlowFormat likewise alias
// CenterStatFormat (:73) / defaultCenterStatFormat (:89).
export { CenterStat as ChartStatFlow } from "./internal/center-stat";
export type { CenterStatProps as ChartStatFlowProps } from "./internal/center-stat";
export type { CenterStatFormat as ChartStatFlowFormat } from "./internal/center-stat";
export { defaultCenterStatFormat as defaultChartStatFlowFormat } from "./internal/center-stat";
// Brush overlays: the D228-approved runtime implements all three legacy
// overlays inside internal/brush-chrome.tsx, composed by BrushChrome (already
// consumed by ChartBrush). Legacy per-overlay public components need a
// useChartStable-style host that no longer exists → routed to P5.6 (DOC-4).
export { BrushChrome, type BrushChromePattern } from "./internal/brush-chrome";
// DOC-9 (B13): type surface now; behavior ports with bar orientation later.
export type { BarYAxisProps } from "./internal/types";
// P5.3 ledger row 16 ROUTE — renamed, not retired. Legacy's props type carries a
// REQUIRED `children`, which `BarDepthProviderConfig` does not (D326 §6).
export type { BarDepthProviderProps } from "./internal/types";

// Public animation prop defaults — parity with legacy barrel `index.ts:18-19`
// (legacy `animation.ts:4,6`). These were six byte-identical private copies
// across the chart files before P4; they are NOT `internal/design-tokens`'s
// REVEAL_* pair, which mirrors upstream TanStack instead. See
// `internal/animation-defaults.ts` for the full provenance split.
export {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";

// P6.2 / T-E1b — legacy barrel `index.ts:127` (`useYScale`, from chart-context)
// and `index.ts:605` (`useAnimatedYDomains`). Both are legacy PUBLIC API kept
// for component-API parity. `useYScale` takes the per-axis domains and inner
// height as ARGUMENTS because migrated has no `ChartProvider` to read them from
// (see internal/y-domain.ts for the full note); `useAnimatedYDomains` is a
// behaviour-for-behaviour port with motion/react swapped for a rAF loop on the
// same cubic-bezier. Neither is consumed by a migrated chart today.
export { useYScale } from "./internal/y-domain";
export {
  useAnimatedYDomains,
  type UseAnimatedYDomainsOptions,
} from "./internal/use-animated-y-domains";

// P5.3.5 / D410 — the last seven legacy PUBLIC barrel names that migrated
// implemented but never re-exported. Each was verified against its legacy
// counterpart at source before being added here; none is a new implementation.
//
//   DEFAULT_Y_AXIS_ID    legacy y-axis-scales.ts:5   — byte-identical ("left")
//   YAxisOrientation     legacy y-axis-scales.ts:7   — identical union
//   YDomain              legacy y-domain-utils.ts:6  — identical tuple
//   shouldTweenYDomain   legacy y-domain-utils.ts:19 — identical signature
//   isYDomainTweenPhase  legacy y-domain-utils.ts:46 — identical signature
//   getPrimaryYScale     legacy y-axis-scales.ts:31  — identical body; the
//     scale type is migrated's `NicedYScale` where legacy names it `YScale`,
//     which is the same rename already applied across this barrel.
//   useActiveMarkers     legacy chart-markers.tsx:192 — same public contract
//     (`ChartMarker[]` in, `ChartMarker[]` out) over a different source of
//     truth: legacy reads `useChartHover()`, migrated subscribes to
//     `MarkerActiveContext` via `useSyncExternalStore`. Deferred at `:415`
//     above as "P5.2's to export"; closed here.
//
// Re-exports only — no runtime behaviour is added, and no chart module changed.
export { DEFAULT_Y_AXIS_ID, type YAxisOrientation } from "./internal/y-axis-id";
export {
  getPrimaryYScale,
  isYDomainTweenPhase,
  shouldTweenYDomain,
  type YDomain,
} from "./internal/y-domain";
export { useActiveMarkers } from "./internal/marker-tooltip";
