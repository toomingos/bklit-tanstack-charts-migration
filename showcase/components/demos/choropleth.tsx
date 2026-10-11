"use client";

import type { ImplCharts } from "./impl-charts";
import { WORLD_COUNTRIES } from "@/lib/demo-data";

interface ChoroplethDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function ChoroplethDemo({ impl, charts, n: _n }: ChoroplethDemoProps) {
  const Charts = charts;

  return (
    <Charts.ChoroplethChart aspectRatio="16 / 9" data={WORLD_COUNTRIES} zoomEnabled>
      <Charts.ChoroplethFeatureComponent fill="var(--chart-scale-03)" />
      <Charts.ChoroplethTooltip />
    </Charts.ChoroplethChart>
  );
}
