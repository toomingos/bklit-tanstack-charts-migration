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
        <a
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 font-medium text-sm no-underline transition-colors hover:bg-muted"
          href="https://github.com/toomingos/bklit-tanstack-charts-migration/tree/main/showcase/components/live-perf"
          rel="noopener noreferrer"
          target="_blank"
        >
          <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          View benchmark code on GitHub
        </a>
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
