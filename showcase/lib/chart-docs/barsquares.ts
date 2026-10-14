import type { ChartDoc } from "./types";

const data = `const data = [
  { month: "Jan", revenue: 12000, profit: 4500 },
  { month: "Feb", revenue: 15500, profit: 5200 },
  { month: "Mar", revenue: 11000, profit: 3800 },
  { month: "Apr", revenue: 18500, profit: 7100 },
  { month: "May", revenue: 16800, profit: 5400 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Bars drawn as stacks of small squares, with gradient or pattern fills and an optional track behind each column.",
  code: `import { useState } from "react";
import { BarChart, BarColumnTrack, BarSquares, BarXAxis, ChartLegend, ChartLegendHoverProvider, ChartTooltip, Grid } from "bklit-tanstack-charts";

${data}

const legendItems = [
  { label: "Revenue (gradient)", value: 100, color: "var(--chart-1)" },
  { label: "Profit (pattern)", value: 100, color: "var(--chart-2)" },
];

export function RevenueChart() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <ChartLegendHoverProvider hoveredIndex={hoveredIndex} onHoverChange={setHoveredIndex}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <BarChart data={data} xDataKey="month" aspectRatio="2/1">
            <Grid horizontal />
            <BarColumnTrack fill="var(--muted)" opacity={0.15} />
            <BarSquares
              dataKey="revenue"
              fill="var(--chart-1)"
              useGradient
              gradientStops={[
                { offset: 0, color: "var(--chart-1)" },
                { offset: 100, color: "var(--chart-2)" },
              ]}
            />
            <BarSquares dataKey="profit" fill="var(--chart-2)" patternPreset="diagonal" />
            <BarXAxis />
            <ChartTooltip />
          </BarChart>
        </div>
      </ChartLegendHoverProvider>
      <div style={{ width: 200 }}>
        <ChartLegend hoveredIndex={hoveredIndex} items={legendItems} onHover={setHoveredIndex} title="Series" />
      </div>
    </div>
  );
}
`,
  usage: `import { BarChart, BarSquares, BarXAxis, ChartTooltip } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <BarChart data={data} xDataKey="month">
      <BarSquares dataKey="revenue" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
`,
  api: [
    {
      name: "BarSquares",
      description: "One series drawn as a vertical stack of squares. Use one per series.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the value." },
        { name: "fill", type: "string", default: "var(--chart-line-primary)", description: "Solid color, or a url(#id) pattern." },
        { name: "stroke", type: "string", description: "Tooltip ring color. Set it when fill is a gradient or pattern." },
        { name: "squareGap", type: "number", default: "3", description: "Gap in px between squares." },
        { name: "squareRadius", type: "number", default: "0.25", description: "Corner radius as a fraction of the square size (0 to 0.5)." },
        { name: "squareFit", type: "boolean", default: "false", description: "Spread the gap so the squares fill the bar height exactly." },
        { name: "useGradient", type: "boolean", default: "false", description: "Color the squares with a gradient from gradientStops." },
        { name: "gradientStops", type: "{ offset: number; color: string }[]", description: "Gradient stops, bottom to top, with offset as a percentage (0 to 100). Needs at least two." },
        { name: "patternPreset", type: "string", description: 'Pattern preset for the squares, such as "diagonal".' },
        { name: "groupGap", type: "number", default: "4", description: "Gap in px between columns of different series." },
        { name: "fadedOpacity", type: "number", default: "0.3", description: "Opacity when another group is hovered." },
        { name: "animate", type: "boolean", description: "Turn the entrance animation off with false." },
      ],
    },
    {
      name: "BarColumnTrack",
      description: "A fill in the empty space above each square column. Place it before BarSquares.",
      props: [
        { name: "fill", type: "string", description: "Track color." },
        { name: "opacity", type: "number", default: "0.3", description: "Track opacity." },
        { name: "squareGap", type: "number", default: "3", description: "Match the BarSquares value." },
        { name: "squareRadius", type: "number", default: "0.25", description: "Match the BarSquares value." },
        { name: "squareFit", type: "boolean", default: "false", description: "Match the BarSquares value." },
        { name: "groupGap", type: "number", default: "4", description: "Match the BarSquares value." },
      ],
    },
    {
      name: "ChartLegend",
      description: "Series list that dims the chart on hover when inside a ChartLegendHoverProvider.",
      props: [
        { name: "items", type: "{ label: string; value: number; color: string; maxValue?: number }[]", description: "Legend rows." },
        { name: "hoveredIndex", type: "number | null", description: "Index of the highlighted row." },
        { name: "onHover", type: "(index: number | null) => void", description: "Called as the pointer moves over rows." },
        { name: "title", type: "string", description: "Heading above the rows." },
        { name: "showProgress", type: "boolean", description: "Progress bar under each row." },
        { name: "showMarker", type: "boolean", description: "Color marker next to each label." },
        { name: "showValue", type: "boolean", description: "Value on each row." },
        { name: "formatValue", type: "(value: number) => string", description: "Value formatter." },
      ],
    },
    {
      name: "ChartLegendHoverProvider",
      description: "Shares the hovered legend index with the chart.",
      props: [
        { name: "hoveredIndex", type: "number | null", description: "Index of the hovered series." },
        { name: "onHoverChange", type: "(index: number | null) => void", description: "Called when the hovered series changes." },
      ],
    },
  ],
};
