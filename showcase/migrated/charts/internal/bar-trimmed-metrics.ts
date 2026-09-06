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
  readonly minBarHeight?: number;
}

interface TrimmedBarLength {
  readonly valuePos: number;
  readonly naturalHeight: number;
  readonly isFloored: boolean;
}

// Minimum visible height (legacy `<Bar minBarHeight>` parity).
// Floors short/zero bars so they stay visible, growing up from the baseline.
const resolveTrimmedBarLength = (params: Readonly<TrimmedBarLengthParams>): TrimmedBarLength | undefined => {
  const valuePos = params.yScale.map(params.yValue);
  if (!Number.isFinite(valuePos)) {return undefined;}
  const rawHeight = params.baseline - valuePos;
  // Positive bars only, matching legacy's `value >= 0` floor guard (bar.tsx:344-352).
  const naturalHeight = rawHeight < 0 ? rawHeight : Math.max(rawHeight, params.minBarHeight ?? 0);
  if (naturalHeight <= 0) {return undefined;}
  return { isFloored: naturalHeight > rawHeight, naturalHeight, valuePos };
}

interface TrimmedDatumMetrics {
  readonly datum: Readonly<ChartDatum>;
  readonly xValue: string;
  readonly yValue: number;
  readonly valuePos: number;
  readonly naturalHeight: number;
  readonly isFloored: boolean;
}

interface TrimmedDatumMetricsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly rawY: readonly number[];
  readonly index: number;
  readonly baseline: number;
  readonly yScale: TrimmedYScale;
  readonly minBarHeight?: number;
}

const resolveTrimmedDatumMetrics = (params: Readonly<TrimmedDatumMetricsParams>): TrimmedDatumMetrics | undefined => {
  const datum = params.data[params.index];
  const xValue = params.xValues[params.index];
  const yValue = params.rawY[params.index];
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue < 0) {return undefined;}
  // Zero-value bars render only when floored visible (legacy minBarHeight parity).
  if (yValue === 0 && (params.minBarHeight ?? 0) <= 0) {return undefined;}
  const barLength = resolveTrimmedBarLength({ baseline: params.baseline, minBarHeight: params.minBarHeight, yScale: params.yScale, yValue });
  if (barLength === undefined) {return undefined;}
  return { datum, isFloored: barLength.isFloored, naturalHeight: barLength.naturalHeight, valuePos: barLength.valuePos, xValue, yValue };
}

export {
  resolveTrimmedDatumMetrics,
};
export type { TrimmedDatumMetrics, TrimmedYScale };
