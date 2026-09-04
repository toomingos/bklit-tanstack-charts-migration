// Radar axis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";

interface RadarAxisProps {
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly className?: string;
}

const RadarAxis: ChartChildComponent<RadarAxisProps> = (_props: Readonly<RadarAxisProps>): null => null;

RadarAxis[CHART_ROLE] = "radar-axis";

export { RadarAxis };
export type { RadarAxisProps };
