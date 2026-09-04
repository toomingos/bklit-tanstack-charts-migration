// ProjectionLineEndMarker config-carrier child: never rendered, compiled once into a TanStack defineChart spec.
import { CHART_ROLE } from "./chart-child-carrier";
import type { ChartChildComponent, ProjectionLineEndMarkerProps, ReadonlyProjectionLineEndMarkerProps } from "./chart-child-carrier";

const ProjectionLineEndMarker: ChartChildComponent<ProjectionLineEndMarkerProps> = (_props: ReadonlyProjectionLineEndMarkerProps): null => null;

ProjectionLineEndMarker[CHART_ROLE] = "projectionEndMarker";
ProjectionLineEndMarker.displayName = "ProjectionLineEndMarker";

export { ProjectionLineEndMarker };
