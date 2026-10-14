import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), users: 1200, pageviews: 4500 },
  { date: new Date("2025-01-02"), users: 1350, pageviews: 4800 },
  { date: new Date("2025-01-03"), users: 1100, pageviews: 4200 },
  { date: new Date("2025-01-04"), users: 1450, pageviews: 5100 },
  { date: new Date("2025-01-05"), users: 1380, pageviews: 4900 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Wrap chart parts in your own components and read the chart state with useChart to draw custom SVG.",
  code: `import type { ComponentProps } from "react";
import { ChartTooltip, Grid, Line, LineChart, XAxis, useChart } from "bklit-tanstack-charts";

${data}

// Your own component around Line.
function BrandLine(props: ComponentProps<typeof Line>) {
  return <Line {...props} stroke="var(--chart-line-primary)" strokeWidth={3} />;
}

// Custom SVG in plot coordinates: a threshold line and a ring on the hovered point.
function ThresholdIndicator() {
  const { yScale, innerWidth, tooltipData } = useChart();
  const y = yScale(1500);
  const hovered = tooltipData?.yPositions.users;
  return (
    <g pointerEvents="none">
      <line stroke="var(--chart-line-secondary)" strokeDasharray="4 4" x1={0} x2={innerWidth} y1={y} y2={y} />
      <text fill="var(--chart-label)" fontSize={11} textAnchor="end" x={innerWidth} y={y - 6}>
        Threshold 1,500
      </text>
      {tooltipData && hovered !== undefined ? (
        <circle cx={tooltipData.x} cy={hovered} fill="none" r={9} stroke="var(--chart-line-primary)" strokeWidth={2} />
      ) : null}
    </g>
  );
}

export function UsersChart() {
  return (
    <LineChart data={data} aspectRatio="2/1">
      <Grid horizontal />
      <BrandLine dataKey="users" />
      <>
        <Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
      </>
      <XAxis />
      <ChartTooltip />
      <ThresholdIndicator />
    </LineChart>
  );
}
`,
  usage: `import { Line, LineChart, useChart } from "bklit-tanstack-charts";

${data}

function Baseline() {
  const { yScale, innerWidth } = useChart();
  const y = yScale(1500);
  return <line stroke="currentColor" x1={0} x2={innerWidth} y1={y} y2={y} />;
}

export function UsersChart() {
  return (
    <LineChart data={data}>
      <Line dataKey="users" />
      <Baseline />
    </LineChart>
  );
}
`,
  api: [
    {
      name: "useChart",
      description: "Hook for components rendered inside a chart. It throws outside one. Returns the fields below.",
      props: [
        { name: "width", type: "number", description: "Chart width in px." },
        { name: "height", type: "number", description: "Chart height in px." },
        { name: "innerWidth", type: "number", description: "Plot width, without margins." },
        { name: "innerHeight", type: "number", description: "Plot height, without margins." },
        { name: "margin", type: "Margin", description: "{ top, right, bottom, left } in px." },
        { name: "xScale", type: "ScaleTime", description: "X scale of a time chart." },
        { name: "yScale", type: "ScaleLinear", description: "Y scale." },
        { name: "barScale", type: "ScaleBand | undefined", description: "Category scale of a bar chart." },
        { name: "bandWidth", type: "number | undefined", description: "Width of one category band in a bar chart." },
        { name: "tooltipData", type: "TooltipData | null", description: "Hovered point: { point, index, x, yPositions }. Null when nothing is hovered." },
        { name: "hoveredBarIndex", type: "number | null | undefined", description: "Index of the hovered bar group in a bar chart." },
        { name: "containerRef", type: "RefObject<HTMLDivElement | null>", description: "The chart container, for portals." },
      ],
    },
  ],
};
