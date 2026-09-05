// ProfitLossLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, ProfitLossLineProps } from "./chart-child-carrier";

const ProfitLossLine: ChartChildComponent<ProfitLossLineProps> = (props: Readonly<ProfitLossLineProps>): null => {
  useChartChild("profitLossLine", props);
  return null;
};

ProfitLossLine[CHART_ROLE] = "profitLossLine";
ProfitLossLine.displayName = "ProfitLossLine";

export { ProfitLossLine };
