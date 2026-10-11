"use client";

import type { ComponentProps } from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { lineChartDocsData } from "@/lib/docs-data";

interface CompositionDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

type UseChart = () => { yScale: (v: number) => number; innerWidth: number; tooltipData: { x: number; yPositions: Record<string, number> } | null };

/** A custom SVG child: a threshold line plus a ring on the hovered "users" point, in the chart's plot coordinates. */
function ThresholdIndicator({ useChart }: { useChart: UseChart }) {
  const { yScale, innerWidth, tooltipData } = useChart();
  const y = yScale(1500);
  const hovered = tooltipData?.yPositions.users;
  return (
    <g pointerEvents="none">
      <line stroke="var(--chart-line-secondary)" strokeDasharray="4 4" x1={0} x2={innerWidth} y1={y} y2={y} />
      <text fill="var(--chart-label)" fontSize={11} textAnchor="end" x={innerWidth} y={y - 6}>Threshold 1,500</text>
      {tooltipData && hovered !== undefined ? <circle cx={tooltipData.x} cy={hovered} fill="none" r={9} stroke="var(--chart-line-primary)" strokeWidth={2} /> : null}
    </g>
  );
}

// What a user writes in copied code: their own component wrapping <Line> and a fragment of series, plus custom SVG reading useChart().
export default function CompositionDemo({ impl, n: _n }: CompositionDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const BrandLine = (props: ComponentProps<typeof Charts.Line>) => <Charts.Line {...props} stroke="var(--chart-line-primary)" strokeWidth={3} />;
  return (
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <BrandLine dataKey="users" />
      <>
        <Charts.Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
      </>
      <Charts.XAxis />
      <Charts.ChartTooltip />
      <ThresholdIndicator useChart={Charts.useChart} />
    </Charts.LineChart>
  );
}
