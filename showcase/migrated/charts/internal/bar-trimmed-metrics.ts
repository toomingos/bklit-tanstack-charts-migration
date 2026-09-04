import type { ChartDatum } from "./types";

// Typeof checks live only in the predicate below; call sites use the guard.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

interface TrimmedYScale {
  readonly map: (value: number) => number;
}

interface TrimmedBarLengthParams {
  readonly yScale: TrimmedYScale;
  readonly baseline: number;
  readonly yValue: number;
}

const resolveTrimmedBarLength = (params: Readonly<TrimmedBarLengthParams>): { valuePos: number; naturalHeight: number } | undefined => {
  const valuePos = params.yScale.map(params.yValue);
  if (!Number.isFinite(valuePos)) {return undefined;}
  const naturalHeight = params.baseline - valuePos;
  if (naturalHeight <= 0) {return undefined;}
  return { naturalHeight, valuePos };
}

interface TrimmedDatumMetrics {
  readonly datum: Readonly<ChartDatum>;
  readonly xValue: string;
  readonly yValue: number;
  readonly valuePos: number;
  readonly naturalHeight: number;
}

interface TrimmedDatumMetricsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly rawY: readonly number[];
  readonly index: number;
  readonly baseline: number;
  readonly yScale: TrimmedYScale;
}

const resolveTrimmedDatumMetrics = (params: Readonly<TrimmedDatumMetricsParams>): TrimmedDatumMetrics | undefined => {
  const datum = params.data[params.index];
  const xValue = params.xValues[params.index];
  const yValue = params.rawY[params.index];
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue <= 0) {return undefined;}
  const barLength = resolveTrimmedBarLength({ baseline: params.baseline, yScale: params.yScale, yValue });
  if (barLength === undefined) {return undefined;}
  return { datum, naturalHeight: barLength.naturalHeight, valuePos: barLength.valuePos, xValue, yValue };
}

export {
  resolveTrimmedDatumMetrics,
};
export type { TrimmedDatumMetrics, TrimmedYScale };
