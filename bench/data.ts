// Shared seeded data generator for the bench harness.
//
// The one import in this otherwise import-free file: the vendored map asset,
// read only for its list of country names (see the Choropleth section below
// for why -- this file still does no GeoJSON/TopoJSON geometry conversion,
// keeping that concern in bench/app/src/scenarios/choropleth-world-data.ts).
import worldCountries110mRaw from "./app/src/assets/world-countries-110m.json";
//
// Deterministic: mulberry32 PRNG, fixed seed derived from `${chart}:${n}` so
// every scenario (bklit vs tanstack, any run) that asks for the same
// chart+n gets byte-identical data. This is load-bearing for both the
// benchmark medians (comparable across runs/impls) and the QA pixel-diff
// self-test (two renders of the same scenario must be pixel-identical).
//
// Shapes:
//  - line / area / bar: time-series rows `{ date: Date, seriesA, seriesB }`
//    (two numeric series, matching the canonical bklit-ui demos which all
//    plot 1-2 series over a monthly/daily date axis).
//  - scatter: xy points `{ date: Date, sessions, conversions }` (matches the
//    canonical `scatter-chart.tsx` demo which plots two dataKeys against the
//    same implicit x index/date).
//  - candlestick: OHLC rows `{ date: Date, open, high, low, close }` (plus a
//    `link`-mark-only `id`), matching the canonical `candlestick-chart.tsx`
//    demo's `OHLCDataPoint` shape.
//  - composed: rows `{ date: Date, bars, area, line }`, matching the
//    canonical `composed-chart.tsx` demo (one `SeriesBar` + one `Area`/`Line`
//    pair sharing a dataKey -- `area`/`line` are kept numerically identical
//    to reproduce that shared-dataKey quirk in the data itself).

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
  /** Stable per-row key (only consumed by the TanStack `link` marks). */
  id: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
};

/**
 * Composed rows -- one bar series, one area series, one line series, matching
 * the canonical `composed-chart.tsx` registry demo's semantic shape (`<Grid
 * horizontal /><SeriesBar dataKey="revenue".../><Area dataKey="runRate".../>
 * <Line dataKey="runRate".../>`): `bars` is bar-only, `area`/`line` are the
 * SAME underlying series duplicated onto two keys because the registry demo
 * intentionally has `Area` and `Line` share one `dataKey` ("runRate") so the
 * `Line` boundary stroke draws on top of the `Area` fill (composed-chart.tsx's
 * `upsertLineConfig` -- "Area+Line pairs share a dataKey -- keep the later
 * config"). Keeping them numerically identical here (not independently seeded)
 * is what reproduces that shared-dataKey quirk faithfully in the bench data,
 * not just in the component tree.
 */
export type SeededComposedRow = {
  date: Date;
  bars: number;
  area: number;
  line: number;
  [key: string]: unknown;
};

/** mulberry32 — small, fast, deterministic 32-bit PRNG. */
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

/** Turns a `${chart}:${n}` style string key into a stable 32-bit seed. */
export function seedFromKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Time-series rows for line/area/bar scenarios. Fixed seed per (chart, n)
 * so `bklit` and `tanstack` impls at the same n render the exact same
 * numbers (only styling/architecture differs).
 */
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

/** xy points for scatter scenarios. */
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

/**
 * Update-scenario dataset: same n, same shape, different seed suffix so it's
 * visibly a new dataset (used by `window.__benchUpdate()`).
 */
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

/**
 * OHLC (open/high/low/close) daily candles for candlestick scenarios,
 * matching the shape the canonical `candlestick-chart.tsx` demo expects
 * (`{ date, open, high, low, close }`; `id` is extra, used only by the
 * TanStack ceiling scenario's `link` marks for stable keys -- bklit ignores
 * it). Standard OHLC random-walk convention, same date-stepping as
 * `generateTimeSeries`:
 *  - open  = the PREVIOUS candle's close (continuous body chain, like a
 *    real OHLC series);
 *  - close = open plus a seeded step centered on 0 (`(rng() - 0.5) * 8`)
 *    -> ~50/50 up/down candles across a run, not skewed either direction;
 *  - high/low = max/min(open, close) extended outward by independent
 *    seeded wick lengths (wicks never point inward past the body).
 */
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

/**
 * Update-scenario dataset for candlesticks: same n, same shape, different
 * seed suffix (mirrors `generateTimeSeriesUpdate`/`generateScatterUpdate`),
 * used by `window.__benchUpdate()`.
 */
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

/**
 * Composed-chart rows: one bar series (`bars`) + one shared area/line series
 * (`area`/`line`, numerically identical -- see `SeededComposedRow`), on the
 * same date-stepping convention as `generateTimeSeries`. Independent random
 * walks for `bars` vs the area/line series (distinct rng draws), same
 * seeded-per-(chart,n) determinism contract as every other generator here.
 */
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

/**
 * Update-scenario dataset for composed charts: same n, same shape, different
 * seed suffix (mirrors `generateTimeSeriesUpdate`/`generateCandlesUpdate`),
 * used by `window.__benchUpdate()`.
 */
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

/**
 * Radar series/metric shapes -- match the REAL, correctly-typed bklit
 * `RadarMetric`/`RadarData` shapes (repos/bklit-ui/packages/ui/src/charts/
 * radar-context.tsx), verified against the docs demo
 * (repos/bklit-ui/apps/web/components/docs/radar-chart-demo.tsx). Per
 * docs/LOG.md D24, the registry example
 * (packages/ui/registry/examples/radar-chart.tsx) is BROKEN -- its data
 * doesn't satisfy `RadarData` and it passes nonexistent `fill`/
 * `fillOpacity` props to `RadarArea` -- so it is NOT the basis for this
 * generator's shape.
 *
 * `n` here is SERIES COUNT at a FIXED 5 metrics (D24: "metric count is NOT
 * a valid stress axis -- labels collide by design" past a handful of
 * spokes; gate sizes are n=1/4, n=20/50 are migrated-only structural rows).
 * Metric keys/labels are fixed and always present in every series' `values`
 * map; each value is a seeded integer in [20, 95) (bklit's radar value
 * domain is hardcoded [0, 100] with no clamping -- see D24 -- so values
 * comfortably inside that range keep every series a clean, legible polygon
 * without relying on any clamping behavior).
 */
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

