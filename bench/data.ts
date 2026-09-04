// Seeded data generators: deterministic per `${chart}:${n}` so impls/runs compare identically.
// Country names only from the vendored map asset; geometry lives in choropleth-world-data.ts.
import worldCountries110mRaw from "./app/src/assets/world-countries-110m.json";

export type SeededRow = {
  date: Date;
  seriesA: number;
  seriesB: number;
};

export type SeededScatterRow = {
  date: Date;
  sessions: number;
  conversions: number;
};

export type SeededOhlcRow = {
  // Stable key for TanStack link marks (bklit ignores it).
  id: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
};

// area/line duplicate one series: bklit Area+Line share a dataKey, stroke drawn over fill.
export type SeededComposedRow = {
  date: Date;
  bars: number;
  area: number;
  line: number;
  [key: string]: unknown;
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function generateTimeSeries(chart: string, n: number): SeededRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: SeededRow[] = [];
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

export function generateScatter(chart: string, n: number): SeededScatterRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: SeededScatterRow[] = [];
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

export function generateTimeSeriesUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  const rows: SeededRow[] = [];
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

export function generateScatterUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededScatterRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  const rows: SeededScatterRow[] = [];
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

// OHLC random walk: open = prev close; wicks extend outward past the body only.
export function generateCandles(chart: string, n: number): SeededOhlcRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: SeededOhlcRow[] = [];
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
    open = close; // next candle opens where this one closed
  }
  return rows;
}

export function generateCandlesUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededOhlcRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  const rows: SeededOhlcRow[] = [];
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

export function generateComposed(chart: string, n: number): SeededComposedRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const rows: SeededComposedRow[] = [];
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

export function generateComposedUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededComposedRow[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  const rows: SeededComposedRow[] = [];
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

// Radar: n = series count at fixed 5 metrics; values in [20,95) fit bklit's [0,100] domain.
export interface SeededRadarMetric {
  key: string;
  label: string;
}

export interface SeededRadarSeries {
  label: string;
  values: Record<string, number>;
}

export interface SeededRadarSet {
  metrics: SeededRadarMetric[];
  data: SeededRadarSeries[];
}

const RADAR_METRICS: readonly SeededRadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
  { key: "efficiency", label: "Efficiency" },
];

function buildRadarSeries(
  rng: () => number,
  n: number,
): SeededRadarSeries[] {
  const data: SeededRadarSeries[] = [];
  for (let i = 0; i < n; i++) {
    const values: Record<string, number> = {};
    for (const metric of RADAR_METRICS) {
      values[metric.key] = Math.round(20 + rng() * 75); // seeded 20-95
    }
    data.push({ label: `Series ${i + 1}`, values });
  }
  return data;
}

export function generateRadar(chart: string, n: number): SeededRadarSet {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return { metrics: [...RADAR_METRICS], data: buildRadarSeries(rng, n) };
}

export function generateRadarUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededRadarSet {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return { metrics: [...RADAR_METRICS], data: buildRadarSeries(rng, n) };
}

// Pie: n = slice count; no color so bklit's default-palette path is exercised.
export interface SeededPieSlice {
  label: string;
  value: number;
}

function buildPieSlices(rng: () => number, n: number): SeededPieSlice[] {
  const slices: SeededPieSlice[] = [];
  for (let i = 0; i < n; i++) {
    slices.push({ label: `Slice ${i + 1}`, value: Math.round(10 + rng() * 90) });
  }
  return slices;
}

export function generatePie(chart: string, n: number): SeededPieSlice[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildPieSlices(rng, n);
}

export function generatePieUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededPieSlice[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildPieSlices(rng, n);
}

// Ring: n = ring count; maxValue is required (registry example omits it and breaks).
export interface SeededRing {
  label: string;
  value: number;
  maxValue: number;
}

function buildRings(rng: () => number, n: number): SeededRing[] {
  const rings: SeededRing[] = [];
  for (let i = 0; i < n; i++) {
    const maxValue = Math.round(100 + rng() * 900);
    const value = Math.round(maxValue * (0.2 + rng() * 0.75));
    rings.push({ label: `Ring ${i + 1}`, value, maxValue });
  }
  return rings;
}

export function generateRing(chart: string, n: number): SeededRing[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildRings(rng, n);
}

export function generateRingUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededRing[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildRings(rng, n);
}

// Gauge: n = totalNotches; value/centerValue are independent props (no needle).
export interface SeededGauge {
  value: number;
  centerValue: number;
  totalNotches: number;
}

export function generateGauge(chart: string, n: number): SeededGauge {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const value = Math.round(30 + rng() * 55);
  const centerValue = Math.round(30 + rng() * 65);
  return { value, centerValue, totalNotches: n };
}

export function generateGaugeUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededGauge {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  const value = Math.round(30 + rng() * 55);
  const centerValue = Math.round(30 + rng() * 65);
  return { value, centerValue, totalNotches: n };
}

