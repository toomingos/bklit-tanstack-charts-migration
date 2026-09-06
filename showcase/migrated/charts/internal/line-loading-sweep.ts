// Pure placeholder-line geometry (percentages to plot-space points).
// The traveling band rides a seam mask over these paths (CSS keyframes).

import { area, curveNatural, line } from "d3-shape";
import type { CurveFactory } from "d3-shape";

const PERCENT_SCALE = 100;
// Mid-cycle progress: the legacy pulse reveal peaked halfway, then exited.
const LINE_LOADING_PULSE_MIDPOINT = 0.5;
// Default skeleton point count (legacy sweep DEFAULT_POINT_COUNT).
const DEFAULT_LINE_SKELETON_POINT_COUNT = 14;

interface LoadingPlotRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface LoadingPlotPoint {
  readonly x: number;
  readonly y: number;
}

// Plot-space polyline for skeleton values; straight across the plot rect.
const projectLoadingLinePoints = (
  values: readonly number[],
  rect: Readonly<LoadingPlotRect>,
): LoadingPlotPoint[] => {
  if (values.length < 2 || rect.width <= 0 || rect.height <= 0) {
    return [];
  }
  return values.map((value, index) => ({
    x: rect.x + (index / (values.length - 1)) * rect.width,
    y: rect.y + rect.height - (value / PERCENT_SCALE) * rect.height,
  }));
};

// Curved silhouette through the points (legacy interpolation, default natural).
const buildLoadingLinePath = (
  points: readonly LoadingPlotPoint[],
  curve: CurveFactory = curveNatural,
): string =>
  line<LoadingPlotPoint>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curve)(points) ?? "";

// Area wash closing the silhouette at the plot floor.
const buildLoadingAreaPath = (
  points: readonly LoadingPlotPoint[],
  rect: Readonly<LoadingPlotRect>,
  curve: CurveFactory = curveNatural,
): string =>
  area<LoadingPlotPoint>()
    .x((point) => point.x)
    .y0(rect.y + rect.height)
    .y1((point) => point.y)
    .curve(curve)(points) ?? "";

export {
  DEFAULT_LINE_SKELETON_POINT_COUNT,
  LINE_LOADING_PULSE_MIDPOINT,
  buildLoadingAreaPath,
  buildLoadingLinePath,
  projectLoadingLinePoints,
};
export type { LoadingPlotPoint, LoadingPlotRect };