/**
 * Radar dataset: fixed 5 metrics, `n` series, each series a seeded random
 * profile across those metrics. Deterministic per (chart, n), same
 * mulberry32/seedFromKey contract as every other generator here.
 */
export function generateRadar(chart: string, n: number): SeededRadarSet {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return { metrics: [...RADAR_METRICS], data: buildRadarSeries(rng, n) };
}

/**
 * Update-scenario dataset for radar: same n (series count) and the same
 * fixed 5 metrics, different tick-seeded values (mirrors
 * `generateTimeSeriesUpdate`/`generateCandlesUpdate`/`generateComposedUpdate`'s
 * `:update:${tick}` seed-suffix convention), used by `window.__benchUpdate()`.
 */
export function generateRadarUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededRadarSet {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return { metrics: [...RADAR_METRICS], data: buildRadarSeries(rng, n) };
}

/**
 * Pie slice shape -- matches the REAL bklit `PieData` shape
 * (repos/bklit-ui/packages/ui/src/charts/pie-context.tsx: `{ label, value,
 * color?, fill? }`). Per docs/LOG.md D27 the registry example
 * (registry/examples/pie-chart.tsx) is the pilot's basis (it IS type-valid,
 * unlike ring's) and its sample data omits `color` entirely -- `PieChart`
 * falls back to `defaultPieColors` (pie-context.tsx: a fixed 5-color cycle
 * over `--chart-1`..`--chart-5`) via `PieChartCore`'s `getColor`. This
 * generator mirrors that: no `color`/`fill` field, so every bench render
 * exercises the same bklit-assigned default-palette path the registry demo
 * does, cycling every 5 slices exactly like the CSS-var palette does.
 *
 * `n` here is SLICE COUNT (there is no separate "metric" axis like radar's --
 * a pie has exactly one value per slice). Each value is a seeded integer in
 * [10, 100) -- comfortably positive so every slice renders a visible,
 * non-degenerate arc regardless of `n` (d3 `pie()` only cares about relative
 * proportions, so the exact range is arbitrary, just kept legible/typical).
 */
export interface SeededPieSlice {
  label: string;
  value: number;
}

function buildPieSlices(rng: () => number, n: number): SeededPieSlice[] {
  const slices: SeededPieSlice[] = [];
  for (let i = 0; i < n; i++) {
    slices.push({ label: `Slice ${i + 1}`, value: Math.round(10 + rng() * 90) }); // seeded 10-100
  }
  return slices;
}

/**
 * Pie dataset: `n` slices, each a seeded value, no color (bklit assigns
 * palette defaults -- see `SeededPieSlice` doc above). Deterministic per
 * (chart, n), same mulberry32/seedFromKey contract as every other generator
 * here.
 */
export function generatePie(chart: string, n: number): SeededPieSlice[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildPieSlices(rng, n);
}

/**
 * Update-scenario dataset for pie: same n (slice count), different
 * tick-seeded values (mirrors every other `generate*Update`'s
 * `:update:${tick}` seed-suffix convention), used by `window.__benchUpdate()`.
 */
export function generatePieUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededPieSlice[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildPieSlices(rng, n);
}

/**
 * Ring shape -- matches the REAL bklit `RingData` shape
 * (repos/bklit-ui/packages/ui/src/charts/ring-context.tsx: `{ label, value,
 * maxValue, color? }`). Per docs/LOG.md D27, ring's registry example
 * (registry/examples/ring-chart.tsx) is TYPE-BROKEN -- it omits the REQUIRED
 * `maxValue` field (doesn't typecheck; would sweep NaN progress angles at
 * runtime) -- so `maxValue` is mandatory here, unlike radar/pie's optional
 * fields. No `color` field, same rationale as `generatePie`: bklit falls
 * back to `defaultRingColors` (ring-context.tsx, also a 5-color
 * `--chart-1`..`--chart-5` cycle) when a ring omits `color`, so the bench
 * data exercises that default-assignment path too.
 *
 * `n` here is RING COUNT (one ring per entry, analogous to pie's slice
 * count -- `RingChart`'s own concentric-radius scaling, `designOuterRadius`
 * in ring-chart.tsx, already handles arbitrarily large `n` by shrinking
 * `strokeWidth`/`ringGap`/`baseInnerRadius` to fit, so no bench-side fitting
 * logic is needed here for the n=20/50 structural rows). `maxValue` is
 * itself seeded in [100, 1000) per ring; `value` is seeded to 20-95% of that
 * ring's `maxValue` (`Math.round(maxValue * (0.2 + rng() * 0.75))`) so every
 * ring shows a legible, non-zero, non-full progress arc.
 */
export interface SeededRing {
  label: string;
  value: number;
  maxValue: number;
}

function buildRings(rng: () => number, n: number): SeededRing[] {
  const rings: SeededRing[] = [];
  for (let i = 0; i < n; i++) {
    const maxValue = Math.round(100 + rng() * 900); // seeded 100-1000
    const value = Math.round(maxValue * (0.2 + rng() * 0.75)); // 20-95% of maxValue
    rings.push({ label: `Ring ${i + 1}`, value, maxValue });
  }
  return rings;
}

/**
 * Ring dataset: `n` rings, each a seeded {value, maxValue} pair, no color
 * (bklit assigns palette defaults -- see `SeededRing` doc above).
 * Deterministic per (chart, n), same mulberry32/seedFromKey contract as
 * every other generator here.
 */
export function generateRing(chart: string, n: number): SeededRing[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildRings(rng, n);
}

/**
 * Update-scenario dataset for ring: same n (ring count), different
 * tick-seeded values (mirrors every other `generate*Update`'s
 * `:update:${tick}` seed-suffix convention), used by `window.__benchUpdate()`.
 */
export function generateRingUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededRing[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildRings(rng, n);
}

