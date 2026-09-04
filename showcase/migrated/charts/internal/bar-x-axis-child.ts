// BarXAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarXAxisConfig } from "./types";

const BarXAxis: ChartChildComponent<BarXAxisConfig> = (_props: Readonly<BarXAxisConfig>): null => null;

BarXAxis[CHART_ROLE] = "barXAxis";

export { BarXAxis };
