"use client";

import type { ImplCharts } from "./impl-charts";
import { sankeyDocsData } from "@/lib/docs-data";

interface SankeyDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function SankeyDemo({ impl, charts, n: _n }: SankeyDemoProps) {
  const Charts = charts;

  return (
    <Charts.SankeyChart data={sankeyDocsData} aspectRatio="16 / 9" nodeWidth={16} nodePadding={24}>
      <Charts.SankeyLink />
      <Charts.SankeyNode lineCap={4} labelOrientation="vertical" />
      <Charts.SankeyTooltip />
    </Charts.SankeyChart>
  );
}
