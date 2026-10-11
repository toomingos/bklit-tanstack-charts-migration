// Deterministic seeded data for the showcase demos (mulberry32 PRNG, seed-key convention from the retired bench/data.ts):
// heatmap calendar, world countries (choropleth) and the liveline price walk.
// Every generator is deterministic per (chart, n), regardless of wall-clock time or load order.

/* ------------------------------------------------------------------ */
/*  PRNG helpers                                                      */
/* ------------------------------------------------------------------ */

/** mulberry32 — small, fast, deterministic 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns a `${chart}:${n}` style string key into a stable 32-bit seed. */
function seedFromKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/*  HEATMAP (GitHub-style contribution calendar)                      */
/* ------------------------------------------------------------------ */

interface DemoHeatmapBin {
  count: number;
  bin: number;
  date: Date;
}

export interface DemoHeatmapColumn {
  bin: number;
  bins: DemoHeatmapBin[];
}

/** Fixed "today" anchor — matches bench/data.ts for determinism. */
const HEATMAP_FIXED_TODAY = new Date(2026, 5, 30);
const HEATMAP_WEEKS_ONE_YEAR = 52;
const HEATMAP_MS_PER_WEEK = 24 * 60 * 60 * 1000 * 7;

function heatmapCalendarRangeStart(today: Date, months: number): Date {
  const monthOffset = months === 6 ? months : months - 1;
  const start = new Date(
    today.getFullYear(),
    today.getMonth() - monthOffset,
    1,
  );
  start.setHours(0, 0, 0, 0);
  return start;
}

function heatmapWeekStartSunday(date: Date): Date {
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

function heatmapWeekCount(startSunday: Date, endDate: Date): number {
  const endSunday = heatmapWeekStartSunday(endDate);
  return (
    Math.floor(
      (endSunday.getTime() - startSunday.getTime()) / HEATMAP_MS_PER_WEEK,
    ) + 1
  );
}

function countHeatmapWeekDaysOnOrAfter(weekStart: Date, threshold: Date): number {
  const day = new Date(weekStart);
  day.setHours(0, 0, 0, 0);
  const cutoff = new Date(threshold);
  cutoff.setHours(0, 0, 0, 0);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (day >= cutoff) count++;
    day.setDate(day.getDate() + 1);
  }
  return count;
}

function heatmapWeekStartAlignedToRange(
  rangeStart: Date,
  minDaysInFirstWeek = 4,
): Date {
  const startDate = heatmapWeekStartSunday(rangeStart);
  const weekEnd = new Date(startDate);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (rangeStart >= startDate && rangeStart <= weekEnd) {
    return startDate;
  }

  while (
    countHeatmapWeekDaysOnOrAfter(startDate, rangeStart) < minDaysInFirstWeek
  ) {
    startDate.setDate(startDate.getDate() + 7);
  }

  return startDate;
}

interface HeatmapWeekRange {
  startDate: Date;
  weekCount: number;
  rangeStart: Date | null;
}

function resolveHeatmapWeekRange(
  today: Date,
  weeks: number = HEATMAP_WEEKS_ONE_YEAR,
): HeatmapWeekRange {
  const endDate = new Date(today);
  endDate.setHours(0, 0, 0, 0);

  if (weeks === HEATMAP_WEEKS_ONE_YEAR) {
    const rangeStart = heatmapCalendarRangeStart(endDate, 12);
    const startDate = heatmapWeekStartAlignedToRange(rangeStart);
    return {
      startDate,
      weekCount: heatmapWeekCount(startDate, endDate),
      rangeStart,
    };
  }

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (weeks - 1) * 7);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  startDate.setHours(0, 0, 0, 0);

  return { startDate, weekCount: weeks, rangeStart: null };
}

function buildHeatmapColumns(rng: () => number, n: number): DemoHeatmapColumn[] {
  const { startDate, weekCount, rangeStart } = resolveHeatmapWeekRange(
    HEATMAP_FIXED_TODAY,
    n,
  );
  const today = new Date(HEATMAP_FIXED_TODAY);
  today.setHours(0, 0, 0, 0);
  const columns: DemoHeatmapColumn[] = [];

  for (let week = 0; week < weekCount; week++) {
    const weekBusy = rng();
    let burst = 0.85 + weekBusy * 0.3;
    if (weekBusy > 0.78) burst = 1.75;
    else if (weekBusy < 0.22) burst = 0.28;

    const bins: DemoHeatmapBin[] = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + week * 7 + day);

      const isOutOfRange =
        date.getTime() > today.getTime() ||
        (rangeStart !== null && date.getTime() < rangeStart.getTime());

      let count = 0;
      if (!isOutOfRange) {
        const isWeekend = day === 0 || day === 6;
        const activityRandom = rng();
        const activityChance = Math.min(
          0.9,
          (isWeekend ? 0.18 : 0.48) * burst + activityRandom * 0.12,
        );
        const gate = rng();
        if (gate <= activityChance) {
          const level = rng();
          if (level < 0.45) count = 1;
          else if (level < 0.7) count = 2;
          else if (level < 0.85) count = 3;
          else if (level < 0.93) count = 4;
          else if (level < 0.97) count = 5;
          else if (level < 0.99) count = 6;
          else if (level < 0.997) count = 7;
          else count = 8;
        }
      }

      bins.push({ count, bin: day, date });
    }

    columns.push({ bin: week, bins });
  }

  return columns;
}

