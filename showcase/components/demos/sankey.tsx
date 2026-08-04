"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { sankeyDocsData } from "@/lib/docs-data";

interface SankeyDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function SankeyDemo({ impl, n }: SankeyDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <Charts.SankeyChart data={sankeyDocsData} aspectRatio="16 / 9" nodeWidth={16} nodePadding={24}>
      <Charts.SankeyLink />
      <Charts.SankeyNode lineCap={4} labelOrientation="vertical" />
      <Charts.SankeyTooltip />
    </Charts.SankeyChart>
  );
}
