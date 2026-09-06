// Radar labels config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { RadarLabelsProps } from "./chart-child-carrier";

const RadarLabels = (props: Readonly<RadarLabelsProps>): ReactElement => {
  useChartChild("radar-labels", props);
  return createElement("g");
};

Object.defineProperty(RadarLabels, CHART_ROLE, {
  configurable: true,
  enumerable: true,
  value: "radar-labels",
  writable: true,
});
RadarLabels.displayName = "RadarLabels";

export { RadarLabels };
export type { RadarLabelsProps } from "./chart-child-carrier";
