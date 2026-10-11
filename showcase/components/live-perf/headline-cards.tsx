import type { Summary } from "./headline-data";

/** median, min, max across runs (or across 10-move slices, live) */
export type Stat = readonly [median: number, min: number, max: number];

/** Parity band used when a stat has no spread: both values within this relative or absolute distance. */
export interface Tolerance {
  rel: number;
  abs: number;
}
export const DEFAULT_TOL: Tolerance = { rel: 0.1, abs: 0.5 };

export interface Headline {
  label: string;
  /** one line under the value: what exactly is measured */
  note?: string;
  bklit: Stat | null;
  migrated: Stat | null;
  digits?: number;
  tol?: Tolerance;
  /** caption shown while either value is null */
  pending?: string;
  /** explanatory row: never styled as a win or a loss */
  explanatory?: boolean;
}

const fmtMs = (v: number, digits = 1) =>
  `${v >= 1000 ? Math.round(v).toLocaleString("en-US") : Number.isInteger(v) ? v : v.toFixed(digits)} ms`;

const fmtStat = (s: Stat, digits = 1) => `${fmtMs(s[0], digits)} (${s[1]}–${s[2]})`;

function widen(s: Stat, tol: Tolerance): readonly [number, number] {
  if (s[2] > s[1]) return [s[1], s[2]];
  const d = Math.max(tol.abs, s[0] * tol.rel);
  return [s[0] - d, s[0] + d];
}

/** Lower is better. "parity" when the two ranges overlap; a ratio only when they do not. */
export function compare(b: Stat, m: Stat, tol: Tolerance = DEFAULT_TOL) {
  const [bl, bh] = widen(b, tol);
  const [ml, mh] = widen(m, tol);
  if (ml <= bh && bl <= mh) return { text: "parity", tone: "parity" as const };
  const better = m[0] < b[0];
  const x = better ? b[0] / Math.max(m[0], 1e-9) : m[0] / Math.max(b[0], 1e-9);
  const n = x >= 10 ? Math.round(x) : x.toFixed(1);
  return { text: `${n}× ${better ? "less" : "more"}`, tone: better ? ("better" as const) : ("worse" as const) };
}

const tone = {
  parity: "",
  better: "text-emerald-700 dark:text-emerald-400",
  worse: "text-red-600/90 dark:text-red-400/90",
};

/** Table cell for one metric of one chart; null means not measured. */
export function CompareCell({ b, m, tol }: { b: Stat | null; m: Stat | null; tol?: Tolerance }) {
  if (!b || !m) return <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">n/a</td>;
  const c = compare(b, m, tol);
  return (
    <td
      className={`px-3 py-2.5 text-right tabular-nums ${tone[c.tone]}`}
      title={`bklit ${fmtStat(b, 2)}; migrated ${fmtStat(m, 2)}`}
    >
      {c.text}
      <span className="block text-[11px] font-normal text-muted-foreground">
        {b[0]} → {m[0]}
      </span>
    </td>
  );
}

function HeadlineCard({ h }: { h: Headline }) {
  const ready = h.bklit !== null && h.migrated !== null;
  const c = ready ? compare(h.bklit as Stat, h.migrated as Stat, h.tol) : null;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{h.label}</div>
      <div
        className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${c && !h.explanatory ? tone[c.tone] : ""}`}
      >
        {c ? c.text : "—"}
      </div>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {ready
          ? `bklit ${fmtStat(h.bklit as Stat, h.digits)} · migrated ${fmtStat(h.migrated as Stat, h.digits)}`
          : (h.pending ?? "")}
      </p>
      {h.note && <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>}
    </div>
  );
}

/** Summary card: a ratio only when the per-run range of the geometric mean excludes 1 and the mean is 5% or more off 1. */
export function SummaryCard({ label, note, s }: { label: string; note: string; s: Summary | null }) {
  const outside = s !== null && (s.geoRange[1] < 1 || s.geoRange[0] > 1) && Math.abs(s.geo - 1) >= 0.05;
  const lower = s !== null && s.geo < 1;
  const x = s ? (lower ? 1 / s.geo : s.geo) : 1;
  const text = !s ? "—" : outside ? `${x >= 10 ? Math.round(x) : x.toFixed(2)}× ${lower ? "less" : "more"}` : "parity";
  const cls = !s || !outside ? "" : lower ? tone.better : tone.worse;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${cls}`}>{text}</div>
      {s && (
        <>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            geometric mean of per-chart ratios {s.geo.toFixed(2)} (per run {s.geoRange[0].toFixed(2)}–{s.geoRange[1].toFixed(2)}), median {s.medianRatio.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {s.charts} charts: {s.lower} lower, {s.parity} parity, {s.higher} higher for migrated
          </p>
        </>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function HeadlineCards({ items, cols = 4 }: { items: Headline[]; cols?: 2 | 3 | 4 }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <div className={`grid gap-4 ${grid}`}>
      {items.map((h) => (
        <HeadlineCard key={h.label} h={h} />
      ))}
    </div>
  );
}
