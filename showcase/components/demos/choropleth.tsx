"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { WORLD_COUNTRIES } from "@/lib/demo-data";

interface ChoroplethDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function ChoroplethDemo({ impl, n }: ChoroplethDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <Charts.ChoroplethChart aspectRatio="16 / 9" data={WORLD_COUNTRIES} zoomEnabled>
      <Charts.ChoroplethFeatureComponent fill="var(--chart-scale-03)" />
      <Charts.ChoroplethTooltip />
    </Charts.ChoroplethChart>
  );
}
