import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), users: 1200, pageviews: 4500 },
  { date: new Date("2025-01-02"), users: 1350, pageviews: 4800 },
  { date: new Date("2025-01-03"), users: 1100, pageviews: 4200 },
  { date: new Date("2025-01-04"), users: 1450, pageviews: 5100 },
  { date: new Date("2025-01-05"), users: 1380, pageviews: 4900 },
  // ...
];`;

const markers = `const markers = [
  { date: new Date("2025-01-04"), icon: "🚀", title: "v1.2.0 Released", description: "New chart animations" },
  { date: new Date("2025-01-04"), icon: "🐛", title: "Bug Fix", description: "Fixed tooltip positioning" },
  // ...
];`;

export const doc: ChartDoc = {
  description: "One or more lines over time with a crosshair tooltip, optional date markers and a reveal on load.",
  code: `import { ChartMarkers, ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

${data}

${markers}

export function TrafficChart() {
  return (
    <LineChart data={data} aspectRatio="2/1">
      <Grid horizontal />
      <Line dataKey="users" stroke="var(--chart-line-primary)" />
      <Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
      <XAxis />
      <ChartTooltip />
      <ChartMarkers items={markers} />
    </LineChart>
  );
}
`,
  usage: `import { ChartTooltip, Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

${data}

export function TrafficChart() {
  return (
    <LineChart data={data}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
`,
  examples: [
    {
      title: "Loading state",
      description: "Set status to \"loading\" while data is on its way. Switching to \"ready\" plays the reveal on the same chart.",
      controls: { loading: "status" },
      code: `import { Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

export function TrafficChart({ data, loading }: { data: Record<string, unknown>[]; loading: boolean }) {
  return (
    <LineChart data={data} status={loading ? "loading" : "ready"}>
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
    </LineChart>
  );
}
`,
    },
    {
      title: "Sweep loading style",
      description: "loadingStyle=\"sweep\" runs a light band along the line instead of the default pulse.",
      controls: { loading: "status", sweep: true },
      code: `import { Grid, Line, LineChart, XAxis } from "bklit-tanstack-charts";

export function TrafficChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <LineChart data={data} status="loading">
      <Grid horizontal />
      <Line dataKey="users" loadingStyle="sweep" />
      <XAxis />
    </LineChart>
  );
}
`,
    },
    {
      title: "Loading placeholder",
      description: "LineChartLoading is a standalone placeholder for when there is no data to pass yet.",
      controls: { loading: "component" },
      code: `import { LineChartLoading } from "bklit-tanstack-charts";

export function TrafficChartPlaceholder() {
  return <LineChartLoading aspectRatio="2/1" />;
}
`,
    },
  ],
  api: [
    {
      name: "LineChart",
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
      name: "Line",
      description: "A line series.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "stroke", type: "string", default: "var(--chart-line-primary)", description: "Line color." },
        { name: "strokeWidth", type: "number", default: "2.5", description: "Line width." },
        { name: "curve", type: "CurveFactory", default: "curveNatural", description: "A d3-shape curve." },
        { name: "showHighlight", type: "boolean", default: "true", description: "Highlight the series on hover." },
        { name: "fadeEdges", type: 'boolean | "left" | "right"', default: "false", description: "Fade the line at the edges." },
        { name: "showMarkers", type: "boolean", default: "false", description: "Draw a marker at each point." },
        { name: "dashFromIndex", type: "number", description: "Draw the line dashed from this data index to the end." },
        { name: "dashArray", type: "string", default: '"6,4"', description: "Dash pattern used from dashFromIndex." },
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
    {
      name: "ChartMarkers",
      description: "Icons on the x axis for events on given dates. Markers on the same date stack.",
      props: [
        { name: "items", type: "ChartMarker[]", description: "Each item has date, icon, title and optionally description, href, target, color and onClick." },
        { name: "size", type: "number", default: "28", description: "Marker size in px." },
        { name: "showLines", type: "boolean", default: "true", description: "Vertical guide lines." },
        { name: "maxFanned", type: "number", description: "How many stacked markers fan out on hover." },
      ],
    },
    {
      name: "LineChartLoading",
      description: "A standalone loading placeholder with generated data.",
      props: [
        { name: "loadingStyle", type: '"pulse" | "sweep"', default: '"pulse"', description: "Loading animation." },
        { name: "label", type: "string", default: '"Loading"', description: "Label shown over the chart." },
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio of the chart." },
        { name: "gridShimmer", type: "boolean", default: "true", description: "Animate a shimmer band across the grid lines." },
        { name: "className", type: "string", description: "Class on the chart container." },
      ],
    },
  ],
};
