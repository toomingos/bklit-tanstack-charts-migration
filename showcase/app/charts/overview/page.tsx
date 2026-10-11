import Link from "next/link";
import { allCharts } from "@/lib/chart-data";
import { BundleTable } from "@/components/live-perf/bundle-table";
import { bundleCssKb, bundleSizes, bundleTotal } from "@/components/live-perf/bundle-data";
import { CompareCell, compare, SummaryCard, type Tolerance } from "@/components/live-perf/headline-cards";
import { BKLIT_SHA, type Metric, chartPair, summarise, sweepMeta } from "@/components/live-perf/headline-data";

const LAT_TOL: Tolerance = { rel: 0.1, abs: 3 };
const BUSY_TOL: Tolerance = { rel: 0.1, abs: 0.3 };
const cols: { metric: Metric; head: string; tol?: Tolerance }[] = [
  { metric: "firstPaint", head: "First paint" },
  { metric: "settled", head: "Settled" },
  { metric: "busy", head: "Main-thread busy per move", tol: BUSY_TOL },
  { metric: "latency", head: "Move to paint p95", tol: LAT_TOL },
];

const routes = allCharts.map((c) => c.route);
const th = "whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground";

/** Charts where the migrated range sits outside bklit's on a metric, in the direction that is worse for migrated. */
function regressions() {
  const out: { name: string; route: string; metric: string; text: string }[] = [];
  for (const c of allCharts) {
    for (const col of cols) {
      const p = chartPair(c.route, col.metric);
      if (!p) continue;
      const v = compare(p.b, p.m, col.tol);
      if (v.tone === "worse") out.push({ name: c.name, route: c.route, metric: col.head, text: `${v.text} (${p.b[0]} → ${p.m[0]} ms)` });
    }
  }
  return out;
}

export default function OverviewPage() {
  const bad = regressions();
  const [allB, allM] = bundleTotal;
  const bundleRows = bundleSizes.map((r) => [r.label, r.gzip] as const);
  const bigger = bundleRows.filter(([, [b, m]]) => m > b * 1.05).length;
  const smaller = bundleRows.filter(([, [b, m]]) => m < b * 0.95).length;
  return (
    <div>
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-muted-foreground">
          {allCharts.length} charts, each rendered as Bklit UI and TanStack Bklit UI side by side with live performance measurements.
        </p>
        <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Method: {sweepMeta.date}, {sweepMeta.build}, {sweepMeta.runs} interleaved runs (bklit first, then migrated first), {sweepMeta.movesPerSide} pointer
          moves per side per run ({sweepMeta.events}), bklit-ui {BKLIT_SHA}, TanStack Charts 1.1.0, {sweepMeta.machine}, {sweepMeta.viewport}. Each cell is the median
          of the runs with min–max; a ratio is shown only where the two ranges do not overlap, otherwise parity. Summaries are geometric means of per-chart ratios,
          never sums.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">What users feel (production, whole main thread)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="First paint" note="mount to first presented frame with chart content" s={summarise(routes, "firstPaint")} />
          <SummaryCard label="Settled (entrance end)" note="no DOM mutation or finite animation for 150 ms" s={summarise(routes, "settled")} />
          <SummaryCard label="Main-thread busy per pointer move" note="all task gaps over 1 ms while hovered: script, style, layout, paint" s={summarise(routes, "busy", 0.05)} />
          <SummaryCard label="Move to paint, p95" note="pointermove timestamp to the next presented frame" s={summarise(routes, "latency")} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Where migrated is not better</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">Cells where migrated is outside bklit&apos;s range, on the worse side</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{bad.length}</div>
            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {bad.length === 0 && <li>None in this sweep.</li>}
              {bad.map((r) => (
                <li key={`${r.route}-${r.metric}`}>
                  <Link href={`/charts/${r.route}`} className="no-underline hover:underline">{r.name}</Link>, {r.metric.toLowerCase()}: {r.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">Bundle size, all charts, gzip</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-red-600/90 dark:text-red-400/90">
              {(allM / allB).toFixed(2)}× more
            </div>
            <p className="mt-2 text-sm text-muted-foreground tabular-nums">
              bklit {allB} KB · migrated {allM} KB, plus {bundleCssKb} KB gzip CSS. Per chart: {bigger} larger, {smaller} smaller, {bundleRows.length - bigger - smaller} within 5%.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              esbuild, minified, tree-shaken, react external, one bundle per chart.
            </p>
          </div>
        </div>
      </section>

      <BundleTable />

      <section>
        <h2 className="mb-1 text-lg font-semibold tracking-tight">All charts</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Each cell: verdict, then median bklit → median migrated (ms). Hover a cell for the min–max across runs. The same {sweepMeta.runs} runs feed every column.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Chart</th>
                {cols.map((c) => (
                  <th key={c.metric} className={th}>{c.head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allCharts.map((chart) => (
                <tr key={chart.index} className="transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{chart.index}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/charts/${chart.route}`} className="font-medium no-underline hover:underline">
                      {chart.name}
                    </Link>
                  </td>
                  {cols.map((c) => {
                    const p = chartPair(chart.route, c.metric);
                    return <CompareCell key={c.metric} b={p?.b ?? null} m={p?.m ?? null} tol={c.tol} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          React render time is not a headline: the migrated charts write hover state to CSS variables, so React renders little by design. It is shown live, labelled as
          React work, in the Live Perf panel of a dev build.
        </p>
      </section>
    </div>
  );
}
