// ChartTooltip config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartTooltipProps } from "./tooltip-components";

const ChartTooltip: ((props: ChartTooltipProps) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: ChartTooltipProps): ReactElement | null => {
    useChartChild("tooltip", props);
    return null;
  },
  { [CHART_ROLE]: "tooltip", displayName: "ChartTooltip" },
);

export { ChartTooltip };
