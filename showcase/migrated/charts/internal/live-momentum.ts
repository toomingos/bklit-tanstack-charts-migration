import type { ChartDatum } from "./series-config-types";

type Momentum = "up" | "down" | "flat";

/** Minimum samples before judging momentum; the tail window covers the same span. */
const MOMENTUM_MIN_SAMPLES = 5;
const MOMENTUM_TAIL_SAMPLES = 5;
/** Tail delta must exceed this fraction of the lookback range to count as up/down. */
const MOMENTUM_DELTA_THRESHOLD_FACTOR = 0.12;

interface DatumRangeScan {
  readonly dataKey: string;
  readonly end: number;
  readonly source: readonly Readonly<ChartDatum>[];
  readonly start: number;
}

const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";

const scanDatumRange = (scan: Readonly<DatumRangeScan>): number => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = scan.start; index < scan.end; index += 1) {
    const rawValue = scan.source[index]?.[scan.dataKey];
    if (isNumber(rawValue)) {
      if (rawValue < min) {min = rawValue;}
      if (rawValue > max) {max = rawValue;}
    }
  }
  return max - min;
};

interface TailDeltaRead {
  readonly dataKey: string;
  readonly from: number;
  readonly source: readonly Readonly<ChartDatum>[];
}

const readTailDelta = (read: Readonly<TailDeltaRead>): number => {
  const firstRaw: unknown = read.source[read.from][read.dataKey];
  const lastRaw: unknown = read.source.at(-1)?.[read.dataKey];
  const first = isNumber(firstRaw) ? firstRaw : 0;
  const last = isNumber(lastRaw) ? lastRaw : 0;
  return last - first;
};

const classifyMomentum = (delta: number, threshold: number): Momentum => {
  if (delta > threshold) {return "up";}
  if (delta < -threshold) {return "down";}
  return "flat";
};

/** Default lookback window for momentum detection, in samples. */
const MOMENTUM_DEFAULT_LOOKBACK = 20;

const detectMomentum = (data: readonly Readonly<ChartDatum>[], dataKey: string, lookback = MOMENTUM_DEFAULT_LOOKBACK): Momentum => {
  if (data.length < MOMENTUM_MIN_SAMPLES) {return "flat";}
  const start = Math.max(0, data.length - lookback);
  const range = scanDatumRange({ dataKey, end: data.length, source: data, start });
  if (range === 0) {return "flat";}
  const tailStart = Math.max(start, data.length - MOMENTUM_TAIL_SAMPLES);
  const delta = readTailDelta({ dataKey, from: tailStart, source: data });
  const threshold = range * MOMENTUM_DELTA_THRESHOLD_FACTOR;
  return classifyMomentum(delta, threshold);
};

export { detectMomentum };
export type { Momentum };
