// LineSeriesTerminalMarker config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, LineSeriesTerminalMarkerProps } from "./chart-child-carrier";

const LineSeriesTerminalMarker: ChartChildComponent<LineSeriesTerminalMarkerProps> = (props: Readonly<LineSeriesTerminalMarkerProps>): null => {
  useChartChild("terminalMarker", props);
  return null;
};

LineSeriesTerminalMarker[CHART_ROLE] = "terminalMarker";
LineSeriesTerminalMarker.displayName = "LineSeriesTerminalMarker";

export { LineSeriesTerminalMarker };
