import type {
  ChartFocusGroupContext,
  ChartFocusStrategy,
  ChartPoint,
} from "@tanstack/charts";
import type { RadarRow } from "./radar-reveal";

interface RadarFocusOptions {
  readonly metricKeys: readonly string[];
}

type RadarVertex = readonly [number, number];
type RadarStrategyPoint = ChartPoint<RadarRow, string, number>;

// Even-odd containment for the painted area polygon (legacy onMouseEnter parity).
const isInsidePolygon = (polygon: readonly RadarVertex[], px: number, py: number): boolean => {
  let inside = false;
  let prev = polygon.at(-1);
  for (const next of polygon) {
    if (prev !== undefined) {
      const [x1, y1] = prev;
      const [x2, y2] = next;
      if ((y1 > py) !== (y2 > py) && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1) {
        inside = !inside;
      }
    }
    prev = next;
  }
  return inside;
};

const seriesOf = (point: RadarStrategyPoint): number => Number(point.datum.series);

// Distinct series, topmost paint order first (later series paint over earlier ones).
const paintedSeriesDesc = (points: readonly RadarStrategyPoint[]): number[] => {
  const seen = new Set<number>();
  for (const point of points) {
    const series = seriesOf(point);
    if (Number.isFinite(series)) {
      seen.add(series);
    }
  }
  return [...seen].sort((left, right) => right - left);
};

// Series polygon from the package's own vertex points, in metric order.
const seriesPolygon = (
  points: readonly RadarStrategyPoint[],
  metricKeys: readonly string[],
  series: number,
): RadarVertex[] =>
  points
    .filter((point) => seriesOf(point) === series)
    .toSorted(
      (left, right) => metricKeys.indexOf(left.datum.metric) - metricKeys.indexOf(right.datum.metric),
    )
    .map((point): RadarVertex => [point.x, point.y]);

// Topmost painted polygon containing the scene point, if any.
const findTopmostSeries = (
  points: readonly RadarStrategyPoint[],
  metricKeys: readonly string[],
  x: number,
  y: number,
): number | null => {
  for (const series of paintedSeriesDesc(points)) {
    if (isInsidePolygon(seriesPolygon(points, metricKeys, series), x, y)) {
      return series;
    }
  }
  return null;
};

// Package focus strategy: topmost containing polygon wins, like legacy hover.
// No polygon contains the pointer, so nothing dims, like legacy mouse-leave.
const createRadarFocus = (
  options: Readonly<RadarFocusOptions>,
): ChartFocusStrategy<RadarRow, string, number> => {
  const { metricKeys } = options;
  return {
    group(points, context: Readonly<ChartFocusGroupContext<RadarRow, string, number>>) {
      const series = seriesOf(context.point);
      return points.filter((point) => seriesOf(point) === series);
    },
    navigation(points) {
      return points.toSorted(
        (left, right) =>
          seriesOf(left) - seriesOf(right) ||
          metricKeys.indexOf(left.datum.metric) - metricKeys.indexOf(right.datum.metric),
      );
    },
    resolve(points, context) {
      const series = findTopmostSeries(points, metricKeys, context.x, context.y);
      if (series === null) {
        return [];
      }
      return points.filter((point) => seriesOf(point) === series);
    },
  };
};

export { createRadarFocus };
export type { RadarFocusOptions };
