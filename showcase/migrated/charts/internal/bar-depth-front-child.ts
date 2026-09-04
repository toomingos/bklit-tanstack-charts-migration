// BarDepthFront config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarDepthFrontConfig } from "./types";

const BarDepthFront: ChartChildComponent<BarDepthFrontConfig> = (_props: Readonly<BarDepthFrontConfig>): null => null;

BarDepthFront[CHART_ROLE] = "barDepthFront";
BarDepthFront.isBarDepthLayer = true;
BarDepthFront.displayName = "BarDepthFront";

export { BarDepthFront };
