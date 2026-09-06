// BarDepthFront config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { BarDepthFrontConfig } from "./types";

const BarDepthFront: ((props: Readonly<BarDepthFrontConfig>) => ReactElement) & {
  [CHART_ROLE]?: string;
  isBarDepthLayer?: boolean;
  displayName: string;
} = Object.assign(
  (props: Readonly<BarDepthFrontConfig>): ReactElement => {
    useChartChild("barDepthFront", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "barDepthFront", displayName: "BarDepthFront", isBarDepthLayer: true },
);

export { BarDepthFront };
