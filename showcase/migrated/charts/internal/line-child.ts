// Line config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ReadonlyLineConfig } from "./chart-child-carrier";
import type { LineConfig } from "./types";

const Line: ChartChildComponent<LineConfig> = (_props: ReadonlyLineConfig): null => null;

Line[CHART_ROLE] = "line";

export { Line };
