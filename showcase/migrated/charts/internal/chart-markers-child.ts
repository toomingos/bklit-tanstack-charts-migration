// ChartMarkers config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ChartMarkersChildProps } from "./chart-child-carrier";

const ChartMarkers: ChartChildComponent<ChartMarkersChildProps> = (_props: Readonly<ChartMarkersChildProps>): null => null;

ChartMarkers[CHART_ROLE] = "chartMarkers";
ChartMarkers.displayName = "ChartMarkers";

export { ChartMarkers };
