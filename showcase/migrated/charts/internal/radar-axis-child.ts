// Radar axis config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { RadarAxisProps } from "./chart-child-carrier";

const RadarAxis = (props: Readonly<RadarAxisProps>): ReactElement => {
  useChartChild("radar-axis", props);
  return createElement("g");
};

Object.defineProperty(RadarAxis, CHART_ROLE, {
  configurable: true,
  enumerable: true,
  value: "radar-axis",
  writable: true,
});
RadarAxis.displayName = "RadarAxis";

export { RadarAxis };
export type { RadarAxisProps } from "./chart-child-carrier";
