// LiveLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ReadonlyLiveLineConfig } from "./chart-child-carrier";

// LiveLine markers share CHART_ROLE but skip extractChildren (own dedicated extraction).
const LiveLine: ((props: ReadonlyLiveLineConfig) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: ReadonlyLiveLineConfig): ReactElement => {
    useChartChild("liveLine", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "liveLine", displayName: "LiveLine" },
);

export { LiveLine };
