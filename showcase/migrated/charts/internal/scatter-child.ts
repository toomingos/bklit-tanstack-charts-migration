// Scatter config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ReadonlyScatterConfig } from "./chart-child-carrier";
import type { ScatterConfig } from "./types";

const Scatter: ChartChildComponent<ScatterConfig> = (_props: ReadonlyScatterConfig): null => null;

Scatter[CHART_ROLE] = "scatter";

export { Scatter };
