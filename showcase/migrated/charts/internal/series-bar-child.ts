// SeriesBar config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE, type ChartChildComponent } from "./chart-child-carrier";
import type { SeriesBarConfig } from "./types";

// SeriesBar has its own role; ComposedChart extracts it separately to keep encounter order.
const SeriesBar: ChartChildComponent<SeriesBarConfig> = (_props: Readonly<SeriesBarConfig>): null => null;

SeriesBar[CHART_ROLE] = "seriesBar";

export { SeriesBar };
