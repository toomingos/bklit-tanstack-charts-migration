// ProfitLossLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ProfitLossLineProps } from "./chart-child-carrier";

const ProfitLossLine: ChartChildComponent<ProfitLossLineProps> = (_props: Readonly<ProfitLossLineProps>): null => null;

ProfitLossLine[CHART_ROLE] = "profitLossLine";
ProfitLossLine.displayName = "ProfitLossLine";

export { ProfitLossLine };
