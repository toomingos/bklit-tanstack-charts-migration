"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { pieDocsData } from "@/lib/docs-data";

const PIE_SIZE = 280;

interface PieDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function PieDemo({ impl, n: _n }: PieDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

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
