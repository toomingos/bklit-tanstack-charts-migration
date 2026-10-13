import Link from "next/link";
import { allCharts } from "@/lib/chart-data";
import { bundleCssKb, bundleFor, bundleGeo, bundleTotal } from "@/components/live-perf/bundle-data";
import { type Headline, HeadlineCards, PctCell, type Stat } from "@/components/live-perf/headline-cards";
import { BKLIT_SHA, type Metric, chartPair, summarise, sweepMeta } from "@/components/live-perf/headline-data";


const routes = allCharts.map((c) => c.route);

/** Card figure: geometric mean of per-chart ratios; the values under it are means of the per-chart medians. */
function card(label: string, metric: Metric, digits = 1, floor = 0): Headline {
  const s = summarise(routes, metric, floor);
  return { label, bklit: s?.bklitMs ?? null, migrated: s?.migratedMs ?? null, ratio: s?.geo, unit: "ms", digits };
}
const headlines: Headline[] = [
  card("Time to Render", "render"),
  card("On hover", "busy", 2, 0.05),
  { label: "Bundle Size", bklit: bundleTotal[0], migrated: bundleTotal[1], ratio: bundleGeo, unit: "KB" },
];

const th = "whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground";
const size = (v: number): Stat => [v, v, v];

export default function OverviewPage() {
  return (
    <div>
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-muted-foreground">
          TanStack Bklit UI against Bklit UI on {allCharts.length} charts. Each figure is the change from Bklit UI: negative means less time, less work or a smaller bundle.
        </p>
      </section>

      <section className="mb-10">
        <HeadlineCards items={headlines} />
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
          per run, bklit-ui {BKLIT_SHA}, TanStack Charts 1.1.0, {sweepMeta.machine}, {sweepMeta.viewport}. Summary cards are geometric means of per-chart ratios.
          Bundle sizes: esbuild, minified, tree-shaken, React external, one bundle per chart; TanStack Bklit UI also ships {bundleCssKb} KB gzip of shared CSS.
        </p>
      </section>
    </div>
  );
}
