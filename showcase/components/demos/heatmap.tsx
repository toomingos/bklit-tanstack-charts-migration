"use client";

import { useMemo } from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { generateHeatmap } from "@/lib/demo-data";

interface HeatmapDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function HeatmapDemo({ impl, n }: HeatmapDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const columns = useMemo(() => generateHeatmap("heatmap", n), [n]);

  return (
    <Charts.HeatmapInteractionProvider>
      <Charts.HeatmapInteractionBoundary>
        <div className="flex w-full flex-col items-stretch gap-3">
          <Charts.HeatmapChart className="w-full" data={columns} layout="fluid">
            <Charts.HeatmapCells inactiveOpacity={1} inactiveScale={1} />
            <Charts.HeatmapXAxis />
            <Charts.HeatmapYAxis />
            <Charts.HeatmapTooltip instant />
          </Charts.HeatmapChart>
          <Charts.HeatmapLegend inactiveOpacity={1} inactiveScale={1} />
        </div>
      </Charts.HeatmapInteractionBoundary>
    </Charts.HeatmapInteractionProvider>
  );
}
