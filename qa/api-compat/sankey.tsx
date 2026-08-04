// Q2 API-compatibility fixture (research/05): exercises the migrated
// SankeyChart's public prop surface. Must typecheck with zero errors via
// `tsc --noEmit` (included from bench/app/tsconfig.json). Runtime smoke is
// covered by the bench scenarios (console-errors column in
// docs/BENCHMARKS.md must be 0).
import * as React from "react";
import {
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@migrated/charts";

// VERBATIM registry data (matches SANKEY_REGISTRY_DATA in bench/data.ts —
// same 5 nodes, 4 links as the n=4 gate fixture).
const registryData = {
  nodes: [
    { name: "Ads" },
    { name: "Organic" },
    { name: "Landing" },
    { name: "Product" },
    { name: "Checkout" },
  ],
  links: [
    { source: 0, target: 2, value: 40 },
    { source: 1, target: 2, value: 30 },
    { source: 2, target: 3, value: 50 },
    { source: 3, target: 4, value: 35 },
  ],
};

export function SankeyChartApiFixture() {
  return (
    <>
      {/* Canonical registry demo path (matches bklit registry example). */}
      <div id="chart-root" style={{ width: "100%", maxWidth: 768 }}>
        <SankeyChart data={registryData} aspectRatio="16 / 9">
          <SankeyLink />
          <SankeyNode />
          <SankeyTooltip />
        </SankeyChart>
      </div>

      {/* Full pilot prop surface. */}
      <SankeyChart
        data={registryData}
        aspectRatio="2 / 1"
        animationDuration={800}
        nodeWidth={20}
        nodePadding={32}
        margin={{ top: 20, right: 120, bottom: 20, left: 120 }}
        className="sankey-chart-qa"
      >
        <SankeyLink
          strokeOpacity={0.6}
          fadedOpacity={0.15}
          useGradient={false}
          stroke="var(--chart-1, #7c3aed)"
        />
        <SankeyNode
          fill="var(--chart-2, #0ea5e9)"
          lineCap={6}
          fadedOpacity={0.5}
          showLabels
          showValueLabels
          labelOrientation="vertical"
          getNodeColor={(_, index) => {
            const colors = [
              "var(--chart-1, #7c3aed)",
              "var(--chart-2, #0ea5e9)",
              "var(--chart-3, #f59e0b)",
              "var(--chart-4, #10b981)",
              "var(--chart-5, #ec4899)",
            ];
            return colors[index % colors.length] ?? colors[0]!;
          }}
        />
        <SankeyTooltip
          formatValue={(v) => `${v.toLocaleString()} sessions`}
          className="ts-chart-tooltip"
        />
      </SankeyChart>
    </>
  );
}
