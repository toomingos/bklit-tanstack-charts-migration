import { toDate } from "./coerce-date";
import { mergeProjectionXDomainMax, mergeProjectionYDomain } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartDatum } from "./types";

interface SeriesKeyLike {
  readonly dataKey: string;
}

interface TimeBounds {
  readonly maxTime: number;
  readonly minTime: number;
}

// Type-guard predicates own the primitive `typeof` checks here;
// Call sites below branch on the guard instead of repeating `typeof`.
const isNumber = (value: unknown): value is number => typeof value === "number";
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const readNumericCell = (row: Readonly<ChartDatum>, dataKey: string): number | undefined => {
  const value: unknown = row[dataKey];
  return isNumber(value) ? value : undefined;
};

const buildRowBarOffsets = (
  row: Readonly<ChartDatum>,
  barDataKeys: readonly string[],
): Map<string, number> => {
  const pointOffsets = new Map<string, number>();
  let cumulative = 0;
  for (const barKey of barDataKeys) {
    pointOffsets.set(barKey, cumulative);
    const cell = readNumericCell(row, barKey);
    if (cell !== undefined) {
      cumulative += cell;
    }
  }
  return pointOffsets;
};

const computeComposedStackOffsets = (
  data: readonly (Readonly<ChartDatum> | undefined)[],
  barDataKeys: readonly string[],
): Map<number, Map<string, number>> => {
  const offsets = new Map<number, Map<string, number>>();
  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const row = data[rowIndex];
    if (row !== undefined) {
      offsets.set(rowIndex, buildRowBarOffsets(row, barDataKeys));
    }
  }
  return offsets;
};

const sumStackedBarRow = (row: Readonly<ChartDatum>, barDataKeys: readonly string[]): number => {
  let barSum = 0;
  for (const barKey of barDataKeys) {
    const cell = readNumericCell(row, barKey);
    if (cell !== undefined) {
      barSum += cell;
    }
  }
  return barSum;
};

const maxNonBarRowValue = (
  row: Readonly<ChartDatum>,
  series: readonly Readonly<SeriesKeyLike>[],
  barSet: Readonly<Set<string>>,
): number => {
  let rowMaxOther = 0;
  for (const entry of series) {
    if (!barSet.has(entry.dataKey)) {
      const cell = readNumericCell(row, entry.dataKey);
      if (cell !== undefined) {
        rowMaxOther = Math.max(rowMaxOther, cell);
      }
    }
  }
  return rowMaxOther;
};

const computeComposedYScaleDomainMax = (
  data: readonly Readonly<ChartDatum>[],
  series: readonly Readonly<SeriesKeyLike>[],
  barDataKeys: readonly string[],
): number | undefined => {
  const barSet = new Set(barDataKeys);
  let max = 0;
  for (const row of data) {
    const barSum = sumStackedBarRow(row, barDataKeys);
    const rowMaxOther = maxNonBarRowValue(row, series, barSet);
    max = Math.max(max, barSum, rowMaxOther);
  }
  return max > 0 ? max : undefined;
};

const applyProjectionYDomain = (
  base: readonly [number, number],
  projectionConfigs: readonly ProjectionLineConfig[],
  fallbackMax: number,
): [number, number] => {
  const leftConfigs = projectionConfigs.filter((proj) => proj.yAxisId === "left");
  const otherConfigs = projectionConfigs.filter((proj) => proj.yAxisId !== "left");
  let next: [number, number] = [base[0], base[1]];
  if (leftConfigs.length > 0) {
    next = mergeProjectionYDomain(next, projectionConfigs, "left");
  }
  if (otherConfigs.length > 0) {
    const fabricated = mergeProjectionYDomain([0, fallbackMax], projectionConfigs, otherConfigs[0].yAxisId);
    next = [Math.min(next[0], fabricated[0]), Math.max(next[1], fabricated[1])];
  }
  return next;
};

interface MutableTimeBounds {
  maxTime: number;
  minTime: number;
}

const parseRowTimeMs = (row: Readonly<ChartDatum>, xDataKey: string): number | undefined => {
  const parsed = toDate(row[xDataKey]);
  if (!parsed) {
    return undefined;
  }
  return parsed.getTime();
};

const foldTimeMsIntoBounds = (bounds: MutableTimeBounds, timeMs: number): void => {
  if (timeMs < bounds.minTime) {
    bounds.minTime = timeMs;
  }
  if (timeMs > bounds.maxTime) {
    bounds.maxTime = timeMs;
  }
};

const findTimeBounds = (
  rows: readonly Readonly<ChartDatum>[],
  xDataKey: string,
): TimeBounds | undefined => {
  const bounds: MutableTimeBounds = { maxTime: -Infinity, minTime: Infinity };
  for (const row of rows) {
    const timeMs = parseRowTimeMs(row, xDataKey);
    if (timeMs !== undefined) {
      foldTimeMsIntoBounds(bounds, timeMs);
    }
  }
  if (!Number.isFinite(bounds.minTime)) {
    return undefined;
  }
  return { maxTime: bounds.maxTime, minTime: bounds.minTime };
};

