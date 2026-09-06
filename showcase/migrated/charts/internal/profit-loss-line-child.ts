// ProfitLossLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement, useMemo } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import { useProfitLossLegendHover } from "./profit-loss-legend-hover-context";
import type { ProfitLossLineProps } from "./chart-child-carrier";

const ProfitLossLine: ((props: Readonly<ProfitLossLineProps>) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<ProfitLossLineProps>): ReactElement => {
// Legend hover arrives via context wrapping this child.
// Entry merges it from the contribution; no hover scan in entries.
    const { hoveredIndex } = useProfitLossLegendHover();
    const contribution = useMemo(() => ({ profitLossHoveredIndex: hoveredIndex }), [hoveredIndex]);
    useChartChild("profitLossLine", props, contribution);
    return createElement("g");
  },
  { [CHART_ROLE]: "profitLossLine", displayName: "ProfitLossLine" },
);

export { ProfitLossLine };
