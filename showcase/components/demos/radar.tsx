"use client";

import { useState } from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { radarDocsMetrics, radarDocsData } from "@/lib/docs-data";

const RADAR_SIZE = 400;

interface RadarDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function RadarDemo({ impl, n: _n }: RadarDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flex w-full justify-center">
      <Charts.RadarChart
        data={radarDocsData}
        hoveredIndex={hoveredIndex}
        metrics={radarDocsMetrics}
        onHoverChange={setHoveredIndex}
        size={RADAR_SIZE}
      >
        <Charts.RadarGrid />
        <Charts.RadarAxis />
        <Charts.RadarLabels interactive />
        {radarDocsData.map((item, index) => (
          <Charts.RadarArea index={index} key={item.label} />
        ))}
      </Charts.RadarChart>
    </div>
  );
}