const resolveComposedXDomain = (
  data: readonly Readonly<ChartDatum>[],
  xDataKey: string,
  projectionConfigs: readonly ProjectionLineConfig[],
): [number, number] => {
  const bounds = findTimeBounds(data, xDataKey);
  const minTime = bounds?.minTime ?? 0;
  let maxTime = bounds?.maxTime ?? 0;
  if (projectionConfigs.length > 0 && Number.isFinite(maxTime)) {
    maxTime = mergeProjectionXDomainMax(maxTime, projectionConfigs);
  }
  return [minTime, maxTime];
};

interface ProjectionStrokeFallbacks {
  readonly gradientEnd: string;
  readonly stroke: string;
  readonly strokeWidth: number;
}

interface ProjectionStrokeOptions {
  readonly gradientEnd: string;
  readonly gradientStart: string;
  readonly stroke: string;
  readonly strokeWidth: number;
}

interface ProjectionMarkerFallbacks {
  readonly endpointRadius: number;
}

interface ProjectionMarkerOptions {
  readonly className: string;
  readonly curveKind: "bezier" | "linear";
  readonly endpointRadius: number;
  readonly showEndMarker: boolean;
  readonly strokeDasharray: string;
  readonly strokeOpacity: number;
}

const resolveProjectionStrokeStyle = (proj: Readonly<ChartDatum>): "gradient" | "solid" => {
  const rawStrokeStyle: unknown = proj.strokeStyle;
  return rawStrokeStyle === "gradient" || rawStrokeStyle === "solid" ? rawStrokeStyle : "solid";
};

const resolveProjectionEndMarkerVisible = (proj: Readonly<ChartDatum>): boolean => {
  const rawShowEndMarker: unknown = proj.showEndMarker;
  const rawShowEndpoints: unknown = proj.showEndpoints;
  let showEndMarker = true;
  if (isBoolean(rawShowEndMarker)) {
    showEndMarker = rawShowEndMarker;
  } else if (isBoolean(rawShowEndpoints)) {
    showEndMarker = rawShowEndpoints;
  } else {
    // Neither flag is a boolean: keep the default visible marker.
  }
  return showEndMarker;
};

const resolveProjectionStrokeOptions = (
  proj: Readonly<ChartDatum>,
  fallbacks: Readonly<ProjectionStrokeFallbacks>,
): ProjectionStrokeOptions => {
  const stroke = isString(proj.stroke) ? proj.stroke : fallbacks.stroke;
  const gradientStart = isString(proj.gradientStart) ? proj.gradientStart : stroke;
  const gradientEnd = isString(proj.gradientEnd) ? proj.gradientEnd : fallbacks.gradientEnd;
  const strokeWidth = isNumber(proj.strokeWidth) ? proj.strokeWidth : fallbacks.strokeWidth;
  return { gradientEnd, gradientStart, stroke, strokeWidth };
};

const resolveProjectionMarkerOptions = (
  proj: Readonly<ChartDatum>,
  fallbacks: Readonly<ProjectionMarkerFallbacks>,
): ProjectionMarkerOptions => {
  const rawCurveKind: unknown = proj.curveKind;
  const curveKind = rawCurveKind === "bezier" || rawCurveKind === "linear" ? rawCurveKind : "linear";
  const endpointRadius = isNumber(proj.endpointRadius) ? proj.endpointRadius : fallbacks.endpointRadius;
  const showEndMarker = resolveProjectionEndMarkerVisible(proj);
  const className = isString(proj.className) ? proj.className : "chart-projection-line";
  const strokeDasharray = isString(proj.strokeDasharray) ? proj.strokeDasharray : "6,4";
  const strokeOpacity = isNumber(proj.strokeOpacity) ? proj.strokeOpacity : 1;
  return { className, curveKind, endpointRadius, showEndMarker, strokeDasharray, strokeOpacity };
};

export {
  applyProjectionYDomain,
  buildRowBarOffsets,
  computeComposedStackOffsets,
  computeComposedYScaleDomainMax,
  findTimeBounds,
  maxNonBarRowValue,
  resolveComposedXDomain,
  resolveProjectionEndMarkerVisible,
  resolveProjectionMarkerOptions,
  resolveProjectionStrokeOptions,
  resolveProjectionStrokeStyle,
  sumStackedBarRow,
};
export type { ProjectionMarkerFallbacks, ProjectionMarkerOptions, ProjectionStrokeFallbacks, ProjectionStrokeOptions, SeriesKeyLike, TimeBounds };
