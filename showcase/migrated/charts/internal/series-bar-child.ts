// SeriesBar config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { SeriesBarConfig } from "./types";

// SeriesBar has its own role; ComposedChart extracts it separately to keep encounter order.
const SeriesBar: ((props: Readonly<SeriesBarConfig>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<SeriesBarConfig>): ReactElement | null => {
    useChartChild("seriesBar", props);
    return null;
  },
  { [CHART_ROLE]: "seriesBar", displayName: "SeriesBar" },
);

export { SeriesBar };
