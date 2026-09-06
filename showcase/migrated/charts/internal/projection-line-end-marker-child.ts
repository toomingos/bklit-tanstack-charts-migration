// ProjectionLineEndMarker config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ProjectionLineEndMarkerProps } from "./chart-child-carrier";

const ProjectionLineEndMarker: ((props: ProjectionLineEndMarkerProps) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: ProjectionLineEndMarkerProps): ReactElement | null => {
    useChartChild("projectionEndMarker", props);
    return null;
  },
  { [CHART_ROLE]: "projectionEndMarker", displayName: "ProjectionLineEndMarker" },
);

export { ProjectionLineEndMarker };
