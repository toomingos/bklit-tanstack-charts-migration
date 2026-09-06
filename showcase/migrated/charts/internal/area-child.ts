// Area config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ReadonlyAreaConfig } from "./chart-child-carrier";

const Area: ((props: ReadonlyAreaConfig) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: ReadonlyAreaConfig): ReactElement => {
    useChartChild("area", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "area", displayName: "Area" },
);

export { Area };
