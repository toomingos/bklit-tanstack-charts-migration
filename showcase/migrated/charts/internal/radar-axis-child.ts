// Radar axis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, RadarAxisProps } from "./chart-child-carrier";

const RadarAxis: ChartChildComponent<RadarAxisProps> = (props: Readonly<RadarAxisProps>): null => {
  useChartChild("radar-axis", props);
  return null;
};

RadarAxis[CHART_ROLE] = "radar-axis";
RadarAxis.displayName = "RadarAxis";

export { RadarAxis };
export type { RadarAxisProps } from "./chart-child-carrier";
