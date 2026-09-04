// Radar labels config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";

interface RadarLabelsProps {
  readonly offset?: number;
  readonly fontSize?: number;
  readonly interactive?: boolean;
  readonly className?: string;
}

const RadarLabels: ChartChildComponent<RadarLabelsProps> = (_props: Readonly<RadarLabelsProps>): null => null;

RadarLabels[CHART_ROLE] = "radar-labels";

export { RadarLabels };
export type { RadarLabelsProps };
