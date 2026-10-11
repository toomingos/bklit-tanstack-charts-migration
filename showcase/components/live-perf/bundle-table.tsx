import { bundleBreakdown, bundleCssKb, bundleSizes, bundleTotal, prodPerf } from "./bundle-data";
import { GainCell } from "./headline-cards";

const th = "whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground";
const kb = (v: number) => `${v.toFixed(1)} KB`;

function Row({ label, gzip, strong }: { label: string; gzip: readonly [number, number]; strong?: boolean }) {
  return (
    <tr className={strong ? "bg-muted/30 font-medium" : undefined}>
      <td className="px-3 py-2.5">{label}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{kb(gzip[0])}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{kb(gzip[1])}</td>
      <GainCell pair={gzip} kind="less" />
    </tr>
  );
}

function Breakdown({ title, items }: { title: string; items: readonly (readonly [string, number])[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="text-sm text-muted-foreground">{title}</div>
      <ul className="mt-3 space-y-1.5 text-sm tabular-nums">
        {items.map(([name, size]) => (
          <li key={name} className="flex justify-between gap-4">
            <span>{name}</span>
            <span className="text-muted-foreground">{size} KB</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Production bundle size, one chart per row, gzip. */
export function BundleTable() {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold tracking-tight">JS shipped per chart</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Minified and gzipped, tree-shaken production bundle of one chart with its common parts, React excluded. The migrated charts also share a {bundleCssKb} KB gzip
        stylesheet. The timing figures above are from the Chrome dev server; the production-build figures below are labeled.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Chart</th>
              <th className={th}>Bklit UI</th>
              <th className={th}>TanStack Bklit UI</th>
              <th className={th}>Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bundleSizes.map((s) => (
              <Row key={s.label} label={s.label} gzip={s.gzip} />
            ))}
            <Row label="All charts" gzip={bundleTotal} strong />
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Breakdown title="Bklit UI, all charts, minified" items={bundleBreakdown.bklit} />
        <Breakdown title="TanStack Bklit UI, all charts, minified" items={bundleBreakdown.migrated} />
      </div>
      <h2 className="mt-10 text-lg font-semibold tracking-tight">Production build timings</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Same measurements on a production build with React profiling on, so numbers differ from the dev figures above. React render drops for both, but main-thread work per pointer
        move is higher for TanStack Bklit UI on most cartesian charts: TanStack's interaction dispatch costs about 0.3 to 1.3 ms per move and does not shrink in production.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Chart</th>
              <th className={th}>Render on load</th>
              <th className={th}>React render on hover</th>
              <th className={th}>Compute per move</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {prodPerf.map((r) => (
              <tr key={r.label}>
                <td className="px-3 py-2.5">{r.label}</td>
                <GainCell pair={r.load} kind="faster" />
                <GainCell pair={r.hover} kind="less" />
                <GainCell pair={r.move} kind="faster" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
