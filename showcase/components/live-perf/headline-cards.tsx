/** median, min, max across runs (or across 10-move slices, live) */
export type Stat = readonly [median: number, min: number, max: number];

/** Parity band used when a stat has no spread: both values within this relative or absolute distance. */
export interface Tolerance {
  rel: number;
  abs: number;
  /** small signed values: both ranges are widened by `abs` and the verdict is the ms difference, not a ratio */
  diff?: true;
}
export const DEFAULT_TOL: Tolerance = { rel: 0.1, abs: 0.5 };

function widen(s: Stat, tol: Tolerance): readonly [number, number] {
  if (s[2] > s[1]) return [s[1], s[2]];
  const d = Math.max(tol.abs, s[0] * tol.rel);
  return [s[0] - d, s[0] + d];
}

const signedMs = (v: number, digits = 1) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(digits)} ms`;

/** Lower is better. "parity" when the two ranges overlap; a ratio only when they do not. */
export function compare(b: Stat, m: Stat, tol: Tolerance = DEFAULT_TOL) {
  const [bl, bh] = tol.diff ? [b[1] - tol.abs, b[2] + tol.abs] : widen(b, tol);
  const [ml, mh] = tol.diff ? [m[1] - tol.abs, m[2] + tol.abs] : widen(m, tol);
  if (ml <= bh && bl <= mh) return { text: "parity", tone: "parity" as const };
  if (tol.diff) {
    const d = m[0] - b[0];
    return { text: signedMs(d), tone: d < 0 ? ("better" as const) : ("worse" as const) };
  }
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

/** TanStack Bklit UI against Bklit UI as a signed percentage of bklit's value; negative is less time, work or size. */
export function pct(ratio: number) {
  const p = Math.round((ratio - 1) * 100);
  return p === 0 ? "0%" : `${p < 0 ? "−" : "+"}${Math.abs(p)}%`;
}

const fmt = (v: number, unit: string, digits = 1) => `${Number.isInteger(v) ? v : v.toFixed(digits)} ${unit}`;

/** Table cell for one metric of one chart; null means not measured. Coloured only when the two run ranges do not overlap. */
export function PctCell({ b, m, tol, unit }: { b: Stat | null; m: Stat | null; tol?: Tolerance; unit: string }) {
  if (!b || !m) return <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">n/a</td>;
  const c = compare(b, m, tol);
  const ranged = b[2] > b[1];
  return (
    <td
      className={`px-3 py-2.5 text-right tabular-nums ${tone[c.tone]}`}
      title={ranged ? `Bklit UI ${fmt(b[0], unit, 2)} (${b[1]}–${b[2]}); TanStack Bklit UI ${fmt(m[0], unit, 2)} (${m[1]}–${m[2]})` : undefined}
    >
      {pct(m[0] / Math.max(b[0], 1e-9))}
      <span className="block text-[11px] font-normal text-muted-foreground">
        {b[0]} → {m[0]} {unit}
      </span>
    </td>
  );
}

export interface Headline {
  label: string;
  /** per side, in `unit`; null until measured */
  bklit: number | null;
  migrated: number | null;
  unit: string;
  /** migrated / bklit; defaults to the ratio of the two values (the overview passes the per-chart geometric mean) */
  ratio?: number;
  digits?: number;
  /** caption shown while either value is null */
  pending?: string;
}

/** Main figure: the signed percentage change; below it Bklit UI → TanStack Bklit UI. */
function HeadlineCard({ h }: { h: Headline }) {
  const { bklit: b, migrated: m } = h;
  const ready = b !== null && m !== null && b > 0;
  const r = ready ? (h.ratio ?? m / b) : null;
  const cls = r === null || Math.abs(r - 1) < 0.05 ? "" : r < 1 ? tone.better : tone.worse;
  const d = h.digits ?? 1;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{h.label}</div>
      <div className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums ${cls}`}>{r === null ? "—" : pct(r)}</div>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {ready ? `${fmt(b, h.unit, d)} → ${fmt(m, h.unit, d)}` : (h.pending ?? "")}
      </p>
    </div>
  );
}

export function HeadlineCards({ items }: { items: Headline[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((h) => (
        <HeadlineCard key={h.label} h={h} />
      ))}
    </div>
  );
}
