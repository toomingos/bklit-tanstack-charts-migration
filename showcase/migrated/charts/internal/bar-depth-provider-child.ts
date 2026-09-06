// BarDepthProvider config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement, Fragment } from "react";
import type { ReactNode, ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { BarDepthProviderConfig } from "./types";

const BarDepthProvider: ((props: Readonly<BarDepthProviderConfig> & { readonly children: ReactNode }) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<BarDepthProviderConfig> & { readonly children: ReactNode }): ReactElement => {
    useChartChild("barDepthProvider", props);
    return createElement(Fragment, null, props.children);
  },
  { [CHART_ROLE]: "barDepthProvider", displayName: "BarDepthProvider" },
);

export { BarDepthProvider };
