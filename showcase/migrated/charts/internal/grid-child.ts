// Grid config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ReadonlyGridConfig } from "./chart-child-carrier";
import type { GridConfig } from "./types";

const Grid: ChartChildComponent<GridConfig> = (_props: ReadonlyGridConfig): null => null;

Grid[CHART_ROLE] = "grid";

export { Grid };
