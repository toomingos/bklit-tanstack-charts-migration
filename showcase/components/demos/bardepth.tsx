"use client";

import type { BklitCharts as BklitModule, ImplCharts, MigratedCharts as MigratedModule } from "./impl-charts";
import { defaultDemoControls, type DemoControls } from "@/components/demo-controls";
import { barChartDocsData } from "@/lib/docs-data";

interface BarDepthDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
  controls?: DemoControls;
}

// bklit's front-face trim is driven by `perspective` on the base <Bar>;
// migrated's is automatic once a <BarDepthProvider> config child is
// present (no `perspective` prop on migrated's Bar) — a genuine API gap,
// so the JSX branches per impl rather than forcing identical props.
export default function BarDepthDemo({ impl, charts, n: _n, controls = defaultDemoControls }: BarDepthDemoProps) {
  if (impl === "bklit") {
    const BklitCharts = charts as typeof BklitModule;
    return (
      <BklitCharts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
        <BklitCharts.Grid horizontal />
        <BklitCharts.BarDepthBack dataKey="revenue" color="var(--chart-1)" />
        <BklitCharts.Bar dataKey="revenue" fill="var(--chart-1)" perspective />
        <BklitCharts.BarDepthFront dataKey="revenue" />
        <BklitCharts.BarPulse dataKey="revenue" activeIndex={barChartDocsData.length - 1} pulsePaused={!controls.pulse} />
        <BklitCharts.BarXAxis />
        <BklitCharts.ChartTooltip />
      </BklitCharts.BarChart>
    );
  }

  const MigratedCharts = charts as typeof MigratedModule;
  return (
    <MigratedCharts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.BarDepthProvider groundShadow={0.26}>
        <MigratedCharts.BarDepthBack dataKey="revenue" color="var(--chart-1)" />
        <MigratedCharts.Bar dataKey="revenue" fill="var(--chart-1)" />
        <MigratedCharts.BarDepthFront dataKey="revenue" />
        <MigratedCharts.BarPulse dataKey="revenue" activeIndex={barChartDocsData.length - 1} pulsePaused={!controls.pulse} />
      </MigratedCharts.BarDepthProvider>
      <MigratedCharts.BarXAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.BarChart>
  );
}
