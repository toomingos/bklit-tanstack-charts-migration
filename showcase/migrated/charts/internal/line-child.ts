// Line config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ReadonlyLineConfig } from "./chart-child-carrier";

const Line: ((props: ReadonlyLineConfig) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: ReadonlyLineConfig): ReactElement => {
    useChartChild("line", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "line", displayName: "Line" },
);

export { Line };
