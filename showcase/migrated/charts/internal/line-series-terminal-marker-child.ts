// LineSeriesTerminalMarker config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { LineSeriesTerminalMarkerProps } from "./chart-child-carrier";

const LineSeriesTerminalMarker: ((props: Readonly<LineSeriesTerminalMarkerProps>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<LineSeriesTerminalMarkerProps>): ReactElement | null => {
    useChartChild("terminalMarker", props);
    return null;
  },
  { [CHART_ROLE]: "terminalMarker", displayName: "LineSeriesTerminalMarker" },
);

export { LineSeriesTerminalMarker };
