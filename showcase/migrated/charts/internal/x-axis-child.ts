// XAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { XAxisConfig } from "./types";

const XAxis: ChartChildComponent<XAxisConfig> = (props: Readonly<XAxisConfig>): null => {
  useChartChild("xAxis", props);
  return null;
};

XAxis[CHART_ROLE] = "xAxis";
XAxis.displayName = "XAxis";

export { XAxis };
