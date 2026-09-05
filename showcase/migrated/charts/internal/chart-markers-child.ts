// ChartMarkers config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, ChartMarkersChildProps } from "./chart-child-carrier";

const ChartMarkers: ChartChildComponent<ChartMarkersChildProps> = (props: Readonly<ChartMarkersChildProps>): null => {
  useChartChild("chartMarkers", props);
  return null;
};

ChartMarkers[CHART_ROLE] = "chartMarkers";
ChartMarkers.displayName = "ChartMarkers";

export { ChartMarkers };
