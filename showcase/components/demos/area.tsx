"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { defaultDemoControls, type DemoControls } from "@/components/demo-controls";
import { areaChartDocsData } from "@/lib/docs-data";

interface AreaDemoProps {
  impl: "bklit" | "migrated";
  n: number;
  controls?: DemoControls;
}

export default function AreaDemo({ impl, n: _n, controls = defaultDemoControls }: AreaDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const loadingStyle = controls.sweep ? "sweep" : "pulse";

  if (controls.loading === "component") {
    return <Charts.AreaChartLoading aspectRatio="2/1" loadingStyle={loadingStyle} />;
  }

  return (
    <Charts.AreaChart data={areaChartDocsData} aspectRatio="2/1" status={controls.loading === "status" ? "loading" : "ready"}>
      <Charts.Grid horizontal />
      <Charts.Area dataKey="revenue" fill="var(--chart-line-primary)" fillOpacity={0.3} fadeEdges loadingStyle={loadingStyle} />
      <Charts.Area dataKey="costs" fill="var(--chart-line-secondary)" fillOpacity={0.3} fadeEdges loadingStyle={loadingStyle} />
      <Charts.XAxis />
      <Charts.ChartTooltip />
    </Charts.AreaChart>
  );
}
