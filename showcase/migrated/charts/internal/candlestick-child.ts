// Candlestick config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent } from "./chart-child-carrier";
import type { CandlestickConfig } from "./types";

const Candlestick: ChartChildComponent<CandlestickConfig> = (_props: Readonly<CandlestickConfig>): null => null;

Candlestick[CHART_ROLE] = "candlestick";

export { Candlestick };