/**
 * Gauge dataset -- matches the REAL bklit `GaugeProps` shape
 * (repos/bklit-ui/packages/ui/src/charts/gauge.tsx: `value`, `centerValue`,
 * `totalNotches`). Per docs/LOG.md D28, bklit's Gauge is a segmented
 * notch/tick meter with NO needle (the PROGRESS row-10 "needle" framing was
 * wrong -- zero grep hits for a needle anywhere in gauge.tsx); it renders a
 * single bare 0-100 `value` prop (`activeNotches = round(value/100 *
 * totalNotches)`), plus an entirely independent `centerValue` used only for
 * the optional center/label readout. The two props need not share a scale --
 * verified directly against both real usages: the registry example
 * (`value={72} centerValue={72}`, `formatOptions={{style:"percent"}}`) and
 * the docs demo (`value={66} centerValue={428_000}`,
 * `formatOptions={{style:"currency",...}}`) feed `centerValue` completely
 * different magnitudes than `value`.
 *
 * `n` here is `totalNotches` (D28: "n = totalNotches"), NOT a row/series
 * count like every other generator in this file -- Gauge has exactly ONE
 * seeded reading per render, rasterized at whatever notch resolution `n`
 * requests. `value` is seeded to [30, 85) (comfortably mid-range so every
 * gated notch count -- n=40 registry-parity, n=72 linear-docs-pattern --
 * renders a legible partial sweep, never fully empty/full regardless of
 * `n`); `centerValue` is an independent draw from the same rng stream,
 * seeded to [30, 95) (kept in the same rough 0-100 neighborhood so it reads
 * sensibly under the arc scenario's percent `formatOptions`, matching the
 * registry example's same-scale convention, while remaining numerically
 * independent of `value` per the two real usages cited above).
 */
export interface SeededGauge {
  value: number;
  centerValue: number;
  totalNotches: number;
}

export function generateGauge(chart: string, n: number): SeededGauge {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  const value = Math.round(30 + rng() * 55); // seeded 30-85
  const centerValue = Math.round(30 + rng() * 65); // seeded 30-95, independent draw
  return { value, centerValue, totalNotches: n };
}

/**
 * Update-scenario dataset for gauge: same `totalNotches` (n), a freshly
 * seeded `value`/`centerValue` pair per tick (mirrors every other
 * `generate*Update`'s `:update:${tick}` seed-suffix convention). This is
 * what drives bklit's D28 update idiom under `window.__benchUpdate()`: a
 * `value` INCREASE spring-pops only the newly-active notches ({300,20}
 * spring, staggered delay -- gauge.tsx's `DEFAULT_NOTCH_ENTER_TRANSITION` +
 * per-notch `delay: (0.3 + notch.index * 0.02) * stagger`), while a decrease
 * removes notches with no exit animation -- either way, the new `value`
 * returned here is exactly what bklit's `Gauge` re-diffs against its
 * previous `activeNotches` count to decide which notches (if any) just
 * became active.
 */
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

/**
 * Funnel stage shape -- matches the REAL bklit `FunnelStage` shape
 * (repos/bklit-ui/packages/ui/src/charts/funnel-chart.tsx: `{ label, value,
 * displayValue?, color?, gradient? }`). Per docs/LOG.md D30 the registry
 * example (registry/examples/funnel-chart.tsx) is the FIFTH broken example
 * found in this migration -- it passes a nonexistent `aspectRatio` prop --
 * so the docs demo (apps/web/content/docs/components/funnel-chart.mdx, a
 * 5-stage pipeline) is this generator's basis instead. No `displayValue`/
 * `color`/`gradient` fields are populated: the bench scenarios pass a plain
 * `color` at the `FunnelChart` level (docs-demo parity), so every stage
 * falls through to that shared color, and `formatValue`'s default (`intFmt`)
 * renders the seeded numeric `value` directly -- no need for a fabricated
 * `displayValue` string.
 *
 * `n` here is STAGE COUNT (D30: "n = stage count"), matching `FunnelChart`'s
 * own `norms = data.map(d => d.value / data[0].value)` -- percentage basis
 * is `data[0].value`, NOT `max(value)` (verified directly in
 * funnel-chart.tsx; a later stage rendering WIDER than the first is a real,
 * ported-verbatim possibility, not a generator bug to avoid). This generator
 * keeps every stage a monotonic taper of the previous one instead (D30:
 * "norms <=1, sane taper") since a monotonic pipeline is what every real
 * `FunnelChart` usage in bklit (registry + docs demo) actually shows: the
 * first value is seeded in [8000, 15000), and each subsequent stage is the
 * previous value times a seeded retention ratio in [0.35, 0.85) (D30:
 * "each next = prev*(0.35+rng()*0.5) rounded"), rounded to the nearest
 * integer so every stage is a legible whole-number count.
 */
export interface SeededFunnelStage {
  label: string;
  value: number;
}

function buildFunnelStages(rng: () => number, n: number): SeededFunnelStage[] {
  const stages: SeededFunnelStage[] = [];
  let value = Math.round(8000 + rng() * 7000); // seeded 8000-15000
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const retention = 0.35 + rng() * 0.5; // seeded 0.35-0.85
      value = Math.round(value * retention);
    }
    stages.push({ label: `Stage ${i + 1}`, value });
  }
  return stages;
}

/**
 * Funnel dataset: `n` stages, each a seeded {label, value} pair tapering
 * monotonically from the first stage (see `SeededFunnelStage` doc above).
 * Deterministic per (chart, n), same mulberry32/seedFromKey contract as
 * every other generator here. `chart` is expected to be `"funnel"` or
 * `"funnelvertical"` (the two disjoint bklit orientations, D30) so the two
 * ChartKinds get independently seeded (but structurally identical-shaped)
 * datasets, matching every other orientation-pair generator's convention in
 * this file (e.g. `generateGauge`'s "gauge"/"gaugelinear" keys).
 */
export function generateFunnel(chart: string, n: number): SeededFunnelStage[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildFunnelStages(rng, n);
}

/**
 * Update-scenario dataset for funnel: same n (stage count), a freshly
 * seeded taper chain per tick (mirrors every other `generate*Update`'s
 * `:update:${tick}` seed-suffix convention), used by `window.__benchUpdate()`.
 */
