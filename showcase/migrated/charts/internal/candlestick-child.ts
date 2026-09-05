// Candlestick config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { CandlestickConfig } from "./types";

const Candlestick: ChartChildComponent<CandlestickConfig> = (props: Readonly<CandlestickConfig>): null => {
  useChartChild("candlestick", props);
  return null;
};

Candlestick[CHART_ROLE] = "candlestick";
Candlestick.displayName = "Candlestick";

export { Candlestick };
