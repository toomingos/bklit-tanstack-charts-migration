// LineSeriesTerminalMarker config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, LineSeriesTerminalMarkerProps } from "./chart-child-carrier";

const LineSeriesTerminalMarker: ChartChildComponent<LineSeriesTerminalMarkerProps> = (_props: Readonly<LineSeriesTerminalMarkerProps>): null => null;

LineSeriesTerminalMarker[CHART_ROLE] = "terminalMarker";
LineSeriesTerminalMarker.displayName = "LineSeriesTerminalMarker";

export { LineSeriesTerminalMarker };