export function generateFunnelUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededFunnelStage[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildFunnelStages(rng, n);
}

// -----------------------------------------------------------------------
// Heatmap (GitHub-style contribution calendar)
// -----------------------------------------------------------------------
//
// Shape matches the REAL bklit `HeatmapColumn`/`HeatmapBin` types
// (repos/bklit-ui/packages/ui/src/charts/heatmap/heatmap-context.tsx):
//   HeatmapBin    { count: number; bin: number; date: Date }
//   HeatmapColumn { bin: number; bins: HeatmapBin[] }
// -- one column per week, `bin` = week index (0-based, oldest first); each
// column holds up to 7 day-bins, `bin` = Sun-aligned weekday offset (0=Sun
// .. 6=Sat). This matches the registry example's sample data shape exactly
// (registry/examples/heatmap-chart.tsx: `{ bin, bins: [{ bin, count, date
// }] }`), per docs/LOG.md D31.
//
// `n` here is WEEK COUNT (D31: "n = WEEK COUNT (gates n=52 primary
// [12-cal-month magic path] + n=26 [6-month branch]; structural
// n=104/260)"). Date-range resolution PORTS bklit's own
// `resolveHeatmapWeekRange` (heatmap-utils.ts) verbatim, including its
// n===52 "12 calendar months, aligned + partial-lead-week-skipped" magic
// path vs. every other n's plain rolling-window branch -- this is the
// single most load-bearing piece of D31's ruling ("52 is MAGIC ... any
// other weeks value is a literal rolling window") and is reproduced
// exactly (not approximated) below. Concretely, for this generator's fixed
// anchor (see next paragraph) the n=52 path resolves to a rangeStart of
// 2025-07-01, an aligned Sunday startDate of 2025-06-29 (the partial lead
// week straddles rangeStart with 5/7 in-range days, satisfying the
// `minDaysInFirstWeek=4` keep-rule with no skip needed), and a computed
// weekCount of 53 -- i.e. the actual column count for "n=52" is calendar-
// driven and NOT literally 52, exactly mirroring bklit's own real-world
// behavior (a data-shape nuance worth calling out, not a generator bug).
//
// FIXED reference "today" anchor: bklit's own demo data
// (apps/web/lib/heatmap-demo-data.ts) calls `new Date()` at render time,
// which is incompatible with this harness's determinism contract (two
// renders of the same scenario must be pixel-identical, and QA/bench
// medians must be stable regardless of the day they run). This generator
// hardcodes `HEATMAP_FIXED_TODAY = new Date(2026, 5, 30)` (2026-06-30, a
// Tuesday) in its place -- an arbitrary but fixed stand-in for "today"
// that never changes regardless of wall-clock date. One documented side
// effect (not a bug): bklit's OWN internal ghost-bin-ordering/display-
// range inference (`inferHeatmapCalendarRangeStart`/
// `resolveHeatmapDisplayRange`, heatmap-utils.ts) reads the REAL `new
// Date()` at render time, independently of this generator's data -- so
// the component's automatic "hide bins outside [calendarStart, today]"
// behavior only exactly lines up with this generator's own
// `rangeStart`/zeroed-out-of-range bins on the one calendar day the fixed
// anchor represents. This generator still zeroes out-of-range bins itself
// (matching the demo-data's own `isOutOfRange` -> `count: 0` behavior) so
// the DATA is self-consistent regardless of render date; only the
// component's own supplementary inference (a rendering nicety layered on
// top of the data) may diverge from that inference on any other day,
// which is harmless for bench/QA purposes since pixel comparisons are
// always same-day two-render pairs.
//
// Per-cell contribution counts replicate the STRUCTURE of bklit's own
// `heatmapContributionCount` (apps/web/lib/heatmap-demo-data.ts): a
// per-week "burst" modulation (busy weeks get more activity, quiet weeks
// less), a weekend activity dampening, then a tiered level pick. bklit
// reseeds a fresh Lehmer/Park-Miller LCG per (week,day) cell
// (`seededRandom(seed + week*1009 + day*9176)`) purely so its own
// animation code can independently resample the same sequence elsewhere --
// this generator instead draws sequentially from ONE `mulberry32` stream
// (this file's single PRNG family, used by every other generator here),
// walking columns/weekdays in a fixed order, which is fully deterministic
// for a single generation pass and keeps this file free of a second PRNG
// family. Per this task's explicit instruction, the level tiers are
// WIDENED from bklit's own 1-4 range to a seeded 0-8 range ("many 0-2, few
// 4+") -- bklit's own `getHeatmapContributionLevel` (heatmap-utils.ts)
// already buckets any count >=4 into a single top legend level, so counts
// above 4 are a legitimate real-world case (not a generator-only
// invention), just made rarer here by design.
export interface SeededHeatmapBin {
  count: number;
  bin: number;
  date: Date;
}

export interface SeededHeatmapColumn {
  bin: number;
  bins: SeededHeatmapBin[];
}

/** Fixed "today" anchor -- see doc block above for why `new Date()` isn't used. */
const HEATMAP_FIXED_TODAY = new Date(2026, 5, 30); // 2026-06-30
/** Mirrors bklit's own `HEATMAP_WEEKS_ONE_YEAR` (heatmap-utils.ts). */
const HEATMAP_WEEKS_ONE_YEAR = 52;
const HEATMAP_MS_PER_WEEK = 24 * 60 * 60 * 1000 * 7;

/** Ported from bklit's `getHeatmapCalendarRangeStart` (heatmap-utils.ts). */
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

