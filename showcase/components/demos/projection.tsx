"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { lineChartDocsData } from "@/lib/docs-data";

function buildProjectionData(impl: "bklit" | "migrated") {
  const builder = impl === "bklit" ? BklitCharts.buildProjectionPath : MigratedCharts.buildProjectionPath;
  const targetPath = builder({
    sourceData: lineChartDocsData as unknown as Record<string, unknown>[],
    seriesKey: "users",
    mode: "target",
    pathDensity: "endpoints",
    horizonPoints: 6,
    endValue: 301,
  });
  const autoPath = builder({
    sourceData: lineChartDocsData as unknown as Record<string, unknown>[],
    seriesKey: "users",
    mode: "auto",
    autoMethod: "lastSegment",
    pathDensity: "endpoints",
    horizonPoints: 6,
  });
  return { targetPath, autoPath };
}

export function ProjectionDemo1({ impl }: { impl: "bklit" | "migrated" }) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const { targetPath, autoPath } = buildProjectionData(impl);
  return (
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <Charts.LineSeriesTerminalMarker dataKey="users" ringGap={6} stroke="var(--chart-1)" />
      <Charts.ProjectionLine curveKind="bezier" data={targetPath} gradientEnd="var(--chart-5)" gradientStart="var(--chart-3)" showEndMarker stroke="var(--chart-3)" strokeDasharray="1,4" strokeStyle="gradient" strokeWidth={2} />
      <Charts.ProjectionLine curveKind="bezier" data={autoPath} gradientEnd="var(--chart-5)" gradientStart="var(--chart-3)" showEndMarker stroke="var(--chart-3)" strokeDasharray="1,4" strokeStyle="gradient" strokeWidth={2} />
      <Charts.XAxis />
      <Charts.ChartTooltip />
    </Charts.LineChart>
  );
}

// Registry entry point (chart-stage.tsx / lib/chart-data.ts route
// "projection"): ProjectionDemo1's config (target + auto projection paths),
// dual-rendered. `n` is unused — this demo is fixed-data.
export default function ProjectionDemo({ impl, n: _n }: { impl: "bklit" | "migrated"; n: number }) {
  return <ProjectionDemo1 impl={impl} />;
}

export function ProjectionDemo2({ impl }: { impl: "bklit" | "migrated" }) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const { autoPath } = buildProjectionData(impl);
  return (
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <Charts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <Charts.LineSeriesTerminalMarker dataKey="users" stroke="var(--chart-1)" />
      <Charts.ProjectionLine curveKind="bezier" data={autoPath} gradientEnd="var(--chart-5)" gradientStart="var(--chart-3)" showEndMarker={false} stroke="var(--chart-3)" strokeStyle="gradient" strokeWidth={2} />
      <Charts.XAxis />
      <Charts.ChartTooltip />
    </Charts.LineChart>
  );
}
