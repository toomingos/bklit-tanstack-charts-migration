"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { lineChartDocsData, areaChartDocsData, barChartDocsData, composedDocsData } from "@/lib/docs-data";
import { curveCatmullRom } from "@visx/curve";

const smoothCurve = curveCatmullRom.alpha(0.42);

interface ReferenceAreaDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

// Registry entry point (chart-stage.tsx / lib/chart-data.ts route
// "reference-area"): the ReferenceAreaBandDemo config, dual-rendered.
// The named exports below stay migrated-only, unchanged, for any other
// caller that imports them directly.
export default function ReferenceAreaDemo({ impl, n: _n }: ReferenceAreaDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
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

export function ReferenceAreaBandDemo() {
  return (
    <MigratedCharts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.ReferenceArea y1={1200} y2={1800} showMarkers strokeStyle="dashed" />
      <MigratedCharts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <MigratedCharts.XAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.LineChart>
  );
}

export function ReferenceAreaPatternDemo() {
  return (
    <MigratedCharts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.ReferenceArea y1={1200} y2={1800} axisLabelColor="var(--chart-1)" pattern="diagonal" patternColor="var(--chart-1)" patternScale={1} patternStrokeWidth={1} showMarkers stroke="var(--chart-1)" />
      <MigratedCharts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <MigratedCharts.XAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.LineChart>
  );
}

export function ReferenceAreaMarkersDemo() {
  return (
    <MigratedCharts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.ReferenceArea y1={1200} y2={1800} markerColor="var(--chart-1)" showMarkers stroke="var(--chart-1)" strokeStyle="dashed" />
      <MigratedCharts.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <MigratedCharts.XAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.LineChart>
  );
}

export function ReferenceAreaAreaDemo() {
  return (
    <MigratedCharts.AreaChart data={areaChartDocsData} aspectRatio="2/1">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.ReferenceArea y1={800} y2={1400} fillOpacity={0.15} />
      <MigratedCharts.Area dataKey="revenue" fill="var(--chart-line-primary)" fillOpacity={0.3} />
      <MigratedCharts.XAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.AreaChart>
  );
}

export function ReferenceAreaBarDemo() {
  return (
    <MigratedCharts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.ReferenceArea y1={500} y2={1000} fillOpacity={0.12} />
      <MigratedCharts.Bar dataKey="revenue" fill="var(--chart-line-primary)" />
      <MigratedCharts.BarXAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.BarChart>
  );
}

export function ReferenceAreaComposedDemo() {
  return (
    <MigratedCharts.ComposedChart aspectRatio="2 / 1" barGap={0} data={composedDocsData} maxBarSize={32} xDataKey="date">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.ReferenceArea y1={200} y2={600} fillOpacity={0.1} />
      <MigratedCharts.Area curve={smoothCurve} dataKey="runRate" fill="var(--chart-4)" fillOpacity={0.32} />
      <MigratedCharts.SeriesBar dataKey="units" fill="var(--chart-3)" radius={4} />
      <MigratedCharts.Line curve={smoothCurve} dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} />
      <MigratedCharts.XAxis numTicks={8} />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.ComposedChart>
  );
}
