// LiveXAxis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { LiveXAxisConfig } from "./types";

const LiveXAxis: ((props: Readonly<LiveXAxisConfig>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<LiveXAxisConfig>): ReactElement | null => {
    useChartChild("liveXAxis", props);
    return null;
  },
  { [CHART_ROLE]: "liveXAxis", displayName: "LiveXAxis" },
);

export { LiveXAxis };
