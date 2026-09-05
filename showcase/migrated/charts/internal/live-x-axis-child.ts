// LiveXAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { LiveXAxisConfig } from "./types";

const LiveXAxis: ChartChildComponent<LiveXAxisConfig> = (props: Readonly<LiveXAxisConfig>): null => {
  useChartChild("liveXAxis", props);
  return null;
};

LiveXAxis[CHART_ROLE] = "liveXAxis";
LiveXAxis.displayName = "LiveXAxis";

export { LiveXAxis };
