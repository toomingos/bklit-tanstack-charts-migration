// XAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { XAxisConfig } from "./types";

const XAxis: ChartChildComponent<XAxisConfig> = (_props: Readonly<XAxisConfig>): null => null;

XAxis[CHART_ROLE] = "xAxis";

export { XAxis };
