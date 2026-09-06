// Radar area config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { memo } from "react";
import type { NamedExoticComponent, ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { RadarAreaProps } from "./chart-child-carrier";

const RenderRadarArea = (props: Readonly<RadarAreaProps>): ReactElement | null => {
  useChartChild("radar-area", props);
  return null;
};

const RadarArea: NamedExoticComponent<Readonly<RadarAreaProps>> = memo(RenderRadarArea);

Object.defineProperty(RadarArea, CHART_ROLE, {
  configurable: true,
  enumerable: true,
  value: "radar-area",
  writable: true,
});
RadarArea.displayName = "RadarArea";

export { RadarArea };
export type { RadarAreaProps } from "./chart-child-carrier";
