// BarDepthFront config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarDepthFrontConfig } from "./types";

const BarDepthFront: ChartChildComponent<BarDepthFrontConfig> = (props: Readonly<BarDepthFrontConfig>): null => {
  useChartChild("barDepthFront", props);
  return null;
};

BarDepthFront[CHART_ROLE] = "barDepthFront";
BarDepthFront.isBarDepthLayer = true;
BarDepthFront.displayName = "BarDepthFront";

export { BarDepthFront };
