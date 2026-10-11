import { entranceBudget } from "./entrance-budget";
import type { Headline } from "./headline-cards";

/** Chrome sweep totals, single source for the overview cards. */
export const sweepHeadlines: Headline[] = [
  { label: "Render time on load", kind: "faster", bklit: 975, migrated: 278 },
  { label: "React render on hover", kind: "less", bklit: 2101, migrated: 133 },
  { label: "Browser compute per pointer move", kind: "faster", bklit: 41.4, migrated: 26.7 },
];

type Pair = readonly [bklit: number, migrated: number] | null;

/** Per-chart Chrome sweep (2026-10-11), ms: render on load, React render on hover, compute per move. */
export const chartHeadlines: Record<string, { load: Pair; hover: Pair; move: Pair }> = {
  area: { load: [29.2, 15.8], hover: [187.4, 10.9], move: [3.38, 1.50] },
  bar: { load: [14.6, 7.9], hover: [21.8, 4.5], move: [0.48, 0.42] },
  bardepth: { load: [26.6, 9.6], hover: [34.7, 5.8], move: [0.67, 0.56] },
  barsquares: { load: [21.7, 6.0], hover: [61.4, 5.7], move: [1.14, 0.53] },
  brush: { load: [32.8, 20.3], hover: [106.1, 11.5], move: [1.99, 1.51] },
  candlestick: { load: [12.8, 8.6], hover: [26.4, 4.3], move: [0.56, 0.58] },
  choropleth: { load: [194, 72], hover: [36.2, 4.6], move: [0.70, 1.24] },
  composed: { load: [26.4, 7.5], hover: [131.8, 10.6], move: [2.40, 1.27] },
  funnel: { load: [12.8, 4.3], hover: [17.7, 0], move: [0.32, 0.36] },
  gauge: { load: [43, 6.7], hover: [0, 0], move: [0.08, 0.20] },
  heatmap: { load: [56.4, 5.6], hover: [606.1, 11.1], move: [10.70, 0.92] },
  line: { load: [25.6, 9.0], hover: [95.8, 10.0], move: [1.76, 1.26] },
  liveline: { load: [53.4, 12.8], hover: [2407.6, 92.2], move: [1.79, 1.53] },
  markers: { load: [60.4, 18.8], hover: [110.2, 6.7], move: [2.12, 1.61] },
  patternarea: { load: [22.4, 12.5], hover: [84.4, 4.2], move: [1.68, 1.39] },
  pie: { load: [9.0, 1.7], hover: [12.0, 0], move: [0.30, 0.27] },
  projection: { load: [17.4, 6.0], hover: [74.3, 4.1], move: [1.48, 1.22] },
  radar: { load: [11.3, 3.2], hover: [20.6, 5.4], move: [0.49, 0.66] },
  "reference-area": { load: [18.9, 10.4], hover: [72.5, 4.3], move: [1.45, 1.21] },
  ring: { load: [14.4, 2.7], hover: [42.6, 9.0], move: [0.86, 4.82] },
  sankey: { load: [26.0, 2.0], hover: [213, 6.8], move: [4.12, 0.82] },
  scatter: { load: [35.5, 7.7], hover: [65.5, 6.0], move: [1.35, 1.26] },
  segment: { load: [19.9, 13.6], hover: [80.6, 7.1], move: [1.57, 1.55] },
  sunburst: { load: [163, 4.9], hover: null, move: null },
};

