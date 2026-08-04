// Shared utilities — one clean import path for all migrated charts.
// Charts can import any of these via `./internal` (barrel re-export).

export { parseAspectRatio } from "./parse-aspect-ratio";
export { bezierEasing } from "./bezier-easing";
export { bisectDateLeft, resolveNearestIndex } from "./bisect";
export { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
export { decimateTimeSeries, maxRenderPointsForWidth } from "./decimate";
export { FOCUS_DISABLED } from "./focus-disabled";

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
export {
  createSunburstHoverCoordinator,
  createSunburstSliceHoverRuntime,
  type SunburstHoverCoordinator,
  type SunburstSliceHoverRuntime,
  type SunburstSliceHoverConfig,
} from "./sunburst-hover-chrome";

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
