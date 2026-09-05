// Scatter config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, ReadonlyScatterConfig } from "./chart-child-carrier";
import type { ScatterConfig } from "./types";

const Scatter: ChartChildComponent<ScatterConfig> = (props: ReadonlyScatterConfig): null => {
  useChartChild("scatter", props);
  return null;
};

Scatter[CHART_ROLE] = "scatter";
Scatter.displayName = "Scatter";

export { Scatter };
