// ProjectionLine config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartChildComponent, ProjectionLineProps, ReadonlyProjectionLineProps } from "./chart-child-carrier";

const ProjectionLine: ChartChildComponent<ProjectionLineProps> = (props: ReadonlyProjectionLineProps): null => {
  useChartChild("projectionLine", props);
  return null;
};

ProjectionLine[CHART_ROLE] = "projectionLine";
ProjectionLine.displayName = "ProjectionLine";

export { ProjectionLine };
