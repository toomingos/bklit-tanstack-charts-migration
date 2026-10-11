"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { funnelDocsData } from "@/lib/docs-data";

interface FunnelDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function FunnelDemo({ impl, n: _n }: FunnelDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <div className="flex w-full justify-center">
      <Charts.FunnelChart color="var(--chart-1)" data={funnelDocsData} layers={3} />
    </div>
  );
}
