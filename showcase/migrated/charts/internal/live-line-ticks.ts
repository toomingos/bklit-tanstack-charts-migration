// Live-line tick computation: nice-interval search with hysteresis plus the
// Y-tick value expansion. The hook owns the cached interval and both tick sets.
import { useMemo, useState } from "react";

// Hysteresis keeps prevInterval within [0.5x, 3x] of minGap to avoid tick flicker.
const TICK_HYSTERESIS_MIN_FACTOR = 0.5;
const TICK_HYSTERESIS_MAX_FACTOR = 3;
/** Odd divisor in the nice-tick divisor sets (ported verbatim from the legacy tick search). */
const NICE_DIVISOR_ODD = 2.5;
/** Divisor rotation sets for the nice-tick span search. */
const NICE_DIVISOR_SETS: readonly (readonly number[])[] = [
  [2, NICE_DIVISOR_ODD, 2],
  [2, 2, NICE_DIVISOR_ODD],
  [NICE_DIVISOR_ODD, 2, 2],
];
/** Decimal base for the nice-tick span search. */
const NICE_SPAN_BASE = 10;
/** Fallback y tick count when no nice span is found. */
const FALLBACK_Y_TICK_COUNT = 5;
/** Default minimum pixel gap between live y-axis ticks. */
const DEFAULT_Y_MIN_GAP_PX = 36;
/** Half-interval domain expansion when deriving live y tick values. */
const TICK_RANGE_EXPANSION_FACTOR = 0.5;
/** Decimal rounding factor for live y tick values. */
const TICK_ROUNDING_FACTOR = 1e10;

interface NiceSpanSearch {
  readonly divisors: readonly number[];
  readonly minGap: number;
  readonly pxPerUnit: number;
  readonly valRange: number;
}

const searchNiceSpan = (search: Readonly<NiceSpanSearch>): number => {
  let span = NICE_SPAN_BASE ** Math.ceil(Math.log10(search.valRange));
  let divIndex = 0;
  let divisor = search.divisors[divIndex % search.divisors.length] ?? 2;
  while ((span / divisor) * search.pxPerUnit >= search.minGap) {
    span /= divisor;
    divIndex += 1;
    divisor = search.divisors[divIndex % search.divisors.length] ?? 2;
  }
  return span;
};

interface TickHysteresisCheck {
  readonly minGap: number;
  readonly prevInterval: number;
  readonly pxPerUnit: number;
}

const keepPreviousInterval = (check: Readonly<TickHysteresisCheck>): boolean => {
  if (check.prevInterval <= 0) {return false;}
  const px = check.prevInterval * check.pxPerUnit;
  return px >= check.minGap * TICK_HYSTERESIS_MIN_FACTOR && px <= check.minGap * TICK_HYSTERESIS_MAX_FACTOR;
};

interface NiceSpanField {
  readonly divisorSets: readonly (readonly number[])[];
  readonly minGap: number;
  readonly pxPerUnit: number;
  readonly valRange: number;
}

const findBestNiceSpan = (field: Readonly<NiceSpanField>): number => {
  let best = Number.POSITIVE_INFINITY;
  for (const divs of field.divisorSets) {
    const span = searchNiceSpan({ divisors: divs, minGap: field.minGap, pxPerUnit: field.pxPerUnit, valRange: field.valRange });
    if (span < best) {best = span;}
  }
  return best;
};

interface PickNiceIntervalOptions {
  readonly chartHeight: number;
  readonly minGap: number;
  readonly prevInterval: number;
  readonly valRange: number;
}

const pickNiceInterval = (options: Readonly<PickNiceIntervalOptions>): number => {
  const { chartHeight, minGap, prevInterval, valRange } = options;
  if (valRange <= 0 || chartHeight <= 0) {return 1;}
  const pxPerUnit = chartHeight / valRange;
  if (keepPreviousInterval({ minGap, prevInterval, pxPerUnit })) {return prevInterval;}
  const best = findBestNiceSpan({ divisorSets: NICE_DIVISOR_SETS, minGap, pxPerUnit, valRange });
  return best === Number.POSITIVE_INFINITY ? valRange / FALLBACK_Y_TICK_COUNT : best;
};

