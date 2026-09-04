const DEFAULT_Y_AXIS_ID = "left";

type YAxisOrientation = "left" | "right";

const normalizeYAxisId = (id?: string | number): string => {
  // "" counts as unset, not as an axis literally named "".
  // `String(id)` covers both union members, so no representation check is needed.
  if (id === undefined || id === "") {
    return DEFAULT_Y_AXIS_ID;
  }
  return String(id);
}

interface YAxisSeries {
  readonly dataKey: string;
  readonly yAxisId?: string | number;
}

const groupSeriesByYAxisId = <Series extends YAxisSeries>(series: readonly Series[]): Map<string, Series[]> => {
  const groups = new Map<string, Series[]>();
  for (const seriesEntry of series) {
    const axisId = normalizeYAxisId(seriesEntry.yAxisId);
    const bucket = groups.get(axisId) ?? [];
    bucket.push(seriesEntry);
    groups.set(axisId, bucket);
  }
  return groups;
}

// Grouping-layer check only: per-axis re-derivation is trivially true and would leak overrides.
const usesDefaultAxisOnly = (series: readonly Readonly<YAxisSeries>[]): boolean => {
  for (const seriesEntry of series) {
    if (normalizeYAxisId(seriesEntry.yAxisId) !== DEFAULT_Y_AXIS_ID) {return false;}
  }
  return true;
}

export { DEFAULT_Y_AXIS_ID, normalizeYAxisId, groupSeriesByYAxisId, usesDefaultAxisOnly };
export type { YAxisOrientation, YAxisSeries };
