"use client";

import * as React from "react";
import type { ImplCharts } from "./impl-charts";
import { lineChartDocsData } from "@/lib/docs-data";

interface SegmentDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

interface SegmentStats {
  value: number;
  change: number;
  changePct: number;
  startDate: Date;
  endDate: Date;
}

type UseChart = () => {
  selection?: { startIndex: number; endIndex: number; active: boolean } | null;
  data: Record<string, unknown>[];
  xAccessor: (d: Record<string, unknown>) => Date;
};

// Mirrors bklit's docs segment-demo: a child of the chart reads `useChart().selection`
// and reports the selected range. The same JSX renders on both sides; only the
// `useChart` hook (bklit's visx context vs the native bridge) differs.
function SegmentBridge({
  useChart,
  onSegmentChange,
}: {
  useChart: UseChart;
  onSegmentChange: (stats: SegmentStats | null) => void;
}) {
  const { selection, data, xAccessor } = useChart();
  React.useEffect(() => {
    if (!selection?.active) {
      onSegmentChange(null);
      return;
    }
    const startIdx = Math.max(0, selection.startIndex);
    const endIdx = Math.min(data.length - 1, selection.endIndex);
    const startPoint = data[startIdx];
    const endPoint = data[endIdx];
    if (startIdx >= endIdx || !startPoint || !endPoint) {
      onSegmentChange(null);
      return;
    }
    const startVal = startPoint.users;
    const endVal = endPoint.users;
    if (typeof startVal !== "number" || typeof endVal !== "number") {
      onSegmentChange(null);
      return;
    }
    onSegmentChange({
      value: endVal,
      change: endVal - startVal,
      changePct: startVal === 0 ? 0 : ((endVal - startVal) / startVal) * 100,
      startDate: xAccessor(startPoint),
      endDate: xAccessor(endPoint),
    });
  }, [selection, data, xAccessor, onSegmentChange]);
  return null;
}

// Registry entry point (chart-stage.tsx / lib/chart-data.ts route "segment").
export default function SegmentDemo({ impl, charts, n: _n }: SegmentDemoProps) {
  const Charts = charts;
  const [stats, setStats] = React.useState<SegmentStats | null>(null);
  const first = lineChartDocsData[0];
  const last = lineChartDocsData.at(-1);
  const firstVal = first?.users ?? 0;
  const lastVal = last?.users ?? 0;
  const displayValue = stats?.value ?? lastVal;
  const displayChange = stats?.change ?? lastVal - firstVal;
  const displayPct = stats?.changePct ?? (firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0);
  const isPositive = displayChange >= 0;
  const fmt = (d: Date | undefined) => d?.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="w-full">
      <div className="mb-4 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-2xl tabular-nums">{displayValue.toLocaleString()}</span>
          <span className="text-muted-foreground text-sm">users</span>
        </div>
        <div className="flex items-baseline gap-2 text-sm">
          <span className={isPositive ? "text-emerald-500" : "text-red-500"}>
            {isPositive ? "+" : ""}
            {displayChange.toLocaleString()} ({isPositive ? "+" : ""}
            {displayPct.toFixed(1)}%)
          </span>
          <span className="text-muted-foreground">
            {fmt(stats?.startDate ?? first?.date)} &ndash; {fmt(stats?.endDate ?? last?.date)}
          </span>
        </div>
      </div>
      <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
        <Charts.Grid horizontal />
        <Charts.Line dataKey="users" stroke="var(--chart-line-primary)" />
        <Charts.XAxis />
        <Charts.ChartTooltip />
        <Charts.SegmentBackground />
        <Charts.SegmentLineFrom />
        <Charts.SegmentLineTo />
        <SegmentBridge onSegmentChange={setStats} useChart={Charts.useChart} />
      </Charts.LineChart>
    </div>
  );
}
