"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { lineChartDocsData, lineChartDocsMarkers } from "@/lib/docs-data";

interface LineDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function LineDemo({ impl, n }: LineDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <Charts.Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
      <Charts.XAxis />
      <Charts.ChartTooltip />
      {impl === "bklit" && <Charts.ChartMarkers items={lineChartDocsMarkers} />}
    </Charts.LineChart>
  );
}
