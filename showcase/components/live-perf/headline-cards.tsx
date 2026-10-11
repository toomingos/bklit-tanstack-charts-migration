import { SETTLE_TOLERANCE_MS, type SettleRow, type SettleSummary } from "./headline-data";

export interface Headline {
  label: string;
  /** "faster" reads for times, "less" for amounts of work */
  kind: "faster" | "less";
  bklit: number | null;
  migrated: number | null;
  digits?: number;
  /** caption shown while either value is null */
  pending?: string;
}

const fmtMs = (v: number, digits = 1) =>
  `${v >= 1000 ? Math.round(v).toLocaleString("en-US") : Number.isInteger(v) ? v : v.toFixed(digits)} ms`;

/** Lower is better. A 2× or larger change reads as "N× faster/slower"; a smaller one as "−N%" / "+N%". */
function change(b: number, m: number, kind: Headline["kind"]) {
  const better = m <= b;
  const x = better ? (m > 0 ? b / m : Number.POSITIVE_INFINITY) : m / b;
  if (x < 2) return { text: `${better ? "−" : "+"}${Math.round((Math.abs(m - b) / b) * 100)}%`, better };
  const n = x === Number.POSITIVE_INFINITY ? "∞" : x >= 10 ? Math.round(x) : x.toFixed(1);
  return { text: `${n}× ${better ? kind : kind === "less" ? "more" : "slower"}`, better };
}

/** Table cell for one headline metric; null pair means not measured. */
export function GainCell({ pair, kind }: { pair: readonly [number, number] | null; kind: Headline["kind"] }) {
  const [b, m] = pair ?? [0, 0];
  if (b <= 0) return <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">—</td>;
  if (m <= 0) return <td className="px-3 py-2.5 text-right tabular-nums">No re-render</td>;
  const c = change(b, m, kind);
  return <td className={`px-3 py-2.5 text-right tabular-nums ${c.better ? "" : "text-red-600/80 dark:text-red-400/80"}`}>{c.text}</td>;
}

function HeadlineCard({ h }: { h: Headline }) {
  const ready = h.bklit !== null && h.migrated !== null && h.bklit > 0;
  const c = ready ? change(h.bklit as number, h.migrated as number, h.kind) : null;
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="text-sm text-muted-foreground">{h.label}</div>
      <div
        className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${
          c && !c.better ? "text-red-600/80 dark:text-red-400/80" : ""
        }`}
      >
        {c ? c.text : "—"}
      </div>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {c ? `${fmtMs(h.bklit as number, h.digits)} → ${fmtMs(h.migrated as number, h.digits)}` : (h.pending ?? "")}
      </p>
    </div>
  );
}

const RED = "text-red-600/80 dark:text-red-400/80";
const signed = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(v === 0 ? 0 : 1)} ms`;

/** Absolute-difference card: overheads are small and can be negative, so no ratio. Parity: per-run range includes 0 or the mean is inside the tolerance. */
function SettleCard({ s }: { s: SettleSummary }) {
  const parity = (s.runRange[0] <= 0 && s.runRange[1] >= 0) || Math.abs(s.diff) < SETTLE_TOLERANCE_MS;
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="text-sm text-muted-foreground">Settle overhead</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${!parity && s.diff > 0 ? RED : ""}`}>
        {parity ? "parity" : signed(s.diff)}
      </div>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        Mean per chart {s.bklit.toFixed(1)} → {s.migrated.toFixed(1)} ms ({signed(s.diff)}, per run {signed(s.runRange[0])} to {signed(s.runRange[1])})
      </p>
      {s.negatives > 0 && <p className="mt-1 text-xs text-muted-foreground">{s.negatives} of {s.charts} charts ended before the designed animation.</p>}
    </div>
  );
}

/** Table cell: ms difference first, both overheads under it; negative overheads are flagged. */
export function SettleCell({ row }: { row: SettleRow | null }) {
  if (!row) return <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">—</td>;
  const flag = row.negative ? " ⚠" : "";
  return (
    <td className={`px-3 py-2.5 text-right tabular-nums ${!row.parity && row.diff > 0 ? RED : ""}`} title={row.negative ? "Negative overhead: the animation ended before its designed end." : undefined}>
      <div>{row.parity ? "parity" : signed(row.diff)}</div>
      <div className="text-xs text-muted-foreground">{row.bklit.toFixed(0)} → {row.migrated.toFixed(0)} ms{flag}</div>
    </td>
  );
}

export function HeadlineCards({ items, settle }: { items: Headline[]; settle?: SettleSummary }) {
  return (
    <div className={`grid gap-4 ${settle ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
      {items.map((h) => (
        <HeadlineCard key={h.label} h={h} />
      ))}
      {settle && <SettleCard s={settle} />}
    </div>
  );
}
