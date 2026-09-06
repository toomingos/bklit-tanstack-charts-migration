// ChartMarkers config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartMarkersChildProps } from "./chart-child-carrier";
import type { ChartMarker } from "./types";

// Legacy `items` is a mutable array; the shared readonly alias stays for readers.
type MutableChartMarkersChildProps = Omit<ChartMarkersChildProps, "items"> & {
  readonly items: ChartMarker[];
};

const ChartMarkers: ((props: MutableChartMarkersChildProps) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: MutableChartMarkersChildProps): ReactElement => {
    useChartChild("chartMarkers", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "chartMarkers", displayName: "ChartMarkers" },
);

export { ChartMarkers };
