// Area config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ReadonlyAreaConfig } from "./chart-child-carrier";
import type { AreaConfig } from "./types";

const Area: ChartChildComponent<AreaConfig> = (_props: ReadonlyAreaConfig): null => null;

Area[CHART_ROLE] = "area";

export { Area };