interface NiceTickExpansion {
  readonly allowDecimals: boolean;
  readonly expandedMax: number;
  readonly first: number;
  readonly interval: number;
}

const expandNiceTicks = (expansion: Readonly<NiceTickExpansion>): number[] => {
  const values: number[] = [];
  for (let tickValue = expansion.first; tickValue <= expansion.expandedMax; tickValue += expansion.interval) {
    const rounded = Math.round(tickValue * TICK_ROUNDING_FACTOR) / TICK_ROUNDING_FACTOR;
    if (Number.isInteger(rounded) || expansion.allowDecimals) {values.push(rounded);}
  }
  return values;
};

interface LiveTickXScale {
  readonly domain: () => Date[];
}

interface LiveTickYScale {
  readonly domain: () => number[];
}

interface UseLiveTicksOptions {
  readonly innerHeight: number;
  readonly liveXAxis: { readonly numTicks?: number } | undefined;
  readonly liveYAxis: { readonly allowDecimals?: boolean; readonly minGap?: number } | undefined;
  readonly numXTicks: number;
  readonly xScale: LiveTickXScale;
  readonly yScale: LiveTickYScale;
}

interface LiveTickSets {
  readonly xTickValues: Date[];
  readonly yTickValues: number[];
}

const useLiveTicks = (options: Readonly<UseLiveTicksOptions>): LiveTickSets => {
  const { innerHeight, liveXAxis, liveYAxis, numXTicks, xScale, yScale } = options;
  const xTickValues = useMemo<Date[]>(() => {
    if (!liveXAxis) {return [];}
    const tickCount = liveXAxis.numTicks ?? numXTicks;
    const [start, end] = xScale.domain();
    const startMs = start.getTime();
    const endMs = end.getTime();
    const step = (endMs - startMs) / Math.max(1, tickCount - 1);
    return Array.from({ length: tickCount }, (_slot, index) => new Date(startMs + index * step));
  }, [liveXAxis, xScale, numXTicks]);

  // Hysteresis keeps the tick interval stable across frames; the cached value lives in state because it is read during render.
  const [cachedYInterval, setCachedYInterval] = useState(0);
  const yInterval = useMemo(() => {
    if (!liveYAxis) {return 0;}
    // Read the niced scale domain directly for tick sizing (legacy builds its yScale with nice:true).
    const [minVal, maxVal] = yScale.domain();
    const valRange = maxVal - minVal;
    const minGap = liveYAxis.minGap ?? DEFAULT_Y_MIN_GAP_PX;
    return pickNiceInterval({ chartHeight: innerHeight, minGap, prevInterval: cachedYInterval, valRange });
  }, [liveYAxis, yScale, innerHeight, cachedYInterval]);
  if (yInterval !== cachedYInterval && yInterval > 0) {
    setCachedYInterval(yInterval);
  }
  const yTickValues = useMemo<number[]>(() => {
    if (!liveYAxis || yInterval <= 0) {return [];}
    // Read the niced scale domain directly for tick sizing (legacy builds its yScale with nice:true).
    const [minVal, maxVal] = yScale.domain();
    if (maxVal - minVal <= 0) {return [];}
    const expandedMin = minVal - yInterval * TICK_RANGE_EXPANSION_FACTOR;
    const expandedMax = maxVal + yInterval * TICK_RANGE_EXPANSION_FACTOR;
    const first = Math.ceil(expandedMin / yInterval) * yInterval;
    return expandNiceTicks({ allowDecimals: liveYAxis.allowDecimals ?? true, expandedMax, first, interval: yInterval });
  }, [liveYAxis, yScale, yInterval]);
  return { xTickValues, yTickValues };
};

export { useLiveTicks };
export type { LiveTickSets, UseLiveTicksOptions };
