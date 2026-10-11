// Overlay children of the cartesian charts (event markers, projection and terminal markers); the module registers the overlay builders (features.ts).
import { defineCarrier } from "../role";
import type { ChartMarkersProps, LineSeriesTerminalMarkerProps, MarkerGroupProps, ProjectionLineEndMarkerProps, ProjectionLineProps } from "../types";
import { enableOverlays } from "./enable-overlays";

enableOverlays();

export const ChartMarkers = defineCarrier<ChartMarkersProps>("chartMarkers", "ChartMarkers");
export const ProjectionLine = defineCarrier<ProjectionLineProps>("projectionLine", "ProjectionLine");
export const ProjectionLineEndMarker = defineCarrier<ProjectionLineEndMarkerProps>("projectionEndMarker", "ProjectionLineEndMarker");
export const LineSeriesTerminalMarker = defineCarrier<LineSeriesTerminalMarkerProps>("terminalMarker", "LineSeriesTerminalMarker");
export const MarkerGroup = defineCarrier<MarkerGroupProps>("markerGroup", "MarkerGroup");
