"use client";

import { useState } from "react";
import type { ImplCharts } from "./impl-charts";
import { radarDocsMetrics, radarDocsData } from "@/lib/docs-data";

const RADAR_SIZE = 400;

interface RadarDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function RadarDemo({ impl, charts, n: _n }: RadarDemoProps) {
  const Charts = charts;
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
