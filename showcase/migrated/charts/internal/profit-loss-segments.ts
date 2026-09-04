import type { ChartDatum } from "./types";

type SegmentSign = "positive" | "negative";

interface ProfitLossSegment {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly isPositive: boolean;
}

const isNumber = (value: unknown): value is number => typeof value === "number";

const resolveSign = (value: number, fallback: SegmentSign): SegmentSign => {
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return fallback;
}

const findInitialSign = (data: readonly Readonly<ChartDatum>[], dataKey: string): SegmentSign => {
  for (const row of data) {
    const value: unknown = row[dataKey];
    if (isNumber(value)) {
      if (value > 0) {
        return "positive";
      }
      if (value < 0) {
        return "negative";
      }
    }
  }
  return "positive";
}

interface InterpolateZeroCrossingParams {
  readonly prevRow: Readonly<ChartDatum>;
  readonly nextRow: Readonly<ChartDatum>;
  readonly dataKey: string;
  readonly xDataKey: string;
  readonly xAccessor: (row: Readonly<ChartDatum>) => Date;
  readonly prevValue: number;
  readonly nextValue: number;
}

const interpolateZeroCrossing = ({
  prevRow,
  nextRow,
  dataKey,
  xDataKey,
  xAccessor,
  prevValue,
  nextValue,
}: Readonly<InterpolateZeroCrossingParams>): ChartDatum => {
  const ratio = prevValue / (prevValue - nextValue);
  const start = xAccessor(prevRow).getTime();
  const end = xAccessor(nextRow).getTime();
  const crossDate = new Date(start + ratio * (end - start));

  return {
    ...prevRow,
    [xDataKey]: crossDate,
    [dataKey]: 0,
  };
}

interface ProfitLossScanState {
  readonly segments: ProfitLossSegment[];
  currentSegment: Readonly<ChartDatum>[];
  currentSign: SegmentSign;
}

const closeActiveSegment = (state: ProfitLossScanState): void => {
  if (state.currentSegment.length === 0) {
    return;
  }
  state.segments.push({
    data: state.currentSegment,
    isPositive: state.currentSign === "positive",
  });
}

interface CrossingSegmentParams {
  readonly cross: Readonly<ChartDatum>;
  readonly nextRow: Readonly<ChartDatum>;
  readonly nextValue: number;
}

const appendCrossingSegment = (state: ProfitLossScanState, params: Readonly<CrossingSegmentParams>): void => {
  state.currentSegment.push(params.cross);
  closeActiveSegment(state);
  state.currentSegment = [params.cross, params.nextRow];
  state.currentSign = resolveSign(params.nextValue, state.currentSign);
}

const appendContinuingRow = (state: ProfitLossScanState, nextRow: Readonly<ChartDatum>, nextValue: number | undefined): void => {
  state.currentSegment.push(nextRow);
  if (nextValue !== undefined && nextValue !== 0) {
    state.currentSign = resolveSign(nextValue, state.currentSign);
  }
}

const isSignCrossing = (prevValue: number, nextValue: number): boolean => prevValue !== 0 && nextValue !== 0 && Math.sign(prevValue) !== Math.sign(nextValue);

interface AdvancePairParams {
  readonly prevRow: Readonly<ChartDatum>;
  readonly nextRow: Readonly<ChartDatum>;
  readonly dataKey: string;
  readonly xDataKey: string;
  readonly xAccessor: (row: Readonly<ChartDatum>) => Date;
}

const advanceProfitLossPair = (state: ProfitLossScanState, params: Readonly<AdvancePairParams>): void => {
  const prevValue: unknown = params.prevRow[params.dataKey];
  const nextValue: unknown = params.nextRow[params.dataKey];
  if (isNumber(prevValue) && isNumber(nextValue) && isSignCrossing(prevValue, nextValue)) {
    const cross = interpolateZeroCrossing({ dataKey: params.dataKey, nextRow: params.nextRow, nextValue, prevRow: params.prevRow, prevValue, xAccessor: params.xAccessor, xDataKey: params.xDataKey });
    appendCrossingSegment(state, { cross, nextRow: params.nextRow, nextValue });
    return;
  }
  appendContinuingRow(state, params.nextRow, isNumber(nextValue) ? nextValue : undefined);
}

interface ScanProfitLossRowsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly dataKey: string;
  readonly xDataKey: string;
  readonly xAccessor: (row: Readonly<ChartDatum>) => Date;
  readonly firstPoint: Readonly<ChartDatum>;
}

const scanProfitLossRows = ({ data, dataKey, xDataKey, xAccessor, firstPoint }: Readonly<ScanProfitLossRowsParams>): ProfitLossScanState => {
  const state: ProfitLossScanState = {
    currentSegment: [firstPoint],
    currentSign: findInitialSign(data, dataKey),
    segments: [],
  };
  for (let segIndex = 0; segIndex < data.length - 1; segIndex += 1) {
    const prevRow = data.at(segIndex);
    const nextRow = data.at(segIndex + 1);
    if (prevRow && nextRow) {
      advanceProfitLossPair(state, { dataKey, nextRow, prevRow, xAccessor, xDataKey });
    }
  }
  return state;
}

const splitProfitLossSegments = ({
  data,
  dataKey,
  xDataKey = "date",
  xAccessor,
}: {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly dataKey: string;
  readonly xDataKey?: string;
  readonly xAccessor: (row: Readonly<ChartDatum>) => Date;
}): ProfitLossSegment[] => {
  if (data.length === 0) {
    return [];
  }
  const firstPoint = data.at(0);
  if (!firstPoint) {
    return [];
  }
  const state = scanProfitLossRows({ data, dataKey, firstPoint, xAccessor, xDataKey });
  closeActiveSegment(state);
  return state.segments;
}

export { splitProfitLossSegments };
export type { ProfitLossSegment };
