"use client";

import * as React from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { lineChartDocsData } from "@/lib/docs-data";
import type { ChartMarker } from "@showcase/migrated-charts";

interface MarkersDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

const LEGEND_ITEMS = [
  { label: "Users", value: 100, color: "var(--chart-line-primary)" },
  { label: "Pageviews", value: 100, color: "var(--chart-line-secondary)" },
];

// Same-date cluster (3 markers) exercises the fan-out badge path; two
// single-date markers round out the set. Index fractions of the fixed
// 30-point lineChartDocsData, mirroring the bench markers scenario.
const CLUSTER_IDX = 12;
const SINGLE1_IDX = 6;
const SINGLE2_IDX = 21;
const DASH_FROM_IDX = 22;

function buildMarkers(): ChartMarker[] {
  const cluster = lineChartDocsData[CLUSTER_IDX]!.date;
  const single1 = lineChartDocsData[SINGLE1_IDX]!.date;
  const single2 = lineChartDocsData[SINGLE2_IDX]!.date;
  return [
    { date: cluster, icon: "\u{1F680}", title: "Launch", description: "Release shipped" },
    { date: cluster, icon: "⚠️", title: "Alert", description: "Threshold breached" },
    { date: cluster, icon: "\u{1F527}", title: "Fix", description: "Hotfix deployed" },
    { date: single1, icon: "\u{1F389}", title: "Milestone", description: "100k users" },
    { date: single2, icon: "\u{1F4C8}", title: "Growth", description: "Quarterly peak" },
  ];
}

export default function MarkersDemo({ impl, n: _n }: MarkersDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const markerItems = React.useMemo(buildMarkers, []);

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Charts.ChartLegendHoverProvider hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex}>
          <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
            <Charts.Grid horizontal />
            <Charts.Line
              dataKey="users"
              stroke="var(--chart-line-primary)"
              showMarkers
              markers={{ radius: 5, fill: "var(--chart-line-primary)" }}
              dashFromIndex={DASH_FROM_IDX}
              dashArray="6,4"
            />
            <Charts.Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
            <Charts.XAxis />
            <Charts.ChartTooltip />
            <Charts.ChartMarkers items={markerItems} />
          </Charts.LineChart>
        </Charts.ChartLegendHoverProvider>
      </div>
      <div style={{ width: 200 }}>
        <Charts.ChartLegend
          hoveredIndex={hoveredIndex}
          items={LEGEND_ITEMS}
          onHover={setHoveredIndex}
          title="Series"
        />
      </div>
    </div>
  );
}
