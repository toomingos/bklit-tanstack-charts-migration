"use client";

import * as React from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { lineChartDocsData, areaChartDocsData } from "@/lib/docs-data";
import type { ChartSelection } from "@showcase/migrated-charts";

interface SegmentDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

// Registry entry point (chart-stage.tsx / lib/chart-data.ts route
// "segment"): the SegmentLineDemo config, dual-rendered. The stats overlay
// below reads MigratedCharts.ChartSelectionContext, which bklit does not
// export as a value (only the `ChartSelection` type) — an API gap limited
// to this optional decoration, not to the segment components themselves
// (SegmentBackground/SegmentLineFrom/SegmentLineTo are identical on both
// sides), so the wrapper renders the core segment chart for both impls and
// skips the stats readout rather than touching chart internals.
export default function SegmentDemo({ impl, n: _n }: SegmentDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  return (
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <Charts.XAxis />
      <Charts.ChartTooltip />
      <Charts.SegmentBackground />
      <Charts.SegmentLineFrom />
      <Charts.SegmentLineTo />
    </Charts.LineChart>
  );
}

function SegmentStats({ dataKey, data }: { dataKey: string; data: Array<Record<string, unknown>> }) {
  const selection = React.useContext(MigratedCharts.ChartSelectionContext) as ChartSelection | null;
  if (!selection?.active || Math.abs(selection.endX - selection.startX) <= 5) return null;
  const s = Math.max(0, selection.startIndex);
  const e = Math.min(data.length - 1, selection.endIndex);
  if (s >= e) return null;
  const sv = data[s]?.[dataKey];
  const ev = data[e]?.[dataKey];
  if (typeof sv !== "number" || typeof ev !== "number") return null;
  const delta = ev - sv;
  return (
    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
      {s} → {e}: {delta >= 0 ? "+" : ""}{delta.toFixed(0)} ({sv} → {ev})
    </div>
  );
}

export function SegmentLineDemo() {
  return (
    <div>
      <MigratedCharts.LineChart data={lineChartDocsData} aspectRatio="2/1">
        <MigratedCharts.Grid horizontal />
        <MigratedCharts.Line dataKey="users" stroke="var(--chart-line-primary)" />
        <MigratedCharts.XAxis />
        <MigratedCharts.ChartTooltip />
        <MigratedCharts.SegmentBackground />
        <MigratedCharts.SegmentLineFrom />
        <MigratedCharts.SegmentLineTo />
        <SegmentStats dataKey="users" data={lineChartDocsData as unknown as Array<Record<string, unknown>>} />
      </MigratedCharts.LineChart>
    </div>
  );
}

export function SegmentAreaDemo() {
  return (
    <div>
      <MigratedCharts.AreaChart data={areaChartDocsData} aspectRatio="2/1">
        <MigratedCharts.Grid horizontal />
        <MigratedCharts.Area dataKey="revenue" fill="var(--chart-line-primary)" fillOpacity={0.3} />
        <MigratedCharts.XAxis />
        <MigratedCharts.ChartTooltip />
        <MigratedCharts.SegmentBackground />
        <MigratedCharts.SegmentLineFrom variant="gradient" />
        <MigratedCharts.SegmentLineTo variant="gradient" />
        <SegmentStats dataKey="revenue" data={areaChartDocsData as unknown as Array<Record<string, unknown>>} />
      </MigratedCharts.AreaChart>
    </div>
  );
}

export function LiveLineReferenceBandDemo() {
  const now = Date.now() / 1000;
  const data = Array.from({ length: 20 }, (_, i) => ({ time: now - (20 - i) * 2, value: 140 + Math.sin(i) * 8 }));
  const [liveData] = React.useState(data);
  const [value] = React.useState(142);
  return (
    <MigratedCharts.LiveLineChart data={liveData} value={value} window={30}>
      <MigratedCharts.LiveLine dataKey="value" stroke="var(--chart-line-primary)" />
      <MigratedCharts.ReferenceArea y1={138} y2={148} strokeStyle="dashed" showMarkers />
      <MigratedCharts.LiveXAxis />
      <MigratedCharts.LiveYAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.LiveLineChart>
  );
}
