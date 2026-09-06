// BarPulse config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { BarPulseConfig } from "./types";

const BarPulse: ((props: Readonly<BarPulseConfig>) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  isBarDepthLayer?: boolean;
  displayName: string;
} = Object.assign(
  (props: Readonly<BarPulseConfig>): ReactElement | null => {
    useChartChild("barPulse", props);
    return null;
  },
  { [CHART_ROLE]: "barPulse", displayName: "BarPulse", isBarDepthLayer: true },
);

export { BarPulse };
