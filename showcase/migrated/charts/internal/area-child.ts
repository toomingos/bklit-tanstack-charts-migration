// Area config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, ReadonlyAreaConfig } from "./chart-child-carrier";
import type { AreaConfig } from "./types";

const Area: ChartChildComponent<AreaConfig> = (props: ReadonlyAreaConfig): null => {
  useChartChild("area", props);
  return null;
};

Area[CHART_ROLE] = "area";
Area.displayName = "Area";

export { Area };
