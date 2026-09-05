// SeriesBar config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { SeriesBarConfig } from "./types";

// SeriesBar has its own role; ComposedChart extracts it separately to keep encounter order.
const SeriesBar: ChartChildComponent<SeriesBarConfig> = (props: Readonly<SeriesBarConfig>): null => {
  useChartChild("seriesBar", props);
  return null;
};

SeriesBar[CHART_ROLE] = "seriesBar";
SeriesBar.displayName = "SeriesBar";

export { SeriesBar };
