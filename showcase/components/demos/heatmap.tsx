"use client";

import { useMemo } from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { defaultDemoControls, type DemoControls } from "@/components/demo-controls";
import { generateHeatmap } from "@/lib/demo-data";

interface HeatmapDemoProps {
  impl: "bklit" | "migrated";
  n: number;
  controls?: DemoControls;
}

export default function HeatmapDemo({ impl, n, controls = defaultDemoControls }: HeatmapDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const columns = useMemo(() => generateHeatmap("heatmap", n), [n]);

  if (controls.loading === "component") {
    return <Charts.HeatmapChartLoading className="w-full" data={columns} />;
  }

  return (
    <Charts.HeatmapInteractionProvider>
      <Charts.HeatmapInteractionBoundary>
        <div className="flex w-full flex-col items-stretch gap-3">
          <Charts.HeatmapChart className="w-full" data={columns} layout="fluid" status={controls.loading === "status" ? "loading" : "ready"}>
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
