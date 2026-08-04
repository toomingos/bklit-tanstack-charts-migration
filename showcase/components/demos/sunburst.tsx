"use client";

import { useEffect, useMemo, useState } from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { sunburstDocsData } from "@/lib/docs-data";

const SUNBURST_SIZE = 440;

interface SunburstDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

function countArcs(node: any): number {
  if (!node.children) return 0;
  let count = 0;
  for (const child of node.children) {
    count += 1;
    count += countArcs(child);
  }
  return count;
}

export default function SunburstDemo({ impl, n }: SunburstDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;

  const { arcs, rootId } = useMemo(() => {
    if (impl === "bklit" && "buildArcs" in Charts) {
      return (Charts as any).buildArcs(sunburstDocsData) as { arcs: Array<{ arcIndex: number; id: string }>; rootId: string };
    }
    const arcCount = countArcs(sunburstDocsData);
    const arcs = Array.from({ length: arcCount }, (_, i) => ({ arcIndex: i, id: `arc-${i}` }));
    return { arcs, rootId: "root" };
  }, [impl, Charts]);

  const [focusId, setFocusId] = useState(rootId);

  useEffect(() => {
    setFocusId(rootId);
  }, [rootId]);

  return (
    <div className="flex w-full justify-center">
      <Charts.SunburstChart
        data={sunburstDocsData}
        focusId={focusId}
        onFocusChange={setFocusId}
        size={SUNBURST_SIZE}
      >
        {arcs.map((arc) => (
          <Charts.SunburstSegment index={arc.arcIndex} key={arc.id} />
        ))}
        <Charts.SunburstCenter />
        <Charts.SunburstLabels />
        <Charts.SunburstHint />
      </Charts.SunburstChart>
    </div>
  );
}
