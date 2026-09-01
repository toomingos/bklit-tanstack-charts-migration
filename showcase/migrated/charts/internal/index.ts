// Shared utilities — one clean import path for all migrated charts.
// Charts can import any of these via `./internal` (barrel re-export).

// Container measurement + margin normalization (shared lifecycle setup)
export { useChartMargin, DEFAULT_CHART_MARGIN, type ChartMargin } from "./use-chart-margin";
export {
  useContainerWidth,
  useDebouncedContainerWidth,
  useDebouncedContainerSize,
  useMeasuredRect,
  usePositiveChartSize,
} from "./use-container-size";
