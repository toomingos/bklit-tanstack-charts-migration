// Called by each overlay child's module (ChartMarkers, ProjectionLine, ReferenceArea, ...): importing one is what bundles the overlay builders.
import { installMarkerSprings } from "../motion/marker-springs";
import { registerOverlays } from "./features";
import { buildOverlays, chartMarkerProps } from "./overlays";
import { ReferenceAreaResources } from "./reference-area-resources";

export const enableOverlays = (): void => {
  registerOverlays({ build: buildOverlays, Resources: ReferenceAreaResources, markerLists: (table) => chartMarkerProps(table).map((m) => m.items), installSprings: installMarkerSprings });
};
