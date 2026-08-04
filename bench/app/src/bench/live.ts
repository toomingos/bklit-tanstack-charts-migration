// window.__benchLiveTick() support: appends one new deterministic point and
// drops the oldest, keeping a fixed-length sliding window of n (typical
// live-chart behavior). M3b (sustained update throughput) itself is stubbed
// in bench/run.mjs (see TODO there) -- this only fulfills the instrumentation
// contract's requirement that `__benchLiveTick` exist and do something real.
import {
  mulberry32,
  seedFromKey,
  type SeededRow,
  type SeededScatterRow,
  type SeededOhlcRow,
  type SeededComposedRow,
} from "../../../data";

const DAY_MS = 24 * 60 * 60 * 1000;

export function appendLiveRow(
  chart: string,
  n: number,
  prev: SeededRow[],
  tick: number,
): SeededRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:live:${tick}`));
  const last = prev[prev.length - 1];
  const base = last ?? { date: new Date(), seriesA: 1000, seriesB: 600 };
  const row: SeededRow = {
    date: new Date(base.date.getTime() + DAY_MS),
    seriesA: Math.max(10, base.seriesA + (rng() - 0.48) * 40),
    seriesB: Math.max(5, base.seriesB + (rng() - 0.5) * 25),
  };
  const next = prev.length >= n ? prev.slice(1) : prev.slice();
  next.push(row);
  return next;
}

/** OHLC counterpart of `appendLiveRow`/`appendLiveScatterRow` -- one new
 * candle whose open continues the previous candle's close (same random-walk
 * convention as `generateCandles`), oldest candle dropped once the window
 * hits length n. */
export function appendLiveCandle(
  chart: string,
  n: number,
  prev: SeededOhlcRow[],
  tick: number,
): SeededOhlcRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:live:${tick}`));
  const last = prev[prev.length - 1];
  const open = last?.close ?? 100;
  const baseDate = last?.date ?? new Date();
  const step = (rng() - 0.5) * 8;
  const close = Math.max(1, open + step);
  const wickUp = rng() * 3;
  const wickDown = rng() * 3;
  const high = Math.max(open, close) + wickUp;
  const low = Math.max(0.1, Math.min(open, close) - wickDown);
  const row: SeededOhlcRow = {
    id: `candle:live:${tick}`,
    date: new Date(baseDate.getTime() + DAY_MS),
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    close: Math.round(close * 100) / 100,
  };
  const next = prev.length >= n ? prev.slice(1) : prev.slice();
  next.push(row);
  return next;
}

/** Composed-chart counterpart of `appendLiveRow` -- one new row with an
 * independent `bars` walk and a shared `area`/`line` walk (mirrors
 * `generateComposed`'s numerically-identical area/line convention), oldest
 * row dropped once the window hits length n. */
export function appendLiveComposed(
  chart: string,
  n: number,
  prev: SeededComposedRow[],
  tick: number,
): SeededComposedRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:live:${tick}`));
  const last = prev[prev.length - 1];
  const base = last ?? { date: new Date(), bars: 800, area: 900, line: 900 };
  const bars = Math.max(10, base.bars + (rng() - 0.5) * 60);
  const runRate = Math.max(10, base.line + (rng() - 0.48) * 45);
  const roundedRunRate = Math.round(runRate * 100) / 100;
  const row: SeededComposedRow = {
    date: new Date(base.date.getTime() + DAY_MS),
    bars: Math.round(bars * 100) / 100,
    area: roundedRunRate,
    line: roundedRunRate,
  };
  const next = prev.length >= n ? prev.slice(1) : prev.slice();
  next.push(row);
  return next;
}

export function appendLiveScatterRow(
  chart: string,
  n: number,
  prev: SeededScatterRow[],
  tick: number,
): SeededScatterRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:live:${tick}`));
  const last = prev[prev.length - 1];
  const base = last ?? { date: new Date(), sessions: 400, conversions: 20 };
  const sessions = Math.round(300 + rng() * 500);
  const row: SeededScatterRow = {
    date: new Date(base.date.getTime() + DAY_MS),
    sessions,
    conversions: Math.round(sessions * (0.04 + rng() * 0.06) + rng() * 5),
  };
  const next = prev.length >= n ? prev.slice(1) : prev.slice();
  next.push(row);
  return next;
}
