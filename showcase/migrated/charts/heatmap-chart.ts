import "./styles.css";

export { HeatmapChart, type HeatmapChartProps } from "./internal/heatmap-chart-core";

export {
  useHeatmap,
  HeatmapContext,
  type HeatmapContextValue,
  type HeatmapLayout,
  type HeatmapMargin,
} from "./internal/heatmap-context";

export {
  type HeatmapChartPhase,
  type HeatmapRevealMode,
} from "./internal/heatmap-lifecycle";

export {
  useHeatmapInteractionOptional,
  useHeatmapInteraction,
  type HeatmapInteractionContextValue,
} from "./internal/heatmap-interaction";

export {
  HeatmapInteractionProvider,
  type HeatmapInteractionProviderProps,
} from "./internal/heatmap-interaction-provider";

export {
  HeatmapInteractionBoundary,
  type HeatmapInteractionBoundaryProps,
} from "./internal/heatmap-interaction-boundary";

export {
  HeatmapInteractionRoot,
  type HeatmapInteractionRootProps,
} from "./internal/heatmap-interaction-root";

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
} from "./internal/heatmap-components";

export {
  HeatmapLegend,
  HeatmapLegendSwatch,
  HeatmapLegendGradient,
  HEATMAP_LEGEND_LEVELS,
  type HeatmapLegendVariant,
  type HeatmapLegendSwatchProps,
  type HeatmapLegendProps,
  type HeatmapLegendGradientProps,
} from "./internal/heatmap-legend";

export type {
  HeatmapBin,
  HeatmapColumn,
  HeatmapColumnSeparatorsConfig,
  HeatmapSeparatorGroupBy,
  HeatmapSeparatorStrokeStyle,
  HeatmapSeparatorGradient,
  HeatmapWeekStartDay,
  HeatmapYAxisLabelFormat,
  HeatmapYAxisTickFilter,
} from "./internal/heatmap-utils";

export type {
  HeatmapEnterTransition,
  HeatmapLevelRange,
} from "./internal/heatmap-animation";

export type {
  HeatmapLevelColors,
  HeatmapLevelStyle,
  HeatmapLevelStyles,
  HeatmapLevelFillMode,
} from "./internal/heatmap-colors";

export type {
  HeatmapTooltipData,
  HeatmapHoveredCell,
} from "./internal/heatmap-hover-chrome";

export {
  HEATMAP_DEFAULT_LEVEL_COLORS,
  HEATMAP_DEFAULT_LEVEL_STYLES,
} from "./internal/heatmap-colors";

export {
  HEATMAP_DAY_LABELS,
} from "./internal/heatmap-utils";

export {
  HEATMAP_INACTIVE_OPACITY,
} from "./internal/heatmap-hover-chrome";

export {
  computeHeatmapLevelRange,
} from "./internal/heatmap-animation";

export {
  generateHeatmapSkeletonFromTarget,
} from "./internal/heatmap-chart-skeleton";

export {
  HeatmapChartLoading,
  type HeatmapChartLoadingProps,
} from "./internal/heatmap-chart-loading";
