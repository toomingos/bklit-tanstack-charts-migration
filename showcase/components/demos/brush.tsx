"use client";

import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import { lineChartDocsData } from "@/lib/docs-data";

interface BrushDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

// Fixed-height strip margin, matches bklit's own line-chart-brush-demo.tsx.
const brushStripMargin = { top: 4, right: 40, bottom: 4, left: 40 };

export default function BrushDemo({ impl, n: _n }: BrushDemoProps) {
  return (
    <div style={{ height: 360, minHeight: 0 }}>
      {impl === "bklit" ? (
        <BklitCharts.ChartBrushLayout
          brushStrip={(brushLayout) => (
            <BklitCharts.LineChart
              animationDuration={0}
              className="size-full"
              data={lineChartDocsData}
              margin={brushStripMargin}
              status="ready"
              style={{ aspectRatio: "unset", height: "100%" }}
            >
              <BklitCharts.Line
                animate={false}
                dataKey="users"
                fadeEdges
                showHighlight={false}
                stroke="var(--chart-line-primary)"
                strokeWidth={2}
              />
              <BklitCharts.ChartBrush
                initialSelection={brushLayout.brushSelection ?? undefined}
                onSelectionChange={brushLayout.onBrushSelectionChange}
                selectionPattern={{ color: "var(--chart-1)", preset: "diagonal" }}
              />
            </BklitCharts.LineChart>
          )}
          data={lineChartDocsData}
          enabled
          height={72}
        >
          {(brushLayout) => (
            <BklitCharts.LineChart
              className="size-full"
              data={lineChartDocsData}
              style={{ aspectRatio: "unset", height: "100%" }}
              tweenYDomainOnXDomainChange
              xDomain={brushLayout.xDomain}
              xDomainSlotCount={brushLayout.xDomainSlotCount}
              yDomainTween
            >
              <BklitCharts.Grid horizontal stroke="var(--chart-grid)" />
              <BklitCharts.Line
                dataKey="users"
                fadeEdges
                stroke="var(--chart-line-primary)"
                strokeWidth={2}
              />
              <BklitCharts.XAxis />
              <BklitCharts.ChartTooltip />
            </BklitCharts.LineChart>
          )}
        </BklitCharts.ChartBrushLayout>
      ) : (
        <MigratedCharts.BrushLayout
          brushStrip={(brushLayout) => (
            <MigratedCharts.LineChart
              animationDuration={0}
              className="size-full"
              data={lineChartDocsData}
              margin={brushStripMargin}
              status="ready"
              style={{ aspectRatio: "unset", height: "100%" }}
            >
              <MigratedCharts.Line
                animate={false}
                dataKey="users"
                fadeEdges
                showHighlight={false}
                stroke="var(--chart-line-primary)"
                strokeWidth={2}
              />
              <MigratedCharts.ChartBrush
                initialSelection={brushLayout.brushSelection ?? undefined}
                onSelectionChange={brushLayout.onBrushSelectionChange}
                selectionPattern={{ color: "var(--chart-1)", preset: "diagonal" }}
              />
            </MigratedCharts.LineChart>
          )}
          data={lineChartDocsData}
          enabled
          height={72}
        >
          {(brushLayout) => (
            <MigratedCharts.LineChart
              className="size-full"
              data={lineChartDocsData}
              style={{ aspectRatio: "unset", height: "100%" }}
              tweenYDomainOnXDomainChange
              xDomain={brushLayout.xDomain}
              xDomainSlotCount={brushLayout.xDomainSlotCount}
              yDomainTween
            >
              <MigratedCharts.Grid horizontal stroke="var(--chart-grid)" />
              <MigratedCharts.Line
                dataKey="users"
                fadeEdges
                stroke="var(--chart-line-primary)"
                strokeWidth={2}
              />
              <MigratedCharts.XAxis />
              <MigratedCharts.ChartTooltip />
            </MigratedCharts.LineChart>
          )}
        </MigratedCharts.BrushLayout>
      )}
    </div>
  );
}
