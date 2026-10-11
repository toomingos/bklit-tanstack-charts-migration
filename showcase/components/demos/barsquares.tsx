"use client";

import * as React from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { barChartDocsData } from "@/lib/docs-data";

interface BarSquaresDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

const LEGEND_ITEMS = [
  { label: "Revenue (gradient)", value: 100, color: "var(--chart-1)" },
  { label: "Profit (pattern)", value: 100, color: "var(--chart-2)" },
];

export default function BarSquaresDemo({ impl, n: _n }: BarSquaresDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <Charts.ChartLegendHoverProvider hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Charts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
            <Charts.Grid horizontal />
            <Charts.BarColumnTrack fill="var(--muted)" opacity={0.15} />
            <Charts.BarSquares
              dataKey="revenue"
              fill="var(--chart-1)"
              useGradient
              gradientStops={[
                { offset: 0, color: "var(--chart-1)" },
                { offset: 1, color: "var(--chart-2)" },
              ]}
            />
            <Charts.BarSquares dataKey="profit" fill="var(--chart-2)" patternPreset="diagonal" />
            <Charts.BarXAxis />
            <Charts.ChartTooltip />
          </Charts.BarChart>
        </div>
      </Charts.ChartLegendHoverProvider>
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
