"use client";

import type { ImplCharts } from "./impl-charts";
import { pieDocsData } from "@/lib/docs-data";

const PIE_SIZE = 280;

interface PieDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function PieDemo({ impl, charts, n: _n }: PieDemoProps) {
  const Charts = charts;

  return (
    <div className="flex w-full justify-center">
      <Charts.PieChart data={pieDocsData} size={PIE_SIZE}>
        {pieDocsData.map((item, i) => (
          <Charts.PieSlice index={i} key={item.label} />
        ))}
      </Charts.PieChart>
    </div>
  );
}
