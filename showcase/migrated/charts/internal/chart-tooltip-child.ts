// ChartTooltip config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { ChartTooltipConfig } from "./types";

const ChartTooltip: ChartChildComponent<ChartTooltipConfig> = (_props: Readonly<ChartTooltipConfig>): null => null;

ChartTooltip[CHART_ROLE] = "tooltip";

export { ChartTooltip };
