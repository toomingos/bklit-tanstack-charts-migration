// PatternArea config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { PatternAreaConfig } from "./types";

const PatternArea: ChartChildComponent<PatternAreaConfig> = (_props: Readonly<PatternAreaConfig>): null => null;

PatternArea[CHART_ROLE] = "patternArea";
PatternArea.displayName = "PatternArea";

export { PatternArea };
