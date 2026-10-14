import type { Metadata } from "next";
import Link from "next/link";
import { allCharts } from "@/lib/chart-data";
import { bundleCssKb, bundleFor } from "@/components/live-perf/bundle-data";
import { HeadlineCards, PctCell, type Stat } from "@/components/live-perf/headline-cards";
import { BKLIT_SHA, chartPair, sweepMeta } from "@/components/live-perf/headline-data";
import { summaryHeadlines } from "@/components/live-perf/summary-headlines";

export const metadata: Metadata = { title: "Benchmarks" };

const th = "whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground";
const size = (v: number): Stat => [v, v, v];

export default function BenchmarksPage() {
  return (
    <div>
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Benchmarks</h1>
        <p className="mt-2 max-w-3xl text-pretty text-muted-foreground">
          Bklit TanStack Charts against Bklit UI on all {allCharts.length} charts, with the same data and the same design. Each figure
          is the change from Bklit UI, so a negative number means less time, less work or a smaller bundle. Charts render faster
          and do less work on hover; bundles are currently larger.
        </p>
      </section>

      <section className="mb-10">
        <HeadlineCards items={summaryHeadlines} />
      </section>

      <section>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Chart</th>
                <th className={th}>Time to Render</th>
                <th className={th}>On hover</th>
                <th className={th}>Bundle Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allCharts.map((chart) => {
                const render = chartPair(chart.route, "render");
                const busy = chartPair(chart.route, "busy");
                const kb = bundleFor(chart.name);
                return (
                  <tr key={chart.index} className="transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <Link href={`/charts/${chart.route}`} className="font-medium no-underline hover:underline">
                        {chart.name}
                      </Link>
                    </td>
                    <PctCell b={render?.b ?? null} m={render?.m ?? null} unit="ms" />
                    <PctCell b={busy?.b ?? null} m={busy?.m ?? null} unit="ms" />
                    <PctCell b={kb ? size(kb[0]) : null} m={kb ? size(kb[1]) : null} unit="KB" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Cells show the change and the median of each side. Green marks a gain; hover a cell for the range across runs.
          Composition has no designed entrance, so no Time to Render.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Method: {sweepMeta.date}, {sweepMeta.build}, {sweepMeta.runs} interleaved runs with both charts on one page, {sweepMeta.movesPerSide} pointer moves per side
          per run, bklit-ui {BKLIT_SHA}, TanStack Charts 1.1.0, {sweepMeta.machine}, {sweepMeta.viewport}. The cards at the top are geometric means of the per-chart changes.
          Bundle sizes: esbuild, minified, tree-shaken, React external, one bundle per chart; Bklit TanStack Charts also ships {bundleCssKb} KB gzip of shared CSS.
        </p>
      </section>
    </div>
  );
}
