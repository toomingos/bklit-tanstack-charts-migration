// Radar grid config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { RadarGridProps } from "./chart-child-carrier";

const RadarGrid = (props: Readonly<RadarGridProps>): ReactElement => {
  useChartChild("radar-grid", props);
  return createElement("g");
};

Object.defineProperty(RadarGrid, CHART_ROLE, {
  configurable: true,
  enumerable: true,
  value: "radar-grid",
  writable: true,
});
RadarGrid.displayName = "RadarGrid";

export { RadarGrid };
export type { RadarGridProps } from "./chart-child-carrier";
