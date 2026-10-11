import Link from "next/link";
import { allCharts } from "@/lib/chart-data";
import { GainCell, HeadlineCards, SettleCell } from "@/components/live-perf/headline-cards";
import { chartHeadlines, settleOverhead, settleSummary, sweepHeadlines } from "@/components/live-perf/headline-data";

export default function OverviewPage() {
  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-muted-foreground">
          {allCharts.length} charts, each rendered as Bklit UI and TanStack Bklit UI side by side with live performance measurements.
        </p>
      </section>

      <section className="mb-10">
        <HeadlineCards items={sweepHeadlines} settle={settleSummary()} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">All charts</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Chart</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Render on load</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">React render on hover</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Compute per move</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Settle overhead</th>
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
                  <GainCell pair={chartHeadlines[chart.route]?.load ?? null} kind="faster" />
                  <GainCell pair={chartHeadlines[chart.route]?.hover ?? null} kind="less" />
                  <GainCell pair={chartHeadlines[chart.route]?.move ?? null} kind="faster" />
                  <SettleCell row={settleOverhead(chart.route)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Settle overhead = settled − first paint − the demo&apos;s designed entrance, in ms. Settled is the last DOM mutation or running animation; the designed
          entrance (delay + duration + stagger, springs to rest) comes from Bklit&apos;s source and is the same for both implementations, so only the time beyond
          the design is compared. Medians of 6 Chrome runs; parity when the min-max ranges overlap or the difference is under 10 ms. A negative value means the
          animation ended before its designed end (⚠).
        </p>
      </section>
    </div>
  );
}
