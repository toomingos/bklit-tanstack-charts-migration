"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { candlestickChartDocsData } from "@/lib/docs-data";

interface CandlestickDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function CandlestickDemo({ impl, n }: CandlestickDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

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
