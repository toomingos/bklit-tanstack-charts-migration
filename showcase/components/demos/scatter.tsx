"use client";

import type { ImplCharts } from "./impl-charts";
import { scatterChartDocsData } from "@/lib/docs-data";

interface ScatterDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function ScatterDemo({ impl, charts, n: _n }: ScatterDemoProps) {
  const Charts = charts;

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