/** Ported from bklit's `getHeatmapWeekStartSunday` (heatmap-utils.ts). */
function heatmapWeekStartSunday(date: Date): Date {
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

/** Ported from bklit's `getHeatmapWeekCount` (heatmap-utils.ts). */
function heatmapWeekCount(startSunday: Date, endDate: Date): number {
  const endSunday = heatmapWeekStartSunday(endDate);
  return (
    Math.floor(
      (endSunday.getTime() - startSunday.getTime()) / HEATMAP_MS_PER_WEEK,
    ) + 1
  );
}

/** Ported from bklit's `countHeatmapWeekDaysOnOrAfter` (heatmap-utils.ts). */
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

/** Ported from bklit's `getHeatmapWeekStartAlignedToRange` (heatmap-utils.ts). */
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

/** Ported verbatim from bklit's `resolveHeatmapWeekRange` (heatmap-utils.ts) -- see doc block above. */
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
    // One draw per week -- "busy week" modulation, matches bklit's own
    // per-week `weekRandom()` (a fresh generator reseeded per cell but
    // whose seed only depends on `week`, so it yields the same value for
    // every day in that week -- equivalent to drawing it once per week).
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
        const isWeekend = day === 0 || day === 6; // bin IS the Sun(0)-Sat(6) offset
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
 * Heatmap dataset: `n` week columns (D31: "n = WEEK COUNT"), each a Sun-Sat
 * `SeededHeatmapColumn` built against the FIXED `HEATMAP_FIXED_TODAY`
 * anchor (see doc block above). Deterministic per (chart, n), same
 * mulberry32/seedFromKey contract as every other generator in this file.
 * Note the returned array's length is `weekCount` as resolved by
 * `resolveHeatmapWeekRange`, which for `n=52` is calendar-derived and may
 * not equal 52 exactly (see doc block above) -- callers that need the
 * literal week count should read `columns.length`, not assume `=== n`.
 */
export function generateHeatmap(chart: string, n: number): SeededHeatmapColumn[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildHeatmapColumns(rng, n);
}

/**
 * Update-scenario dataset for heatmap: same week range/columns (n, anchored
 * to the same fixed "today"), a freshly seeded pass of contribution counts
 * per tick (mirrors every other `generate*Update`'s `:update:${tick}`
 * seed-suffix convention), used by `window.__benchUpdate()`.
 */
export function generateHeatmapUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededHeatmapColumn[] {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildHeatmapColumns(rng, n);
}

// -----------------------------------------------------------------------
// Sunburst (recursive value-proportional radial partition)
// -----------------------------------------------------------------------
//
// Shape matches the REAL bklit `SunburstNode` type (repos/bklit-ui/packages/
// ui/src/charts/sunburst-data.ts: `{ name, value?, color?, fill?, children?
// }`), verified against the (VALID, per docs/LOG.md D32) registry example
// (registry/examples/sunburst-chart.tsx).
//
// `n` here is TOTAL ARC COUNT at a FIXED depth of 3 (D32: "n = TOTAL ARC
// COUNT at fixed depth 3 (widen, don't deepen)") -- i.e. a root (not itself
// an arc -- bklit's `buildArcs`/`layoutNode`, sunburst.ts, only pushes an
// `ArcDatum` for `depth > 0`) plus exactly TWO rendered rings: `b1` top-level
// branches (depth 1), each with `b2` leaf children (depth 2). Total arc
// count = branches + leaves = `b1 + b1*b2 = b1*(1+b2)`.
//
// `branchingFactors` picks a BALANCED (b1 close to b2, both close to
// sqrt(n)) split: `b1 = round(sqrt(n))`, `b2 = round(n/b1) - 1`. This is
// documented as an APPROXIMATION on purpose -- the task spec calls for
// "branching factors so total non-root node count ≈ n" (not exactly n) --
// and this codebase already has an established precedent for a generator's
// literal output count differing slightly from the requested `n`
// (`generateHeatmap`'s n=52 resolving to a calendar-driven `weekCount` of 53,
// documented in `buildHeatmapColumns`'s doc block above). Concretely, for
// the two GATED sizes and the two STRUCTURAL sizes (D32):
//   n=10  (gate, registry parity)      -> b1=3,  b2=2  -> actual arcs = 9
//   n=27  (gate, docs-demo scale)      -> b1=5,  b2=4  -> actual arcs = 25
//   n=100 (structural)                 -> b1=10, b2=9  -> actual arcs = 100 (exact)
//   n=300 (structural)                 -> b1=17, b2=17 -> actual arcs = 306
// Both `bklit` and `tanstack` scenarios call this SAME generator for a given
// (chart, n), so the comparison stays apples-to-apples regardless of the
// exact/approximate arc count -- only the requested `n` needs to match
// across impls, not the literal resulting tree size.
export interface SeededSunburstNode {
  name: string;
  value?: number;
  color?: string;
  fill?: string;
  children?: SeededSunburstNode[];
}

/** See doc block above -- balanced (b1≈b2≈sqrt(n)) branching split, `total ≈ n`. */
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
      // seeded [50, 500), per task spec.
      const value = Math.round(50 + rng() * 450);
      leaves.push({ name: `Leaf ${i + 1}.${j + 1}`, value });
    }
    children.push({ name: `Branch ${i + 1}`, children: leaves });
  }
  return { name: "Root", children };
}

/**
 * Sunburst dataset: a depth-3 tree (root + 2 rendered rings), `b1` top-level
 * branches each with `b2` seeded-value leaves (see doc block above for the
 * branching-factor formula). Deterministic per (chart, n), same
 * mulberry32/seedFromKey contract as every other generator here.
 */
export function generateSunburst(chart: string, n: number): SeededSunburstNode {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildSunburstTree(rng, n);
}

/**
 * Update-scenario dataset for sunburst: same tree SHAPE (branch/leaf names,
 * hence same bklit arc ids -- `nodeId` in sunburst.ts is name-path-based, not
 * value-based, so this keeps `buildArcs`' ids and React keys stable across
 * an update, matching every other `generate*Update`'s "same identity,
 * different values" contract), freshly seeded leaf values per tick (mirrors
 * the `:update:${tick}` seed-suffix convention used everywhere else in this
 * file), used by `window.__benchUpdate()`.
 */
export function generateSunburstUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededSunburstNode {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildSunburstTree(rng, n);
}

