import { useContext } from "react";
import { ChartConfigContext, DEFAULT_CHART_CONFIG } from "./chart-config-context";
import type { ChartConfigValue } from "./chart-config-context";

// Falls back to the defaults outside a provider.
const useChartConfig = (): ChartConfigValue => useContext(ChartConfigContext) ?? DEFAULT_CHART_CONFIG;

export { useChartConfig };
