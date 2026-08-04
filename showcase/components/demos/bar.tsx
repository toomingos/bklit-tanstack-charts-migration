"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { barChartDocsData } from "@/lib/docs-data";

interface BarDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function BarDemo({ impl, n }: BarDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <Charts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.Bar dataKey="revenue" fill="var(--chart-line-primary)" lineCap="round" />
      <Charts.Bar dataKey="profit" fill="var(--chart-line-secondary)" lineCap="round" />
      <Charts.BarXAxis />
      <Charts.ChartTooltip />
    </Charts.BarChart>
  );
}
