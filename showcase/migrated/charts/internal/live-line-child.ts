// LiveLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ReadonlyLiveLineConfig } from "./chart-child-carrier";
import type { LiveLineConfig } from "./types";

// LiveLine markers share CHART_ROLE but skip extractChildren (own dedicated extraction).
const LiveLine: ChartChildComponent<LiveLineConfig> = (_props: ReadonlyLiveLineConfig): null => null;

LiveLine[CHART_ROLE] = "liveLine";

export { LiveLine };
