// BarPulse config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BarPulseConfig } from "./types";

const BarPulse: ChartChildComponent<BarPulseConfig> = (_props: Readonly<BarPulseConfig>): null => null;

BarPulse[CHART_ROLE] = "barPulse";
BarPulse.isBarDepthLayer = true;
BarPulse.displayName = "BarPulse";

export { BarPulse };
