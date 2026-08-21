// Shared utilities — one clean import path for all migrated charts.
// Charts can import any of these via `./internal` (barrel re-export).

export { parseAspectRatio } from "./parse-aspect-ratio";
export { bezierEasing } from "./bezier-easing";
export { bisectDateLeft, resolveNearestIndex } from "./bisect";
export { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
export { decimateTimeSeries, maxRenderPointsForWidth } from "./decimate";
export { FOCUS_DISABLED } from "./focus-disabled";

// Container measurement + margin normalization (shared lifecycle setup)
export { useChartMargin, type ChartMargin } from "./use-chart-margin";
export {
  useContainerWidth,
  useDebouncedContainerWidth,
  useDebouncedContainerSize,
  useMeasuredRect,
  usePositiveChartSize,
  type ChartSize,
} from "./use-container-size";

// Sunburst types and utilities
export type { ArcDatum, ArcGeometry, Focus, SunburstNode } from "./sunburst-types";
export {
  buildArcs,
  geometryFor,
  ringOptions,
  geomCentroidAngle,
  geomCentroidRadius,
  buildHoverGrowTargets,
  applyHoverGrow,
  maxHoverSegmentThickness,
  defaultSunburstGrowPadding,
  transitionGeometry,
  arcPath,
  clockwiseFraction,
} from "./sunburst-geometry";
export { defaultSunburstColors, opacityForRelativeDepth } from "./sunburst-colors";

// Heatmap context
export {
  HeatmapContext,
  useHeatmap,
  DEFAULT_MARGIN,
  type HeatmapContextValue,
  type HeatmapMargin,
  type HeatmapLayout,
} from "./heatmap-context";

// Heatmap lifecycle
export {
  useHeatmapChartLifecycle,
  type HeatmapChartPhase,
  type HeatmapRevealMode,
  type HeatmapLifecycleState,
} from "./heatmap-lifecycle";

// Heatmap interaction
export {
  useHeatmapInteractionOptional,
  useHeatmapInteraction,
  HeatmapInteractionProvider,
  HeatmapInteractionBoundary,
  HeatmapInteractionRoot,
  type HeatmapInteractionContextValue,
} from "./heatmap-interaction";

// Heatmap components
export {
  HeatmapCells,
  HeatmapXAxis,
  HeatmapYAxis,
  HeatmapTooltip,
  HeatmapSeparator,
  type HeatmapCellsProps,
  type HeatmapXAxisProps,
  type HeatmapYAxisProps,
  type HeatmapTooltipProps,
  type HeatmapSeparatorProps,
} from "./heatmap-components";

export {
  legendCssVars,
  type LegendItemData,
  type LegendContextValue,
  type LegendItemContextValue,
  LegendProvider,
  LegendItemProvider,
  useLegend,
  useLegendItem,
} from "./legend-context";
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
} from "./legend";
export {
  ChartLegend,
  type LegendItem as ChartLegendItem,
  type ChartLegendProps,
} from "./chart-legend";
export {
  ChartLegendHoverProvider,
  useChartLegendHover,
} from "./chart-legend-hover";
export {
  splitProfitLossSegments,
  type ProfitLossSegment,
} from "./profit-loss-segments";
export {
  PROFIT_LOSS_POSITIVE_COLOR,
  PROFIT_LOSS_NEGATIVE_COLOR,
  profitLossColor,
  PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK,
  resolveProfitLossTooltipLabel,
  type ProfitLossLineConfig,
  normalizeProfitLossConfig,
  extractProfitLossHoveredIndex,
} from "./profit-loss-config";
export {
  profitLossLineMarks,
  resolveProfitLossGradientDefs,
  type ProfitLossLineMarkOptions,
  type ProfitLossGradientDef,
} from "./profit-loss-line-mark";
export {
  ProfitLossLegend,
  PROFIT_LOSS_LEGEND_ITEMS,
  type ProfitLossLegendProps,
} from "./profit-loss-legend";
export {
  ProfitLossLegendHoverProvider,
  useProfitLossLegendHover,
} from "./profit-loss-legend-hover";
export {
  fadeGradientStops,
  resolveFadeSides,
  type FadeSides,
  type FadeGradientStop,
} from "./fade-mask";

// Heatmap legend
export {
  HeatmapLegend,
  HeatmapLegendSwatch,
  HeatmapLegendGradient,
  HEATMAP_LEGEND_LEVELS,
  type HeatmapLegendVariant,
  type HeatmapLegendProps,
  type HeatmapLegendSwatchProps,
  type HeatmapLegendGradientProps,
} from "./heatmap-legend";

export { ChartBrush, type ChartBrushProps } from "./chart-brush";
export { patternAreaMark, type PatternAreaMarkOptions } from "./pattern-area-mark";
export type { PatternAreaConfig } from "./types";
export { renderPatternPreset, type PatternPresetId } from "./pattern-preset";
export { computeSquareColumn, topSquareCenterY, type SquareColumnInput, type SquareColumnLayout } from "./bar-squares-layout";
export { barSquaresMark, type BarSquaresMarkOptions } from "./bar-squares-mark";
export { barColumnTrackMark, type BarColumnTrackMarkOptions } from "./bar-column-track-mark";
export { BAR_DEPTH_MAX_PX, BAR_DEPTH_PERSPECTIVE_RATIO, BAR_DEPTH_MIN_PX, barDepthMaxDepth, barDepthAndRise } from "./bar-depth-geometry";
export { barDepthBackMark, barDepthFrontMark, DEFAULT_GROUND_SHADOW, GLASS_TIP_OPACITY, BAR_FADED_OPACITY, type BarDepthBackMarkOptions, type BarDepthFrontMarkOptions } from "./bar-depth-marks";
export { barPulseMark, buildBarSilhouettePath, PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX, PULSE_WAVE_DURATION_S, PULSE_WAVE_PEAK_OPACITY, type BarPulseMarkOptions } from "./bar-pulse-mark";
export { barTrimmedMark, type BarTrimmedMarkOptions } from "./bar-trimmed-mark";
export { BrushLayout, type BrushLayoutProps } from "./brush-layout";
export { useBrushSelection, type BrushSelection, type BrushLayoutState } from "./brush-selection";
export { filterDataByXDomain, resolveBrushTrackXExtent, createXAccessor } from "./brush-selection";
export { BrushHostContext, type BrushHost } from "./brush-drag";
