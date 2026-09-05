// BarXAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarXAxisConfig } from "./types";

const BarXAxis: ChartChildComponent<BarXAxisConfig> = (props: Readonly<BarXAxisConfig>): null => {
  useChartChild("barXAxis", props);
  return null;
};

BarXAxis[CHART_ROLE] = "barXAxis";
BarXAxis.displayName = "BarXAxis";

export { BarXAxis };
