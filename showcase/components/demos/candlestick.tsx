"use client";

import type { ImplCharts } from "./impl-charts";
import { candlestickChartDocsData } from "@/lib/docs-data";

interface CandlestickDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function CandlestickDemo({ impl, charts, n: _n }: CandlestickDemoProps) {
  const Charts = charts;

  return (
    <Charts.CandlestickChart
      data={candlestickChartDocsData}
      margin={{ top: 16, right: 16, bottom: 40, left: 16 }}
      style={{ height: 320 }}
    >
      <Charts.Candlestick fadedOpacity={0.25} />
      <Charts.ChartTooltip />
      <Charts.XAxis />
    </Charts.CandlestickChart>
  );
}
