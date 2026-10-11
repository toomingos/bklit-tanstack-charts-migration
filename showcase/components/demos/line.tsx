"use client";

import type { ImplCharts } from "./impl-charts";
import { defaultDemoControls, type DemoControls } from "@/components/demo-controls";
import { lineChartDocsData, lineChartDocsMarkers } from "@/lib/docs-data";

interface LineDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
  controls?: DemoControls;
}

export default function LineDemo({ impl, charts, n: _n, controls = defaultDemoControls }: LineDemoProps) {
  const Charts = charts;
  const loadingStyle = controls.sweep ? "sweep" : "pulse";

  if (controls.loading === "component") {
    return <Charts.LineChartLoading aspectRatio="2/1" loadingStyle={loadingStyle} />;
  }

  return (
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1" status={controls.loading === "status" ? "loading" : "ready"}>
      <Charts.Grid horizontal />
      <Charts.Line dataKey="users" stroke="var(--chart-line-primary)" loadingStyle={loadingStyle} />
      <Charts.Line dataKey="pageviews" stroke="var(--chart-line-secondary)" loadingStyle={loadingStyle} />
      <Charts.XAxis />
      <Charts.ChartTooltip />
      <Charts.ChartMarkers
        items={lineChartDocsMarkers.map((marker) => ({
          ...marker,
          target: marker.target as "_blank" | "_self",
        }))}
      />
    </Charts.LineChart>
  );
}
