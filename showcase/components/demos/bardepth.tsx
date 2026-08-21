"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { barChartDocsData } from "@/lib/docs-data";

interface BarDepthDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

// bklit's front-face trim is driven by `perspective` on the base <Bar>;
// migrated's is automatic once a <BarDepthProvider> config child is
// present (no `perspective` prop on migrated's Bar) — a genuine API gap,
// so the JSX branches per impl rather than forcing identical props.
export default function BarDepthDemo({ impl, n: _n }: BarDepthDemoProps) {
  if (impl === "bklit") {
    return (
      <BklitCharts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
        <BklitCharts.Grid horizontal />
        <BklitCharts.BarDepthBack dataKey="revenue" color="var(--chart-1)" />
        <BklitCharts.Bar dataKey="revenue" fill="var(--chart-1)" perspective />
        <BklitCharts.BarDepthFront dataKey="revenue" />
        <BklitCharts.BarPulse dataKey="revenue" activeIndex={barChartDocsData.length - 1} pulsePaused />
        <BklitCharts.BarXAxis />
        <BklitCharts.ChartTooltip />
      </BklitCharts.BarChart>
    );
  }

  return (
    <MigratedCharts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
      <MigratedCharts.BarDepthProvider groundShadow={0.26} />
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.BarDepthBack dataKey="revenue" color="var(--chart-1)" />
      <MigratedCharts.Bar dataKey="revenue" fill="var(--chart-1)" />
      <MigratedCharts.BarDepthFront dataKey="revenue" />
      <MigratedCharts.BarPulse dataKey="revenue" activeIndex={barChartDocsData.length - 1} pulsePaused />
      <MigratedCharts.BarXAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.BarChart>
  );
}