// ---------------------------------------------------------------------------
// Choropleth
// ---------------------------------------------------------------------------
//
// Shape: a `Record<countryName, value>` map, keyed by the vendored map
// asset's own `properties.name` (see bench/app/src/assets/
// world-countries-110m.json -- world-atlas@2.0.2 110m countries TopoJSON,
// `objects.countries` GeometryCollection, 177 geometries, each with a
// `properties.name` field verified unique across all 177). Keying by NAME
// (not the numeric ISO `id`) mirrors both bklit's own docs demo
// (`ChoroplethAnalyticsDemo` in repos/bklit-ui/apps/web/components/docs/
// choropleth-demo.tsx: `visitorsByCountry: Record<string, number>`, looked
// up via `feature.properties?.name`) and bklit's `ChoroplethTooltip`'s
// default title (`feature.properties?.name`, choropleth-tooltip.tsx) -- the
// join key every consumer of this map (both bklit and tanstack scenarios)
// actually uses at render time.
//
// This generator does NOT import topojson-client or do any GeoJSON
// conversion (that lives in bench/app/src/scenarios/choropleth-world-data.ts,
// alongside the scenario components that actually render the geometry) --
// it only needs the raw TopoJSON's `objects.countries.geometries[].
// properties.name` list to know which keys to seed values for, keeping this
// file's zero-import, pure-data-generator contract intact for every other
// chart above.
//
// Values: seeded integers in [0, 5_000_000), right-skewed (mirrors a
// plausible "unique visitors by country" distribution -- a handful of
// large countries, a long tail of small values -- rather than a flat
// uniform spread across 177 countries, which would look implausible next
// to bklit's own docs-demo `visitorsByCountry` sample data, e.g. `"United
// States of America": 24`, `"China": 19`, vs. many single-digit entries).
// `rng() ** 2.4` biases the distribution toward 0 before scaling to the
// [0, 5_000_000) range, then rounds to an integer.
//
// `n` is NOMINAL here (same convention as generateSunburst/generateHeatmap
// documenting a non-count-controlling `n`): the map is a single fixed-size
// gate (~177 features, one per country in the vendored asset -- D34), not a
// user-selectable series length, but the `(chart, n)` seed-key convention
// is kept for consistency with every other generator in this file and so
// that different `?n=` bench-harness invocations still resolve to a
// well-defined (if identical-shape) deterministic dataset.
const worldTopology = worldCountries110mRaw as unknown as {
  objects: {
    countries: {
      geometries: Array<{ properties?: { name?: string } }>;
    };
  };
};

/** All 177 country names from the vendored map asset, in file order. */
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

/**
 * Choropleth dataset: a `{ [countryName]: value }` map covering every
 * country in the vendored world-atlas asset. Deterministic per (chart, n),
 * same mulberry32/seedFromKey contract as every other generator here.
 */
export function generateChoroplethValues(chart: string, n: number): SeededChoroplethValues {
  const rng = mulberry32(seedFromKey(`${chart}:${n}`));
  return buildChoroplethValues(rng);
}

/**
 * Update-scenario dataset for choropleth: same key set (every country name
 * stays present, so bklit's per-feature React keys / TanStack's `geoShape`
 * `key` channel stay stable across an update -- matching every other
 * `generate*Update`'s "same identity, different values" contract), freshly
 * seeded values per tick (mirrors the `:update:${tick}` seed-suffix
 * convention used everywhere else in this file), used by
 * `window.__benchUpdate()`.
 */
export function generateChoroplethValuesUpdate(
  chart: string,
  n: number,
  tick: number,
): SeededChoroplethValues {
  const rng = mulberry32(seedFromKey(`${chart}:${n}:update:${tick}`));
  return buildChoroplethValues(rng);
}

// ---------------------------------------------------------------------------
// Sankey
// ---------------------------------------------------------------------------
//
// Shape: `{ nodes: SeededSankeyNode[], links: SeededSankeyLink[] }`, matching
// bklit's own `SankeyData` (sankey-context.tsx: `SankeyNodeDatum { name,
// category?: "source" | "landing" | "outcome" }`, `SankeyLinkDatum { source:
// number, target: number, value: number }` -- index-based source/target,
// matching d3-sankey's own input contract).
//
// `n` is LINK COUNT (docs/LOG.md D35): the two GATE sizes are pixel-parity
// fixtures hardcoded VERBATIM from bklit's own registry/docs sources (NOT
// generated) --
//   n=4  -> repos/bklit-ui/packages/ui/registry/examples/sankey-chart.tsx's
//           5-node/4-link demo. Its nodes carry NO `category` field.
//           sankey-node.tsx's per-node display-value sum is category-gated:
//           `node.category === "source"` sums OUTFLOW, anything else
//           (including `undefined`) sums INFLOW. "Ads"/"Organic" are pure
//           sources (zero inflow, only outflow) with an `undefined`
//           category, so they fall into the INFLOW branch and display "0
//           sessions" -- a real, reproducible bug in the shipped registry
//           demo, ported bug-for-bug on purpose (D35).
//   n=33 -> repos/bklit-ui/apps/web/content/docs/components/sankey-chart.mdx's
//           `analyticsData` (14 nodes, EVERY node carries an explicit
//           `category`, so the bug above does not fire -- all values compute
//           correctly).
// All other `n` fall back to `generateSankey`'s synthetic seeded layered DAG
// (below) -- a structural stress dataset, not a pixel-parity fixture.

export interface SeededSankeyNode {
  name: string;
  category?: "source" | "landing" | "outcome";
  // Index signature matches bklit's own `SankeyNodeDatum`
  // (sankey-context.tsx: `{ name, category?, [key: string]: unknown }`) --
  // required for structural assignability into that type at the JSX call
  // site in bklit-sankey.tsx.
  [key: string]: unknown;
}

export interface SeededSankeyLink {
  source: number;
  target: number;
  value: number;
  // Index signature matches bklit's own `SankeyLinkDatum` for the same
  // reason as `SeededSankeyNode` above.
  [key: string]: unknown;
}

export interface SeededSankeyData {
  nodes: SeededSankeyNode[];
  links: SeededSankeyLink[];
}

/**
 * VERBATIM from
 * repos/bklit-ui/packages/ui/registry/examples/sankey-chart.tsx (n=4 gate).
 * Do not "fix" the missing `category` fields -- see doc block above.
 */
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

/**
 * VERBATIM from repos/bklit-ui/apps/web/content/docs/components/
 * sankey-chart.mdx's `analyticsData` (n=33 gate, 33 links).
 */
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

