"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { areaChartDocsData } from "@/lib/docs-data";

interface AreaDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function AreaDemo({ impl, n }: AreaDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <Charts.AreaChart data={areaChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.Area dataKey="revenue" fill="var(--chart-line-primary)" fillOpacity={0.3} fadeEdges />
      <Charts.Area dataKey="costs" fill="var(--chart-line-secondary)" fillOpacity={0.3} fadeEdges />
      <Charts.XAxis />
      <Charts.ChartTooltip />
    </Charts.AreaChart>
  );
}
