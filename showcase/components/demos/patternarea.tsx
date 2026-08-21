"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { areaChartDocsData } from "@/lib/docs-data";

interface PatternAreaDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

// bklit's PatternArea takes a raw `fill: string` pattern URL and requires
// the consumer to hand-author the sibling <PatternLines> defs (doc idiom,
// apps/web/components/docs/area-chart-pattern-demo.tsx). Migrated's
// PatternArea exposes a `patternPreset` convenience prop that resolves its
// own sibling defs internally — no manual defs plumbing needed. This is a
// genuine API gap between the two impls, so the JSX branches per impl
// rather than forcing identical props.
const PATTERN_ID = "showcase-patternarea-demo";

export default function PatternAreaDemo({ impl, n: _n }: PatternAreaDemoProps) {
  if (impl === "bklit") {
    return (
      <BklitCharts.AreaChart data={areaChartDocsData} aspectRatio="2/1">
        <BklitCharts.PatternLines
          height={6}
          id={PATTERN_ID}
          orientation={["diagonal"]}
          stroke="var(--chart-1)"
          strokeWidth={1}
          width={6}
        />
        <BklitCharts.Grid horizontal />
        <BklitCharts.PatternArea dataKey="revenue" fill={`url(#${PATTERN_ID})`} />
        <BklitCharts.Area dataKey="revenue" fillOpacity={0} strokeWidth={2.5} />
        <BklitCharts.XAxis />
        <BklitCharts.ChartTooltip />
      </BklitCharts.AreaChart>
    );
  }

  return (
    <MigratedCharts.AreaChart data={areaChartDocsData} aspectRatio="2/1">
      <MigratedCharts.Grid horizontal />
      <MigratedCharts.PatternArea
        dataKey="revenue"
        patternPreset="diagonal"
        patternColor="var(--chart-1)"
      />
      <MigratedCharts.Area dataKey="revenue" fillOpacity={0} strokeWidth={2.5} />
      <MigratedCharts.XAxis />
      <MigratedCharts.ChartTooltip />
    </MigratedCharts.AreaChart>
  );
}
