"use client";

import type { ImplCharts } from "./impl-charts";
import { lineChartDocsData } from "@/lib/docs-data";

function buildProjectionData(charts: ImplCharts) {
  const builder = charts.buildProjectionPath;
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

function ProjectionDemo1({ charts }: { charts: ImplCharts }) {
  const Charts = charts;
  const { targetPath, autoPath } = buildProjectionData(charts);
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
export default function ProjectionDemo({ charts, n: _n }: { impl: "bklit" | "migrated"; charts: ImplCharts; n: number }) {
  return <ProjectionDemo1 charts={charts} />;
}
