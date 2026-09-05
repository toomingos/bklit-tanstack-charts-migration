// Grid config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, ReadonlyGridConfig } from "./chart-child-carrier";
import type { GridConfig } from "./types";

const Grid: ChartChildComponent<GridConfig> = (props: ReadonlyGridConfig): null => {
  useChartChild("grid", props);
  return null;
};

Grid[CHART_ROLE] = "grid";
Grid.displayName = "Grid";

export { Grid };
