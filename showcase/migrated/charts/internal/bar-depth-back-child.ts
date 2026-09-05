// BarDepthBack config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarDepthBackConfig } from "./types";

const BarDepthBack: ChartChildComponent<BarDepthBackConfig> = (props: Readonly<BarDepthBackConfig>): null => {
  useChartChild("barDepthBack", props);
  return null;
};

BarDepthBack[CHART_ROLE] = "barDepthBack";
BarDepthBack.isBarDepthLayer = true;
BarDepthBack.displayName = "BarDepthBack";

export { BarDepthBack };
