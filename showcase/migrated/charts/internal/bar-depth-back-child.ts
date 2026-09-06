// BarDepthBack config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { BarDepthBackConfig } from "./types";

const BarDepthBack: ((props: Readonly<BarDepthBackConfig>) => ReactElement) & {
  [CHART_ROLE]?: string;
  isBarDepthLayer?: boolean;
  displayName: string;
} = Object.assign(
  (props: Readonly<BarDepthBackConfig>): ReactElement => {
    useChartChild("barDepthBack", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "barDepthBack", displayName: "BarDepthBack", isBarDepthLayer: true },
);

export { BarDepthBack };
