// LiveYAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { LiveYAxisConfig } from "./types";

const LiveYAxis: ChartChildComponent<LiveYAxisConfig> = (_props: Readonly<LiveYAxisConfig>): null => null;

LiveYAxis[CHART_ROLE] = "liveYAxis";

export { LiveYAxis };
