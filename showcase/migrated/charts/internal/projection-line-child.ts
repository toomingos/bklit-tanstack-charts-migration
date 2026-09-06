// ProjectionLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ProjectionLineProps } from "./chart-child-carrier";

const ProjectionLine: ((props: ProjectionLineProps) => ReactElement | null) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: ProjectionLineProps): ReactElement | null => {
    useChartChild("projectionLine", props);
    return null;
  },
  { [CHART_ROLE]: "projectionLine", displayName: "ProjectionLine" },
);

export { ProjectionLine };
