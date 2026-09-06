// Bar config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { BarConfig } from "./types";

// Line cap style for bar ends: "round", "butt", or a number for custom radius.
type BarLineCap = "round" | "butt" | number;

const Bar: ((props: Readonly<BarConfig>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<BarConfig>): ReactElement | null => {
    useChartChild("bar", props);
    return null;
  },
  { [CHART_ROLE]: "bar", displayName: "Bar" },
);

export { Bar };
export type { BarLineCap };
