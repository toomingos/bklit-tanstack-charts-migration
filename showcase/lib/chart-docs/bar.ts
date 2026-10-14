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
  description: "Grouped or stacked bars over categories, with a hover focus on each group and a grow-in on load.",
  code: `import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <BarChart data={data} xDataKey="month" aspectRatio="2/1">
      <Grid horizontal />
      <Bar dataKey="revenue" fill="var(--chart-line-primary)" lineCap="round" />
      <Bar dataKey="profit" fill="var(--chart-line-secondary)" lineCap="round" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
`,
  usage: `import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <BarChart data={data} xDataKey="month">
      <Grid horizontal />
      <Bar dataKey="revenue" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
`,
  examples: [
    {
      title: "Loading state",
      description: "Set status to \"loading\" while data is on its way. Switching to \"ready\" plays the grow-in on the same chart.",
      controls: { loading: "status" },
      code: `import { Bar, BarChart, BarXAxis, Grid } from "bklit-tanstack-charts";

export function RevenueChart({ data, loading }: { data: Record<string, unknown>[]; loading: boolean }) {
  return (
    <BarChart data={data} xDataKey="month" status={loading ? "loading" : "ready"}>
      <Grid horizontal />
      <Bar dataKey="revenue" />
      <BarXAxis />
    </BarChart>
  );
}
`,
    },
    {
      title: "Loading placeholder",
      description: "BarChartLoading is a standalone placeholder for when there is no data to pass yet.",
      controls: { loading: "component" },
      code: `import { BarChartLoading } from "bklit-tanstack-charts";

export function RevenueChartPlaceholder() {
  return <BarChartLoading aspectRatio="2/1" />;
}
`,
    },
  ],
  api: [
    {
      name: "BarChart",
      description: "The root. Holds the data and lays out its children.",
      props: [
        { name: "data", type: "Record<string, unknown>[]", description: "One object per category." },
        { name: "xDataKey", type: "string", default: '"name"', description: "Key holding the category label." },
        { name: "status", type: '"loading" | "ready"', default: '"ready"', description: "Loading state; switching to ready plays the grow-in." },
        { name: "animationDuration", type: "number", default: "1100", description: "Entrance duration in ms." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 40, bottom: 40, left: 40 }", description: "Space around the plot." },
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio of the chart." },
        { name: "barGap", type: "number", default: "0.2", description: "Gap between groups, as a fraction of the band width (0 to 1)." },
        { name: "orientation", type: '"vertical" | "horizontal"', default: '"vertical"', description: 'Use "horizontal" with BarYAxis instead of BarXAxis.' },
        { name: "stacked", type: "boolean", default: "false", description: "Stack the series instead of grouping them." },
        { name: "stackGap", type: "number", default: "0", description: "Gap in px between stacked segments." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
    {
      name: "Bar",
      description: "One series of bars.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the value." },
        { name: "fill", type: "string", default: "var(--chart-line-primary)", description: "Fill color, or a url(#id) gradient or pattern." },
        { name: "stroke", type: "string", description: "Tooltip dot color. Set it when fill is a gradient or pattern." },
        { name: "lineCap", type: '"round" | "butt" | number', description: "End cap, or a custom corner radius in px." },
        { name: "animate", type: "boolean", description: "Turn the entrance animation off with false." },
        { name: "fadedOpacity", type: "number", default: "0.3", description: "Opacity of the bars when another group is hovered." },
        { name: "yAxisId", type: "string | number", default: '"left"', description: "Y scale to plot against, for two-axis charts." },
      ],
    },
    {
      name: "BarXAxis",
      description: "Category labels along the bottom. Use BarYAxis for horizontal charts.",
      props: [
        { name: "tickerHalfWidth", type: "number", default: "50", description: "Distance in px at which labels hide near the hovered group." },
        { name: "showAllLabels", type: "boolean", default: "false", description: "Show every label, even if they crowd." },
        { name: "maxLabels", type: "number", default: "12", description: "Most labels to show when showAllLabels is off." },
      ],
    },
    {
      name: "Grid",
      props: [
        { name: "horizontal", type: "boolean", default: "true", description: "Horizontal lines." },
        { name: "vertical", type: "boolean", default: "false", description: "Vertical lines." },
        { name: "numTicksRows", type: "number", default: "5", description: "Number of horizontal lines." },
        { name: "stroke", type: "string", default: "var(--chart-grid)", description: "Line color." },
        { name: "strokeDasharray", type: "string", default: '"4,4"', description: "Dash pattern." },
      ],
    },
    {
      name: "ChartTooltip",
      description: "Date pill, dots and tooltip box for the hovered group.",
      props: [
        { name: "showDatePill", type: "boolean", default: "true", description: "Label pill on the axis." },
        { name: "showCrosshair", type: "boolean", default: "true", description: "Vertical guide." },
        { name: "showDots", type: "boolean", default: "true", description: "Dots on each series." },
        { name: "rows", type: "(point) => TooltipRow[]", description: "Rows shown in the box." },
        { name: "content", type: "(props) => ReactNode", description: "Replaces the box content." },
      ],
    },
    {
      name: "BarChartLoading",
      description: "Placeholder with the loading skeleton, for when there is no data yet.",
      props: [
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio." },
        { name: "margin", type: "Partial<Margin>", description: "Space around the plot." },
        { name: "className", type: "string", description: "Class on the container." },
      ],
    },
  ],
};
