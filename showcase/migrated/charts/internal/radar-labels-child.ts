// Radar labels config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, RadarLabelsProps } from "./chart-child-carrier";

const RadarLabels: ChartChildComponent<RadarLabelsProps> = (props: Readonly<RadarLabelsProps>): null => {
  useChartChild("radar-labels", props);
  return null;
};

RadarLabels[CHART_ROLE] = "radar-labels";
RadarLabels.displayName = "RadarLabels";

export { RadarLabels };
export type { RadarLabelsProps } from "./chart-child-carrier";
