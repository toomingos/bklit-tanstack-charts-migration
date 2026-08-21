"use client";

import { curveCatmullRom } from "@visx/curve";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { composedDocsData } from "@/lib/docs-data";

const smoothCurve = curveCatmullRom.alpha(0.42);

interface ComposedDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function ComposedDemo({ impl, n: _n }: ComposedDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <Charts.ComposedChart aspectRatio="2 / 1" barGap={0} data={composedDocsData} maxBarSize={32} xDataKey="date">
      <Charts.Grid horizontal />
      <Charts.Area curve={smoothCurve} dataKey="runRate" fill="var(--chart-4)" fillOpacity={0.32} />
      <Charts.SeriesBar dataKey="units" fill="var(--chart-3)" radius={4} />
      <Charts.Line curve={smoothCurve} dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} />
      <Charts.ChartTooltip showCrosshair={false} />
      <Charts.XAxis numTicks={8} />
    </Charts.ComposedChart>
  );
}
