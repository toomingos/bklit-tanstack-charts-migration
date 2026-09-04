// Radar area config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";

interface RadarAreaProps {
  readonly index: number;
  readonly color?: string;
  readonly showPoints?: boolean;
  readonly showStroke?: boolean;
  readonly showGlow?: boolean;
  readonly className?: string;
}

const RadarArea: ChartChildComponent<RadarAreaProps> = (_props: Readonly<RadarAreaProps>): null => null;

RadarArea[CHART_ROLE] = "radar-area";

export { RadarArea };
export type { RadarAreaProps };
