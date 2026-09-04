// Bar config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarConfig } from "./types";

const Bar: ChartChildComponent<BarConfig> = (_props: Readonly<BarConfig>): null => null;

Bar[CHART_ROLE] = "bar";

export { Bar };
