"use client";

import type { ImplCharts } from "./impl-charts";
import { ringDocsData } from "@/lib/docs-data";

const RING_SIZE = 320;

interface RingDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

export default function RingDemo({ impl, charts, n: _n }: RingDemoProps) {
  const Charts = charts;

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