/**
 * Gate-fixture lookup: returns the hardcoded VERBATIM dataset for n=4
 * (registry) or n=33 (docs demo). Callers must check `n === 4 || n === 33`
 * before calling this -- any other `n` has no gate fixture (use
 * `generateSankey` instead).
 */
export function getSankeyGateData(n: number): SeededSankeyData {
  if (n === 4) return SANKEY_REGISTRY_DATA;
  if (n === 33) return SANKEY_DOCS_DATA;
  throw new Error(
    `getSankeyGateData: no gate fixture for n=${n} (only 4 and 33 are defined)`,
  );
}

// --- Synthetic structural dataset (n=100/300, or any non-gate n) ----------
//
// 4 fixed layers (source -> landing -> mid -> outcome -- the docs demo's
// 3-category shape plus one extra middle layer so a real 4-layer topology
// is exercised at stress scale), links ONLY between adjacent layers (no
// skip-layer or same-layer links -- matches both gate fixtures, which are
// also strictly adjacent-layer). Per-layer node count is `max(3,
// round(sqrt(n)))` (mirrors `generateSunburst`'s own
// `sunburstBranchingFactors` balanced-split "approximation, total ~ n, not
// exact" convention documented just above).
//
// Link count is split across the 3 adjacent-layer transitions so the total
// is approximately n: base = floor(n/3) per transition, remainder
// distributed to the first transitions; a small "coverage floor" (every
// node in the next layer gets >=1 inbound link) can push the realized count
// slightly above n for very small n -- same "approximation, not exact"
// caveat as generateSunburst.
//
// Flow conservation: layer-0 (source) nodes each get a random seeded
// "supply" value. Every subsequent layer's per-node value is EXACTLY the
// sum of its inbound link values (true conservation, not approximate) -- a
// real flow network, not random numbers dressed up as one. Within each
// transition, a node's outgoing links split its available supply
// proportionally by seeded random weights, after a "coverage pass"
// (round-robin assignment) guarantees every node in the next layer has at
// least one inbound link (no orphans) before extra random edges are added
// to reach the transition's target link count.
//
// Topology vs. values are drawn from TWO INDEPENDENT seeded RNG streams
// (`:topology` suffix vs. the plain `${chart}:${n}` / `:update:${tick}`
// keys used for values) -- see `generateSankeyUpdate`'s doc block for why
// this split matters for an honest update measurement.
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

/** Topology only (node list + per-transition edge index pairs) -- no values. */
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

    // Coverage pass: round-robin so every `to` node gets >=1 inbound edge.
    const edges: Array<[number, number]> = [];
    for (let t = 0; t < toCount; t++) {
      edges.push([t % fromCount, t]);
    }
    // Extra random edges up to the transition's target link count.
    while (edges.length < targetLinkCount) {
      const from = Math.floor(topologyRng() * fromCount);
      const to = Math.floor(topologyRng() * toCount);
      edges.push([from, to]);
    }
    edgesByTransition.push(edges);
  }

  return { nodes, layerSizes, layerStartIndex, edgesByTransition };
}

