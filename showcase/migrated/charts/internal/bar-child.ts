// Bar config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarConfig } from "./types";

const Bar: ChartChildComponent<BarConfig> = (props: Readonly<BarConfig>): null => {
  useChartChild("bar", props);
  return null;
};

Bar[CHART_ROLE] = "bar";
Bar.displayName = "Bar";

export { Bar };
