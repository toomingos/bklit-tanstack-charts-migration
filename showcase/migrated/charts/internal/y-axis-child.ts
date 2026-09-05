// YAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { YAxisConfig } from "./types";

const YAxis: ChartChildComponent<YAxisConfig> = (props: Readonly<YAxisConfig>): null => {
  useChartChild("yAxis", props);
  return null;
};

YAxis[CHART_ROLE] = "yAxis";
YAxis.displayName = "YAxis";

export { YAxis };