/** Values only, given a fixed topology -- true flow conservation (see doc block above). */
function buildLayeredSankeyValues(
  valuesRng: () => number,
  topology: SankeyLayerTopology,
): SeededSankeyData {
  const { nodes, layerSizes, layerStartIndex, edgesByTransition } = topology;
  const links: SeededSankeyLink[] = [];

  // Seeded [50, 500) per source node (mirrors generateSunburst's own
  // [50, 500) leaf-value convention just above).
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
 * Synthetic layered-DAG sankey dataset for structural stress sizes (any `n`
 * outside the two gate fixtures -- see `getSankeyGateData`). 4 fixed layers,
 * adjacent-layer-only links, true flow conservation (see doc block above).
 * Deterministic per (chart, n), same mulberry32/seedFromKey contract as
 * every other generator in this file.
 */
export function generateSankey(chart: string, n: number): SeededSankeyData {
  const topologyRng = mulberry32(seedFromKey(`${chart}:${n}:topology`));
  const valuesRng = mulberry32(seedFromKey(`${chart}:${n}`));
  const topology = buildLayeredSankeyTopology(topologyRng, n);
  return buildLayeredSankeyValues(valuesRng, topology);
}

/**
 * Update-scenario dataset for sankey.
 *
 * Honest-update-shape note: every OTHER `generate*Update` in this file keeps
 * topology/identity fixed and reseeds only numeric values (see e.g.
 * `generateSunburstUpdate`'s doc block above) -- this is the harness's
 * established convention, and it matters especially here because d3-sankey
 * derives node x/y layout from the link graph's topology, so a topology
 * change mid-benchmark would also move every node, contaminating an
 * "update" cost measurement with layout-reflow cost that has nothing to do
 * with a plain value refresh. We follow the convention:
 *  - Gate sizes (n=4/33): keep the VERBATIM node/link topology (identical
 *    node list, identical `source`/`target` indices) and only reseed each
 *    link's `value` from a fresh RNG stream -- a fresh independent draw per
 *    link, not a small jitter of the original, matching e.g.
 *    `generateGaugeUpdate`'s "fresh seeded value" convention rather than a
 *    delta/jitter one.
 *  - Synthetic sizes: rebuild topology from the SAME `:topology`-suffixed
 *    seed used by `generateSankey` (so `edgesByTransition` -- and therefore
 *    every link's source/target and every node's identity -- is byte-
 *    identical to the mount call), then feed it through
 *    `buildLayeredSankeyValues` with a fresh `:update:${tick}`-seeded RNG so
 *    only supply/weight numbers (hence link `value`s) change.
 */
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

// ---------------------------------------------------------------------------
// LiveLine (streaming price ticker)
// ---------------------------------------------------------------------------
//
// Demo-constant provenance (docs/LOG.md D22): the registry example
// (registry/examples/live-line-chart.tsx) is BROKEN -- it passes
// `interval`/`maxPoints`/`xDataKey`/`yDataKey` props that don't exist on the
// real `LiveLineChartProps` (verified directly against live-line-chart.tsx)
// -- so the canonical basis is the docs demo's `useLiveData` hook
// (repos/bklit-ui/apps/web/components/docs/live-line-chart-demo.tsx, lines
// 13-60). Every numeric constant below is copied VERBATIM from that hook:
// initial price 142.5, 600ms interval, seed-phase momentum decay 0.92 / step
// 0.012 / recenter 0.48, live-phase momentum decay 0.88 / step 0.008 / extra
// *0.995 damping, price floor 1, 2-decimal rounding.
//
// Shape mirrors bklit's own `LiveLinePoint` (live-line-chart.tsx: `{ time:
// number (unix seconds), value: number }`) structurally, without importing
// it -- same "locally-typed, zero-import" convention as every other Seeded*
// type in this file (e.g. `SeededOhlcRow` mirroring `OHLCDataPoint`).
//
// n semantics (pre-decided by the LiveLine bench-scenario task spec): `n` is
// BOTH the seeded initial point count and the target retained-window size.
// n=30 is the demo-parity gate -- ALL demo constants verbatim, including the
// window(30s)/cutoff(60s) pair, which is NOT literally `n * interval`
// (30 * 0.6 = 18, not 30) -- so n=30 is special-cased below rather than
// derived from the general formula. For any other n, the 600ms interval is
// kept but window = n*0.6 seconds and cutoff = 2*window, mirroring the
// demo's own window=30/cutoff=60 2x ratio. `liveLineWindowSecs` feeds the
// `LiveLineChart` `window` prop directly; `liveLineCutoffSecs` is a
// data-retention concern the DEMO's `useLiveData` hook owns itself (its
// `setData` callback's `cutoff` filter) -- NOT a `LiveLineChart` prop -- so
// scenario components apply it themselves when trimming their own `data`
// state on each tick, exactly mirroring what the demo hook does outside the
// chart.
export interface SeededLiveLinePoint {
  time: number;
  value: number;
}

const LIVELINE_INITIAL_PRICE = 142.5;
/** 600ms, matches the demo's `useLiveData(142.5, 600)` `intervalMs` arg. */
const LIVELINE_INTERVAL_SEC = 0.6;

/** `LiveLineChart`'s `window` prop (seconds) for a given n -- see doc block above. */
export function liveLineWindowSecs(n: number): number {
  return n === 30 ? 30 : n * LIVELINE_INTERVAL_SEC;
}

/**
 * Scenario-side data-retention cutoff (seconds) -- mirrors the demo
 * `useLiveData` hook's own `cutoff` filter (`Date.now()/1000 - 60` at
 * n=30), NOT a `LiveLineChart` prop. Always >= `liveLineWindowSecs(n)` so
 * the chart's own internal window-slice never has to reach past what the
 * scenario has actually retained.
 */
export function liveLineCutoffSecs(n: number): number {
  return n === 30 ? 60 : liveLineWindowSecs(n) * 2;
}

interface LiveLineWalkState {
  price: number;
  momentum: number;
}

/** One seed-phase step -- VERBATIM from the demo's seed loop (lines 24-32). */
function liveLineSeedStep(rng: () => number, state: LiveLineWalkState): number {
  state.momentum = state.momentum * 0.92 + (rng() - 0.48) * 0.012;
  state.price *= 1 + state.momentum;
  state.price = Math.max(state.price, 1);
  return Math.round(state.price * 100) / 100;
}

/** One live-phase step -- VERBATIM from the demo's `setInterval` callback (lines 40-46). */
function liveLineTickStep(rng: () => number, state: LiveLineWalkState): number {
  state.momentum = state.momentum * 0.88 + (rng() - 0.48) * 0.008;
  state.momentum *= 0.995;
  state.price *= 1 + state.momentum;
  state.price = Math.max(state.price, 1);
  return Math.round(state.price * 100) / 100;
}

/**
 * Per-`n` memoized walk: `values[0..n-1]` are the seed-phase outputs (the
 * same values `getLiveLineSeed` returns), `values[n + tick - 1]` is live
 * tick `tick`'s value -- ONE continuous rng stream + walk state per `n`,
 * grown lazily so repeated `liveLineTickValue` calls (e.g. a sustained M3b
 * run driving many ticks, or the freeze protocol's own K ticks) don't
 * replay the whole walk from scratch every call. This is purely an internal
 * cache: both `getLiveLineSeed` and `liveLineTickValue` stay pure from the
 * caller's perspective (same (n[, tick]) always produces the same result,
 * regardless of call order/count).
 */
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
 * Seeded initial points for a LiveLine scenario mount: `n` points, seed-phase
 * math VERBATIM from the demo (see doc block above). `time` fields are
 * spaced `LIVELINE_INTERVAL_SEC` apart and end ONE INTERVAL BEFORE `nowSec`
 * -- matches the demo's own loop exactly (its last seed point is
 * `nowSec - 1*interval`, not literally `nowSec`;
 * live-line-chart-demo.tsx:24-32 counts `i` down from `n` to `1`, never
 * reaching `i=0`). `nowSec` defaults to the real current time
 * (`Date.now()/1000`) -- per the task's own determinism contract, real
 * wall-clock `time` values are fine; only the VALUE stream needs to be
 * seed-stable.
 */
export function getLiveLineSeed(
  n: number,
  nowSec: number = Date.now() / 1000,
): SeededLiveLinePoint[] {
  const values = ensureLiveLineWalkLength(n, n);
  const points: SeededLiveLinePoint[] = [];
  for (let k = 0; k < n; k++) {
    const i = n - k; // demo's countdown index (i: n..1)
    points.push({ time: nowSec - i * LIVELINE_INTERVAL_SEC, value: values[k] });
  }
  return points;
}

/**
 * The `tick`-th (1-indexed) live value continuing the SAME seeded stream
 * `getLiveLineSeed(n)` ends on -- pure function of (n, tick): identical
 * inputs always re-derive the identical value (see the walk-cache doc block
 * above for how repeated calls stay cheap without breaking that purity
 * contract). `tick=1` is the first post-seed live tick, matching the demo's
 * first `setInterval` firing.
 */
export function liveLineTickValue(n: number, tick: number): number {
  const values = ensureLiveLineWalkLength(n, n + tick);
  return values[n + tick - 1];
}
