// Shared utilities barrel — charts import these via `./internal`.

// Container measurement + margin normalization (shared lifecycle setup)
export { useChartMargin, DEFAULT_CHART_MARGIN, type ChartMargin } from "./use-chart-margin";
export {
  useContainerWidth,
  useDebouncedContainerWidth,
  useDebouncedContainerSize,
  useMeasuredRect,
  usePositiveChartSize,
} from "./use-container-size";
