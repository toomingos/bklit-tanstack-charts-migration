"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { ringDocsData } from "@/lib/docs-data";

const RING_SIZE = 320;

interface RingDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function RingDemo({ impl, n: _n }: RingDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  return (
    <div className="flex w-full justify-center">
      <Charts.RingChart data={ringDocsData} size={RING_SIZE}>
        {ringDocsData.map((item, i) => (
          <Charts.Ring index={i} key={item.label} />
        ))}
        <Charts.RingCenter defaultLabel="Total Sessions" />
      </Charts.RingChart>
    </div>
  );
}
