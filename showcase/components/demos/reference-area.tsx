"use client";

import type { ImplCharts } from "./impl-charts";
import { lineChartDocsData } from "@/lib/docs-data";

interface ReferenceAreaDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

// Registry entry point (chart-stage.tsx / lib/chart-data.ts route
// "reference-area"): the ReferenceAreaBandDemo config, dual-rendered.
// The named exports below stay migrated-only, unchanged, for any other
// caller that imports them directly.
export default function ReferenceAreaDemo({ impl, charts, n: _n }: ReferenceAreaDemoProps) {
  const Charts = charts;
  return (
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.ReferenceArea y1={1200} y2={1800} showMarkers strokeStyle="dashed" />
      <Charts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <Charts.XAxis />
      <Charts.ChartTooltip />
    </Charts.LineChart>
  );
}
