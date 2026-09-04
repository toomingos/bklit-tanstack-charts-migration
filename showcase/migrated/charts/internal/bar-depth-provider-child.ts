// BarDepthProvider config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactNode } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarDepthProviderConfig } from "./types";

const BarDepthProvider: ChartChildComponent<BarDepthProviderConfig & { children?: ReactNode }> = (_props: Readonly<BarDepthProviderConfig> & { readonly children?: ReactNode }): null => null;

BarDepthProvider[CHART_ROLE] = "barDepthProvider";
BarDepthProvider.displayName = "BarDepthProvider";

export { BarDepthProvider };
