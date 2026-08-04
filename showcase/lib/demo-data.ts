// Deterministic seeded data generator for showcase demo components.
// Ported from bench/data.ts — same mulberry32 PRNG, same seed-key convention,
// same data shape/size behavior as the bench scenarios.
//
// Exports generators for all 16 chart types: line, area, bar, scatter,
// candlestick, composed, radar, pie, ring, gauge (arc + linear), funnel
// (horizontal + vertical), heatmap, sunburst, choropleth, sankey, liveline.
//
// Every generator is deterministic per (chart, n): same seed yields identical
// output across calls, regardless of wall-clock time or load order.

/* ------------------------------------------------------------------ */
/*  PRNG helpers (already present — DO NOT remove or re-signature)    */
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

const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  LINE / AREA / BAR  (keep existing exports verbatim)               */
/* ------------------------------------------------------------------ */

export interface DemoRow {
  date: Date;
  seriesA: number;
  seriesB: number;
  [key: string]: unknown;
}

/**
 * Time-series rows for line/area/bar scenarios. Fixed seed per (chart, n)
 * so every render of the same chart+n gets byte-identical data.
 */
export function generateTimeSeries(chart: string, n: number): DemoRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: DemoRow[] = [];
  let a = 1000 + rng() * 200;
  let b = 600 + rng() * 150;
  const start = new Date(Date.UTC(2020, 0, 1)).getTime();
  for (let i = 0; i < n; i++) {
    a += (rng() - 0.48) * 40;
    b += (rng() - 0.5) * 25;
    a = Math.max(10, a);
    b = Math.max(5, b);
    rows.push({
      date: new Date(start + i * DAY_MS),
      seriesA: Math.round(a * 100) / 100,
      seriesB: Math.round(b * 100) / 100,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  SCATTER                                                           */
/* ------------------------------------------------------------------ */

export interface DemoScatterRow {
  date: Date;
  sessions: number;
  conversions: number;
}

/** xy points for scatter scenarios. */
export function generateScatter(chart: string, n: number): DemoScatterRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: DemoScatterRow[] = [];
  const start = new Date(Date.UTC(2020, 0, 1)).getTime();
  for (let i = 0; i < n; i++) {
    const sessions = Math.round(300 + rng() * 500 + Math.sin(i / 9) * 80);
    const conversions = Math.round(
      sessions * (0.04 + rng() * 0.06) + rng() * 5,
    );
    rows.push({
      date: new Date(start + i * DAY_MS),
      sessions,
      conversions,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  CANDLESTICK (OHLC)                                                */
/* ------------------------------------------------------------------ */

export interface DemoOhlcRow {
  /** Stable per-row key (used by link marks for stable keys). */
  id: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * OHLC daily candles for candlestick scenarios.
 * Standard random-walk: open = previous close, ~50/50 up/down.
 */
export function generateCandles(chart: string, n: number): DemoOhlcRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: DemoOhlcRow[] = [];
  const start = new Date(Date.UTC(2020, 0, 1)).getTime();
  let open = 100 + rng() * 50;
  for (let i = 0; i < n; i++) {
    const step = (rng() - 0.5) * 8;
    const close = Math.max(1, open + step);
    const wickUp = rng() * 3;
    const wickDown = rng() * 3;
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(0.1, Math.min(open, close) - wickDown);
    rows.push({
      id: `candle:${i}`,
      date: new Date(start + i * DAY_MS),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });
    open = close;
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  COMPOSED                                                          */
/* ------------------------------------------------------------------ */

export interface DemoComposedRow {
  date: Date;
  bars: number;
  area: number;
  line: number;
  [key: string]: unknown;
}

/** Composed-chart rows: bar + shared area/line on the same date axis. */
export function generateComposed(chart: string, n: number): DemoComposedRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: DemoComposedRow[] = [];
  let bars = 800 + rng() * 300;
  let runRate = 900 + rng() * 250;
  const start = new Date(Date.UTC(2020, 0, 1)).getTime();
  for (let i = 0; i < n; i++) {
    bars += (rng() - 0.5) * 60;
    runRate += (rng() - 0.48) * 45;
    bars = Math.max(10, bars);
    runRate = Math.max(10, runRate);
    const roundedRunRate = Math.round(runRate * 100) / 100;
    rows.push({
      date: new Date(start + i * DAY_MS),
      bars: Math.round(bars * 100) / 100,
      area: roundedRunRate,
      line: roundedRunRate,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  RADAR                                                             */
/* ------------------------------------------------------------------ */

export interface DemoRadarMetric {
  key: string;
  label: string;
}

export interface DemoRadarSeries {
  label: string;
  values: Record<string, number>;
}

export interface DemoRadarSet {
  metrics: DemoRadarMetric[];
  data: DemoRadarSeries[];
}

const RADAR_METRICS: readonly DemoRadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
  { key: "efficiency", label: "Efficiency" },
];

function buildRadarSeries(rng: () => number, n: number): DemoRadarSeries[] {
  const data: DemoRadarSeries[] = [];
  for (let i = 0; i < n; i++) {
    const values: Record<string, number> = {};
    for (const metric of RADAR_METRICS) {
      values[metric.key] = Math.round(20 + rng() * 75);
    }
    data.push({ label: `Series ${i + 1}`, values });
  }
  return data;
}

/** Radar dataset: fixed 5 metrics, n series. n = SERIES COUNT. */
export function generateRadar(chart: string, n: number): DemoRadarSet {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return { metrics: [...RADAR_METRICS], data: buildRadarSeries(rng, n) };
}

/* ------------------------------------------------------------------ */
/*  PIE                                                               */
/* ------------------------------------------------------------------ */

export interface DemoPieSlice {
  label: string;
  value: number;
}

function buildPieSlices(rng: () => number, n: number): DemoPieSlice[] {
  const slices: DemoPieSlice[] = [];
  for (let i = 0; i < n; i++) {
    slices.push({ label: `Slice ${i + 1}`, value: Math.round(10 + rng() * 90) });
  }
  return slices;
}

/** Pie dataset: n slices, each a seeded value [10, 100). n = SLICE COUNT. */
export function generatePie(chart: string, n: number): DemoPieSlice[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildPieSlices(rng, n);
}

/* ------------------------------------------------------------------ */
/*  RING                                                              */
/* ------------------------------------------------------------------ */

export interface DemoRing {
  label: string;
  value: number;
  maxValue: number;
}

function buildRings(rng: () => number, n: number): DemoRing[] {
  const rings: DemoRing[] = [];
  for (let i = 0; i < n; i++) {
    const maxValue = Math.round(100 + rng() * 900);
    const value = Math.round(maxValue * (0.2 + rng() * 0.75));
    rings.push({ label: `Ring ${i + 1}`, value, maxValue });
  }
  return rings;
}

/** Ring dataset: n rings, each a {value, maxValue} pair. n = RING COUNT. */
export function generateRing(chart: string, n: number): DemoRing[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildRings(rng, n);
}

/* ------------------------------------------------------------------ */
/*  GAUGE (arc + linear share this generator)                         */
/* ------------------------------------------------------------------ */

export interface DemoGauge {
  value: number;
  centerValue: number;
  totalNotches: number;
}

/** Gauge dataset: one seeded reading. n = totalNotches. */
export function generateGauge(chart: string, n: number): DemoGauge {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const value = Math.round(30 + rng() * 55);
  const centerValue = Math.round(30 + rng() * 65);
  return { value, centerValue, totalNotches: n };
}

/* ------------------------------------------------------------------ */
/*  FUNNEL (horizontal + vertical share this generator)               */
/* ------------------------------------------------------------------ */

export interface DemoFunnelStage {
  label: string;
  value: number;
}

function buildFunnelStages(rng: () => number, n: number): DemoFunnelStage[] {
  const stages: DemoFunnelStage[] = [];
  let value = Math.round(8000 + rng() * 7000);
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const retention = 0.35 + rng() * 0.5;
      value = Math.round(value * retention);
    }
    stages.push({ label: `Stage ${i + 1}`, value });
  }
  return stages;
}

/** Funnel dataset: n stages tapering monotonically. n = STAGE COUNT. */
export function generateFunnel(chart: string, n: number): DemoFunnelStage[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildFunnelStages(rng, n);
}

/* ------------------------------------------------------------------ */
/*  HEATMAP (GitHub-style contribution calendar)                      */
/* ------------------------------------------------------------------ */

export interface DemoHeatmapBin {
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
/*  SUNBURST                                                          */
/* ------------------------------------------------------------------ */

export interface DemoSunburstNode {
  name: string;
  value?: number;
  color?: string;
  fill?: string;
  children?: DemoSunburstNode[];
}

function sunburstBranchingFactors(n: number): { b1: number; b2: number } {
  const b1 = Math.max(2, Math.round(Math.sqrt(Math.max(1, n))));
  const b2 = Math.max(1, Math.round(n / b1) - 1);
  return { b1, b2 };
}

function buildSunburstTree(rng: () => number, n: number): DemoSunburstNode {
  const { b1, b2 } = sunburstBranchingFactors(n);
  const children: DemoSunburstNode[] = [];
  for (let i = 0; i < b1; i++) {
    const leaves: DemoSunburstNode[] = [];
    for (let j = 0; j < b2; j++) {
      const value = Math.round(50 + rng() * 450);
      leaves.push({ name: `Leaf ${i + 1}.${j + 1}`, value });
    }
    children.push({ name: `Branch ${i + 1}`, children: leaves });
  }
  return { name: "Root", children };
}

/**
 * Sunburst dataset: depth-3 tree (root + 2 rendered rings).
 * n = approx. total arc count (branching factors rounded).
 */
export function generateSunburst(chart: string, n: number): DemoSunburstNode {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildSunburstTree(rng, n);
}

/* ------------------------------------------------------------------ */
/*  CHOROPLETH                                                        */
/* ------------------------------------------------------------------ */

import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import worldTopologyRaw from "./world-countries-110m.json";

interface WorldTopologyForNameExtract {
  objects: {
    countries: {
      geometries: Array<{ properties?: { name?: string } }>;
    };
  };
}

const worldTopoForNames = worldTopologyRaw as unknown as WorldTopologyForNameExtract;

/** All 177 country names from the vendored map asset, in file order. */
const CHOROPLETH_COUNTRY_NAMES: string[] = worldTopoForNames.objects.countries.geometries
  .map((g) => g.properties?.name)
  .filter((name): name is string => typeof name === "string");

export type DemoChoroplethValues = Record<string, number>;

function buildChoroplethValues(rng: () => number): DemoChoroplethValues {
  const values: DemoChoroplethValues = {};
  for (const name of CHOROPLETH_COUNTRY_NAMES) {
    values[name] = Math.round(rng() ** 2.4 * 5_000_000);
  }
  return values;
}

/** Choropleth value map: { countryName: value } for every country. n is nominal. */
export function generateChoroplethValues(
  chart: string,
  n: number,
): DemoChoroplethValues {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildChoroplethValues(rng);
}

export interface CountryProperties {
  name: string;
  [key: string]: unknown;
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
/*  SANKEY                                                            */
/* ------------------------------------------------------------------ */

export interface DemoSankeyNode {
  name: string;
  category?: "source" | "landing" | "outcome";
  [key: string]: unknown;
}

export interface DemoSankeyLink {
  source: number;
  target: number;
  value: number;
  [key: string]: unknown;
}

export interface DemoSankeyData {
  nodes: DemoSankeyNode[];
  links: DemoSankeyLink[];
}

/** VERBATIM from bklit-ui registry example (n=4 gate). */
const SANKEY_REGISTRY_DATA: DemoSankeyData = {
  nodes: [
    { name: "Ads" },
    { name: "Organic" },
    { name: "Landing" },
    { name: "Product" },
    { name: "Checkout" },
  ],
  links: [
    { source: 0, target: 2, value: 40 },
    { source: 1, target: 2, value: 30 },
    { source: 2, target: 3, value: 50 },
    { source: 3, target: 4, value: 35 },
  ],
};

/** VERBATIM from bklit-ui docs demo (n=33 gate, 33 links). */
const SANKEY_DOCS_DATA: DemoSankeyData = {
  nodes: [
    { name: "Organic Search", category: "source" },
    { name: "Paid Search", category: "source" },
    { name: "Paid Social", category: "source" },
    { name: "Email", category: "source" },
    { name: "Referral", category: "source" },
    { name: "Direct", category: "source" },
    { name: "Blog", category: "landing" },
    { name: "Pricing", category: "landing" },
    { name: "Product", category: "landing" },
    { name: "Docs", category: "landing" },
    { name: "Homepage", category: "landing" },
    { name: "Converted", category: "outcome" },
    { name: "Engaged", category: "outcome" },
    { name: "Bounced", category: "outcome" },
  ],
  links: [
    { source: 0, target: 6, value: 4200 },
    { source: 0, target: 9, value: 2800 },
    { source: 0, target: 7, value: 1500 },
    { source: 1, target: 7, value: 3100 },
    { source: 1, target: 8, value: 2200 },
    { source: 1, target: 6, value: 800 },
    { source: 2, target: 6, value: 2800 },
    { source: 2, target: 10, value: 1900 },
    { source: 2, target: 8, value: 600 },
    { source: 3, target: 7, value: 2100 },
    { source: 3, target: 8, value: 1400 },
    { source: 3, target: 6, value: 900 },
    { source: 4, target: 6, value: 1800 },
    { source: 4, target: 9, value: 1200 },
    { source: 4, target: 7, value: 700 },
    { source: 5, target: 10, value: 3500 },
    { source: 5, target: 7, value: 1800 },
    { source: 5, target: 8, value: 1100 },
    { source: 6, target: 11, value: 2100 },
    { source: 6, target: 12, value: 4800 },
    { source: 6, target: 13, value: 3600 },
    { source: 7, target: 11, value: 4500 },
    { source: 7, target: 12, value: 3200 },
    { source: 7, target: 13, value: 1500 },
    { source: 8, target: 11, value: 2800 },
    { source: 8, target: 12, value: 1900 },
    { source: 8, target: 13, value: 600 },
    { source: 9, target: 11, value: 800 },
    { source: 9, target: 12, value: 2400 },
    { source: 9, target: 13, value: 800 },
    { source: 10, target: 11, value: 1200 },
    { source: 10, target: 12, value: 1800 },
    { source: 10, target: 13, value: 2400 },
  ],
};

/** Gate-fixture lookup: returns hardcoded dataset for n=4 or n=33. */
export function getSankeyGateData(n: number): DemoSankeyData {
  if (n === 4) return SANKEY_REGISTRY_DATA;
  if (n === 33) return SANKEY_DOCS_DATA;
  throw new Error(
    `getSankeyGateData: no gate fixture for n=${n} (only 4 and 33 are defined)`,
  );
}

/* --- Synthetic layered-DAG generator (all n != 4,33) -------- */

const SANKEY_LAYER_NAMES = ["Source", "Landing", "Mid", "Outcome"] as const;
const SANKEY_LAYER_CATEGORIES: Array<DemoSankeyNode["category"]> = [
  "source",
  "landing",
  "landing",
  "outcome",
];

function layeredSankeyNodeCounts(n: number): [number, number, number, number] {
  const perLayer = Math.max(3, Math.round(Math.sqrt(Math.max(1, n))));
  return [perLayer, perLayer, perLayer, perLayer];
}

function layeredSankeyLinkCounts(n: number): [number, number, number] {
  const base = Math.floor(n / 3);
  const remainder = n - base * 3;
  return [
    base + (remainder > 0 ? 1 : 0),
    base + (remainder > 1 ? 1 : 0),
    base,
  ];
}

interface SankeyLayerTopology {
  nodes: DemoSankeyNode[];
  layerSizes: [number, number, number, number];
  layerStartIndex: number[];
  edgesByTransition: Array<Array<[number, number]>>;
}

function buildLayeredSankeyTopology(
  topologyRng: () => number,
  n: number,
): SankeyLayerTopology {
  const layerSizes = layeredSankeyNodeCounts(n);
  const linkCounts = layeredSankeyLinkCounts(Math.max(3, n));

  const nodes: DemoSankeyNode[] = [];
  const layerStartIndex: number[] = [];
  for (let layer = 0; layer < 4; layer++) {
    layerStartIndex.push(nodes.length);
    for (let i = 0; i < layerSizes[layer]; i++) {
      nodes.push({
        name: `${SANKEY_LAYER_NAMES[layer]} ${i + 1}`,
        category: SANKEY_LAYER_CATEGORIES[layer],
      });
    }
  }

  const edgesByTransition: Array<Array<[number, number]>> = [];
  for (let transition = 0; transition < 3; transition++) {
    const fromCount = layerSizes[transition];
    const toCount = layerSizes[transition + 1];
    const targetLinkCount = Math.max(toCount, linkCounts[transition]);

    const edges: Array<[number, number]> = [];
    for (let t = 0; t < toCount; t++) {
      edges.push([t % fromCount, t]);
    }
    while (edges.length < targetLinkCount) {
      const from = Math.floor(topologyRng() * fromCount);
      const to = Math.floor(topologyRng() * toCount);
      edges.push([from, to]);
    }
    edgesByTransition.push(edges);
  }

  return { nodes, layerSizes, layerStartIndex, edgesByTransition };
}

function buildLayeredSankeyValues(
  valuesRng: () => number,
  topology: SankeyLayerTopology,
): DemoSankeyData {
  const { nodes, layerSizes, layerStartIndex, edgesByTransition } = topology;
  const links: DemoSankeyLink[] = [];

  let supply = Array.from({ length: layerSizes[0] }, () =>
    Math.round(50 + valuesRng() * 450),
  );

  for (let transition = 0; transition < 3; transition++) {
    const fromCount = layerSizes[transition];
    const toCount = layerSizes[transition + 1];
    const fromStart = layerStartIndex[transition];
    const toStart = layerStartIndex[transition + 1];
    const edges = edgesByTransition[transition];

    const weights = edges.map(() => 0.2 + valuesRng() * 0.8);
    const weightSumByFrom = new Array(fromCount).fill(0);
    edges.forEach(([from], i) => {
      weightSumByFrom[from] += weights[i];
    });

    const nextSupply = new Array(toCount).fill(0);
    for (let i = 0; i < edges.length; i++) {
      const [from, to] = edges[i];
      const share =
        weightSumByFrom[from] > 0 ? weights[i] / weightSumByFrom[from] : 0;
      const value = Math.max(1, Math.round(supply[from] * share));
      links.push({ source: fromStart + from, target: toStart + to, value });
      nextSupply[to] += value;
    }

    supply = nextSupply;
  }

  return { nodes, links };
}

/**
 * Synthetic layered-DAG sankey dataset for any n outside the two gate
 * fixtures. 4 fixed layers, adjacent-layer-only links, true flow
 * conservation.
 */
export function generateSankey(chart: string, n: number): DemoSankeyData {
  const topologyRng = mulberry32(seedFromKey(`${chart}:${n}:topology`));
  const valuesRng = mulberry32(seedFromKey(`${chart}:${n}`));
  const topology = buildLayeredSankeyTopology(topologyRng, n);
  return buildLayeredSankeyValues(valuesRng, topology);
}

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
