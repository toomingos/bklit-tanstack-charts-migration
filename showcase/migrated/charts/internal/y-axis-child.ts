// YAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE, type ChartChildComponent } from "./chart-child-carrier";
import type { YAxisConfig } from "./types";

const YAxis: ChartChildComponent<YAxisConfig> = (_props: Readonly<YAxisConfig>): null => null;

YAxis[CHART_ROLE] = "yAxis";

export { YAxis };