/**
 * Heatmap dataset: n week columns against the fixed 2026-06-30 anchor.
 * n = WEEK COUNT. Actual column count may differ from n for n=52
 * (calendar-driven resolution).
 */
export function generateHeatmap(chart: string, n: number): DemoHeatmapColumn[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildHeatmapColumns(rng, n);
}

/* ------------------------------------------------------------------ */
/*  CHOROPLETH                                                        */
/* ------------------------------------------------------------------ */

import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import worldTopologyRaw from "./world-countries-110m.json";

export interface CountryProperties {
  name: string;
  // TopoJSON country properties are plain JSON scalars; the charts consume them through
  // ChoroplethFeatureProperties, whose index signature is narrowed to the same union.
  [key: string]: string | number | boolean | null | undefined;
}

// --- TopoJSON -> GeoJSON conversion (matches bench choropleth-world-data.ts)
//
// The imported JSON is a TopoJSON GeometryCollection of countries. We call
// topojson-client's `feature()` to convert it to a GeoJSON FeatureCollection.
// TypeScript strict overloads don't resolve from the JSON module's inferred
// shape, so we cast through unknown (same pattern bench/ uses).

const _topoRaw = worldTopologyRaw as unknown as { objects: Record<string, unknown> };
const _countriesObj = _topoRaw.objects["countries"];

/**
 * All 177 world-atlas countries as a GeoJSON FeatureCollection, converted
 * once at module load via topojson-client. properties.name is the join key.
 */
export const WORLD_COUNTRIES = (
  feature as (topology: unknown, object: unknown) => unknown
)(_topoRaw, _countriesObj) as unknown as FeatureCollection<Geometry, CountryProperties>;

/* ------------------------------------------------------------------ */
/*  LIVELINE (streaming price ticker)                                  */
/* ------------------------------------------------------------------ */

export interface DemoLiveLinePoint {
  time: number;
  value: number;
}

const LIVELINE_INITIAL_PRICE = 142.5;
/** 600ms, matches the demo's interval. */
const LIVELINE_INTERVAL_SEC = 0.6;

/** `LiveLineChart`'s `window` prop (seconds) for a given n. */
export function liveLineWindowSecs(n: number): number {
  return n === 30 ? 30 : n * LIVELINE_INTERVAL_SEC;
}

/** Data-retention cutoff (seconds) — mirrors the demo hook's cutoff filter. */
export function liveLineCutoffSecs(n: number): number {
  return n === 30 ? 60 : liveLineWindowSecs(n) * 2;
}

interface LiveLineWalkState {
  price: number;
  momentum: number;
}

function liveLineSeedStep(rng: () => number, state: LiveLineWalkState): number {
  state.momentum = state.momentum * 0.92 + (rng() - 0.48) * 0.012;
  state.price *= 1 + state.momentum;
  state.price = Math.max(state.price, 1);
  return Math.round(state.price * 100) / 100;
}

function liveLineTickStep(rng: () => number, state: LiveLineWalkState): number {
  state.momentum = state.momentum * 0.88 + (rng() - 0.48) * 0.008;
  state.momentum *= 0.995;
  state.price *= 1 + state.momentum;
  state.price = Math.max(state.price, 1);
  return Math.round(state.price * 100) / 100;
}

/** Per-n memoized walk cache: one continuous RNG stream + walk state per n. */
const liveLineWalkCache = new Map<
  number,
  { rng: () => number; state: LiveLineWalkState; values: number[] }
>();

function getLiveLineWalk(n: number) {
  let entry = liveLineWalkCache.get(n);
  if (!entry) {
    entry = {
      rng: mulberry32(seedFromKey(`liveline:${n}`)),
      state: { price: LIVELINE_INITIAL_PRICE, momentum: 0 },
      values: [],
    };
    liveLineWalkCache.set(n, entry);
  }
  return entry;
}

function ensureLiveLineWalkLength(n: number, length: number): number[] {
  const entry = getLiveLineWalk(n);
  while (entry.values.length < n) {
    entry.values.push(liveLineSeedStep(entry.rng, entry.state));
  }
  while (entry.values.length < length) {
    entry.values.push(liveLineTickStep(entry.rng, entry.state));
  }
  return entry.values;
}

/**
 * Seeded initial points for a LiveLine scenario mount: n points, seed-phase
 * math verbatim from the demo. `time` fields are spaced
 * `LIVELINE_INTERVAL_SEC` apart and end one interval before `nowSec`.
 */
export function getLiveLineSeed(
  n: number,
  nowSec: number = Date.now() / 1000,
): DemoLiveLinePoint[] {
  const values = ensureLiveLineWalkLength(n, n);
  const points: DemoLiveLinePoint[] = [];
  for (let k = 0; k < n; k++) {
    const i = n - k;
    points.push({ time: nowSec - i * LIVELINE_INTERVAL_SEC, value: values[k] });
  }
  return points;
}

/**
 * The `tick`-th (1-indexed) live value continuing the SAME seeded stream
 * `getLiveLineSeed(n)` ends on. `tick=1` is the first post-seed live tick.
 */
export function liveLineTickValue(n: number, tick: number): number {
  const values = ensureLiveLineWalkLength(n, n + tick);
  return values[n + tick - 1];
}