/** Chrome sweep (2026-10-11), per run (6): settled − first paint in ms, [bklit runs, migrated runs]. Raw, budget not subtracted. */
const settleSweep: Record<string, [bklit: number[], migrated: number[]]> = {
  area: [[1110.7, 1112.1, 1115.6, 1116.4, 1110.5, 1114.6], [1117.0, 1113.9, 1131.2, 1114.1, 1119.3, 1131.0]],
  bar: [[1537.8, 1543.3, 1543.4, 1536.5, 1535.2, 1538.8], [1535.7, 1540.6, 1540.8, 1533.7, 1532.0, 1535.2]],
  bardepth: [[1549.8, 1549.0, 1550.0, 1546.6, 1538.2, 1545.4], [1541.7, 1540.0, 1540.6, 1539.9, 1532.2, 1539.4]],
  barsquares: [[1909.2, 1927.9, 1929.3, 1926.9, 1929.2, 1926.6], [1909.1, 1917.9, 1919.3, 1917.9, 1918.1, 1917.2]],
  brush: [[1116.3, 1117.3, 1116.0, 1114.7, 1114.7, 1118.5], [1121.6, 1123.2, 1118.8, 1118.8, 1119.6, 1122.7]],
  candlestick: [[1102.2, 1088.2, 1090.4, 1087.5, 1090.1, 1094.2], [1099.7, 1093.1, 1096.7, 1096.3, 1090.7, 1097.9]],
  choropleth: [[801.5, 798.6, 800.2, 802.6, 802.5, 798.0], [801.5, 798.6, 800.3, 802.6, 802.5, 798.0]],
  composed: [[1117.7, 1115.8, 1117.7, 1116.0, 1119.3, 1118.9], [1128.4, 1125.6, 1128.1, 1125.9, 1119.8, 1129.6]],
  funnel: [[1569.7, 1565.2, 1559.7, 1566.7, 1577.9, 1565.7], [1554.4, 1549.7, 1549.6, 1553.2, 1561.8, 1551.4]],
  gauge: [[2043.6, 2046.7, 2049.4, 2045.8, 2041.2, 2051.6], [1916.7, 1949.1, 1919.2, 1952.0, 1953.7, 1924.6]],
  heatmap: [[1784.9, 1791.8, 1783.3, 1791.1, 1795.8, 1787.9], [1805.4, 1820.2, 1810.9, 1821.4, 1816.1, 1814.7]],
  line: [[1809.5, 1806.7, 1801.6, 1808.6, 1806.6, 1800.3], [1827.7, 1809.9, 1821.8, 1782.6, 1818.6, 1819.8]],
  liveline: [[540.7, 502.8, 512.3, 498.0, 502.6, 526.1], [487.1, 502.8, 512.7, 497.9, 502.8, 525.7]],
  markers: [[1800.1, 1801.3, 1808.9, 1800.5, 1806.0, 1804.0], [1822.8, 1825.4, 1827.3, 1813.5, 1814.5, 1813.6]],
  patternarea: [[1111.8, 1110.4, 1108.8, 1112.0, 1113.2, 1109.0], [1115.0, 1115.0, 1114.7, 1117.0, 1113.7, 1122.8]],
  pie: [[1526.5, 1528.3, 1529.7, 1534.7, 1526.2, 1528.5], [1516.4, 1517.7, 1509.6, 1514.5, 1506.1, 1508.3]],
  projection: [[1395.1, 1394.5, 1404.8, 1400.4, 1395.1, 1386.7], [1377.5, 1342.2, 1329.6, 1332.5, 1341.8, 1338.3]],
  radar: [[2134.6, 2147.3, 2133.3, 2129.1, 2130.8, 2136.0], [2134.6, 2140.3, 2145.5, 2137.0, 2139.2, 2130.0]],
  "reference-area": [[1100.7, 1099.9, 1102.1, 1101.1, 1100.7, 1099.4], [1106.3, 1109.6, 1117.7, 1104.8, 1106.2, 1105.6]],
  ring: [[2203.5, 2203.4, 2199.8, 2205.3, 2200.2, 2207.7], [2221.5, 2221.1, 2217.2, 2223.3, 2218.2, 2224.7]],
  sankey: [[1607.2, 1613.5, 1603.8, 1626.5, 1604.7, 1606.8], [1578.2, 1595.3, 1589.8, 1608.0, 1594.4, 1598.3]],
  scatter: [[1095.7, 1098.0, 1103.4, 1088.0, 1104.0, 1103.1], [1117.5, 1116.8, 1124.9, 1113.4, 1119.5, 1117.7]],
  segment: [[1115.9, 1112.2, 1105.1, 1114.2, 1114.9, 1112.4], [1121.0, 1114.0, 1105.4, 1115.9, 1116.5, 1115.9]],
  sunburst: [[3078.0, 3079.6, 3066.3, 3071.5, 3062.9, 3072.2], [3071.5, 3072.5, 3069.9, 3071.5, 3066.2, 3068.9]],
};

/** Parity band for settle overhead: overheads are tens of ms, so a ratio misleads; a difference under this reads as parity. */
export const SETTLE_TOLERANCE_MS = 10;

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

export interface SettleRow {
  /** median over runs of settled − first paint − designed entrance, ms */
  bklit: number;
  migrated: number;
  /** migrated − bklit, ms */
  diff: number;
  /** min-max ranges overlap, or the median difference is inside SETTLE_TOLERANCE_MS */
  parity: boolean;
  /** an overhead below zero: the animation ended before its designed end */
  negative: boolean;
}

/** Same designed-entrance budget is subtracted from both sides. */
export function settleOverhead(route: string): SettleRow | null {
  const raw = settleSweep[route];
  const budget = entranceBudget[route]?.ms;
  if (!raw || budget === undefined) return null;
  const [b, m] = raw.map((runs) => runs.map((v) => v - budget));
  const bklit = median(b);
  const migrated = median(m);
  const diff = migrated - bklit;
  const overlap = Math.min(...b) <= Math.max(...m) && Math.min(...m) <= Math.max(...b);
  return { bklit, migrated, diff, parity: overlap || Math.abs(diff) < SETTLE_TOLERANCE_MS, negative: bklit < 0 || migrated < 0 };
}

export interface SettleSummary {
  /** mean over charts of the per-chart median overhead, ms */
  bklit: number;
  migrated: number;
  /** mean per-chart difference (migrated − bklit), ms */
  diff: number;
  /** the same difference computed within each of the 6 runs: min and max */
  runRange: [number, number];
  charts: number;
  negatives: number;
}

export function settleSummary(): SettleSummary {
  const rows = Object.keys(settleSweep).flatMap((r) => {
    const o = settleOverhead(r);
    return o ? [o] : [];
  });
  const perRun = Array.from({ length: 6 }, (_, i) =>
    mean(Object.keys(settleSweep).map((r) => settleSweep[r][1][i] - settleSweep[r][0][i])),
  );
  return {
    bklit: mean(rows.map((r) => r.bklit)),
    migrated: mean(rows.map((r) => r.migrated)),
    diff: mean(rows.map((r) => r.diff)),
    runRange: [Math.min(...perRun), Math.max(...perRun)],
    charts: rows.length,
    negatives: rows.filter((r) => r.negative).length,
  };
}
