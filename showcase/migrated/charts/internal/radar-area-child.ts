// Radar area config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, RadarAreaProps } from "./chart-child-carrier";

const RadarArea: ChartChildComponent<RadarAreaProps> = (props: Readonly<RadarAreaProps>): null => {
  useChartChild("radar-area", props);
  return null;
};

RadarArea[CHART_ROLE] = "radar-area";
RadarArea.displayName = "RadarArea";

export { RadarArea };
export type { RadarAreaProps } from "./chart-child-carrier";
