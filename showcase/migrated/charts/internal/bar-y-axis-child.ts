// BarYAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { BarYAxisProps } from "./types";

const BarYAxis: ((props: Readonly<BarYAxisProps>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<BarYAxisProps>): ReactElement | null => {
    useChartChild("barYAxis", props);
    return null;
  },
  { [CHART_ROLE]: "barYAxis", displayName: "BarYAxis" },
);

export { BarYAxis };
