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

export function HeadlineCards({ items }: { items: Headline[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((h) => (
        <HeadlineCard key={h.label} h={h} />
      ))}
    </div>
  );
}
