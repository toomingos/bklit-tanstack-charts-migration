// LiveXAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE, type ChartChildComponent } from "./chart-child-carrier";
import type { LiveXAxisConfig } from "./types";

const LiveXAxis: ChartChildComponent<LiveXAxisConfig> = (_props: Readonly<LiveXAxisConfig>): null => null;

LiveXAxis[CHART_ROLE] = "liveXAxis";

export { LiveXAxis };
