// YAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { YAxisConfig } from "./types";

const YAxis: ((props: Readonly<YAxisConfig>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<YAxisConfig>): ReactElement | null => {
    useChartChild("yAxis", props);
    return null;
  },
  { [CHART_ROLE]: "yAxis", displayName: "YAxis" },
);

export { YAxis };
