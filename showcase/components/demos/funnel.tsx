"use client";

import type { ImplCharts } from "./impl-charts";
import { funnelDocsData } from "@/lib/docs-data";

interface FunnelDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function FunnelDemo({ impl, charts, n: _n }: FunnelDemoProps) {
  const Charts = charts;

  return (
    <div className="flex w-full justify-center">
      <Charts.FunnelChart color="var(--chart-1)" data={funnelDocsData} layers={3} />
    </div>
  );
}
