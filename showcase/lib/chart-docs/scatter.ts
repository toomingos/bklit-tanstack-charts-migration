import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), sessions: 140, conversions: 72 },
  { date: new Date("2025-02-01"), sessions: 188, conversions: 95 },
  { date: new Date("2025-03-01"), sessions: 215, conversions: 110 },
  { date: new Date("2025-04-01"), sessions: 171, conversions: 84 },
  { date: new Date("2025-05-01"), sessions: 236, conversions: 121 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Points over time for comparing series, with a ring around each point and a crosshair tooltip.",
  code: `import { ChartTooltip, Grid, Scatter, ScatterChart, XAxis } from "bklit-tanstack-charts";

${data}

export function TrafficChart() {
  return (
    <ScatterChart data={data} aspectRatio="2/1">
      <Grid horizontal />
      <Scatter dataKey="sessions" />
      <Scatter dataKey="conversions" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
`,
  usage: `import { ChartTooltip, Scatter, ScatterChart, XAxis } from "bklit-tanstack-charts";

${data}

export function TrafficChart() {
  return (
    <ScatterChart data={data}>
      <Scatter dataKey="sessions" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
`,
  api: [
    {
      name: "ScatterChart",
      description: "The root. Holds the data and lays out its children.",
      props: [
        { name: "data", type: "Record<string, unknown>[]", description: "One object per point in time." },
        { name: "xDataKey", type: "string", default: '"date"', description: "Key holding the x value (a Date)." },
        { name: "animationDuration", type: "number", default: "1100", description: "Reveal duration in ms." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 40, bottom: 40, left: 40 }", description: "Space around the plot." },
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio of the chart." },
        { name: "revealSignature", type: "string", description: "Changing it plays the reveal again." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
    {
      name: "Scatter",
      description: "One series of points.",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "fill", type: "string", description: "Point color. Defaults to the next series color." },
        { name: "radius", type: "number", default: "5", description: "Point radius in px." },
        { name: "stroke", type: "string", description: "Ring color. Defaults to the point color." },
        { name: "strokeWidth", type: "number", default: "2", description: "Ring width. 0 hides the ring." },
        { name: "ringGap", type: "number", default: "2", description: "Gap between point and ring in px." },
        { name: "outlineWidth", type: "number", default: "0", description: "Width of an outer outline around the ring." },
        { name: "outlineColor", type: "string", description: "Outline color." },
        { name: "yGradient", type: "boolean | { from?: string; to?: string }", description: "Color points by their y value." },
        { name: "fadeOnHover", type: "boolean", default: "true", description: "Dim the other points while one is hovered." },
        { name: "inactiveOpacity", type: "number", default: "0.5", description: "Opacity of dimmed points." },
        { name: "inactiveBlur", type: "number", default: "2", description: "Blur in px of dimmed points." },
        { name: "enterBlur", type: "number", default: "2", description: "Blur in px that points start with during the reveal." },
        { name: "showActiveHighlight", type: "boolean", default: "true", description: "Enlarge the hovered point." },
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
        { name: "indicatorColor", type: "string | (point) => string", description: "Crosshair color." },
        { name: "rows", type: "(point) => TooltipRow[]", description: "Rows shown in the box." },
        { name: "content", type: "(props) => ReactNode", description: "Replaces the box content." },
      ],
    },
  ],
};
