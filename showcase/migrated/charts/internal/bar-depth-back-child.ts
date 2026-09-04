// BarDepthBack config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarDepthBackConfig } from "./types";

const BarDepthBack: ChartChildComponent<BarDepthBackConfig> = (_props: Readonly<BarDepthBackConfig>): null => null;

BarDepthBack[CHART_ROLE] = "barDepthBack";
BarDepthBack.isBarDepthLayer = true;
BarDepthBack.displayName = "BarDepthBack";

export { BarDepthBack };
