"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { scatterChartDocsData } from "@/lib/docs-data";

interface ScatterDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function ScatterDemo({ impl, n }: ScatterDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <Charts.ScatterChart data={scatterChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.Scatter dataKey="sessions" />
      <Charts.Scatter dataKey="conversions" />
      <Charts.XAxis />
      <Charts.ChartTooltip />
    </Charts.ScatterChart>
  );
}
