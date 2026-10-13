"use client";
// Overlay children of the cartesian charts (event markers, projection and terminal markers); the module registers the overlay builders (features.ts).
import { defineCarrier } from "../role";
import type { ChartMarkersProps, LineSeriesTerminalMarkerProps, MarkerGroupProps, ProjectionLineEndMarkerProps, ProjectionLineProps } from "../types";
import { enableOverlays } from "./enable-overlays";

enableOverlays();

/**
 * Event markers along the top of a cartesian chart: a circle with an icon per date, a dashed guide line down the plot, and a tooltip. Markers on the same date group into a cluster that fans out on hover. It renders nothing itself; place it as a child of the chart.
 */
export const ChartMarkers = /* @__PURE__ */ defineCarrier<ChartMarkersProps>("chartMarkers", "ChartMarkers");
/**
 * A forecast path drawn after the last data point, solid or gradient, straight or curved. It renders nothing itself; place it as a child of a `LineChart` or `AreaChart`.
 */
export const ProjectionLine = /* @__PURE__ */ defineCarrier<ProjectionLineProps>("projectionLine", "ProjectionLine");
/** The end dot of a `ProjectionLine`. Accepted so bklit-ui code compiles; this package does not draw it. */
export const ProjectionLineEndMarker = /* @__PURE__ */ defineCarrier<ProjectionLineEndMarkerProps>("projectionEndMarker", "ProjectionLineEndMarker");
/**
 * A ring on the last data point of a series, the usual anchor for a `ProjectionLine`. It renders nothing itself; place it as a child of the chart.
 */
export const LineSeriesTerminalMarker = /* @__PURE__ */ defineCarrier<LineSeriesTerminalMarkerProps>("terminalMarker", "LineSeriesTerminalMarker");
/** One group of event markers at the dates of its `markers`. Prefer `ChartMarkers`, which takes all markers at once. */
export const MarkerGroup = /* @__PURE__ */ defineCarrier<MarkerGroupProps>("markerGroup", "MarkerGroup");
