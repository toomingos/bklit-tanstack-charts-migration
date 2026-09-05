// Line config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, ReadonlyLineConfig } from "./chart-child-carrier";
import type { LineConfig } from "./types";

const Line: ChartChildComponent<LineConfig> = (props: ReadonlyLineConfig): null => {
  useChartChild("line", props);
  return null;
};

Line[CHART_ROLE] = "line";
Line.displayName = "Line";

export { Line };
