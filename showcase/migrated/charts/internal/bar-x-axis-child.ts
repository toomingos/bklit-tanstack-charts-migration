// BarXAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { BarXAxisConfig } from "./types";

const BarXAxis: ((props: Readonly<BarXAxisConfig>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<BarXAxisConfig>): ReactElement | null => {
    useChartChild("barXAxis", props);
    return null;
  },
  { [CHART_ROLE]: "barXAxis", displayName: "BarXAxis" },
);

export { BarXAxis };
