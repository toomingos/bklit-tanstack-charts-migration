import { linearRegressionRowsY } from "@tanstack/charts/regression";
import type { ProjectionAutoMethod, ProjectionPathDensity, ProjectionPoint } from "./projection-utils";

interface HistoryPoint {
  readonly timeMs: number;
  readonly value: number;
}

// Offset of the second-to-last history point (the "previous" point of the last segment).
const PENULTIMATE_OFFSET = -2;

interface RegressionInputRow {
  readonly time: number;
  readonly y: number;
}

// Samples: 2 yields just the domain endpoints; ci: 0 skips the confidence-band cost; slope is recovered from those two points as Δy/Δx.
const toRegressionRows = (points: readonly HistoryPoint[]): RegressionInputRow[] =>
  points.map(({ timeMs, value }) => ({ time: timeMs, y: value }));

interface RegressionSample {
  readonly x: number | Readonly<Date>;
  readonly y: number;
}

const slopeFromRegressionSamples = (samples: readonly RegressionSample[]): number => {
  const [first] = samples;
  const last = samples.at(-1);
  if (first === undefined || last === undefined) {return 0;}
  const dt = Number(last.x) - Number(first.x);
  return dt === 0 ? 0 : (last.y - first.y) / dt;
}

const linearRegressionSlope = (points: readonly HistoryPoint[]): number => {
  if (points.length < 2) {return 0;}
  const samples = linearRegressionRowsY(
    toRegressionRows(points),
    { ci: 0, samples: 2, x: "time", y: "y" },
  );
  if (samples.length < 2) {return 0;}
  return slopeFromRegressionSamples(samples);
}

const slopeFromLastSegment = (historyPoints: readonly HistoryPoint[]): number => {
  if (historyPoints.length < 2) {return 0;}
  const prev = historyPoints.at(PENULTIMATE_OFFSET);
  const last = historyPoints.at(-1);
  if (!(prev && last)) {return 0;}
  const deltaMs = last.timeMs - prev.timeMs;
  return deltaMs === 0 ? 0 : (last.value - prev.value) / deltaMs;
}

const resolveAutoSlope = (autoMethod: ProjectionAutoMethod, historyPoints: readonly HistoryPoint[]): number => {
  if (autoMethod === "lastSegment" && historyPoints.length >= 2) {return slopeFromLastSegment(historyPoints);}
  return linearRegressionSlope(historyPoints);
}

interface SteppedProjectionOptions {
  readonly anchorTime: number;
  readonly anchorValue: number;
  readonly slope: number;
  readonly horizonPoints: number;
  readonly intervalMs: number;
}

const buildEndpointProjectionValues = (options: Readonly<SteppedProjectionOptions>): ProjectionPoint[] => {
  const { anchorTime, anchorValue, slope, horizonPoints, intervalMs } = options;
  const endTime = anchorTime + intervalMs * horizonPoints;
  const endValue = anchorValue + slope * intervalMs * horizonPoints;
  return [
    { date: new Date(anchorTime), value: anchorValue },
    { date: new Date(endTime), value: endValue },
  ];
}

const buildSteppedProjectionValues = (options: Readonly<SteppedProjectionOptions>): ProjectionPoint[] => {
  const { anchorTime, anchorValue, slope, horizonPoints, intervalMs } = options;
  const result: ProjectionPoint[] = [{ date: new Date(anchorTime), value: anchorValue }];
  for (let horizonStep = 1; horizonStep <= horizonPoints; horizonStep += 1) {
    result.push({ date: new Date(anchorTime + intervalMs * horizonStep), value: anchorValue + slope * intervalMs * horizonStep });
  }
  return result;
}

interface BuildAutoFutureValuesOptions {
  readonly anchorTime: number;
  readonly anchorValue: number;
  readonly autoMethod: ProjectionAutoMethod;
  readonly historyPoints: readonly HistoryPoint[];
  readonly horizonPoints: number;
  readonly intervalMs: number;
  readonly pathDensity: ProjectionPathDensity;
}

const buildAutoFutureValues = (options: Readonly<BuildAutoFutureValuesOptions>): ProjectionPoint[] => {
  const { anchorTime, anchorValue, autoMethod, historyPoints, horizonPoints, intervalMs, pathDensity } = options;
  const slope = resolveAutoSlope(autoMethod, historyPoints);
  if (pathDensity === "endpoints") {
    return buildEndpointProjectionValues({ anchorTime, anchorValue, horizonPoints, intervalMs, slope });
  }
  return buildSteppedProjectionValues({ anchorTime, anchorValue, horizonPoints, intervalMs, slope });
}

export type { HistoryPoint };
export { buildAutoFutureValues, slopeFromLastSegment };
