import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), revenue: 12000, costs: 8500 },
  { date: new Date("2025-01-02"), revenue: 13500, costs: 9200 },
  { date: new Date("2025-01-03"), revenue: 11000, costs: 7800 },
  { date: new Date("2025-01-04"), revenue: 14500, costs: 10100 },
  { date: new Date("2025-01-05"), revenue: 13800, costs: 9400 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Filled series over time with gradient fills, a crosshair tooltip and a reveal on load.",
  code: `import { Area, AreaChart, ChartTooltip, Grid, XAxis } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <AreaChart data={data} aspectRatio="2/1">
      <Grid horizontal />
      <Area dataKey="revenue" fill="var(--chart-line-primary)" fillOpacity={0.3} fadeEdges />
      <Area dataKey="costs" fill="var(--chart-line-secondary)" fillOpacity={0.3} fadeEdges />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
`,
  usage: `import { Area, AreaChart, ChartTooltip, Grid, XAxis } from "bklit-tanstack-charts";

${data}

export function RevenueChart() {
  return (
    <AreaChart data={data}>
      <Grid horizontal />
      <Area dataKey="revenue" />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
`,
  examples: [
    {
      title: "Loading state",
      description: "Set status to \"loading\" while data is on its way. Switching to \"ready\" plays the reveal on the same chart.",
      controls: { loading: "status" },
      code: `import { Area, AreaChart, Grid, XAxis } from "bklit-tanstack-charts";

export function RevenueChart({ data, loading }: { data: Record<string, unknown>[]; loading: boolean }) {
  return (
    <AreaChart data={data} status={loading ? "loading" : "ready"}>
      <Grid horizontal />
      <Area dataKey="revenue" />
      <XAxis />
    </AreaChart>
  );
}
`,
    },
    {
      title: "Sweep loading style",
      description: "loadingStyle=\"sweep\" runs a light band along the line instead of the default pulse.",
      controls: { loading: "status", sweep: true },
      code: `import { Area, AreaChart, Grid, XAxis } from "bklit-tanstack-charts";

export function RevenueChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <AreaChart data={data} status="loading">
      <Grid horizontal />
      <Area dataKey="revenue" loadingStyle="sweep" />
      <XAxis />
    </AreaChart>
  );
}
`,
    },
    {
      title: "Loading placeholder",
      description: "AreaChartLoading is a standalone placeholder for when there is no data to pass yet.",
      controls: { loading: "component" },
      code: `import { AreaChartLoading } from "bklit-tanstack-charts";

export function RevenueChartPlaceholder() {
  return <AreaChartLoading aspectRatio="2/1" />;
}
`,
    },
  ],
  api: [
    {
      name: "AreaChart",
      description: "The root. Holds the data and lays out its children.",
      props: [
        { name: "data", type: "Record<string, unknown>[]", description: "One object per point." },
        { name: "xDataKey", type: "string", default: '"date"', description: "Key holding the x value (a Date)." },
        { name: "status", type: '"loading" | "ready"', default: '"ready"', description: "Loading state; switching to ready plays the reveal." },
        { name: "loadingLabel", type: "string", description: "Label shown while loading. An empty string hides it." },
        { name: "animationDuration", type: "number", default: "1100", description: "Reveal duration in ms." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 40, bottom: 40, left: 40 }", description: "Space around the plot." },
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio of the chart." },
        { name: "xDomain", type: "[Date, Date]", description: "Visible x range, for brush zoom." },
        { name: "yDomainTween", type: "boolean", default: "true", description: "Animate the y range when it changes." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
    {
      name: "Area",
      description: "A filled series with a line on top.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "fill", type: "string", default: "var(--chart-line-primary)", description: "Fill color." },
        { name: "fillOpacity", type: "number", default: "0.4", description: "Fill opacity at the top of the gradient." },
        { name: "gradientToOpacity", type: "number", default: "0", description: "Fill opacity at the bottom of the gradient." },
        { name: "stroke", type: "string", default: "fill", description: "Line color." },
        { name: "strokeWidth", type: "number", default: "2", description: "Line width." },
        { name: "curve", type: "CurveFactory", default: "curveMonotoneX", description: "A d3-shape curve." },
        { name: "showLine", type: "boolean", default: "true", description: "Draw the line on top of the fill." },
        { name: "showHighlight", type: "boolean", default: "true", description: "Highlight the series on hover." },
        { name: "fadeEdges", type: 'boolean | "left" | "right"', default: "false", description: "Fade the fill at the edges." },
        { name: "showMarkers", type: "boolean", default: "false", description: "Draw a marker at each point." },
        { name: "loadingStyle", type: '"pulse" | "sweep"', default: '"pulse"', description: "Loading animation." },
        { name: "yAxisId", type: "string | number", default: '"left"', description: "Y scale to plot against, for two-axis charts." },
      ],
    },
    {
      name: "Grid",
      props: [
        { name: "horizontal", type: "boolean", default: "true", description: "Horizontal lines." },
        { name: "vertical", type: "boolean", default: "false", description: "Vertical lines." },
        { name: "numTicksRows", type: "number", default: "5", description: "Number of horizontal lines." },
        { name: "numTicksColumns", type: "number", default: "10", description: "Number of vertical lines." },
        { name: "stroke", type: "string", default: "var(--chart-grid)", description: "Line color." },
        { name: "strokeDasharray", type: "string", default: '"4,4"', description: "Dash pattern." },
      ],
    },
    {
      name: "XAxis",
      props: [
        { name: "numTicks", type: "number", default: "5", description: "Number of labels." },
        { name: "tickerHalfWidth", type: "number", default: "50", description: "Distance in px at which labels fade near the crosshair." },
        { name: "tickMode", type: '"data" | "domain"', default: '"data"', description: '"data" puts labels on data points; "domain" spaces them evenly in time.' },
        { name: "formatValue", type: "(value: Date) => string", description: "Label formatter." },
      ],
    },
    {
      name: "ChartTooltip",
      description: "Crosshair, dots, date pill and tooltip box.",
      props: [
        { name: "showDatePill", type: "boolean", default: "true", description: "Date pill on the x axis." },
        { name: "showCrosshair", type: "boolean", default: "true", description: "Vertical crosshair." },
        { name: "showDots", type: "boolean", default: "true", description: "Dots on each series." },
        { name: "indicatorColor", type: "string | (point) => string", description: "Crosshair and dot color." },
        { name: "rows", type: "(point) => TooltipRow[]", description: "Rows shown in the box." },
        { name: "content", type: "(props) => ReactNode", description: "Replaces the box content." },
      ],
    },
  ],
};
