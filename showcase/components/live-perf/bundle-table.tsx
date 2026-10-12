import { bundleBreakdown, bundleCssKb, bundleSizes, bundleTotal } from "./bundle-data";
import { CompareCell, type Stat } from "./headline-cards";

const stat = (v: number): Stat => [v, v, v];

const th = "whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground";
const kb = (v: number) => `${v.toFixed(1)} KB`;

function Row({ label, gzip, strong }: { label: string; gzip: readonly [number, number]; strong?: boolean }) {
  return (
    <tr className={strong ? "bg-muted/30 font-medium" : undefined}>
      <td className="px-3 py-2.5">{label}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{kb(gzip[0])}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{kb(gzip[1])}</td>
      <CompareCell b={stat(gzip[0])} m={stat(gzip[1])} tol={{ rel: 0.05, abs: 0 }} />
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
        stylesheet.
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
            <Row label="Mean per chart" gzip={bundleTotal} strong />
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Breakdown title="Bklit UI, all charts, minified" items={bundleBreakdown.bklit} />
        <Breakdown title="TanStack Bklit UI, all charts, minified" items={bundleBreakdown.migrated} />
      </div>
    </section>
  );
}
