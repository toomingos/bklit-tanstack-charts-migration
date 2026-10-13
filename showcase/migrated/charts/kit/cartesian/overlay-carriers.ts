"use client";
// Overlay children of the cartesian charts (event markers, projection and terminal markers); the module registers the overlay builders (features.ts).
import { defineCarrier } from "../role";
import type { ChartMarkersProps, LineSeriesTerminalMarkerProps, MarkerGroupProps, ProjectionLineEndMarkerProps, ProjectionLineProps } from "../types";
import { enableOverlays } from "./enable-overlays";

enableOverlays();

export const ChartMarkers = /* @__PURE__ */ defineCarrier<ChartMarkersProps>("chartMarkers", "ChartMarkers");
export const ProjectionLine = /* @__PURE__ */ defineCarrier<ProjectionLineProps>("projectionLine", "ProjectionLine");
export const ProjectionLineEndMarker = /* @__PURE__ */ defineCarrier<ProjectionLineEndMarkerProps>("projectionEndMarker", "ProjectionLineEndMarker");
export const LineSeriesTerminalMarker = /* @__PURE__ */ defineCarrier<LineSeriesTerminalMarkerProps>("terminalMarker", "LineSeriesTerminalMarker");
export const MarkerGroup = /* @__PURE__ */ defineCarrier<MarkerGroupProps>("markerGroup", "MarkerGroup");
