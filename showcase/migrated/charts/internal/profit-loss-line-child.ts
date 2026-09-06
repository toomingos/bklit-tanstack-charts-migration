// ProfitLossLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { useMemo } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import { useProfitLossLegendHover } from "./profit-loss-legend-hover-context";
import type { ChartChildComponent, ProfitLossLineProps } from "./chart-child-carrier";

const ProfitLossLine: ChartChildComponent<ProfitLossLineProps> = (props: Readonly<ProfitLossLineProps>): null => {
// Legend hover arrives via context wrapping this child.
// Entry merges it from the contribution; no hover scan in entries.
  const { hoveredIndex } = useProfitLossLegendHover();
  const contribution = useMemo(() => ({ profitLossHoveredIndex: hoveredIndex }), [hoveredIndex]);
  useChartChild("profitLossLine", props, contribution);
  return null;
};

ProfitLossLine[CHART_ROLE] = "profitLossLine";
ProfitLossLine.displayName = "ProfitLossLine";

export { ProfitLossLine };
