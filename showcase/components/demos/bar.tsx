"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { defaultDemoControls, type DemoControls } from "@/components/demo-controls";
import { barChartDocsData } from "@/lib/docs-data";

interface BarDemoProps {
  impl: "bklit" | "migrated";
  n: number;
  controls?: DemoControls;
}

export default function BarDemo({ impl, n: _n, controls = defaultDemoControls }: BarDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  if (controls.loading === "component") {
    return <Charts.BarChartLoading aspectRatio="2/1" />;
  }

  return (
    <Charts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1" status={controls.loading === "status" ? "loading" : "ready"}>
      <Charts.Grid horizontal />
      <Charts.Bar dataKey="revenue" fill="var(--chart-line-primary)" lineCap="round" />
      <Charts.Bar dataKey="profit" fill="var(--chart-line-secondary)" lineCap="round" />
      <Charts.BarXAxis />
      <Charts.ChartTooltip />
    </Charts.BarChart>
  );
}
