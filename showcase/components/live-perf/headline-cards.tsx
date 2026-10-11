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

export interface Headline {
  label: string;
  /** ms per side; null until measured */
  bklit: number | null;
  migrated: number | null;
  /** migrated / bklit; defaults to the ratio of the two values (the overview passes the per-chart geometric mean) */
  ratio?: number;
  digits?: number;
  /** caption shown while either value is null */
  pending?: string;
}

const fmtMs = (v: number, digits = 1) =>
  `${v >= 1000 ? Math.round(v).toLocaleString("en-US") : Number.isInteger(v) ? v : v.toFixed(digits)} ms`;

const fmtStat = (s: Stat, digits = 1) => `${fmtMs(s[0], digits)} (${s[1]}–${s[2]})`;

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
        {b[0]} → {m[0]}{tol?.diff && (b[0] < 0 || m[0] < 0) ? " ⚠" : ""}
      </span>
    </td>
  );
}

/** Main figure: the migrated/bklit multiplier, faster or slower; below it the ms on each side and their difference. */
function HeadlineCard({ h }: { h: Headline }) {
  const { bklit: b, migrated: m } = h;
  const ready = b !== null && m !== null;
  const r = ready ? (h.ratio ?? (b > 0 && m > 0 ? m / b : null)) : null;
  const faster = r !== null ? r < 1 : ready && m < b;
  const x = r === null ? 0 : faster ? 1 / r : r;
  const main = !ready ? "—" : r === null ? signedMs(m - b) : `${x.toFixed(2)}× ${faster ? "faster" : "slower"}`;
  const cls = !ready || (r !== null && x < 1.05) ? "" : faster ? tone.better : tone.worse;
  const d = h.digits ?? 1;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{h.label}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${cls}`}>{main}</div>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {ready ? `bklit ${b.toFixed(d)} ms → migrated ${m.toFixed(d)} ms (${signedMs(m - b, d)})` : (h.pending ?? "")}
      </p>
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
