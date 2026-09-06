// Candlestick config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { CandlestickConfig } from "./types";

const Candlestick: ((props: Readonly<CandlestickConfig>) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: Readonly<CandlestickConfig>): ReactElement => {
    useChartChild("candlestick", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "candlestick", displayName: "Candlestick" },
);

export { Candlestick };
