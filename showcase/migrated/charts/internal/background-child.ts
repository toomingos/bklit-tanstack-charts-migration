// Background config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { BackgroundConfig } from "./types";

const Background: ChartChildComponent<BackgroundConfig> = (props: Readonly<BackgroundConfig>): null => {
  useChartChild("background", props);
  return null;
};

Background[CHART_ROLE] = "background";
Background.displayName = "Background";

export { Background };
