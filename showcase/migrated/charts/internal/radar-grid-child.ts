// Radar grid config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, RadarGridProps } from "./chart-child-carrier";

const RadarGrid: ChartChildComponent<RadarGridProps> = (props: Readonly<RadarGridProps>): null => {
  useChartChild("radar-grid", props);
  return null;
};

RadarGrid[CHART_ROLE] = "radar-grid";
RadarGrid.displayName = "RadarGrid";

export { RadarGrid };
export type { RadarGridProps } from "./chart-child-carrier";
