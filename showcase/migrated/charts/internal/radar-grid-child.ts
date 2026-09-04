// Radar grid config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";

interface RadarGridProps {
  readonly showLabels?: boolean;
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly className?: string;
}

const RadarGrid: ChartChildComponent<RadarGridProps> = (_props: Readonly<RadarGridProps>): null => null;

RadarGrid[CHART_ROLE] = "radar-grid";

export { RadarGrid };
export type { RadarGridProps };