// Funnel: n = stage count; monotonic taper, first stage is the percentage basis.
export interface SeededFunnelStage {
  label: string;
  value: number;
}

function buildFunnelStages(rng: () => number, n: number): SeededFunnelStage[] {
  const stages: SeededFunnelStage[] = [];
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

export function generateFunnel(chart: string, n: number): SeededFunnelStage[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildFunnelStages(rng, n);
}

export function generateFunnelUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededFunnelStage[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildFunnelStages(rng, n);
}

// Heatmap: n = week count; fixed 2026-06-30 "today" anchor (never wall-clock) for determinism.
// GUARD: n=52 takes bklit's 12-calendar-month magic path (may yield 53 columns); other n roll back.
export interface SeededHeatmapBin {
  count: number;
  bin: number;
  date: Date;
}

export interface SeededHeatmapColumn {
  bin: number;
  bins: SeededHeatmapBin[];
}

const HEATMAP_FIXED_TODAY = new Date(2026, 5, 30); // 2026-06-30
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

// Ported verbatim from bklit's resolveHeatmapWeekRange; do not diverge.
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

function buildHeatmapColumns(
  rng: () => number,
  n: number,
): SeededHeatmapColumn[] {
  const { startDate, weekCount, rangeStart } = resolveHeatmapWeekRange(
    HEATMAP_FIXED_TODAY,
    n,
  );
  const today = new Date(HEATMAP_FIXED_TODAY);
  today.setHours(0, 0, 0, 0);
  const columns: SeededHeatmapColumn[] = [];

  for (let week = 0; week < weekCount; week++) {
    // One draw/week: bklit's per-cell seed depends on week only, so it repeats per day.
    const weekBusy = rng();
    let burst = 0.85 + weekBusy * 0.3;
    if (weekBusy > 0.78) burst = 1.75;
    else if (weekBusy < 0.22) burst = 0.28;

    const bins: SeededHeatmapBin[] = [];
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

// GUARD: returned length may differ from n (n=52 magic path); read columns.length.
export function generateHeatmap(chart: string, n: number): SeededHeatmapColumn[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildHeatmapColumns(rng, n);
}

export function generateHeatmapUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededHeatmapColumn[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildHeatmapColumns(rng, n);
}

// Sunburst: n = total arcs at fixed depth 3; balanced split, total ≈ n (not exact).
export interface SeededSunburstNode {
  name: string;
  value?: number;
  color?: string;
  fill?: string;
  children?: SeededSunburstNode[];
}

function sunburstBranchingFactors(n: number): { b1: number; b2: number } {
  const b1 = Math.max(2, Math.round(Math.sqrt(Math.max(1, n))));
  const b2 = Math.max(1, Math.round(n / b1) - 1);
  return { b1, b2 };
}

function buildSunburstTree(rng: () => number, n: number): SeededSunburstNode {
  const { b1, b2 } = sunburstBranchingFactors(n);
  const children: SeededSunburstNode[] = [];
  for (let i = 0; i < b1; i++) {
    const leaves: SeededSunburstNode[] = [];
    for (let j = 0; j < b2; j++) {
      const value = Math.round(50 + rng() * 450);
      leaves.push({ name: `Leaf ${i + 1}.${j + 1}`, value });
    }
    children.push({ name: `Branch ${i + 1}`, children: leaves });
  }
  return { name: "Root", children };
}

export function generateSunburst(chart: string, n: number): SeededSunburstNode {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildSunburstTree(rng, n);
}

// Sunburst update: same names (stable arc ids), fresh leaf values per tick.
export function generateSunburstUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededSunburstNode {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildSunburstTree(rng, n);
}

// Choropleth: keyed by country name (the join key both impls use); values right-skewed [0,5M).
// GUARD: n is nominal (fixed ~177 countries); the (chart,n) seed key is kept for consistency.
const worldTopology = worldCountries110mRaw as unknown as {
  objects: {
    countries: {
      geometries: Array<{ properties?: { name?: string } }>;
    };
  };
};

const CHOROPLETH_COUNTRY_NAMES: string[] = worldTopology.objects.countries.geometries
  .map((g) => g.properties?.name)
  .filter((name): name is string => typeof name === "string");

export type SeededChoroplethValues = Record<string, number>;

function buildChoroplethValues(rng: () => number): SeededChoroplethValues {
  const values: SeededChoroplethValues = {};
  for (const name of CHOROPLETH_COUNTRY_NAMES) {
    values[name] = Math.round(rng() ** 2.4 * 5_000_000);
  }
  return values;
}

export function generateChoroplethValues(chart: string, n: number): SeededChoroplethValues {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildChoroplethValues(rng);
}

// Choropleth update: same keys (stable feature keys), fresh values per tick.
export function generateChoroplethValuesUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededChoroplethValues {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildChoroplethValues(rng);
}

// Sankey: n = link count; n=4/33 are verbatim bklit fixtures (n=4 keeps the missing-category bug).
// All other n use the synthetic layered DAG below, not a parity fixture.

export interface SeededSankeyNode {
  name: string;
  category?: "source" | "landing" | "outcome";
  // Index signature required for assignability to bklit's SankeyNodeDatum.
  [key: string]: unknown;
}

export interface SeededSankeyLink {
  source: number;
  target: number;
  value: number;
  // Index signature required for assignability to bklit's SankeyLinkDatum.
  [key: string]: unknown;
}

export interface SeededSankeyData {
  nodes: SeededSankeyNode[];
  links: SeededSankeyLink[];
}

// Verbatim bklit registry fixture (n=4); do not add the missing categories.
const SANKEY_REGISTRY_DATA: SeededSankeyData = {
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

// Verbatim bklit docs analyticsData (n=33).
const SANKEY_DOCS_DATA: SeededSankeyData = {
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

// Gate-fixture lookup: only n=4/33 exist; all other n use generateSankey.
export function getSankeyGateData(n: number): SeededSankeyData {
  if (n === 4) return SANKEY_REGISTRY_DATA;
  if (n === 33) return SANKEY_DOCS_DATA;
  throw new Error(
    `getSankeyGateData: no gate fixture for n=${n} (only 4 and 33 are defined)`,
  );
}

// Synthetic sankey: 4 layers, adjacent-only links, flow-conserving; topology/values use split seeds.
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
  nodes: SeededSankeyNode[];
  layerSizes: [number, number, number, number];
  layerStartIndex: number[];
  /** Per transition, `[fromIndexWithinLayer, toIndexWithinLayer]` pairs. */
  edgesByTransition: Array<Array<[number, number]>>;
}

const SANKEY_LAYER_NAMES = ["Source", "Landing", "Mid", "Outcome"] as const;
const SANKEY_LAYER_CATEGORIES: Array<SeededSankeyNode["category"]> = [
  "source",
  "landing",
  "landing",
  "outcome",
];

function buildLayeredSankeyTopology(
  topologyRng: () => number,
  n: number,
): SankeyLayerTopology {
  const layerSizes = layeredSankeyNodeCounts(n);
  const linkCounts = layeredSankeyLinkCounts(Math.max(3, n));

  const nodes: SeededSankeyNode[] = [];
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

    // Coverage: every target node gets >=1 inbound edge before extra random edges.
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
): SeededSankeyData {
  const { nodes, layerSizes, layerStartIndex, edgesByTransition } = topology;
  const links: SeededSankeyLink[] = [];

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

export function generateSankey(chart: string, n: number): SeededSankeyData {
  const topologyRng = mulberry32(seedFromKey(`${chart}:${n}:topology`));
  const valuesRng = mulberry32(seedFromKey(`${chart}:${n}`));
  const topology = buildLayeredSankeyTopology(topologyRng, n);
  return buildLayeredSankeyValues(valuesRng, topology);
}

// Sankey update: same topology/identity, fresh values only (topology change would reflow layout).
export function generateSankeyUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededSankeyData {
  if (n === 4 || n === 33) {
    const base = getSankeyGateData(n);
    const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
    return {
      nodes: base.nodes,
      links: base.links.map((link) => ({
        ...link,
        value: Math.round(50 + rng() * 4950),
      })),
    };
  }
  const topologyRng = mulberry32(seedFromKey(`${chart}:${n}:topology`));
  const valuesRng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  const topology = buildLayeredSankeyTopology(topologyRng, n);
  return buildLayeredSankeyValues(valuesRng, topology);
}

// LiveLine: price-walk constants verbatim from bklit's useLiveData demo; n = seed points = window.
// GUARD: n=30 keeps the demo's window(30s)/cutoff(60s); other n derive window=n*0.6s, cutoff=2x.
export interface SeededLiveLinePoint {
  time: number;
  value: number;
}

const LIVELINE_INITIAL_PRICE = 142.5;
const LIVELINE_INTERVAL_SEC = 0.6;

export function liveLineWindowSecs(n: number): number {
  return n === 30 ? 30 : n * LIVELINE_INTERVAL_SEC;
}

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

// Walk cache: one continuous stream per n, grown lazily; callers still see pure (n,tick)->value.
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

// Seed points end one interval before nowSec; only values are seed-stable, times use wall clock.
export function getLiveLineSeed(
  n: number,
  nowSec: number = Date.now() / 1000,
): SeededLiveLinePoint[] {
  const values = ensureLiveLineWalkLength(n, n);
  const points: SeededLiveLinePoint[] = [];
  for (let k = 0; k < n; k++) {
    const i = n - k;
    points.push({ time: nowSec - i * LIVELINE_INTERVAL_SEC, value: values[k] });
  }
  return points;
}

// tick=1 matches the demo's first setInterval firing.
export function liveLineTickValue(n: number, tick: number): number {
  const values = ensureLiveLineWalkLength(n, n + tick);
  return values[n + tick - 1];
}
