"use client";

import type { ImplCharts } from "./impl-charts";
import { defaultDemoControls, type DemoControls } from "@/components/demo-controls";
import { barChartDocsData } from "@/lib/docs-data";

interface BarDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
  controls?: DemoControls;
}

export default function BarDemo({ impl, charts, n: _n, controls = defaultDemoControls }: BarDemoProps) {
  const Charts = charts;

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
