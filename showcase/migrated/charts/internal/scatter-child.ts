// Scatter config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ReadonlyScatterConfig } from "./chart-child-carrier";

const Scatter: ((props: ReadonlyScatterConfig) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: ReadonlyScatterConfig): ReactElement => {
    useChartChild("scatter", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "scatter", displayName: "Scatter" },
);

export { Scatter };
